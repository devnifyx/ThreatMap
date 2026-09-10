import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MitreMapperPage from '../MitreMapperPage';

// P1-8 — Threat Intelligence › MITRE ATT&CK was retired into this module. It
// was a subset of the Mapper on the API side (both read
// /api/intelligence/attack/*), but its UI carried FOUR things the Mapper did
// not render: the tactic distribution bars, the recent campaign→technique
// mappings, the Related IOCs count, and the Knowledge Base panel on technique
// detail (KNOWLEDGE_BASE_PHASE2.md §12 "KNOWLEDGE TO MITRE"). A merge that
// dropped any of them would be a silent feature loss, so each is pinned here.
const { api, knowledgePanelMounts } = vi.hoisted(() => ({
    api: {
        getAttackOverview: vi.fn(),
        getAttackTechniques: vi.fn(),
        getMitreTechniqueDetail: vi.fn(),
    },
    knowledgePanelMounts: [] as [string, string][],
}));

vi.mock('../../../services/api', () => ({
    // Explicit, not a Proxy: vitest enumerates a module mock's exports.
    // Only the three the merge depends on are asserted; the rest of the
    // workbench resolves empty because it is not what this file tests.
    getAttackOverview: api.getAttackOverview,
    getAttackTechniques: api.getAttackTechniques,
    getMitreDashboard: vi.fn().mockResolvedValue({ items: [] }),
    getMitreTactics: vi.fn().mockResolvedValue({ items: [] }),
    getMitreTechniqueDetail: api.getMitreTechniqueDetail,
    searchMitreEntities: vi.fn().mockResolvedValue({ items: [] }),
    getMitreEntityView: vi.fn().mockResolvedValue({ items: [] }),
    getMitreEntityEvidence: vi.fn().mockResolvedValue({ items: [] }),
    getMitreConflicts: vi.fn().mockResolvedValue({ items: [] }),
    createMitreMapping: vi.fn().mockResolvedValue({ items: [] }),
    reviewMitreMapping: vi.fn().mockResolvedValue({ items: [] }),
    removeMitreMapping: vi.fn().mockResolvedValue({ items: [] }),
    getMitreMappingsPage: vi.fn().mockResolvedValue({ items: [] }),
    searchMitre: vi.fn().mockResolvedValue({ items: [] }),
    mitreMapperExportUrl: () => '',
    getMitreSuggestionsSummary: vi.fn().mockResolvedValue({ items: [] }),
    getMitreSuggestionsQueue: vi.fn().mockResolvedValue({ items: [] }),
    recalculateMitreSuggestions: vi.fn().mockResolvedValue({ items: [] }),
    bulkReviewMitreMappings: vi.fn().mockResolvedValue({ items: [] }),
    getMitreMatrixData: vi.fn().mockResolvedValue({ items: [] }),
    getMitreCoverage: vi.fn().mockResolvedValue({ items: [] }),
    getMalwareFamilyCoverage: vi.fn().mockResolvedValue({ items: [] }),
    getMitreEntityEvolution: vi.fn().mockResolvedValue({ items: [] }),
    compareMitreMalwareSamples: vi.fn().mockResolvedValue({ items: [] }),
    reviewMalwareSampleTechnique: vi.fn().mockResolvedValue({ items: [] }),
    getMitreDetectionCoverage: vi.fn().mockResolvedValue({ items: [] }),
    getMitreDetectionGaps: vi.fn().mockResolvedValue({ items: [] }),
    getMitreHeatmap: vi.fn().mockResolvedValue({ items: [] }),
    getMitreTechniqueTrend: vi.fn().mockResolvedValue({ items: [] }),
    getMitreEnhancedComparison: vi.fn().mockResolvedValue({ items: [] }),
    compareMitreTechniques: vi.fn().mockResolvedValue({ items: [] }),
    generateMitreAiAnalysis: vi.fn().mockResolvedValue({ items: [] }),
    generateMitreAiTechniqueSuggestion: vi.fn().mockResolvedValue({ items: [] }),
    getMitreAiSuggestions: vi.fn().mockResolvedValue({ items: [] }),
    acceptMitreAiSuggestion: vi.fn().mockResolvedValue({ items: [] }),
    rejectMitreAiSuggestion: vi.fn().mockResolvedValue({ items: [] }),
    getMitreAiActionCandidates: vi.fn().mockResolvedValue({ items: [] }),
    proposeMitreAiAction: vi.fn().mockResolvedValue({ items: [] }),
    approveMitreAiAction: vi.fn().mockResolvedValue({ items: [] }),
    rejectMitreAiAction: vi.fn().mockResolvedValue({ items: [] }),
    listMitreAiActions: vi.fn().mockResolvedValue({ items: [] }),
}));

