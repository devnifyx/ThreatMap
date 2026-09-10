export interface KeyValueItem {
    label: string;
    value: string;
    color?: string;
    href?: string;
}

export interface TagItem {
    label: string;
    color?: string;
}

// One entry of the "Hosting Countries" card (frontend/src/components/HostingCountriesMap.tsx).
// Derived from real per-subdomain geolocation (services/reconPipeline.js
// `systems[].location`) — a system without a resolved countryCode is
// dropped rather than guessed.
export interface HostingCountryEntry {
    code: string;
    name: string;
    count: number;
}

// One row of the "Subdomains" table (frontend/src/components/InfoCard.tsx).
// Every field here is derived from real recon data (services/reconPipeline.js
// `systems` entries) — nothing here is fabricated. Two fields are honest
// substitutes for what a reverse-IP/OS-fingerprint SaaS would show, since
// this app doesn't have that data:
//   - sameIpCount: OTHER subdomains from THIS SAME SCAN sharing this IP
//     (not an internet-wide reverse-IP lookup, which this app can't do).
//   - service: the raw HTTP `Server` response header, if present — not an
//     OS/CPE fingerprint (this app has no OS detection).
export interface SubdomainTableRow {
    subdomain: string;
    ip: string | null;
    country: string | null;
    countryCode: string | null;
    provider: string | null;
    waf: string | null;
    ports: number[];
    service: string | null;
    riskLevel: string | null;
    riskScore: number | null;
    sameIpCount: number;
}

// One record-type group of the "DNS Records" card (frontend/src/components/InfoCard.tsx).
// Derived entirely from services/dnsInfo.js's live resolver results — an empty
// `records` array means the resolver genuinely returned no data for that type
// (e.g. no CAA record configured), not a failed lookup being hidden.
export interface DnsRecordGroup {
    type: string;
    description: string;
    count: number;
    records: string[];
}

export interface DnsRecordsData {
    domain: string;
    dnssec: boolean;
    groups: DnsRecordGroup[];
}

// "Domain Relationship Tree" card — a collapsible hierarchy built purely from
// data this app already resolved (DnsRecordsData + the subdomain-table rows).
// Only the A group gets real IP→subdomain grouping (from actual recon
// results); every other DNS record type just shows its literal record values
// as leaves — nothing here is a fabricated relationship.
export interface DomainTreeLeaf {
    label: string;
    detail?: string;
}

export interface DomainTreeSubdomainNode {
    subdomain: string;
    openPorts: DomainTreeLeaf;
    service: DomainTreeLeaf;
}

export interface DomainTreeIpNode {
    ip: string;
    provider: string | null;
    subdomains: DomainTreeSubdomainNode[];
}

export interface DomainTreeRecordGroup {
    type: string;
    count: number;
    ipNodes?: DomainTreeIpNode[];
    recordValues?: string[];
}

export interface DomainTreeData {
    domain: string;
    groups: DomainTreeRecordGroup[];
}

export type CardContentType = 'kv-list' | 'tags' | 'custom' | 'subdomain-table' | 'dns-records' | 'domain-tree';

export interface InfoCardData {
    id: string;
    title: string;
    type: CardContentType;
    data?: KeyValueItem[] | TagItem[] | SubdomainTableRow[] | DnsRecordsData | DomainTreeData;
    customContentId?: string;
    delay?: number;
}

export interface ScanSection {
    id: string;
    title: string;
    cards: InfoCardData[];
}

export interface Vulnerability {
    title: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    description: string;
}

export interface AiAnalysis {
    threat_level: number;
    summary: string;
    vulnerabilities: Vulnerability[];
    remediation: string[];
}

// ---- Username Intelligence (Pass 1: Overview + Account Discovery +
// Profile Analysis + Reputation. repositoryAnalysis/correlation/aiAnalysis
// are Pass 2 — intentionally absent from UsernameIntelligenceData until
// then, same "frontend must not assume these keys exist" contract Email
// Intelligence Pass 1 established.) ----

export type UsernamePlatformStatus = 'taken' | 'available' | 'unverified' | 'rate-limited' | 'not-supported';

export interface UsernamePlatformResult {
    platform: string;
    category: string;
    status: UsernamePlatformStatus;
    reason?: string;
    confidence: number;
    matchedType?: string;
    additionalMatches?: Array<{ type: string; url: string }>;
    url: string;
    responseTime: number;
    statusCode: number | null;
}

