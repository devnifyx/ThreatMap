import React from 'react';
import type { UsernameIntelligenceData } from '../../../types';

interface OverviewPaneProps {
    data: UsernameIntelligenceData;
    risk: string | null;
}

const OverviewPane: React.FC<OverviewPaneProps> = ({ data, risk }) => {
    const overview = data?.overview;

    return (
        <section className="uint-card" aria-label="Overview">
            <div className="uint-card-title">Overview</div>
            <div className="uint-kv">
                <div className="k">Username</div>
                <div className="v">{data?.username ?? '—'}</div>
                <div className="k">Risk score</div>
                <div className="v">
                    <span className="pill">{risk ?? overview?.riskLevel ?? '—'}</span>
                </div>
                <div className="k">Platforms checked</div>
                <div className="v">{overview?.platformsFound ?? '—'}</div>
                <div className="k">Verified</div>
                <div className="v">{overview?.verifiedCount ?? '—'}</div>
                <div className="k">Unverified</div>
                <div className="v">{overview?.unverifiedCount ?? '—'}</div>
                <div className="k">Not found</div>
                <div className="v">{overview?.notFoundCount ?? '—'}</div>
                <div className="k">Scan duration</div>
                <div className="v">{typeof data?.scanDuration === 'number' ? `${(data.scanDuration / 1000).toFixed(1)}s` : '—'}</div>
            </div>
            {overview?.aiExecutiveSummary && (
                <div className="uint-note" style={{ marginTop: '10px' }}>{overview.aiExecutiveSummary}</div>
            )}
        </section>
    );
};

export default OverviewPane;
