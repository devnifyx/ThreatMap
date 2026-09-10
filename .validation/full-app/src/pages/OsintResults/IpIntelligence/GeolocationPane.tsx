import React from 'react';
import type { IpIntelligenceData } from '../../../types';

interface GeolocationPaneProps {
    data: IpIntelligenceData;
}

const GeolocationPane: React.FC<GeolocationPaneProps> = ({ data }) => {
    const loc = data?.location;

    if (!loc) {
        return (
            <section className="iint-card" aria-label="Geolocation">
                <div className="iint-card-title">Geolocation</div>
                <div className="iint-empty">No geolocation data available.</div>
            </section>
        );
    }

    return (
        <section className="iint-card" aria-label="Geolocation">
            <div className="iint-card-title">Geolocation</div>
            <div className="iint-kv">
                <div className="k">IP</div>
                <div className="v">{loc.ip ?? '—'}</div>
                <div className="k">City</div>
                <div className="v">{loc.city ?? '—'}</div>
                <div className="k">Region</div>
                <div className="v">{loc.region ?? '—'}</div>
                <div className="k">Country</div>
                <div className="v">{loc.country ?? '—'}{loc.countryCode ? ` (${loc.countryCode})` : ''}</div>
                <div className="k">Timezone</div>
                <div className="v">{loc.timezone ?? '—'}</div>
                <div className="k">ISP</div>
                <div className="v">{loc.isp ?? '—'}</div>
                <div className="k">Organization</div>
                <div className="v">{loc.org ?? '—'}</div>
                <div className="k">ASN</div>
                <div className="v">{loc.asn ?? '—'}</div>
                <div className="k">ZIP</div>
                <div className="v">{loc.zip ?? '—'}</div>
                <div className="k">Coordinates</div>
                <div className="v">
                    {typeof loc.latitude === 'number' && typeof loc.longitude === 'number'
                        ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`
                        : '—'}
                </div>
                <div className="k">Currency</div>
                <div className="v">{loc.currency ?? '—'}</div>
            </div>
        </section>
    );
};

export default GeolocationPane;