export interface UsernameOverview {
    platformsFound: number;
    verifiedCount: number;
    unverifiedCount: number;
    notFoundCount: number;
    overallRiskScore: number;
    riskLevel: string;
    aiExecutiveSummary: string | null;
}

export interface UsernameAccountDiscovery {
    results: UsernamePlatformResult[];
    totalPlatforms: number;
    verifiedCount: number;
    notFoundCount: number;
    unverifiedCount: number;
    notSupportedCount: number;
    rateLimitedCount: number;
}

// Platform-adaptive — each platform only carries the fields it actually has.
// `kind` selects which field-map view the frontend renders.
export interface UsernameProfileGeneric {
    kind: 'generic' | 'generic-og';
    username?: string;
    profileUrl?: string;
    displayName?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
}

export interface UsernameProfileGitHub {
    kind: 'github';
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    followers: number | null;
    following: number | null;
    repoCount: number | null;
    company: string | null;
    blog: string | null;
    location: string | null;
    createdAt: string | null;
    accountAgeDays: number | null;
}

export interface UsernameProfileReddit {
    kind: 'reddit';
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    totalKarma: number | null;
    linkKarma: number | null;
    commentKarma: number | null;
    cakeDay: string | null;
    accountAgeDays: number | null;
    verified: boolean;
    isGold: boolean;
}

export interface UsernameProfileTikTok {
    kind: 'tiktok';
    displayName: string;
    avatarUrl: string | null;
    title: string | null;
}

export interface UsernameProfileTelegram {
    kind: 'telegram';
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
}

export type UsernameProfileFields =
    | UsernameProfileGitHub
    | UsernameProfileReddit
    | UsernameProfileTikTok
    | UsernameProfileTelegram
    | UsernameProfileGeneric;

export interface UsernameProfileAnalysis {
    profiles: Record<string, UsernameProfileFields>;
}

export interface UsernameReputation {
    overallRiskScore: number;
    confidenceScore: number;
    profileConsistency: number;
    verifiedAccounts: number;
    inactiveAccounts: number;
    suspiciousAccounts: number;
    possibleFakeAccounts: number;
}

export interface CorrelationNode {
    id: string;
    label: string;
    kind: 'username' | 'email' | 'company' | 'website' | 'breach' | 'social' | 'alias';
    detail?: string;
}

export interface CorrelationEdge {
    source: string;
    target: string;
    relationship: string;
    confidence?: number;
}

export interface CorrelationData {
    nodes: CorrelationNode[];
    edges: CorrelationEdge[];
}

export interface UsernameAiAnalysis {
    executiveSummary: string;
    technicalFindings: string[];
    overallRisk: string;
    confidenceScore: number;
    recommendations: string[];
    nextInvestigationSteps: string[];
}

export interface UsernameIntelligenceData {
    username: string;
    scanDuration: number;
    overview: UsernameOverview;
    accountDiscovery: UsernameAccountDiscovery;
    profileAnalysis: UsernameProfileAnalysis;
    reputation: UsernameReputation;
    correlation?: CorrelationData;
    aiAnalysis?: UsernameAiAnalysis;
}

// ---- Domain Intelligence (DOMAIN_INTELLIGENCE_PASS1.md) — a brand-
// impersonation and scam reconnaissance tool, not a scored verdict (that
// stays Phishing Detection's job). Brand Similarity is the pillar
// everything else depends on: Website/Screenshot/SSL Comparison only
// populate when it found an actual match. ----

export type DomainBrandMatchType = 'exact_official' | 'typosquat' | 'brand_suffix' | 'homograph' | 'no_match';

export interface DomainBrandSimilarity {
    matchedBrand: string | null;
    officialDomain: string | null;
    similarityScore: number;
    matchType: DomainBrandMatchType;
    explanation: string;
}

export interface DomainComparisonFinding {
    label: string;
    suspectValue: string | number;
    officialValue: string | number;
    matched: boolean;
}

export interface DomainWebsiteComparison {
    available: boolean;
    reason?: string;
    similarityScore?: number;
    findings?: DomainComparisonFinding[];
    explanation?: string;
}

export interface DomainScreenshotComparison {
    available: boolean;
    reason?: string;
    suspectScreenshotUrl?: string;
    officialScreenshotUrl?: string;
    visualSimilarityScore?: number | null;
    explanation?: string;
}

export interface DomainSslCertSummary {
    issuer: string;
    protocol: string | null;
    keyType: string | null;
    keyBits: number | null;
    sigAlg: string | null;
    validFrom: string | null;
    validTo: string | null;
    issuedDaysAgo: number | null;
    isAutomatedCa: boolean;
}

