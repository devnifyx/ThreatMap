import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Globe, Network, ArrowUp, ArrowDown, ArrowUpDown, ExternalLink } from 'lucide-react';
import type { KeyValueItem, TagItem, CardContentType, SubdomainTableRow, DnsRecordsData, DomainTreeData } from '../types';
import DomainRelationshipTree from './DomainRelationshipTree';
import { downloadTextFile } from './shared/downloadFile';  // P1-5

interface InfoCardProps {
    title: string;
    type?: CardContentType;
    data?: KeyValueItem[] | TagItem[] | SubdomainTableRow[] | DnsRecordsData | DomainTreeData;
    customContentId?: string;
    children?: React.ReactNode;
    className?: string;
}

type SortKey = 'subdomain' | 'ip' | 'provider' | 'country' | 'risk';

function subdomainSortValue(row: SubdomainTableRow, key: SortKey): string | number {
    switch (key) {
        case 'ip':
            return row.ip || '';
        case 'provider':
            return row.provider || '';
        case 'country':
            return row.country || '';
        case 'risk':
            return row.riskScore ?? -1;
        default:
            return row.subdomain || '';
    }
}

// Cap on how many same-IP subdomains a single expanded panel will list —
// generous for a same-scan (not internet-wide) result set.
const REVERSE_IP_EXPAND_CAP = 60;

const EXPORT_COLUMNS = ['Subdomain', 'IP', 'Provider', 'Country', 'WAF', 'Ports', 'Service', 'Risk Level', 'Risk Score', 'Reverse IP Count'] as const;

function exportRowValues(row: SubdomainTableRow): (string | number)[] {
    return [
        row.subdomain,
        row.ip ?? '',
        row.provider ?? '',
        row.countryCode ?? '',
        row.waf ?? '',
        row.ports.join(' '),
        row.service ?? '',
        row.riskLevel ?? '',
        row.riskScore ?? '',
        row.sameIpCount
    ];
}

