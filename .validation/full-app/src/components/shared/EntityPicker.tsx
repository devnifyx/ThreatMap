import React, { useEffect, useState } from 'react';
import { searchIntelligence, type SearchResultItem } from '../../services/api';

// P1-5 — one debounced intelligence picker, replacing four near-identical
// copies (ThreatBriefsPage, IntelligenceWorkspaceSection, KnowledgeBasePage's
// KnowledgeEntityPicker, and the orphaned ReportsSection). They differed only
// in placeholder text, the result filter, and whether the input style was
// called or inlined — so both of those are props now.
//
// ReportGeneratorPage's `EntityPicker` is deliberately NOT folded in: despite
// the shared name it is a different component — it queries
// searchReportGeneratorEntities, carries its own intelligence-type selector,
// and renders an `rg-*` dropdown. Only the 300ms debounce is common, and that
// is not worth a shared abstraction.

/** The input style ThreatBriefsPage and KnowledgeBasePage each declared, and
 *  IntelligenceWorkspaceSection inlined verbatim. CasesPage has its own
 *  near-copy (0.82rem + inherited font family) which is left alone. */
export function textInputStyle(): React.CSSProperties {
    return { background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '0.85rem' };
}

/** Result types no picker should offer: they are not linkable intelligence
 *  entities. Three of the four copies filtered exactly this way. */
export const excludeNonEntities = (i: SearchResultItem) => i.type !== 'investigation' && i.type !== 'alert';

interface Props {
    onPick: (item: SearchResultItem) => void;
    onCancel: () => void;
    placeholder: string;
    /** Narrows what this picker will offer. Defaults to the common exclusion. */
    filter?: (item: SearchResultItem) => boolean;
}

const EntityPicker: React.FC<Props> = ({ onPick, onCancel, placeholder, filter = excludeNonEntities }) => {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!q.trim()) { setResults([]); return; }
        const t = setTimeout(() => {
            setLoading(true);
            searchIntelligence(q.trim()).then((items) => setResults(items.filter(filter))).finally(() => setLoading(false));
        }, 300);
        return () => clearTimeout(t);
        // `filter` is intentionally not a dependency: callers pass an inline
        // arrow, so depending on it would re-run the search on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q]);

    return (
        <div style={{ border: '1px solid var(--ui-border)', borderRadius: 'var(--radius-md)', padding: '10px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input type="text" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} autoFocus style={{ flex: 1, ...textInputStyle() }} />
                <button type="button" className="ti-action-btn" onClick={onCancel}>Cancel</button>
            </div>
            {loading ? <div className="ti-loading">Searching…</div> : (
                <div className="ti-chip-list">
                    {results.map((r, i) => (
                        <button key={i} type="button" className="ti-chip" onClick={() => onPick(r)}>{r.label} <span style={{ opacity: 0.6 }}>· {r.type.replace(/_/g, ' ')}</span></button>
                    ))}
                    {q.trim() && !loading && results.length === 0 && <span className="ti-note">No matches.</span>}
                </div>
            )}
        </div>
    );
};

export default EntityPicker;