export interface DomainSslComparison {
    available: boolean;
    reason?: string;
    suspect?: DomainSslCertSummary;
    official?: DomainSslCertSummary;
    notes?: string[];
    explanation?: string;
}

export interface DomainOverview {
    domain: string;
    brandMatchSummary: string;
    matchType: DomainBrandMatchType;
    domainAgeDays: number | null;
    supportingEvidence: string[];
    reputationSummary: { phishing: string; malware: string; reputation: string } | null;
    crossLinks: { phishingDetection: string; webCheck: string };
}

export interface DomainThreatIntel {
    target?: string;
    ip?: string | null;
    blocklists?: {
        googleSafeBrowsing: string;
        spamhaus: string;
        abuseIPDB: string;
    };
    threatIntel?: {
        phishing: string;
        malware: string;
        reputation: string;
        abuseConfidenceScore: number | null;
        totalReports: number | null;
    };
    checkedAt?: string;
}

export interface DomainAiAnalysis {
    executiveSummary: string;
    technicalFindings: string[];
    overallRisk: string;
    confidenceScore: number;
    recommendations: string[];
    nextInvestigationSteps: string[];
}

// ---- Brand Intelligence (BRAND_INTELLIGENCE_PASS1.md) — brand profile
// reference entity. No scan data in this pass; identities are the official
// domains/accounts the analyst registers as ground-truth for a brand. ----

export interface BrandIdentity {
    id: number;
    brand_id: number;
    identity_type: 'domain' | 'url' | 'social_account' | 'mobile_app' | 'username';
    value: string;
    platform: string | null;
    is_primary: boolean | number;
    created_at: string;
}

export interface Brand {
    id: number;
    name: string;
    aliases_json: string[] | null;
    keywords_json: string[] | null;
    primary_color_hex: string | null;
    secondary_color_hex: string | null;
    logo_reference_url: string | null;
    logo_reference_hash: string | null;
    notes: string | null;
    created_by_user_id: number | null;
    created_at: string;
    updated_at: string;
    identityCount?: number;       // present on list responses
    identities?: BrandIdentity[]; // present on single-brand responses
}

// ---- Brand Intelligence Pass 4 — campaigns ----

export interface BrandCampaign {
    id: number;
    brand_id: number;
    job_id: number;
    name: string;
    campaign_risk: string;
    campaign_risk_score: number;
    correlation_reasons_json: string[];
    first_seen_at: string | null;
    last_seen_at: string | null;
    status: 'active' | 'dormant' | 'confirmed_takedown';
}

export interface BrandCampaignMember {
    candidate_id: number;
    value: string;
    discovery_method: string;
    risk_score: number | null;
    risk_level: string | null;
    risk_reasons_json: string[] | null;
    domain_intelligence_json: { data: DomainIntelligenceData; risk?: string } | null;
    correlation_signals_json: string[];
}

// ---- Brand Intelligence Pass 2 — async job queue + candidate results ----

// BRAND_INTELLIGENCE_PASS7.md §12/§13 — 'retryable' and 'partial' are real,
// distinct end states (see brand_scan_jobs.status in scripts/migrate.js).
export type BrandScanJobStatus =
    | 'queued' | 'discovering' | 'evaluating'
    | 'correlating' | 'scoring' | 'ai_analysis'
    | 'completed' | 'failed' | 'cancelled'
    | 'retryable' | 'partial';

export interface BrandScanJob {
    id: number;
    brand_id: number;
    brand_name?: string;
    initiated_by_user_id: number;
    status: BrandScanJobStatus;
    options_json: Record<string, unknown> | null;
    progress_current: number;
    progress_total: number;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
    /** Pass 5: LLM (or heuristic) AI analysis result, populated after ai_analysis stage */
    ai_analysis_json: BrandAiAnalysis | null;
    /** §14 — 0 until a retry has actually happened. */
    retry_count?: number;
    failure_kind?: 'none' | 'transient' | 'permanent';
}

// ---- Brand Intelligence Pass 7 — persistent campaigns + overview ----

export interface BrandPersistentCampaign {
    id: number;
    brand_id: number;
    name: string;
    first_seen_at: string | null;
    last_seen_at: string | null;
    status: 'active' | 'dormant' | 'resolved' | 'confirmed_takedown';
    historical_risk_level: string | null;
    historical_risk_score: number | null;
    current_risk_level: string | null;
    current_risk_score: number | null;
    risk_updated_at: string | null;
    member_count: number;
}