vi.mock('../../KnowledgeBase/KnowledgeContextPanel', () => ({
    // Rendered for real elsewhere; here we only need to prove the merged
    // detail view still mounts it with the technique's own identity.
    default: ({ entityType, entityId }: { entityType: string; entityId: string }) => {
        knowledgePanelMounts.push([entityType, String(entityId)]);
        return <div data-testid="knowledge-panel" />;
    },
}));

const OVERVIEW = {
    techniquesObserved: 12,
    tacticsObserved: 4,
    tacticCounts: [{ tactic: 'Initial Access', count: 7 }, { tactic: 'Execution', count: 3 }],
    recentMappings: [{ campaign_name: 'Operation Kite', technique_id: 'T1566', technique_name: 'Phishing', tactic: 'Initial Access', tactics: ['Initial Access'] }],
};
const TECHNIQUE = {
    technique_id: 'T1566', name: 'Phishing', tactic: 'Initial Access', tactics: ['Initial Access'],
    observed_count: 5, related_iocs_count: 9,
};

beforeEach(() => {
    api.getAttackOverview.mockResolvedValue(OVERVIEW);
    api.getAttackTechniques.mockResolvedValue({ items: [TECHNIQUE], total: 1, page: 1, pageSize: 20 });
    api.getMitreTechniqueDetail.mockResolvedValue({
        ...TECHNIQUE, description: 'Adversaries may send phishing messages.', url: null,
        parentTechniqueId: null, mappedEntities: [], mappingSourceCount: 0,
        mappingCounts: { suggested: 0, confirmed: 0, rejected: 0 },
        relatedCampaigns: [], relatedIocs: [],
        relatedThreatActors: [{ type: 'threat_actor', id: '3', label: 'Kimsuky' }],
        relatedMalware: [],
    });
    knowledgePanelMounts.length = 0;
});
afterEach(() => cleanup());

const openExplorer = async () => {
    render(<MitreMapperPage />);
    fireEvent.click(screen.getByText('Technique Explorer'));
    await screen.findByText('T1566');
};

describe('P1-8 — the retired ATT&CK section\'s features survive the merge', () => {
    it('names the module for the catalogue it now owns', () => {
        render(<MitreMapperPage />);
        expect(screen.getByRole('heading', { name: 'MITRE ATT&CK' })).toBeInTheDocument();
    });

    it('renders the tactic distribution bars, not just the tactic dropdown', async () => {
        await openExplorer();
        expect(screen.getByText('Tactics (by observed technique mappings)')).toBeInTheDocument();
        // The page already fetched tacticCounts but used them only to fill the
        // filter dropdown; the bars are what the retired section drew.
        const bars = document.querySelectorAll('.ti-bar-row');
        expect(bars.length).toBe(OVERVIEW.tacticCounts.length);
    });

    it('renders the recent campaign→technique mappings', async () => {
        await openExplorer();
        expect(screen.getByText('Recent Technique Mappings')).toBeInTheDocument();
        expect(screen.getByText(/Operation Kite/)).toBeInTheDocument();
    });

    it('shows the Related IOCs count in the technique list', async () => {
        await openExplorer();
        const cells = Array.from(screen.getByText('T1566').closest('tr')!.querySelectorAll('td')).map((c) => c.textContent);
        expect(cells).toContain('9');
    });

    it('hosts the Knowledge Base panel on technique detail', async () => {
        await openExplorer();
        fireEvent.click(screen.getByText('T1566'));
        await waitFor(() => expect(api.getMitreTechniqueDetail).toHaveBeenCalledWith('T1566'));
        // KNOWLEDGE_BASE_PHASE2.md §12 — the panel keys off the technique id.
        await waitFor(() => expect(knowledgePanelMounts).toContainEqual(['attack_technique', 'T1566']));
    });

    it('opens a deep-linked technique directly, so #/ti-attack links still land on it', async () => {
        render(<MitreMapperPage initialTechniqueId="T1566" />);
        await waitFor(() => expect(api.getMitreTechniqueDetail).toHaveBeenCalledWith('T1566'));
    });
});
