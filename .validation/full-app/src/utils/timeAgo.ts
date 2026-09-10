// Shared relative-time formatter. Originally written inline in
// FindingsFeedPage.tsx (DASHBOARD_PHASE1.md §4); extracted here per
// INVESTIGATION_DASHBOARD.md §7c so it isn't duplicated for the Investigation
// Dashboard's Critical Findings section.
export function timeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins  = Math.floor(diff / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}
