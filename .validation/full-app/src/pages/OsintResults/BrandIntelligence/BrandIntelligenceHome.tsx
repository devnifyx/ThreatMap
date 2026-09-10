import React, { useState, useEffect, useCallback } from 'react';
import './BrandIntelligence.css';
import { getBrands, getBrand, createBrandProfile, updateBrandProfile, deleteBrandProfile, getBrandJobs, startBrandScan, retryBrandScanJob } from '../../../services/api';
import type { Brand, BrandScanJob } from '../../../types/index';
import BrandProfileForm from './BrandProfileForm';
import BrandIdentitiesEditor from './BrandIdentitiesEditor';
import ScanProgressView from './ScanProgressView';
import BrandIntelligenceResult from './BrandIntelligenceResult';
import BrandOverviewPane from './BrandOverviewPane';

type View = 'list' | 'create' | 'detail' | 'scanning' | 'results';

function formatDate(iso: string | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return iso; }
}

function jobStatusLabel(status: string): string {
    switch (status) {
        case 'queued':      return 'Queued';
        case 'discovering': return 'Discovering';
        case 'evaluating':  return 'Evaluating';
        case 'completed':   return 'Completed';
        case 'failed':      return 'Failed';
        case 'cancelled':   return 'Cancelled';
        // BRAND_INTELLIGENCE_PASS7.md §13 — PARTIAL is shown distinctly
        // from FAILED whenever useful results survived.
        case 'partial':     return 'Partial';
        case 'retryable':   return 'Retryable';
        default:            return status;
    }
}

function jobStatusClass(status: string): string {
    switch (status) {
        case 'completed':   return 'bi-job-completed';
        case 'failed':      return 'bi-job-failed';
        case 'cancelled':   return 'bi-job-cancelled';
        case 'partial':     return 'bi-job-partial';
        case 'retryable':   return 'bi-job-retryable';
        default:            return 'bi-job-running';
    }
}

