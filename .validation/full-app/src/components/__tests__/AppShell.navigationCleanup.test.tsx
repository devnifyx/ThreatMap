import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import AppShell, { type ShellView } from '../AppShell';

// FIX_NAVIGATION_&_INTELLIGENCE_ARCHITECTURE.md §52/§53 — same harness
// pattern as AppShell.telegramNav.test.tsx: the real AppShell component,
// mocking only lucide-react/SmoothScroll (jsdom's known dual-React-copy
// crash) and the api module (logout).
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

afterEach(() => cleanup());

function renderShell(activeView: ShellView, isAdmin = false) {
    const onNavigate = vi.fn();
    render(
        <AppShell activeView={activeView} onNavigate={onNavigate} isAdmin={isAdmin} onLogout={vi.fn()}>
            <div>content</div>
        </AppShell>
    );
    return { onNavigate };
}

// AppShell renders each label twice (a visible span + a role="tooltip"
// duplicate for the collapsed rail) — take the first, matching a real click.
const first = (text: string) => screen.getAllByText(text)[0];
const findFirst = async (text: string) => (await screen.findAllByText(text))[0];

// Labels of every leaf sharing a nav section with `text`, in render order.
const siblingLabels = async (text: string) => {
    const leaf = await findFirst(text);
    const container = leaf.closest('.app-shell-nav-children');
    expect(container).toBeTruthy();
    return Array.from(container!.querySelectorAll('.app-shell-nav-leaf')).map((el) => el.textContent);
};

describe('CASE 1-4 — OSINT menu no longer duplicates normalized CTI modules', () => {
    it('CASE 1 — OSINT has NO Malware Intelligence entry', async () => {
        // 'osint-dashboard' is itself an OSINT leaf, so OSINT auto-expands with no click needed (matching AppShell.telegramNav.test.tsx's own established pattern).
        renderShell('osint-dashboard');
        await findFirst('Investigation Dashboard');
        expect(screen.queryByText('Malware Intelligence')).not.toBeInTheDocument();
    });

    it('CASE 2 — OSINT has NO Vulnerability Intelligence entry', async () => {
        renderShell('osint-dashboard');
        await findFirst('Investigation Dashboard');
        expect(screen.queryByText('Vulnerability Intelligence')).not.toBeInTheDocument();
    });

    it('CASE 3 — OSINT has NO Threat Actor Intelligence entry', async () => {
        renderShell('osint-dashboard');
        await findFirst('Investigation Dashboard');
        expect(screen.queryByText('Threat Actor Intelligence')).not.toBeInTheDocument();
    });

    it('CASE 4 — OSINT has NO Phishing Detection / Phishing Intelligence entry (relocated to Threat Intelligence)', async () => {
        renderShell('osint-dashboard');
        await findFirst('Investigation Dashboard');
        expect(screen.queryByText('Phishing Detection')).not.toBeInTheDocument();
        expect(screen.queryByText('Phishing Intelligence')).not.toBeInTheDocument();
    });

    it('§17/§25 OSINT retains its own genuine modules unaffected by the cleanup', async () => {
        renderShell('osint-dashboard');
        expect(await findFirst('Investigation Dashboard')).toBeInTheDocument();
        expect(first('Target Management')).toBeInTheDocument();
    });
});

