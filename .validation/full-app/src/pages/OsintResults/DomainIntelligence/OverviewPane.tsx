import React from 'react';
import type { DomainIntelligenceData } from '../../../types';

interface OverviewPaneProps {
    data: DomainIntelligenceData;
    risk?: string;
}

const OverviewPane: React.FC<OverviewPaneProps> = ({ data }) => {
    const overview = data?.overview;

    if (!overview) {
        return (
            <section className="dint-card" aria-label="Overview">
                <div className="dint-card-title">Overview</div>
                <div className="dint-empty">No overview data available.</div>
            </section>
        );
    }

    return (
        <>
            <section className="dint-card" aria-label="Overview">
                <div className="dint-card-title">Overview</div>
                <div className="dint-kv">
                    <div className="k">Domain</div>
                    <div className="v">{data?.domain ?? '—'}</div>
                    <div className="k">Brand match</div>
                    <div className="v">{overview.brandMatchSummary}</div>
                    <div className="k">Domain age</div>
                    <div className="v">{typeof overview.domainAgeDays === 'number' ? `${overview.domainAgeDays} day(s)` : 'Unknown'}</div>
                    <div className="k">Scan duration</div>
                    <div className="v">{typeof data?.scanDuration === 'number' ? `${(data.scanDuration / 1000).toFixed(1)}s` : '—'}</div>
                </div>
            </section>

            <section className="dint-card" aria-label="Supporting evidence" style={{ marginTop: '12px' }}>
                <div className="dint-card-title">Supporting Evidence</div>
                {overview.supportingEvidence?.length ? (
                    <ul className="dint-list">
                        {overview.supportingEvidence.map((e, i) => <li key={`${e}-${i}`}>{e}</li>)}
                    </ul>
                ) : (
                    <div className="dint-empty">No supporting evidence gathered.</div>
                )}
            </section>

            {overview.reputationSummary && (
                <section className="dint-card" aria-label="Reputation snapshot" style={{ marginTop: '12px' }}>
                    <div className="dint-card-title">Reputation Snapshot</div>
                    <div className="dint-kv">
                        <div className="k">Phishing</div>
                        <div className="v">{overview.reputationSummary.phishing}</div>
                        <div className="k">Malware</div>
                        <div className="v">{overview.reputationSummary.malware}</div>
                        <div className="k">Reputation</div>
                        <div className="v">{overview.reputationSummary.reputation}</div>
                    </div>
                </section>
            )}

            <section className="dint-card" aria-label="Related tools" style={{ marginTop: '12px' }}>
                <div className="dint-card-title">Related Tools</div>
                <ul className="dint-list">
                    <li>{overview.crossLinks?.phishingDetection}</li>
                    <li>{overview.crossLinks?.webCheck}</li>
                </ul>
            </section>
        </>
    );
};

export default OverviewPane;