const BrandIntelligenceHome: React.FC = () => {
    // ---- List view state ----
    const [brands, setBrands] = useState<Brand[]>([]);
    const [listLoading, setListLoading] = useState(true);
    const [listError, setListError] = useState<string | null>(null);

    // ---- Navigation ----
    const [view, setView] = useState<View>('list');
    const [activeBrand, setActiveBrand] = useState<Brand | null>(null);

    // ---- Form / detail state ----
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // ---- Delete confirmation ----
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // ---- Scan state ----
    const [activeJobId, setActiveJobId] = useState<number | null>(null);
    const [scanStarting, setScanStarting] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [completedJob, setCompletedJob] = useState<BrandScanJob | null>(null);

    // ---- Past jobs (shown on brand detail) ----
    const [pastJobs, setPastJobs] = useState<BrandScanJob[]>([]);
    const [jobsLoading, setJobsLoading] = useState(false);

    // Load brand list
    const loadBrands = useCallback(async () => {
        setListLoading(true);
        setListError(null);
        try {
            const res = await getBrands();
            setBrands(res.brands ?? []);
        } catch (err: any) {
            setListError(err.message || 'Failed to load brands');
        } finally {
            setListLoading(false);
        }
    }, []);

    useEffect(() => { loadBrands(); }, [loadBrands]);

    // Open a brand's detail view — full record with identities
    const openDetail = useCallback(async (brand: Brand) => {
        try {
            const res = await getBrand(brand.id);
            setActiveBrand(res.brand);
            setView('detail');
            setConfirmDelete(false);
            setFormError(null);
            setScanError(null);
            // Load past jobs
            setJobsLoading(true);
            const jr = await getBrandJobs(brand.id);
            setPastJobs(jr.jobs ?? []);
            setJobsLoading(false);
        } catch (err: any) {
            setListError(err.message || 'Failed to load brand details');
        }
    }, []);

    // Go back to list
    const goList = useCallback(() => {
        setView('list');
        setActiveBrand(null);
        setFormError(null);
        setConfirmDelete(false);
        setScanError(null);
        setActiveJobId(null);
        setCompletedJob(null);
        setPastJobs([]);
    }, []);

    // Go back to brand detail from scan/results view
    const goDetail = useCallback(() => {
        if (activeBrand) openDetail(activeBrand);
        else goList();
    }, [activeBrand, openDetail, goList]);

    // ---- Create ----
    const handleCreate = useCallback(async (payload: Parameters<typeof createBrandProfile>[0]) => {
        setSaving(true);
        setFormError(null);
        try {
            const res = await createBrandProfile(payload);
            await loadBrands();
            setActiveBrand(res.brand);
            setView('detail');
            setPastJobs([]);
        } catch (err: any) {
            setFormError(err.message || 'Failed to create brand');
        } finally {
            setSaving(false);
        }
    }, [loadBrands]);

    // ---- Update ----
    const handleUpdate = useCallback(async (payload: Parameters<typeof updateBrandProfile>[1]) => {
        if (!activeBrand) return;
        setSaving(true);
        setFormError(null);
        try {
            const res = await updateBrandProfile(activeBrand.id, payload);
            setActiveBrand(res.brand);
            loadBrands();
        } catch (err: any) {
            setFormError(err.message || 'Failed to update brand');
        } finally {
            setSaving(false);
        }
    }, [activeBrand, loadBrands]);

    // ---- Delete ----
    const handleDelete = useCallback(async () => {
        if (!activeBrand) return;
        setDeleting(true);
        try {
            await deleteBrandProfile(activeBrand.id);
            await loadBrands();
            goList();
        } catch (err: any) {
            setFormError(err.message || 'Failed to delete brand');
            setDeleting(false);
            setConfirmDelete(false);
        }
    }, [activeBrand, loadBrands, goList]);

    // ---- Identity updates ----
    const handleBrandUpdate = useCallback((updated: Brand) => {
        setActiveBrand(updated);
        setBrands((prev) => prev.map((b) =>
            b.id === updated.id
                ? { ...b, identityCount: updated.identities?.length ?? b.identityCount }
                : b
        ));
    }, []);

    // ---- Start investigation ----
    const handleStartScan = useCallback(async () => {
        if (!activeBrand) return;
        setScanStarting(true);
        setScanError(null);
        try {
            const res = await startBrandScan(activeBrand.id);
            setActiveJobId(res.jobId);
            setView('scanning');
        } catch (err: any) {
            setScanError(err.message || 'Failed to start investigation');
        } finally {
            setScanStarting(false);
        }
    }, [activeBrand]);

    // ---- Resume past job ----
    const handleResumeJob = useCallback((job: BrandScanJob) => {
        setCompletedJob(job);
        setActiveJobId(job.id);
        setView('results');
    }, []);

    // ---- BRAND_INTELLIGENCE_PASS7.md §14 "JOB RETRY" ----
    const [retryingJobId, setRetryingJobId] = useState<number | null>(null);
    const [retryError, setRetryError] = useState<string | null>(null);
    const handleRetryJob = useCallback(async (jobId: number) => {
        setRetryingJobId(jobId);
        setRetryError(null);
        try {
            await retryBrandScanJob(jobId);
            if (activeBrand) {
                setJobsLoading(true);
                const res = await getBrandJobs(activeBrand.id);
                setPastJobs(res.jobs ?? []);
                setJobsLoading(false);
            }
        } catch (err: any) {
            setRetryError(err.message || 'Failed to retry investigation');
        } finally {
            setRetryingJobId(null);
        }
    }, [activeBrand]);

    // ---- Called when scan polling sees 'completed' ----
    const handleScanComplete = useCallback((job: BrandScanJob) => {
        setCompletedJob(job);
        setView('results');
    }, []);

    const hasDomainIdentity = (activeBrand?.identities ?? []).some(
        (i) => i.identity_type === 'domain'
    );

    // ========================================================
    // Render: Scanning (progress polling)
    // ========================================================
    if (view === 'scanning' && activeJobId != null && activeBrand) {
        return (
            <ScanProgressView
                jobId={activeJobId}
                brandName={activeBrand.name}
                onComplete={handleScanComplete}
                onCancel={goDetail}
            />
        );
    }

    // ========================================================
    // Render: Results
    // ========================================================
    if (view === 'results' && completedJob && activeBrand) {
        return (
            <BrandIntelligenceResult
                job={completedJob}
                brandName={activeBrand.name}
                onBack={goDetail}
            />
        );
    }

    // ========================================================
    // Render: Create view
    // ========================================================
    if (view === 'create') {
        return (
            <div className="bi-home">
                <div className="bi-toolbar">
                    <div>
                        <h2 className="bi-title">New Brand Profile</h2>
                        <p className="bi-subtitle">Register an official brand identity for monitoring.</p>
                    </div>
                </div>
                <BrandProfileForm
                    saving={saving}
                    error={formError}
                    onSave={handleCreate}
                    onCancel={goList}
                />
            </div>
        );
    }

    // ========================================================
    // Render: Detail view
    // ========================================================
    if (view === 'detail' && activeBrand) {
        return (
            <div className="bi-home">
                <div className="bi-detail-header">
                    <button type="button" className="bi-btn-secondary" onClick={goList}>
                        ← Back
                    </button>
                    <h2 className="bi-title" style={{ margin: 0 }}>{activeBrand.name}</h2>
                    <div className="bi-detail-header-actions">
                        {!confirmDelete && (
                            <button
                                type="button"
                                className="bi-btn-danger"
                                onClick={() => setConfirmDelete(true)}
                            >
                                Delete Brand
                            </button>
                        )}
                    </div>
                </div>

                {confirmDelete && (
                    <div className="bi-confirm" role="alertdialog" aria-label="Confirm brand deletion">
                        <p className="bi-confirm-text">
                            Delete <strong>{activeBrand.name}</strong>? This removes the brand and all its
                            identities and cannot be undone.
                        </p>
                        <div className="bi-confirm-actions">
                            <button
                                type="button"
                                className="bi-btn-secondary"
                                onClick={() => setConfirmDelete(false)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="bi-btn-danger"
                                onClick={handleDelete}
                                disabled={deleting}
                                aria-busy={deleting}
                            >
                                {deleting ? 'Deleting…' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                )}

                {/* BRAND_INTELLIGENCE_PASS7.md §4/§25 — persistent campaigns +
                    brand-level overview, distinct from the per-investigation
                    OverviewPane rendered inside a single job's results below. */}
                <BrandOverviewPane brandId={activeBrand.id} />

                {/* Run Investigation panel */}
                <div className="bi-scan-panel">
                    <div className="bi-scan-panel-info">
                        <p className="bi-scan-panel-title">Domain Impersonation Investigation</p>
                        <p className="bi-scan-panel-sub">
                            {hasDomainIdentity
                                ? 'Discover and evaluate domains impersonating this brand — typosquats, lookalikes, and certificate-transparency hits.'
                                : 'Add at least one official domain identity above before running an investigation.'}
                        </p>
                        {scanError && <div className="bi-error" role="alert">{scanError}</div>}
                    </div>
                    <button
                        type="button"
                        className="bi-btn-primary"
                        onClick={handleStartScan}
                        disabled={!hasDomainIdentity || scanStarting}
                        aria-busy={scanStarting}
                        title={hasDomainIdentity ? undefined : 'Add a domain identity first'}
                    >
                        {scanStarting ? 'Starting…' : 'Run Investigation'}
                    </button>
                </div>

                {/* Edit profile form */}
                <BrandProfileForm
                    brand={activeBrand}
                    saving={saving}
                    error={formError}
                    onSave={handleUpdate}
                    onCancel={goList}
                />

                {/* Identities manager */}
                <BrandIdentitiesEditor brand={activeBrand} onBrandUpdate={handleBrandUpdate} />

                {/* Past Investigations */}
                <div className="bi-past-jobs">
                    <p className="bi-section-title">Past Investigations</p>
                    {jobsLoading && <p className="bi-loading" style={{ fontSize: '0.85rem' }}>Loading…</p>}
                    {!jobsLoading && pastJobs.length === 0 && (
                        <p className="bi-empty-sub">No past investigations for this brand.</p>
                    )}
                    {!jobsLoading && pastJobs.length > 0 && (
                        <div className="bi-jobs-list" role="list">
                            {pastJobs.map((job) => {
                                // BRAND_INTELLIGENCE_PASS7.md §13 — a job
                                // that stopped with useful results (partial/
                                // retryable) is viewable, same as completed.
                                const viewable = job.status === 'completed' || job.status === 'cancelled'
                                    || job.status === 'partial' || job.status === 'retryable';
                                // §14 — retry is offered whenever the job
                                // landed in a state retryEligibleBrandScanJob()
                                // would actually accept; the route itself is
                                // still the source of truth (this is just
                                // when to show the button).
                                const retryable = ['failed', 'partial', 'retryable'].includes(job.status);
                                return (
                                    <div key={job.id} className="bi-job-row-wrap" role="listitem">
                                        <button
                                            type="button"
                                            className="bi-job-row"
                                            onClick={() => handleResumeJob(job)}
                                            disabled={!viewable}
                                        >
                                            <span className={`bi-job-status-badge ${jobStatusClass(job.status)}`}>
                                                {jobStatusLabel(job.status)}
                                            </span>
                                            <span className="bi-job-date">{formatDate(job.created_at)}</span>
                                            {job.progress_total > 0 && (
                                                <span className="bi-job-progress">
                                                    {job.progress_current}/{job.progress_total} candidates
                                                </span>
                                            )}
                                        </button>
                                        {retryable && (
                                            <button
                                                type="button"
                                                className="bi-btn-secondary"
                                                style={{ marginLeft: '8px' }}
                                                disabled={retryingJobId === job.id}
                                                aria-busy={retryingJobId === job.id}
                                                onClick={() => handleRetryJob(job.id)}
                                                title="Retry this investigation from where it left off"
                                            >
                                                {retryingJobId === job.id ? 'Retrying…' : 'Retry'}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                            {retryError && <div className="bi-error" role="alert" style={{ marginTop: '8px' }}>{retryError}</div>}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ========================================================
    // Render: List view (default)
    // ========================================================
    return (
        <div className="bi-home">
            <div className="bi-toolbar">
                <div>
                    <h2 className="bi-title">Brand Profiles</h2>
                    <p className="bi-subtitle">Manage official brand identities used for impersonation monitoring.</p>
                </div>
                <button
                    type="button"
                    className="bi-btn-primary"
                    onClick={() => { setView('create'); setFormError(null); }}
                >
                    + New Brand
                </button>
            </div>

            {listLoading && <p className="bi-loading">Loading brands…</p>}
            {listError && <div className="bi-error" role="alert">{listError}</div>}

            {!listLoading && !listError && brands.length === 0 && (
                <div className="bi-empty" role="status">
                    <p className="bi-empty-title">No brand profiles yet</p>
                    <p className="bi-empty-sub">
                        Create your first brand profile to start tracking official identities.
                    </p>
                    <button
                        type="button"
                        className="bi-btn-primary"
                        onClick={() => { setView('create'); setFormError(null); }}
                    >
                        + New Brand
                    </button>
                </div>
            )}

            {!listLoading && brands.length > 0 && (
                <div className="bi-brand-list" role="list" aria-label="Brand profile list">
                    {brands.map((brand) => (
                        <button
                            key={brand.id}
                            type="button"
                            className="bi-brand-card"
                            role="listitem"
                            onClick={() => openDetail(brand)}
                            aria-label={`Open ${brand.name} brand profile`}
                        >
                            <div className="bi-brand-card-name">{brand.name}</div>
                            <div className="bi-brand-card-meta">
                                <span className="bi-brand-card-count">
                                    {brand.identityCount ?? 0} {brand.identityCount === 1 ? 'identity' : 'identities'}
                                </span>
                                <span>Updated {formatDate(brand.updated_at)}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BrandIntelligenceHome;
