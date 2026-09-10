import React from 'react';
import type { IpIntelligenceData } from '../../../types';

interface NetworkPaneProps {
    data: IpIntelligenceData;
}

const NetworkPane: React.FC<NetworkPaneProps> = ({ data }) => {
    const ports = data?.ports;
    const results = ports?.results ?? [];
    const openPorts = results.filter((p) => p.status === 'open');

    return (
        <>
            <section className="iint-card" aria-label="Reverse DNS">
                <div className="iint-card-title">Reverse DNS (PTR)</div>
                <div className="iint-kv">
                    <div className="k">PTR record</div>
                    <div className="v">{data?.ptr ?? 'None found'}</div>
                </div>
            </section>

            <section className="iint-card" aria-label="Open ports" style={{ marginTop: '12px' }}>
                <div className="iint-card-title">Open Ports</div>
                {!ports ? (
                    <div className="iint-empty">Target did not respond — port scan unavailable.</div>
                ) : openPorts.length === 0 ? (
                    <div className="iint-empty">No open ports found across {ports.scanned_ports} scanned.</div>
                ) : (
                    <div className="iint-ports-table">
                        <div className="iint-ports-row iint-ports-row--head" role="row">
                            <div role="columnheader">Port</div>
                            <div role="columnheader">Service</div>
                            <div role="columnheader">Status</div>
                        </div>
                        {openPorts.map((p) => (
                            <div className={`iint-ports-row ${p.dangerous ? 'iint-ports-row--dangerous' : ''}`} role="row" key={p.port}>
                                <div>{p.port}</div>
                                <div>{p.service}</div>
                                <div>
                                    <span className={`pill ${p.dangerous ? 'pill--bad' : 'pill--ok'}`}>
                                        {p.dangerous ? 'Open — high risk' : 'Open'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {ports && (
                    <div className="iint-empty" style={{ marginTop: '10px' }}>
                        {ports.scanned_ports} common ports scanned · {ports.open_count} open · {ports.duration_ms}ms
                    </div>
                )}
            </section>
        </>
    );
};

export default NetworkPane;