describe('CASE 5-9 — Threat Intelligence menu contains each module exactly once', () => {
    it('CASE 5 — Malware Intelligence appears exactly once', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        expect(screen.getAllByText('Malware Intelligence')).toHaveLength(1);
    });

    it('CASE 6 — Vulnerability Intelligence appears exactly once', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        expect(screen.getAllByText('Vulnerability Intelligence')).toHaveLength(1);
    });

    it('CASE 7 — Threat Actors appears exactly once', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        expect(screen.getAllByText('Threat Actors')).toHaveLength(1);
    });

    // P1-7 — CASE 8 originally guarded against APT Group Intelligence being
    // duplicated into OSINT. The module is gone as a separate leaf: it was a
    // second UI over the same `threat_actors` rows, split only by the
    // is_apt_group boolean, and is now a Classification filter inside Threat
    // Actors. The no-duplication invariant survives as "zero, not two".
    it('CASE 8 — APT Group Intelligence is no longer a separate leaf', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        expect(screen.queryByText('APT Group Intelligence')).toBeNull();
        expect(screen.getAllByText('Threat Actors')).toHaveLength(1);
    });

    // P1-12 renamed this leaf back to "Phishing Detection" — the target is
    // still the single-URL scan flow, so "Intelligence" oversold it. The
    // no-duplication invariant is unchanged.
    it('CASE 9 — Phishing Detection appears exactly once', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        expect(screen.getAllByText('Phishing Detection')).toHaveLength(1);
        expect(screen.queryByText('Phishing Intelligence')).toBeNull();
    });

    it('§42 Threat Intelligence displays every expected module, in the specified order', async () => {
        renderShell('ti-overview');
        const section = await findFirst('Intelligence Overview');
        const container = section.closest('.app-shell-nav-children');
        expect(container).toBeTruthy();
        const labels = Array.from(container!.querySelectorAll('.app-shell-nav-leaf')).map((el) => el.textContent);
        expect(labels).toEqual([
            'Intelligence Overview', 'Indicators (IOC)', 'IOC Analyzer', 'Campaigns', 'Threat Feeds',
            // P1-8 — one MITRE ATT&CK leaf, not a catalogue leaf plus a Mapper leaf.
            'MITRE ATT&CK',
            // P1-11 — Malware Analysis co-located beside Malware Intelligence.
            'Threat Actors', 'Malware Intelligence', 'Malware Analysis', 'Vulnerability Intelligence',
            'Phishing Detection', 'Correlation', 'Threat Hunting',
            'Entity Risk & Assessment', 'Intelligence Workspace', 'Intelligence History',
            // MULTI_SERVICE_CTI_ENTITLEMENT_ARCHITECTURE_PLAN.md Phase 1 —
            // relocated from Administration -> Clients (plan §4/§8/§11).
            'Shadowserver',
        ]);
    });

    // Each analysis tool sits next to the data it works on: IOC Analyzer by
    // Indicators. That adjacency is the point of the P1-2 move, so assert it
    // rather than just presence. MITRE Mapper was the other half of this
    // assertion until P1-8 merged it into the MITRE ATT&CK leaf beside it —
    // adjacency became identity, covered by the P1-8 block below.
    it('places each moved tool next to the data it operates on', async () => {
        renderShell('ti-overview');
        const section = await findFirst('Intelligence Overview');
        const labels = Array.from(section.closest('.app-shell-nav-children')!.querySelectorAll('.app-shell-nav-leaf')).map((el) => el.textContent);
        expect(labels.indexOf('IOC Analyzer')).toBe(labels.indexOf('Indicators (IOC)') + 1);
    });

    // "Intelligence Reports" was a SECOND UI over the same
    // `intelligence_reports` rows Threat Briefs owns — same routes, same
    // api.ts functions — so one record appeared under two names. Threat
    // Briefs is the single surviving UI.
    it('no longer offers a duplicate "Intelligence Reports" entry point', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        expect(screen.queryByText('Intelligence Reports')).toBeNull();
    });
});

// The "Observables" section came from NAVIGATION_TREE_REDESIGN.md's
// scaffolding pass and never gained a backend: nine leaves with no `target`,
// no page, no API route, no table. Every type it listed is a value of
// `iocs.type`, i.e. Threat Intelligence > Indicators (IOC).
describe('Observables — the unimplemented placeholder section is gone', () => {
    it('no longer renders an Observables section', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        expect(screen.queryByText('Observables')).toBeNull();
    });

    it.each(['Domains', 'URLs', 'IPv4', 'IPv6', 'File Hashes', 'Files', 'Email Addresses', 'Certificates', 'Hostnames'])(
        'no longer renders the inert "%s" leaf',
        async (label) => {
            renderShell('ti-overview');
            await findFirst('Intelligence Overview');
            expect(screen.queryByText(label)).toBeNull();
        }
    );

    it('Indicators (IOC) — the real home for these types — is still present', async () => {
        renderShell('ti-overview');
        expect(await findFirst('Indicators (IOC)')).toBeTruthy();
    });

    it('every remaining leaf navigates to a real view — no leaf is inert', async () => {
        const { onNavigate } = renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        // A leaf with no target used to swallow the click and show a
        // placeholder pane instead of navigating. Nothing does that now.
        fireEvent.click(first('Indicators (IOC)'));
        expect(onNavigate).toHaveBeenCalledWith('ti-iocs');
        expect(document.querySelector('.app-shell-nav-leaf--placeholder')).toBeNull();
    });
});

