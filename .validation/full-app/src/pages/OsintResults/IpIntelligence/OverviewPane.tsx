import React from 'react';
import type { IpIntelligenceData } from '../../../types';

interface OverviewPaneProps {
    data: IpIntelligenceData;
    risk?: string;
}

const OverviewPane: React.FC<OverviewPaneProps> = ({ data, risk }) => {
    const loc = data?.location;
    const openCount = data?.ports?.open_count;
    const dangerousOpen = data?.ports?.results?.filter((p) => p.status === 'open' && p.dangerous) ?? [];

    return (
        <>
            <section className="iint-card" aria-label="Overview">
                <div className="iint-card-title-row">
                    <div className="iint-card-title">Overview</div>
                    {risk && <span className="risk-badge" data-risk={risk}>{risk}</span>}
                </div>
                <div className="iint-kv">
                    <div className="k">IP</div>
                    <div className="v">{data?.ip ?? '—'}</div>
                    {data?.resolvedFrom && (
                        <>
                            <div className="k">Resolved from</div>
                            <div className="v">{data.resolvedFrom}</div>
                        </>
                    )}
                    <div className="k">ASN / Org</div>
                    <div className="v">{loc?.asn ?? loc?.org ?? '—'}</div>
                    <div className="k">Location</div>
                    <div className="v">{[loc?.city, loc?.country].filter(Boolean).join(', ') || '—'}</div>
                    <div className="k">Scan duration</div>
                    <div className="v">{typeof data?.scanDuration === 'number' ? `${(data.scanDuration / 1000).toFixed(1)}s` : '—'}</div>
                </div>
            </section>

            {data?.limitedVisibility && (
                <section className="iint-card iint-card--limited" aria-label="Limited visibility notice" style={{ marginTop: '12px' }}>
                    <div className="iint-note">
                        Limited visibility — reputation checks were unavailable (no API keys configured) and no
                        dangerous ports were found open. This is not a verified-clean result.
                    </div>
                </section>
            )}

            <section className="iint-card" aria-label="Summary" style={{ marginTop: '12px' }}>
                <div className="iint-card-title">Summary</div>
                <div className="iint-note">
                    {data?.ip ?? 'This target'}
                    {typeof openCount === 'number' ? ` has ${openCount} open port(s)` : ''}
                    {dangerousOpen.length
                        ? `, including ${dangerousOpen.length} flagged as high-risk (${dangerousOpen.map((p) => p.service).join(', ')}).`
                        : '.'}
                    {loc?.org ? ` Hosted by ${loc.org}.` : ''}
                </div>
            </section>
        </>
    );
};

export default OverviewPane;
