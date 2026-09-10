// ASK_AI_PHASE1.md — a component smoke test for the page that replaces the
// former "Ask AI is planned for a future update" placeholder. Real backend
// behavior is covered by services/__tests__/askAiRoutes.test.js (real
// server + real DB) and services/ai/askAi/__tests__/ (intent/entity unit
// tests) — this only verifies the UI wires up correctly.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';

const askAi = vi.fn();
const getAskAiConversations = vi.fn();
const createAskAiConversation = vi.fn();
const getAskAiConversation = vi.fn();
const deleteAskAiConversation = vi.fn();
const approveAskAiAction = vi.fn();
const rejectAskAiAction = vi.fn();
const runAskAiTool = vi.fn();
const getAskAiJob = vi.fn();

vi.mock('../../../services/api', () => ({
    askAi: (...a: unknown[]) => askAi(...a),
    getAskAiConversations: (...a: unknown[]) => getAskAiConversations(...a),
    createAskAiConversation: (...a: unknown[]) => createAskAiConversation(...a),
    getAskAiConversation: (...a: unknown[]) => getAskAiConversation(...a),
    deleteAskAiConversation: (...a: unknown[]) => deleteAskAiConversation(...a),
    approveAskAiAction: (...a: unknown[]) => approveAskAiAction(...a),
    rejectAskAiAction: (...a: unknown[]) => rejectAskAiAction(...a),
    runAskAiTool: (...a: unknown[]) => runAskAiTool(...a),
    getAskAiJob: (...a: unknown[]) => getAskAiJob(...a)
}));
// Same convention AppShell's own tests already use (see
// AppShell.iocAnalyzerNav.test.tsx) — a real lucide-react icon renders fine
// in the actual app, but under this project's Vitest setup it throws
// "Cannot read properties of null (reading 'useContext')" (two live React
// instances disagreeing on the hook dispatcher — a pre-existing gap in this
// repo's Vitest React resolution, not specific to Ask AI). Stub icons out
// the same way every other component test with icons already does.
vi.mock('lucide-react', () => ({
    Bot: () => null, Sparkles: () => null, Send: () => null, PlusCircle: () => null
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

import AskAIPage from '../AskAIPage';

describe('AskAIPage — replaces the former placeholder with a real grounded chat', () => {
    it('renders the empty state (never "planned for a future update")', async () => {
        getAskAiConversations.mockResolvedValue([]);
        render(<AskAIPage />);
        expect(screen.getByText('Ask AI')).toBeTruthy();
        expect(screen.queryByText(/planned for a future update/i)).toBeNull();
        expect(await screen.findByText(/ask anything about your intelligence/i)).toBeTruthy();
    });

    it('§CASE1 sending a question shows the real grounded answer with sources and suggested questions', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({
            conversationId: 42, answer: 'Kimsuky is associated with several malware families.',
            sources: [{ label: 'APT Group Intelligence' }], entities: [{ type: 'threat_actor', id: '25', label: 'Kimsuky' }],
            confidence: 'High', suggestedQuestions: ['What malware is linked to it?'], queryType: 'APT_SUMMARY',
            context: { type: 'threat_actor', id: '25', label: 'Kimsuky', usedAmbientContext: false },
            aiProvider: 'openai', resultStatus: 'answered'
        });
        getAskAiConversation.mockResolvedValue({
            id: 42, title: 'What do we know about Kimsuky?', created_at: null, updated_at: null,
            messages: [
                { id: 1, conversation_id: 42, role: 'user', content: 'What do we know about Kimsuky?', sources: [], entities: [], suggestedQuestions: [], confidence: null, queryType: null, contextType: null, contextEntityId: null, aiProvider: null, resultStatus: null, created_at: null },
                { id: 2, conversation_id: 42, role: 'assistant', content: 'Kimsuky is associated with several malware families.', sources: [{ label: 'APT Group Intelligence' }], entities: [{ type: 'threat_actor', id: '25', label: 'Kimsuky' }], suggestedQuestions: ['What malware is linked to it?'], confidence: 'High', queryType: 'APT_SUMMARY', contextType: null, contextEntityId: null, aiProvider: 'openai', resultStatus: 'answered', created_at: null }
            ]
        });

        render(<AskAIPage />);
        const textarea = await screen.findByPlaceholderText('Ask something...');
        fireEvent.change(textarea, { target: { value: 'What do we know about Kimsuky?' } });
        fireEvent.click(screen.getByText('Send'));

        await waitFor(() => expect(askAi).toHaveBeenCalledWith('What do we know about Kimsuky?', { conversationId: null, pageContext: null }));
        expect(await screen.findByText('Kimsuky is associated with several malware families.')).toBeTruthy();
        expect(screen.getByText('APT Group Intelligence')).toBeTruthy();
        expect(screen.getByText('What malware is linked to it?')).toBeTruthy();
    });

    it('§16/§52 clicking a source navigates to the mapped module', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({ conversationId: 1, answer: 'x', sources: [{ label: 'APT Group Intelligence' }], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'ENTITY_LOOKUP', context: { type: 'global' }, aiProvider: 'heuristic', resultStatus: 'answered' });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [
            { id: 1, conversation_id: 1, role: 'user', content: 'x', sources: [], entities: [], suggestedQuestions: [], confidence: null, queryType: null, contextType: null, contextEntityId: null, aiProvider: null, resultStatus: null, created_at: null },
            { id: 2, conversation_id: 1, role: 'assistant', content: 'x', sources: [{ label: 'APT Group Intelligence' }], entities: [], suggestedQuestions: [], confidence: 'Low', queryType: 'ENTITY_LOOKUP', contextType: null, contextEntityId: null, aiProvider: 'heuristic', resultStatus: 'answered', created_at: null }
        ] });

        const onNavigate = vi.fn();
        render(<AskAIPage onNavigate={onNavigate} />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'x' } });
        fireEvent.click(screen.getByText('Send'));
        const chip = await screen.findByText('APT Group Intelligence');
        fireEvent.click(chip);
        expect(onNavigate).toHaveBeenCalledWith('ti-actors'); // P1-7 — one Threat Actors module
    });

    it('§45 disables Send while a request is active', async () => {
        getAskAiConversations.mockResolvedValue([]);
        let resolveAsk: (v: any) => void;
        askAi.mockReturnValue(new Promise((resolve) => { resolveAsk = resolve; }));

        render(<AskAIPage />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'x' } });
        fireEvent.click(screen.getByText('Send'));
        expect((screen.getByText('Sending…') as HTMLButtonElement).disabled).toBe(true);
        resolveAsk!({ conversationId: 1, answer: 'x', sources: [], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'ENTITY_LOOKUP', context: { type: 'global' }, aiProvider: 'heuristic', resultStatus: 'answered' });
    });

    it('§41 an unavailable AI service shows a clear error, never a fabricated answer', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockRejectedValue(new Error('Ask AI is temporarily unavailable'));
        render(<AskAIPage />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'x' } });
        fireEvent.click(screen.getByText('Send'));
        expect(await screen.findByText('Ask AI is temporarily unavailable')).toBeTruthy();
    });
});