// Six Monitoring leaves (IOC Watchlist / Domain / IP / Credential Exposure /
// Social Username / Threat Actor) rendered ONE component with a different
// `type` prop, while seven of the thirteen types the scheduler actually
// checks had no leaf at all. They were first consolidated into one "Monitors"
// leaf/list with a type filter, then that list itself merged into Monitoring
// Overview (it showed largely the same ground — active/failed monitor
// counts, one row per monitor — a click apart) — the list now sits at the
// bottom of the Monitoring Overview page instead of behind its own leaf.
// Brand Monitor keeps its own leaf because it is a genuinely different view
// rather than the same list re-typed.
describe('Monitoring — per-type leaves consolidated, then merged into Monitoring Overview', () => {
    it.each(['Monitors', 'IOC Watchlist', 'Domain Monitor', 'IP Monitor', 'Threat Actor Monitor', 'Credential Exposure Monitor', 'Social Username Monitor'])(
        'no longer offers a separate "%s" leaf',
        async (label) => {
            renderShell('mon-overview');
            await findFirst('Monitoring Overview');
            expect(screen.queryByText(label)).toBeNull();
        }
    );

    it('keeps the genuinely distinct Monitoring views', async () => {
        renderShell('mon-overview');
        await findFirst('Monitoring Overview');
        // P1-11 removed 'Live Feeds': it listed the same seven providers from
        // the same ring buffer as TI > Threat Feeds, which is the superset.
        for (const label of ['CVE Monitor', 'Brand Monitor', 'Alert Center', 'Monitoring History']) {
            expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        }
    });

    it('Monitoring exposes exactly the consolidated set, in order', async () => {
        renderShell('mon-overview');
        const section = await findFirst('Monitoring Overview');
        const labels = Array.from(section.closest('.app-shell-nav-children')!.querySelectorAll('.app-shell-nav-leaf')).map((el) => el.textContent);
        expect(labels).toEqual([
            'Monitoring Overview', 'CVE Monitor', 'Brand Monitor',
            'Alert Center', 'Monitoring History',
        ]);
    });
});

// The "AI" section grouped by HOW a feature is built rather than what job it
// does — an analyst looking for the ATT&CK matrix has no reason to look under
// "AI". By route count, four of its five members were mostly deterministic
// tools offering an optional AI step; only Ask AI is an AI product (11/11).
describe('P1-2 — the AI section is dissolved', () => {
    it('renders no "AI" section', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        expect(screen.queryByText('AI')).toBeNull();
    });

    it('keeps Ask AI as a flat top-level entry, not a one-child accordion', () => {
        const { onNavigate } = renderShell('dashboard');
        fireEvent.click(first('Ask AI'));
        expect(onNavigate).toHaveBeenCalledWith('ask-ai');
    });

    // The other two moved leaves land in sections whose own tests live
    // elsewhere, so assert their placement here: siblings of the entry they
    // were moved to sit beside, in the same children container.
    it('puts Threat Summary in Dashboard, under Executive Dashboard', async () => {
        renderShell('dashboard');
        const labels = await siblingLabels('Executive Dashboard');
        expect(labels.indexOf('Threat Summary')).toBe(labels.indexOf('Executive Dashboard') + 1);
    });

    it('puts Report Generator in Intelligence, under Threat Briefs', async () => {
        renderShell('threat-briefs');
        const labels = await siblingLabels('Threat Briefs');
        expect(labels.indexOf('Report Generator')).toBe(labels.indexOf('Threat Briefs') + 1);
    });
});

