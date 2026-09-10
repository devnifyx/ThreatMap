import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import EntityPicker, { excludeNonEntities } from '../EntityPicker';
import ConfirmDialog from '../ConfirmDialog';
import { downloadBlob, downloadTextFile } from '../downloadFile';

// P1-5 — the three components extracted from copies scattered across the app.
// These pin the behaviour the copies had, plus the two things the extraction
// actually fixed: every download now revokes its object URL and attaches its
// anchor before clicking.
const searchIntelligence = vi.hoisted(() => vi.fn());
vi.mock('../../../services/api', () => ({ searchIntelligence }));

const RESULTS = [
    { type: 'ioc', id: '1', label: 'evil.example' },
    { type: 'campaign', id: '2', label: 'Operation Kite' },
    { type: 'alert', id: '3', label: 'Some alert' },
    { type: 'investigation', id: '4', label: 'Some investigation' },
];

beforeEach(() => { searchIntelligence.mockReset(); searchIntelligence.mockResolvedValue(RESULTS); });
afterEach(() => cleanup());

describe('EntityPicker', () => {
    it('shows the placeholder the caller passed — the copies differed only in this', () => {
        render(<EntityPicker onPick={vi.fn()} onCancel={vi.fn()} placeholder="Search techniques…" />);
        expect(screen.getByPlaceholderText('Search techniques…')).toBeInTheDocument();
    });

    it('does not search until something is typed', () => {
        render(<EntityPicker onPick={vi.fn()} onCancel={vi.fn()} placeholder="p" />);
        expect(searchIntelligence).not.toHaveBeenCalled();
    });

    it('debounces, so typing does not fire a request per keystroke', () => {
        vi.useFakeTimers();
        try {
            render(<EntityPicker onPick={vi.fn()} onCancel={vi.fn()} placeholder="p" />);
            const input = screen.getByPlaceholderText('p');
            fireEvent.change(input, { target: { value: 'e' } });
            fireEvent.change(input, { target: { value: 'ev' } });
            fireEvent.change(input, { target: { value: 'evil' } });
            expect(searchIntelligence).not.toHaveBeenCalled();
            vi.advanceTimersByTime(300);
            expect(searchIntelligence).toHaveBeenCalledTimes(1);
            expect(searchIntelligence).toHaveBeenCalledWith('evil');
        } finally {
            vi.useRealTimers();
        }
    });

    it('excludes alerts and investigations by default — they are not linkable entities', async () => {
        render(<EntityPicker onPick={vi.fn()} onCancel={vi.fn()} placeholder="p" />);
        fireEvent.change(screen.getByPlaceholderText('p'), { target: { value: 'x' } });
        await screen.findByText(/evil.example/);
        expect(screen.getByText(/Operation Kite/)).toBeInTheDocument();
        expect(screen.queryByText(/Some alert/)).toBeNull();
        expect(screen.queryByText(/Some investigation/)).toBeNull();
    });

    it('honours a narrower caller filter, as Knowledge Base needs', async () => {
        render(<EntityPicker onPick={vi.fn()} onCancel={vi.fn()} placeholder="p" filter={(i) => i.type === 'campaign'} />);
        fireEvent.change(screen.getByPlaceholderText('p'), { target: { value: 'x' } });
        await screen.findByText(/Operation Kite/);
        expect(screen.queryByText(/evil.example/)).toBeNull();
    });

    it('hands the whole picked item back to the caller', async () => {
        const onPick = vi.fn();
        render(<EntityPicker onPick={onPick} onCancel={vi.fn()} placeholder="p" />);
        fireEvent.change(screen.getByPlaceholderText('p'), { target: { value: 'x' } });
        fireEvent.click(await screen.findByText(/evil.example/));
        expect(onPick).toHaveBeenCalledWith(RESULTS[0]);
    });

    it('reports no matches rather than showing an empty box', async () => {
        searchIntelligence.mockResolvedValue([]);
        render(<EntityPicker onPick={vi.fn()} onCancel={vi.fn()} placeholder="p" />);
        fireEvent.change(screen.getByPlaceholderText('p'), { target: { value: 'zzz' } });
        expect(await screen.findByText('No matches.')).toBeInTheDocument();
    });

    it('exposes the default filter for reuse', () => {
        expect(excludeNonEntities({ type: 'ioc' } as any)).toBe(true);
        expect(excludeNonEntities({ type: 'alert' } as any)).toBe(false);
    });
});

