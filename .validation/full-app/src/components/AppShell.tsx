import React, { useEffect, useMemo, useState } from 'react';
import {
    Home, LayoutDashboard, Globe, Radar, Target, Activity,
    FolderSearch, FileText, Bot, ShieldCheck, ChevronDown, ChevronsLeft, ChevronsRight, Settings,
    UserRound, Building2, Server, KeyRound, Images, Search
} from 'lucide-react';
import './AppShell.css';
import Logo from '../picture/Logo.png';
import HistoryNavButton from './HistoryNavButton';
import SmoothScroll from './SmoothScroll';
import PreferencesModal from './PreferencesModal';
import { logout as logoutApi } from '../services/api';

export type ShellView =
    | 'dashboard' | 'input' | 'results' | 'history'
    | 'admin' | 'users' | 'sessions' | 'threatmap' | 'audit-logs' | 'api-keys' | 'settings' | 'roles'
    | 'system-performance'  // PERFORMANCE_MONITOR_PHASE1.md §ARCHITECTURE
    | 'clients'  // SHADOWSERVER_INTEGRATION_PLAN.md Phase 1
    | 'findings-feed' | 'risk-scores'   // DASHBOARD_PHASE1.md §7a
    | 'analytics'  // DASHBOARD_PHASE2.md §8a
    | 'ti-overview' | 'ti-iocs' | 'ti-campaigns' | 'ti-feeds' | 'ti-actors' | 'ti-malware'
    | 'ti-vulnerabilities' | 'ti-correlation' | 'ti-hunting' | 'ti-risk' | 'ti-workspace' | 'ti-history'
    // MULTI_SERVICE_CTI_ENTITLEMENT_ARCHITECTURE_PLAN.md Phase 1 — the
    // Shadowserver INTELLIGENCE experience, relocated here from
    // Administration -> Clients (plan §4/§8/§11). A standalone page (like
    // 'mitre-mapper'/'malware-analysis' below), not an internal
    // ThreatIntelligencePage section — see ShadowserverIntelPage.tsx.
    | 'shadowserver-intel'
    | 'mon-overview' | 'mon-cve-monitor' | 'mon-brand-monitor'
    | 'mon-alert-center' | 'mon-monitoring-history'
    | 'osint-dashboard' | 'osint-target-mgmt' | 'osint-domain-intel' | 'osint-brand-intel' | 'osint-ip-intel' | 'osint-email'
    | 'osint-social' | 'osint-phone' | 'osint-name' | 'osint-phishing' | 'osint-leak' | 'osint-dorking' | 'osint-company-intel' | 'osint-image-intel' | 'osint-document-intel'
    | 'osint-social-media-intel' | 'osint-telegram-intel' | 'osint-darkweb-intel' // DARK_WEB_PHASE1.md
    // CREDENTIAL_LEAK_PHASE1.md §67/§68 — the domain-first Credential Leak
    // Intelligence workspace. Phases 1-3 added it to OsintPage's own module
    // list but NEVER here, so the sidebar's "Credential Leak" leaf still
    // opened the legacy email-only lookup and the whole feature was
    // unreachable — the same "inert nav leaf" bug Malware/Notes/Dark Web
    // Phase 1 each hit. Fixed the same way: type + target + App.tsx mapping.
    | 'osint-credential-leak-intel'
    | 'report-generator' // REPORT_GENERATOR_PHASE1.md
    | 'threat-briefs' // THREAT_BRIEF_PHASE1.md
    | 'knowledge-base' // KNOWLEDGE_BASE_PHASE1.md
    | 'malware-analysis' // MALWARE_ANALYSIS_PHASE1.md
    | 'ask-ai' // ASK_AI_PHASE1.md
    | 'threat-summary' // THREAT_SUMMARY_PHASE1.md
    | 'ioc-analyzer' // IOC_PHASE1.md
    | 'mitre-mapper' // MITRE_MAPPER_PHASE1.md
    | 'cases' // INVESTIGATIONS_PHASE1.md
    | 'timeline' // TIMELINE_PHASE1.md
    | 'evidence' // EVIDENCE_PHASE1.md
    | 'notes'; // NOTES_PHASE1.md

