import React from 'react';

// Shared "not available yet" placeholder — used both at the top OSINT
// module level (OsintPage.tsx's sidebar entries with implemented: false)
// and at the pillar level within a module (e.g. Username Intelligence's
// Repository Analysis pillar). One implementation, not two near-duplicate
// copies, so the honest "planned for a future update" message and its
// styling stay consistent everywhere a feature genuinely doesn't exist yet.
const OsintPlaceholderPane: React.FC<{ title: string }> = ({ title }) => (
    <section className="osint-placeholder-card" aria-label={title}>
        <div className="osint-placeholder-title">{title}</div>
        <div className="osint-placeholder-empty">{title} is planned for a future update and isn't available yet.</div>
    </section>
);

export default OsintPlaceholderPane;
