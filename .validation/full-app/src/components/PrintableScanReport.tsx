import { createPortal } from 'react-dom';
import { Globe } from 'lucide-react';
import Markdown from 'react-markdown';
import type { AiAnalysis, DnsRecordsData, HostingCountryEntry, ScanSection, SubdomainTableRow } from '../types';
import type { OsintConsistencyReport, OsintReportEntry } from '../utils/osintReport';
import './PrintableScanReport.css';

interface PrintableScanReportProps {
    analysis: AiAnalysis | null;
    sections: ScanSection[];
    meta?: {
        target?: string;
        scanId?: number | string;
        scanDate?: string | null;
    };
    osintEntries?: OsintReportEntry[];
    osintValidation?: OsintConsistencyReport | null;
    hostingCountries?: HostingCountryEntry[];
}

function formatScanDate(value?: string | null) {
    if (!value) return 'Not Available';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}

function formatTargetLabel(target?: string) {
    if (!target) return 'Unknown Target';
    const normalized = target.trim();
    if (normalized.length <= 96) return normalized;
    return `${normalized.slice(0, 93)}...`;
}

function PrintableSectionCard({ card }: { card: ScanSection['cards'][number] }) {
    return (
        <article className={`print-report__card${card.type === 'subdomain-table' || card.type === 'dns-records' || card.type === 'domain-tree' ? ' print-report__card--full-width' : ''}`}>
            <h4 className="print-report__card-title">{card.title}</h4>
            {card.type === 'kv-list' && Array.isArray(card.data) ? (
                <dl className="print-report__kv">
                    {(card.data as Array<{ label: string; value: string }>).map((item, index) => (
                        <div className="print-report__kv-row" key={`${card.id}-${index}`}>
                            <dt>{item.label}</dt>
                            <dd>{item.value}</dd>
                        </div>
                    ))}
                </dl>
            ) : null}
            {card.type === 'tags' && Array.isArray(card.data) ? (
                <div className="print-report__tags">
                    {(card.data as Array<{ label: string }>).map((tag, index) => (
                        <span className="print-report__tag" key={`${card.id}-${index}`}>
                            {tag.label}
                        </span>
                    ))}
                </div>
            ) : null}
            {card.type === 'subdomain-table' && Array.isArray(card.data) ? (
                <div className="print-report__table-wrap">
                    <table className="print-report__table">
                        <thead>
                            <tr>
                                <th>Subdomain</th>
                                <th>IP</th>
                                <th>Provider</th>
                                <th>Country</th>
                                <th>WAF</th>
                                <th>Ports</th>
                                <th>Service</th>
                                <th>Risk</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(card.data as SubdomainTableRow[]).map((row) => (
                                <tr key={row.subdomain}>
                                    <td>{row.subdomain}</td>
                                    <td>{row.ip || '—'}</td>
                                    <td>{row.provider || '—'}</td>
                                    <td>{row.countryCode || '—'}</td>
                                    <td>{row.waf || '—'}</td>
                                    <td>{row.ports.length > 0 ? row.ports.join(', ') : '—'}</td>
                                    <td>{row.service || '—'}</td>
                                    <td>{row.riskLevel ? `${row.riskLevel}${row.riskScore != null ? ` (${row.riskScore})` : ''}` : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
            {card.type === 'dns-records' && card.data && !Array.isArray(card.data) ? (
                <div className="print-report__dns-groups">
                    {(card.data as DnsRecordsData).groups.map((group) => (
                        <div className="print-report__dns-group" key={group.type}>
                            <div className="print-report__dns-group-head">
                                <strong>{group.type}</strong> {group.description} ({group.count})
                            </div>
                            {group.records.length > 0 ? (
                                group.records.map((record, index) => (
                                    <div className="print-report__dns-record" key={index}>
                                        {record}
                                    </div>
                                ))
                            ) : (
                                <div className="print-report__dns-record print-report__dns-record--empty">No records</div>
                            )}
                        </div>
                    ))}
                </div>
            ) : null}
            {card.type === 'domain-tree' ? (
                <p className="print-report__empty">
                    Interactive graph — view it in the live scan results page. The Subdomains and DNS Records tables
                    above cover the same underlying data.
                </p>
            ) : null}
        </article>
    );
}

export default function PrintableScanReport({ analysis, sections, meta, osintEntries = [], osintValidation = null, hostingCountries = [] }: PrintableScanReportProps) {
    if (typeof document === 'undefined' || !analysis) return null;

    const printableSections = Array.isArray(sections) ? sections : [];
    const scanDateText = formatScanDate(meta?.scanDate);
    const targetText = meta?.target || 'Unknown Target';
    const targetDisplayText = formatTargetLabel(meta?.target);

    return createPortal(
        <div className="print-report-root" aria-hidden="true">
            <article className="print-report">
                <header className="print-report__header">
                    <div className="print-report__intro">
                        <div className="print-report__eyebrow">BaeSpy Security Report</div>
                        <h1 className="print-report__title">Security Executive Summary</h1>
                        <p className="print-report__subtitle">
                            Standardized print/export document for Web Check scan results.
                        </p>
                    </div>
                    <section className="print-report__target-panel">
                        <div className="print-report__target-label">Target</div>
                        <div className="print-report__target-value" title={targetText}>
                            {targetDisplayText}
                        </div>
                    </section>
                    <dl className="print-report__meta">
                        <div>
                            <dt>Scan ID</dt>
                            <dd>{meta?.scanId ?? 'Pending'}</dd>
                        </div>
                        <div>
                            <dt>Scan Date</dt>
                            <dd>{scanDateText}</dd>
                        </div>
                    </dl>
                </header>

                <section className="print-report__summary">
                    <div className="print-report__score-panel">
                        <div className="print-report__score">{analysis.threat_level ?? 0}/10</div>
                        <div className="print-report__score-label">Threat Level</div>
                    </div>
                    <div className="print-report__summary-body">
                        <h2>Executive Summary</h2>
                        <div className="print-report__markdown">
                            <Markdown>{analysis.summary || 'No summary provided.'}</Markdown>
                        </div>
                    </div>
                </section>

                <section className="print-report__analysis-grid">
                    <article className="print-report__panel">
                        <h2>Top Vulnerabilities</h2>
                        {Array.isArray(analysis.vulnerabilities) && analysis.vulnerabilities.length > 0 ? (
                            <div className="print-report__stack">
                                {analysis.vulnerabilities.map((vulnerability, index) => (
                                    <div className="print-report__item" key={`${vulnerability.title}-${index}`}>
                                        <div className="print-report__item-head">
                                            <h3>{vulnerability.title}</h3>
                                            <span>{vulnerability.severity}</span>
                                        </div>
                                        <p>{vulnerability.description}</p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="print-report__empty">No significant vulnerabilities detected.</p>
                        )}
                    </article>

                    <article className="print-report__panel">
                        <h2>Remediation Plan</h2>
                        {Array.isArray(analysis.remediation) && analysis.remediation.length > 0 ? (
                            <ol className="print-report__steps">
                                {analysis.remediation.map((step, index) => (
                                    <li key={`${step}-${index}`}>{step}</li>
                                ))}
                            </ol>
                        ) : (
                            <p className="print-report__empty">No specific remediation steps provided.</p>
                        )}
                    </article>
                </section>

                {osintEntries.length > 0 || hostingCountries.length > 0 ? (
                    <section className="print-report__section">
                        <h2>OSINT Intelligence</h2>
                        {osintValidation && (osintValidation.loadingModules.length > 0 || osintValidation.errorModules.length > 0 || osintValidation.inconsistentModules.length > 0) ? (
                            <div className="print-report__notice">
                                {osintValidation.loadingModules.length > 0 ? `Loading: ${osintValidation.loadingModules.join(', ')}. ` : ''}
                                {osintValidation.errorModules.length > 0 ? `Errors: ${osintValidation.errorModules.join(', ')}. ` : ''}
                                {osintValidation.inconsistentModules.length > 0 ? `Incomplete data: ${osintValidation.inconsistentModules.join(', ')}.` : ''}
                            </div>
                        ) : null}
                        <div className="print-report__osint-grid">
                            {osintEntries.map((entry) => (
                                <article className="print-report__panel print-report__osint-panel" key={entry.module}>
                                    <div className="print-report__item-head">
                                        <h3>{entry.icon} {entry.title}</h3>
                                        <span>{entry.risk}</span>
                                    </div>
                                    {entry.loading ? (
                                        <p className="print-report__empty">Preparing OSINT intelligence data.</p>
                                    ) : entry.error ? (
                                        <p className="print-report__empty">Failed to load: {entry.error}</p>
                                    ) : (
                                        <>
                                            {entry.validation.message ? (
                                                <div className="print-report__notice">{entry.validation.message}</div>
                                            ) : null}
                                            <div className="print-report__osint-block">
                                                <dl className="print-report__kv">
                                                    {entry.summaryRows.map((row, index) => (
                                                        <div className="print-report__kv-row" key={`${entry.module}-summary-${index}`}>
                                                            <dt>{row.label}</dt>
                                                            <dd>{row.value}</dd>
                                                        </div>
                                                    ))}
                                                </dl>
                                            </div>
                                            {entry.sourceRows.length > 0 ? (
                                                <div className="print-report__osint-block">
                                                    <dl className="print-report__kv">
                                                        {entry.sourceRows.map((row, index) => (
                                                            <div className="print-report__kv-row" key={`${entry.module}-source-${index}`}>
                                                                <dt>{row.label}</dt>
                                                                <dd>{row.value}</dd>
                                                            </div>
                                                        ))}
                                                    </dl>
                                                </div>
                                            ) : null}
                                            {entry.metricRows.length > 0 ? (
                                                <div className="print-report__osint-block">
                                                    <dl className="print-report__kv">
                                                        {entry.metricRows.map((row, index) => (
                                                            <div className="print-report__kv-row" key={`${entry.module}-metric-${index}`}>
                                                                <dt>{row.label}</dt>
                                                                <dd>{row.value}</dd>
                                                            </div>
                                                        ))}
                                                    </dl>
                                                </div>
                                            ) : null}
                                        </>
                                    )}
                                </article>
                            ))}
                            {hostingCountries.length > 0 ? (
                                <article className="print-report__panel print-report__osint-panel">
                                    <div className="print-report__item-head">
                                        <h3><Globe size={14} aria-hidden="true" /> Hosting Countries</h3>
                                        <span>{hostingCountries.length} {hostingCountries.length === 1 ? 'country' : 'countries'}</span>
                                    </div>
                                    <div className="print-report__osint-block">
                                        <dl className="print-report__kv">
                                            {hostingCountries.map((c) => (
                                                <div className="print-report__kv-row" key={c.code}>
                                                    <dt>{c.code} — {c.name}</dt>
                                                    <dd>{c.count}</dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </div>
                                </article>
                            ) : null}
                        </div>
                    </section>
                ) : null}

                {printableSections.map((section) => (
                    <section className="print-report__section" key={section.id}>
                        <h2>{section.title}</h2>
                        <div className="print-report__cards-grid">
                            {section.cards.map((card) => (
                                <PrintableSectionCard card={card} key={card.id} />
                            ))}
                        </div>
                    </section>
                ))}
            </article>
        </div>,
        document.body
    );
}