describe('AskAIPage — ASK_AI_PHASE2.md §75 "UI" additions', () => {
    it('§46 an untouched Mode Selector never adds a "mode" key to the request (Phase 1 request shape unchanged)', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({ conversationId: 1, answer: 'x', sources: [], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'ENTITY_LOOKUP', context: { type: 'global' }, aiProvider: 'heuristic', resultStatus: 'answered' });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [] });
        render(<AskAIPage />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'x' } });
        fireEvent.click(screen.getByText('Send'));
        await waitFor(() => expect(askAi).toHaveBeenCalledWith('x', { conversationId: null, pageContext: null }));
    });

    it('§46 selecting a mode threads it into the request; clicking it again clears it', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({ conversationId: 1, answer: 'x', sources: [], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'ENTITY_LOOKUP', context: { type: 'global' }, aiProvider: 'heuristic', resultStatus: 'answered' });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [] });
        render(<AskAIPage />);
        fireEvent.click(await screen.findByText('Executive'));
        fireEvent.change(screen.getByPlaceholderText('Ask something...'), { target: { value: 'x' } });
        fireEvent.click(screen.getByText('Send'));
        await waitFor(() => expect(askAi).toHaveBeenCalledWith('x', { conversationId: null, pageContext: null, mode: 'executive' }));
    });

    it('§6/§7 renders a real relationship path chain from the live answer', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({
            conversationId: 1, answer: 'Kimsuky connects to Gomir via Campaign X.', sources: [], entities: [], confidence: 'Medium', suggestedQuestions: [],
            queryType: 'RELATIONSHIP_PATH', context: { type: 'global' }, aiProvider: 'heuristic', resultStatus: 'answered',
            relationshipPath: { supported: true, paths: [{ from: { type: 'threat_actor', id: '1', label: 'Kimsuky' }, to: { type: 'malware', id: '2', label: 'Gomir' }, found: true, hops: [{ from: { type: 'threat_actor', id: '1', label: 'Kimsuky' }, to: { type: 'campaign', id: '9', label: 'Campaign X' }, relationshipType: 'uses', basis: 'observed', confidence: 'High' }, { from: { type: 'campaign', id: '9', label: 'Campaign X' }, to: { type: 'malware', id: '2', label: 'Gomir' }, relationshipType: 'uses', basis: 'observed', confidence: 'High' }] }] }
        });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [] });
        render(<AskAIPage />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'What connects Kimsuky and Gomir?' } });
        fireEvent.click(screen.getByText('Send'));
        expect(await screen.findByText('Relationship Path')).toBeTruthy();
        expect(screen.getByText('Kimsuky')).toBeTruthy();
        expect(screen.getByText('Campaign X')).toBeTruthy();
    });

    it('§30/§31/§32 renders recommendations with a real reason and an "Open Entity" action button', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({
            conversationId: 1, answer: 'x', sources: [], entities: [], confidence: 'Medium', suggestedQuestions: [], queryType: 'APT_SUMMARY', context: { type: 'threat_actor', id: '1', label: 'Kimsuky' }, aiProvider: 'heuristic', resultStatus: 'answered',
            recommendations: [{ action: 'Review related campaign', targetType: 'campaign', targetId: '9', targetLabel: 'Campaign X', reason: 'Related campaign discovered via the relationship graph.' }]
        });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [] });
        const onNavigate = vi.fn();
        render(<AskAIPage onNavigate={onNavigate} />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'What do we know about Kimsuky?' } });
        fireEvent.click(screen.getByText('Send'));
        expect(await screen.findByText('Related campaign discovered via the relationship graph.')).toBeTruthy();
        fireEvent.click(screen.getByText('Open Entity'));
        expect(onNavigate).toHaveBeenCalledWith('ti-campaigns');
    });

    it('§24/§CASE6 a restricted comparison side is shown as restricted, never its content', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({
            conversationId: 1, answer: 'x', sources: [], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'COMPARE', context: { type: 'global' }, aiProvider: 'heuristic', resultStatus: 'answered',
            comparison: { type: 'generic', supported: true, a: { label: 'Case A', restricted: false, riskLevel: 'High' }, b: { id: '2', restricted: true } }
        });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [] });
        render(<AskAIPage />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'Compare Case A and Case B' } });
        fireEvent.click(screen.getByText('Send'));
        expect(await screen.findAllByText('Restricted / Not Available')).toHaveLength(1);
    });
});