export type RealTarget = 'dashboard' | 'input' | 'history' | 'users' | 'threatmap' | 'audit-logs' | 'api-keys' | 'settings' | 'roles' | 'sessions'
    | 'system-performance'  // PERFORMANCE_MONITOR_PHASE1.md
    | 'clients'  // SHADOWSERVER_INTEGRATION_PLAN.md Phase 1
    | 'findings-feed' | 'risk-scores'
    | 'analytics'
    | 'ti-overview' | 'ti-iocs' | 'ti-campaigns' | 'ti-feeds' | 'ti-actors' | 'ti-malware'
    | 'ti-vulnerabilities' | 'ti-correlation' | 'ti-hunting' | 'ti-risk' | 'ti-workspace' | 'ti-history'
    // MULTI_SERVICE_CTI_ENTITLEMENT_ARCHITECTURE_PLAN.md Phase 1 — the
    // Shadowserver INTELLIGENCE experience, relocated here from
    // Administration -> Clients (plan §4/§8/§11). A standalone page (like
    // 'mitre-mapper'/'malware-analysis' below), not an internal
    // ThreatIntelligencePage section — see ShadowserverIntelPage.tsx.
    | 'shadowserver-intel'
    | 'mon-overview' | 'mon-cve-monitor' | 'mon-brand-monitor'
    | 'mon-alert-center' | 'mon-monitoring-history'
    | 'osint-dashboard' | 'osint-target-mgmt' | 'osint-domain-intel' | 'osint-brand-intel' | 'osint-ip-intel' | 'osint-email'
    | 'osint-social' | 'osint-phone' | 'osint-name' | 'osint-phishing' | 'osint-leak' | 'osint-dorking' | 'osint-company-intel' | 'osint-image-intel' | 'osint-document-intel'
    | 'osint-social-media-intel' | 'osint-telegram-intel' | 'osint-darkweb-intel' // DARK_WEB_PHASE1.md
    // CREDENTIAL_LEAK_PHASE1.md §67/§68 — the domain-first Credential Leak
    // Intelligence workspace. Phases 1-3 added it to OsintPage's own module
    // list but NEVER here, so the sidebar's "Credential Leak" leaf still
    // opened the legacy email-only lookup and the whole feature was
    // unreachable — the same "inert nav leaf" bug Malware/Notes/Dark Web
    // Phase 1 each hit. Fixed the same way: type + target + App.tsx mapping.
    | 'osint-credential-leak-intel'
    | 'report-generator' // REPORT_GENERATOR_PHASE1.md
    | 'threat-briefs' // THREAT_BRIEF_PHASE1.md
    | 'knowledge-base' // KNOWLEDGE_BASE_PHASE1.md
    | 'malware-analysis' // MALWARE_ANALYSIS_PHASE1.md
    | 'ask-ai' // ASK_AI_PHASE1.md
    | 'threat-summary' // THREAT_SUMMARY_PHASE1.md
    | 'ioc-analyzer' // IOC_PHASE1.md
    | 'mitre-mapper' // MITRE_MAPPER_PHASE1.md
    | 'cases' // INVESTIGATIONS_PHASE1.md
    | 'timeline' // TIMELINE_PHASE1.md
    | 'evidence' // EVIDENCE_PHASE1.md
    | 'notes'; // NOTES_PHASE1.md

interface NavLeaf {
    id: string;
    label: string;
    // Required. Every leaf now resolves to a real view; a leaf with no target
    // used to render a "planned for a future update" pane, and five separate
    // features (Malware, Notes, Document, Dark Web, Credential Leak) each
    // shipped permanently inert because this was easy to forget. Making it
    // required moves that class of bug to compile time.
    target: RealTarget;
}

interface NavGroup {
    id: string;
    label: string;
    icon: React.ReactNode;
    isGroup: true;
    children: NavLeaf[];
}

type NavChild = NavLeaf | NavGroup;

function isGroupChild(child: NavChild): child is NavGroup {
    return (child as NavGroup).isGroup === true;
}

interface NavSection {
    id: string;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
    target?: RealTarget;
    children?: NavChild[];
}

