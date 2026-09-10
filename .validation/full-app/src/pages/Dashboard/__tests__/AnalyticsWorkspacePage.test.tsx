import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AnalyticsWorkspacePage from '../AnalyticsWorkspacePage';

// P1-3 — Analytics, Trends and Statistics became tabs of one workspace. The
// three bodies are stubbed here: what is under test is the shell's contract —
// one body mounted at a time (each fetches on mount, so mounting all three
// would fire three requests for one visible view) and a redirected bookmark
// landing on its own tab.
const mounts = vi.hoisted(() => [] as string[]);
vi.mock('../StatisticsPage', () => ({ default: () => { mounts.push('statistics'); return <div>statistics body</div>; } }));
vi.mock('../TrendsPage', () => ({ default: () => { mounts.push('trends'); return <div>trends body</div>; } }));
vi.mock('../AnalyticsPage', () => ({ default: () => { mounts.push('analytics'); return <div>analytics body</div>; } }));
vi.mock('../AnalyticsPage.css', () => ({}));
// Same mock the AppShell suites use: lucide-react resolves React from
// frontend/node_modules (a second copy of 18.3.1) while react-dom uses the
// root one, so its icons hit a null hook dispatcher under jsdom. The tab
// icons are decorative — mocking them keeps this file testing the tab
// contract rather than the dependency tree.
vi.mock('lucide-react', () => ({ BarChart3: () => null, LineChart: () => null, PieChart: () => null }));

afterEach(() => { cleanup(); mounts.length = 0; });

describe('P1-3 — one Analytics workspace, three tabs', () => {
    it('offers all three views as tabs under a single heading', () => {
        render(<AnalyticsWorkspacePage />);
        expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
        expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Statistics', 'Trends', 'Analytics']);
    });

    it('mounts only the selected tab body', () => {
        render(<AnalyticsWorkspacePage />);
        expect(mounts).toEqual(['statistics']);
        expect(screen.queryByText('trends body')).toBeNull();
        expect(screen.queryByText('analytics body')).toBeNull();
    });

    it('switches bodies when a tab is chosen, without mounting the others', () => {
        render(<AnalyticsWorkspacePage />);
        mounts.length = 0;
        fireEvent.click(screen.getByRole('tab', { name: 'Trends' }));
        expect(screen.getByText('trends body')).toBeInTheDocument();
        expect(screen.queryByText('statistics body')).toBeNull();
        expect(mounts).toEqual(['trends']);
    });

    it('marks the active tab for assistive technology', () => {
        render(<AnalyticsWorkspacePage />);
        fireEvent.click(screen.getByRole('tab', { name: 'Analytics' }));
        expect(screen.getByRole('tab', { name: 'Analytics' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'Statistics' })).toHaveAttribute('aria-selected', 'false');
    });

    it.each([['trends'], ['statistics'], ['analytics']] as const)(
        'opens directly on the %s tab when a redirected bookmark names it', (tab) => {
            render(<AnalyticsWorkspacePage initialTab={tab} />);
            expect(mounts).toEqual([tab]);
        });

    it('tells the caller the deep-linked tab was consumed, so it is not re-applied', () => {
        const onInitialTabConsumed = vi.fn();
        render(<AnalyticsWorkspacePage initialTab="trends" onInitialTabConsumed={onInitialTabConsumed} />);
        expect(onInitialTabConsumed).toHaveBeenCalledTimes(1);
    });
});