// P1-8 — Threat Intelligence carried a "MITRE ATT&CK" section (overview,
// technique list, technique detail) beside an "AI › MITRE Mapper" module. Both
// read the SAME `/api/intelligence/attack/*` endpoints — the Mapper consumed
// them rather than duplicating them — and the Mapper adds 34 deterministic
// routes on top, so the section was a strict subset. One leaf survives, keeping
// the catalogue's name and the Mapper's route.
describe('P1-8 — one MITRE ATT&CK module', () => {
    it('renders exactly one MITRE leaf, named for the catalogue', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        expect(screen.getAllByText('MITRE ATT&CK')).toHaveLength(1);
        expect(screen.queryByText('MITRE Mapper')).toBeNull();
    });

    it('that leaf routes to the surviving module, not the retired section', async () => {
        const { onNavigate } = renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        fireEvent.click(first('MITRE ATT&CK'));
        expect(onNavigate).toHaveBeenCalledWith('mitre-mapper');
        expect(onNavigate).not.toHaveBeenCalledWith('ti-attack');
    });

    it('still sits between Threat Feeds and Threat Actors, where the catalogue was', async () => {
        renderShell('ti-overview');
        const labels = await siblingLabels('Intelligence Overview');
        expect(labels.indexOf('MITRE ATT&CK')).toBe(labels.indexOf('Threat Feeds') + 1);
    });
});

// P1-3 — Analytics, Trends and Statistics were three Dashboard leaves for one
// question. They are NOT three views of the same numbers (counts vs time
// series vs derived rates), so nothing was deduplicated and all three
// endpoints remain — they became tabs of one workspace so the analyst compares
// them in place rather than by menu-hopping.
describe('P1-3 — one Analytics leaf', () => {
    it('keeps Analytics and drops the Trends and Statistics leaves', async () => {
        renderShell('analytics');
        await findFirst('Executive Dashboard');
        expect(screen.getAllByText('Analytics')).toHaveLength(1);
        expect(screen.queryByText('Trends')).toBeNull();
        expect(screen.queryByText('Statistics')).toBeNull();
    });

    it('routes that leaf to the analytics workspace', async () => {
        const { onNavigate } = renderShell('dashboard');
        await findFirst('Executive Dashboard');
        fireEvent.click(first('Analytics'));
        expect(onNavigate).toHaveBeenCalledWith('analytics');
    });

    it('leaves Scan Risk alone — it reads osint_activity.risk_level, not computeEntityRisk', async () => {
        // P1-3 also proposed folding Risk Scores into TI > Risk & Assessment on
        // the premise that both surface computeEntityRisk. They do not: this
        // leaf aggregates stored scan risk levels, while TI > Risk & Assessment
        // scores intelligence entities 0-100. Merging them would equate two
        // different scales, so the leaf stays until P1-10 unifies risk banding.
        renderShell('analytics');
        await findFirst('Executive Dashboard');
        expect(screen.getAllByText('Scan Risk')).toHaveLength(1);
    });
});

