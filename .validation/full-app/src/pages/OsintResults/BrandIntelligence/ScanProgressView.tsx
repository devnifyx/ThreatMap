import React, { useState, useEffect, useCallback } from 'react';
import type { BrandScanJob } from '../../../types/index';
import { getBrandScanJob, cancelBrandScanJob } from '../../../services/api';

interface ScanProgressViewProps {
    jobId: number;
    brandName: string;
    onComplete: (job: BrandScanJob) => void;
    onCancel: () => void;
}

const POLL_INTERVAL_MS = 2000;

// BRAND_INTELLIGENCE_PASS7.md §13 — 'partial' and 'retryable' are also
// terminal for an actively-watched job (the worker has stopped touching it
// either way); both carry useful results worth viewing immediately, same as
// 'completed'.
const TERMINAL_STATUSES: BrandScanJob['status'][] = ['completed', 'failed', 'cancelled', 'partial', 'retryable'];

function statusLabel(status: BrandScanJob['status']): string {
    switch (status) {
        case 'queued':       return 'Waiting in queue…';
        case 'discovering':  return 'Discovering candidate domains…';
        case 'evaluating':   return 'Evaluating domain candidates…';
        case 'correlating':  return 'Correlating findings…';
        case 'scoring':      return 'Scoring risk…';
        case 'ai_analysis':  return 'Running AI analysis…';
        case 'completed':    return 'Investigation complete';
        case 'failed':       return 'Investigation failed';
        case 'cancelled':    return 'Investigation cancelled';
        case 'partial':      return 'Investigation stopped early — partial results available';
        case 'retryable':    return 'Investigation stopped early — partial results available, retry possible';
        default:             return status;
    }
}

const ScanProgressView: React.FC<ScanProgressViewProps> = ({ jobId, brandName, onComplete, onCancel }) => {
    const [job, setJob] = useState<BrandScanJob | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);

    const fetchJob = useCallback(async () => {
        try {
            const res = await getBrandScanJob(jobId);
            const j: BrandScanJob = res.job;
            setJob(j);
            // §13 — 'partial' still has useful results and should be viewed,
            // not treated as a dead end the same way 'failed' is.
            if (j.status === 'completed' || j.status === 'partial') {
                onComplete(j);
            }
        } catch (err: any) {
            setLoadError(err.message || 'Failed to load job status');
        }
    }, [jobId, onComplete]);

    useEffect(() => {
        fetchJob();
        const id = setInterval(async () => {
            if (job && TERMINAL_STATUSES.includes(job.status)) return;
            await fetchJob();
        }, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [fetchJob]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleCancel = useCallback(async () => {
        setCancelling(true);
        setCancelError(null);
        try {
            await cancelBrandScanJob(jobId);
            await fetchJob(); // refresh status
        } catch (err: any) {
            setCancelError(err.message || 'Failed to cancel');
        } finally {
            setCancelling(false);
        }
    }, [jobId, fetchJob]);

    if (loadError) {
        return (
            <div className="bi-home">
                <div className="bi-error" role="alert">{loadError}</div>
                <button type="button" className="bi-btn-secondary" onClick={onCancel}>← Back</button>
            </div>
        );
    }

    if (!job) {
        return (
            <div className="bi-home">
                <p className="bi-loading">Loading investigation status…</p>
            </div>
        );
    }

    const isTerminal = TERMINAL_STATUSES.includes(job.status);
    const pct = job.progress_total > 0
        ? Math.round((job.progress_current / job.progress_total) * 100)
        : (isTerminal ? 100 : 0);

    return (
        <div className="bi-home">
            <div className="bi-toolbar">
                <div>
                    <h2 className="bi-title">Investigating {brandName}</h2>
                    <p className="bi-subtitle">{statusLabel(job.status)}</p>
                </div>
                <button type="button" className="bi-btn-secondary" onClick={onCancel}>← Back</button>
            </div>

            {/* Progress bar */}
            <div className="bi-progress-wrap" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="bi-progress-bar" style={{ width: `${pct}%` }} />
            </div>
            <div className="bi-progress-label">
                {job.progress_total > 0
                    ? `${job.progress_current} / ${job.progress_total} candidates evaluated`
                    : job.status === 'discovering' ? 'Scanning for candidate domains…'
                    : job.status === 'queued' ? 'Waiting to start…'
                    : ''
                }
            </div>

            {/* Failure state */}
            {job.status === 'failed' && job.error_message && (
                <div className="bi-error" role="alert">
                    <strong>Investigation failed:</strong> {job.error_message}
                </div>
            )}

            {/* Cancelled state — show partial results if any */}
            {job.status === 'cancelled' && (
                <div className="bi-info-banner" role="status">
                    Investigation cancelled.
                    {job.progress_current > 0 && ` ${job.progress_current} candidates were evaluated before cancellation — results are still viewable.`}
                </div>
            )}

            {cancelError && <div className="bi-error" role="alert">{cancelError}</div>}

            {/* Cancel button — only while still running */}
            {!isTerminal && (
                <div style={{ marginTop: '1.5rem' }}>
                    <button
                        type="button"
                        className="bi-btn-danger"
                        onClick={handleCancel}
                        disabled={cancelling}
                        aria-busy={cancelling}
                    >
                        {cancelling ? 'Cancelling…' : 'Cancel Investigation'}
                    </button>
                </div>
            )}

            {/* Partial results link after cancel */}
            {job.status === 'cancelled' && job.progress_current > 0 && (
                <div style={{ marginTop: '1rem' }}>
                    <button
                        type="button"
                        className="bi-btn-primary"
                        onClick={() => onComplete(job)}
                    >
                        View Partial Results
                    </button>
                </div>
            )}
        </div>
    );
};

export default ScanProgressView;
