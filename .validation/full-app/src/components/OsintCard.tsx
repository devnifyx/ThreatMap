import React, { useState } from 'react';
import type { OsintReportEntry } from '../utils/osintReport';
import './OsintCard.css';

interface OsintCardProps {
    entry: OsintReportEntry;
}

export const OsintCard: React.FC<OsintCardProps> = ({ entry }) => {
    const [expanded, setExpanded] = useState(false);

    const renderContent = () => {
        return (
            <div>
                {entry.validation.message ? (
                    <div className="osint-warning" role="status">
                        {entry.validation.message}
                    </div>
                ) : null}

                <div className="osint-subsection">
                    {entry.summaryRows.map((row) => (
                        <div className="key-value-row" key={`${entry.module}-${row.label}`}>
                            <span className="key-label">{row.label}</span>
                            <span className="value-text" title={row.value}>{row.value}</span>
                        </div>
                    ))}
                </div>

                {entry.sourceRows.length > 0 ? (
                    <div className="osint-subsection">
                        {entry.sourceRows.map((row) => (
                            <div className="key-value-row" key={`${entry.module}-${row.label}`}>
                                <span className="key-label">{row.label}</span>
                                <span className="value-text" title={row.value}>{row.value}</span>
                            </div>
                        ))}
                    </div>
                ) : null}

                {entry.metricRows.length > 0 ? (
                    <div className="osint-subsection">
                        {entry.metricRows.map((row) => (
                            <div className="key-value-row" key={`${entry.module}-${row.label}`}>
                                <span className="key-label">{row.label}</span>
                                <span className="value-text" title={row.value}>{row.value}</span>
                            </div>
                        ))}
                    </div>
                ) : null}

                {expanded && (
                    <div className="json-view">
                        {entry.rawFindings}
                    </div>
                )}

                <button 
                    className="expand-btn"
                    onClick={() => setExpanded(!expanded)}
                >
                    {expanded ? 'Hide Raw Findings' : 'View Raw Findings'}
                </button>
            </div>
        );
    };

    return (
        <div className="osint-card">
            <div className="osint-card-header">
                <div className="osint-title-group">
                    <span className="osint-icon">{entry.icon}</span>
                    <h3 className="osint-title">{entry.title}</h3>
                </div>
                {!entry.loading && (
                    <span className={`osint-card-risk-badge risk-${(entry.risk || 'unknown').toLowerCase()}`}>
                        {entry.risk || 'Unknown'}
                    </span>
                )}
            </div>

            <div className="osint-card-content">
                {entry.loading && <div className="osint-loading">Preparing intelligence data...</div>}
                {entry.error && <div className="osint-error">Failed: {entry.error}</div>}
                {!entry.loading && !entry.error && renderContent()}
            </div>
        </div>
    );
};
