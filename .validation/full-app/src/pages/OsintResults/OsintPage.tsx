import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
    Mail, Compass, CheckCircle, Search, ShieldAlert, Globe, Star, Bot, UserSearch, AlertTriangle,
    Smartphone, Users, ExternalLink, KeyRound, SearchCode, LayoutDashboard, Crosshair, Network,
    Building2, Share2, EyeOff, FileText, Image, ShieldCheck, Send
} from 'lucide-react';
import './OsintPage.css';
import { addSearchHistory } from '../../services/searchHistory';
import { getOsintData, getUserPreferences } from '../../services/api';
import JsonViewer from '../../components/JsonViewer';
import PillarSubnav from '../../components/PillarSubnav';
import OsintPlaceholderPane from '../../components/OsintPlaceholderPane';
import UsernameIntelligenceResult from './UsernameIntelligence/UsernameIntelligenceResult';
import DomainIntelligenceResult from './DomainIntelligence/DomainIntelligenceResult';
import IpIntelligenceResult from './IpIntelligence/IpIntelligenceResult';
import BrandIntelligenceHome from './BrandIntelligence/BrandIntelligenceHome';
import InvestigationDashboardHome from './InvestigationDashboard/InvestigationDashboardHome';
import TargetManagementHome from './TargetManagement/TargetManagementHome';
import CompanyIntelligenceHome from './CompanyIntelligence/CompanyIntelligenceHome';
import SocialMediaIntelligenceHome from './SocialMediaIntelligence/SocialMediaIntelligenceHome';
import ImageIntelligenceHome from './ImageIntelligence/ImageIntelligenceHome';
import DocumentIntelligenceHome from './DocumentIntelligence/DocumentIntelligenceHome';
// TELEGRAM_INTELLIGENCE_PHASE4.md §1/§2 — Telegram Intelligence's own entry
// point, moved out of Social Media Intelligence's investigation pillars.
import TelegramIntelligenceHome from './TelegramIntelligence/TelegramIntelligenceHome';
// DARK_WEB_PHASE1.md — own entry flow (source/observation workspace, not a
// scan-target field). Replaces the former "planned for a future update" placeholder.
import DarkWebIntelligenceHome from './DarkWebIntelligence/DarkWebIntelligenceHome';
// CREDENTIAL_LEAK_PHASE1.md §67/§68 — own entry flow (Watchlist Domain
// selection, not an email scan-target field). Replaces the former
// email-first "Credential Leak" workflow as the primary entry point; the
// legacy email lookup is kept but relabeled (§60/§61, see 'leak' below).
import CredentialLeakIntelligenceHome from './CredentialLeakIntelligence/CredentialLeakIntelligenceHome';
import { PHONE_CODES } from '../../constants/phoneCodes';
import { deriveUsernameFromEmail, deriveUsernameFromPhone } from '../../utils/usernameCandidates';
import { downloadBlob } from '../../components/shared/downloadFile';  // P1-5 — was open-coded here

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// activeSection (this page's own module id, OSINT_NAV_INTEGRATION.md — a
// controlled prop, not local state, now that the sidebar lives in AppShell)
// → backend module slug, as sent to
// GET /api/osint/:module and consequently what ends up stored in
// osint_activity.module. Single source of truth — handleScan() below and
// INVESTIGATION_DASHBOARD.md §7b's "Continue Investigation" routing both
// read this same object rather than each keeping their own copy. Web-Check's
// own scan pipeline (ScanResultsPage.tsx) writes additional osint_activity
// rows for modules that have no OsintPage tab at all (e.g. 'alias-finder',
// 'geo-spy', 'asset-radar', 'code-hunter') — those rows correctly have no
// reverse entry here, since there's nowhere on this page to route them back
// to.
const OSINT_TAB_TO_BACKEND_MODULE: Record<string, string> = {
    'phishing':     'phishing-detect',
    'email':        'email-intelligence',
    'phone':        'phone-investigator',
    'social':       'username-intelligence',
    'name':         'name-checker',
    'leak':         'leak-check',
    'dorking':      'google-dorking',
    'domain-intel': 'domain-intelligence',
    'ip-intel':     'ip-intelligence',
};



