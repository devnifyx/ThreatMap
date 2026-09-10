import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import AppShell, { type ShellView } from '../AppShell';

// lucide-react and `lenis` (via SmoothScroll) both pull a second React copy
// through this project's vitest alias setup, crashing with a useContext/
// useRef-on-null error under jsdom — see PerformanceMonitorPage.test.tsx's
// identical lucide-react note and App.test.tsx's identical SmoothScroll
// mock. Not something this test can fix; mocked out the same way.
vi.mock('../SmoothScroll', () => ({
    default: ({ children }: { children: ReactNode }) => <>{children}</>
}));
vi.mock('lucide-react', () => ({
    Home: () => null, LayoutDashboard: () => null, Globe: () => null, Radar: () => null, Target: () => null,
    Fingerprint: () => null, Activity: () => null, FolderSearch: () => null, FileText: () => null, Bot: () => null,
    ShieldCheck: () => null, ChevronDown: () => null, ChevronsLeft: () => null, ChevronsRight: () => null, Settings: () => null,
    UserRound: () => null, Building2: () => null, Server: () => null, ShieldAlert: () => null, KeyRound: () => null,
    Images: () => null, Search: () => null
}));

vi.mock('../../services/api', () => ({ logout: vi.fn() }));

// TELEGRAM_INTELLIGENCE_PHASE4.md §31/§34 — the sidebar reorganization is
// pure data (NAV_TREE) plus the existing generic expand/active-state logic
// (isTargetActive/sectionOwnsActive/activeOwnerGroupId), so this exercises
// the REAL AppShell component to verify Telegram inherits that logic
// correctly by construction, exactly like every sibling group already does.

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

// AppShell renders each group/section label twice — a visible span plus a
// role="tooltip" duplicate for the collapsed rail — so every text query
// below takes the first match, matching what a real user actually clicks.
const first = (text: string) => screen.getAllByText(text)[0];
const findFirst = async (text: string) => (await screen.findAllByText(text))[0];

describe('§1/§2 — Telegram Intelligence lives under Exposure Intelligence', () => {
    it('renders exactly one Telegram Intelligence nav item, under Exposure Intelligence', async () => {
        // 'osint-leak' is itself an Exposure Intelligence leaf, so OSINT
        // and its parent group both auto-expand (§11) with no click needed.
        renderShell('osint-leak');
        expect(screen.getAllByText('Telegram Intelligence')).toHaveLength(1);
        expect(await findFirst('Exposure Intelligence')).toBeInTheDocument();
    });

    it('§33 no duplication — Telegram never appears under Identity Intelligence', async () => {
        // 'osint-social-media-intel' auto-expands Identity Intelligence.
        renderShell('osint-social-media-intel');
        expect(await findFirst('Social Media Intelligence')).toBeInTheDocument();
        expect(screen.queryByText('Telegram Intelligence')).not.toBeInTheDocument();
    });

    it('§20 Social Media Intelligence remains under Identity Intelligence, functionally unchanged', async () => {
        renderShell('osint-social-media-intel');
        const smiLink = await findFirst('Social Media Intelligence');
        expect(smiLink.closest('button')?.className || '').toMatch(/active/);
    });

    it('a section with no active leaf inside it requires a click to expand (Identity Intelligence, from an unrelated active view)', async () => {
        renderShell('osint-dashboard'); // not inside any group
        expect(screen.queryByText('Social Media Intelligence')).not.toBeInTheDocument();
        fireEvent.click(first('Identity Intelligence'));
        expect(await findFirst('Social Media Intelligence')).toBeInTheDocument();
    });
});