export interface BrandOverview {
    brandRiskLevel: string;
    brandRiskSource: 'latest_investigation' | 'active_persistent_campaign' | null;
    officialDomains: number;
    suspiciousDomains: number;
    impersonatingSocialAccounts: number;
    activeCampaigns: number;
    historicalCampaigns: number;
    deepScans: number;
    openAlerts: number;
    recentRiskChanges: { persistentCampaignId: number; name: string; from: string | null; to: string | null; at: string }[];
    infrastructureRelationships: number;
    hasCompletedInvestigation: boolean;
}

// ---- Brand Intelligence Pass 3 — social + logo types ----

export interface SocialClassificationEntry {
    platform: string;
    category?: string;
    handle: string;
    status: string;
    url: string;
    profile: {
        displayName: string | null;
        bio: string | null;
        avatarUrl: string | null;
    } | null;
    avatarComparison: {
        faviconSimilarity: number | null;
        logoSimilarity: number | null;
    };
    classification: 'Official' | 'Likely Official' | 'Possible Impersonation' | 'Likely Impersonation' | 'Unknown';
    confidence: number;
    reasons: string[];
}

export interface LogoSimilarityResult {
    available: boolean;
    reason?: string;
    faviconSimilarity: number | null;
    logoSimilarity: number | null;
    visualMatch: 'High' | 'Medium' | 'Low' | 'None';
    brandNameDetected: null; // OCR deferred
    explanation?: string;
    /** BRAND_INTELLIGENCE_PASS7.md §15/§16 — optional, additive; never replaces the fields above. */
    vision?: BrandVisionResult;
}

export interface BrandVisionResult {
    available: boolean;
    reason?: string;
    brandNamePresent?: boolean;
    logoPresent?: boolean;
    possibleBrandMark?: string | null;
    textSimilarity?: string | null;
    visualBrandPresence?: 'None' | 'Weak' | 'Moderate' | 'Strong';
    confidence?: 'Low' | 'Medium' | 'High';
    detail?: string | null;
    source?: string;
}

// BRAND_INTELLIGENCE_PASS7.md §17/§18 — optional, provider-backed.
export interface BrandInfrastructurePivotResult {
    available: boolean;
    provider: 'Shodan' | 'Not Configured';
    reason?: string;
    ip?: string;
    potentialInfrastructureRelationship?: boolean;
    otherHostnamesOnSameIp?: string[];
    openPorts?: number[];
    organization?: string | null;
    note?: string;
}

// ---- Brand Intelligence Pass 6 — Deep Scan result types ----

export interface DeepScanRedirectHop {
    url: string;
    status: number;
}

export interface DeepScanFormField {
    fieldClass: 'password' | 'otp' | 'phone' | 'email' | 'other';
    type: string | null;
    name: string | null;
}

export interface DeepScanForm {
    action: string | null;
    method: string;
    fields: DeepScanFormField[];
}

export interface DeepScanClickableElement {
    tag: string;
    type: string | null;
    text: string;
    href: string | null;
    isFormSubmit: boolean;
}

export interface DeepScanInteraction {
    ran: boolean;
    clickedText: string | null;
    urlBefore: string | null;
    urlAfter: string | null;
    hostnameChanged: boolean;
    error: string | null;
}

export interface DeepScanMeta {
    targetUrl: string | null;
    finalUrl: string | null;
    httpStatus: number | null;
    title: string | null;
    timestamp: string;
    success: boolean;
    error: string | null;
    redirectChain: DeepScanRedirectHop[];
    forms: DeepScanForm[];
    clickableElements: DeepScanClickableElement[];
    interaction: DeepScanInteraction | null;
}

export interface DeepScanResult {
    meta: DeepScanMeta | null;
    screenshotPath: string | null;
    afterClickScreenshotPath: string | null;
}

export interface BrandScanCandidate {
    id: number;
    job_id: number;
    candidate_type: 'domain' | 'social_account';
    value: string;
    discovery_method: string;
    status: 'pending' | 'evaluated' | 'failed' | 'skipped';
    /** Full runDomainIntelligence() result — present for domain candidates after evaluation */
    domain_intelligence_json: { data: DomainIntelligenceData; risk?: string } | null;
    /** Pass 3: per-platform social classification array — present for social_account candidates */
    social_classification_json: SocialClassificationEntry[] | null;
    /** Pass 3: logo/favicon perceptual hash comparison result — present for domain candidates */
    logo_similarity_json: LogoSimilarityResult | null;
    /** Pass 4: explainable reasons list from brandRiskEngine — populated after scoring stage */
    risk_reasons_json: string[] | null;
    /** Pass 6: on-demand Deep Scan result — null until a scan is triggered */
    deep_scan_json: DeepScanResult | null;
    risk_score: number | null;
    risk_level: string | null;
    discovered_at: string;
    evaluated_at: string | null;
    /** BRAND_INTELLIGENCE_PASS7.md §10 CASE 3 — set on a failed Deep Scan trigger; existing results/risk stay untouched. */
    deep_scan_error?: string | null;
    /** §17/§18 — null means never attempted; { available:false, provider:'Not Configured' } means attempted, no provider. */
    infrastructure_pivot_json?: BrandInfrastructurePivotResult | null;
}

