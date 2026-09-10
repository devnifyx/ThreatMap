import React from 'react';

// P2-8 — one pager. This markup was written out 30 times across the app, in
// seven CSS-prefix flavours (`ti-`, `mon-`, `history-`, `di-`, `audit-log-`,
// `invdash-`, `tm-`, `findings-`) that are otherwise identical: Prev,
// "Page N of M · T total", Next.
//
// The prefix stays a prop rather than being unified, exactly as ConfirmDialog
// did in P1-5: each area has its own stylesheet, and collapsing them would be
// a visual change across seven areas rather than a refactor.
//
// The disabled state is a PROP, not computed here. The 30 sites use six
// different "is there a next page" expressions — `page >= totalPages` (20),
// `page * pageSize >= total` (5), `current >= total`, `page >= tableTotalPages`,
// `page * pageSize >= results.total`, and two that also disable while loading.
// Deriving it internally would have silently changed behaviour at ten of them,
// including letting a user click Next mid-load. The defaults cover the
// majority; anything else passes its own.
//
// Five of the thirty omitted `type="button"`. None of those files contains a
// <form>, so it was latent inconsistency rather than a live bug — a bare
// <button> defaults to type="submit". Routing them all through here settles it.
export type PaginationPrefix = 'ti' | 'mon' | 'history' | 'di' | 'audit-log' | 'invdash' | 'tm' | 'findings';

interface Props {
    page: number;
    totalPages: number;
    /** Total row count across all pages. Rendered with thousands separators. */
    total: number;
    onPrev: () => void;
    onNext: () => void;
    /** CSS class prefix, matching the host area's stylesheet. */
    prefix: PaginationPrefix;
    /** Defaults to `page <= 1`. Pass explicitly when the page also has a loading gate. */
    prevDisabled?: boolean;
    /** Defaults to `page >= totalPages`. Pass explicitly for offset-based paging. */
    nextDisabled?: boolean;
}

const Pagination: React.FC<Props> = ({
    page, totalPages, total, onPrev, onNext, prefix,
    prevDisabled = page <= 1,
    nextDisabled = page >= totalPages,
}) => (
    <div className={`${prefix}-pagination`}>
        <button type="button" disabled={prevDisabled} onClick={onPrev}>‹ Prev</button>
        <span className={`${prefix}-pagination-info`}>Page {page} of {totalPages} · {total.toLocaleString()} total</span>
        <button type="button" disabled={nextDisabled} onClick={onNext}>Next ›</button>
    </div>
);

export default Pagination;
