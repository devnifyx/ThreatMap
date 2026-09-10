import React from 'react';

export interface PillarSubnavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
}

interface PillarSubnavProps {
    pillars: PillarSubnavItem[];
    activeId: string;
    onSelect: (id: string) => void;
    ariaLabel: string;
}

// Extracted from Email Intelligence's own in-page sub-navigation once
// Username Intelligence became a second real consumer of the same pattern
// (master-detail tabs nested inside a module's result view, mirroring
// .osint-sidebar/.module-btn's visual language). Kept generic — callers
// supply their own pillar list, class names (.ei-subnav/.ei-tab-btn) stay
// as-is since both features already share that CSS.
const PillarSubnav: React.FC<PillarSubnavProps> = ({ pillars, activeId, onSelect, ariaLabel }) => (
    <nav className="ei-subnav" aria-label={ariaLabel}>
        {pillars.map((p) => (
            <button
                key={p.id}
                type="button"
                className={`ei-tab-btn ${activeId === p.id ? 'active' : ''}`}
                onClick={() => onSelect(p.id)}
            >
                <span className="icon">{p.icon}</span>
                {p.label}
            </button>
        ))}
    </nav>
);

export default PillarSubnav;
