import React, { useCallback, useEffect, useState } from 'react';
import { getIntelligenceFeeds, getIntelligenceFeed, type IntelligenceFeed, type FeedDetail } from '../../../services/api';
import { formatDateTime } from '../ThreatIntelligenceShared';

const FeedDetailModal: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
    const [feed, setFeed] = useState<FeedDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        getIntelligenceFeed(id).then(setFeed).catch((err) => setError(err?.message || 'Failed to load feed detail')).finally(() => setLoading(false));
    }, [id]);

    return (
        <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Feed detail" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="ti-modal">
                <div className="ti-modal-header">
                    <h2>{feed?.name ?? 'Threat Feed'}</h2>
                    <button type="button" className="ti-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="ti-modal-body">
                    {error ? (
                        <div className="ti-error">{error}</div>
                    ) : loading || !feed ? (
                        <div className="ti-loading">Loading…</div>
                    ) : (
                        <>
                            {feed.description && <div className="ti-note">{feed.description}</div>}
                            <div className="ti-kv">
                                <span className="k">Provider</span><span className="v">{feed.provider}</span>
                                <span className="k">Type</span><span className="v">{feed.type}</span>
                                <span className="k">Status</span><span className="v">{feed.operational ? 'Operational' : feed.configured ? 'Connecting' : 'Not Configured'}</span>
                                <span className="k">Reliability</span><span className="v">{feed.reliability}</span>
                                <span className="k">Indicators Collected</span><span className="v">{feed.indicatorsInRepo.toLocaleString()}</span>
                                <span className="k">Last Successful Run</span><span className="v">{formatDateTime(feed.lastSuccessfulRun)}</span>
                                <span className="k">Last Failed Run</span><span className="v">{formatDateTime(feed.lastFailedRun)}</span>
                                {feed.lastError && (<><span className="k">Last Error</span><span className="v" style={{ color: '#f85149' }}>{feed.lastError}</span></>)}
                            </div>

                            <div>
                                <div className="ti-modal-subtitle">Most Recent Poll</div>
                                {!feed.lastRun ? <div className="ti-empty">No poll cycles recorded yet.</div> : (
                                    <div className="ti-kv">
                                        <span className="k">Finished</span><span className="v">{formatDateTime(feed.lastRun.finishedAt)}</span>
                                        <span className="k">Indicators Collected</span><span className="v">{feed.lastRun.itemsCollected}</span>
                                        <span className="k">Indicators Added</span><span className="v">{feed.lastRun.itemsAdded}</span>
                                        <span className="k">Indicators Updated</span><span className="v">{feed.lastRun.itemsUpdated}</span>
                                        <span className="k">Duplicates</span><span className="v">{feed.lastRun.duplicates}</span>
                                        <span className="k">Rejected Items</span><span className="v">{feed.lastRun.rejected}</span>
                                    </div>
                                )}
                            </div>

                            <div className="ti-note">
                                Totals across {feed.totalRuns} poll cycle{feed.totalRuns === 1 ? '' : 's'}: {feed.totalAdded} added, {feed.totalUpdated} updated, {feed.totalDuplicates} duplicates, {feed.totalRejected} rejected.
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const ThreatFeedsSection: React.FC = () => {
    const [feeds, setFeeds] = useState<IntelligenceFeed[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getIntelligenceFeeds().then(setFeeds).catch((err) => setError(err?.message || 'Failed to load threat feeds')).finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Threat Feeds</span>
                <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            </div>

            {error ? (
                <div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="ti-loading">Loading…</div>
            ) : feeds.length === 0 ? (
                <div className="ti-empty">No threat feeds configured.</div>
            ) : (
                <div className="ti-feed-grid">
                    {feeds.map((feed) => (
                        <button
                            type="button"
                            key={feed.id}
                            className={`ti-feed-card ${feed.planned ? 'ti-feed-card--planned' : ''}`}
                            onClick={() => { if (!feed.planned) setSelectedId(feed.id); }}
                            disabled={feed.planned}
                        >
                            <div className="ti-feed-head">
                                <span className="ti-feed-name">{feed.name}</span>
                                {feed.planned ? (
                                    <span className="ti-scope-badge ti-scope-badge--planned">Planned</span>
                                ) : (
                                    <span className="ti-feed-status">
                                        <span className={`ti-feed-dot ${feed.operational ? 'ti-feed-dot--on' : 'ti-feed-dot--off'}`} />
                                        {feed.operational ? 'Operational' : feed.configured ? 'Connecting' : 'Not Configured'}
                                    </span>
                                )}
                            </div>
                            {!feed.planned && (
                                <div className="ti-feed-stats">
                                    <span>Last update: {feed.lastUpdate ? formatDateTime(feed.lastUpdate) : '—'}</span>
                                    <span>Indicators: {(feed.indicators ?? 0).toLocaleString()}</span>
                                    <span>Reliability: {feed.reliability}</span>
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {selectedId != null && <FeedDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}
        </div>
    );
};

export default ThreatFeedsSection;
