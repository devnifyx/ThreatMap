import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Pagination from '../Pagination';

// P2-8 — one pager replacing 30 hand-written copies across seven CSS prefixes.
// The disabled state is a prop rather than derived, because those 30 sites used
// SIX different "is there a next page" expressions; deriving it would have
// silently changed behaviour at ten of them. These tests pin both the defaults
// (which cover the majority) and the overrides (which cover the rest).
afterEach(() => cleanup());

const base = { page: 2, totalPages: 5, total: 1234, onPrev: vi.fn(), onNext: vi.fn(), prefix: 'ti' as const };
const prev = () => screen.getByText('‹ Prev');
const next = () => screen.getByText('Next ›');

describe('Pagination', () => {
    it('renders the shared label with thousands separators', () => {
        render(<Pagination {...base} />);
        expect(screen.getByText('Page 2 of 5 · 1,234 total')).toBeInTheDocument();
    });

    it.each([['ti'], ['mon'], ['history'], ['findings']] as const)(
        'keeps the %s- class prefix its stylesheet expects', (prefix) => {
            const { container } = render(<Pagination {...base} prefix={prefix} />);
            expect(container.querySelector(`.${prefix}-pagination`)).toBeTruthy();
            expect(container.querySelector(`.${prefix}-pagination-info`)).toBeTruthy();
        });

    it('gives both buttons type="button"', () => {
        // Five of the thirty copies omitted this. No enclosing <form> existed,
        // so it was latent rather than live — but a bare button defaults to
        // submit, and routing every site through here settles it.
        render(<Pagination {...base} />);
        expect(prev()).toHaveAttribute('type', 'button');
        expect(next()).toHaveAttribute('type', 'button');
    });

    it('disables Prev on the first page and Next on the last, by default', () => {
        const { rerender } = render(<Pagination {...base} page={1} />);
        expect(prev()).toBeDisabled();
        expect(next()).not.toBeDisabled();
        rerender(<Pagination {...base} page={5} />);
        expect(prev()).not.toBeDisabled();
        expect(next()).toBeDisabled();
    });

    it('lets a caller override the default disabled logic', () => {
        // e.g. the offset-based sites using `page * pageSize >= total`.
        render(<Pagination {...base} page={2} totalPages={5} nextDisabled prevDisabled={false} />);
        expect(next()).toBeDisabled();
        expect(prev()).not.toBeDisabled();
    });

    it('honours a loading gate passed as disabled, which two sites rely on', () => {
        render(<Pagination {...base} prevDisabled nextDisabled />);
        expect(prev()).toBeDisabled();
        expect(next()).toBeDisabled();
    });

    it('calls the handlers it was given', () => {
        const onPrev = vi.fn(); const onNext = vi.fn();
        render(<Pagination {...base} onPrev={onPrev} onNext={onNext} />);
        fireEvent.click(prev());
        fireEvent.click(next());
        expect(onPrev).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledTimes(1);
    });

    it('does not fire a handler for a disabled button', () => {
        const onPrev = vi.fn();
        render(<Pagination {...base} page={1} onPrev={onPrev} />);
        fireEvent.click(prev());
        expect(onPrev).not.toHaveBeenCalled();
    });
});
