import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ThreatActorsSection from '../ThreatActorsSection';

// P1-7 — "Threat Actors" and "APT Group Intelligence" were two nav entries,
// two lists and two detail modals over the SAME `threat_actors` rows, split
// only by the `is_apt_group` boolean. These tests pin the merged module:
// one list covering every actor, APT as a filter, and — carried over from the
// deleted ThreatActorsSection.aptLink test — the rule that an actor's
// classification is READ from the stored flag and never inferred.
const { getAptGroups, baseActor } = vi.hoisted(() => ({
    getAptGroups: vi.fn(),
    baseActor: {
        id: 1, name: 'Kimsuky', description: null, status: 'active', confidence: 'High',
        motivation: null, target_sectors: [], target_regions: [], source_type: 'otx',
        first_seen_at: null, last_seen_at: null,
    },
}));

vi.mock('../../../../services/api', () => ({
    getAptGroups,
    getAptGroupDashboard: vi.fn().mockResolvedValue(null),
    getAptGroupActivity: vi.fn().mockResolvedValue([]),
    getAptActivityDigest: vi.fn().mockResolvedValue(null),
    getAptLeaderboard: vi.fn().mockResolvedValue({ items: [] }),
    getAptAttributionConflicts: vi.fn().mockResolvedValue([]),
    searchAptGroups: vi.fn().mockResolvedValue({ items: [] }),
    createAptGroup: vi.fn(),
    createAptGroupMonitor: vi.fn(),
    getAptGroup: vi.fn(),
    getAptGroupTimeline: vi.fn().mockResolvedValue({ items: [] }),
    getAptGroupRelatedAlerts: vi.fn().mockResolvedValue({ items: [] }),
    getAptGroupScorecard: vi.fn().mockResolvedValue(null),
    getAptAttackAnalytics: vi.fn().mockResolvedValue(null),
    getAptRiskEvolution: vi.fn().mockResolvedValue({ items: [] }),
    getAptAttributionEvolution: vi.fn().mockResolvedValue({ items: [] }),
    getAptEvidenceGaps: vi.fn().mockResolvedValue({ items: [] }),
    getAptCrossCorrelation: vi.fn().mockResolvedValue({ items: [] }),
    getCampaignEvolution: vi.fn().mockResolvedValue({ items: [] }),
    getEvidence: vi.fn().mockResolvedValue({ items: [] }),
    getMonitors: vi.fn().mockResolvedValue({ items: [] }),
    getMonitorEvents: vi.fn().mockResolvedValue({ items: [] }),
    getEntityRisk: vi.fn().mockResolvedValue(null),
    getEntityAssessments: vi.fn().mockResolvedValue([]),
    createAssessment: vi.fn(),
}));

beforeEach(() => {
    getAptGroups.mockReset();
    getAptGroups.mockResolvedValue({
        items: [
            { ...baseActor, id: 1, name: 'Kimsuky', is_apt_group: true },
            { ...baseActor, id: 2, name: 'Loose Crew', is_apt_group: false },
        ],
        total: 2, page: 1, pageSize: 20,
    });
});
afterEach(() => cleanup());

const renderSection = () => render(<ThreatActorsSection onOpenEntity={vi.fn()} />);

describe('P1-7 — one Threat Actors module over one table', () => {
    it('defaults to every actor, not just the APT-classified subset', async () => {
        renderSection();
        await screen.findByText('Kimsuky');
        expect(getAptGroups).toHaveBeenCalledWith(expect.objectContaining({ classification: 'all' }));
        // A non-APT actor is reachable here — it previously required a
        // separate menu entry and a separate, weaker detail view.
        expect(screen.getByText('Loose Crew')).toBeInTheDocument();
    });

    it('reads each actor\'s classification from the stored flag, never inferring it', async () => {
        renderSection();
        await screen.findByText('Kimsuky');
        const cellsFor = (name: string) =>
            Array.from(screen.getByText(name).closest('tr')!.querySelectorAll('td')).map((c) => c.textContent);
        expect(cellsFor('Kimsuky')).toContain('APT Group');
        expect(cellsFor('Loose Crew')).toContain('Threat Actor');
    });

    it('narrows to the APT subset through the filter rather than a second module', async () => {
        renderSection();
        await screen.findByText('Kimsuky');
        fireEvent.change(screen.getByLabelText('Classification'), { target: { value: 'apt' } });
        await waitFor(() => {
            expect(getAptGroups).toHaveBeenCalledWith(expect.objectContaining({ classification: 'apt' }));
        });
    });

    it('offers a non-APT slice too, so the flag is filterable in both directions', async () => {
        renderSection();
        await screen.findByText('Kimsuky');
        fireEvent.change(screen.getByLabelText('Classification'), { target: { value: 'non-apt' } });
        await waitFor(() => {
            expect(getAptGroups).toHaveBeenCalledWith(expect.objectContaining({ classification: 'non-apt' }));
        });
    });

    it('hides the APT-population panels unless the APT filter is on', async () => {
        // Digest/Leaderboard/Attribution Conflicts aggregate over is_apt_group = 1
        // rows only, so above an all-actor list they would disagree with it.
        renderSection();
        await screen.findByText('Kimsuky');
        // DigestBlock renders its header unconditionally, so it is a stable
        // marker for "the APT panels are mounted" (the leaderboard and
        // conflicts blocks return null when they have no rows).
        expect(screen.queryByText('APT Activity Digest')).toBeNull();
        fireEvent.change(screen.getByLabelText('Classification'), { target: { value: 'apt' } });
        await waitFor(() => expect(screen.getByText('APT Activity Digest')).toBeInTheDocument());
    });
});