const NAV_TREE: NavSection[] = [
    { id: 'home', label: 'Home', icon: <Home size={18} />, target: 'dashboard' },
    {
        id: 'dashboard-section', label: 'Dashboard', icon: <LayoutDashboard size={18} />,
        children: [
            { id: 'exec-dashboard',    label: 'Executive Dashboard', target: 'dashboard'     },
            // Moved out of the "AI" section. 11 of its 15 routes are plain
            // read-time aggregation and threatSummaryStorage.js owns no tables
            // at all — it is the operational overview, which is what this
            // section is for. Only 4 routes touch AI.
            { id: 'threat-summary',    label: 'Threat Summary',      target: 'threat-summary' },
            // P1-12 — "Findings Feed" collided with `case_findings` and
            // `brand_persistent_findings`, which are different things entirely.
            { id: 'threat-dashboard',  label: 'Activity Feed',       target: 'findings-feed' },
            { id: 'global-threat-map', label: 'Global Threat Map',   target: 'threatmap'     },
            // P1-3 — Analytics, Trends and Statistics were three leaves over one
            // question ("how are we doing?"). They are not three views of the
            // same numbers — counts, time series and derived rates respectively
            // — so nothing was deduplicated; they became tabs of one workspace
            // so the analyst compares them in place instead of by menu-hopping.
            { id: 'analytics',         label: 'Analytics',         target: 'analytics'   },  // DASHBOARD_PHASE2.md §8b
            // P1-12 — this and TI > "Risk & Assessment" were both just called
            // "Risk", so neither name said which to open. This one aggregates
            // stored `osint_activity.risk_level` across scans; the TI one scores
            // individual intelligence entities. Naming them apart is the honest
            // fix — they measure different things and are not being merged (C6).
            { id: 'risk-scores',       label: 'Scan Risk',           target: 'risk-scores'  }
        ]
    },
    // P1-12 — it is a single-target web reconnaissance scan, not an
    // intelligence corpus; the name promised the latter.
    { id: 'web-intel', label: 'Web Check', icon: <Globe size={18} />, target: 'input' },

    {
        id: 'osint-section', label: 'OSINT', icon: <Radar size={18} />,
        children: [
            { id: 'osint-dashboard',    label: 'Investigation Dashboard',    target: 'osint-dashboard' },
            { id: 'osint-target-mgmt',  label: 'Target Management',          target: 'osint-target-mgmt' },
            {
                id: 'osint-group-identity', label: 'Identity Intelligence', icon: <UserRound size={14} />, isGroup: true,
                children: [
                    { id: 'osint-email',        label: 'Email Intelligence',         target: 'osint-email' },
                    { id: 'osint-social',       label: 'Username Intelligence',      target: 'osint-social' },
                    { id: 'osint-phone',        label: 'Phone Intelligence',         target: 'osint-phone' },
                    { id: 'osint-name',         label: 'Name Checker',               target: 'osint-name' },
                    { id: 'osint-social-media-intel', label: 'Social Media Intelligence', target: 'osint-social-media-intel' }
                ]
            },
            {
                id: 'osint-group-org', label: 'Organization Intelligence', icon: <Building2 size={14} />, isGroup: true,
                children: [
                    { id: 'osint-company-intel', label: 'Company Intelligence', target: 'osint-company-intel' },
                    { id: 'osint-brand-intel',   label: 'Brand Intelligence',   target: 'osint-brand-intel' }
                ]
            },
            {
                id: 'osint-group-infra', label: 'Infrastructure Intelligence', icon: <Server size={14} />, isGroup: true,
                children: [
                    { id: 'osint-domain-intel', label: 'Domain Intelligence', target: 'osint-domain-intel' },
                    { id: 'osint-ip-intel',     label: 'IP Intelligence',     target: 'osint-ip-intel' }
                ]
            },
            {
                id: 'osint-group-exposure', label: 'Exposure Intelligence', icon: <KeyRound size={14} />, isGroup: true,
                children: [
                    // TELEGRAM_INTELLIGENCE_PHASE4.md §1/§2 — Telegram Intelligence
                    // relocated here from Identity Intelligence > Social Media
                    // Intelligence. Reuses the existing expandable nav (isGroup),
                    // active-state and chevron behavior — no new nav architecture.
                    { id: 'osint-telegram-intel', label: 'Telegram Intelligence', target: 'osint-telegram-intel' },
                    // CREDENTIAL_LEAK_PHASE1.md §1/§67/§68 — the domain-scoped
                    // company Watchlist workflow is now the PRIMARY Credential
                    // Leak entry point; the legacy email-only lookup stays
                    // reachable directly below it as a secondary analyst tool
                    // (§68 "manual email lookup may remain as a secondary
                    // function"), rather than being the only thing this pillar
                    // could open.
                    { id: 'osint-credential-leak-intel', label: 'Credential Leak', target: 'osint-credential-leak-intel' },
                    { id: 'osint-leak',          label: 'Advanced Email Lookup', target: 'osint-leak' },
                    // DARK_WEB_PHASE1.md — was a permanently inert leaf with no
                    // `target` at all (the same bug Malware/Notes Phase 1 had
                    // before their own fix); now wired the same way every
                    // sibling under this pillar already is.
                    { id: 'osint-darkweb-intel', label: 'Dark Web Intelligence', target: 'osint-darkweb-intel' }
                ]
            },
            {
                id: 'osint-group-media', label: 'Media Intelligence', icon: <Images size={14} />, isGroup: true,
                children: [
                    { id: 'osint-document-intel', label: 'Document Intelligence', target: 'osint-document-intel' },
                    { id: 'osint-image-intel',    label: 'Image Intelligence', target: 'osint-image-intel' }
                ]
            },
            {
                // P1-12 — "Search Intelligence" implied a search system; the group holds
                // one dorking tool. The audit's §40 line proposed "Techniques", but
                // the MITRE ATT&CK module already labels its own content
                // "Techniques"/"Top Techniques", so that would create exactly the
                // collision this item exists to remove. §41 proposed
                // "Search & Dorking", which is what the group actually contains.
                id: 'osint-group-search', label: 'Search & Dorking', icon: <Search size={14} />, isGroup: true,
                children: [
                    { id: 'osint-dorking', label: 'Google Dorking', target: 'osint-dorking' }
                ]
            }
        ]
    },

    {
        id: 'threat-intel', label: 'Threat Intelligence', icon: <Target size={18} />,
        children: [
            { id: 'ti-overview',        label: 'Intelligence Overview',       target: 'ti-overview' },
            { id: 'ti-iocs',            label: 'Indicators (IOC)',            target: 'ti-iocs' },
            // Moved out of "AI" and placed next to the indicators it analyses.
            // 18 of its 21 routes are deterministic enrichment; the AI summary
            // is one optional step on top. §37 has it eventually becoming an
            // "Analyze" tab of Indicators — this is the move, not that merge.
            { id: 'ioc-analyzer',       label: 'IOC Analyzer',                target: 'ioc-analyzer' },
            { id: 'ti-campaigns',       label: 'Campaigns',                   target: 'ti-campaigns' },
            { id: 'ti-feeds',           label: 'Threat Feeds',                target: 'ti-feeds' },
            // P1-8 — was two leaves over one catalogue. The TI section offered
            // overview/list/detail from `/api/intelligence/attack/*`; the Mapper
            // already consumed those same endpoints (it never duplicated them)
            // and adds 34 deterministic routes on top, so the section was a
            // strict subset and folded into Technique Explorer. Its four
            // section-only features moved with it — tactic bars, recent
            // mappings, the IOC count and the Knowledge Base panel.
            { id: 'ti-attack',          label: 'MITRE ATT&CK',                target: 'mitre-mapper' },
            // P1-7 — was two leaves over the one `threat_actors` table, split
            // only by the is_apt_group boolean. APT is a subtype, so it is a
            // Classification filter inside this module, not a second module.
            { id: 'ti-actors',          label: 'Threat Actors',               target: 'ti-actors' },
            { id: 'ti-malware',         label: 'Malware Intelligence',        target: 'ti-malware' },
            // P1-11 — moved here from Intelligence; see the note there.
            { id: 'malware-analysis',   label: 'Malware Analysis',            target: 'malware-analysis' }, // MALWARE_ANALYSIS_PHASE1.md
            { id: 'ti-vulnerabilities', label: 'Vulnerability Intelligence',  target: 'ti-vulnerabilities' },
            // FIX_NAVIGATION_&_INTELLIGENCE_ARCHITECTURE.md §12/§15 — relocated
            // here from OSINT's own duplicate "Threat Intelligence" subgroup and
            // relabeled "Phishing Intelligence" (was "Phishing Detection"). The
            // `target` is intentionally still the ORIGINAL 'osint-phishing' view
            // — the actual phishing implementation (OsintPage's scan-based
            // phishing-detection flow) is untouched, so no existing route,
            // hash link (#/osint-phishing) or deep link breaks (§14/§33).
            // P1-12 — reverts the label half of that rename. The relocation above
            // was right, but "Intelligence" oversold it: the `target` here is
            // still the single-URL scan flow, which is a detection, not a corpus.
            { id: 'ti-phishing',        label: 'Phishing Detection',          target: 'osint-phishing' },
            { id: 'ti-correlation',     label: 'Correlation',                 target: 'ti-correlation' },
            // "Intelligence Reports" removed: it was a SECOND UI over the SAME
            // `intelligence_reports` rows Threat Briefs already owns — same
            // /api/intelligence/reports routes, same api.ts functions
            // (getReports/createReport/getReport/updateReportFields/...), so a
            // record created here appeared there under a different name.
            // Threat Briefs is the single surviving UI; #/ti-reports redirects
            // to it in App.tsx so existing links and bookmarks still resolve.
            { id: 'ti-hunting',         label: 'Threat Hunting',              target: 'ti-hunting' },
            // P1-12 — see Dashboard > Scan Risk: this one scores individual
            // intelligence entities via computeEntityRisk and holds analyst
            // assessments. "Entity" is what distinguishes it.
            { id: 'ti-risk',            label: 'Entity Risk & Assessment',    target: 'ti-risk' },
            { id: 'ti-workspace',       label: 'Intelligence Workspace',      target: 'ti-workspace' },
            { id: 'ti-history',         label: 'Intelligence History',        target: 'ti-history' },
            // MULTI_SERVICE_CTI_ENTITLEMENT_ARCHITECTURE_PLAN.md Phase 1 —
            // relocated from Administration -> Clients (plan §4's confirmed
            // location: intelligence lives here, configuration/entitlement
            // stays under Clients). See ShadowserverIntelPage.tsx.
            { id: 'ti-shadowserver',    label: 'Shadowserver',                target: 'shadowserver-intel' }
        ]
    },
    // "Observables" removed. It came from NAVIGATION_TREE_REDESIGN.md's
    // OpenCTI-style scaffolding ("most of this tree has no real backend yet")
    // and never gained one: nine leaves with no `target`, no page, no API
    // route and no table. Every type it listed is a value of `iocs.type`, so
    // the data lives in — and is reachable through — Threat Intelligence >
    // Indicators (IOC), which timelineStorage.js already labels 'Observables'.
    // If the per-type browse is wanted, it belongs there as a type filter, not
    // as a parallel section.

    {
        id: 'monitoring', label: 'Monitoring', icon: <Activity size={18} />,
        children: [
            { id: 'mon-overview',             label: 'Monitoring Overview',           target: 'mon-overview' },
            // P1-11 — "Live Feeds" removed rather than co-located. The audit
            // framed it as "source configuration vs live event ticker", but
            // /api/monitoring/live-feeds and /api/intelligence/feeds list the
            // SAME seven hardcoded providers from the SAME getRecentThreats()
            // ring buffer and the SAME env keys. Threat Feeds is the superset:
            // it adds feed_runs statistics and a per-feed detail view with run
            // history. Live Feeds' only distinct fields were `errors`, hardcoded
            // to 0, and `newItems`/`itemsProcessed`, which were the same number
            // shown twice. Co-locating two cards for one thing would have been
            // worse than either merging or leaving them apart.
            // "Monitors" (one list over every monitors.type, with a type
            // filter — it used to replace six leaves rendering the same
            // component with a different prop) was itself later merged into
            // Monitoring Overview above: the two pages showed largely the
            // same ground — active/failed monitor counts, one row per
            // monitor — a click apart. The list now sits at the bottom of
            // Monitoring Overview (OverviewSection.tsx) instead of behind its
            // own leaf; #/mon-monitors and the legacy per-type hashes that
            // used to redirect into it now redirect straight to
            // #/mon-overview (App.tsx's LEGACY_VIEW_REDIRECTS). Brand keeps
            // its own leaf below: unlike the consolidated types, it is a
            // genuinely different view, not the same list re-typed.
            { id: 'mon-cve-monitor',           label: 'CVE Monitor',                   target: 'mon-cve-monitor' },
            { id: 'mon-brand-monitor',         label: 'Brand Monitor',                 target: 'mon-brand-monitor' },
            { id: 'mon-alert-center',          label: 'Alert Center',                  target: 'mon-alert-center' },
            { id: 'mon-monitoring-history',    label: 'Monitoring History',            target: 'mon-monitoring-history' }
        ]
    },
    {
        id: 'investigations', label: 'Investigations', icon: <FolderSearch size={18} />,
        children: [
            { id: 'cases', label: 'Cases', target: 'cases' }, // INVESTIGATIONS_PHASE1.md
            { id: 'timeline', label: 'Timeline', target: 'timeline' }, // TIMELINE_PHASE1.md
            { id: 'evidence', label: 'Evidence', target: 'evidence' }, // EVIDENCE_PHASE1.md
            { id: 'notes', label: 'Notes', target: 'notes' } // NOTES_PHASE1.md
        ]
    },
    {
        id: 'intelligence', label: 'Intelligence', icon: <FileText size={18} />,
        children: [
            // Renamed from "Reports": this target has always been the scan /
            // OSINT History page (`scans` + `osint_activity`), not a report
            // module. The label promised one of the three real report systems
            // (Threat Briefs, Report Generator, Knowledge Base) and delivered
            // an audit trail.
            { id: 'reports', label: 'Scan & OSINT History', target: 'history' },
            { id: 'threat-briefs', label: 'Threat Briefs', target: 'threat-briefs' },
            // Moved out of "AI" to sit beside the other intelligence products.
            // 28 of its 40 routes are deterministic composition (templates,
            // sections, selections, preview, export, review checklist); AI
            // drafts one section at a time. It is an output tool that uses AI,
            // not an AI product. It keeps its own storage — see §41: Threat
            // Brief and Report Generator are deliberately NOT merged.
            { id: 'report-generator', label: 'Report Generator', target: 'report-generator' },
            { id: 'knowledge-base', label: 'Knowledge Base', target: 'knowledge-base' } // KNOWLEDGE_BASE_PHASE1.md
            // P1-11 — Malware Analysis moved to Threat Intelligence, beside
            // Malware Intelligence. They are genuinely different modules (the
            // `malware` families table vs `malware_samples` + clusters +
            // detection rules), so this is a co-location, not a merge — but an
            // analyst holding a sample and an analyst reading a family profile
            // are doing one job, and the two sat in different top-level areas.
        ]
    },
    // The "AI" section is dissolved. It grouped by HOW a feature is built
    // rather than what job it does, which is the opposite of what navigation
    // is for — an analyst looking for the ATT&CK matrix has no reason to look
    // under "AI". Measured by route count, four of its five members were
    // mostly deterministic tools that happen to offer an AI step:
    //   Threat Summary   4 AI / 15 routes  -> Dashboard
    //   IOC Analyzer     3 AI / 21 routes  -> Threat Intelligence (by Indicators)
    //   MITRE Mapper    10 AI / 44 routes  -> Threat Intelligence (by MITRE ATT&CK)
    //   Report Generator 12 AI / 40 routes -> Intelligence (by Threat Briefs)
    // Ask AI is the one genuine AI product (11 of 11 routes), so it stays —
    // as a flat entry rather than a one-child accordion.
    { id: 'ask-ai', label: 'Ask AI', icon: <Bot size={18} />, target: 'ask-ai' }, // ASK_AI_PHASE1.md
    {
        id: 'administration', label: 'Administration', icon: <ShieldCheck size={18} />, adminOnly: true,
        children: [
            { id: 'admin-users', label: 'Users', target: 'users' },
            { id: 'roles', label: 'Roles', target: 'roles' },
            { id: 'clients', label: 'Clients', target: 'clients' }, // SHADOWSERVER_INTEGRATION_PLAN.md Phase 1
            { id: 'admin-sessions', label: 'Sessions', target: 'sessions' },
            { id: 'api-keys', label: 'API Keys', target: 'api-keys' },
            { id: 'audit-logs', label: 'Audit Logs', target: 'audit-logs' },
            { id: 'system-performance', label: 'System Performance', target: 'system-performance' },  // PERFORMANCE_MONITOR_PHASE1.md
            { id: 'settings', label: 'Settings', target: 'settings' }
        ]
    }
];

