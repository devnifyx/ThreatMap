import React from 'react';
import type { UsernameIntelligenceData } from '../../../types';

interface ReputationPaneProps {
    data: UsernameIntelligenceData;
}

const barColor = (pct: number) => (pct >= 70 ? 'rgba(16, 185, 129, 0.7)' : pct >= 40 ? 'rgba(245, 158, 11, 0.7)' : 'rgba(239, 68, 68, 0.7)');

const ReputationPane: React.FC<ReputationPaneProps> = ({ data }) => {
    const rep = data?.reputation;
    if (!rep) {
        return (
            <section className="uint-card" aria-label="Reputation">
                <div className="uint-card-title">Reputation</div>
                <div className="uint-empty">No reputation data available.</div>
            </section>
        );
    }

    return (
        <>
            <section className="uint-card" aria-label="Reputation scores">
                <div className="uint-card-title">Reputation</div>
                <div className="uint-kv">
                    <div className="k">Overall risk score</div>
                    <div className="v">{rep.overallRiskScore}/100</div>
                    <div className="k">Confidence score</div>
                    <div className="v">{rep.confidenceScore}/100</div>
                </div>
                <div style={{ marginTop: '12px' }}>
                    <div className="uint-empty">Profile consistency across platforms</div>
                    <div className="uint-reputation-bar-track">
                        <div className="uint-reputation-bar-fill" style={{ width: `${rep.profileConsistency}%`, background: barColor(rep.profileConsistency) }} />
                    </div>
                    <div className="uint-empty" style={{ marginTop: '4px' }}>{rep.profileConsistency}%</div>
                </div>
            </section>

            <section className="uint-card" aria-label="Account breakdown" style={{ marginTop: '12px' }}>
                <div className="uint-card-title">Account Breakdown</div>
                <ul className="uint-list">
                    <li>Verified — <span className="pill pill--ok">{rep.verifiedAccounts}</span></li>
                    <li>Inactive — <span className="pill">{rep.inactiveAccounts}</span></li>
                    <li>Suspicious — <span className="pill">{rep.suspiciousAccounts}</span></li>
                    <li>Possible fake — <span className="pill pill--bad">{rep.possibleFakeAccounts}</span></li>
                </ul>
            </section>
        </>
    );
};

export default ReputationPane;