describe('§12/§14/§34 — Telegram active state + direct URL / refresh', () => {
    it('a direct load on the Telegram route auto-expands OSINT > Exposure Intelligence with no manual click', () => {
        renderShell('osint-telegram-intel');
        // §14 "Do not require the user to manually expand Exposure
        // Intelligence" — it must already be visible without clicking anything.
        expect(screen.getByText('Telegram Intelligence')).toBeInTheDocument();
    });

    it('the Telegram leaf itself receives the active state', () => {
        renderShell('osint-telegram-intel');
        const leaf = screen.getByText('Telegram Intelligence');
        expect(leaf.closest('button')?.className || '').toMatch(/active/);
    });

    it('§12 the Exposure Intelligence PARENT also remains visually active, using the same active styling as every other group', () => {
        renderShell('osint-telegram-intel');
        const parent = first('Exposure Intelligence');
        expect(parent.closest('button')?.className || '').toMatch(/active/);
    });

    it('a sibling route (Advanced Email Lookup) does not falsely mark Telegram active', () => {
        // CREDENTIAL_LEAK_PHASE1.md §67/§68 — this Exposure Intelligence pillar
        // now has TWO credential leaves: 'Credential Leak' (the domain-first
        // Watchlist workspace, target 'osint-credential-leak-intel') and
        // 'Advanced Email Lookup' (the legacy email-only tool, still
        // 'osint-leak'). This case renders the legacy one, so IT is the leaf
        // that must be active.
        renderShell('osint-leak');
        const telegramLeaf = screen.getByText('Telegram Intelligence');
        expect(telegramLeaf.closest('button')?.className || '').not.toMatch(/active/);
        const emailLookupLeaf = screen.getByText('Advanced Email Lookup');
        expect(emailLookupLeaf.closest('button')?.className || '').toMatch(/active/);
        // ...and the domain-first sibling must NOT be falsely activated either.
        const credentialLeakLeaf = screen.getByText('Credential Leak');
        expect(credentialLeakLeaf.closest('button')?.className || '').not.toMatch(/active/);
    });

    it('CREDENTIAL_LEAK_PHASE1.md §67 — the domain-first Credential Leak leaf is reachable and activates on its own route', () => {
        // Regression guard for the "inert nav leaf" bug this feature shipped
        // with: OsintPage had the section, but AppShell had no target and
        // App.tsx had no view mapping, so the whole workspace was unreachable
        // and the sidebar's "Credential Leak" opened the email-only lookup.
        const { onNavigate } = renderShell('osint-credential-leak-intel');
        const leaf = screen.getByText('Credential Leak');
        expect(leaf.closest('button')?.className || '').toMatch(/active/);
        fireEvent.click(leaf);
        expect(onNavigate).toHaveBeenCalledWith('osint-credential-leak-intel');
    });

    it('REPORT_GENERATOR_PHASE1.md — the Report Generator leaf is reachable and activates on its own route', () => {
        // Same "inert nav leaf" bug class as Credential Leak above (and
        // Malware/Notes/Dark Web before it): this leaf previously had no
        // `target` at all, so it fell through to AppShell's own generic
        // "planned for a future update" placeholder regardless of whatever
        // page existed behind it.
        const { onNavigate } = renderShell('report-generator');
        const leaf = screen.getByText('Report Generator');
        expect(leaf.closest('button')?.className || '').toMatch(/active/);
        fireEvent.click(leaf);
        expect(onNavigate).toHaveBeenCalledWith('report-generator');
    });

    it('MITRE_MAPPER_PHASE1.md — the MITRE ATT&CK leaf is reachable and activates on its own route', () => {
        // Same "inert nav leaf" bug class as every prior phase above: this
        // leaf previously had no `target` at all ({ id: 'mitre-mapper',
        // label: 'MITRE Mapper' }), so it fell through to AppShell's own
        // generic "planned for a future update" placeholder.
        // P1-8 — the leaf now reads "MITRE ATT&CK": the Threat Intelligence
        // section of that name was a strict subset of this module over the
        // same `/api/intelligence/attack/*` endpoints, so the two merged and
        // the surviving leaf kept the catalogue's name. The route is unchanged.
        const { onNavigate } = renderShell('mitre-mapper');
        const leaf = screen.getAllByText('MITRE ATT&CK')[0];
        expect(leaf.closest('button')?.className || '').toMatch(/active/);
        fireEvent.click(leaf);
        expect(onNavigate).toHaveBeenCalledWith('mitre-mapper');
    });
});

describe('§13 clicking Telegram Intelligence navigates via the existing onNavigate contract', () => {
    it('calls onNavigate with the existing route — no duplicate route created', () => {
        // Start from a view where Exposure Intelligence is already expanded
        // (§11), so this exercises only the click-to-navigate behavior.
        const { onNavigate } = renderShell('osint-leak');
        fireEvent.click(screen.getByText('Telegram Intelligence'));
        expect(onNavigate).toHaveBeenCalledWith('osint-telegram-intel');
        expect(onNavigate).toHaveBeenCalledTimes(1);
    });
});

describe('§10 unrelated-gap fix discovered while verifying this — Social Media Intelligence active state', () => {
    it('now also highlights correctly (previously always fell through to inactive — isTargetActive had no case for it)', async () => {
        renderShell('osint-social-media-intel');
        const leaf = await findFirst('Social Media Intelligence');
        expect(leaf.closest('button')?.className || '').toMatch(/active/);
    });
});