const RAIL_COLLAPSED_KEY = 'lekirrax_rail_collapsed';

// P2-11 — this was a 63-case switch, one arm per nav target. 61 of the 63 read
// `case 'x': return activeView === 'x';` — pure identity, differing only in the
// string. The other two are the real content and are named below.
//
// The switch was a defect generator, not documentation. Every new leaf needed a
// third edit here on top of the union and NAV_TREE, and the `default: return
// false` meant forgetting it failed SILENTLY: the leaf never highlighted and its
// parent section never auto-expanded on a direct load. Its own comments warned
// about this repeatedly, and P1-2 still found three leaves missing —
// 'threat-briefs', 'malware-analysis' and 'osint-darkweb-intel' — one of them
// added by an earlier fix in this same audit.
//
// Deleting it removes that bug class outright: a target with no entry now
// behaves correctly by default instead of being inert, so nav-leaf wiring drops
// from three edits to two, and the remaining two are compiler-checked.

// The only targets whose leaf stays active on a view OTHER than its own.
// Both are one page presented as two views, not a nav concern.
const ALSO_ACTIVE_ON: Partial<Record<RealTarget, ShellView[]>> = {
    input: ['results'],  // Web Check keeps its leaf lit while showing scan results
    users: ['admin'],    // the Admin landing page is the Users view
};

