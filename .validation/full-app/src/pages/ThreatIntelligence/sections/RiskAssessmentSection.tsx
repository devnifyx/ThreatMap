import React, { useEffect, useState } from 'react';
import { searchIntelligence, type SearchResultItem } from '../../../services/api';
import RiskAssessmentBlock from './RiskAssessmentBlock';

interface Props {
    onOpenEntity?: (type: string, id: string) => void;
}

const RiskAssessmentSection: React.FC<Props> = ({ onOpenEntity }) => {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<SearchResultItem | null>(null);

    useEffect(() => {
        if (!q.trim()) { setResults([]); return; }
        const t = setTimeout(() => {
            setLoading(true);
            searchIntelligence(q.trim()).then((items) => setResults(items.filter((i) => i.type !== 'investigation' && i.type !== 'alert'))).finally(() => setLoading(false));
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Risk & Assessment</span>
            </div>
            <div className="ti-note" style={{ marginBottom: '10px' }}>Search for an IOC, campaign, threat actor, malware family, vulnerability, or MITRE technique to view its evidence-driven risk score and analyst assessments.</div>

            <input
                type="text" placeholder="Search intelligence…" value={q} onChange={(e) => { setQ(e.target.value); setSelected(null); }}
                style={{ width: '100%', background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '0.9rem', marginBottom: '10px' }}
            />

            {loading ? <div className="ti-loading">Searching…</div> : !selected && results.length > 0 ? (
                <div className="ti-chip-list" style={{ marginBottom: '12px' }}>
                    {results.map((r, i) => (
                        <button key={i} type="button" className="ti-chip" onClick={() => setSelected(r)}>{r.label} <span style={{ opacity: 0.6 }}>· {r.type.replace(/_/g, ' ')}</span></button>
                    ))}
                </div>
            ) : null}

            {selected && (
                <>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                        <button type="button" className="ti-chip" onClick={() => onOpenEntity?.(selected.type, selected.id)}>{selected.label}</button>
                        <span className="ti-note">{selected.type.replace(/_/g, ' ')}</span>
                        <button type="button" className="ti-action-btn" style={{ marginLeft: 'auto' }} onClick={() => { setSelected(null); setQ(''); }}>Change</button>
                    </div>
                    <RiskAssessmentBlock entityType={selected.type} entityId={selected.id} />
                </>
            )}

            {!selected && !q.trim() && <div className="ti-empty">No assessment available. Search for an entity above to begin.</div>}
        </div>
    );
};

export default RiskAssessmentSection;