// P1-12 — nav labels only. Every `target` is unchanged, so no hash, deep link
// or route moved; these tests pin the names and, for the risk pair, the reason
// the rename exists at all.
describe('P1-12 — labels say what the module is', () => {
    it.each([
        ['Web Check', 'Web Intelligence'],
        ['Activity Feed', 'Findings Feed'],
        ['Scan Risk', 'Risk Scores'],
    ])('shows %s, not the old %s', async (current, old) => {
        renderShell('dashboard');
        await findFirst('Executive Dashboard');
        expect(screen.getAllByText(current).length).toBeGreaterThan(0);
        expect(screen.queryByText(old)).toBeNull();
    });

    it('names the two risk modules apart, since they measure different things', async () => {
        // This is the whole point of the pair. Dashboard aggregates stored
        // `osint_activity.risk_level` across scans; TI scores individual
        // entities via computeEntityRisk. Both used to be called just "Risk",
        // so the analyst could not tell which to open. C6 proposed merging
        // them — they are not mergeable (no shared key, stored vs computed),
        // so naming them apart is the fix instead.
        // Only the active section's children render, so each name is checked
        // from the view that expands its own section.
        renderShell('ti-risk');
        await findFirst('Intelligence Overview');
        expect(screen.getAllByText('Entity Risk & Assessment').length).toBeGreaterThan(0);
        expect(screen.queryByText('Risk & Assessment')).toBeNull();
        cleanup();

        renderShell('risk-scores');
        await findFirst('Executive Dashboard');
        expect(screen.getAllByText('Scan Risk').length).toBeGreaterThan(0);
        expect(screen.queryByText('Risk Scores')).toBeNull();
    });

    it('renames the OSINT search group without reusing MITRE vocabulary', async () => {
        // §40 proposed "Techniques" here, but the MITRE ATT&CK module already
        // labels its own content "Techniques" — that would create the very
        // collision this item exists to remove. §41's "Search & Dorking" says
        // what the group actually contains.
        renderShell('osint-dorking');
        await findFirst('Google Dorking');
        expect(screen.getAllByText('Search & Dorking').length).toBeGreaterThan(0);
        expect(screen.queryByText('Search Intelligence')).toBeNull();
    });

    it('changes no routes — every renamed leaf still navigates where it did', async () => {
        const { onNavigate } = renderShell('dashboard');
        await findFirst('Executive Dashboard');
        fireEvent.click(first('Web Check'));
        expect(onNavigate).toHaveBeenCalledWith('input');
        fireEvent.click(first('Activity Feed'));
        expect(onNavigate).toHaveBeenCalledWith('findings-feed');
        fireEvent.click(first('Scan Risk'));
        expect(onNavigate).toHaveBeenCalledWith('risk-scores');
    });
});

// P1-11 had two halves that turned out to be different problems.
describe('P1-11 — malware co-located, Live Feeds retired', () => {
    it('puts Malware Analysis beside Malware Intelligence', async () => {
        // A co-location, not a merge: Malware Intelligence reads the `malware`
        // families table, Malware Analysis reads `malware_samples` + clusters +
        // detection rules. Different modules, one job.
        renderShell('ti-overview');
        const labels = await siblingLabels('Intelligence Overview');
        expect(labels.indexOf('Malware Analysis')).toBe(labels.indexOf('Malware Intelligence') + 1);
    });

    it('no longer offers Malware Analysis under Intelligence', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        expect(screen.getAllByText('Malware Analysis')).toHaveLength(1);
    });

    it('still routes Malware Analysis to its own unchanged view', async () => {
        const { onNavigate } = renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        fireEvent.click(first('Malware Analysis'));
        expect(onNavigate).toHaveBeenCalledWith('malware-analysis');
    });

    it('drops the Live Feeds leaf, which duplicated Threat Feeds', async () => {
        // Both listed the same seven hardcoded providers from the same
        // getRecentThreats() ring buffer; Threat Feeds adds feed_runs stats and
        // a detail view, and Live Feeds' only distinct fields were errors
        // hardcoded to 0 and one count shown twice.
        renderShell('mon-overview');
        await findFirst('Monitoring Overview');
        expect(screen.queryByText('Live Feeds')).toBeNull();
    });

    it('keeps Threat Feeds as the surviving feed view', async () => {
        renderShell('ti-overview');
        await findFirst('Intelligence Overview');
        expect(screen.getAllByText('Threat Feeds')).toHaveLength(1);
    });
});

