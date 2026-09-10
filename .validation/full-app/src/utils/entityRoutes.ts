// EVIDENCE_PHASE1.md §16/§26/§27 "ENTITY LINK" / "SOURCE NAVIGATION" /
// "ENTITY NAVIGATION" — "Use existing entity routes. Do not create
// duplicate entities." Extracted from TimelinePage.tsx's own identical
// mapping (TIMELINE_PHASE1.md §14) so Timeline and Evidence never drift
// into two different opinions about where an entity type's real page is.
export const ENTITY_TYPE_VIEW: Record<string, string> = {
    ioc: 'ti-iocs', campaign: 'ti-campaigns', threat_actor: 'ti-actors',
    malware: 'malware-analysis', malware_sample: 'malware-analysis',
    vulnerability: 'ti-vulnerabilities', attack_technique: 'ti-attack',
    report: 'threat-briefs', workspace: 'ti-workspace',
    company: 'osint-company-intel', image: 'osint-image-intel',
    social_investigation: 'osint-social-media-intel', social_account: 'osint-social-media-intel',
    brand: 'osint-brand-intel', telegram_source: 'osint-telegram-intel', telegram_message: 'osint-telegram-intel',
    knowledge_entry: 'knowledge-base', alert: 'mon-alert-center', monitor: 'mon-overview', case: 'cases',
};
