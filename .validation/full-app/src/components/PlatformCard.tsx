import React from 'react';

// Human-readable copy for the `reason` the backend attaches to an inconclusive check, so
// "Unverified" stops meaning four different things at once (blocked / throttled / timed out /
// genuinely no signal) — each has a different implication for whether to trust the result.
const REASON_TEXT: Record<string, string> = {
    login_wall_blocked: 'blocked by login wall',
    rate_limited: 'rate limited by platform',
    no_signal_found: 'no signal found',
    // The page loaded normally but looks identical for real and nonexistent
    // handles (Telegram), so existence genuinely cannot be determined.
    no_distinguishing_signal_found: 'page cannot distinguish real from nonexistent',
    timeout: 'timed out',
    blocked_by_platform: 'blocked by platform bot defence',
    http_error: 'unexpected HTTP response',
    network_error: 'network error'
};

// Shared between the standalone Username Checker (AliasFinder) view and
// Username Intelligence's Account Discovery pillar — moved to its own file
// (not left inside OsintPage.tsx) so both can import it without a circular
// dependency between OsintPage.tsx and the UsernameIntelligence/ folder.
export const PlatformCard = React.memo(({ r, target, onSelect }: { r: any, target: string, onSelect?: () => void }) => {
    const notSupported = r.status === 'not-supported';
    const isTaken = r.status === 'taken';
    const isAvailable = r.status === 'available';
    const extras: { type: string; url: string }[] = Array.isArray(r.additionalMatches) ? r.additionalMatches : [];
    const reasonText = r.reason ? REASON_TEXT[r.reason] : undefined;

    return (
        <div
            className="platform-card"
            data-status={r.status}
            role="listitem"
            tabIndex={0}
            onClick={isTaken && onSelect ? onSelect : undefined}
            style={isTaken && onSelect ? { cursor: 'pointer' } : undefined}
        >
            <div className="platform-info">
                <span className="status-icon" aria-hidden="true">
                    {isTaken ? '✅' :
                     isAvailable ? '❌' :
                     notSupported ? '➖' : '⚠️'}
                </span>
                <span className="platform-name">
                    {r.platform}
                    {/* e.g. "LinkedIn · Company" — which namespace actually matched. */}
                    {r.matchedType && <span className="platform-subtype"> · {r.matchedType}</span>}
                </span>
                {/* category/confidence are additive — only present on Username Intelligence's
                    richer results, not the plain AliasFinder shape this card also still renders. */}
                {typeof r.category === 'string' && <span className="platform-subtype"> · {r.category}</span>}
                {extras.length > 0 && (
                    <span
                        className="platform-extra-matches"
                        title={extras.map((m) => `${m.type}: ${m.url}`).join('\n')}
                    >
                        +{extras.length} more
                    </span>
                )}
            </div>
            <div className="platform-details">
                <span className="response-time" aria-label={`Response time: ${r.responseTime} milliseconds`}>{r.responseTime}ms</span>
                {typeof r.confidence === 'number' && r.confidence > 0 && (
                    <span className="response-time" aria-label={`Confidence: ${r.confidence}%`}>{r.confidence}% confidence</span>
                )}
                {/* No public lookup surface exists, so don't offer a profile link that cannot work. */}
                {!notSupported && (
                    <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="profile-link"
                        aria-label={`View ${r.platform} profile for ${target}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        View Profile ↗
                    </a>
                )}
                {isTaken && <span className="status-text status-text--verified" role="status">Verified</span>}
                {isAvailable && <span className="status-text status-text--missing" role="status">Not Found</span>}
                {notSupported && <span className="status-text status-text--muted" role="status">Not Checkable</span>}
                {!isTaken && !isAvailable && !notSupported && (
                    <span className="status-text status-text--warning" role="status">Unverified</span>
                )}
            </div>
            {/* One terse line of context under the badge. */}
            {notSupported ? (
                <div className="platform-reason">No public username lookup — cannot be checked</div>
            ) : reasonText && !isTaken && !isAvailable ? (
                <div className="platform-reason">Unverified — {reasonText}</div>
            ) : null}
        </div>
    );
});

PlatformCard.displayName = 'PlatformCard';

export default PlatformCard;
