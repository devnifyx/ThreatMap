import React from 'react';
import './MonitoringPage.css';
import OverviewSection from './sections/OverviewSection';
import CveMonitorSection from './sections/CveMonitorSection';
import BrandMonitorSection from './sections/BrandMonitorSection';
import AlertCenterSection from './sections/AlertCenterSection';
import MonitoringHistorySection from './sections/MonitoringHistorySection';

// MONITORING_CODE.md's target sidebar (§1–§11), a top-level module of its
// own — a sibling of OsintPage/GlobalThreatMapPage, not nested inside
// either. MONITORING_NAV_INTEGRATION.md moves its 11 modules out of this
// page's own internal sidebar and into AppShell's main "Monitoring"
// accordion (same shape as Dashboard/Threat Intelligence) — this component
// no longer renders its own nav at all. Which module is showing is
// controlled from outside via `activeSection` (driven by the route), and
// this page reports section changes back up via `onSectionChange` whenever
// something inside it needs to switch sections itself (currently just
// Overview's own KPI tiles) so the sidebar/hash/browser history all stay in
// sync with what's on screen. "What changed" (Monitoring) vs "what do we
// know" (Intelligence/OSINT), per §0.
//
// 'monitors' was its own section/leaf until it merged into 'overview'
// (OverviewSection.tsx now mounts the Monitors list itself, at the bottom of
// the page) — the two showed largely the same ground a click apart. No
// 'monitors' case remains here; App.tsx's LEGACY_VIEW_REDIRECTS sends the old
// hash (and the six legacy per-type ones that used to land on it) to
// 'mon-overview' before activeSection is ever computed.
interface MonitoringPageProps {
    activeSection: string;
    onSectionChange: (section: string) => void;
    // INVESTIGATIONS_PHASE1.md §60 — Alert Center's [Investigate] hands off
    // to the Cases module (existing case opens directly, otherwise the list).
    onOpenCase?: (caseId: number) => void;
    onNavigateToCases?: () => void;
    // Preselects the Monitors type filter when a legacy per-type route
    // (e.g. #/mon-domain-monitor) redirects into the unified list. Forwarded
    // to OverviewSection, which now mounts that list.
    initialMonitorType?: string | null;
    onInitialMonitorTypeConsumed?: () => void;
}

const MonitoringPage: React.FC<MonitoringPageProps> = ({ activeSection, onSectionChange, onOpenCase, onNavigateToCases, initialMonitorType, onInitialMonitorTypeConsumed }) => {
    const renderSection = () => {
        switch (activeSection) {
            case 'overview':
                return (
                    <OverviewSection
                        onNavigate={onSectionChange}
                        initialMonitorType={initialMonitorType}
                        onInitialMonitorTypeConsumed={onInitialMonitorTypeConsumed}
                    />
                );
            case 'cve-monitor':
                return <CveMonitorSection />;
            case 'brand-monitor':
                return <BrandMonitorSection />;
            case 'alert-center':
                return <AlertCenterSection onOpenCase={onOpenCase} onNavigateToCases={onNavigateToCases} />;
            case 'monitoring-history':
                return <MonitoringHistorySection />;
            default:
                return null;
        }
    };

    return (
        <div className="monitoring-page">
            <div className="monitoring-header">
                <h1>Monitoring</h1>
                <p className="monitoring-subtitle">Continuous checks over targets you're already watching — what changed, not what we already know.</p>
            </div>
            <div className="monitoring-container">
                <div className="monitoring-content">
                    {renderSection()}
                </div>
            </div>
        </div>
    );
};

export default MonitoringPage;
