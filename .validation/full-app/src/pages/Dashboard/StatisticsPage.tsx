import React, { useState, useEffect } from 'react';
import {
    FileText, CalendarDays, TrendingUp, Clock, Database, Target, Tag, Megaphone,
    ScanLine, User, Link2, Lock, ShieldOff,
} from 'lucide-react';
import { getDashboardStatistics } from '../../services/api';
import './StatisticsPage.css';

// ── Types ──────────────────────────────────────────────────────────────────

interface StatisticsData {
    scans: {
        total: number; today: number; week7: number; month30: number; month90: number;
        riskBreakdown: { critical: number; high: number; medium: number; low: number };
    };
    osint: {
        total: number; uniqueTargets: number;
        byModule: { module: string; count: number; slug: string }[];
        riskBreakdown: { critical: number; high: number; medium: number; low: number; unknown: number };
    };
    correlations: { total: number };
    users: { total: number; byRole: { role: string; count: number }[] };
    brandIntel: {
        totalBrands: number; activeCampaigns: number; totalScans: number; totalCandidates: number;
    } | null;
}

// ── Sub-components ─────────────────────────────────────────────────────────

const StatCard: React.FC<{ label: string; value: number | string | null; sub?: string; icon?: React.ComponentType<{ size?: number | string }> }> = ({ label, value, sub, icon: Icon }) => (
    <div className="stat-card">
        {Icon && <div className="stat-card-icon"><Icon size={14} /></div>}
        <div className="stat-card-value">
            {value === null ? '—' : typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="stat-card-label">{label}</div>
        {sub && <div className="stat-card-sub">{sub}</div>}
    </div>
);

// A single, visually stronger number for the one figure a card wants to lead
// with (e.g. Brand Intelligence's Candidates Found) — same real value as a
// StatCard would show, just given more weight than the compact tiles above it.
const StatHighlight: React.FC<{ label: string; value: number | string | null; trend?: string }> = ({ label, value, trend }) => (
    <div className="stat-highlight">
        <div className="stat-highlight-value">
            {value === null ? '—' : typeof value === 'number' ? value.toLocaleString() : value}
            {trend && <span className="stat-highlight-trend">{trend}</span>}
        </div>
        <div className="stat-highlight-label">{label}</div>
    </div>
);

const StatSection: React.FC<{ title: string; children: React.ReactNode; faded?: boolean; period?: string; className?: string }> = ({ title, children, faded, period, className }) => (
    <section className={`stat-section${faded ? ' stat-section--faded' : ''}${className ? ` ${className}` : ''}`}>
        <div className="stat-section-head">
            <div className="stat-section-title">{title}</div>
            {period && <span className="stat-section-period">{period}</span>}
        </div>
        {children}
    </section>
);

const RiskMiniBar: React.FC<{ counts: Record<string, number> }> = ({ counts }) => {
    const LEVELS = [
        { key: 'critical', label: 'Critical', color: '#f85149' },
        { key: 'high',     label: 'High',     color: '#d29922' },
        { key: 'medium',   label: 'Medium',   color: '#58a6ff' },
        { key: 'low',      label: 'Low',      color: '#3fb950' },
    ];
    const max = Math.max(...LEVELS.map(l => counts[l.key] || 0), 1);
    return (
        <div className="risk-mini-bar-list">
            {LEVELS.map(({ key, label, color }) => (
                <div className="risk-mini-bar-row" key={key}>
                    <span className="risk-mini-bar-label">{label}</span>
                    <div className="risk-mini-bar-track">
                        <div
                            className="risk-mini-bar-fill"
                            style={{ width: `${((counts[key] || 0) / max) * 100}%`, background: color }}
                        />
                    </div>
                    <span className="risk-mini-bar-count">{(counts[key] || 0).toLocaleString()}</span>
                </div>
            ))}
        </div>
    );
};

const ModuleBarList: React.FC<{ modules: { module: string; count: number }[] }> = ({ modules }) => {
    if (!modules.length) return <p className="stat-empty-text">No investigations recorded yet.</p>;
    const max = Math.max(...modules.map(m => m.count), 1);
    // data-lenis-prevent — this list has its own overflow-y:auto; without
    // it, AppShell's Lenis smooth-scroll (SmoothScroll.tsx) swallows wheel
    // events over this region instead of letting the browser scroll it
    // natively. Same fix already used for every other internally-scrolling
    // region in the app (see grep for data-lenis-prevent).
    return (
        <div className="stat-module-list" data-lenis-prevent>
            {modules.map(m => (
                <div className="stat-module-row" key={m.module}>
                    <span className="stat-module-name" title={m.module}>{m.module}</span>
                    <div className="stat-module-bar-track">
                        <div className="stat-module-bar-fill" style={{ width: `${(m.count / max) * 100}%` }} />
                    </div>
                    <span className="stat-module-count">{m.count}</span>
                </div>
            ))}
        </div>
    );
};

// Same data.users.byRole array the plain-text rows used before — now shown
// as a proportional bar (role count / largest role count), not new data.
const RoleBarList: React.FC<{ roles: { role: string; count: number }[] }> = ({ roles }) => {
    const max = Math.max(...roles.map(r => r.count), 1);
    return (
        <div className="stat-role-list">
            {roles.map(r => (
                <div className="stat-role-row" key={r.role}>
                    <div className="stat-role-head">
                        <span className="stat-role-name">{r.role}</span>
                        <span className="stat-role-count">{r.count.toLocaleString()}</span>
                    </div>
                    <div className="stat-role-bar-track">
                        <div className="stat-role-bar-fill" style={{ width: `${(r.count / max) * 100}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
};

// ── Main component ─────────────────────────────────────────────────────────

const StatisticsPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
    const [data, setData]       = useState<StatisticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getDashboardStatistics()
            .then(d => { if (!cancelled) { setData(d as StatisticsData); setLoading(false); } })
            .catch(e => { if (!cancelled) { setError(String(e?.message || 'Failed to load statistics')); setLoading(false); } });
        return () => { cancelled = true; };
    }, []);

    if (loading) return <div className="statistics-page"><div className="stat-loading">Loading…</div></div>;
    if (error)   return <div className="statistics-page"><div className="stat-error">{error}</div></div>;
    if (!data)   return null;

    return (
        <div className="statistics-page">
            {!embedded && <h1 className="statistics-title">Statistics</h1>}

            {/* Asymmetric grid, sized to content (not stretched to match
                height) — Investigation Statistics carries the most real
                content (module list) so it's given the tallest, widest slot;
                everything below it just wraps to its own real content
                height instead of matching a forced row height. */}
            <div className="statistics-grid">

                {/* ── Scan Statistics ── */}
                <StatSection title="Scan Statistics" period="Last 30 days" className="stat-section--scan">
                    <div className="stat-cards-row">
                        <StatCard icon={FileText}     label="Total"    value={data.scans.total}   />
                        <StatCard icon={CalendarDays} label="Today"    value={data.scans.today}   />
                        <StatCard icon={TrendingUp}   label="7 Days"   value={data.scans.week7}   />
                        <StatCard icon={Clock}        label="30 Days"  value={data.scans.month30} />
                        <StatCard icon={Database}     label="90 Days"  value={data.scans.month90} />
                    </div>
                    <div className="stat-section-sub-title">Risk breakdown (by AI analysis)</div>
                    <RiskMiniBar counts={data.scans.riskBreakdown} />
                </StatSection>

                {/* ── Investigation Statistics ── */}
                <StatSection title="Investigation Statistics" period="Last 30 days" className="stat-section--investigation">
                    <div className="stat-cards-row">
                        <StatCard icon={FileText} label="Total"          value={data.osint.total}         />
                        <StatCard icon={Target}   label="Unique Targets" value={data.osint.uniqueTargets} />
                    </div>
                    <div className="stat-section-sub-title">By module</div>
                    <ModuleBarList modules={data.osint.byModule} />
                    <div className="stat-section-sub-title" style={{ marginTop: 14 }}>Risk breakdown</div>
                    <RiskMiniBar counts={data.osint.riskBreakdown} />
                </StatSection>

                {/* ── Brand Intelligence ── */}
                {data.brandIntel !== null ? (
                    <StatSection title="Brand Intelligence" period="Last 30 days" className="stat-section--brand">
                        <div className="stat-cards-row">
                            <StatCard icon={Tag}       label="Brands Tracked"   value={data.brandIntel.totalBrands}     />
                            <StatCard icon={Megaphone} label="Active Campaigns" value={data.brandIntel.activeCampaigns} />
                            <StatCard icon={ScanLine}  label="Total Scans"      value={data.brandIntel.totalScans}      />
                        </div>
                        <StatHighlight label="Candidates Found" value={data.brandIntel.totalCandidates} />
                    </StatSection>
                ) : (
                    <StatSection title="Brand Intelligence" faded className="stat-section--brand">
                        <div className="stat-coming-soon">
                            <ShieldOff size={22} />
                            <p>Brand Intelligence is not installed.</p>
                            <p className="stat-coming-soon-sub">
                                Brand monitoring data will appear here once the Brand Intelligence module is set up.
                            </p>
                        </div>
                    </StatSection>
                )}

                {/* ── System ── */}
                <StatSection title="System" className="stat-section--system">
                    <div className="stat-cards-row">
                        <StatCard icon={User}  label="Users"        value={data.users.total}        />
                        <StatCard icon={Link2} label="Correlations" value={data.correlations.total} />
                    </div>
                    {data.users.byRole.length > 0 && (
                        <>
                            <div className="stat-section-sub-title">Users by role</div>
                            <RoleBarList roles={data.users.byRole} />
                        </>
                    )}
                </StatSection>

                {/* ── IOC Statistics (honest coming-soon placeholder) — same
                    real absence-of-feature state as before, just placed in
                    the grid instead of full-width below it. ── */}
                <StatSection title="IOC Statistics" faded className="stat-section--ioc">
                    <div className="stat-coming-soon">
                        <Lock size={22} />
                        <p>IOC tracking is not yet available.</p>
                        <p className="stat-coming-soon-sub">
                            Indicators of Compromise will appear here once the IOC module is shipped.
                        </p>
                    </div>
                </StatSection>

            </div>
        </div>
    );
};

export default StatisticsPage;
