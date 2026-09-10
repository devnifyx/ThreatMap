import React from 'react';
import type { DomainIntelligenceData, DomainSslCertSummary } from '../../../types';

interface SslComparisonPaneProps {
    data: DomainIntelligenceData;
}

const CertColumn: React.FC<{ title: string; cert?: DomainSslCertSummary }> = ({ title, cert }) => (
    <div className="dint-card" style={{ minWidth: 0 }}>
        <div className="dint-card-title">{title}</div>
        {cert ? (
            <div className="dint-kv">
                <div className="k">Issuer</div>
                <div className="v">{cert.issuer}{cert.isAutomatedCa && <span className="pill" style={{ marginLeft: '6px' }}>Free/Automated CA</span>}</div>
                <div className="k">Protocol</div>
                <div className="v">{cert.protocol ?? '—'}</div>
                <div className="k">Key</div>
                <div className="v">{cert.keyType ? `${cert.keyType}${cert.keyBits ? ` (${cert.keyBits}-bit)` : ''}` : '—'}</div>
                <div className="k">Signature algorithm</div>
                <div className="v">{cert.sigAlg ?? '—'}</div>
                <div className="k">Valid from</div>
                <div className="v">{cert.validFrom ?? '—'}{typeof cert.issuedDaysAgo === 'number' ? ` (${cert.issuedDaysAgo} day(s) ago)` : ''}</div>
                <div className="k">Valid to</div>
                <div className="v">{cert.validTo ?? '—'}</div>
            </div>
        ) : (
            <div className="dint-empty">No certificate data available.</div>
        )}
    </div>
);

const SslComparisonPane: React.FC<SslComparisonPaneProps> = ({ data }) => {
    const comparison = data?.sslComparison;

    if (!comparison?.available) {
        return (
            <section className="dint-card" aria-label="SSL comparison">
                <div className="dint-card-title">SSL Comparison</div>
                <div className="dint-empty">{comparison?.reason ?? 'No known brand match — nothing to compare against.'}</div>
            </section>
        );
    }

    return (
        <>
            <section className="dint-card" aria-label="SSL comparison summary">
                <div className="dint-card-title">SSL Comparison</div>
                <div className="dint-note">{comparison.explanation}</div>
                <div className="dint-note" style={{ marginTop: '8px', opacity: 0.75 }}>
                    Free/automated certificates are ubiquitous and legitimate on their own — this is one comparative signal among several, not proof by itself.
                </div>
            </section>

            <div className="dint-ssl-grid" style={{ marginTop: '12px' }}>
                <CertColumn title="Suspect Domain Certificate" cert={comparison.suspect} />
                <CertColumn title="Official Domain Certificate" cert={comparison.official} />
            </div>
        </>
    );
};

export default SslComparisonPane;
