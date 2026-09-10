import { useState, useEffect, useRef, useCallback, lazy, Suspense } from "react";
// Route-level code splitting — each authenticated page becomes its own
// on-demand chunk instead of one ~3.6MB bundle loaded up front (only the
// page the user actually opens, plus whatever they've visited this
// session, is ever fetched). `type`-only exports still need a matching
// static `import type` below since `React.lazy()` only sees the default
// export at runtime — see KnowledgeBasePage's own import for that split.
// AppShell/ErrorBoundary/LoginPage/TerminationAlert/AuthRecoveryPrompt stay
// eager: they're the boot-time chrome/auth-gate, always needed immediately,
// and small enough that splitting them out would only add a round-trip.
const ScanInputPage = lazy(() => import("./pages/ScanInput/ScanInputPage"));
const ScanResultsPage = lazy(() => import("./pages/ScanResults/ScanResultsPage"));
const OsintPage = lazy(() => import("./pages/OsintResults/OsintPage"));
const DashboardPage = lazy(() => import("./pages/Dashboard/DashboardPage"));
const GlobalThreatMapPage = lazy(() => import("./pages/ThreatMap/GlobalThreatMapPage"));
const HistoryPage = lazy(() => import("./pages/History/HistoryPage"));
const UserManagementPage = lazy(() => import("./pages/UserManagement/UserManagementPage"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogs/AuditLogsPage"));
const ApiKeysPage = lazy(() => import("./pages/ApiKeys/ApiKeysPage"));
const SettingsPage = lazy(() => import("./pages/Settings/SettingsPage"));
const RolesPage = lazy(() => import("./pages/Roles/RolesPage"));
const ClientsPage = lazy(() => import("./pages/Clients/ClientsPage"));  // SHADOWSERVER_INTEGRATION_PLAN.md Phase 1
// SHADOWSERVER_INTEGRATION_PLAN.md Phase 4 — the restricted shell a
// client-scoped account renders INSTEAD of AppShell entirely, never
// alongside it. Not lazy via Suspense-wrapped route like the others below
// (it replaces the whole app tree for this user), but still code-split via
// dynamic import so an admin/analyst's bundle never pays for it.
const ClientPortalPage = lazy(() => import("./pages/ClientPortal/ClientPortalPage"));
const PerformanceMonitorPage = lazy(() => import("./pages/AdminDashboard/PerformanceMonitorPage"));  // PERFORMANCE_MONITOR_PHASE1.md
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboard/AdminDashboardPage"));
const SessionManagementPage = lazy(() => import("./pages/SessionManagement/SessionManagementPage"));
const FindingsFeedPage = lazy(() => import("./pages/Dashboard/FindingsFeedPage"));  // DASHBOARD_PHASE1.md §8c
const RiskScoresPage = lazy(() => import("./pages/Dashboard/RiskScoresPage"));    // DASHBOARD_PHASE1.md §8c
// P1-3 — Statistics/Trends/Analytics are now tabs of one Analytics workspace;
// the three page bodies live on unchanged behind it.
const AnalyticsWorkspacePage = lazy(() => import("./pages/Dashboard/AnalyticsWorkspacePage"));  // DASHBOARD_PHASE2.md §9a
const MonitoringPage = lazy(() => import("./pages/Monitoring/MonitoringPage"));   // MONITORING_CODE.md §17
const ThreatIntelligencePage = lazy(() => import("./pages/ThreatIntelligence/ThreatIntelligencePage"));  // THREAT_INTELLIGENCE_MODULE_PHASE1.md
const ThreatBriefsPage = lazy(() => import("./pages/ThreatBriefs/ThreatBriefsPage"));  // THREAT_BRIEF_PHASE1.md
const KnowledgeBasePage = lazy(() => import("./pages/KnowledgeBase/KnowledgeBasePage"));  // KNOWLEDGE_BASE_PHASE1.md / PHASE2.md
import type { KnowledgeBaseFilterContext, KnowledgeCreatePrefill } from "./pages/KnowledgeBase/KnowledgeBasePage";
import type { NotesFilterContext } from "./pages/Notes/NotesPage";
import type { AnalyticsTab } from "./pages/Dashboard/AnalyticsWorkspacePage";  // P1-3
const MalwareAnalysisPage = lazy(() => import("./pages/MalwareAnalysis/MalwareAnalysisPage"));  // MALWARE_ANALYSIS_PHASE1.md
const ShadowserverIntelPage = lazy(() => import("./pages/ThreatIntelligence/ShadowserverIntelPage"));  // MULTI_SERVICE_CTI_ENTITLEMENT_ARCHITECTURE_PLAN.md Phase 1
const AskAIPage = lazy(() => import("./pages/AskAI/AskAIPage"));  // ASK_AI_PHASE1.md
const ThreatSummaryPage = lazy(() => import("./pages/ThreatSummary/ThreatSummaryPage"));  // THREAT_SUMMARY_PHASE1.md
const IocAnalyzerPage = lazy(() => import("./pages/IocAnalyzer/IocAnalyzerPage"));  // IOC_PHASE1.md
const ReportGeneratorPage = lazy(() => import("./pages/ReportGenerator/ReportGeneratorPage"));  // REPORT_GENERATOR_PHASE1.md
const MitreMapperPage = lazy(() => import("./pages/MitreMapper/MitreMapperPage"));  // MITRE_MAPPER_PHASE1.md
const CasesPage = lazy(() => import("./pages/Investigations/CasesPage"));  // INVESTIGATIONS_PHASE1.md
const TimelinePage = lazy(() => import("./pages/Timeline/TimelinePage"));  // TIMELINE_PHASE1.md
const EvidencePage = lazy(() => import("./pages/Evidence/EvidencePage"));  // EVIDENCE_PHASE1.md
const NotesPage = lazy(() => import("./pages/Notes/NotesPage"));  // NOTES_PHASE1.md
import AppShell from "./components/AppShell";
import ErrorBoundary from "./components/ErrorBoundary";
import LoginPage from "./pages/Login/LoginPage";
import TerminationAlert from "./components/TerminationAlert";
import AuthRecoveryPrompt from "./components/AuthRecoveryPrompt";
import { addSearchHistory } from "./services/searchHistory";
import { wsService } from "./services/websocket";
import { AUTH_REQUIRED_EVENT, type AuthRequiredDetail, notifyAuthStatus } from "./services/authEvents";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

type View = 'dashboard' | 'input' | 'results' | 'history' | 'admin' | 'users' | 'sessions' | 'threatmap' | 'audit-logs' | 'api-keys' | 'settings' | 'roles'
    | 'system-performance'
    | 'clients' // SHADOWSERVER_INTEGRATION_PLAN.md Phase 1
    | 'findings-feed' | 'risk-scores'
    | 'analytics'
    | 'ti-overview' | 'ti-iocs' | 'ti-campaigns' | 'ti-feeds' | 'ti-actors' | 'ti-malware'
    | 'ti-vulnerabilities' | 'ti-correlation' | 'ti-hunting' | 'ti-risk' | 'ti-workspace' | 'ti-history'
    | 'shadowserver-intel' // MULTI_SERVICE_CTI_ENTITLEMENT_ARCHITECTURE_PLAN.md Phase 1
    | 'mon-overview' | 'mon-cve-monitor' | 'mon-brand-monitor'
    | 'mon-alert-center' | 'mon-monitoring-history'
    | 'osint-dashboard' | 'osint-target-mgmt' | 'osint-domain-intel' | 'osint-brand-intel' | 'osint-ip-intel' | 'osint-email'
    | 'osint-social' | 'osint-phone' | 'osint-name' | 'osint-phishing' | 'osint-leak' | 'osint-dorking' | 'osint-company-intel' | 'osint-image-intel'
    | 'osint-social-media-intel' | 'osint-telegram-intel' | 'osint-document-intel'
    | 'osint-darkweb-intel' // DARK_WEB_PHASE1.md
    | 'osint-credential-leak-intel' // CREDENTIAL_LEAK_PHASE1-3.md
    | 'threat-briefs' // THREAT_BRIEF_PHASE1.md
    | 'knowledge-base' // KNOWLEDGE_BASE_PHASE1.md
    | 'malware-analysis' // MALWARE_ANALYSIS_PHASE1.md
    | 'ask-ai' // ASK_AI_PHASE1.md
    | 'threat-summary' // THREAT_SUMMARY_PHASE1.md
    | 'ioc-analyzer' // IOC_PHASE1.md
    | 'report-generator' // REPORT_GENERATOR_PHASE1.md
    | 'mitre-mapper' // MITRE_MAPPER_PHASE1.md
    | 'cases' // INVESTIGATIONS_PHASE1.md
    | 'timeline' // TIMELINE_PHASE1.md
    | 'evidence' // EVIDENCE_PHASE1.md
    | 'notes'; // NOTES_PHASE1.md

const TI_VIEW_TO_SECTION: Record<string, string> = {
  'ti-overview': 'overview', 'ti-iocs': 'iocs', 'ti-campaigns': 'campaigns', 'ti-feeds': 'feeds',
  'ti-actors': 'actors', 'ti-malware': 'malware', 'ti-vulnerabilities': 'vulnerabilities',
  'ti-correlation': 'correlation', 'ti-hunting': 'hunting', 'ti-risk': 'risk',
  'ti-workspace': 'workspace', 'ti-history': 'history'
};
const TI_SECTION_TO_VIEW: Record<string, View> = {
  overview: 'ti-overview', iocs: 'ti-iocs', campaigns: 'ti-campaigns', feeds: 'ti-feeds',
  actors: 'ti-actors', malware: 'ti-malware', vulnerabilities: 'ti-vulnerabilities',
  correlation: 'ti-correlation', hunting: 'ti-hunting', risk: 'ti-risk',
  workspace: 'ti-workspace', history: 'ti-history'
};

// Threat Intelligence's "Intelligence Reports" section was removed: it read
// the SAME `intelligence_reports` rows through the SAME api.ts functions as
// Threat Briefs, so the two showed one record under two names. Existing
// bookmarks and in-app links to #/ti-reports resolve to Threat Briefs rather
// than dead-ending.
// 'osint-malware-intel' likewise: OSINT's Malware Intelligence entry mounted
// Threat Intelligence's OWN MalwareSection, so it was a second entry point to
// one component rather than a second implementation. Threat Intelligence owns it.
// The six per-type Monitoring leaves collapsed into one 'mon-monitors' list
// with a type filter; that list itself later merged into Monitoring Overview
// (OverviewSection.tsx now mounts it directly, at the bottom of the page) —
// so every one of these, plus the old 'mon-monitors' hash itself, now
// resolves to 'mon-overview'.
const LEGACY_VIEW_REDIRECTS: Record<string, View> = {
  'ti-reports': 'threat-briefs',
  // P1-7 — APT Group Intelligence and Threat Actors were two UIs over the one
  // `threat_actors` table; the APT list is now a Classification filter inside
  // Threat Actors, so an old #/ti-apt-groups bookmark lands there.
  'ti-apt-groups': 'ti-actors',
  // P1-8 — the TI ATT&CK section was a subset of the Mapper, which is now the
  // one MITRE ATT&CK module; an old #/ti-attack bookmark lands there.
  'ti-attack': 'mitre-mapper',
  // P1-11 — Live Feeds listed the same seven providers from the same ring
  // buffer as Threat Feeds, which is the superset; an old bookmark lands there.
  'mon-live-feeds': 'ti-feeds',
  // P1-3 — Statistics and Trends became tabs of Analytics.
  'statistics': 'analytics',
  'trends': 'analytics',
  'osint-malware-intel': 'ti-malware',
  'mon-monitors': 'mon-overview',
  'mon-ioc-watchlist': 'mon-overview',
  'mon-domain-monitor': 'mon-overview',
  'mon-ip-monitor': 'mon-overview',
  'mon-threat-actor-monitor': 'mon-overview',
  'mon-credential-monitor': 'mon-overview',
  'mon-social-monitor': 'mon-overview',
};

// ...and the Analytics tab each of the two redirected leaves showed, so a
// bookmark lands on its own tab rather than the workspace default — the same
// shape as LEGACY_MONITOR_TYPE_BY_VIEW below.
const LEGACY_ANALYTICS_TAB_BY_VIEW: Record<string, AnalyticsTab> = {
  'statistics': 'statistics',
  'trends': 'trends',
};

// ...and the type each of those old leaves showed, so a redirected bookmark
// lands on that slice rather than the unfiltered list.
const LEGACY_MONITOR_TYPE_BY_VIEW: Record<string, string> = {
  'mon-ioc-watchlist': 'ioc',
  'mon-domain-monitor': 'domain',
  'mon-ip-monitor': 'ip',
  'mon-threat-actor-monitor': 'threat_actor',
  'mon-credential-monitor': 'credential',
  'mon-social-monitor': 'social_username',
};

const MON_VIEW_TO_SECTION: Record<string, string> = {
  'mon-overview': 'overview',
  'mon-cve-monitor': 'cve-monitor', 'mon-brand-monitor': 'brand-monitor',
  'mon-alert-center': 'alert-center', 'mon-monitoring-history': 'monitoring-history'
};
const MON_SECTION_TO_VIEW: Record<string, View> = {
  overview: 'mon-overview',
  'cve-monitor': 'mon-cve-monitor', 'brand-monitor': 'mon-brand-monitor',
  'alert-center': 'mon-alert-center', 'monitoring-history': 'mon-monitoring-history'
};

const OSINT_VIEW_TO_SECTION: Record<string, string> = {
  'osint-dashboard': 'dashboard', 'osint-target-mgmt': 'target-mgmt', 'osint-domain-intel': 'domain-intel', 'osint-brand-intel': 'brand-intel',
  'osint-ip-intel': 'ip-intel', 'osint-email': 'email', 'osint-social': 'social', 'osint-phone': 'phone',
  'osint-name': 'name', 'osint-phishing': 'phishing', 'osint-leak': 'leak', 'osint-dorking': 'dorking',
  'osint-company-intel': 'company-intel', 'osint-image-intel': 'image-intel',
  'osint-social-media-intel': 'social-media-intel', 'osint-telegram-intel': 'telegram-intel',
  // DOCUMENT_INTELLIGENCE_PHASE1.md — same "nav leaf with no `target`" bug,
  // fixed the same way (AppShell.tsx target field + this mapping).
  'osint-document-intel': 'document-intel',
  // DARK_WEB_PHASE1.md — same "nav leaf with no `target`" bug, fixed the
  // same way (AppShell.tsx target field + this mapping).
  'osint-darkweb-intel': 'darkweb-intel',
  // CREDENTIAL_LEAK_PHASE1.md §67 — same bug again: OsintPage already had a
  // 'credential-leak-intel' section, but with no AppShell target and no
  // mapping here it could never be navigated to.
  'osint-credential-leak-intel': 'credential-leak-intel'
};
const OSINT_SECTION_TO_VIEW: Record<string, View> = {
  dashboard: 'osint-dashboard', 'target-mgmt': 'osint-target-mgmt', 'domain-intel': 'osint-domain-intel', 'brand-intel': 'osint-brand-intel',
  'ip-intel': 'osint-ip-intel', email: 'osint-email', social: 'osint-social', phone: 'osint-phone',
  name: 'osint-name', phishing: 'osint-phishing', leak: 'osint-leak', dorking: 'osint-dorking',
  'company-intel': 'osint-company-intel', 'image-intel': 'osint-image-intel',
  'social-media-intel': 'osint-social-media-intel', 'telegram-intel': 'osint-telegram-intel',
  'document-intel': 'osint-document-intel',
  'darkweb-intel': 'osint-darkweb-intel',
  'credential-leak-intel': 'osint-credential-leak-intel'
};

type TerminationEvent = {
    type: 'account_terminated' | 'account_deleted';
    title: string;
    message: string;
    reason?: string;
    timestamp: string;
};

export default function App() {
  const [searchText, setSearchText] = useState("");
  const [pendingOsintNav, setPendingOsintNav] = useState<{ tab: string; target: string } | null>(null);
  // THREAT_BRIEF_PHASE2.md §4 "CREATE BRIEF FROM INTELLIGENCE" — same
  // pending-nav handoff pattern as pendingOsintNav above.
  const [pendingThreatBriefContext, setPendingThreatBriefContext] = useState<{ type: string; id: string } | null>(null);
  // KNOWLEDGE_BASE_PHASE1.md §22 "ENTITY TO KNOWLEDGE LINK" — same pending-nav handoff pattern as pendingThreatBriefContext above.
  const [pendingKnowledgeFilter, setPendingKnowledgeFilter] = useState<KnowledgeBaseFilterContext | null>(null);
  const [pendingNotesFilter, setPendingNotesFilter] = useState<NotesFilterContext | null>(null);
  // NOTES_PHASE3.md §50 "CONVERSATION INTEGRATION" — same lifted-state
  // handoff pattern, seeding Ask AI's existing chat with a Note-derived
  // question. Both are cleared together once consumed — Ask AI's own
  // existing conversation memory (services/ai/askAi/index.js's "last entity
  // this conversation discussed" fallback) carries the context forward for
  // follow-up turns, so nothing is lost, and a later unrelated visit to Ask
  // AI never inherits a stale pageContext.
  const [pendingAskAiQuestion, setPendingAskAiQuestion] = useState<string | null>(null);
  const [askAiPageContext, setAskAiPageContext] = useState<{ type: string; id: string | number; label?: string } | null>(null);
  // MALWARE_INTELLIGENCE_PHASE1.md §23/§24/§64 CASE 4 — "[View Analysis]"
  // deep-links to the existing Malware Analysis page, same handoff pattern.
  const [pendingMalwareSampleId, setPendingMalwareSampleId] = useState<number | null>(null);
  const viewMalwareSample = (sampleId: string) => {
    setPendingMalwareSampleId(Number(sampleId));
    navigate('malware-analysis');
  };
  // KNOWLEDGE_BASE_PHASE2.md §24 "KNOWLEDGE GAP DETECTION" — same handoff pattern, for the [Create Knowledge Entry] action.
  const [pendingKnowledgeCreate, setPendingKnowledgeCreate] = useState<KnowledgeCreatePrefill | null>(null);
  // §26 "KNOWLEDGE CONTEXT PANEL" — opening a SPECIFIC recommended entry from another page's panel.
  const [pendingKnowledgeOpenId, setPendingKnowledgeOpenId] = useState<number | null>(null);
  // Opening ONE specific Threat Brief from another page (Threat Intelligence's
  // unified search bar resolving a `report` hit) — same handoff pattern as
  // pendingKnowledgeOpenId above. Called with no id, it just opens the list.
  const [pendingThreatBriefOpenId, setPendingThreatBriefOpenId] = useState<number | null>(null);
  // P1-8 — a technique to open in the MITRE ATT&CK module after navigating to it.
  const [pendingAttackTechniqueId, setPendingAttackTechniqueId] = useState<string | null>(null);
  // P1-3 — which Analytics tab a redirected #/trends or #/statistics should open.
  const [pendingAnalyticsTab, setPendingAnalyticsTab] = useState<AnalyticsTab | null>(null);
  // Preselected type for the unified Monitors list, set when a legacy
  // per-type Monitoring route redirects here.
  const [pendingMonitorType, setPendingMonitorType] = useState<string | null>(null);
  const openThreatBrief = (id?: string) => {
    setPendingThreatBriefOpenId(id != null && id !== '' ? Number(id) : null);
    navigate('threat-briefs');
  };
  // INVESTIGATIONS_PHASE1.md §60 — Alert Center's [Investigate] hands off a
  // resolved case id to open directly, same pending-nav pattern as above.
  const [pendingCaseOpenId, setPendingCaseOpenId] = useState<number | null>(null);
  // THREAT_SUMMARY_PHASE2.md §10 "ENTITY LEVEL DEEP LINKING" — Threat
  // Summary hands off a real {type, id} to open the EXACT entity inside
  // Threat Intelligence, same pending-nav pattern as above.
  const [pendingTiEntityOpen, setPendingTiEntityOpen] = useState<{ type: string; id: string } | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [displayView, setDisplayView] = useState<View>('dashboard');
  const [transitionStage, setTransitionStage] = useState<'idle' | 'exiting' | 'pre-enter'>('idle');
  const [user, setUser] = useState<any | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [terminationAlert, setTerminationAlert] = useState<TerminationEvent | null>(null);
  const [authRecovery, setAuthRecovery] = useState<AuthRequiredDetail | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const viewRef = useRef(view);
  const transitionStageRef = useRef(transitionStage);
  const historyPreviousViewRef = useRef<View>('dashboard');

  const isAdmin = user?.role === 'admin';
  // SHADOWSERVER_INTEGRATION_PLAN.md Phase 4 — a client-scoped account
  // (plan §5's isClientScopedRole, computed server-side and returned by
  // login/session) never mounts AppShell or the hash-routing tree at all;
  // see the render branch below. This is the actual enforcement of "a
  // client only sees their own company" — without it, a real client
  // account would see the full admin/analyst app, since only Shadowserver's
  // own routes are scoped so far (plan §11's confirmed rollout order).
  const isClientScoped = user?.isClientScoped === true;

  const transitionTo = useCallback((next: View) => {
    if (next === viewRef.current && transitionStageRef.current === 'idle') return;
    setView(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTransitionStage('exiting');

    timeoutRef.current = setTimeout(() => {
      setDisplayView(next);
      setTransitionStage('pre-enter');
      rafRef.current = requestAnimationFrame(() => setTransitionStage('idle'));
    }, 280);
  }, []);

  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3; 
    const retryDelay = 800; 

    let token = '';
    try {
      token = localStorage.getItem('token') || '';
    } catch (e) {
      void e;
      token = '';
    }

    if (!token) {
      if (isMounted) {
        setUser(null);
        localStorage.removeItem('user');
        setCheckingAuth(false);
      }
      return;
    }

    const checkSession = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/session`, {
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (res.ok) {
          const payload = await res.json();
          if (isMounted) {
            setUser(payload.user);
            localStorage.setItem('user', JSON.stringify(payload.user));
            setCheckingAuth(false);
          }
          return;
        }

        if (res.status === 401 || res.status === 403) {
          notifyAuthStatus(res.status);
          if (isMounted) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            setCheckingAuth(false);
          }
          return;
        }

        if (retryCount < maxRetries) {
          retryCount++;
          await new Promise(r => setTimeout(r, retryDelay));
          return checkSession();
        }

        if (isMounted) {
          setCheckingAuth(false);
        }
      } catch (err) {
        if (retryCount < maxRetries) {
          retryCount++;
          await new Promise(r => setTimeout(r, retryDelay));
          return checkSession();
        }
        if (isMounted) {
          setCheckingAuth(false);
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const onAuthRequired = (event: Event) => {
      const detail = (event as CustomEvent<AuthRequiredDetail>).detail;
      setAuthRecovery({
        title: detail?.title || 'Session expired',
        message: detail?.message || 'Your session has expired. Please log in again to continue.'
      });
    };

    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired as EventListener);
    return () => {
      window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired as EventListener);
    };
  }, []);

  useEffect(() => {
    viewRef.current = view;
    transitionStageRef.current = transitionStage;
  }, [view, transitionStage]);

  useEffect(() => {
    if (user) {
      wsService.connect();
    } else {
      wsService.disconnect();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = wsService.onTermination((event) => {
      console.warn('[App] Received termination event:', event);
      setTerminationAlert({
        type: event.type,
        title: event.title,
        message: event.message,
        reason: event.reason,
        timestamp: event.timestamp
      });
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const applyState = (state: any) => {
    // A history entry pushed before Intelligence Reports was removed still
    // carries view: 'ti-reports'; send it to Threat Briefs (the same records)
    // rather than silently ignoring it and stranding the user.
    if (LEGACY_MONITOR_TYPE_BY_VIEW[state?.view]) setPendingMonitorType(LEGACY_MONITOR_TYPE_BY_VIEW[state.view]);
    if (LEGACY_ANALYTICS_TAB_BY_VIEW[state?.view]) setPendingAnalyticsTab(LEGACY_ANALYTICS_TAB_BY_VIEW[state.view]);
    const nextView = (LEGACY_VIEW_REDIRECTS[state?.view] ?? state?.view) as View;
    const nextSearch = typeof state?.searchText === 'string' ? state.searchText : '';
    const validViews: View[] = ['dashboard', 'input', 'results', 'history', 'threatmap', 'findings-feed', 'risk-scores', 'analytics', 'cases', 'timeline', 'evidence', 'notes', 'threat-briefs', ...(Object.values(TI_SECTION_TO_VIEW)), ...(Object.values(MON_SECTION_TO_VIEW)), ...(Object.values(OSINT_SECTION_TO_VIEW))];  // DASHBOARD_PHASE2.md §9c, THREAT_INTELLIGENCE_NAV_INTEGRATION.md, MONITORING_NAV_INTEGRATION.md, OSINT_NAV_INTEGRATION.md, INVESTIGATIONS_PHASE1.md, TIMELINE_PHASE1.md, EVIDENCE_PHASE1.md, NOTES_PHASE1.md
    if (isAdmin) {
      validViews.push('admin', 'users', 'sessions', 'audit-logs', 'api-keys', 'settings', 'roles', 'system-performance', 'clients');
    }
    if (validViews.includes(nextView)) {
      setSearchText(nextSearch);
      transitionTo(nextView);
    }
  };

  const parseHashView = () => {
    const raw = (window.location.hash || '').replace(/^#\/?/, '');
    // #/ti-reports (removed section) -> #/threat-briefs (the same records).
    if (LEGACY_VIEW_REDIRECTS[raw]) {
        if (LEGACY_MONITOR_TYPE_BY_VIEW[raw]) setPendingMonitorType(LEGACY_MONITOR_TYPE_BY_VIEW[raw]);
        if (LEGACY_ANALYTICS_TAB_BY_VIEW[raw]) setPendingAnalyticsTab(LEGACY_ANALYTICS_TAB_BY_VIEW[raw]);
        return LEGACY_VIEW_REDIRECTS[raw];
    }
    const validViews: View[] = ['dashboard', 'input', 'results', 'history', 'threatmap', 'findings-feed', 'risk-scores', 'analytics', 'cases', 'timeline', 'evidence', 'notes', 'threat-briefs', ...(Object.values(TI_SECTION_TO_VIEW)), ...(Object.values(MON_SECTION_TO_VIEW)), ...(Object.values(OSINT_SECTION_TO_VIEW))];  // DASHBOARD_PHASE2.md §9c, THREAT_INTELLIGENCE_NAV_INTEGRATION.md, MONITORING_NAV_INTEGRATION.md, OSINT_NAV_INTEGRATION.md, INVESTIGATIONS_PHASE1.md, TIMELINE_PHASE1.md, EVIDENCE_PHASE1.md, NOTES_PHASE1.md
    if (isAdmin) {
      validViews.push('admin', 'users', 'sessions', 'audit-logs', 'api-keys', 'settings', 'roles', 'system-performance', 'clients');
    }
    if (validViews.includes(raw as View)) return raw as View;
    return null;
  };

    const initialFromState = window.history.state;
    const initialFromHash = parseHashView();
    if (initialFromState?.view) {
      applyState(initialFromState);
    } else if (initialFromHash) {
      window.history.replaceState({ view: initialFromHash, searchText: '' }, '', `#/${initialFromHash}`);
      applyState(window.history.state);
    } else {
      window.history.replaceState({ view: 'dashboard', searchText: '' }, '', '#/dashboard');
    }

    const onPopState = (e: PopStateEvent) => {
      applyState(e.state);
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isAdmin, transitionTo]);

  const navigate = (next: View) => {
    if (next === 'history') {
      historyPreviousViewRef.current = viewRef.current;
    }
    window.history.pushState({ view: next, searchText }, '', `#/${next}`);
    transitionTo(next);
  };

  const investigateInOsint = (target: string, tab?: string) => {
    if (tab) setPendingOsintNav({ tab, target });
    navigate('osint-dashboard');
  };

  // THREAT_SUMMARY_PHASE2.md §10 "ENTITY LEVEL DEEP LINKING" — Do NOT create
  // duplicate entity pages; navigates to Threat Intelligence's EXISTING
  // section for the entity's real type and opens that EXACT entity via the
  // SAME pendingEntity mechanism its own internal search bar already uses.
  const TI_ENTITY_TYPE_TO_VIEW: Record<string, View> = {
    ioc: 'ti-iocs', campaign: 'ti-campaigns', threat_actor: 'ti-actors', malware: 'ti-malware', vulnerability: 'ti-vulnerabilities',
  };
  const openThreatIntelEntity = (entityType: string, entityId: string) => {
    // P1-8 — attack_technique is no longer a Threat Intelligence section: the
    // one ATT&CK module is the Mapper, so it routes out of this page the same
    // way a `report` hit routes to Threat Briefs.
    if (entityType === 'attack_technique') { openAttackTechnique(entityId); return; }
    const targetView = TI_ENTITY_TYPE_TO_VIEW[entityType];
    if (!targetView) return;
    setPendingTiEntityOpen({ type: entityType, id: entityId });
    navigate(targetView);
  };

  // P1-8 — open one technique in the MITRE ATT&CK module (the former Mapper).
  const openAttackTechnique = (techniqueId?: string) => {
    setPendingAttackTechniqueId(techniqueId ?? null);
    navigate('mitre-mapper');
  };

  // THREAT_BRIEF_PHASE2.md §4 — "Create Threat Brief" action from a
  // supported intelligence page; the context is automatically attached,
  // the analyst never re-enters data LekirraX already has.
  const createThreatBriefFrom = (contextType: string, contextId: string) => {
    setPendingThreatBriefContext({ type: contextType, id: contextId });
    navigate('threat-briefs');
  };

  // KNOWLEDGE_BASE_PHASE1.md §22 "ENTITY TO KNOWLEDGE LINK" — an existing
  // intelligence page's "View Related Knowledge" hands off to the Knowledge
  // Base list, pre-filtered to entries linked to that entity.
  const viewKnowledgeForEntity = (entityType: string, entityId: string, label: string) => {
    setPendingKnowledgeFilter({ relatedEntityType: entityType, relatedEntityId: entityId, label });
    navigate('knowledge-base');
  };

  // NOTES_PHASE2.md §13/§62 "[View Notes]" — the SAME lifted-state handoff
  // pattern as viewKnowledgeForEntity, opening the centralized Notes page
  // pre-filtered to one entity or case.
  const viewNotesForEntity = (entityType: string, entityId: string, label: string) => {
    setPendingNotesFilter({ entityType, entityId, label });
    navigate('notes');
  };
  const viewNotesForCase = (caseId: number, label: string) => {
    setPendingNotesFilter({ caseId, label });
    navigate('notes');
  };
  // NOTES_PHASE3.md §50 "[Ask AI About This Note]" — opens the existing Ask
  // AI page with the Note's own content already quoted into the question,
  // and (when the Note has one) its Case/Entity as ambient pageContext, so
  // Ask AI's own existing entity-grounded retrieval still applies.
  const askAiAboutNote = (question: string, pageContext?: { type: string; id: string | number; label?: string } | null) => {
    setAskAiPageContext(pageContext ?? null);
    setPendingAskAiQuestion(question);
    navigate('ask-ai');
  };
  // MALWARE_INTELLIGENCE_PHASE1.md §58 "ASK AI" — a generic entity variant
  // of the same handoff, seeding a natural default question plus the
  // entity as ambient pageContext (reuses Ask AI's own already-supported
  // 'malware' context type — never a Malware-specific AI engine).
  const viewAskAiForEntity = (entityType: string, entityId: string, label: string) => {
    setAskAiPageContext({ type: entityType, id: entityId, label });
    setPendingAskAiQuestion(`What do we know about ${label}?`);
    navigate('ask-ai');
  };

  // KNOWLEDGE_BASE_PHASE2.md §24 — [Create Knowledge Entry] from a Knowledge
  // Gap banner on another page hands off a prefilled (never auto-submitted) create form.
  const createKnowledgeEntryForEntity = (prefill: KnowledgeCreatePrefill) => {
    setPendingKnowledgeCreate(prefill);
    navigate('knowledge-base');
  };

  // §26 — a Knowledge Context Panel's own "open this recommended entry" click.
  const openKnowledgeEntry = (id: number) => {
    setPendingKnowledgeOpenId(id);
    navigate('knowledge-base');
  };

  // INVESTIGATIONS_PHASE1.md §60 — Alert Center [Investigate] hands off the
  // case id resolved by findCaseForAlert so it opens directly on arrival.
  const openCase = (caseId: number) => {
    setPendingCaseOpenId(caseId);
    navigate('cases');
  };
  const navigateToCases = () => {
    setPendingCaseOpenId(null);
    navigate('cases');
  };

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    setAuthRecovery(null);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setView('dashboard');
    setDisplayView('dashboard');
    setTransitionStage('idle');
    setTerminationAlert(null);
    setAuthRecovery(null);
    window.history.replaceState({ view: 'dashboard', searchText: '' }, '', '#/dashboard');
  };

  const handleTerminationLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setTerminationAlert(null);
    window.location.reload();
  };

  const handleRelogin = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCheckingAuth(false);
    setTerminationAlert(null);
    setAuthRecovery(null);
    setView('dashboard');
    setDisplayView('dashboard');
    setTransitionStage('idle');
    window.history.replaceState({ view: 'dashboard', searchText: '' }, '', '#/dashboard');
  };

  const handleScan = () => {
    if (searchText.trim()) {
      addSearchHistory(searchText);
      navigate('results');
    }
  };

  if (checkingAuth && !user) return null;

  if (terminationAlert) {
    return (
      <TerminationAlert
        type={terminationAlert.type}
        title={terminationAlert.title}
        message={terminationAlert.message}
        reason={terminationAlert.reason}
        onLogout={handleTerminationLogout}
      />
    );
  }

  return (
    <ErrorBoundary>
      {authRecovery && (
        <AuthRecoveryPrompt
          title={authRecovery.title}
          message={authRecovery.message}
          onRelogin={handleRelogin}
        />
      )}
      {!user ? (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      ) : isClientScoped ? (
        <Suspense fallback={<div style={{ padding: '48px', textAlign: 'center', opacity: 0.7 }}>Loading…</div>}>
          <ClientPortalPage user={user} onLogout={handleLogout} />
        </Suspense>
      ) : (
        <AppShell activeView={displayView} onNavigate={navigate} isAdmin={isAdmin} user={user} onLogout={handleLogout}>
            <div
              className={[
                'page-transition',
                transitionStage === 'exiting' ? 'is-exiting' : '',
                transitionStage === 'pre-enter' ? 'is-pre-enter' : ''
              ].filter(Boolean).join(' ')}
            >
            <Suspense fallback={<div style={{ padding: '48px', textAlign: 'center', opacity: 0.7 }}>Loading…</div>}>
              {displayView === 'dashboard' && (
                  <DashboardPage
                      onNavigateToScan={() => navigate('input')}
                      onNavigateToOsint={() => navigate('osint-dashboard')}
                  />
              )}
              {displayView === 'admin' && isAdmin && (
                <AdminDashboardPage
                  onNavigateToUserManagement={() => navigate('users')}
                  onNavigateToFullHistory={() => navigate('history')}
                  onNavigateToSessionManagement={() => navigate('sessions')}
                />
              )}
              {displayView === 'users' && isAdmin && (
                <UserManagementPage
                  onBack={() => navigate('admin')}
                />
              )}
              {displayView === 'sessions' && isAdmin && (
                <SessionManagementPage
                  onBack={() => navigate('admin')}
                />
              )}
              {displayView === 'audit-logs' && isAdmin && (
                <AuditLogsPage
                  onBack={() => navigate('admin')}
                />
              )}
              {displayView === 'api-keys' && isAdmin && (
                <ApiKeysPage
                  onBack={() => navigate('admin')}
                />
              )}
              {displayView === 'settings' && isAdmin && (
                <SettingsPage
                  onBack={() => navigate('admin')}
                />
              )}
              {displayView === 'roles' && isAdmin && (
                <RolesPage
                  onBack={() => navigate('admin')}
                />
              )}
              {displayView === 'clients' && isAdmin && (
                <ClientsPage
                  onBack={() => navigate('admin')}
                />
              )}
              {displayView === 'system-performance' && isAdmin && (
                <PerformanceMonitorPage
                  onBack={() => navigate('admin')}
                />
              )}
              {displayView === 'input' && (
                <ScanInputPage
                  value={searchText}
                  onChange={setSearchText}
                  onScan={handleScan}
                  onOsint={() => navigate('osint-dashboard')}
                />
              )}
              {displayView === 'results' && (
                <ScanResultsPage
                  target={searchText}
                  onBack={() => navigate('dashboard')}
                  onCancelBack={() => navigate('input')}
                />
              )}

              {OSINT_VIEW_TO_SECTION[displayView] && (
                <OsintPage
                  isAdmin={isAdmin}
                  activeSection={OSINT_VIEW_TO_SECTION[displayView]}
                  onSectionChange={(section) => navigate(OSINT_SECTION_TO_VIEW[section] ?? 'osint-dashboard')}
                  initialNav={pendingOsintNav}
                  onInitialNavConsumed={() => setPendingOsintNav(null)}
                  onNavigateToView={(v) => navigate(v as View)}
                  onOpenKnowledgeEntry={openKnowledgeEntry}
                  onCreateKnowledgeEntry={createKnowledgeEntryForEntity}
                  onCreateThreatBrief={createThreatBriefFrom}
                  onViewNotes={viewNotesForEntity}
                  onOpenEntity={openThreatIntelEntity}
                />
              )}
              {displayView === 'threatmap' && (
                <GlobalThreatMapPage />
              )}
              {displayView === 'findings-feed' && (
                <FindingsFeedPage
                    onNavigateToOsint={() => navigate('osint-dashboard')}
                />
              )}
              {displayView === 'risk-scores' && (
                <RiskScoresPage />
              )}
              {displayView === 'analytics' && (
                <AnalyticsWorkspacePage
                  initialTab={pendingAnalyticsTab}
                  onInitialTabConsumed={() => setPendingAnalyticsTab(null)}
                />
              )}
              {MON_VIEW_TO_SECTION[displayView] && (
                <MonitoringPage
                  activeSection={MON_VIEW_TO_SECTION[displayView]}
                  onSectionChange={(section) => navigate(MON_SECTION_TO_VIEW[section] ?? 'mon-overview')}
                  initialMonitorType={pendingMonitorType}
                  onInitialMonitorTypeConsumed={() => setPendingMonitorType(null)}
                  onOpenCase={openCase}
                  onNavigateToCases={navigateToCases}
                />
              )}
              {TI_VIEW_TO_SECTION[displayView] && (
                <ThreatIntelligencePage
                  activeSection={TI_VIEW_TO_SECTION[displayView]}
                  onSectionChange={(section) => navigate(TI_SECTION_TO_VIEW[section] ?? 'ti-overview')}
                  onInvestigate={investigateInOsint}
                  onCreateThreatBrief={createThreatBriefFrom}
                  onViewKnowledge={viewKnowledgeForEntity}
                  onViewNotes={viewNotesForEntity}
                  onOpenKnowledgeEntry={openKnowledgeEntry}
                  onCreateKnowledgeEntry={createKnowledgeEntryForEntity}
                  isAdmin={isAdmin}
                  onAskAi={viewAskAiForEntity}
                  onViewSample={viewMalwareSample}
                  initialOpenEntity={pendingTiEntityOpen}
                  onInitialOpenEntityConsumed={() => setPendingTiEntityOpen(null)}
                  onOpenThreatBrief={openThreatBrief}
                  onOpenAttackTechnique={openAttackTechnique}
                />
              )}
              {displayView === 'threat-briefs' && (
                <ThreatBriefsPage isAdmin={isAdmin} initialContext={pendingThreatBriefContext} onInitialContextConsumed={() => setPendingThreatBriefContext(null)}
                  onOpenKnowledgeEntry={openKnowledgeEntry} onCreateKnowledgeEntry={createKnowledgeEntryForEntity}
                  initialOpenId={pendingThreatBriefOpenId} onInitialOpenIdConsumed={() => setPendingThreatBriefOpenId(null)} />
              )}
              {displayView === 'knowledge-base' && (
                <KnowledgeBasePage isAdmin={isAdmin} initialFilter={pendingKnowledgeFilter} onInitialFilterConsumed={() => setPendingKnowledgeFilter(null)}
                  initialCreatePrefill={pendingKnowledgeCreate} onInitialCreatePrefillConsumed={() => setPendingKnowledgeCreate(null)}
                  initialOpenId={pendingKnowledgeOpenId} onInitialOpenIdConsumed={() => setPendingKnowledgeOpenId(null)} />
              )}
              {displayView === 'malware-analysis' && (
                <MalwareAnalysisPage isAdmin={isAdmin} initialOpenId={pendingMalwareSampleId} onInitialOpenIdConsumed={() => setPendingMalwareSampleId(null)} />
              )}
              {displayView === 'shadowserver-intel' && (
                <ShadowserverIntelPage />
              )}
              {displayView === 'ask-ai' && (
                <AskAIPage
                  onNavigate={(v) => navigate(v as View)}
                  pageContext={askAiPageContext}
                  initialQuestion={pendingAskAiQuestion}
                  onInitialQuestionConsumed={() => { setPendingAskAiQuestion(null); setAskAiPageContext(null); }}
                />
              )}
              {displayView === 'threat-summary' && (
                <ThreatSummaryPage onNavigate={(v) => navigate(v as View)} onOpenEntity={openThreatIntelEntity} />
              )}
              {displayView === 'ioc-analyzer' && (
                <IocAnalyzerPage
                  onNavigate={(v) => navigate(v as View)}
                  onOpenEntity={openThreatIntelEntity}
                  onViewNotes={viewNotesForEntity}
                  onViewKnowledge={viewKnowledgeForEntity}
                  onCreateThreatBrief={createThreatBriefFrom}
                />
              )}
              {displayView === 'report-generator' && (
                <ReportGeneratorPage
                  onOpenEntity={openThreatIntelEntity}
                  onOpenCase={openCase}
                  onViewNotesForEntity={viewNotesForEntity}
                  onViewNotesForCase={viewNotesForCase}
                  onViewKnowledge={viewKnowledgeForEntity}
                  onCreateThreatBrief={createThreatBriefFrom}
                />
              )}
              {displayView === 'mitre-mapper' && (
                <MitreMapperPage
                  onOpenEntity={openThreatIntelEntity}
                  onOpenCase={openCase}
                  onViewNotesForEntity={viewNotesForEntity}
                  onViewKnowledge={viewKnowledgeForEntity}
                  onOpenKnowledgeEntry={openKnowledgeEntry}
                  onCreateKnowledgeEntry={createKnowledgeEntryForEntity}
                  initialTechniqueId={pendingAttackTechniqueId}
                  onInitialTechniqueConsumed={() => setPendingAttackTechniqueId(null)}
                />
              )}
              {displayView === 'cases' && (
                <CasesPage
                  onCreateThreatBrief={createThreatBriefFrom}
                  onCreateKnowledgeEntry={createKnowledgeEntryForEntity}
                  onViewNotes={viewNotesForCase}
                  initialOpenId={pendingCaseOpenId}
                  onInitialOpenIdConsumed={() => setPendingCaseOpenId(null)}
                />
              )}
              {displayView === 'timeline' && (
                <TimelinePage
                  onNavigate={(v) => navigate(v as View)}
                  onOpenCase={openCase}
                  onOpenKnowledgeEntry={openKnowledgeEntry}
                />
              )}
              {displayView === 'evidence' && (
                <EvidencePage
                  onNavigate={(v) => navigate(v as View)}
                  onOpenCase={openCase}
                  onOpenKnowledgeEntry={openKnowledgeEntry}
                />
              )}
              {displayView === 'notes' && (
                <NotesPage
                  onNavigate={(v) => navigate(v as View)}
                  onOpenCase={openCase}
                  initialFilter={pendingNotesFilter}
                  onInitialFilterConsumed={() => setPendingNotesFilter(null)}
                  onAskAiAboutNote={askAiAboutNote}
                />
              )}
              {displayView === 'history' && (
                <HistoryPage
                  onBack={() => navigate(historyPreviousViewRef.current)}
                  onRunQuery={(target) => {
                    setSearchText(target);
                    navigate('results');
                  }}
                  isAdmin={isAdmin}
                />
              )}
            </Suspense>
            </div>
        </AppShell>
      )}
    </ErrorBoundary>
  );
}
