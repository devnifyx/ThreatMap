import React, { useCallback, useEffect, useState } from 'react';
import { getEntityRisk, getEntityAssessments, createAssessment, type RiskAssessmentResult, type AnalystAssessment } from '../../../services/api';
import { RiskBadge, ConfidenceBadge, formatDateTime } from '../ThreatIntelligenceShared';

const CONFIDENCE_OPTIONS = ['Low', 'Medium', 'High', 'Confirmed'];

const RiskAssessmentBlock: React.FC<{ entityType: string; entityId: string | number }> = ({ entityType, entityId }) => {
    const [risk, setRisk] = useState<RiskAssessmentResult | null | undefined>(undefined);
    const [assessments, setAssessments] = useState<AnalystAssessment[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ assessment: '', confidence: 'Medium', reasoning: '', recommendation: '', notes: '' });
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        Promise.all([getEntityRisk(entityType, entityId), getEntityAssessments(entityType, entityId)])
            .then(([r, a]) => { setRisk(r); setAssessments(a); })
            .catch((err) => setError(err?.message || 'Failed to load risk & assessment'))
            .finally(() => setLoading(false));
    }, [entityType, entityId]);
    useEffect(() => { load(); }, [load]);

    const submit = async () => {
        if (!form.assessment.trim()) return;
        setSaving(true);
        try {
            await createAssessment({ entityType, entityId, ...form });
            setForm({ assessment: '', confidence: 'Medium', reasoning: '', recommendation: '', notes: '' });
            setShowForm(false);
            load();
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="ti-loading">Loading risk & assessment…</div>;
    if (error) return <div className="ti-error">{error}</div>;

    return (
        <div>
            <div className="ti-modal-subtitle">Computed Risk</div>
            {!risk ? <div className="ti-empty">No supporting evidence found yet — risk not yet assessed.</div> : (
                <>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '6px' }}>
                        <RiskBadge risk={risk.level} /> <span className="ti-note">Score {risk.score}/100</span> <ConfidenceBadge confidence={risk.confidence} />
                    </div>
                    <ul className="ti-list">
                        {(risk.reasons ?? []).map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                </>
            )}

            <div className="ti-modal-subtitle" style={{ marginTop: '14px' }}>
                Analyst Assessments ({(assessments ?? []).length})
                <button type="button" className="ti-action-btn" style={{ marginLeft: '8px' }} onClick={() => setShowForm((v) => !v)}>+ Add Assessment</button>
            </div>

            {showForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px', padding: '10px', border: '1px solid var(--ui-border)', borderRadius: 'var(--radius-md)' }}>
                    <textarea placeholder="Assessment…" value={form.assessment} onChange={(e) => setForm((f) => ({ ...f, assessment: e.target.value }))} rows={2} style={{ background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontFamily: 'inherit', fontSize: '0.85rem' }} />
                    <select value={form.confidence} onChange={(e) => setForm((f) => ({ ...f, confidence: e.target.value }))}>
                        {CONFIDENCE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input type="text" placeholder="Reasoning (optional)" value={form.reasoning} onChange={(e) => setForm((f) => ({ ...f, reasoning: e.target.value }))} style={{ background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: '0.85rem' }} />
                    <input type="text" placeholder="Recommendation (optional)" value={form.recommendation} onChange={(e) => setForm((f) => ({ ...f, recommendation: e.target.value }))} style={{ background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: '0.85rem' }} />
                    <button type="button" className="ti-action-btn" onClick={submit} disabled={saving || !form.assessment.trim()} style={{ alignSelf: 'flex-start' }}>{saving ? 'Saving…' : 'Save Assessment'}</button>
                </div>
            )}

            {(assessments ?? []).length === 0 ? <div className="ti-empty">No assessment available.</div> : (
                <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                    {(assessments ?? []).map((a) => (
                        <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <ConfidenceBadge confidence={a.confidence} />
                                <span className="ti-note">{a.username || 'Analyst'} · {formatDateTime(a.created_at)}</span>
                            </div>
                            <div style={{ marginTop: '4px', fontSize: '0.88rem' }}>{a.assessment}</div>
                            {a.reasoning && <div className="ti-note" style={{ marginTop: '2px' }}>Reasoning: {a.reasoning}</div>}
                            {a.recommendation && <div className="ti-note" style={{ marginTop: '2px' }}>Recommendation: {a.recommendation}</div>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RiskAssessmentBlock;