// P2-11 — isTargetActive was a 63-case switch whose `default: return false`
// made a forgotten case fail SILENTLY: the leaf never highlighted and its
// section never auto-expanded. 61 of the 63 arms were pure identity, so the
// switch is gone; a target with no special handling is now correct by default.
describe('P2-11 — nav active state needs no per-target wiring', () => {
    const isActive = (label: string) =>
        (first(label).closest('button')?.className || '').includes('active');

    // These three had no case and so never highlighted until P1-2 found them.
    // With the switch deleted the whole class is unreachable — this asserts the
    // outcome rather than the mechanism, so it still holds if the mechanism
    // changes again.
    it.each([
        ['threat-briefs', 'Threat Briefs'],
        ['malware-analysis', 'Malware Analysis'],
        ['osint-darkweb-intel', 'Dark Web Intelligence'],
        ['ti-actors', 'Threat Actors'],
        ['analytics', 'Analytics'],
    ])('%s highlights its own leaf', async (view, label) => {
        renderShell(view as ShellView);
        await findFirst(label);
        expect(isActive(label)).toBe(true);
    });

    it('keeps Web Check lit while its scan results are showing', async () => {
        // One page shown as two views — one of only two non-identity rules left.
        renderShell('results');
        await findFirst('Web Check');
        expect(isActive('Web Check')).toBe(true);
    });

    it('keeps Users lit on the Admin landing view', async () => {
        renderShell('admin', true);
        await findFirst('Users');
        expect(isActive('Users')).toBe(true);
    });

    it('does not light an unrelated leaf', async () => {
        renderShell('analytics');
        await findFirst('Analytics');
        expect(isActive('Executive Dashboard')).toBe(false);
    });
});

describe('CASE 19/§14/§33 — Phishing route preservation', () => {
    it('the Phishing Detection leaf still points at the ORIGINAL osint-phishing route — no new/duplicate route created', () => {
        const { onNavigate } = renderShell('ti-overview');
        fireEvent.click(screen.getByText('Phishing Detection'));
        expect(onNavigate).toHaveBeenCalledWith('osint-phishing');
        expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('a direct load on the (unchanged) osint-phishing route auto-expands Threat Intelligence, not OSINT', () => {
        renderShell('osint-phishing');
        // Threat Intelligence now owns this leaf, so it — not OSINT — auto-expands with no click.
        expect(screen.getByText('Phishing Detection')).toBeInTheDocument();
    });

    it('the Phishing Detection leaf receives the active state when osint-phishing is the active view', () => {
        renderShell('osint-phishing');
        const leaf = screen.getByText('Phishing Detection');
        expect(leaf.closest('button')?.className || '').toMatch(/active/);
    });

    it('the Threat Intelligence PARENT section is also marked active for the relocated Phishing leaf', () => {
        renderShell('osint-phishing');
        const parent = first('Threat Intelligence');
        expect(parent.closest('button')?.className || '').toMatch(/active/);
    });
});

describe('§31/§32/CASE 20 — permissions unchanged by the navigation reorganization', () => {
    it('an analyst (non-admin) never sees the Administration section', () => {
        renderShell('ti-overview', false);
        expect(screen.queryByText('Administration')).not.toBeInTheDocument();
    });

    it('an admin sees the Administration section, unaffected by this cleanup', () => {
        renderShell('ti-overview', true);
        expect(screen.getAllByText('Administration').length).toBeGreaterThan(0);
    });

    it('both admin and analyst see the identical, deduplicated Threat Intelligence menu', () => {
        renderShell('ti-overview', false);
        const analystCount = screen.getAllByText('Malware Intelligence').length;
        cleanup();
        renderShell('ti-overview', true);
        const adminCount = screen.getAllByText('Malware Intelligence').length;
        expect(analystCount).toBe(1);
        expect(adminCount).toBe(1);
    });
});

describe('Regression — sibling OSINT groups untouched by removing the duplicate Threat Intelligence subgroup', () => {
    it('Identity Intelligence still renders its own modules', async () => {
        renderShell('osint-dashboard');
        await findFirst('Investigation Dashboard');
        fireEvent.click(first('Identity Intelligence'));
        expect(await findFirst('Email Intelligence')).toBeInTheDocument();
    });

    it('Exposure Intelligence still renders Telegram Intelligence (unrelated prior fix stays intact)', () => {
        renderShell('osint-telegram-intel');
        expect(screen.getByText('Telegram Intelligence')).toBeInTheDocument();
    });
});
