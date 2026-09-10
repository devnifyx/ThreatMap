import React, { useState, useEffect } from 'react';
import { getDashboardFindings } from '../../services/api';
import { timeAgo } from '../../utils/timeAgo';
import './FindingsFeedPage.css';

interface FindingsFeedPageProps {
    onNavigateToOsint: () => void;
}

interface Finding {
    id: string;
    target: string;
    kind: string;
    kindSlug: string;
    risk: string | null;
    timestamp: string | null;
    source: 'osint' | 'scan';
}

interface Pagination {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

interface FindingsResponse {
    findings: Finding[];
    pagination: Pagination;
}

type FilterState = {
    type:   'all' | 'osint' | 'web-check';
    risk:   'all' | 'Critical' | 'High' | 'Medium' | 'Low';
    period: 'all' | '24h' | '7d' | '30d';
    page:   number;
};

const RiskBadge: React.FC<{ risk: string | null }> = ({ risk }) => {
    if (!risk) return <span className="findings-risk-badge findings-risk-badge--none">—</span>;
    const cls = `findings-risk-badge findings-risk-badge--${risk.toLowerCase()}`;
    return <span className={cls}>{risk}</span>;
};

const KindBadge: React.FC<{ kind: string }> = ({ kind }) => (
    <span className="findings-kind-badge">{kind}</span>
);

const FindingsTable: React.FC<{ findings: Finding[]; onNavigateToOsint: () => void }> = ({ findings, onNavigateToOsint }) => {
    if (findings.length === 0) {
        return (
            <div className="findings-empty">
                <p>No findings match the selected filters.</p>
            </div>
        );
    }

    return (
        <div className="findings-table-wrap">
            <table className="findings-table">
                <thead>
                    <tr>
                        <th>Target</th>
                        <th>Type</th>
                        <th>Risk</th>
                        <th>Time</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    {findings.map((f) => (
                        <tr key={f.id}>
                            <td>
                                <span className="findings-target" title={f.target}>{f.target}</span>
                            </td>
                            <td><KindBadge kind={f.kind} /></td>
                            <td><RiskBadge risk={f.risk} /></td>
                            <td className="findings-time">
                                {f.timestamp ? timeAgo(f.timestamp) : '—'}
                            </td>
                            <td>
                                <button
                                    className="findings-view-btn"
                                    onClick={onNavigateToOsint}
                                    type="button"
                                >
                                    View
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const FindingsFeedPagination: React.FC<{
    current: number;
    total: number;
    onChange: (p: number) => void;
}> = ({ current, total, onChange }) => {
    // Show at most 7 page buttons
    const pages: number[] = [];
    const window = 2;
    for (let p = 1; p <= total; p++) {
        if (p === 1 || p === total || Math.abs(p - current) <= window) {
            pages.push(p);
        }
    }

    return (
        <div className="findings-pagination">
            <button disabled={current <= 1} onClick={() => onChange(current - 1)}>‹ Prev</button>
            {pages.map((p, i) => {
                const prev = pages[i - 1];
                return (
                    <React.Fragment key={p}>
                        {prev && p - prev > 1 && <span className="findings-pagination-ellipsis">…</span>}
                        <button
                            className={p === current ? 'active' : ''}
                            onClick={() => onChange(p)}
                        >
                            {p}
                        </button>
                    </React.Fragment>
                );
            })}
            <button disabled={current >= total} onClick={() => onChange(current + 1)}>Next ›</button>
        </div>
    );
};

const FindingsFeedPage: React.FC<FindingsFeedPageProps> = ({ onNavigateToOsint }) => {
    const [filters, setFilters] = useState<FilterState>({
        type: 'all', risk: 'all', period: '30d', page: 1,
    });
    const [data, setData]       = useState<FindingsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getDashboardFindings({
            type:   filters.type,
            risk:   filters.risk,
            period: filters.period,
            page:   filters.page,
        })
            .then((res) => { if (!cancelled) { setData(res); setLoading(false); } })
            .catch((err) => { if (!cancelled) { setError(String(err?.message || 'Failed to load findings')); setLoading(false); } });
        return () => { cancelled = true; };
    }, [filters]);

    const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
        setFilters(f => ({ ...f, [key]: value, page: key !== 'page' ? 1 : (value as number) }));
    };

    return (
        <div className="findings-feed-page">
            <div className="findings-feed-header">
                <h1 className="findings-feed-title">Findings Feed</h1>
                <button className="findings-feed-new-btn" onClick={onNavigateToOsint} type="button">
                    + New Investigation
                </button>
            </div>

            <div className="findings-filter-bar">
                <select
                    value={filters.type}
                    onChange={e => setFilter('type', e.target.value as FilterState['type'])}
                    aria-label="Filter by type"
                >
                    <option value="all">All Types</option>
                    <option value="osint">OSINT</option>
                    <option value="web-check">Web Check</option>
                </select>

                <select
                    value={filters.risk}
                    onChange={e => setFilter('risk', e.target.value as FilterState['risk'])}
                    aria-label="Filter by risk level"
                >
                    <option value="all">All Risk Levels</option>
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                </select>

                <select
                    value={filters.period}
                    onChange={e => setFilter('period', e.target.value as FilterState['period'])}
                    aria-label="Filter by time period"
                >
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="all">All time</option>
                </select>
            </div>

            {loading ? (
                <div className="findings-loading">Loading…</div>
            ) : error ? (
                <div className="findings-error">{error}</div>
            ) : (
                <FindingsTable findings={data?.findings ?? []} onNavigateToOsint={onNavigateToOsint} />
            )}

            {data && data.pagination.totalPages > 1 && (
                <FindingsFeedPagination
                    current={data.pagination.page}
                    total={data.pagination.totalPages}
                    onChange={(p) => setFilter('page', p)}
                />
            )}

            {data && !loading && (
                <div className="findings-total-count">
                    {data.pagination.total.toLocaleString()} total finding{data.pagination.total !== 1 ? 's' : ''}
                    {data.pagination.totalPages > 1
                        ? ` — page ${data.pagination.page} of ${data.pagination.totalPages}`
                        : ''}
                </div>
            )}
        </div>
    );
};

export default FindingsFeedPage;
