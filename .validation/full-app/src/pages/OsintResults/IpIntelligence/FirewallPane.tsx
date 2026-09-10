import React from 'react';
import type { IpIntelligenceData } from '../../../types';

interface FirewallPaneProps {
    data: IpIntelligenceData;
}

const FirewallPane: React.FC<FirewallPaneProps> = ({ data }) => {
    const fw = data?.firewall;

    if (!fw) {
        return (
            <section className="iint-card" aria-label="Firewall detection">
                <div className="iint-card-title">Firewall / WAF Detection</div>
                <div className="iint-empty">No firewall data available.</div>
            </section>
        );
    }

    if (fw.error === 'Connection failed') {
        return (
            <section className="iint-card" aria-label="Firewall detection">
                <div className="iint-card-title">Firewall / WAF Detection</div>
                <div className="iint-empty">Not applicable — target does not respond to HTTP.</div>
            </section>
        );
    }

    return (
        <section className="iint-card" aria-label="Firewall detection">
            <div className="iint-card-title">Firewall / WAF Detection</div>
            <div className="iint-kv">
                <div className="k">WAF detected</div>
                <div className="v">
                    <span className={`pill ${fw.firewall ? 'pill--ok' : ''}`}>{fw.firewall ? 'Yes' : 'No'}</span>
                </div>
                {fw.waf && (
                    <>
                        <div className="k">Vendor</div>
                        <div className="v">{fw.waf}</div>
                    </>
                )}
                {fw.confidence && (
                    <>
                        <div className="k">Confidence</div>
                        <div className="v">{fw.confidence}</div>
                    </>
                )}
            </div>

            {fw.headers_checked && fw.headers_checked.length > 0 && (
                <div className="iint-note" style={{ marginTop: '10px' }}>
                    Headers checked: {fw.headers_checked.join(', ')}
                </div>
            )}
        </section>
    );
};

export default FirewallPane;
