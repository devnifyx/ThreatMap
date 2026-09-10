import { describe, it, expect } from 'vitest';
import { hedgedRelationshipLabel } from '../ThreatActorsSection';

// APT_GROUP_PHASE1.md §41 "IMPORTANT TEST CASES" 3-7 — the DISPLAY label an
// APT profile shows for each relationship type must stay hedged regardless
// of the raw relationship_type/basis already stored on entity_relationships.
describe('hedgedRelationshipLabel (CASE 3-7)', () => {
    it('CASE 3 — campaign relationship reads "Associated Campaign"', () => {
        expect(hedgedRelationshipLabel('campaign', 'observed')).toBe('Associated Campaign');
    });

    it('CASE 4 — malware relationship reads "Associated Malware", never "Owned Malware"', () => {
        expect(hedgedRelationshipLabel('malware', 'observed')).toBe('Associated Malware');
        expect(hedgedRelationshipLabel('malware', 'inferred')).not.toMatch(/owned/i);
    });

    it('CASE 5 — vulnerability relationship reads "Associated Vulnerability", never "Confirmed Exploitation"', () => {
        expect(hedgedRelationshipLabel('vulnerability', 'observed')).toBe('Associated Vulnerability');
        expect(hedgedRelationshipLabel('vulnerability', 'observed')).not.toMatch(/confirmed exploitation/i);
    });

    it('CASE 6 — Telegram mention reads "Observed/Potential Telegram Relationship", never "Confirmed Telegram Operator"', () => {
        expect(hedgedRelationshipLabel('telegram_source', 'observed')).toBe('Observed Telegram Relationship');
        expect(hedgedRelationshipLabel('telegram_source', 'inferred')).toBe('Potential Telegram Relationship');
        expect(hedgedRelationshipLabel('telegram_source', 'observed')).not.toMatch(/confirmed.*operator/i);
    });

    it('CASE 7 — Social Media signal reads "Potential Social Relationship" when inferred, never "Confirmed Identity"', () => {
        expect(hedgedRelationshipLabel('social_account', 'inferred')).toBe('Potential Social Relationship');
        expect(hedgedRelationshipLabel('social_account', 'observed')).not.toMatch(/confirmed identity/i);
    });

    it('unknown/other entity types degrade to a basis-qualified generic label, never an unqualified claim', () => {
        expect(hedgedRelationshipLabel('company', 'observed')).toBe('Observed Relationship');
        expect(hedgedRelationshipLabel('brand', 'inferred')).toBe('Potential Relationship');
    });
});
