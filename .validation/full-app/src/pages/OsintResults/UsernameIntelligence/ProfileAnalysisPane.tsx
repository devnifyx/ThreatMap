import React, { useMemo } from 'react';
import type { UsernameIntelligenceData, UsernameProfileFields } from '../../../types';

interface ProfileAnalysisPaneProps {
    data: UsernameIntelligenceData;
    selectedPlatform: string | null;
    onSelectPlatform: (platform: string) => void;
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : iso;
}

const ProfileFieldsView: React.FC<{ profile: UsernameProfileFields }> = ({ profile }) => {
    if (profile.kind === 'github') {
        return (
            <div className="uint-kv">
                <div className="k">Display name</div>
                <div className="v">{profile.displayName ?? '—'}</div>
                <div className="k">Bio</div>
                <div className="v">{profile.bio ?? '—'}</div>
                <div className="k">Followers</div>
                <div className="v">{profile.followers ?? '—'}</div>
                <div className="k">Following</div>
                <div className="v">{profile.following ?? '—'}</div>
                <div className="k">Public repos</div>
                <div className="v">{profile.repoCount ?? '—'}</div>
                <div className="k">Company</div>
                <div className="v">{profile.company ?? '—'}</div>
                <div className="k">Location</div>
                <div className="v">{profile.location ?? '—'}</div>
                <div className="k">Account created</div>
                <div className="v">{formatDate(profile.createdAt)}{profile.accountAgeDays != null ? ` (${profile.accountAgeDays} days ago)` : ''}</div>
            </div>
        );
    }

    if (profile.kind === 'reddit') {
        return (
            <div className="uint-kv">
                <div className="k">Display name</div>
                <div className="v">{profile.displayName ?? '—'}</div>
                <div className="k">Bio</div>
                <div className="v">{profile.bio ?? '—'}</div>
                <div className="k">Total karma</div>
                <div className="v">{profile.totalKarma ?? '—'}</div>
                <div className="k">Link karma</div>
                <div className="v">{profile.linkKarma ?? '—'}</div>
                <div className="k">Comment karma</div>
                <div className="v">{profile.commentKarma ?? '—'}</div>
                <div className="k">Cake day</div>
                <div className="v">{formatDate(profile.cakeDay)}{profile.accountAgeDays != null ? ` (${profile.accountAgeDays} days ago)` : ''}</div>
                <div className="k">Verified email</div>
                <div className="v">{profile.verified ? 'Yes' : 'No'}</div>
                <div className="k">Reddit Premium</div>
                <div className="v">{profile.isGold ? 'Yes' : 'No'}</div>
            </div>
        );
    }

    if (profile.kind === 'tiktok') {
        return (
            <div className="uint-kv">
                <div className="k">Display name</div>
                <div className="v">{profile.displayName}</div>
                <div className="k">Title</div>
                <div className="v">{profile.title ?? '—'}</div>
            </div>
        );
    }

    if (profile.kind === 'telegram') {
        return (
            <div className="uint-kv">
                <div className="k">Display name</div>
                <div className="v">{profile.displayName ?? '—'}</div>
                <div className="k">Bio</div>
                <div className="v">{profile.bio ?? '—'}</div>
            </div>
        );
    }

    if (profile.kind === 'generic-og') {
        return (
            <div className="uint-kv">
                <div className="k">Display name</div>
                <div className="v">{profile.displayName ?? '—'}</div>
                <div className="k">Bio</div>
                <div className="v">{profile.bio ?? '—'}</div>
            </div>
        );
    }

    // generic fallback — only username + profile URL were obtainable.
    return (
        <div className="uint-kv">
            <div className="k">Username</div>
            <div className="v">{profile.username ?? '—'}</div>
            <div className="k">Profile URL</div>
            <div className="v">
                {profile.profileUrl ? (
                    <a href={profile.profileUrl} target="_blank" rel="noopener noreferrer">{profile.profileUrl}</a>
                ) : '—'}
            </div>
        </div>
    );
};

const ProfileAnalysisPane: React.FC<ProfileAnalysisPaneProps> = ({ data, selectedPlatform, onSelectPlatform }) => {
    const profiles = data?.profileAnalysis?.profiles ?? {};
    const platforms = useMemo(() => Object.keys(profiles), [profiles]);

    const active = selectedPlatform && profiles[selectedPlatform] ? selectedPlatform : platforms[0] ?? null;

    if (!platforms.length) {
        return (
            <section className="uint-card" aria-label="Profile analysis">
                <div className="uint-card-title">Profile Analysis</div>
                <div className="uint-empty">No verified platforms to enrich yet — check Account Discovery first.</div>
            </section>
        );
    }

    const activeProfile = active ? profiles[active] : null;
    const avatarUrl = activeProfile && 'avatarUrl' in activeProfile ? activeProfile.avatarUrl : null;
    const displayName = activeProfile && 'displayName' in activeProfile ? activeProfile.displayName : null;

    return (
        <section className="uint-card" aria-label="Profile analysis">
            <div className="uint-card-title">Profile Analysis</div>
            {platforms.length > 1 && (
                <div className="uint-platform-selector" role="tablist" aria-label="Select platform">
                    {platforms.map((p) => (
                        <button
                            key={p}
                            type="button"
                            className={`uint-platform-chip ${active === p ? 'active' : ''}`}
                            onClick={() => onSelectPlatform(p)}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}
            {active && activeProfile && (
                <>
                    <div className="uint-profile-header">
                        {avatarUrl && <img className="uint-avatar" src={avatarUrl} alt={`${active} avatar`} />}
                        <div>
                            <div style={{ fontWeight: 700 }}>{active}</div>
                            {displayName && <div className="uint-empty">{displayName}</div>}
                        </div>
                    </div>
                    <ProfileFieldsView profile={activeProfile} />
                </>
            )}
        </section>
    );
};

export default ProfileAnalysisPane;