describe('ConfirmDialog', () => {
    const base = { title: 'Delete?', text: 'This cannot be undone.', busy: false, onCancel: vi.fn(), onConfirm: vi.fn() };

    it.each([['ti'], ['mon']] as const)('keeps the %s- class prefix its stylesheet expects', (prefix) => {
        const { container } = render(<ConfirmDialog {...base} prefix={prefix} />);
        expect(container.querySelector(`.${prefix}-confirm-overlay`)).toBeTruthy();
        expect(container.querySelector(`.${prefix}-confirm-danger`)).toBeTruthy();
    });

    it('disables both actions while busy, so a slow request is not double-sent', () => {
        render(<ConfirmDialog {...base} busy prefix="ti" />);
        expect(screen.getByText('Cancel')).toBeDisabled();
        expect(screen.getByText('Working…')).toBeDisabled();
    });

    it('ignores an overlay click while busy', () => {
        const onCancel = vi.fn();
        const { container } = render(<ConfirmDialog {...base} busy onCancel={onCancel} prefix="ti" />);
        fireEvent.mouseDown(container.querySelector('.ti-confirm-overlay')!);
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('cancels on an overlay click when idle, but not on a click inside the dialog', () => {
        const onCancel = vi.fn();
        const { container } = render(<ConfirmDialog {...base} onCancel={onCancel} prefix="ti" />);
        fireEvent.mouseDown(container.querySelector('.ti-confirm')!);
        expect(onCancel).not.toHaveBeenCalled();
        fireEvent.mouseDown(container.querySelector('.ti-confirm-overlay')!);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('omits the meta line when there is nothing to say', () => {
        const { container } = render(<ConfirmDialog {...base} prefix="ti" />);
        expect(container.querySelector('.ti-confirm-meta')).toBeNull();
    });
});

describe('downloadFile', () => {
    let createSpy: any, revokeSpy: any, clickSpy: any;
    beforeEach(() => {
        createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stub');
        revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });
    afterEach(() => vi.restoreAllMocks());

    it('names the file and cleans up the object URL', () => {
        downloadBlob(new Blob(['x']), 'report.json');
        expect(createSpy).toHaveBeenCalledTimes(1);
        expect(clickSpy).toHaveBeenCalledTimes(1);
        // Eight of the replaced copies never revoked; this is the fix.
        expect(revokeSpy).toHaveBeenCalledWith('blob:stub');
    });

    it('attaches the anchor to the document before clicking, then removes it', () => {
        let attachedWhenClicked = false;
        clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
            attachedWhenClicked = document.body.contains(this);
        });
        downloadBlob(new Blob(['x']), 'report.json');
        // A detached anchor is not reliably actioned across browsers; several
        // replaced copies clicked one anyway.
        expect(attachedWhenClicked).toBe(true);
        expect(document.querySelector('a[download]')).toBeNull();
    });

    it('still revokes the URL when the click throws', () => {
        clickSpy.mockImplementation(() => { throw new Error('blocked'); });
        expect(() => downloadBlob(new Blob(['x']), 'f.txt')).toThrow('blocked');
        expect(revokeSpy).toHaveBeenCalledWith('blob:stub');
    });

    it('wraps text in a blob of the requested type', () => {
        let captured: Blob | null = null;
        createSpy.mockImplementation((b: Blob) => { captured = b; return 'blob:stub'; });
        downloadTextFile({ filename: 'a.csv', text: 'a,b', mime: 'text/csv' });
        // jsdom's Blob has no .text(), so assert on type and byte length.
        expect(captured!.type).toBe('text/csv');
        expect(captured!.size).toBe(3);
    });
});