function csvEscape(value: string | number): string {
    const s = String(value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function rowsToCsv(rows: SubdomainTableRow[]): string {
    const lines = [EXPORT_COLUMNS.map(csvEscape).join(',')];
    for (const row of rows) {
        lines.push(exportRowValues(row).map(csvEscape).join(','));
    }
    return lines.join('\r\n');
}

function htmlEscape(value: string | number): string {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Excel opens an HTML table saved with a .xls extension as a real spreadsheet
// — a long-standing, widely-used trick that avoids pulling in an xlsx-writer
// dependency (the maintained npm options for that either ship known
// high-severity CVEs (`xlsx`) or drag in a vulnerable zip toolchain
// (`exceljs`'s archiver/zip-stream), neither of which is worth it for a
// client-side export button).
function rowsToExcelHtml(rows: SubdomainTableRow[]): string {
    const head = `<tr>${EXPORT_COLUMNS.map((c) => `<th>${htmlEscape(c)}</th>`).join('')}</tr>`;
    const body = rows
        .map((row) => `<tr>${exportRowValues(row).map((v) => `<td>${htmlEscape(v)}</td>`).join('')}</tr>`)
        .join('');
    return `<html><head><meta charset="UTF-8"></head><body><table border="1">${head}${body}</table></body></html>`;
}

// P1-5 — keeps this module's (content, filename, mime) shape; the anchor
// dance now lives in components/shared/downloadFile.
function downloadBlob(content: string, filename: string, mime: string) {
    downloadTextFile({ filename, text: content, mime });
}

function timestampSlug(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

const SubdomainTable: React.FC<{ rows: SubdomainTableRow[] }> = ({ rows }) => {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'subdomain', dir: 'asc' });
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [openMenu, setOpenMenu] = useState<'copy' | 'export' | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const actionsRef = useRef<HTMLDivElement>(null);

    // Real, same-scan-only grouping — see SubdomainTableRow's doc comment on
    // why this isn't an internet-wide reverse-IP lookup.
    const siblingsByIp = useMemo(() => {
        const map = new Map<string, string[]>();
        for (const row of rows) {
            if (!row.ip) continue;
            const list = map.get(row.ip) || [];
            list.push(row.subdomain);
            map.set(row.ip, list);
        }
        return map;
    }, [rows]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        const base = !q
            ? rows
            : rows.filter((r) => {
                  const haystack = [r.subdomain, r.ip, r.provider, r.country, r.countryCode, ...r.ports.map(String)]
                      .filter(Boolean)
                      .join(' ')
                      .toLowerCase();
                  return haystack.includes(q);
              });

        const sorted = [...base].sort((a, b) => {
            const av = subdomainSortValue(a, sort.key);
            const bv = subdomainSortValue(b, sort.key);
            const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
            return sort.dir === 'asc' ? cmp : -cmp;
        });
        return sorted;
    }, [rows, query, sort]);

    const toggleSort = (key: SortKey) => {
        setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    };

    const sortIndicator = (key: SortKey) =>
        sort.key === key
            ? (sort.dir === 'asc' ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />)
            : <ArrowUpDown size={11} aria-hidden="true" />;

    const toggleExpanded = (key: string) => setExpandedKey((prev) => (prev === key ? null : key));

    const hasReverseIpData = useMemo(() => {
        for (const list of siblingsByIp.values()) {
            if (list.length > 1) return true;
        }
        return false;
    }, [siblingsByIp]);

    useEffect(() => {
        if (!openMenu) return;
        const handleClick = (e: MouseEvent) => {
            if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) setOpenMenu(null);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [openMenu]);

    useEffect(() => {
        if (!feedback) return;
        const timer = setTimeout(() => setFeedback(null), 1800);
        return () => clearTimeout(timer);
    }, [feedback]);

    // Copy/export operate on whatever's currently filtered — "what I'm
    // looking at", not silently the full unfiltered set.
    const copySubdomains = async () => {
        setOpenMenu(null);
        try {
            await navigator.clipboard.writeText(filtered.map((r) => r.subdomain).join('\n'));
            setFeedback(`Copied ${filtered.length} subdomain${filtered.length === 1 ? '' : 's'}`);
        } catch {
            setFeedback('Copy failed — clipboard unavailable');
        }
    };

    const copyIps = async () => {
        setOpenMenu(null);
        const ips = Array.from(new Set(filtered.map((r) => r.ip).filter((ip): ip is string => Boolean(ip))));
        try {
            await navigator.clipboard.writeText(ips.join('\n'));
            setFeedback(`Copied ${ips.length} IP address${ips.length === 1 ? '' : 'es'}`);
        } catch {
            setFeedback('Copy failed — clipboard unavailable');
        }
    };

    const exportJson = () => {
        setOpenMenu(null);
        downloadBlob(JSON.stringify(filtered, null, 2), `subdomains-${timestampSlug()}.json`, 'application/json');
    };

    const exportCsv = () => {
        setOpenMenu(null);
        downloadBlob(rowsToCsv(filtered), `subdomains-${timestampSlug()}.csv`, 'text/csv');
    };

    const exportExcel = () => {
        setOpenMenu(null);
        downloadBlob(rowsToExcelHtml(filtered), `subdomains-${timestampSlug()}.xls`, 'application/vnd.ms-excel');
    };

    return (
        <div className="subdomain-table-wrap">
            <div className="subdomain-table-actions-row">
                {feedback && <span className="subdomain-table-feedback">{feedback}</span>}
                <div className="subdomain-table-actions" ref={actionsRef}>
                    <div className="subdomain-table-dropdown">
                        <button
                            type="button"
                            className="subdomain-table-action-btn"
                            onClick={() => setOpenMenu((m) => (m === 'copy' ? null : 'copy'))}
                            aria-expanded={openMenu === 'copy'}
                        >
                            <span aria-hidden="true">⧉</span> Copy <span aria-hidden="true">▾</span>
                        </button>
                        {openMenu === 'copy' && (
                            <div className="subdomain-table-menu" role="menu">
                                <button type="button" role="menuitem" onClick={copySubdomains}>
                                    <Globe size={14} aria-hidden="true" /> Subdomains
                                </button>
                                <button type="button" role="menuitem" onClick={copyIps}>
                                    <Network size={14} aria-hidden="true" /> IP Addresses
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="subdomain-table-dropdown">
                        <button
                            type="button"
                            className="subdomain-table-action-btn"
                            onClick={() => setOpenMenu((m) => (m === 'export' ? null : 'export'))}
                            aria-expanded={openMenu === 'export'}
                        >
                            <span aria-hidden="true">⭳</span> Export <span aria-hidden="true">▾</span>
                        </button>
                        {openMenu === 'export' && (
                            <div className="subdomain-table-menu" role="menu">
                                <button type="button" role="menuitem" onClick={exportJson}>
                                    <span aria-hidden="true">{'{ }'}</span> Export JSON
                                </button>
                                <button type="button" role="menuitem" onClick={exportCsv}>
                                    <span aria-hidden="true">▤</span> Export CSV
                                </button>
                                <button type="button" role="menuitem" onClick={exportExcel}>
                                    <span aria-hidden="true">▦</span> Export Excel
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="subdomain-table-toolbar">
                <input
                    type="text"
                    className="subdomain-table-filter"
                    placeholder="Filter by subdomain, IP, provider, country, port…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Filter subdomains"
                />
                <span className="subdomain-table-count">
                    {filtered.length} of {rows.length}
                </span>
            </div>
            {hasReverseIpData && (
                <div className="subdomain-table-tip">
                    Tip: click an IP or its Reverse IP badge to see other subdomains from this scan sharing it.
                </div>
            )}
            <div className="subdomain-table-scroll">
                <table className="subdomain-table">
                    <colgroup>
                        <col style={{ width: '16%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '5%' }} />
                        <col style={{ width: '9%' }} />
                        <col style={{ width: '14%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '8%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '6%' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th onClick={() => toggleSort('subdomain')}>Subdomain {sortIndicator('subdomain')}</th>
                            <th onClick={() => toggleSort('ip')}>IP {sortIndicator('ip')}</th>
                            <th>Visit</th>
                            <th>
                                <span className="subdomain-table-th-inner">
                                    Reverse IP
                                    <span
                                        className="subdomain-table-info"
                                        data-tip="Other subdomains from THIS SCAN sharing this IP address — not an internet-wide reverse-IP lookup. Shared hosting/CDNs produce long lists; a short list on a dedicated IP is the more interesting signal."
                                        tabIndex={0}
                                        role="note"
                                        aria-label="Reverse IP scope explanation"
                                    >
                                        ⓘ
                                    </span>
                                </span>
                            </th>
                            <th onClick={() => toggleSort('provider')}>Provider {sortIndicator('provider')}</th>
                            <th onClick={() => toggleSort('country')}>Country {sortIndicator('country')}</th>
                            <th>WAF</th>
                            <th>Ports</th>
                            <th>Service</th>
                            <th onClick={() => toggleSort('risk')}>Risk {sortIndicator('risk')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="subdomain-table-empty">
                                    No subdomains match “{query}”.
                                </td>
                            </tr>
                        ) : (
                            filtered.map((row) => {
                                const siblings = row.ip ? (siblingsByIp.get(row.ip) || []).filter((s) => s !== row.subdomain) : [];
                                const isExpandable = siblings.length > 0;
                                const isExpanded = isExpandable && expandedKey === row.subdomain;
                                return (
                                    <React.Fragment key={row.subdomain}>
                                        <tr className={isExpanded ? 'subdomain-table-row--active' : ''}>
                                            <td className="subdomain-table-cell-mono subdomain-table-cell-subdomain" title={row.subdomain}>{row.subdomain}</td>
                                            <td
                                                className={`subdomain-table-cell-mono${isExpandable ? ' subdomain-table-cell-ip' : ''}`}
                                                onClick={isExpandable ? () => toggleExpanded(row.subdomain) : undefined}
                                                title={isExpandable ? 'Click to view other subdomains on this IP' : undefined}
                                            >
                                                {row.ip || '—'}
                                            </td>
                                            <td>
                                                {row.subdomain && (
                                                    <a
                                                        href={`https://${row.subdomain}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="subdomain-table-visit"
                                                        aria-label={`Visit ${row.subdomain}`}
                                                        title={`Visit https://${row.subdomain}`}
                                                    >
                                                        <ExternalLink size={13} aria-hidden="true" />
                                                    </a>
                                                )}
                                            </td>
                                            <td>
                                                {isExpandable ? (
                                                    <button
                                                        type="button"
                                                        className={`subdomain-table-badge subdomain-table-badge--muted subdomain-table-badge--clickable${isExpanded ? ' subdomain-table-badge--active' : ''}`}
                                                        onClick={() => toggleExpanded(row.subdomain)}
                                                        aria-expanded={isExpanded}
                                                        title={`Also on this IP (this scan): ${siblings.join(', ')}`}
                                                    >
                                                        +{siblings.length}
                                                    </button>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="subdomain-table-cell-truncate" title={row.provider || ''}>
                                                {row.provider || '—'}
                                            </td>
                                            <td>
                                                {row.countryCode ? (
                                                    <span title={row.country || row.countryCode}>{row.countryCode}</span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td>
                                                {row.waf ? <span className="subdomain-table-badge subdomain-table-badge--waf">{row.waf}</span> : '—'}
                                            </td>
                                            <td>
                                                {row.ports.length > 0 ? (
                                                    <div className="subdomain-table-ports">
                                                        {row.ports.slice(0, 6).map((p) => (
                                                            <span className="subdomain-table-port" key={p}>
                                                                {p}
                                                            </span>
                                                        ))}
                                                        {row.ports.length > 6 && (
                                                            <span className="subdomain-table-port subdomain-table-port--more">
                                                                +{row.ports.length - 6}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                            <td className="subdomain-table-cell-truncate" title={row.service || ''}>
                                                {row.service || '—'}
                                            </td>
                                            <td>
                                                {row.riskLevel ? (
                                                    <span className={`subdomain-table-badge subdomain-table-risk-${row.riskLevel.toLowerCase()}`}>
                                                        {row.riskLevel}
                                                        {row.riskScore != null ? ` ${row.riskScore}` : ''}
                                                    </span>
                                                ) : (
                                                    '—'
                                                )}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="subdomain-table-expand-row">
                                                <td colSpan={10}>
                                                    <div className="subdomain-table-expand-summary">
                                                        Showing {Math.min(siblings.length + 1, REVERSE_IP_EXPAND_CAP)} of {siblings.length + 1} domains on{' '}
                                                        <span className="subdomain-table-cell-mono">{row.ip}</span>{' '}
                                                        <span className="subdomain-table-expand-scope">(this scan)</span>
                                                    </div>
                                                    <div className="subdomain-table-expand-grid">
                                                        {[row.subdomain, ...siblings].slice(0, REVERSE_IP_EXPAND_CAP).map((name) => (
                                                            <span
                                                                className={`subdomain-table-pill${name === row.subdomain ? ' subdomain-table-pill--self' : ''}`}
                                                                key={name}
                                                            >
                                                                {name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const DnsRecordsCard: React.FC<{ data: DnsRecordsData }> = ({ data }) => {
    const recordTypeList = data.groups.map((g) => g.type).join(', ');

    return (
        <div className="dns-records-wrap">
            <div className="dns-records-meta">
                <span className="dns-records-meta-types">
                    {recordTypeList} for <span className="dns-records-meta-domain">{data.domain || 'this target'}</span>
                </span>
                <span className={`dns-records-dnssec ${data.dnssec ? 'dns-records-dnssec--on' : 'dns-records-dnssec--off'}`}>
                    DNSSEC {data.dnssec ? 'Enabled' : 'Not Detected'}
                </span>
            </div>
            <div className="dns-records-groups">
                {data.groups.map((group) => (
                    <div className="dns-group" key={group.type}>
                        <div className="dns-group-header">
                            <span className="dns-group-badge">{group.type}</span>
                            <span className="dns-group-desc">{group.description}</span>
                            <span className="dns-group-count">{group.count}</span>
                        </div>
                        {group.records.length > 0 ? (
                            <div className="dns-group-records">
                                {group.records.map((record, idx) => (
                                    <div className="dns-group-record" key={idx}>
                                        {record}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="dns-group-empty">No records</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

const InfoCard: React.FC<InfoCardProps> = ({ title, type, data, customContentId, children, className = '' }) => {

    const renderContent = () => {
        if (children) return children;

        if (type === 'subdomain-table' && Array.isArray(data)) {
            return <SubdomainTable rows={data as SubdomainTableRow[]} />;
        }

        if (type === 'dns-records' && data && !Array.isArray(data)) {
            return <DnsRecordsCard data={data as DnsRecordsData} />;
        }

        if (type === 'domain-tree' && data && !Array.isArray(data)) {
            return <DomainRelationshipTree data={data as DomainTreeData} title={title} />;
        }

        if (type === 'kv-list' && Array.isArray(data)) {
            const items = data as KeyValueItem[];
            return (
                <ul className="kv-list">
                    {items.map((item, idx) => (
                        <li key={idx} className="kv-item">
                            <span className="kv-label">{item.label}</span>
                            {item.href ? (
                                <a
                                    className="kv-value kv-link"
                                    href={item.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={item.color ? { color: item.color } : {}}
                                >
                                    {item.value}
                                </a>
                            ) : (
                                <span className="kv-value" style={item.color ? { color: item.color } : {}}>
                                    {item.value}
                                </span>
                            )}
                        </li>
                    ))}
                </ul>
            );
        }

        if (type === 'tags' && Array.isArray(data)) {
            const tags = data as TagItem[];
            return (
                <div className="tags-container">
                    {tags.map((tag, idx) => (
                        <span key={idx} className="tag-badge" style={tag.color ? { backgroundColor: tag.color + '40', color: tag.color, border: `1px solid ${tag.color}` } : {}}>
                            {tag.label}
                        </span>
                    ))}
                </div>
            );
        }

        if (type === 'custom') {
            if (customContentId === 'map') {
                return <div className="placeholder-map">Map Visualization (Coming Soon)</div>;
            }
             if (customContentId === 'raw-json') {
                return <pre className="raw-json">{JSON.stringify(data, null, 2)}</pre>;
            }
            return <div className="placeholder-custom">Custom Content: {customContentId}</div>;
        }

        return null;
    };

    // The domain-tree card owns its own collapsible header (title + subtitle +
    // chevron in one bar) — the generic header above it would just duplicate
    // the title.
    if (type === 'domain-tree') {
        return <div className={`info-card info-card--flush ${className}`}>{renderContent()}</div>;
    }

    return (
        <div className={`info-card${type === 'subdomain-table' ? ' info-card--subdomains' : ''} ${className}`}>
            <div className="info-card-header">
                <h3>{title}</h3>
            </div>
            <div className="info-card-content">
                {renderContent()}
            </div>
        </div>
    );
};

export default InfoCard;
