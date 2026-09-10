// P1-5 — one browser-download helper, replacing twelve open-coded copies of the
// same create-anchor/click/revoke dance.
//
// The copies were not merely repetitive, they were inconsistently correct:
// some omitted `URL.revokeObjectURL`, leaking the object URL for the life of
// the document, and some never attached the anchor to the DOM, which is not
// reliable in every browser. Routing all of them through here fixes both
// without changing what any caller downloads.

/** Trigger a download of an existing Blob (e.g. one returned by fetch). */
export function downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        // Attached rather than clicked detached: a detached anchor is not
        // reliably actioned across browsers.
        document.body.appendChild(a);
        a.click();
        a.remove();
    } finally {
        // In a finally block so a click that throws still releases the URL.
        URL.revokeObjectURL(url);
    }
}

/** Trigger a download of text, wrapping it in a Blob of the given MIME type. */
export function downloadTextFile({ filename, text, mime }: { filename: string; text: string; mime: string }): void {
    downloadBlob(new Blob([text], { type: mime }), filename);
}
