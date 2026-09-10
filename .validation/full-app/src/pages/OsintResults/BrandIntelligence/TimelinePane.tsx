import React, { useState, useEffect, useCallback } from 'react';
import type { BrandScanJob, BrandTimelineEvent } from '../../../types/index';
import { getBrandTimeline } from '../../../services/api';

interface TimelinePaneProps {
    job: BrandScanJob;
}

const EVENT_TYPE_ICONS: Record<string, string> = {
    domain_discovered:  '🌐',
    evidence_recorded:  '🔍',
    campaign_identified:'⚡',
    campaign_active:    '📡'
};

const EVENT_TYPE_LABELS: Record<string, string> = {
    domain_discovered:  'Domain discovered',
    evidence_recorded:  'Evidence recorded',
    campaign_identified:'Campaign identified',
    campaign_active:    'Campaign still active'
};

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            year: 'numeric', month: 'long', day: 'numeric'
        });
    } catch { return iso; }
}

function formatTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString(undefined, {
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return ''; }
}

/** Group events by their calendar date (YYYY-MM-DD in local time) */
function groupByDate(events: BrandTimelineEvent[]): [string, BrandTimelineEvent[]][] {
    const map = new Map<string, BrandTimelineEvent[]>();
    for (const ev of events) {
        const dateKey = new Date(ev.event_time).toISOString().slice(0, 10);
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(ev);
    }
    // Return sorted DESC (newest first)
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

const TimelinePane: React.FC<TimelinePaneProps> = ({ job }) => {
    const [events,   setEvents]   = useState<BrandTimelineEvent[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState<string | null>(null);
    const [page,     setPage]     = useState(1);
    const [total,    setTotal]    = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    const PAGE_SIZE = 50;

    const loadPage = useCallback(async (p: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await getBrandTimeline(job.brand_id, { page: p, pageSize: PAGE_SIZE });
            setEvents(res.events ?? []);
            setTotal(res.total ?? 0);
            setTotalPages(res.totalPages ?? 1);
            setPage(p);
        } catch (err: any) {
            setError(err.message || 'Failed to load timeline');
        } finally {
            setLoading(false);
        }
    }, [job.brand_id]);

    useEffect(() => { loadPage(1); }, [loadPage]);

    if (loading) return <div className="bi-pane"><p className="bi-loading">Loading timeline…</p></div>;
    if (error)   return <div className="bi-pane"><div className="bi-error" role="alert">{error}</div></div>;

    if (events.length === 0) {
        return (
            <div className="bi-pane">
                <div className="bi-empty" role="status">
                    <p className="bi-empty-title">No timeline events yet</p>
                    <p className="bi-empty-sub">
                        The timeline is derived from domain discoveries, evidence records, and campaign
                        identifications across all investigations for this brand. Events appear after
                        investigations complete.
                    </p>
                </div>
            </div>
        );
    }

    const grouped = groupByDate(events);

    return (
        <div className="bi-pane">
            <p className="bi-section-title">Investigation Timeline</p>
            <p className="bi-section-sub">
                {total} event{total !== 1 ? 's' : ''} — derived from domain discoveries, evidence records, and
                campaign identifications. Ordered most recent first.
            </p>

            <div className="bi-timeline">
                {grouped.map(([dateKey, dayEvents]) => (
                    <div key={dateKey} className="bi-timeline-day">
                        <div className="bi-timeline-date-header">
                            {formatDate(dayEvents[0].event_time)}
                        </div>
                        <div className="bi-timeline-events">
                            {dayEvents.map((ev, i) => (
                                <div key={i} className={`bi-timeline-event bi-tl-${ev.event_type}`}>
                                    <span className="bi-timeline-icon" aria-hidden>
                                        {EVENT_TYPE_ICONS[ev.event_type] ?? '•'}
                                    </span>
                                    <div className="bi-timeline-body">
                                        <span className="bi-timeline-label">
                                            {EVENT_TYPE_LABELS[ev.event_type] ?? ev.event_type}
                                            {ev.source ? ` · ${ev.source.replace(/_/g, ' ')}` : ''}
                                        </span>
                                        <span className="bi-timeline-description">{ev.description}</span>
                                    </div>
                                    <span className="bi-timeline-time">{formatTime(ev.event_time)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="bi-pagination" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                        type="button"
                        className="bi-btn-secondary"
                        disabled={page <= 1}
                        onClick={() => loadPage(page - 1)}
                    >
                        ← Newer
                    </button>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        Page {page} of {totalPages}
                    </span>
                    <button
                        type="button"
                        className="bi-btn-secondary"
                        disabled={page >= totalPages}
                        onClick={() => loadPage(page + 1)}
                    >
                        Older →
                    </button>
                </div>
            )}
        </div>
    );
};

export default TimelinePane;