// `target` is optional because a top-level nav entry may be a group header
// rather than a leaf; a group is never itself active.
function isTargetActive(target: RealTarget | undefined, activeView: ShellView): boolean {
    if (!target) return false;
    return activeView === (target as string) || (ALSO_ACTIVE_ON[target]?.includes(activeView) ?? false);
}

interface AppShellProps {
    activeView: ShellView;
    onNavigate: (view: RealTarget) => void;
    isAdmin: boolean;
    user?: any;
    onLogout: () => void;
    children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ activeView, onNavigate, isAdmin, user, onLogout, children }) => {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [preferencesOpen, setPreferencesOpen] = useState(false);
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [railCollapsed, setRailCollapsed] = useState<boolean>(() => {
        try {
            return localStorage.getItem(RAIL_COLLAPSED_KEY) === '1';
        } catch {
            return false;
        }
    });

    useEffect(() => {
        try {
            localStorage.setItem(RAIL_COLLAPSED_KEY, railCollapsed ? '1' : '0');
        } catch {
        }
    }, [railCollapsed]);

    const sections = useMemo(() => NAV_TREE.filter((s) => !s.adminOnly || isAdmin), [isAdmin]);

    const leafMatches = (leaf: NavLeaf) => isTargetActive(leaf.target, activeView);
    const sectionOwnsActive = (section: NavSection) =>
        !!section.children && section.children.some((c) => (isGroupChild(c) ? c.children.some(leafMatches) : leafMatches(c)));

    const activeOwnerSectionId = useMemo(() => {
        const owner = sections.find(sectionOwnsActive);
        return owner?.id ?? null;
    }, [sections, activeView]);

    const activeOwnerGroupId = useMemo(() => {
        const owner = sections.find((s) => s.id === activeOwnerSectionId);
        const group = owner?.children?.find((c) => isGroupChild(c) && c.children.some(leafMatches));
        return group?.id ?? null;
    }, [sections, activeOwnerSectionId, activeView]);

    useEffect(() => {
        if (activeOwnerSectionId) setExpanded(new Set([activeOwnerSectionId]));
    }, [activeOwnerSectionId]);

    useEffect(() => {
        if (activeOwnerGroupId) setExpandedGroups(new Set([activeOwnerGroupId]));
    }, [activeOwnerGroupId]);

    const toggleSection = (sectionId: string) => {
        setExpanded((prev) => (prev.has(sectionId) ? new Set() : new Set([sectionId])));
    };

    const toggleGroup = (groupId: string) => {
        setExpandedGroups((prev) => (prev.has(groupId) ? new Set() : new Set([groupId])));
    };

    const goReal = (target: RealTarget) => {
        onNavigate(target);
    };

    const clickLeaf = (_sectionId: string, leaf: NavLeaf) => {
        goReal(leaf.target);
    };

    const clickFlatSection = (section: NavSection) => {
        if (section.target) goReal(section.target);
    };

    const clickAccordionHeader = (section: NavSection) => {
        if (railCollapsed) {
            setRailCollapsed(false);
            setExpanded((prev) => new Set(prev).add(section.id));
            return;
        }
        toggleSection(section.id);
    };

    const renderLeaf = (sectionId: string, leaf: NavLeaf) => {
        const active = isTargetActive(leaf.target, activeView);
        return (
            <button
                key={leaf.id}
                type="button"
                role="listitem"
                className={`app-shell-nav-leaf ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => clickLeaf(sectionId, leaf)}
            >
                {leaf.label}
            </button>
        );
    };

    const renderChild = (sectionId: string, child: NavChild) => {
        if (!isGroupChild(child)) return renderLeaf(sectionId, child);

        const groupOpen = expandedGroups.has(child.id);
        const groupActive = child.id === activeOwnerGroupId;
        return (
            <div className="app-shell-nav-subgroup" key={child.id}>
                <button
                    type="button"
                    role="listitem"
                    className={`app-shell-nav-subgroup-header ${groupActive ? 'active' : ''}`}
                    aria-expanded={groupOpen}
                    onClick={() => toggleGroup(child.id)}
                >
                    <span className="app-shell-nav-subgroup-icon">{child.icon}</span>
                    <span className="app-shell-nav-subgroup-label">{child.label}</span>
                    <ChevronDown size={12} className={`app-shell-nav-subgroup-chevron ${groupOpen ? 'app-shell-nav-subgroup-chevron--open' : ''}`} />
                </button>
                {groupOpen && (
                    <div className="app-shell-nav-subchildren" role="list">
                        {child.children.map((leaf) => renderLeaf(sectionId, leaf))}
                    </div>
                )}
            </div>
        );
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await logoutApi();
            localStorage.removeItem('token');
            onLogout();
        } catch (err) {
            console.error('Logout failed:', err);
        } finally {
            setIsLoggingOut(false);
        }
    };

    const displayUsername = user?.username || 'operator';
    const displayRole = user?.role || 'user';
    const userInitials = displayUsername.slice(0, 2).toUpperCase();

    return (
        <div className={`app-shell ${railCollapsed ? 'app-shell--collapsed' : ''}`}>
            <nav className="app-shell-rail" aria-label="Primary navigation">
                <div className="app-shell-rail-scroll" data-lenis-prevent>
                    {sections.map((section) => {
                        if (!section.children) {
                            const active = isTargetActive(section.target, activeView);
                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    className={`app-shell-nav-row app-shell-nav-row--flat ${active ? 'active' : ''}`}
                                    aria-current={active ? 'page' : undefined}
                                    onClick={() => clickFlatSection(section)}
                                >
                                    <span className="app-shell-nav-icon">{section.icon}</span>
                                    <span className="app-shell-nav-label">{section.label}</span>
                                    <span className="app-shell-rail-tooltip" role="tooltip">{section.label}</span>
                                </button>
                            );
                        }

                        const isOpen = expanded.has(section.id) && !railCollapsed;
                        const sectionActive = section.id === activeOwnerSectionId;

                        return (
                            <div className="app-shell-nav-group" key={section.id}>
                                <button
                                    type="button"
                                    className={`app-shell-nav-row ${sectionActive ? 'active' : ''}`}
                                    aria-expanded={isOpen}
                                    onClick={() => clickAccordionHeader(section)}
                                >
                                    <span className="app-shell-nav-icon">{section.icon}</span>
                                    <span className="app-shell-nav-label">{section.label}</span>
                                    <ChevronDown size={14} className={`app-shell-nav-chevron ${isOpen ? 'app-shell-nav-chevron--open' : ''}`} />
                                    <span className="app-shell-rail-tooltip" role="tooltip">{section.label}</span>
                                </button>
                                {isOpen && (
                                    <div className="app-shell-nav-children" role="list">
                                        {section.children.map((child) => renderChild(section.id, child))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <button
                    type="button"
                    className="app-shell-rail-collapse-btn"
                    onClick={() => setRailCollapsed((v) => !v)}
                    aria-label={railCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                >
                    {railCollapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> <span>Collapse</span></>}
                </button>
            </nav>

            <div className="app-shell-body">
                <header className="app-shell-topbar">
                    <div className="app-shell-topbar-atmosphere" aria-hidden="true" />
                    <div className="app-shell-topbar-brand">
                        <span className="app-shell-topbar-logo">
                            <img src={Logo} alt="LekirraX Logo" />
                        </span>
                        <div className="app-shell-topbar-brand-copy">
                            <span className="app-shell-topbar-kicker">SECURE OPERATIONS <b>//</b> 01</span>
                            <h1 className="app-shell-topbar-title">
                                <span className="app-shell-topbar-wordmark">LekirraX</span>
                                <span className="app-shell-topbar-subtitle"><i aria-hidden="true">|</i> Cyber Intelligence Center</span>
                            </h1>
                        </div>
                    </div>
                    <div className="app-shell-topbar-actions">
                        <div className="app-shell-topbar-live" aria-label="Live threat feed status">
                            <span className="app-shell-topbar-live-signal"><span className="pulse-dot" /></span>
                            <span className="app-shell-topbar-live-copy">
                                <span className="app-shell-topbar-live-label">NETWORK STATUS</span>
                                <span className="app-shell-topbar-live-value">Live threat feed</span>
                            </span>
                        </div>
                        <span className="app-shell-topbar-divider" aria-hidden="true" />
                        <button
                            type="button"
                            className="app-shell-topbar-user"
                            onClick={() => setPreferencesOpen(true)}
                            aria-haspopup="dialog"
                            aria-label="Open your preferences"
                        >
                            <span className="app-shell-topbar-avatar" aria-hidden="true">{userInitials}</span>
                            <span className="app-shell-topbar-user-copy">
                                <span className="app-shell-topbar-role">{displayRole.toUpperCase()}</span>
                                <span className="app-shell-topbar-name">{displayUsername}</span>
                            </span>
                        </button>
                        {isAdmin && (
                            <button type="button" className="app-shell-topbar-admin-btn" onClick={() => goReal('users')}>
                                <Settings size={17} aria-hidden="true" /> ADMIN
                            </button>
                        )}
                        <HistoryNavButton className="app-shell-topbar-history-btn" onNavigate={() => goReal('history')} />
                        <button
                            type="button"
                            className="app-shell-topbar-logout-btn"
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                        >
                            {isLoggingOut ? 'TERMINATING...' : 'LOGOUT'}
                        </button>
                    </div>
                </header>
                <main className="app-shell-content">
                    <SmoothScroll root={false} className="app-shell-scroll-region">
                        {children}
                    </SmoothScroll>
                </main>
            </div>

            {preferencesOpen && <PreferencesModal onClose={() => setPreferencesOpen(false)} />}
        </div>
    );
};

export default AppShell;
