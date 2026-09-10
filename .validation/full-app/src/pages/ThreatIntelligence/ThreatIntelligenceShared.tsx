import React from 'react';
import SharedConfirmDialog, { type ConfirmDialogProps as SharedConfirmDialogProps } from '../../components/shared/ConfirmDialog';

export const RiskBadge: React.FC<{ risk: string | null | undefined }> = ({ risk }) => {
    if (!risk) return <span className="ti-badge ti-badge--none">—</span>;
    return <span className={`ti-badge ti-badge--${risk.toLowerCase()}`}>{risk}</span>;
};

export const ConfidenceBadge: React.FC<{ confidence: string | null | undefined }> = ({ confidence }) => {
    if (!confidence) return <span className="ti-badge ti-badge--none">—</span>;
    return <span className={`ti-badge ti-badge--${confidence.toLowerCase()}`}>{confidence}</span>;
};

export function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return iso; }
}

export function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
}

export const IOC_TYPE_LABELS: Record<string, string> = {
    ipv4: 'IPv4', ipv6: 'IPv6', domain: 'Domain', url: 'URL', md5: 'MD5', sha1: 'SHA1', sha256: 'SHA256',
    email: 'Email', username: 'Username', phone: 'Phone', certificate: 'Certificate', file: 'File', other: 'Other'
};

export const IOC_TYPE_TO_OSINT_TAB: Record<string, string> = {
    domain: 'domain-intel', ipv4: 'ip-intel', ipv6: 'ip-intel',
    email: 'email', username: 'social', phone: 'phone'
};

export const InvestigateButton: React.FC<{ target: string; tab?: string; onInvestigate?: (target: string, tab?: string) => void }> = ({ target, tab, onInvestigate }) => {
    if (!onInvestigate) return null;
    return (
        <button type="button" className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={() => onInvestigate(target, tab)}>
            Investigate
        </button>
    );
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
    ioc: 'IOC', campaign: 'Campaign', threat_actor: 'Threat Actor', malware: 'Malware',
    vulnerability: 'Vulnerability', attack_technique: 'ATT&CK Technique',
    report: 'Threat Brief', workspace: 'Workspace', company: 'Company', image: 'Image',
    social_investigation: 'Investigation', social_account: 'Social Account',
    telegram_source: 'Telegram Source', brand: 'Brand',
    knowledge_entry: 'Knowledge Entry'
};

export const EntityChip: React.FC<{ entity: { type: string; id: string; label: string }; onOpen?: (type: string, id: string) => void }> = ({ entity, onOpen }) => (
    <button
        type="button"
        className="ti-chip"
        onClick={() => onOpen?.(entity.type, entity.id)}
        title={ENTITY_TYPE_LABELS[entity.type] ?? entity.type}
        disabled={!onOpen}
    >
        {entity.label}
    </button>
);

// P1-5 — the dialog itself now lives in components/shared; this binds
// the `ti-` class prefix so every existing import of
// ConfirmDialog from this module keeps working unchanged.
export const ConfirmDialog: React.FC<Omit<SharedConfirmDialogProps, 'prefix'>> = (props) => (
    <SharedConfirmDialog {...props} prefix="ti" />
);
