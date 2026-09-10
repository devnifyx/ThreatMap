import React from 'react';
import SharedConfirmDialog, { type ConfirmDialogProps as SharedConfirmDialogProps } from '../../components/shared/ConfirmDialog';

// Shared badge/dialog primitives reused across every Monitoring section
// (MONITORING_CODE.md §17 — one visual language, not eleven).

export const SeverityBadge: React.FC<{ severity: string | null | undefined }> = ({ severity }) => {
    if (!severity) return <span className="mon-badge mon-badge--none">—</span>;
    return <span className={`mon-badge mon-badge--${severity.toLowerCase()}`}>{severity}</span>;
};

export const RiskBadge: React.FC<{ risk: string | null | undefined }> = ({ risk }) => {
    if (!risk) return <span className="mon-badge mon-badge--none">—</span>;
    return <span className={`mon-badge mon-badge--${risk.toLowerCase()}`}>{risk}</span>;
};

// Honest scope labels — §0/§26's own "clearly identify IMPLEMENTED /
// PARTIALLY IMPLEMENTED / PLANNED" requirement, surfaced directly in the UI
// rather than only in a report to the developer.
export const ScopeBadge: React.FC<{ scope: 'implemented' | 'partial' | 'planned' }> = ({ scope }) => {
    const label = scope === 'implemented' ? 'Implemented' : scope === 'partial' ? 'Partially Implemented' : 'Planned';
    return <span className={`mon-scope-badge mon-scope-badge--${scope}`}>{label}</span>;
};

// P1-5 — the dialog itself now lives in components/shared; this binds
// the `mon-` class prefix so every existing import of
// ConfirmDialog from this module keeps working unchanged.
export const ConfirmDialog: React.FC<Omit<SharedConfirmDialogProps, 'prefix'>> = (props) => (
    <SharedConfirmDialog {...props} prefix="mon" />
);

export function formatMinutesInterval(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    if (minutes % 60 === 0) return `${minutes / 60} hr`;
    return `${(minutes / 60).toFixed(1)} hr`;
}
