import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import InfoCard from '../../components/InfoCard';
import { OsintCard } from '../../components/OsintCard';
import HostingCountriesCard from '../../components/HostingCountriesCard';
import ScanReveal from '../../components/ScanReveal';
import ScanningAnimation from '../../components/ScanningAnimation';
import SecurityReport from '../../components/SecurityReport';
import PrintableScanReport from '../../components/PrintableScanReport';
import type { ScanSection, AiAnalysis } from '../../types';
import { getOsintData } from '../../services/api';
import { buildOsintEntries, validateOsintEntries, WEB_CHECK_OSINT_MODULES } from '../../utils/osintReport';
import { buildHostingCountriesData, buildScanSections } from '../../utils/scanReport';
import './ScanResultsPage.css';
import { notifyAuthStatus } from '../../services/authEvents';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

interface ScanResultsPageProps {
    target?: string;
    onBack?: () => void;
    onCancelBack?: () => void;
}

const ScanResultsPage: React.FC<ScanResultsPageProps> = ({ target, onBack, onCancelBack }) => {
    const [scanSource, setScanSource] = useState<Record<string, any> | null>(null);
    const [scanId, setScanId] = useState<number | undefined>(undefined);
    const [aiAnalysis, setAiAnalysis] = useState<AiAnalysis | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [scanComplete, setScanComplete] = useState(false);
    const [osintState, setOsintState] = useState<Record<string, { result: any; loading: boolean; error: string | null }>>({});

    const hasTarget = typeof target === 'string' && target.trim().length > 0;
    const displayError = hasTarget ? error : 'No target provided.';
    const displayLoading = hasTarget ? (loading || !scanComplete) : false;
    const scanData: ScanSection[] = useMemo(() => buildScanSections(scanSource), [scanSource]);
    const osintEntries = useMemo(() => buildOsintEntries(WEB_CHECK_OSINT_MODULES, osintState), [osintState]);
    const osintValidation = useMemo(() => validateOsintEntries(osintEntries), [osintEntries]);
    const hostingCountries = useMemo(
        () => buildHostingCountriesData(Array.isArray(scanSource?.systems) ? scanSource.systems : []),
        [scanSource]
    );

    const syncScanSnapshot = async (id: number, reconData: Record<string, any>) => {
        if (!target) return;
        const token = localStorage.getItem('token') || '';
        try {
            await fetch(`${API_BASE_URL}/api/history/scans/${id}/snapshot`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    target,
                    reconData
                })
            });
        } catch (e) {
            void e;
        }
    };

    useEffect(() => {
        if (!target) return;

        let cancelled = false;
        let pollTimer: any = null;

        const getToken = () => localStorage.getItem('token') || '';

        const startJob = async () => {
            setLoading(true);
            setError(null);
            setAiAnalysis(null);
            setScanSource(null);
            setScanId(undefined);
            setJobId(null);
            setCancelling(false);
            setScanComplete(false);
            setOsintState({});

            const response = await fetch(`${API_BASE_URL}/api/recon/start`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`
                },
                body: JSON.stringify({ target })
            });

            if (response.status === 401 || response.status === 403) {
                notifyAuthStatus(response.status);
                localStorage.removeItem('token');
                throw new Error("Authentication session expired. Please login again.");
            }

            if (!response.ok) {
                let message = `Scan failed: ${response.statusText}`;
                try {
                    const body = await response.json();
                    if (body?.error && typeof body.error === 'string') message = `Scan failed: ${body.error}`;
                    if (body?.message && typeof body.message === 'string') message = `Scan failed: ${body.message}`;
                    if (Array.isArray(body?.details) && body.details.length) {
                        message = `${message} (${body.details.join(', ')})`;
                    }
                    } catch (e) {
                        void e;
                }
                throw new Error(message);
            }

            const data = await response.json();
            if (cancelled) return;

            const newJobId = data.jobId as string;
            setJobId(newJobId);

            const poll = async () => {
                const statusRes = await fetch(`${API_BASE_URL}/api/recon/status/${encodeURIComponent(newJobId)}`, {
                    cache: 'no-store',
                    headers: {
                        'Pragma': 'no-cache',
                        'Cache-Control': 'no-cache',
                        'Authorization': `Bearer ${getToken()}`
                    }
                });

                if (statusRes.status === 401 || statusRes.status === 403) {
                    notifyAuthStatus(statusRes.status);
                    localStorage.removeItem('token');
                    throw new Error("Authentication session expired. Please login again.");
                }

                if (statusRes.status === 429) {
                    const retryAfterHeader = statusRes.headers.get('retry-after');
                    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
                    const delayMs = Number.isFinite(retryAfterSeconds) ? Math.max(1000, retryAfterSeconds * 1000) : 5000;
                    if (!cancelled) {
                        setError(`Scan throttled (HTTP 429). Retrying in ${Math.ceil(delayMs / 1000)}s…`);
                    }
                    if (pollTimer) clearTimeout(pollTimer);
                    pollTimer = setTimeout(() => {
                        poll().catch((e) => {
                            if (!cancelled) {
                                setError(e?.message || 'An unexpected error occurred.');
                                setLoading(false);
                            }
                        });
                    }, delayMs);
                    return;
                }

                if (!statusRes.ok) {
                    throw new Error(`Scan failed: ${statusRes.statusText}`);
                }

                const statusData = await statusRes.json();
                if (cancelled) return;

                const status = statusData.status as string;

                if (status === 'complete') {
                    if (pollTimer) clearTimeout(pollTimer);
                    const rawData = statusData;

                    if (rawData.aiAnalysis) {
                        setAiAnalysis(rawData.aiAnalysis);
                    } else if (rawData.ai_analysis) {
                        setAiAnalysis(rawData.ai_analysis);
                    }

                    if (rawData.scan_id) {
                        setScanId(rawData.scan_id);
                    }

                    setScanSource(rawData);
                    setLoading(false);
                    setScanComplete(true);

                    const hasSocialTags =
                        rawData?.socialTags &&
                        (rawData.socialTags.ogTitle || rawData.socialTags.ogDescription || rawData.socialTags.twitterCard || rawData.socialTags.image);

                    if (!hasSocialTags) {
                        try {
                            const tagRes = await fetch(`${API_BASE_URL}/api/social-tags?target=${encodeURIComponent(target || '')}`, {
                                headers: {
                                    'Authorization': `Bearer ${getToken()}`
                                }
                            });
                            if (tagRes.status === 401 || tagRes.status === 403) {
                                notifyAuthStatus(tagRes.status);
                            }
                            if (tagRes.ok) {
                                const tagJson = await tagRes.json();
                                if (tagJson?.socialTags) {
                                    const enrichedScan = { ...rawData, socialTags: tagJson.socialTags };
                                    setScanSource(enrichedScan);
                                    if (rawData.scan_id) {
                                        void syncScanSnapshot(rawData.scan_id, enrichedScan);
                                    }
                                }
                            }
                        } catch (e) {
                            void e;
                        }
                    }
                    return;
                }

                if (status === 'cancelled') {
                    if (pollTimer) clearTimeout(pollTimer);
                    setLoading(false);
                    setCancelling(false);
                    (onCancelBack || onBack)?.();
                    return;
                }

                if (status === 'failed') {
                    if (pollTimer) clearTimeout(pollTimer);
                    const msg = statusData.error ? `Scan failed: ${statusData.error}` : 'Scan failed: Internal Server Error';
                    setError(msg);
                    setLoading(false);
                    setCancelling(false);
                    return;
                }

                if (pollTimer) clearTimeout(pollTimer);
                pollTimer = setTimeout(() => {
                    poll().catch((e) => {
                        if (!cancelled) {
                            setError(e?.message || 'An unexpected error occurred.');
                            setLoading(false);
                        }
                    });
                }, 1500);
            };

            await poll();
        };

        startJob().catch((err: any) => {
            console.error("Scan error:", err);
            if (!cancelled) {
                setError(err.message || "An unexpected error occurred.");
                setLoading(false);
            }
        });

        return () => {
            cancelled = true;
            if (pollTimer) clearTimeout(pollTimer);
        };
    }, [target]);

    useEffect(() => {
        if (!scanComplete || !target || !scanId) return;

        let cancelled = false;
        const initialState = WEB_CHECK_OSINT_MODULES.reduce<Record<string, { result: any; loading: boolean; error: string | null }>>((acc, definition) => {
            acc[definition.module] = { result: null, loading: true, error: null };
            return acc;
        }, {});
        setOsintState(initialState);

        WEB_CHECK_OSINT_MODULES.forEach((definition) => {
            getOsintData(definition.module, target, scanId)
                .then((result) => {
                    if (cancelled) return;
                    setOsintState((prev) => ({
                        ...prev,
                        [definition.module]: {
                            result,
                            loading: false,
                            error: null
                        }
                    }));
                })
                .catch((err: any) => {
                    if (cancelled) return;
                    setOsintState((prev) => ({
                        ...prev,
                        [definition.module]: {
                            result: null,
                            loading: false,
                            error: err?.message || 'Failed to load OSINT data'
                        }
                    }));
                });
        });

        return () => {
            cancelled = true;
        };
    }, [scanComplete, scanId, target]);

    const cancelScan = async () => {
        if (!jobId) return;
        const token = localStorage.getItem('token') || '';
        setCancelling(true);
        try {
            console.info('Scan cancellation requested', { jobId, target });
            await fetch(`${API_BASE_URL}/api/recon/cancel/${encodeURIComponent(jobId)}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            (onCancelBack || onBack)?.();
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Cancellation failed';
            setError(message);
            setCancelling(false);
        }
    };


    return (
        <div className="scan-results-page">
            <header className="results-header">
                <button onClick={onBack} className="back-button"><ArrowLeft size={14} aria-hidden="true" /> Back</button>
                <h1 className={`target-title ${(target || '').length > 80 ? 'target-title--long' : ''}`}>
                    Target: <span className={`highlight ${(target || '').length > 80 ? 'highlight--long' : ''}`}>{target}</span>
                </h1>
                <div className="scan-status">
                    <span className={`status-dot ${displayLoading ? 'scanning' : 'complete'}`}></span>
                    {displayLoading ? 'SCANNING' : 'COMPLETE'}
                </div>
            </header>

            {displayError ? (
                <div className="error-message">
                    <h3>Scan Failed</h3>
                    <p>{displayError}</p>
                    <button onClick={onBack}>Try Again</button>
                </div>
            ) : (
                <>
                    {displayLoading ? (
                        <ScanningAnimation target={target || "Unknown Target"} onCancel={cancelScan} cancelling={cancelling} />
                    ) : scanComplete && !displayLoading ? (
                        <div className="scan-results-container print-container">
                            <PrintableScanReport
                                analysis={aiAnalysis}
                                sections={scanData}
                                osintEntries={osintEntries}
                                osintValidation={osintValidation}
                                hostingCountries={hostingCountries}
                                meta={{ target: target || undefined, scanId, scanDate: scanSource?.scanDate ?? null }}
                            />
                            {/* AI Security Report */}
                            <div className="mb-8">
                                 <SecurityReport
                                    analysis={aiAnalysis}
                                    loading={false}
                                    meta={{ target: target || undefined, scanId }}
                                    printReady={osintValidation.loadingModules.length === 0}
                                    printStatusMessage={
                                        osintValidation.loadingModules.length
                                            ? `Preparing OSINT intelligence for print: ${osintValidation.loadingModules.join(', ')}`
                                            : null
                                    }
                                 />
                            </div>

                            {/* OSINT Section */}
                            <section className="scan-section">
                                <h2 className="section-title">OSINT Intelligence</h2>
                                {osintValidation.errorModules.length > 0 || osintValidation.inconsistentModules.length > 0 ? (
                                    <div className="osint-validation-banner" role="status">
                                        {osintValidation.errorModules.length > 0
                                            ? `Modules with fetch errors: ${osintValidation.errorModules.join(', ')}. `
                                            : ''}
                                        {osintValidation.inconsistentModules.length > 0
                                            ? `Modules with incomplete data: ${osintValidation.inconsistentModules.join(', ')}.`
                                            : ''}
                                    </div>
                                ) : null}
                                <div className="cards-grid">
                                    {osintEntries.map((entry, index) => (
                                        <ScanReveal delay={(index + 1) * 0.1} key={entry.module}>
                                            <OsintCard entry={entry} />
                                        </ScanReveal>
                                    ))}
                                    <ScanReveal delay={(osintEntries.length + 1) * 0.1} key="hosting-countries" className="info-card--full-width">
                                        <HostingCountriesCard countries={hostingCountries} />
                                    </ScanReveal>
                                </div>
                            </section>

                            {scanData.map((section) => (
                                <section key={section.id} className="scan-section">
                                    <h2 className="section-title">{section.title}</h2>
                                    <div className="cards-grid">
                                        {section.cards.map((card, index) => (
                                            <ScanReveal
                                                key={card.id}
                                                delay={index * 0.1}
                                                className={card.type === 'subdomain-table' || card.type === 'dns-records' || card.type === 'domain-tree' ? 'info-card--full-width' : ''}
                                            >
                                                <InfoCard
                                                    title={card.title}
                                                    type={card.type}
                                                    data={card.data}
                                                    customContentId={card.customContentId}
                                                />
                                            </ScanReveal>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
};

export default ScanResultsPage;
