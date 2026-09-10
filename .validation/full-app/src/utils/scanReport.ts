import type { DnsRecordGroup, DnsRecordsData, DomainTreeData, DomainTreeRecordGroup, HostingCountryEntry, KeyValueItem, ScanSection, SubdomainTableRow } from '../types';

type AnyRecord = Record<string, any>;

function asArray<T = any>(value: unknown): T[] {
    return Array.isArray(value) ? (value as T[]) : [];
}

function pickFirst<T>(...values: T[]): T | undefined {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== '') return value;
    }
    return undefined;
}

function formatDate(value: unknown) {
    if (!value) return 'Not Detected';
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function computeDomainAge(registeredDate: unknown): string {
    if (!registeredDate) return 'Not Detected';
    const reg = new Date(String(registeredDate));
    if (Number.isNaN(reg.getTime())) return 'Not Detected';
    const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
    const msPerMonth = 30.44 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - reg.getTime();
    if (elapsed < 0) return 'Not Detected';
    const years = Math.floor(elapsed / msPerYear);
    const months = Math.floor((elapsed % msPerYear) / msPerMonth);
    if (years >= 1) return `${years} yr${years !== 1 ? 's' : ''}${months > 0 ? `, ${months} mo` : ''}`;
    return `${months} month${months !== 1 ? 's' : ''}`;
}

function normalizePortResults(system: AnyRecord | null | undefined) {
    const directPorts = asArray<AnyRecord>(system?.ports);
    if (directPorts.length > 0) {
        return directPorts.map((port) => ({
            port: port?.port,
            status: port?.status,
            service: port?.service,
            dangerous: Boolean(port?.dangerous)
        }));
    }

    return asArray<AnyRecord>(system?.ports?.results).map((port) => ({
        port: port?.port,
        status: port?.status,
        service: port?.service,
        dangerous: Boolean(port?.dangerous)
    }));
}

function normalizeHeaders(source: AnyRecord, mainSystem: AnyRecord) {
    const topLevelHeaders = source.headers && typeof source.headers === 'object' ? source.headers : {};
    const topLevelSecurity = source.security && typeof source.security === 'object' ? source.security : {};
    const systemHeaders = mainSystem?.headers?.headers && typeof mainSystem.headers.headers === 'object' ? mainSystem.headers.headers : {};
    const systemSecurity = mainSystem?.headers?.security && typeof mainSystem.headers.security === 'object' ? mainSystem.headers.security : {};

    return {
        headers: { ...topLevelHeaders, ...systemHeaders },
        security: { ...topLevelSecurity, ...systemSecurity }
    };
}

const DNS_RECORD_DESCRIPTIONS: Record<string, string> = {
    A: 'IPv4 addresses',
    AAAA: 'IPv6 addresses',
    CNAME: 'Canonical name aliases',
    MX: 'Mail exchange servers',
    NS: 'Authoritative name servers',
    TXT: 'Text records (SPF, DKIM, verification)',
    SOA: 'Start of authority',
    CAA: 'Certificate authority authorization'
};

function buildDnsRecordsCard(dnsInfo: AnyRecord, domain: string): DnsRecordsData {
    // dnsInfo.a groups IPs under a single {host, ips: [...]} entry (see
    // services/dnsInfo.js); dnsInfo.aaaa is already a flat array of the same
    // enriched-IP shape. Both get flattened to bare address strings for display.
    const aHosts = asArray<AnyRecord>(dnsInfo?.a).flatMap((entry) =>
        asArray<AnyRecord>(entry?.ips).map((ip) => String(pickFirst(ip?.ip, ip) ?? '')).filter(Boolean)
    );
    const aaaaHosts = asArray<AnyRecord>(dnsInfo?.aaaa)
        .map((ip) => String(pickFirst(ip?.ip, ip) ?? ''))
        .filter(Boolean);
    const cnameRecords = asArray<string>(dnsInfo?.cname);
    const mxRecords = asArray<AnyRecord>(dnsInfo?.mx).map((m) => `${pickFirst(m?.priority, '?')} ${pickFirst(m?.exchange, m, 'Unknown')}`);
    const nsRecords = asArray<AnyRecord>(dnsInfo?.ns).map((ns) => String(pickFirst(ns?.host, ns?.value, ns) ?? '')).filter(Boolean);
    const txtRecords = asArray<string>(dnsInfo?.txt);

    const soa = dnsInfo?.soa;
    const soaLines: string[] = soa
        ? [
              `primary: ${pickFirst(soa.nsname, 'Unknown')}`,
              `hostmaster: ${pickFirst(soa.hostmaster, 'Unknown')}`,
              `serial: ${pickFirst(soa.serial, 'Unknown')}`,
              `refresh: ${soa.refresh ?? '?'}s, retry: ${soa.retry ?? '?'}s, expire: ${soa.expire ?? '?'}s, minttl: ${soa.minttl ?? '?'}s`
          ]
        : [];

    const caaLines = asArray<AnyRecord>(dnsInfo?.caa).map((rec) => {
        const tag = rec?.issue !== undefined ? 'issue' : rec?.issuewild !== undefined ? 'issuewild' : 'iodef';
        const value = String(pickFirst(rec?.issue, rec?.issuewild, rec?.iodef, ''));
        return `${rec?.critical ? 'critical ' : ''}${tag} "${value}"`;
    });

    const groups: DnsRecordGroup[] = [
        { type: 'A', description: DNS_RECORD_DESCRIPTIONS.A, count: aHosts.length, records: aHosts },
        { type: 'AAAA', description: DNS_RECORD_DESCRIPTIONS.AAAA, count: aaaaHosts.length, records: aaaaHosts },
        { type: 'CNAME', description: DNS_RECORD_DESCRIPTIONS.CNAME, count: cnameRecords.length, records: cnameRecords },
        { type: 'MX', description: DNS_RECORD_DESCRIPTIONS.MX, count: mxRecords.length, records: mxRecords },
        { type: 'NS', description: DNS_RECORD_DESCRIPTIONS.NS, count: nsRecords.length, records: nsRecords },
        { type: 'TXT', description: DNS_RECORD_DESCRIPTIONS.TXT, count: txtRecords.length, records: txtRecords },
        { type: 'SOA', description: DNS_RECORD_DESCRIPTIONS.SOA, count: soa ? 1 : 0, records: soaLines },
        { type: 'CAA', description: DNS_RECORD_DESCRIPTIONS.CAA, count: caaLines.length, records: caaLines }
    ];

    return {
        domain,
        dnssec: Boolean(dnsInfo?.dnssec),
        groups
    };
}

// "Domain Relationship Tree" data — reuses the DNS groups and subdomain rows
// already built above rather than re-deriving anything from raw scan data.
//
// The IP→subdomain branch is built from subdomainRows (every subdomain this
// scan actually resolved, each with its own real A lookup) rather than from
// dnsRecords' own "A" group, which only reflects the bare apex domain's A
// record — frequently empty even when every subdomain resolves fine (e.g.
// uptm.edu.my itself has no A record; www.uptm.edu.my etc. do). Gating the
// whole IP tree on the apex-only lookup would silently drop it whenever that
// happens, even though the real per-subdomain data is sitting right there.
//
// Every other record type (NS/MX/TXT/SOA/...) shows its own literal apex-level
// values as leaves, same as the DNS Records card above.
function buildDomainTreeData(dnsRecords: DnsRecordsData, subdomainRows: SubdomainTableRow[]): DomainTreeData {
    const ipGroups = new Map<string, SubdomainTableRow[]>();
    for (const row of subdomainRows) {
        if (!row.ip) continue;
        const list = ipGroups.get(row.ip) || [];
        list.push(row);
        ipGroups.set(row.ip, list);
    }

    const groups: DomainTreeRecordGroup[] = [];

    const totalResolvedHosts = subdomainRows.filter((r) => r.ip).length;
    if (ipGroups.size > 0) {
        groups.push({
            type: 'A',
            count: totalResolvedHosts,
            ipNodes: Array.from(ipGroups.entries()).map(([ip, rows]) => ({
                ip,
                provider: rows[0]?.provider ?? null,
                subdomains: rows.map((r) => ({
                    subdomain: r.subdomain,
                    openPorts: { label: `Open Ports (${r.ports.length})`, detail: r.ports.join(', ') || undefined },
                    service: { label: 'Service Banner', detail: r.service ?? undefined }
                }))
            }))
        });
    }

    for (const g of dnsRecords.groups) {
        if (g.count === 0 || g.type === 'A') continue;
        groups.push({ type: g.type, count: g.count, recordValues: g.records });
    }

    return { domain: dnsRecords.domain, groups };
}

function buildSecurityHeadersData(security: AnyRecord) {
    const present = (v: unknown) => (v ? 'Present' : 'Missing');
    const okIf = (v: unknown) => (v ? 'var(--accent-success)' : undefined);
    return [
        { label: 'Content-Security-Policy', value: present(security?.csp), color: okIf(security?.csp) },
        { label: 'Strict-Transport-Security', value: present(security?.hsts), color: okIf(security?.hsts) },
        { label: 'X-Frame-Options', value: String(pickFirst(security?.xFrameOptions, security?.['x-frame-options'], 'Missing')) },
        { label: 'X-Content-Type-Options', value: String(pickFirst(security?.xContentTypeOptions, security?.['x-content-type-options'], 'Missing')) },
        { label: 'Referrer-Policy', value: String(pickFirst(security?.referrerPolicy, security?.['referrer-policy'], 'Missing')) },
        { label: 'X-XSS-Protection', value: String(pickFirst(security?.xXssProtection, security?.['x-xss-protection'], 'Missing')) },
        { label: 'Permissions-Policy', value: present(security?.permissionsPolicy), color: okIf(security?.permissionsPolicy) },
        { label: 'Compression', value: String(pickFirst(security?.compression, security?.['content-encoding'], 'None')) },
        { label: 'Cache-Control', value: String(pickFirst(security?.cacheControl, security?.['cache-control'], 'Not Set')) }
    ];
}

// Blocklist states from services/threatInfo.js. A missing API key reports
// "Not Checked (Key Required)" and must stay visually distinct from "Clean".
function blocklistColor(status: unknown) {
    if (status === 'Clean') return 'var(--accent-success)';
    if (status === 'Listed') return 'var(--accent-danger)';
    return undefined; // Not Checked / Check Failed — neutral, never green
}

function buildThreatIntelData(threat: AnyRecord) {
    const blocklists = threat?.blocklists || {};
    const intel = threat?.threatIntel || {};

    if (!threat || Object.keys(threat).length === 0) {
        return [{ label: 'Threat Intelligence', value: 'Not Available' }];
    }

    const items: KeyValueItem[] = [
        {
            label: 'Reputation',
            value: String(pickFirst(intel?.reputation, 'Unknown')),
            color:
                intel?.reputation === 'Malicious' || intel?.reputation === 'Suspicious'
                    ? 'var(--accent-danger)'
                    : intel?.reputation === 'Neutral'
                        ? 'var(--accent-success)'
                        : undefined
        },
        {
            label: 'Spamhaus',
            value: String(pickFirst(blocklists?.spamhaus, 'Not Checked')),
            color: blocklistColor(blocklists?.spamhaus)
        },
        {
            label: 'AbuseIPDB',
            value:
                blocklists?.abuseIPDB === 'Clean' || blocklists?.abuseIPDB === 'Listed'
                    ? `${blocklists.abuseIPDB} (${intel?.abuseConfidenceScore ?? 0}% confidence, ${intel?.totalReports ?? 0} reports)`
                    : String(pickFirst(blocklists?.abuseIPDB, 'Not Checked')),
            color: blocklistColor(blocklists?.abuseIPDB)
        },
        {
            label: 'Google Safe Browsing',
            value: String(pickFirst(blocklists?.googleSafeBrowsing, 'Not Checked')),
            color: blocklistColor(blocklists?.googleSafeBrowsing)
        },
        { label: 'Malware', value: String(pickFirst(intel?.malware, 'Unknown')), color: intel?.malware === 'Detected' ? 'var(--accent-danger)' : undefined },
        { label: 'Phishing', value: String(pickFirst(intel?.phishing, 'Unknown')), color: intel?.phishing === 'Detected' ? 'var(--accent-danger)' : undefined }
    ];

    return items;
}

// TLS 1.0/1.1 are deprecated (RFC 8996) and flagged; 1.2/1.3 render normally.
const DEPRECATED_TLS = new Set(['TLSv1', 'TLSv1.0', 'TLSv1.1', 'SSLv2', 'SSLv3']);

function computeSslDaysRemaining(validTo: unknown): KeyValueItem {
    const label = 'Days Remaining';
    if (!validTo) return { label, value: 'Not Detected' };
    const exp = new Date(String(validTo));
    if (Number.isNaN(exp.getTime())) return { label, value: 'Not Detected' };
    const days = Math.ceil((exp.getTime() - Date.now()) / 86_400_000);
    if (days < 0) return { label, value: 'Expired', color: 'var(--accent-danger)' };
    if (days <= 14) return { label, value: `${days} days`, color: 'var(--accent-danger)' };
    if (days <= 45) return { label, value: `${days} days`, color: 'var(--accent-warning)' };
    return { label, value: `${days} days`, color: 'var(--accent-success)' };
}

function buildTlsProtocolItem(sslInfo: AnyRecord): KeyValueItem {
    const protocol = typeof sslInfo?.protocol === 'string' ? sslInfo.protocol : null;
    if (!protocol) return { label: 'TLS Version', value: 'Not Detected' };

    const deprecated = DEPRECATED_TLS.has(protocol);
    return {
        label: 'TLS Version',
        value: deprecated ? `${protocol} (Deprecated)` : protocol,
        color: deprecated ? 'var(--accent-danger)' : 'var(--accent-success)'
    };
}

function truncate(value: string, max = 48) {
    return value.length > max ? `${value.slice(0, max)}…` : value;
}

function buildEmailSecurityData(dnsInfo: AnyRecord) {
    const emailSecurity = dnsInfo?.security || {};
    const spf = typeof emailSecurity?.spf === 'string' ? emailSecurity.spf : null;
    const dmarc = typeof emailSecurity?.dmarc === 'string' ? emailSecurity.dmarc : null;
    const dkim = asArray<AnyRecord>(emailSecurity?.dkim);

    const items: KeyValueItem[] = [
        {
            label: 'SPF',
            value: spf ? `Present — ${truncate(spf)}` : 'Missing',
            color: spf ? 'var(--accent-success)' : undefined
        }
    ];

    // Surface the DMARC policy (p=reject / quarantine / none) when present —
    // it's the part that actually determines enforcement.
    const dmarcPolicy = dmarc?.match(/\bp\s*=\s*(reject|quarantine|none)\b/i)?.[1]?.toLowerCase();
    items.push({
        label: 'DMARC',
        value: dmarc ? (dmarcPolicy ? `Present — p=${dmarcPolicy}` : 'Present') : 'Missing',
        color: dmarc ? (dmarcPolicy === 'none' ? undefined : 'var(--accent-success)') : undefined
    });

    const selectors = dkim
        .map((entry) => (typeof entry?.selector === 'string' ? entry.selector : null))
        .filter((selector): selector is string => Boolean(selector));

    items.push({
        label: 'DKIM',
        value: selectors.length > 0 ? `${selectors.length} Selector${selectors.length > 1 ? 's' : ''} Found` : 'None Found',
        color: selectors.length > 0 ? 'var(--accent-success)' : undefined
    });

    if (selectors.length > 0) {
        items.push({ label: 'DKIM Selectors', value: selectors.join(', ') });
    }

    return items;
}

function buildCookieData(headers: AnyRecord) {
    const cookieHeader = headers?.['set-cookie'];
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : cookieHeader ? [cookieHeader] : [];
    const items: KeyValueItem[] = [];

    cookies
        .filter((cookie): cookie is string => typeof cookie === 'string')
        .slice(0, 4)
        .forEach((cookie) => {
            const name = cookie.split('=')[0] || 'Cookie';
            const secure = cookie.toLowerCase().includes('secure') ? 'Yes' : 'No';
            const httpOnly = cookie.toLowerCase().includes('httponly') ? 'Yes' : 'No';
            items.push({ label: name, value: `Secure: ${secure}, HttpOnly: ${httpOnly}` });
        });

    if (items.length === 0) {
        items.push({ label: 'Cookies', value: 'None Detected' });
    }

    return items;
}

// Heuristic WAF/CDN detection from the provider/org name only — this app has
// no live WAF fingerprinting, so we never claim to have detected a WAF that
// wasn't inferable from real recon data (the provider string reconPipeline.js
// already resolved for that system).
const WAF_VENDOR_PATTERNS: Array<[RegExp, string]> = [
    [/cloudflare/i, 'Cloudflare'],
    [/akamai/i, 'Akamai'],
    [/sucuri/i, 'Sucuri'],
    [/incapsula|imperva/i, 'Imperva'],
    [/fastly/i, 'Fastly'],
    [/stackpath/i, 'StackPath'],
    [/cloudfront|amazon/i, 'CloudFront']
];

function deriveWaf(provider: string | null): string | null {
    if (!provider) return null;
    for (const [pattern, label] of WAF_VENDOR_PATTERNS) {
        if (pattern.test(provider)) return label;
    }
    return null;
}

function buildSubdomainTableRows(systems: AnyRecord[]): SubdomainTableRow[] {
    const seen = new Set<string>();
    const deduped: AnyRecord[] = [];
    for (const system of systems) {
        const subdomain = typeof system?.subdomain === 'string' ? system.subdomain.trim() : '';
        if (!subdomain || seen.has(subdomain)) continue;
        seen.add(subdomain);
        deduped.push(system);
    }

    const ipCounts = new Map<string, number>();
    for (const system of deduped) {
        const ip = typeof system?.ip === 'string' ? system.ip.trim() : '';
        if (!ip) continue;
        ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
    }

    return deduped.map((system) => {
        const ip = typeof system?.ip === 'string' ? system.ip.trim() : null;
        const provider = String(pickFirst(system?.location?.org, system?.location?.isp, system?.asn, '') || '').trim() || null;
        const ports = normalizePortResults(system)
            .filter((p) => p?.status === 'open' && p.port != null)
            .map((p) => Number(p.port))
            .filter((p) => Number.isFinite(p))
            .sort((a, b) => a - b);
        const service = typeof system?.headers?.server === 'string' ? system.headers.server.trim().slice(0, 60) || null : null;

        return {
            subdomain: String(system?.subdomain || '').trim(),
            ip,
            country: system?.location?.country || null,
            countryCode: system?.location?.countryCode || null,
            provider,
            waf: deriveWaf(provider),
            ports,
            service,
            riskLevel: system?.risk?.level || null,
            riskScore: typeof system?.risk?.score === 'number' ? system.risk.score : null,
            sameIpCount: ip ? Math.max(0, (ipCounts.get(ip) || 1) - 1) : 0
        };
    });
}

// "Hosting Countries" card data — groups real per-system geolocation
// (services/reconPipeline.js `systems[].location`) by country. A system
// without a resolved countryCode is dropped rather than guessed at, so the
// count only ever reflects hosts we genuinely geolocated.
export function buildHostingCountriesData(systems: AnyRecord[]): HostingCountryEntry[] {
    const seen = new Set<string>();
    const counts = new Map<string, { name: string; count: number }>();

    for (const system of systems) {
        const subdomain = typeof system?.subdomain === 'string' ? system.subdomain.trim() : '';
        const ip = typeof system?.ip === 'string' ? system.ip.trim() : '';
        const dedupeKey = `${subdomain}|${ip}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const code = typeof system?.location?.countryCode === 'string' ? system.location.countryCode.trim().toUpperCase() : '';
        if (!code || code.length !== 2) continue;
        const name = typeof system?.location?.country === 'string' && system.location.country.trim() ? system.location.country.trim() : code;

        const existing = counts.get(code);
        if (existing) existing.count += 1;
        else counts.set(code, { name, count: 1 });
    }

    return Array.from(counts.entries())
        .map(([code, { name, count }]) => ({ code, name, count }))
        .sort((a, b) => b.count - a.count);
}

export function buildScanSections(source: AnyRecord | null | undefined): ScanSection[] {
    const data = source && typeof source === 'object' ? source : {};
    const systems = asArray<AnyRecord>(data.systems);
    const mainSystem = systems[0] || data.primarySystem || {};
    const location = mainSystem?.location || {};
    const firewall = data.firewall || {};
    const dnsInfo = data.dns || {};
    const sslInfo = data.ssl || {};
    const whois = data.whois || {};
    const crawlRules = data.crawlRules || {};
    const threat = data.threat || {};
    const securityTxt = data.securityTxt || {};
    const socialTags = data.socialTags || {};
    const { headers, security } = normalizeHeaders(data, mainSystem);

    const hostSection: ScanSection = {
        id: 'host-infrastructure',
        title: 'Host & Infrastructure',
        cards: [
            {
                id: 'server-location',
                title: 'Server Location',
                type: 'kv-list',
                data: [
                    { label: 'IP Address', value: String(pickFirst(location?.ip, mainSystem?.ip, 'Not Resolved')) },
                    { label: 'City', value: String(pickFirst(location?.city, 'Unknown City')) },
                    {
                        label: 'Country',
                        value: String(
                            pickFirst(
                                location?.country ? `${location.country}${location.countryCode ? ` ${location.countryCode}` : ''}` : undefined,
                                'Unknown Country'
                            )
                        )
                    },
                    { label: 'ISP', value: String(pickFirst(location?.isp, location?.org, 'Unknown ISP')) },
                    {
                        label: 'Scan Date',
                        value: data?.scanDate ? new Date(String(data.scanDate)).toLocaleString() : 'Unknown'
                    },
                    {
                        label: 'Scan Duration',
                        value: data?.scanDuration != null ? `${(Number(data.scanDuration) / 1000).toFixed(1)}s` : 'Unknown'
                    }
                ]
            },
            {
                id: 'firewall-waf',
                title: 'Firewall / WAF',
                type: 'kv-list',
                data: [
                    {
                        label: 'Detected',
                        value: firewall?.firewall || firewall?.firewall_detected ? 'Yes' : 'No',
                        color: firewall?.firewall || firewall?.firewall_detected ? 'var(--accent-success)' : undefined
                    },
                    { label: 'WAF', value: String(pickFirst(firewall?.waf, firewall?.waf_name, 'None')) }
                ]
            }
        ]
    };

    const openPorts = normalizePortResults(mainSystem)
        .filter((port) => port && port.status === 'open' && port.port != null)
        .map((port) => ({
            label: port.service ? `${port.port} (${port.service})` : String(port.port),
            color: port.dangerous ? 'var(--accent-danger)' : undefined
        }));

    if (openPorts.length > 0) {
        hostSection.cards.push({
            id: 'open-ports',
            title: 'Open Ports',
            type: 'tags',
            data: openPorts
        });
    }

    const domainName = String(pickFirst(data.target, mainSystem?.subdomain, '') || '');
    const dnsRecordsData = buildDnsRecordsCard(dnsInfo, domainName);
    const domainCards = [
        { id: 'dns-records', title: 'DNS Records', type: 'dns-records', data: dnsRecordsData }
    ] as ScanSection['cards'];

    const subdomainRows = buildSubdomainTableRows(systems);
    if (subdomainRows.length > 0) {
        domainCards.push({
            id: 'sub-domain',
            title: `Subdomains (${subdomainRows.length})`,
            type: 'subdomain-table',
            data: subdomainRows
        });
    }

    const domainTreeData = buildDomainTreeData(dnsRecordsData, subdomainRows);
    if (domainTreeData.groups.length > 0) {
        domainCards.push({
            id: 'domain-tree',
            title: 'Domain Relationship Tree',
            type: 'domain-tree',
            data: domainTreeData
        });
    }

    const webSection: ScanSection = {
        id: 'web-security',
        title: 'Web & Security',
        cards: [
            {
                id: 'ssl-cert',
                title: 'SSL Certificate',
                type: 'kv-list',
                data: [
                    { label: 'Issuer', value: String(pickFirst(sslInfo?.issuer?.O, sslInfo?.issuer?.CN, 'Not Detected')) },
                    { label: 'Common Name', value: String(pickFirst(sslInfo?.subject?.CN, sslInfo?.subject?.O, 'Not Detected')) },
                    { label: 'Valid From', value: formatDate(pickFirst(sslInfo?.validFrom, sslInfo?.validForm, sslInfo?.valid_from)) },
                    { label: 'Expiry Date', value: formatDate(pickFirst(sslInfo?.validTo, sslInfo?.valid_to)) },
                    computeSslDaysRemaining(pickFirst(sslInfo?.validTo, sslInfo?.valid_to)),
                    {
                        label: 'Status',
                        value: pickFirst(sslInfo?.validTo, sslInfo?.valid_to)
                            ? new Date(String(pickFirst(sslInfo?.validTo, sslInfo?.valid_to))) > new Date()
                                ? 'Valid'
                                : 'Expired/Invalid'
                            : 'Not Detected',
                        color: pickFirst(sslInfo?.validTo, sslInfo?.valid_to)
                            ? new Date(String(pickFirst(sslInfo?.validTo, sslInfo?.valid_to))) > new Date()
                                ? 'var(--accent-success)'
                                : 'var(--accent-danger)'
                            : undefined
                    },
                    buildTlsProtocolItem(sslInfo),
                    {
                        label: 'Cipher Suite',
                        value: String(
                            pickFirst(sslInfo?.cipher?.standardName, sslInfo?.cipher?.name, 'Not Detected')
                        )
                    },
                    {
                        label: 'Key Size',
                        value: sslInfo?.keyBits ? `${sslInfo.keyBits} bits` : 'Not Detected',
                        color: sslInfo?.keyBits && Number(sslInfo.keyBits) < 2048 ? 'var(--accent-danger)' : undefined
                    },
                    {
                        label: 'Signature Algorithm',
                        value: String(pickFirst(sslInfo?.sigAlg, 'Not Detected'))
                    }
                ]
            },
            {
                id: 'security-headers',
                title: 'HTTP Security Headers',
                type: 'kv-list',
                data: buildSecurityHeadersData(security)
            },
            {
                id: 'email-security',
                title: 'Email Security',
                type: 'kv-list',
                data: buildEmailSecurityData(dnsInfo)
            },
            {
                id: 'cookies',
                title: 'Cookies',
                type: 'kv-list',
                data: buildCookieData(headers)
            },
            {
                id: 'threat-intelligence',
                title: 'Threat Intelligence',
                type: 'kv-list',
                data: buildThreatIntelData(threat)
            },
            {
                id: 'http-analysis',
                title: 'HTTP Analysis',
                type: 'kv-list',
                data: [
                    {
                        label: 'HTTP Methods',
                        value: asArray<string>(mainSystem?.headers?.allowedMethods).length > 0
                            ? asArray<string>(mainSystem.headers.allowedMethods).join(', ')
                            : 'Not Detected'
                    },
                    {
                        label: 'Response Code',
                        value: mainSystem?.headers?.status != null ? String(mainSystem.headers.status) : 'Unknown'
                    },
                    {
                        label: 'Response Time',
                        value: mainSystem?.headers?.responseTimeMs != null ? `${mainSystem.headers.responseTimeMs} ms` : 'Unknown'
                    },
                    {
                        label: 'Compression',
                        value: String(
                            pickFirst(mainSystem?.headers?.security?.compression, mainSystem?.headers?.headers?.['content-encoding'], 'None')
                        )
                    },
                    {
                        label: 'Redirect Hops',
                        value: asArray(mainSystem?.headers?.redirectChain).length > 0
                            ? String(asArray(mainSystem.headers.redirectChain).length)
                            : '0 (direct)'
                    }
                ]
            }
        ]
    };

    const governanceSection: ScanSection = {
        id: 'governance',
        title: 'Governance & Discovery',
        cards: [
            {
                id: 'whois',
                title: 'Domain WHOIS',
                type: 'kv-list',
                data: [
                    { label: 'Registrar', value: String(pickFirst(whois?.registrar, 'Not Detected')) },
                    { label: 'Registered', value: String(pickFirst(whois?.registeredDate, 'Not Detected')) },
                    { label: 'Domain Age', value: computeDomainAge(whois?.registeredDate) },
                    { label: 'Expiry', value: String(pickFirst(whois?.expiryDate, 'Not Detected')) },
                    { label: 'Updated', value: String(pickFirst(whois?.updatedDate, 'Not Detected')) },
                    { label: 'Status', value: String(pickFirst(whois?.status, 'Not Detected')) }
                ]
            },
            {
                id: 'crawl-rules',
                title: 'Crawl Rules',
                type: 'kv-list',
                data: [
                    { label: 'robots.txt', value: crawlRules?.robotsTxt ? 'Present' : 'Missing' },
                    { label: 'Allowed Paths', value: asArray(crawlRules?.allowed).length > 0 ? `${asArray(crawlRules.allowed).length} Rules` : 'None' },
                    { label: 'Disallowed Paths', value: asArray(crawlRules?.disallowed).length > 0 ? `${asArray(crawlRules.disallowed).length} Rules` : 'None' },
                    { label: 'Sitemaps', value: asArray(crawlRules?.sitemaps).length > 0 ? `${asArray(crawlRules.sitemaps).length} Found` : 'None' }
                ]
            },
            {
                id: 'security-txt',
                title: 'Security.txt',
                type: 'kv-list',
                data: [
                    { label: 'File Detected', value: securityTxt?.present ? 'Yes' : 'No', color: securityTxt?.present ? 'var(--accent-success)' : undefined },
                    { label: 'Contact', value: String(pickFirst(securityTxt?.contact, 'Not Detected')) },
                    { label: 'Encryption', value: String(pickFirst(securityTxt?.encryption, 'Not Detected')) },
                    { label: 'Policy', value: String(pickFirst(securityTxt?.policy, 'Not Detected')) }
                ]
            }
        ]
    };

    const redirectChain = asArray<AnyRecord>(mainSystem?.headers?.redirectChain);
    if (redirectChain.length > 0) {
        governanceSection.cards.push({
            id: 'redirect-chain',
            title: `Redirect Chain (${redirectChain.length} hop${redirectChain.length !== 1 ? 's' : ''})`,
            type: 'kv-list',
            data: redirectChain.map((hop, i) => ({
                label: i === 0 ? 'Origin' : i === redirectChain.length - 1 ? 'Final' : `Hop ${i}`,
                value: `${hop.status}  ${hop.url}`
            }))
        });
    }

    const twitterSiteRaw = typeof socialTags?.twitterSite === 'string' ? socialTags.twitterSite.trim() : '';
    const twitterHandle = twitterSiteRaw.startsWith('@') ? twitterSiteRaw.slice(1) : twitterSiteRaw;
    const twitterHref = twitterHandle
        ? twitterHandle.startsWith('http')
            ? twitterHandle
            : `https://twitter.com/${encodeURIComponent(twitterHandle)}`
        : undefined;

    const metadataSection: ScanSection = {
        id: 'metadata',
        title: 'Metadata',
        cards: [
            {
                id: 'social-tags',
                title: 'Social Tags',
                type: 'kv-list',
                data: [
                    { label: 'OG Title', value: String(pickFirst(socialTags?.ogTitle, 'Not Detected')) },
                    {
                        label: 'OG Description',
                        value: typeof socialTags?.ogDescription === 'string' && socialTags.ogDescription.length > 50
                            ? `${socialTags.ogDescription.slice(0, 50)}...`
                            : String(pickFirst(socialTags?.ogDescription, 'Not Detected'))
                    },
                    { label: 'Twitter Card', value: String(pickFirst(socialTags?.twitterCard, 'Not Detected')) },
                    { label: 'Twitter Site', value: String(pickFirst(twitterSiteRaw, 'Not Detected')), href: twitterHref },
                    { label: 'Preview Image', value: socialTags?.image ? 'Present' : 'Not Detected' }
                ]
            }
        ]
    };

    const threatSection: ScanSection = {
        id: 'threat-reputation',
        title: 'Threat & Reputation',
        cards: [
            {
                id: 'blocklists',
                title: 'Blocklists',
                type: 'kv-list',
                data: [{ label: 'Status', value: 'Clean (Mock)' }]
            }
        ]
    };

    return [
        hostSection,
        { id: 'domain-dns', title: 'Domain & DNS', cards: domainCards },
        webSection,
        governanceSection,
        metadataSection,
        threatSection
    ];
}
