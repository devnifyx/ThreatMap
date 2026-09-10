import React from 'react';

// P1-5 — one confirmation dialog. MonitoringShared and ThreatIntelligenceShared
// each declared this component; the two were byte-identical apart from the CSS
// class prefix (`mon-` vs `ti-`), so the prefix is a prop and both stylesheets
// keep working unchanged. Nothing here changes what either area looks like.
export interface ConfirmDialogProps {
    title: string;
    text: string;
    meta?: string | null;
    busy: boolean;
    confirmLabel?: string;
    onCancel: () => void;
    onConfirm: () => void;
    /** CSS class prefix, matching the host area's stylesheet. */
    prefix: 'ti' | 'mon';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, text, meta, busy, confirmLabel = 'Confirm', onCancel, onConfirm, prefix }) => (
    <div className={`${prefix}-confirm-overlay`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => { if (!busy && e.target === e.currentTarget) onCancel(); }}>
        <div className={`${prefix}-confirm`}>
            <div className={`${prefix}-confirm-title`}>{title}</div>
            <div className={`${prefix}-confirm-text`}>{text}</div>
            {meta && <div className={`${prefix}-confirm-meta`}>{meta}</div>}
            <div className={`${prefix}-confirm-actions`}>
                <button type="button" className={`${prefix}-confirm-cancel`} onClick={onCancel} disabled={busy}>Cancel</button>
                <button type="button" className={`${prefix}-confirm-danger`} onClick={onConfirm} disabled={busy} autoFocus>
                    {busy ? 'Working…' : confirmLabel}
                </button>
            </div>
        </div>
    </div>
);

export default ConfirmDialog;
