// Shared derivation helpers for turning an email or phone number into a
// CANDIDATE username — used by both OsintPage.tsx's Email/Phone Intelligence
// "Search Social Media" pivot buttons and Social Media Intelligence's own
// Email/Phone search-mode selector, so the logic lives in exactly one place.
//
// Social Media Intelligence's real discovery engines (Maigret, Sherlock,
// Social Analyzer) only ever search by username — there is no backend path
// that searches "by email" or "by phone" directly. These functions never
// pretend otherwise: they produce a real, validator-clean CANDIDATE string
// (or null when nothing usable survives), which callers must present as a
// candidate to confirm, never as a resolved/confirmed identity.

const USERNAME_CANDIDATE_RE = /^[a-zA-Z0-9._-]{1,64}$/;

/** The local-part before "@", stripped of characters Social Media
 *  Intelligence's own username validator wouldn't accept, with a "+tag"
 *  alias suffix (Gmail-style) dropped rather than spliced onto the name
 *  (so "john.smith+work@..." derives "john.smith", not "john.smithwork").
 *  Null when nothing usable survives that. */
export function deriveUsernameFromEmail(email: string | null | undefined): string | null {
    if (!email) return null;
    const local = (email.split('@')[0] || '').split('+')[0];
    const cleaned = local.replace(/[^a-zA-Z0-9._-]/g, '');
    return USERNAME_CANDIDATE_RE.test(cleaned) ? cleaned : null;
}

/** Raw digits only (no "+", spaces, or punctuation) — some platforms do
 *  allow a bare phone number as a handle, but this is the weakest of the two
 *  derivations and callers should label it as such. */
export function deriveUsernameFromPhone(phone: string | null | undefined): string | null {
    if (!phone) return null;
    const digits = phone.replace(/[^0-9]/g, '');
    return USERNAME_CANDIDATE_RE.test(digits) ? digits : null;
}
