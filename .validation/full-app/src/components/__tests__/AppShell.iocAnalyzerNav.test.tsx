import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import AppShell, { type ShellView } from '../AppShell';

// IOC_PHASE1.md §101/§103 — "IOC Analyzer is no longer a placeholder" is
// primarily a routing fact (the leaf has a real `target`, so clicking it
// calls onNavigate instead of opening OsintPlaceholderPane); verified here
// the same way AppShell.telegramNav.test.tsx verifies its own leaf.
//
// The leaf moved out of the dissolved "AI" section into Threat Intelligence,
// next to the Indicators it analyses (18 of its 21 routes are deterministic
// enrichment). These cases therefore open the Threat Intelligence accordion
// rather than the AI one; what they assert about the leaf is unchanged.
vi.mock('../SmoothScroll', () => ({
    default: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock('lucide-react', () => ({
    Home: () => null, LayoutDashboard: () => null, Globe: () => null, Radar: () => null, Target: () => null,
    Fingerprint: () => null, Activity: () => null, FolderSearch: () => null, FileText: () => null, Bot: () => null,
    ShieldCheck: () => null, ChevronDown: () => null, ChevronsLeft: () => null, ChevronsRight: () => null, Settings: () => null,
    UserRound: () => null, Building2: () => null, Server: () => null, KeyRound: () => null, Images: () => null, Search: () => null
}));
vi.mock('../../services/api', () => ({ logout: vi.fn() }));

afterEach(() => cleanup());

function renderShell(activeView: ShellView) {
    const onNavigate = vi.fn();
    render(
        <AppShell activeView={activeView} onNavigate={onNavigate} isAdmin={false} onLogout={vi.fn()}>
            <div>content</div>
        </AppShell>
    );
    return { onNavigate };
}
const first = (text: string) => screen.getAllByText(text)[0];
const findFirst = async (text: string) => (await screen.findAllByText(text))[0];

describe('IOC_PHASE1 — IOC Analyzer leaf is a real route, not a placeholder', () => {
    it('clicking IOC Analyzer calls onNavigate with the real route (no placeholder)', async () => {
        const { onNavigate } = renderShell('ti-overview'); // any view inside Threat Intelligence
        fireEvent.click(await findFirst('IOC Analyzer'));
        expect(onNavigate).toHaveBeenCalledWith('ioc-analyzer');
        expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('the leaf is NOT rendered as a placeholder leaf', async () => {
        renderShell('ti-overview');
        const leaf = (await findFirst('IOC Analyzer')).closest('button');
        expect(leaf?.className || '').not.toMatch(/app-shell-nav-leaf--placeholder/);
    });

    it('IOC Analyzer receives the active state when it is the current view', () => {
        renderShell('ioc-analyzer');
        const leaf = screen.getByText('IOC Analyzer').closest('button');
        expect(leaf?.className || '').toMatch(/active/);
    });

    it('appears exactly once, in Threat Intelligence', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        expect(screen.getAllByText('IOC Analyzer')).toHaveLength(1);
    });

    it('is no longer under an "AI" section — that section is dissolved', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        // Ask AI survives as a flat top-level entry; the accordion does not.
        expect(screen.queryByText('AI')).toBeNull();
        expect(screen.getAllByText('Ask AI').length).toBeGreaterThan(0);
    });
});
