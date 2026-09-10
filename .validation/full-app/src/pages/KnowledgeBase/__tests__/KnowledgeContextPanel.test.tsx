// KNOWLEDGE_BASE_PHASE2.md §26 "KNOWLEDGE CONTEXT PANEL" §46 — a component
// test for the ONE reusable panel every intelligence page mounts, covering
// §24 "KNOWLEDGE GAP DETECTION" (never auto-creates), §7/§23 "explainable
// recommendation" (reasons visible), and §25 "KNOWLEDGE COMPLETENESS"
// (coverage indicator). The real /api/knowledge/context call is mocked —
// the backend behavior itself is covered by services/__tests__/
// knowledgeBasePhase2.test.js against a real server + database.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';

const getKnowledgeContext = vi.fn();
const askKnowledgeAi = vi.fn();
const submitKnowledgeFeedback = vi.fn();
const generateKnowledgeDraft = vi.fn();

vi.mock('../../../services/api', () => ({
    getKnowledgeContext: (...args: unknown[]) => getKnowledgeContext(...args),
    askKnowledgeAi: (...args: unknown[]) => askKnowledgeAi(...args),
    submitKnowledgeFeedback: (...args: unknown[]) => submitKnowledgeFeedback(...args),
    generateKnowledgeDraft: (...args: unknown[]) => generateKnowledgeDraft(...args)
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

import KnowledgeContextPanel from '../KnowledgeContextPanel';

describe('KnowledgeContextPanel', () => {
    it('§24 "KNOWLEDGE GAP DETECTION" — shows a real Knowledge Gap and a Create action, never auto-creating anything', async () => {
        getKnowledgeContext.mockResolvedValue({
            entity: { type: 'threat_actor', id: '1', label: 'Kimsuky' },
            relatedKnowledge: [], knowledgeGap: true,
            coverage: { profile: false, techniques: false, campaigns: false, malware: false, detection: false, mitigation: false },
            sources: [], references: [], feedback: {}
        });
        const onCreate = vi.fn();
        render(<KnowledgeContextPanel entityType="threat_actor" entityId="1" entityLabel="Kimsuky" onCreateKnowledgeEntry={onCreate} />);

        expect(await screen.findByText(/Knowledge Gap/)).toBeTruthy();
        const createBtn = screen.getByRole('button', { name: /Create Knowledge Entry/i });
        fireEvent.click(createBtn);
        expect(onCreate).toHaveBeenCalledWith({ title: 'Kimsuky Overview', category: 'Threat Actor', relatedEntityType: 'threat_actor', relatedEntityId: '1' });
        // Nothing was created automatically — only the prefilled handoff callback fired.
        expect(getKnowledgeContext).toHaveBeenCalledTimes(1);
    });

    it('§7/§23 "explainable" — every recommendation shows its real match reason(s), never hidden', async () => {
        getKnowledgeContext.mockResolvedValue({
            entity: { type: 'attack_technique', id: 'T1566', label: 'T1566 Phishing' },
            relatedKnowledge: [{
                id: 42, title: 'Phishing Investigation Guide', slug: 'phishing-investigation-guide', summary: null, content: null,
                category: 'Phishing', confidence: 'Medium', status: 'published', current_revision: 1,
                created_by_user_id: 1, author_username: 'admin', updated_by_user_id: null, published_by_user_id: 1,
                created_at: null, updated_at: null, published_at: null, archived_at: null, last_reviewed_at: null, last_reviewed_by_user_id: null,
                tags: ['phishing'], matchReasons: [{ type: 'tag', detail: 'phishing' }]
            }],
            knowledgeGap: false,
            coverage: { profile: true, techniques: false, campaigns: false, malware: false, detection: false, mitigation: false },
            sources: [], references: [], feedback: {}
        });

        render(<KnowledgeContextPanel entityType="attack_technique" entityId="T1566" entityLabel="T1566 Phishing" />);

        expect(await screen.findByText(/Phishing Investigation Guide/)).toBeTruthy();
        expect(screen.getByText(/Tag: phishing/)).toBeTruthy(); // the real reason, visible, not hidden
        expect(screen.queryByText(/Knowledge Gap/)).toBeNull();
    });

    it('§43/§44 CASE 4 — a restricted entity never leaks its data through the panel', async () => {
        getKnowledgeContext.mockResolvedValue({
            entity: { type: 'report', id: '9', label: 'Restricted Entity' },
            relatedKnowledge: [], knowledgeGap: false,
            coverage: { profile: false, techniques: false, campaigns: false, malware: false, detection: false, mitigation: false },
            sources: [], references: [], feedback: {}, restricted: true
        });
        render(<KnowledgeContextPanel entityType="report" entityId="9" entityLabel="Restricted Entity" />);
        expect(await screen.findByText(/Restricted Entity/)).toBeTruthy();
    });

    it('§31 "KNOWLEDGE FEEDBACK" — Useful/Not Relevant submits real feedback for the (entry, entity) pair', async () => {
        getKnowledgeContext.mockResolvedValue({
            entity: { type: 'malware', id: '5', label: 'Gomir' },
            relatedKnowledge: [{
                id: 7, title: 'Gomir Analysis', slug: 'gomir-analysis', summary: null, content: null,
                category: 'Malware', confidence: 'High', status: 'published', current_revision: 1,
                created_by_user_id: 1, author_username: 'admin', updated_by_user_id: null, published_by_user_id: 1,
                created_at: null, updated_at: null, published_at: null, archived_at: null, last_reviewed_at: null, last_reviewed_by_user_id: null,
                tags: [], matchReasons: [{ type: 'entity', detail: 'About' }]
            }],
            knowledgeGap: false,
            coverage: { profile: true, techniques: false, campaigns: false, malware: false, detection: false, mitigation: false },
            sources: [], references: [], feedback: {}
        });
        submitKnowledgeFeedback.mockResolvedValue({});

        render(<KnowledgeContextPanel entityType="malware" entityId="5" entityLabel="Gomir" />);
        const usefulBtn = await screen.findByRole('button', { name: /Useful/ });
        fireEvent.click(usefulBtn);
        await waitFor(() => expect(submitKnowledgeFeedback).toHaveBeenCalledWith(7, 'malware', '5', 'useful'));
    });

    it('KNOWLEDGE_BASE_PHASE3.md §13/§14 "AI DRAFTING" — drafts from exactly the entries already shown, then opens the new draft', async () => {
        getKnowledgeContext.mockResolvedValue({
            entity: { type: 'threat_actor', id: '1', label: 'Kimsuky' },
            relatedKnowledge: [{
                id: 42, title: 'Phishing Investigation Guide', slug: 'phishing-investigation-guide', summary: null, content: null,
                category: 'Phishing', confidence: 'Medium', status: 'published', current_revision: 1,
                created_by_user_id: 1, author_username: 'admin', updated_by_user_id: null, published_by_user_id: 1,
                created_at: null, updated_at: null, published_at: null, archived_at: null, last_reviewed_at: null, last_reviewed_by_user_id: null,
                tags: ['phishing'], matchReasons: [{ type: 'tag', detail: 'phishing' }]
            }],
            knowledgeGap: false,
            coverage: { profile: true, techniques: false, campaigns: false, malware: false, detection: false, mitigation: false },
            sources: [], references: [], feedback: {}
        });
        generateKnowledgeDraft.mockResolvedValue({ id: 99, slug: 'kimsuky-overview', citedEntryIds: [42], conflictNote: null, note: 'AI-generated draft.' });
        const onOpenEntry = vi.fn();

        render(<KnowledgeContextPanel entityType="threat_actor" entityId="1" entityLabel="Kimsuky" onOpenEntry={onOpenEntry} />);
        const draftBtn = await screen.findByRole('button', { name: /AI Draft Knowledge Entry/i });
        fireEvent.click(draftBtn);

        await waitFor(() => expect(generateKnowledgeDraft).toHaveBeenCalledWith({
            entityType: 'threat_actor', entityId: '1', entityLabel: 'Kimsuky', selectedEntryIds: [42]
        }));
        await waitFor(() => expect(onOpenEntry).toHaveBeenCalledWith(99));
    });
});