describe('AskAIPage — ASK_AI_PHASE3.md §50/§75 "OPERATIONAL AI ANALYST" additions', () => {
    it('§4 an untouched Operational Mode Selector never adds "operationalMode" to the request', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({ conversationId: 1, answer: 'x', sources: [], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'ENTITY_LOOKUP', context: { type: 'global' }, aiProvider: 'heuristic', resultStatus: 'answered' });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [] });
        render(<AskAIPage />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'x' } });
        fireEvent.click(screen.getByText('Send'));
        await waitFor(() => expect(askAi).toHaveBeenCalledWith('x', { conversationId: null, pageContext: null }));
    });

    it('§4 selecting an operational mode threads it into the request', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({ conversationId: 1, answer: 'x', sources: [], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'ENTITY_LOOKUP', context: { type: 'global' }, aiProvider: 'heuristic', resultStatus: 'answered' });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [] });
        render(<AskAIPage />);
        fireEvent.click(await screen.findByText('Threat Hunt'));
        fireEvent.change(screen.getByPlaceholderText('Ask something...'), { target: { value: 'x' } });
        fireEvent.click(screen.getByText('Send'));
        await waitFor(() => expect(askAi).toHaveBeenCalledWith('x', { conversationId: null, pageContext: null, operationalMode: 'threat_hunt' }));
    });

    it('§5-§7 renders an investigation plan with a per-step Run button that calls the read-only tool endpoint', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({
            conversationId: 1, answer: 'x', sources: [], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'ENTITY_LOOKUP', context: { type: 'ioc', id: '1', label: 'example.com' }, aiProvider: 'heuristic', resultStatus: 'answered',
            operationalMode: 'investigate',
            investigationPlan: { entity: { type: 'ioc', id: '1', label: 'example.com' }, steps: [{ label: 'Review Domain Intelligence', toolName: 'getEntity', params: { entityType: 'ioc', entityId: '1' }, executed: false }], suggestCreateInvestigation: true }
        });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [] });
        runAskAiTool.mockResolvedValue({ tool: 'getEntity', status: 'ok', data: {} });
        render(<AskAIPage />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'Help me investigate example.com.' } });
        fireEvent.click(screen.getByText('Send'));
        expect(await screen.findByText('Review Domain Intelligence')).toBeTruthy();
        fireEvent.click(screen.getByText('Run'));
        await waitFor(() => expect(runAskAiTool).toHaveBeenCalledWith('getEntity', { entityType: 'ioc', entityId: '1' }));
    });

    it('§9-§12/§51 renders a Recommended Action card with Approve/Cancel, never pre-executed', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({
            conversationId: 1, answer: 'x', sources: [], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'ENTITY_LOOKUP', context: { type: 'ioc', id: '1', label: 'example.com' }, aiProvider: 'heuristic', resultStatus: 'answered',
            actionProposals: [{ id: 5, action: 'create_monitor', label: 'Create Monitoring Target', status: 'proposed', target: 'example.com', reason: 'High risk and unmonitored.', impact: 'Creates a permanent monitor.', requiredPermission: null }]
        });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [] });
        render(<AskAIPage />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'What do we know about example.com?' } });
        fireEvent.click(screen.getByText('Send'));
        expect(await screen.findByText('Create Monitoring Target')).toBeTruthy();
        expect(screen.getByText(/High risk and unmonitored/)).toBeTruthy();
        expect(screen.getByText('Approve')).toBeTruthy();
        expect(screen.getByText('Cancel')).toBeTruthy();
        expect(approveAskAiAction).not.toHaveBeenCalled();
    });

    it('§52/§CASE3 clicking Approve calls the real approval API and shows the REAL result, never an assumed success', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({
            conversationId: 1, answer: 'x', sources: [], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'ENTITY_LOOKUP', context: { type: 'ioc', id: '1', label: 'example.com' }, aiProvider: 'heuristic', resultStatus: 'answered',
            actionProposals: [{ id: 5, action: 'create_monitor', label: 'Create Monitoring Target', status: 'proposed', target: 'example.com', reason: 'x', impact: 'y', requiredPermission: null }]
        });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [] });
        approveAskAiAction.mockResolvedValue({ id: 5, status: 'executed', result: { id: 77 } });
        render(<AskAIPage />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'x' } });
        fireEvent.click(screen.getByText('Send'));
        fireEvent.click(await screen.findByText('Approve'));
        await waitFor(() => expect(approveAskAiAction).toHaveBeenCalledWith(5));
        expect(await screen.findByText(/Completed/)).toBeTruthy();
    });

    it('§53 a failed approval is shown as Failed, never claimed successful', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({
            conversationId: 1, answer: 'x', sources: [], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'ENTITY_LOOKUP', context: { type: 'ioc', id: '1', label: 'example.com' }, aiProvider: 'heuristic', resultStatus: 'answered',
            actionProposals: [{ id: 5, action: 'create_monitor', label: 'Create Monitoring Target', status: 'proposed', target: 'example.com', reason: 'x', impact: 'y', requiredPermission: null }]
        });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [] });
        approveAskAiAction.mockResolvedValue({ id: 5, status: 'failed', error: 'Service unavailable' });
        render(<AskAIPage />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'x' } });
        fireEvent.click(screen.getByText('Send'));
        fireEvent.click(await screen.findByText('Approve'));
        expect(await screen.findByText(/Failed — Service unavailable/)).toBeTruthy();
    });

    it('§11 an unavailable action is shown honestly, never hidden or silently approvable', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({
            conversationId: 1, answer: 'x', sources: [], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'ENTITY_LOOKUP', context: { type: 'ioc', id: '1', label: 'example.com' }, aiProvider: 'heuristic', resultStatus: 'answered',
            actionProposals: [{ id: 5, action: 'create_case', label: 'Create Investigation', status: 'unavailable', unavailableReason: 'Insufficient Permission', target: 'x' }]
        });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [] });
        render(<AskAIPage />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'x' } });
        fireEvent.click(screen.getByText('Send'));
        expect(await screen.findByText(/Unavailable — Insufficient Permission/)).toBeTruthy();
        expect(screen.queryByText('Approve')).toBeNull();
    });

    it('§54/§CASE10 a backgrounded job shows a pending indicator, never a fabricated result', async () => {
        getAskAiConversations.mockResolvedValue([]);
        askAi.mockResolvedValue({ conversationId: 1, jobId: 9, jobStatus: 'queued', answer: 'Analyzing in the background (job #9).', sources: [], entities: [], confidence: 'Low', suggestedQuestions: [], queryType: 'CROSS_MODULE_SUMMARY', context: { type: 'case', id: '1', label: 'Case #1' }, aiProvider: 'heuristic', resultStatus: 'job_queued' });
        getAskAiConversation.mockResolvedValue({ id: 1, title: 'x', created_at: null, updated_at: null, messages: [{ id: 1, conversation_id: 1, role: 'assistant', content: 'Analyzing in the background (job #9).', sources: [], entities: [], suggestedQuestions: [], confidence: 'Low', queryType: 'CROSS_MODULE_SUMMARY', contextType: null, contextEntityId: null, aiProvider: 'heuristic', resultStatus: 'job_queued', created_at: null }] });
        getAskAiJob.mockReturnValue(new Promise(() => {})); // never resolves during this test
        render(<AskAIPage />);
        fireEvent.change(await screen.findByPlaceholderText('Ask something...'), { target: { value: 'Analyze this case.' } });
        fireEvent.click(screen.getByText('Send'));
        expect((await screen.findAllByText(/Analyzing in the background/i)).length).toBeGreaterThan(0);
    });
});
