import React from 'react';
import { PlatformCard } from '../../../components/PlatformCard';
import type { UsernameIntelligenceData } from '../../../types';

interface AccountDiscoveryPaneProps {
    data: UsernameIntelligenceData;
    target: string;
    onSelectPlatform: (platform: string) => void;
}

const AccountDiscoveryPane: React.FC<AccountDiscoveryPaneProps> = ({ data, target, onSelectPlatform }) => {
    const discovery = data?.accountDiscovery;
    const results = Array.isArray(discovery?.results) ? discovery.results : [];

    if (!results.length) {
        return (
            <section className="uint-card" aria-label="Account discovery">
                <div className="uint-card-title">Account Discovery</div>
                <div className="uint-empty">No platform results available.</div>
            </section>
        );
    }

    const groups = new Map<string, typeof results>();
    for (const r of results) {
        const category = typeof r.category === 'string' && r.category ? r.category : 'Other';
        if (!groups.has(category)) groups.set(category, []);
        groups.get(category)!.push(r);
    }

    return (
        <>
            {Array.from(groups.entries()).map(([category, items]) => (
                <section key={category} aria-label={`${category} platforms`} style={{ marginBottom: '16px' }}>
                    <div className="uint-card-title">{category} ({items.length})</div>
                    <div className="username-grid" role="list" aria-label={`${category} platform results`}>
                        {items.map((r) => (
                            <PlatformCard key={r.platform} r={r} target={target} onSelect={() => onSelectPlatform(r.platform)} />
                        ))}
                    </div>
                </section>
            ))}
        </>
    );
};

export default AccountDiscoveryPane;
