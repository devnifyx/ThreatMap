import React from 'react';
import type { IpIntelligenceData } from '../../../types';

interface ReputationPaneProps {
    data: IpIntelligenceData;
}

const reputationPillClass = (reputation?: string) => {
    if (reputation === 'Malicious' || reputation === 'Suspicious') return 'pill--bad';
    if (reputation === 'Neutral') return 'pill--ok';
    return '';
};

const statusPillClass = (status?: string) => {
    if (status === 'Listed') return 'pill--bad';
    if (status === 'Clean') return 'pill--ok';
    return '';
};

const ReputationPane: React.FC<ReputationPaneProps> = ({ data }) => {
    const rep = data?.threat;

    if (!rep) {
        return (
            <section className="iint-card" aria-label="Reputation & threat intel">
                <div className="iint-card-title">Reputation & Threat Intel</div>
                <div className="iint-empty">No reputation data available.</div>
            </section>
        );
    }

    return (
        <>
            <section className="iint-card" aria-label="Reputation summary">
                <div className="iint-card-title">Reputation & Threat Intel</div>
                <div className="iint-kv">
                    <div className="k">Overall reputation</div>
                    <div className="v"><span className={`pill ${reputationPillClass(rep.threatIntel?.reputation)}`}>{rep.threatIntel?.reputation ?? 'Unknown'}</span></div>
                    <div className="k">Phishing</div>
                    <div className="v">{rep.threatIntel?.phishing ?? '—'}</div>
                    <div className="k">Malware</div>
                    <div className="v">{rep.threatIntel?.malware ?? '—'}</div>
                    {typeof rep.threatIntel?.abuseConfidenceScore === 'number' && (
                        <>
                            <div className="k">Abuse confidence score</div>
                            <div className="v">{rep.threatIntel.abuseConfidenceScore}/100</div>
                        </>
                    )}
                    {typeof rep.threatIntel?.totalReports === 'number' && (
                        <>
                            <div className="k">Total abuse reports</div>
                            <div className="v">{rep.threatIntel.totalReports}</div>
                        </>
                    )}
                </div>
            </section>

            <section className="iint-card" aria-label="Blocklist status" style={{ marginTop: '12px' }}>
                <div className="iint-card-title">Blocklist Status</div>
                <ul className="iint-list">
                    <li>Google Safe Browsing — <span className={`pill ${statusPillClass(rep.blocklists?.googleSafeBrowsing)}`}>{rep.blocklists?.googleSafeBrowsing ?? 'Not Checked'}</span></li>
                    <li>Spamhaus — <span className={`pill ${statusPillClass(rep.blocklists?.spamhaus)}`}>{rep.blocklists?.spamhaus ?? 'Not Checked'}</span></li>
                    <li>AbuseIPDB — <span className={`pill ${statusPillClass(rep.blocklists?.abuseIPDB)}`}>{rep.blocklists?.abuseIPDB ?? 'Not Checked'}</span></li>
                </ul>
            </section>
        </>
    );
};

export default ReputationPane;