// ---- Brand Intelligence Pass 5 — evidence, timeline, AI analysis ----

export interface BrandEvidence {
    id: number;
    job_id: number;
    candidate_id: number | null;
    campaign_id: number | null;
    finding: string;
    source: string;
    detection_reason: string;
    confidence: number;
    risk_contribution: number | null;
    url: string | null;
    screenshot_path: string | null;
    created_at: string | null;
    candidate_value?: string | null;
}

export interface BrandTimelineEvent {
    event_time: string;
    event_type: 'domain_discovered' | 'evidence_recorded' | 'campaign_identified' | 'campaign_active';
    source?: string;
    description: string;
}

export interface BrandTimelinePage {
    events: BrandTimelineEvent[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface BrandAiKeyFinding {
    finding: string;
    certainty: 'confirmed' | 'strong_indicator' | 'uncertain';
}

export interface BrandAiAnalysis {
    executiveSummary: string;
    overallRisk: string;
    likelyImpersonatedBrand: string | null;
    keyFindings: BrandAiKeyFinding[];
    evidenceSummary: string;
    phishingAssessment: string;
    credentialHarvestingAssessment: string;
    campaignAssessment: string;
    confidenceScore: number;
    recommendations: string[];
    nextInvestigationSteps: string[];
}

export interface BrandScanCandidatesPage {
    candidates: BrandScanCandidate[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface DomainIntelligenceData {
    domain: string;
    scanDuration: number;
    overview: DomainOverview;
    brandSimilarity: DomainBrandSimilarity;
    websiteComparison: DomainWebsiteComparison;
    screenshotComparison: DomainScreenshotComparison;
    sslComparison: DomainSslComparison;
    // Folded-in WHOIS/DNS/SSL — same fields as the module's previous
    // version, kept loosely typed (pass-through display, not consumed
    // field-by-field) to match this codebase's existing convention for
    // Web-Check's own WHOIS/DNS/SSL rendering.
    whois: Record<string, any> | null;
    dnsInfo: Record<string, any> | null;
    ssl: Record<string, any> | null;
    reputation: DomainThreatIntel | null;
    aiAnalysis?: DomainAiAnalysis;
}

// ---- IP Intelligence (IP_INTELLIGENCE.md) — reuses DomainThreatIntel and
// DomainAiAnalysis directly (identical shapes: same getThreatInfo() output,
// same AI-analysis object convention) rather than duplicating them. ----

export interface IpGeolocation {
    ip: string;
    city: string | null;
    region: string | null;
    country: string | null;
    countryCode: string | null;
    latitude: number;
    longitude: number;
    timezone: string | null;
    isp: string | null;
    org: string | null;
    asn: string | null;
    zip: string | null;
    currency: string | null;
    language: string;
}

export interface IpPortResult {
    port: number;
    service: string;
    status: 'open' | 'closed';
    dangerous: boolean;
}

export interface IpPortsInfo {
    target: string;
    scanned_ports: number;
    open_count: number;
    duration_ms: number;
    results: IpPortResult[];
}

export interface IpFirewallInfo {
    firewall: boolean;
    waf: string | null;
    headers_checked?: string[];
    confidence?: 'high' | 'low';
    // Present instead of the fields above when the target didn't respond to
    // HTTP at all — services/firewallInfo.js's own "Connection failed" state.
    error?: string;
}

export interface IpIntelligenceData {
    ip: string;
    resolvedFrom: string | null;
    scanDuration: number;
    location: IpGeolocation | null;
    threat: DomainThreatIntel | null;
    ports: IpPortsInfo | null;
    firewall: IpFirewallInfo | null;
    ptr: string | null;
    // True when every threat sub-check came back "Not Checked (Key
    // Required)" and no dangerous ports were open — distinguishes an
    // honestly-clean result from "nothing was actually checked".
    limitedVisibility: boolean;
    aiAnalysis?: DomainAiAnalysis;
}