// NameChecker results are RANKED CANDIDATES from a broad name search, not a
// confirmed identity check like Username Checker's Verified/Not Found states
// — deliberately distinct markup/classes so the two are never visually
// confused (a candidate here could be a different person who shares the name).
const NameCandidateRow = React.memo(({ c }: { c: any }) => {
    const label = typeof c?.confidenceLabel === 'string' ? c.confidenceLabel : 'Low';
    return (
        <a
            className="namecheck-candidate"
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open candidate profile: ${c.displayName}`}
        >
            <div className="namecheck-candidate-head">
                <span className="namecheck-candidate-name">{c.displayName || c.url}</span>
                {c.matchedType && <span className="namecheck-candidate-type">{c.matchedType}</span>}
                <span className={`namecheck-confidence namecheck-confidence--${label.toLowerCase()}`}>
                    {label} confidence
                </span>
            </div>
            {c.snippet && <p className="namecheck-candidate-snippet">{c.snippet}</p>}
            <span className="namecheck-candidate-url">{c.url} <ExternalLink size={12} /></span>
        </a>
    );
});

NameCandidateRow.displayName = 'NameCandidateRow';

const NamePlatformGroup = React.memo(({ platform, candidates }: { platform: string; candidates: any[] }) => {
    const list = Array.isArray(candidates) ? candidates : [];
    return (
        <div className="namecheck-group" data-empty={list.length === 0} role="listitem">
            <div className="namecheck-group-header">
                <span className="namecheck-group-platform">{platform}</span>
                <span className="namecheck-group-count">
                    {list.length > 0 ? `${list.length} candidate${list.length > 1 ? 's' : ''}` : 'No candidates found'}
                </span>
            </div>
            {list.length > 0 && (
                <div className="namecheck-candidate-list">
                    {list.map((c: any) => (
                        <NameCandidateRow key={c.url} c={c} />
                    ))}
                </div>
            )}
        </div>
    );
});

NamePlatformGroup.displayName = 'NamePlatformGroup';

const DorkingCard = React.memo(({ query }: { query: any }) => (
    <div className="dork-card">
        <div className="dork-info">
            <h4>{query.name}</h4>
            <p>{query.description}</p>
            <code className="dork-query">{query.query}</code>
        </div>
        <div className="dork-actions">
            <button
                type="button"
                className="dork-btn"
                onClick={() => navigator.clipboard.writeText(query.query).catch(() => {})}
                aria-label={`Copy dork query: ${query.name}`}
            >
                Copy
            </button>
            <a
                href={query.google_url}
                target="_blank"
                rel="noopener noreferrer"
                className="dork-link"
                aria-label={`Open Google search for: ${query.name}`}
            >
                Launch ↗
            </a>
        </div>
    </div>
));

DorkingCard.displayName = 'DorkingCard';

const formatBool = (value: any) => {
    if (value === true) return 'Yes';
    if (value === false) return 'No';
    return 'Unknown';
};

// Cross-module pivot INTO Social Media Intelligence (SOCIALMEDIA_PHASE1.md's
// own username-only discovery — Maigret/Sherlock/Social Analyzer search by
// username, never by email or phone directly, so there is no honest way to
// "search by email/phone" there). deriveUsernameFromEmail/Phone (shared with
// Social Media Intelligence's own Email/Phone search mode — see
// utils/usernameCandidates.ts) produce a real, clearly-labeled CANDIDATE
// username, exactly the same "derived, not confirmed" framing this app
// already uses everywhere else (Observed Display Name Match, Potential Name
// Relationship, etc.) — never presented as if it were the subject's
// confirmed handle. Only pre-fills the search box (prefillValue); the
// analyst still has to click Investigate themselves.

const PhoneResult = React.memo(({ data, onNavigateToModule }: { data: any; onNavigateToModule?: (moduleId: string, targetValue?: string) => void }) => {
    const e164 = typeof data?.e164 === 'string' ? data.e164 : null;
    const possible = data?.possible;
    const valid = data?.valid;
    const type = typeof data?.line_type === 'string' ? data.line_type : null;
    const country = typeof data?.country === 'string' ? data.country : null;
    const callingCode = typeof data?.calling_code === 'string' ? data.calling_code : null;
    const intl = typeof data?.format_international === 'string' ? data.format_international : null;
    const national = typeof data?.format_national === 'string' ? data.format_national : null;
    const carrier = typeof data?.carrier === 'string' ? data.carrier : null;
    const carrierSource = typeof data?.carrier_source === 'string' ? data.carrier_source : null;
    const timeZones = Array.isArray(data?.time_zones) ? data.time_zones.filter((v: any) => typeof v === 'string') : [];
    const description = typeof data?.description === 'string' ? data.description : null;
    const whatsapp = data?.whatsapp_registered;
    const telegram = data?.telegram_registered;
    const [showCarrierHelp, setShowCarrierHelp] = useState(false);

    const pillClass = (v: any) => (v === true ? 'pill pill--ok' : v === false ? 'pill pill--bad' : 'pill');
    const carrierLabel = carrier && carrierSource === 'prefix_heuristic' ? `${carrier} (inferred)` : carrier;
    const phoneUsernameCandidate = deriveUsernameFromPhone(e164);

    return (
        <div className="phone-result" aria-label="Phone investigation results">
            <div className="phone-result-grid">
                <section className="phone-card" aria-label="Phone number details">
                    <div className="phone-card-title">Number</div>
                    <div className="phone-kv">
                        <div className="k">E.164</div>
                        <div className="v">{e164 ?? '—'}</div>
                        <div className="k">International</div>
                        <div className="v">{intl ?? '—'}</div>
                        <div className="k">National</div>
                        <div className="v">{national ?? '—'}</div>
                    </div>
                </section>

                <section className="phone-card" aria-label="Validation results">
                    <div className="phone-card-title">Validation</div>
                    <div className="phone-kv">
                        <div className="k">Possible</div>
                        <div className="v">
                            <span className={pillClass(possible)}>{formatBool(possible)}</span>
                        </div>
                        <div className="k">Valid</div>
                        <div className="v">
                            <span className={pillClass(valid)}>{formatBool(valid)}</span>
                        </div>
                        <div className="k">Type</div>
                        <div className="v">{type ?? 'Unknown'}</div>
                    </div>
                </section>

                <section className="phone-card" aria-label="Region and calling code">
                    <div className="phone-card-title">Region</div>
                    <div className="phone-kv">
                        <div className="k">Country (ISO)</div>
                        <div className="v">{country ?? '—'}</div>
                        <div className="k">Calling Code</div>
                        <div className="v">{callingCode ? `+${callingCode}` : '—'}</div>
                        <div className="k">
                            Carrier
                            <button
                                type="button"
                                className="info-icon"
                                aria-label="Carrier info"
                                aria-expanded={showCarrierHelp}
                                onClick={() => setShowCarrierHelp((v) => !v)}
                                onBlur={() => setShowCarrierHelp(false)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') setShowCarrierHelp(false);
                                }}
                            >
                                i
                            </button>
                            {showCarrierHelp && (
                                <div className="info-tooltip" role="tooltip">
                                    Carrier is best-effort from an offline dataset or prefix inference. It may be unavailable or incorrect for ported numbers (MNP) or unsupported ranges.
                                </div>
                            )}
                        </div>
                        <div className="v">{carrierLabel ?? '—'}</div>
                        <div className="k">Time Zones</div>
                        <div className="v">{timeZones.length ? timeZones.join(', ') : '—'}</div>
                        <div className="k">Description</div>
                        <div className="v">{description ?? '—'}</div>
                        <div className="k">WhatsApp</div>
                        <div className="v">{whatsapp == null ? 'Not verified by this module' : whatsapp ? 'Yes' : 'No'}</div>
                        <div className="k">Telegram</div>
                        <div className="v">{telegram == null ? 'Not verified by this module' : telegram ? 'Yes' : 'No'}</div>
                    </div>
                    {phoneUsernameCandidate && (
                        <button
                            type="button" className="export-btn" style={{ marginTop: '10px' }}
                            onClick={() => onNavigateToModule?.('social-media-intel', phoneUsernameCandidate)}
                            title="Pre-fills Social Media Intelligence's username search with this number's digits as a candidate — phone numbers are rarely used as real handles, so this is a weak starting guess the analyst must confirm, not a match."
                        >
                            Search Social Media (candidate username)
                        </button>
                    )}
                </section>

                <section className="phone-card" aria-label="Privacy note">
                    <div className="phone-card-title">Note</div>
                    <div className="phone-note">
                        Location, owner identity, and real-time tracking are not available from a phone number alone. WhatsApp and Telegram registration are not verified by this module without a compliant external provider.
                    </div>
                </section>
            </div>
        </div>
    );
});

PhoneResult.displayName = 'PhoneResult';

// source (malware/combo) × data-type (password/cookie/pii) grid — the actual
// signal ParanoidLab provides that a flat breach list didn't: which kind of
// data leaked, through which kind of source, and when it was last seen.
const BREAKDOWN_SOURCES: { key: 'malware' | 'combo'; label: string }[] = [
    { key: 'malware', label: 'Malware' },
    { key: 'combo', label: 'Combo' }
];
const BREAKDOWN_TYPES: { key: 'password' | 'cookie' | 'pii'; label: string }[] = [
    { key: 'password', label: 'Password' },
    { key: 'cookie', label: 'Cookie' },
    { key: 'pii', label: 'PII' }
];

const LeakBreakdownTable = React.memo(({ breakdown }: { breakdown: any }) => (
    <div className="leak-breakdown" role="table" aria-label="Exposure breakdown by source and data type">
        <div className="leak-breakdown-row leak-breakdown-row--head" role="row">
            <span className="leak-breakdown-cell leak-breakdown-cell--corner" role="columnheader" />
            {BREAKDOWN_TYPES.map((t) => (
                <span className="leak-breakdown-cell leak-breakdown-cell--head" role="columnheader" key={t.key}>
                    {t.label}
                </span>
            ))}
        </div>
        {BREAKDOWN_SOURCES.map((s) => (
            <div className="leak-breakdown-row" role="row" key={s.key}>
                <span className="leak-breakdown-cell leak-breakdown-cell--rowhead" role="rowheader">
                    {s.label}
                </span>
                {BREAKDOWN_TYPES.map((t) => {
                    // combo has no "cookie" bucket at all — distinct from a
                    // populated-but-zero bucket, shown as "n/a" not "—".
                    const bucket = breakdown?.[s.key];
                    const entry = bucket && typeof bucket === 'object' ? bucket[t.key] : undefined;
                    const applicable = bucket && typeof bucket === 'object' && t.key in bucket;
                    const count = typeof entry?.count === 'number' ? entry.count : null;
                    const last = typeof entry?.last === 'string' ? entry.last : null;
                    return (
                        <span className="leak-breakdown-cell" role="cell" key={t.key} data-populated={Boolean(count)}>
                            {!applicable ? (
                                <span className="leak-breakdown-na">n/a</span>
                            ) : (
                                <>
                                    <span className="leak-breakdown-count">{count ?? 0}</span>
                                    {last && <span className="leak-breakdown-date">{last}</span>}
                                </>
                            )}
                        </span>
                    );
                })}
            </div>
        ))}
    </div>
));

LeakBreakdownTable.displayName = 'LeakBreakdownTable';

const LeakResult = React.memo(({ data }: { data: any }) => {
    const total = typeof data?.total_exposures === 'number' ? data.total_exposures : null;
    const latest = typeof data?.latest_exposure === 'string' ? data.latest_exposure : null;
    const queryType = typeof data?.query_type === 'string' ? data.query_type : null;
    const exposedTypes = Array.isArray(data?.exposed_data_types) ? data.exposed_data_types.filter((v: any) => typeof v === 'string') : [];
    const sources = Array.isArray(data?.sources) ? data.sources.filter((v: any) => typeof v === 'string') : [];
    const breakdown = data?.breakdown && typeof data.breakdown === 'object' ? data.breakdown : null;
    // Present only on the "not checked" path (missing key / bad input) — must
    // be shown, not silently dropped, so "—" never reads as an unexplained gap
    // or gets mistaken for a verified-clean result.
    const note = typeof data?.note === 'string' && data.note ? data.note : null;

    return (
        <div className="leak-result" aria-label="Credential leak results">
            {note && (
                <div className="leak-not-checked" role="status">
                    Not checked — {note}
                </div>
            )}
            <div className="leak-grid">
                <section className="leak-card" aria-label="Leak summary">
                    <div className="leak-card-title">Summary</div>
                    <div className="leak-kpi-row">
                        <div className="leak-kpi">
                            <div className="leak-kpi-label">Total Exposures</div>
                            <div className="leak-kpi-value">{total ?? '—'}</div>
                        </div>
                        <div className="leak-kpi">
                            <div className="leak-kpi-label">Latest Exposure</div>
                            <div className="leak-kpi-value">{latest ?? '—'}</div>
                        </div>
                        <div className="leak-kpi">
                            <div className="leak-kpi-label">Query Type</div>
                            <div className="leak-kpi-value">{queryType ?? '—'}</div>
                        </div>
                    </div>
                </section>

                <section className="leak-card" aria-label="Exposed data types">
                    <div className="leak-card-title">Exposed Data Types</div>
                    {exposedTypes.length ? (
                        <div className="leak-tags" role="list" aria-label="Exposed data type tags">
                            {exposedTypes.map((t: string) => (
                                <span className="leak-tag" role="listitem" key={t}>
                                    {t}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <div className="leak-empty">No exposed data types reported.</div>
                    )}
                </section>

                <section className="leak-card" aria-label="Sources">
                    <div className="leak-card-title">Sources</div>
                    {sources.length ? (
                        <ul className="leak-list">
                            {sources.map((s: string) => (
                                <li key={s}>{s}</li>
                            ))}
                        </ul>
                    ) : (
                        <div className="leak-empty">No sources with exposures.</div>
                    )}
                </section>

                <section className="leak-card leak-card--wide" aria-label="Exposure breakdown">
                    <div className="leak-card-title">Breakdown by Source &amp; Type</div>
                    {breakdown ? (
                        <LeakBreakdownTable breakdown={breakdown} />
                    ) : (
                        <div className="leak-empty">No breakdown data returned.</div>
                    )}
                </section>

                <section className="leak-card" aria-label="Safety note">
                    <div className="leak-card-title">Note</div>
                    <div className="leak-note">
                        This module reports leak-exposure counts and last-seen dates from ParanoidLab. It does not retrieve passwords in plaintext and should be used for defensive remediation (password resets, MFA, monitoring).
                    </div>
                </section>
            </div>
        </div>
    );
});

LeakResult.displayName = 'LeakResult';

const SUBSCORE_LABELS: Record<string, string> = {
    urlAnalysis: 'URL Analysis',
    domainIntelligence: 'Domain Intelligence',
    sslCertificate: 'SSL / Certificate',
    threatIntel: 'Threat Intelligence'
};

function subScoreLevel(score: number): string {
    return score >= 70 ? 'Critical' : score >= 40 ? 'High' : score >= 20 ? 'Medium' : 'Low';
}

const PhishingResult = React.memo(({ data }: { data: any }) => {
    const url = typeof data?.url === 'string' ? data.url : null;
    const score = typeof data?.phishing_score === 'number' ? data.phishing_score : null;
    const recommendation = typeof data?.recommendation === 'string' ? data.recommendation : null;

    const subScores = data?.subScores && typeof data.subScores === 'object' ? data.subScores : {};
    const dns = data?.dns || {};
    const whois = data?.whois || {};
    const ssl = data?.ssl || {};
    const threatIntel = data?.threatIntelligence || {};
    const blocklists = threatIntel?.blocklists || {};
    const indicators = data?.indicators && typeof data.indicators === 'object' ? data.indicators : {};

    const scoreValue = score == null ? null : Math.max(0, Math.min(100, score));
    const scoreLabel =
        scoreValue == null ? 'Unknown' : scoreValue >= 70 ? 'Critical' : scoreValue >= 40 ? 'High' : scoreValue >= 20 ? 'Medium' : 'Low';

    const indicatorGroups: Array<{ key: string; title: string; items: string[] }> = [
        { key: 'url', title: 'URL Analysis', items: Array.isArray(indicators.url) ? indicators.url : [] },
        { key: 'domain', title: 'Domain Intelligence', items: Array.isArray(indicators.domain) ? indicators.domain : [] },
        { key: 'ssl', title: 'SSL / Certificate', items: Array.isArray(indicators.ssl) ? indicators.ssl : [] },
        { key: 'threat', title: 'Threat Intelligence', items: Array.isArray(indicators.threat) ? indicators.threat : [] }
    ];

    return (
        <div className="phish-result" aria-label="Phishing detection results">
            <div className="phish-grid">
                <section className="phish-card" aria-label="Phishing summary">
                    <div className="phish-card-title">Summary</div>
                    <div className="phish-kpi-row">
                        <div className="phish-kpi">
                            <div className="phish-kpi-label">Target</div>
                            <div className="phish-kpi-value phish-kpi-value--mono">{url ?? '—'}</div>
                        </div>
                        <div className="phish-kpi">
                            <div className="phish-kpi-label">Overall Risk Score</div>
                            <div className="phish-kpi-value">
                                {scoreValue == null ? '—' : `${scoreValue}/100`}
                                <span className="phish-kpi-pill" data-level={scoreLabel}>
                                    {scoreLabel}
                                </span>
                            </div>
                            <div className="phish-meter" role="img" aria-label="Phishing score meter">
                                <div className="phish-meter-fill" style={{ width: `${scoreValue ?? 0}%` }} data-level={scoreLabel} />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="phish-card" aria-label="Risk composition breakdown">
                    <div className="phish-card-title">Risk Composition</div>
                    <div className="phish-subscore-list">
                        {Object.entries(subScores).map(([key, val]: [string, any]) => {
                            const s = typeof val?.score === 'number' ? val.score : 0;
                            const level = subScoreLevel(s);
                            return (
                                <div className="phish-subscore-row" key={key}>
                                    <div className="phish-subscore-label">{SUBSCORE_LABELS[key] || key}</div>
                                    <div className="phish-meter phish-meter--sm" role="img" aria-label={`${SUBSCORE_LABELS[key] || key} score`}>
                                        <div className="phish-meter-fill" style={{ width: `${s}%` }} data-level={level} />
                                    </div>
                                    <div className="phish-subscore-value">{s}</div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="phish-card" aria-label="WHOIS timeline">
                    <div className="phish-card-title">WHOIS Timeline</div>
                    <div className="phish-kv">
                        <div className="k">Registrar</div>
                        <div className="v">{whois?.registrar ?? '—'}</div>
                        <div className="k">Created</div>
                        <div className="v">{whois?.createdDate ?? '—'}</div>
                        <div className="k">Expires</div>
                        <div className="v">{whois?.expiryDate ?? '—'}</div>
                        <div className="k">Age</div>
                        <div className="v">{whois?.ageDays != null ? `${whois.ageDays} days` : '—'}</div>
                        <div className="k">DNS</div>
                        <div className="v">
                            {dns?.resolves === true
                                ? `Resolves (${dns.ip ?? 'unknown IP'})`
                                : dns?.resolves === false
                                  ? 'Does not resolve'
                                  : '—'}
                        </div>
                    </div>
                </section>

                <section className="phish-card" aria-label="SSL certificate status">
                    <div className="phish-card-title">SSL Certificate Status</div>
                    <div className="phish-kv">
                        <div className="k">Grade</div>
                        <div className="v">
                            <span className="phish-ssl-grade" data-grade={ssl?.grade ?? 'F'}>
                                {ssl?.grade ?? '—'}
                            </span>
                        </div>
                        <div className="k">Protocol</div>
                        <div className="v">{ssl?.protocol ?? '—'}</div>
                        <div className="k">Issuer</div>
                        <div className="v">{ssl?.issuer ?? '—'}</div>
                        <div className="k">Key Size</div>
                        <div className="v">{ssl?.keyBits ? `${ssl.keyBits} bits` : '—'}</div>
                        <div className="k">Days Remaining</div>
                        <div className="v">{ssl?.daysRemaining != null ? `${ssl.daysRemaining} days` : '—'}</div>
                    </div>
                </section>

                <section className="phish-card" aria-label="Threat intelligence status">
                    <div className="phish-card-title">Threat Intelligence</div>
                    <div className="phish-kv">
                        <div className="k">Reputation</div>
                        <div className="v">{threatIntel?.status ?? '—'}</div>
                        <div className="k">Spamhaus</div>
                        <div className="v">{blocklists?.spamhaus ?? '—'}</div>
                        <div className="k">AbuseIPDB</div>
                        <div className="v">{blocklists?.abuseIPDB ?? '—'}</div>
                        <div className="k">Google Safe Browsing</div>
                        <div className="v">{blocklists?.googleSafeBrowsing ?? '—'}</div>
                        <div className="k">AlienVault OTX</div>
                        <div className="v">{blocklists?.otx ?? '—'}</div>
                    </div>
                </section>

                <section className="phish-card" aria-label="Recommendation">
                    <div className="phish-card-title">Recommendation</div>
                    <span className="phish-reco" data-level={scoreLabel}>
                        {recommendation ?? '—'}
                    </span>
                </section>

                {indicatorGroups.map((group) => (
                    <section className="phish-card" aria-label={`${group.title} indicators`} key={group.key}>
                        <div className="phish-card-title">{group.title}</div>
                        {group.items.length ? (
                            <ul className="phish-list">
                                {group.items.map((t, i) => (
                                    <li key={`${t}-${i}`}>{t}</li>
                                ))}
                            </ul>
                        ) : (
                            <div className="phish-empty">No indicators returned.</div>
                        )}
                    </section>
                ))}
            </div>
        </div>
    );
});

PhishingResult.displayName = 'PhishingResult';

const EI_TABS: { id: string; name: string; icon: React.ReactNode }[] = [
    { id: 'overview', name: 'Overview', icon: <Compass size={16} /> },
    { id: 'validation', name: 'Validation', icon: <CheckCircle size={16} /> },
    { id: 'discovery', name: 'Account Discovery', icon: <Search size={16} /> },
    { id: 'breach', name: 'Breach Intelligence', icon: <ShieldAlert size={16} /> },
    { id: 'domain', name: 'Domain Intelligence', icon: <Globe size={16} /> },
    { id: 'reputation', name: 'Reputation', icon: <Star size={16} /> },
    { id: 'ai', name: 'AI Analysis', icon: <Bot size={16} /> }
];

const statusPill = (status: string) => {
    if (status === 'registered') return 'pill pill--ok';
    if (status === 'available') return 'pill';
    return 'pill'; // unknown / not_supported — neutral, no false signal
};
const statusLabel = (status: string) =>
    status === 'registered' ? 'Registered'
    : status === 'available' ? 'Available'
    : status === 'not_supported' ? 'Not Supported'
    : 'Unknown';

const EiOverviewPane = ({ data, risk, onNavigateToModule }: { data: any; risk: string | null; onNavigateToModule?: (moduleId: string, targetValue?: string) => void }) => {
    const email = typeof data?.email === 'string' ? data.email : null;
    const domain = typeof data?.domain === 'string' ? data.domain : null;
    const overview = data?.overview && typeof data.overview === 'object' ? data.overview : {};
    const registeredCount = typeof overview?.registered_count === 'number' ? overview.registered_count : null;
    const checkedCount = typeof overview?.checked_count === 'number' ? overview.checked_count : null;
    const totalExposures = typeof overview?.total_exposures === 'number' ? overview.total_exposures : null;
    const emailUsernameCandidate = deriveUsernameFromEmail(email);

    return (
        <section className="email-card" aria-label="Overview">
            <div className="email-card-title">Overview</div>
            <div className="email-kv">
                <div className="k">Email</div>
                <div className="v">{email ?? '—'}</div>
                <div className="k">Domain</div>
                <div className="v">{domain ?? '—'}</div>
                <div className="k">Risk score</div>
                <div className="v">
                    <span className="pill">{risk ?? '—'}</span>
                </div>
                <div className="k">Platforms registered</div>
                <div className="v">{registeredCount != null && checkedCount != null ? `${registeredCount} / ${checkedCount}` : '—'}</div>
                <div className="k">Breach exposures</div>
                <div className="v">{totalExposures ?? '—'}</div>
            </div>
            {emailUsernameCandidate && (
                <button
                    type="button" className="export-btn" style={{ marginTop: '10px' }}
                    onClick={() => onNavigateToModule?.('social-media-intel', emailUsernameCandidate)}
                    title="Pre-fills Social Media Intelligence's username search with the part of this email before the '@' — a candidate the analyst must confirm, not a match."
                >
                    Search Social Media (candidate: {emailUsernameCandidate})
                </button>
            )}
        </section>
    );
};

const EiValidationPane = ({ data }: { data: any }) => {
    const validation = data?.validation && typeof data.validation === 'object' ? data.validation : {};
    const validSyntax = validation?.valid_syntax;
    const disposable = validation?.is_disposable;
    const deliverable = typeof validation?.deliverable === 'string' ? validation.deliverable : null;
    const mxRecords = Array.isArray(validation?.mx_records) ? validation.mx_records.filter((v: any) => typeof v === 'string') : [];
    const mxProvider = typeof validation?.mx_provider === 'string' ? validation.mx_provider : null;
    const mxLookupStatus = typeof validation?.mx_lookup_status === 'string' ? validation.mx_lookup_status : null;
    const mxLookupError = typeof validation?.mx_lookup_error === 'string' ? validation.mx_lookup_error : null;

    const deliverablePill =
        deliverable?.toLowerCase() === 'likely' ? 'pill pill--ok' : deliverable?.toLowerCase() === 'unlikely' ? 'pill pill--bad' : 'pill';
    const boolPill = (v: any) => (v === true ? 'pill pill--ok' : v === false ? 'pill pill--bad' : 'pill');

    return (
        <>
            <section className="email-card" aria-label="Validation summary">
                <div className="email-card-title">Summary</div>
                <div className="email-kv">
                    <div className="k">Syntax</div>
                    <div className="v">
                        <span className={boolPill(validSyntax)}>{formatBool(validSyntax)}</span>
                    </div>
                    <div className="k">Disposable</div>
                    <div className="v">
                        <span className={boolPill(disposable)}>{formatBool(disposable)}</span>
                    </div>
                    <div className="k">Deliverable</div>
                    <div className="v">
                        <span className={deliverablePill}>{deliverable ?? 'Unknown'}</span>
                    </div>
                    <div className="k">MX provider</div>
                    <div className="v">{mxProvider ?? '—'}</div>
                </div>
            </section>

            <section className="email-card" aria-label="MX records" style={{ marginTop: '12px' }}>
                <div className="email-card-title">MX Records</div>
                {mxLookupStatus === 'dns_error' ? (
                    <div className="email-empty">
                        DNS lookup failed ({mxLookupError ?? 'DNS_LOOKUP_FAILED'}). Check your internet/DNS and try again.
                    </div>
                ) : mxRecords.length ? (
                    <ul className="email-list">
                        {mxRecords.map((m: string, i: number) => (
                            <li key={`${m}-${i}`}>
                                <code className="email-mx">{m}</code>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="email-empty">No MX records found.</div>
                )}
            </section>

            <section className="email-card" aria-label="Note" style={{ marginTop: '12px' }}>
                <div className="email-card-title">Note</div>
                <div className="email-note">
                    This module validates format and domain mail exchange records. It does not verify mailbox ownership or attempt SMTP inbox probing.
                </div>
            </section>
        </>
    );
};

const EiAccountDiscoveryPane = ({ data }: { data: any }) => {
    const discovery = data?.accountDiscovery && typeof data.accountDiscovery === 'object' ? data.accountDiscovery : null;
    const results = Array.isArray(discovery?.results) ? discovery.results : [];
    const regCount = typeof discovery?.registered_count === 'number' ? discovery.registered_count : null;
    const checkedCount = typeof discovery?.checked_count === 'number' ? discovery.checked_count : null;

    return (
        <section className="email-card" aria-label="Account discovery">
            <div className="email-card-title">
                Account Discovery {regCount != null && checkedCount != null ? `(${regCount}/${checkedCount})` : ''}
            </div>
            {results.length ? (
                <ul className="email-list">
                    {results.map((r: any, i: number) => (
                        <li key={`${r.platform}-${i}`}>
                            {r.platform} — <span className={statusPill(r.status)}>{statusLabel(r.status)}</span>
                            {typeof r.endpoint === 'string' && r.endpoint && <span className="ei-endpoint">{r.endpoint}</span>}
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="email-empty">No registration data available.</div>
            )}
            {discovery?.note && <div className="email-empty" style={{ marginTop: '8px' }}>{discovery.note}</div>}
        </section>
    );
};

const EiBreachPane = ({ data }: { data: any }) => {
    const breach = data?.breachIntelligence && typeof data.breachIntelligence === 'object' ? data.breachIntelligence : {};
    const totalExposures = typeof breach?.total_exposures === 'number' ? breach.total_exposures : null;
    const latestExposure = typeof breach?.latest_exposure === 'string' ? breach.latest_exposure : null;
    const exposedTypes = Array.isArray(breach?.exposed_data_types) ? breach.exposed_data_types : [];
    const sources = Array.isArray(breach?.sources) ? breach.sources : [];

    return (
        <section className="email-card" aria-label="Breach intelligence">
            <div className="email-card-title">Breach Intelligence</div>
            <div className="email-kv">
                <div className="k">Total exposures</div>
                <div className="v">{totalExposures ?? 'Not checked'}</div>
                <div className="k">Latest exposure</div>
                <div className="v">{latestExposure ?? '—'}</div>
                <div className="k">Exposed data types</div>
                <div className="v">{exposedTypes.length ? exposedTypes.join(', ') : '—'}</div>
                <div className="k">Sources</div>
                <div className="v">{sources.length ? sources.join(', ') : '—'}</div>
            </div>
            {breach?.note && <div className="email-empty" style={{ marginTop: '8px' }}>{breach.note}</div>}
        </section>
    );
};

const EiDomainIntelligencePane = ({ data }: { data: any }) => {
    const domainIntel = data?.domainIntelligence && typeof data.domainIntelligence === 'object' ? data.domainIntelligence : {};
    const registrar = typeof domainIntel?.registrar === 'string' ? domainIntel.registrar : null;
    const registeredDate = typeof domainIntel?.registeredDate === 'string' ? domainIntel.registeredDate : null;
    const expiryDate = typeof domainIntel?.expiryDate === 'string' ? domainIntel.expiryDate : null;
    const domainAgeDays = typeof domainIntel?.domainAgeDays === 'number' ? domainIntel.domainAgeDays : null;
    const nameServers = Array.isArray(domainIntel?.nameServers) ? domainIntel.nameServers.filter((v: any) => typeof v === 'string') : [];
    const mxProvider = typeof domainIntel?.mxProvider === 'string' ? domainIntel.mxProvider : null;

    return (
        <>
            <section className="email-card" aria-label="Domain intelligence">
                <div className="email-card-title">Domain Intelligence</div>
                <div className="email-kv">
                    <div className="k">Registrar</div>
                    <div className="v">{registrar ?? '—'}</div>
                    <div className="k">Registered</div>
                    <div className="v">{registeredDate ?? '—'}</div>
                    <div className="k">Expires</div>
                    <div className="v">{expiryDate ?? '—'}</div>
                    <div className="k">Domain age</div>
                    <div className="v">{domainAgeDays != null ? `${domainAgeDays} days` : '—'}</div>
                    <div className="k">MX provider</div>
                    <div className="v">{mxProvider ?? '—'}</div>
                </div>
            </section>
            <section className="email-card" aria-label="Name servers" style={{ marginTop: '12px' }}>
                <div className="email-card-title">Name Servers</div>
                {nameServers.length ? (
                    <ul className="email-list">
                        {nameServers.map((ns: string, i: number) => (
                            <li key={`${ns}-${i}`}>
                                <code className="email-mx">{ns}</code>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="email-empty">No name servers found.</div>
                )}
            </section>
        </>
    );
};

const EiReputationPane = ({ data }: { data: any }) => {
    const reputation = data?.reputation && typeof data.reputation === 'object' ? data.reputation : {};
    const blocklists = reputation?.blocklists && typeof reputation.blocklists === 'object' ? reputation.blocklists : {};
    const reputationLabel = typeof reputation?.reputation === 'string' ? reputation.reputation : 'Unknown';
    const abuseConfidenceScore = typeof reputation?.abuseConfidenceScore === 'number' ? reputation.abuseConfidenceScore : null;
    const totalReports = typeof reputation?.totalReports === 'number' ? reputation.totalReports : null;

    const blocklistPill = (status: string) =>
        status === 'Listed' ? 'pill pill--bad' : status === 'Suspicious' ? 'pill' : status === 'Clean' ? 'pill pill--ok' : 'pill';

    return (
        <section className="email-card" aria-label="Reputation">
            <div className="email-card-title">Reputation</div>
            <div className="email-kv">
                <div className="k">Overall reputation</div>
                <div className="v">{reputationLabel}</div>
                <div className="k">Abuse confidence</div>
                <div className="v">{abuseConfidenceScore != null ? `${abuseConfidenceScore}%` : '—'}</div>
                <div className="k">Total reports</div>
                <div className="v">{totalReports ?? '—'}</div>
            </div>
            {Object.keys(blocklists).length > 0 && (
                <ul className="email-list" style={{ marginTop: '10px' }}>
                    {Object.entries(blocklists).map(([source, status]) => (
                        <li key={source}>
                            {source} — <span className={blocklistPill(String(status))}>{String(status)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
};

const EiAiAnalysisPane = ({ data }: { data: any }) => {
    const aiAnalysis = data?.aiAnalysis && typeof data.aiAnalysis === 'object' ? data.aiAnalysis : null;
    const summary = typeof aiAnalysis?.summary === 'string' ? aiAnalysis.summary : null;
    const riskLevel = typeof aiAnalysis?.risk_level === 'string' ? aiAnalysis.risk_level : null;
    const keyFindings = Array.isArray(aiAnalysis?.key_findings) ? aiAnalysis.key_findings.filter((v: any) => typeof v === 'string') : [];
    const recommendations = Array.isArray(aiAnalysis?.recommendations) ? aiAnalysis.recommendations.filter((v: any) => typeof v === 'string') : [];

    if (!aiAnalysis) {
        return (
            <section className="email-card" aria-label="AI analysis">
                <div className="email-card-title">AI Analysis</div>
                <div className="email-empty">AI Analysis is not available for this scan.</div>
            </section>
        );
    }

    return (
        <>
            <section className="email-card" aria-label="AI analysis summary">
                <div className="email-card-title">AI Analysis {riskLevel ? `— ${riskLevel}` : ''}</div>
                <div className="email-note">{summary ?? '—'}</div>
            </section>
            <section className="email-card" aria-label="Key findings" style={{ marginTop: '12px' }}>
                <div className="email-card-title">Key Findings</div>
                {keyFindings.length ? (
                    <ul className="email-list">
                        {keyFindings.map((f: string, i: number) => (
                            <li key={`${f}-${i}`}>{f}</li>
                        ))}
                    </ul>
                ) : (
                    <div className="email-empty">No key findings reported.</div>
                )}
            </section>
            <section className="email-card" aria-label="Recommendations" style={{ marginTop: '12px' }}>
                <div className="email-card-title">Recommendations</div>
                {recommendations.length ? (
                    <ul className="email-list">
                        {recommendations.map((r: string, i: number) => (
                            <li key={`${r}-${i}`}>{r}</li>
                        ))}
                    </ul>
                ) : (
                    <div className="email-empty">No recommendations reported.</div>
                )}
            </section>
        </>
    );
};

const EI_SUBNAV_PILLARS = EI_TABS.map((t) => ({ id: t.id, label: t.name, icon: t.icon }));

const EmailIntelligenceResult = React.memo(({ data, risk, onNavigateToModule }: { data: any; risk?: string; onNavigateToModule?: (moduleId: string, targetValue?: string) => void }) => {
    const [eiTab, setEiTab] = useState<string>('overview');

    return (
        <div className="email-result" aria-label="Email intelligence results">
            <div className="ei-layout">
                <PillarSubnav pillars={EI_SUBNAV_PILLARS} activeId={eiTab} onSelect={setEiTab} ariaLabel="Email Intelligence pillars" />

                <div className="ei-tab-content">
                    {eiTab === 'overview' && <EiOverviewPane data={data} risk={risk ?? null} onNavigateToModule={onNavigateToModule} />}
                    {eiTab === 'validation' && <EiValidationPane data={data} />}
                    {eiTab === 'discovery' && <EiAccountDiscoveryPane data={data} />}
                    {eiTab === 'breach' && <EiBreachPane data={data} />}
                    {eiTab === 'domain' && <EiDomainIntelligencePane data={data} />}
                    {eiTab === 'reputation' && <EiReputationPane data={data} />}
                    {eiTab === 'ai' && <EiAiAnalysisPane data={data} />}
                </div>
            </div>
        </div>
    );
});

EmailIntelligenceResult.displayName = 'EmailIntelligenceResult';

// INVESTIGATION_DASHBOARD.md §18 step 5 — threaded down the same way isAdmin
// already reaches HistoryPage (App.tsx). Only the Investigation Dashboard
// module (§7) actually needs it; every other tab is unaffected.
//
// OSINT_NAV_INTEGRATION.md — this page no longer owns its own module nav
// (the old .osint-sidebar second panel); which module is showing is now
// controlled from outside via `activeSection` (driven by the route, same
// ids as this file's own `modules` array below), and this page reports
// section changes back up via `onSectionChange` whenever something inside
// it needs to switch modules itself (Investigation Dashboard's own module
// cards, a cross-page Investigate handoff) so the sidebar/hash/browser
// history all stay in sync with what's on screen — same pattern as
// ThreatIntelligencePage/MonitoringPage.
interface OsintPageProps {
    isAdmin?: boolean;
    activeSection: string;
    onSectionChange: (section: string) => void;
    // THREAT_INTELLIGENCE_MODULE_PHASE2.md §7 — a one-shot pending nav
    // handed down from App.tsx when the analyst clicks "Investigate" on an
    // IOC elsewhere in the app (a different top-level page, so it can't
    // call this page's own local navigateToOsintModule directly). Consumed
    // once on arrival, then cleared via onInitialNavConsumed so returning to
    // OSINT normally afterward doesn't keep re-triggering it.
    initialNav?: { tab: string; target: string } | null;
    onInitialNavConsumed?: () => void;
    // TELEGRAM_INTELLIGENCE_PHASE3.md 37 - some findings belong to the
    // existing Threat Intelligence page, which is a top-level view rather
    // than an OSINT module, so cross-navigation needs the route-level
    // navigate() App.tsx already owns.
    onNavigateToView?: (view: string) => void;
    // KNOWLEDGE_BASE_PHASE2.md §26 "KNOWLEDGE CONTEXT PANEL" — same
    // top-level handoff pattern as onNavigateToView above.
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    // Same top-level handoff pattern as onNavigateToView, prop-threaded down
    // from the App.tsx functions the main Threat Intelligence page already
    // uses. (onAskAi/onViewMalwareSample were dropped with the duplicate
    // Malware Intelligence entry — Threat Intelligence owns that surface and
    // still receives both.)
    onCreateThreatBrief?: (contextType: string, contextId: string) => void;
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
    // Opens ONE specific intelligence entity on the Threat Intelligence page
    // (App.tsx's existing openThreatIntelEntity, already used by Threat
    // Summary and three other pages). Relationship graphs inside OSINT
    // modules emit a real (type, id) per node, so a node click can open the
    // actual entity instead of guessing a module.
    onOpenEntity?: (entityType: string, entityId: string) => void;
}

const OsintPage: React.FC<OsintPageProps> = ({ isAdmin = false, activeSection, onSectionChange, initialNav, onInitialNavConsumed, onNavigateToView, onOpenKnowledgeEntry, onCreateKnowledgeEntry, onCreateThreatBrief, onViewNotes, onOpenEntity }) => {
    // OSINT_NAV_INTEGRATION.md — `activeSection` is now a controlled prop
    // (driven by the route); this page never sets it directly anymore. A
    // one-shot ref carries a target value to prefill the next time
    // `activeSection` actually changes (see navigateToOsintModule/the
    // reset-effect below) — App.tsx's own route-level default is
    // 'osint-dashboard' → activeSection 'dashboard', preserving the same
    // landing view INVESTIGATION_DASHBOARD.md established.
    const pendingPrefillRef = React.useRef('');
    const [target, setTarget] = useState('');
    const [phoneCountryCode, setPhoneCountryCode] = useState('+60');
    const phoneCodeTouchedRef = React.useRef(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [resultView, setResultView] = useState<'pretty' | 'raw'>('pretty');
    const [showFullJson, setShowFullJson] = useState(false);
    const [customDorkName, setCustomDorkName] = useState('');
    const [customDorkQuery, setCustomDorkQuery] = useState('');
    const [customDorkDescription, setCustomDorkDescription] = useState('');
    const [customDorks, setCustomDorks] = useState<any[]>([]);

    // OSINT_NAVIGATION_EXPANSION.md's target sidebar: 15 items in this exact
    // order (Phone Investigation relabeled to Phone Intelligence in place),
    // followed by the 4 existing real modules that aren't on the target list
    // (appended, unchanged). `implemented: false` entries are pure nav
    // scaffolding — no backend module, no search box, just an honest
    // "not available yet" placeholder (see the render below).
    const modules = useMemo<{ id: string; name: string; icon: React.ReactNode; implemented: boolean }[]>(() => [
        { id: 'dashboard',           name: 'Investigation Dashboard',    icon: <LayoutDashboard size={18} />, implemented: true },
        { id: 'target-mgmt',         name: 'Target Management',         icon: <Crosshair size={18} />,       implemented: true },
        { id: 'domain-intel',        name: 'Domain Intelligence',       icon: <Globe size={18} />,           implemented: true },
        // BRAND_INTELLIGENCE_PASS1.md — own entry flow (brand management, not
        // a scan-target input); rendered separately below via activeSection check.
        { id: 'brand-intel',         name: 'Brand Intelligence',        icon: <ShieldCheck size={18} />,     implemented: true },
        { id: 'ip-intel',            name: 'IP Intelligence',           icon: <Network size={18} />,         implemented: true },
        { id: 'email',               name: 'Email Intelligence',        icon: <Mail size={18} />,            implemented: true },
        { id: 'social',              name: 'Username Intelligence',     icon: <UserSearch size={18} />,      implemented: true },
        { id: 'phone',               name: 'Phone Intelligence',        icon: <Smartphone size={18} />,      implemented: true },
        { id: 'company-intel',       name: 'Company Intelligence',      icon: <Building2 size={18} />,       implemented: true },
        { id: 'social-media-intel',  name: 'Social Media Intelligence', icon: <Share2 size={18} />,          implemented: true },
        // TELEGRAM_INTELLIGENCE_PHASE4.md — moved from under Social Media
        // Intelligence to its own entry under Exposure Intelligence.
        { id: 'telegram-intel',      name: 'Telegram Intelligence',     icon: <Send size={18} />,            implemented: true },
        // CREDENTIAL_LEAK_PHASE1.md §67 — the new domain-first workflow's
        // primary nav entry, under Exposure Intelligence alongside Telegram/Dark Web.
        { id: 'credential-leak-intel', name: 'Credential Leak Intelligence', icon: <KeyRound size={18} />,   implemented: true },
        { id: 'darkweb-intel',       name: 'Dark Web Intelligence',     icon: <EyeOff size={18} />,          implemented: true },
        { id: 'document-intel',      name: 'Document Intelligence',     icon: <FileText size={18} />,        implemented: true },
        { id: 'image-intel',         name: 'Image Intelligence',        icon: <Image size={18} />,           implemented: true },
        // FIX_NAVIGATION_&_INTELLIGENCE_ARCHITECTURE.md §1 named Malware /
        // Vulnerability / Threat Actor Intelligence as OSINT's duplicates of
        // Threat Intelligence's own modules. That pass removed them from
        // AppShell's NAV_TREE but not from this registry, so they survived
        // here: 'malware-intel' still mounted TI's OWN MalwareSection (a
        // second entry point to one component) and appeared as an OSINT
        // module card, while the other two were dead `implemented: false`
        // placeholders. Threat Intelligence owns all three; #/osint-malware-intel
        // redirects to #/ti-malware in App.tsx so existing links still resolve.
        // Existing real modules not on the target list — appended, unchanged.
        // FIX_NAVIGATION_&_INTELLIGENCE_ARCHITECTURE.md §12/§35 — visible
        // label renamed "Phishing Detection" → "Phishing Intelligence". The
        // `id` ('phishing', i.e. the 'osint-phishing' view/route) is
        // UNCHANGED — only the display name changes, so no route breaks.
        { id: 'phishing',            name: 'Phishing Intelligence',     icon: <AlertTriangle size={18} />,   implemented: true },
        { id: 'name',                name: 'Name Checker',              icon: <Users size={18} />,           implemented: true },
        // CREDENTIAL_LEAK_PHASE1.md §60/§61 — the pre-existing email-based
        // lookup is preserved for backward compatibility but is no longer
        // the primary workflow (Credential Leak Intelligence above is);
        // relabeled so it reads as the secondary, explicit tool it now is.
        { id: 'leak',                name: 'Advanced Email Lookup',     icon: <KeyRound size={18} />,        implemented: true },
        { id: 'dorking',             name: 'Google Dorking',            icon: <SearchCode size={18} />,      implemented: true }
    ], []);

    const phoneCodes = PHONE_CODES;

    // ADMINISTRATION_PASS3.md — seed the Phone Intelligence country-code
    // select from the user's saved preference instead of always defaulting
    // to Malaysia. Guarded by phoneCodeTouchedRef so a manual selection
    // made while this fetch is still in flight doesn't get clobbered when
    // the response lands.
    useEffect(() => {
        let cancelled = false;
        getUserPreferences()
            .then((res) => {
                if (cancelled || phoneCodeTouchedRef.current) return;
                const saved = res?.preferences?.default_phone_country_code;
                if (saved) setPhoneCountryCode(saved);
            })
            .catch(() => {
                // No saved preference (or not logged in yet) — keep the +60 default.
            });
        return () => { cancelled = true; };
    }, []);

    const exportResults = useCallback((format: 'json' | 'csv') => {
        if (!result) return;
        const data = result.data;
        let blob: Blob;
        let filename: string;

        if (format === 'json') {
            blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            filename = `osint_${activeSection}_${target}.json`;
        } else {
            // Simple CSV for Username Intelligence's Account Discovery results
            const usernameResults = activeSection === 'social' ? data?.accountDiscovery?.results : null;
            if (activeSection === 'social' && Array.isArray(usernameResults)) {
                const headers = 'Platform,Category,Status,Confidence,URL,ResponseTime(ms)\n';
                const rows = usernameResults.map((r: any) => `${r.platform},${r.category},${r.status},${r.confidence},${r.url},${r.responseTime}`).join('\n');
                blob = new Blob([headers + rows], { type: 'text/csv' });
            } else {
                blob = new Blob([JSON.stringify(data)], { type: 'text/plain' });
            }
            filename = `osint_${activeSection}_${target}.csv`;
        }

        downloadBlob(blob, filename);
    }, [result, activeSection, target]);

    const targetForRequest = useMemo(() => {
        const raw = target.trim();
        if (!raw) return '';
        if (activeSection !== 'phone') return raw;

        const digits = raw.replace(/[^\d]/g, '');
        if (!digits) return '';

        if (raw.startsWith('+')) return `+${digits}`;

        const cc = String(phoneCountryCode || '').replace(/[^\d]/g, '');
        let national = digits.replace(/^0+/, '');
        if (!national) national = digits;
        return cc ? `+${cc}${national}` : `+${national}`;
    }, [activeSection, phoneCountryCode, target]);

    const leakInputError = useMemo(() => {
        if (activeSection !== 'leak') return null;
        const raw = target.trim();
        if (!raw) return null;
        return EMAIL_RE.test(raw) ? null : 'LeakCheck requires a valid email address.';
    }, [activeSection, target]);

    const handleScan = useCallback(async () => {
        if (!targetForRequest) return;
        if (activeSection === 'leak' && !EMAIL_RE.test(targetForRequest)) {
            setError('LeakCheck requires a valid email address.');
            setResult(null);
            return;
        }
        setLoading(true);
        setError(null);
        setResult(null);
        setResultView('pretty');
        setShowFullJson(false);

        try {
            addSearchHistory(targetForRequest, 'osint');
            const backendModule = OSINT_TAB_TO_BACKEND_MODULE[activeSection];
            const data = await getOsintData(backendModule, targetForRequest);
            setResult(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [activeSection, targetForRequest]);

    const appendDorkToken = useCallback((token: string) => {
        setCustomDorkQuery(prev => {
            const prefix = prev.trim().length > 0 ? prev.trimEnd() + ' ' : '';
            return prefix + token;
        });
    }, []);

    const addCustomDork = useCallback(() => {
        const query = customDorkQuery.trim();
        if (!query) return;
        const name = (customDorkName || 'Custom Dork').trim();
        const description = (customDorkDescription || 'User-defined search operator query.').trim();

        const item = {
            name,
            description,
            query,
            google_url: `https://www.google.com/search?q=${encodeURIComponent(query)}`
        };

        setCustomDorks(prev => [item, ...prev]);
        setCustomDorkName('');
        setCustomDorkDescription('');
        setCustomDorkQuery('');
    }, [customDorkName, customDorkDescription, customDorkQuery]);

    const clearCustomDorks = useCallback(() => {
        setCustomDorks([]);
        setCustomDorkName('');
        setCustomDorkDescription('');
        setCustomDorkQuery('');
    }, []);

    const activeModule = useMemo(() => modules.find(m => m.id === activeSection), [modules, activeSection]);
    const isImplemented = activeModule?.implemented ?? false;

    // OSINT_NAV_INTEGRATION.md — every module switch resets the same
    // ephemeral scan state (result/error/target/dork builder), regardless of
    // whether it's triggered by a direct sidebar leaf click (route change,
    // handled by this effect below), or by this page's own internal
    // cross-nav (Investigation Dashboard's module cards, an Investigate
    // handoff) via navigateToOsintModule. Keying the reset on `activeSection`
    // itself — rather than duplicating the reset logic at every call site —
    // guarantees it fires no matter how navigation happened, which is what
    // makes browser back/forward "just work" too.
    useEffect(() => {
        setResult(null);
        setError(null);
        setTarget(pendingPrefillRef.current);
        pendingPrefillRef.current = '';
        setResultView('pretty');
        setShowFullJson(false);
        setCustomDorks([]);
        setCustomDorkName('');
        setCustomDorkDescription('');
        setCustomDorkQuery('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSection]);

    // INVESTIGATION_DASHBOARD.md §7b/§9 — "Continue Investigation"/Quick
    // Actions callback. Switches this page's own module and, for the generic
    // scan-input flow, pre-fills the target field (nothing to pre-fill for
    // Brand Intelligence's own entry flow). Stages the prefill in a ref for
    // the reset-effect above to pick up once `activeSection` actually
    // changes — except when `moduleId` is already the current section (App.
    // tsx's own navigate() no-ops on a same-view route, so the effect
    // wouldn't re-fire), in which case the reset+prefill is applied directly.
    const navigateToOsintModule = useCallback((moduleId: string, targetValue?: string) => {
        if (moduleId === activeSection) {
            setResult(null);
            setError(null);
            setTarget(targetValue ?? '');
            setResultView('pretty');
            setShowFullJson(false);
            setCustomDorks([]);
            setCustomDorkName('');
            setCustomDorkDescription('');
            setCustomDorkQuery('');
            return;
        }
        pendingPrefillRef.current = targetValue ?? '';
        onSectionChange(moduleId);
    }, [activeSection, onSectionChange]);

    // Consume a one-shot cross-page "Investigate" handoff (see initialNav's
    // own doc comment above) — reuses the exact same tab-switch+prefill path
    // a normal in-page navigation click uses, just triggered on arrival
    // instead of by a click.
    useEffect(() => {
        if (!initialNav) return;
        navigateToOsintModule(initialNav.tab, initialNav.target);
        onInitialNavConsumed?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialNav]);

    const resultTitle = useMemo(() => {
        if (activeSection === 'dorking') return 'Google Dorking Results';
        return `${activeModule?.name ?? 'Result'} Overview`;
    }, [activeModule, activeSection]);

    const resultSubtitle = useMemo(() => {
        if (activeSection === 'dorking') {
            const count = Array.isArray(result?.data?.queries) ? result.data.queries.length : 0;
            const label = count === 1 ? 'query' : 'queries';
            return `${count} ${label} organized for rapid investigator review.`;
        }
        return targetForRequest
            ? `Analyst-ready summary for ${targetForRequest}`
            : 'Analyst-ready summary';
    }, [activeSection, result, targetForRequest]);

    return (
        <div className="osint-page">
            <header className="osint-header">
                <div className="osint-header-text">
                    <h1>OSINT Intelligence Gathering</h1>
                    <p className="osint-subtitle">Select a module, enter a target, and run analysis.</p>
                </div>
            </header>

            <div className="osint-container">
                <main className="osint-content" role="main" aria-label="OSINT Module Content">
                    {/* INVESTIGATION_DASHBOARD.md §18 step 7 — own entry flow
                        (aggregate workspace view, not a scan target field).
                        Checked before the generic implemented/placeholder
                        branch, same position/pattern as brand-intel below. */}
                    {activeSection === 'dashboard' ? (
                        <InvestigationDashboardHome
                            isAdmin={isAdmin}
                            modules={modules}
                            moduleSlugMap={OSINT_TAB_TO_BACKEND_MODULE}
                            onNavigateToModule={navigateToOsintModule}
                        />
                    ) : activeSection === 'brand-intel' ? (
                        /* BRAND_INTELLIGENCE_PASS1.md — brand-intel has its own
                           entry flow (profile management, not a scan target field). */
                        <BrandIntelligenceHome />
                    ) : activeSection === 'target-mgmt' ? (
                        /* OSINT_TARGET_MANAGEMENT.md — own entry flow (target
                           CRUD/dashboard, not a scan target field). Creation and
                           investigation are deliberately separate actions here —
                           this component never calls an OSINT scan module. */
                        <TargetManagementHome />
                    ) : activeSection === 'company-intel' ? (
                        /* COMPANY_INTELLIGENCE.md — own entry flow (company
                           search/profile, not a scan target field). An
                           aggregation/correlation layer over Domain/IP/Email/
                           Brand/Threat Intelligence — never calls a scan
                           module directly; cross-navigates via onNavigateToModule. */
                        <CompanyIntelligenceHome onNavigateToModule={navigateToOsintModule} prefillValue={target} onOpenEntity={onOpenEntity} />
                    ) : activeSection === 'social-media-intel' ? (
                        /* SOCIALMEDIA_PHASE1.md — own entry flow (username
                           investigation, not a scan target field). Phase 1
                           only: Investigation Overview / Target Input /
                           Account Discovery (Maigret/Sherlock/Social
                           Analyzer, normalized+deduplicated). No Telegram,
                           Correlation, AI, or Risk yet — later phases. */
                        <SocialMediaIntelligenceHome onNavigateToModule={navigateToOsintModule} prefillValue={target} onOpenKnowledgeEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} />
                    ) : activeSection === 'telegram-intel' ? (
                        /* TELEGRAM_INTELLIGENCE_PHASE4.md §1/§2/§9 — own entry
                           flow (investigation picker, not a scan target
                           field), relocated from a Social Media Intelligence
                           pillar to Exposure Intelligence. Same investigation
                           entity/APIs; only the navigation location changed. */
                        <TelegramIntelligenceHome onNavigateToModule={navigateToOsintModule} onNavigateToView={onNavigateToView} onOpenKnowledgeEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} />
                    ) : activeSection === 'image-intel' ? (
                        /* IMAGE_INTELLIGENCE.md — own entry flow (image
                           upload/URL intake, not a scan target field). A
                           forensics/aggregation layer — reverse image search
                           and local similarity live here, cross-navigates to
                           Web/Domain/Brand Intelligence via onNavigateToModule
                           rather than duplicating those engines. */
                        <ImageIntelligenceHome onNavigateToModule={navigateToOsintModule} onOpenEntity={onOpenEntity} />
                    ) : activeSection === 'document-intel' ? (
                        /* DOCUMENT_INTELLIGENCE_PHASE1.md — own entry flow
                           (upload/catalog, not a scan-target field). Replaces
                           the former "planned for a future update" placeholder. */
                        <DocumentIntelligenceHome
                            onOpenKnowledgeEntry={onOpenKnowledgeEntry}
                            onCreateKnowledgeEntry={onCreateKnowledgeEntry}
                            onViewNotes={onViewNotes}
                            isAdmin={isAdmin}
                        />
                    ) : activeSection === 'credential-leak-intel' ? (
                        /* CREDENTIAL_LEAK_PHASE1.md §67/§68 — own entry flow
                           (Watchlist Domain selection, not an email
                           scan-target field). Replaces the former
                           email-first "Credential Leak" primary workflow. */
                        <CredentialLeakIntelligenceHome
                            onNavigateToModule={navigateToOsintModule}
                            onNavigateToView={onNavigateToView}
                            onViewNotes={onViewNotes}
                            onCreateThreatBrief={onCreateThreatBrief}
                            isAdmin={isAdmin}
                        />
                    ) : activeSection === 'darkweb-intel' ? (
                        /* DARK_WEB_PHASE1.md — own entry flow (source/
                           observation workspace, not a scan-target field).
                           Replaces the former "planned for a future update" placeholder. */
                        <DarkWebIntelligenceHome
                            onNavigateToModule={navigateToOsintModule}
                            onNavigateToView={onNavigateToView}
                            onViewNotes={onViewNotes}
                            onOpenKnowledgeEntry={onOpenKnowledgeEntry}
                            onCreateKnowledgeEntry={onCreateKnowledgeEntry}
                            onCreateThreatBrief={onCreateThreatBrief}
                            isAdmin={isAdmin}
                        />
                    ) : !isImplemented ? (
                        <>
                            <div className="input-section">
                                <h2>{activeModule?.name}</h2>
                            </div>
                            <OsintPlaceholderPane title={activeModule?.name ?? 'This module'} />
                        </>
                    ) : (
                    <> {/* generic scan-input flow */}
                    <div className="input-section">
                        <h2>{activeModule?.name}</h2>
                        <div className={`search-box ${activeSection === 'phone' ? 'search-box--phone' : ''}`}>
                            {activeSection === 'phone' && (
                                <label className="phone-cc" aria-label="Country calling code">
                                    <span className="sr-only">Country code</span>
                                    <select
                                        className="phone-cc-select"
                                        value={phoneCountryCode}
                                        onChange={(e) => {
                                            phoneCodeTouchedRef.current = true;
                                            setPhoneCountryCode(e.target.value);
                                        }}
                                        aria-label="Select country calling code"
                                    >
                                        {phoneCodes.map((c) => (
                                            <option key={c.value} value={c.value}>
                                                {c.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                            <input
                                type={activeSection === 'leak' ? 'email' : 'text'}
                                aria-label={`Target for ${activeModule?.name || activeSection}`}
                                placeholder={
                                    activeSection === 'phone'
                                        ? 'Enter phone number (e.g., 123456789 or +60123456789)'
                                        : activeSection === 'leak'
                                            ? 'Enter email address for breach lookup'
                                        : `Enter target for ${activeModule?.name || activeSection}...`
                                }
                                value={target}
                                onChange={(e) => {
                                    setTarget(e.target.value);
                                    if (error) setError(null);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                            />
                            <button
                                onClick={handleScan}
                                disabled={loading}
                                aria-busy={loading}
                            >
                                {loading ? 'Scanning...' : 'Analyze'}
                            </button>
                        </div>
                        {activeSection === 'leak' && (
                            <div className={`input-helper ${leakInputError ? 'input-helper--error' : ''}`} role="note">
                                {leakInputError ?? 'LeakCheck accepts email addresses only.'}
                            </div>
                        )}
                        {activeSection === 'phone' && targetForRequest && (
                            <div className="phone-preview" role="note" aria-label="Phone number preview">
                                Sending as: <span className="phone-preview-num">{targetForRequest}</span>
                            </div>
                        )}
                    </div>

                    {activeSection === 'dorking' && (
                        <section className="dork-builder" aria-label="Custom Dork Builder">
                            <div className="dork-builder-header">
                                <h3>Custom Dork Builder</h3>
                                <div className="dork-builder-actions">
                                    <button
                                        type="button"
                                        className="dork-builder-btn"
                                        onClick={() => appendDorkToken(`site:${target.trim() || 'example.com'}`)}
                                        disabled={!target.trim()}
                                    >
                                        Insert site:target
                                    </button>
                                    <button
                                        type="button"
                                        className="dork-builder-btn danger"
                                        onClick={clearCustomDorks}
                                        disabled={customDorks.length === 0 && !customDorkQuery && !customDorkName && !customDorkDescription}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>

                            <div className="dork-builder-grid">
                                <label className="dork-field">
                                    <span>Label</span>
                                    <input
                                        type="text"
                                        value={customDorkName}
                                        onChange={(e) => setCustomDorkName(e.target.value)}
                                        placeholder="e.g., Exposed Backups"
                                    />
                                </label>
                                <label className="dork-field">
                                    <span>Description</span>
                                    <input
                                        type="text"
                                        value={customDorkDescription}
                                        onChange={(e) => setCustomDorkDescription(e.target.value)}
                                        placeholder="What this dork is searching for"
                                    />
                                </label>
                                <label className="dork-field full">
                                    <span>Query</span>
                                    <input
                                        type="text"
                                        value={customDorkQuery}
                                        onChange={(e) => setCustomDorkQuery(e.target.value)}
                                        placeholder="e.g., site:example.com ext:sql | inurl:backup"
                                        onKeyDown={(e) => e.key === 'Enter' && addCustomDork()}
                                    />
                                </label>
                            </div>

                            <div className="dork-token-row" role="group" aria-label="Quick Insert Tokens">
                                <button type="button" className="token" onClick={() => appendDorkToken('intitle:')}>intitle:</button>
                                <button type="button" className="token" onClick={() => appendDorkToken('inurl:')}>inurl:</button>
                                <button type="button" className="token" onClick={() => appendDorkToken('filetype:')}>filetype:</button>
                                <button type="button" className="token" onClick={() => appendDorkToken('ext:')}>ext:</button>
                                <button type="button" className="token" onClick={() => appendDorkToken('""')}>""</button>
                                <button type="button" className="token" onClick={() => appendDorkToken('OR')}>OR</button>
                                <button type="button" className="token" onClick={() => appendDorkToken('-')}>-</button>
                            </div>

                            <div className="dork-builder-submit">
                                <button
                                    type="button"
                                    className="dork-builder-primary"
                                    onClick={addCustomDork}
                                    disabled={!customDorkQuery.trim()}
                                >
                                    Add Custom Dork
                                </button>
                            </div>

                            {customDorks.length > 0 && (
                                <div className="dorking-list" role="list" aria-label="Custom Dorks">
                                    {customDorks.map((q, i) => (
                                        <DorkingCard key={`custom-${i}`} query={q} />
                                    ))}
                                </div>
                            )}
                        </section>
                    )}

                    {error && <div className="error-message" role="alert">{error}</div>}

                    {result && (
                        <div className={`result-display result-display--${activeSection}`} aria-live="polite">
                            <div className="result-header-row">
                                <div className="result-header-main">
                                    <div className="result-heading">
                                        <h3 className="result-section-title">{resultTitle}</h3>
                                        <p className="result-section-subtitle">{resultSubtitle}</p>
                                    </div>
                                </div>
                                <div className="result-header-actions">
                                    <div className="result-view-toggle" role="group" aria-label="Result view mode">
                                        <button
                                            type="button"
                                            className={`result-view-btn ${resultView === 'pretty' ? 'active' : ''}`}
                                            aria-pressed={resultView === 'pretty'}
                                            onClick={() => setResultView('pretty')}
                                        >
                                            Pretty
                                        </button>
                                        <button
                                            type="button"
                                            className={`result-view-btn ${resultView === 'raw' ? 'active' : ''}`}
                                            aria-pressed={resultView === 'raw'}
                                            onClick={() => setResultView('raw')}
                                        >
                                            Raw JSON
                                        </button>
                                    </div>
                                    <div className="export-actions">
                                        <button onClick={() => exportResults('json')} className="export-btn" aria-label="Download results as JSON">Download JSON</button>
                                        <button onClick={() => exportResults('csv')} className="export-btn" aria-label="Download results as CSV">Download CSV</button>
                                    </div>
                                </div>
                            </div>

                            {/* FIX_OSINT_LAYOUT.md — data-lenis-prevent removed: this div
                                no longer scrolls independently (see OsintPage.css), so it
                                no longer needs to opt out of Lenis's smooth-scroll handling
                                — the main page scroll region handles it now like everything
                                else on the page. */}
                            <div className="result-body-scroll">
                            {resultView === 'raw' ? (
                                <JsonViewer value={result.data} mode="code" />
                            ) : (
                                <>
                                    {activeSection === 'social' && result.data.accountDiscovery ? (
                                        <div className="osint-username-pretty">
                                            <UsernameIntelligenceResult data={result.data} risk={result.risk} target={target} />
                                        </div>
                                    ) : activeSection === 'domain-intel' && result.data.brandSimilarity ? (
                                        <div className="osint-domain-pretty">
                                            <DomainIntelligenceResult data={result.data} risk={result.risk} />
                                        </div>
                                    ) : activeSection === 'ip-intel' && result.data.location ? (
                                        <div className="osint-ip-pretty">
                                            <IpIntelligenceResult data={result.data} risk={result.risk} />
                                        </div>
                                    ) : activeSection === 'name' && result.data.platforms ? (
                                        <div className="namecheck-container" role="list" aria-label="Name checker candidate results">
                                            {Object.entries(result.data.platforms).map(([platform, candidates]) => (
                                                <NamePlatformGroup key={platform} platform={platform} candidates={candidates as any[]} />
                                            ))}
                                        </div>
                                    ) : activeSection === 'dorking' && result.data.queries ? (
                                        <div className="dorking-list" role="list" aria-label="Dorking queries">
                                            {result.data.queries.map((q: any, i: number) => (
                                                <DorkingCard key={i} query={q} />
                                            ))}
                                            <div className="dorking-footer">
                                                <p>Remediation: {result.data.remediation}</p>
                                            </div>
                                        </div>
                                    ) : activeSection === 'phone' ? (
                                        <div className="osint-phone-pretty">
                                            <PhoneResult data={result.data} onNavigateToModule={navigateToOsintModule} />
                                        </div>
                                    ) : activeSection === 'phishing' ? (
                                        <div className="osint-phish-pretty">
                                            <PhishingResult data={result.data} />
                                        </div>
                                    ) : activeSection === 'email' ? (
                                        <div className="osint-email-pretty">
                                            <EmailIntelligenceResult data={result.data} risk={result.risk} onNavigateToModule={navigateToOsintModule} />
                                        </div>
                                    ) : activeSection === 'leak' ? (
                                        <div className="osint-leak-pretty">
                                            <LeakResult data={result.data} />
                                        </div>
                                    ) : (
                                        <JsonViewer value={result.data} mode="tree" />
                                    )}
                                    {(activeSection === 'social' ||
                                        activeSection === 'domain-intel' ||
                                        activeSection === 'ip-intel' ||
                                        activeSection === 'name' ||
                                        activeSection === 'dorking' ||
                                        activeSection === 'phone' ||
                                        activeSection === 'leak' ||
                                        activeSection === 'phishing' ||
                                        activeSection === 'email') && (
                                        <div className="osint-json-secondary">
                                            <button
                                                type="button"
                                                className="osint-json-secondary-toggle"
                                                aria-expanded={showFullJson}
                                                onClick={() => setShowFullJson((prev) => !prev)}
                                            >
                                                <span className="osint-json-secondary-arrow" aria-hidden="true">
                                                    {showFullJson ? '▼' : '▶'}
                                                </span>
                                                <span className="osint-json-secondary-title">Full JSON</span>
                                                {!showFullJson && (
                                                    <span className="osint-json-secondary-hint">(Click to expand)</span>
                                                )}
                                            </button>
                                            {showFullJson && <JsonViewer value={result.data} mode="tree" />}
                                        </div>
                                    )}
                                </>
                            )}
                            </div>
                        </div>
                    )}
                    </>
                    )}
                </main>
            </div>
        </div>
    );
};

export default OsintPage;
