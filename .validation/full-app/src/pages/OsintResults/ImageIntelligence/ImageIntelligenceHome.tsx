import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './ImageIntelligence.css';
import { timeAgo } from '../../../utils/timeAgo';
import {
    getImages, analyzeImageUpload, analyzeImageUrl, getImage, reanalyzeImage, deleteImageRecord,
    getImageSimilarity, runImageReverseSearch, getImageReverseSearchHistory, getImageProviders,
    getImageTimeline as apiGetImageTimeline, addImageObservable, getImageAiSummary, imageFileUrl,
    getRelationshipGraph, getEvidence, addEvidence,
    type ImageRecord, type ImageSimilarityMatch, type ImageReverseSearchResult,
    type ImageReverseSearchHistoryEntry, type ImageSourceDiscoveryEntry, type ImageSourceTimelineYear,
    type ImageProviderStatus, type ImageTimelineEntry, type ImageAiSummary, type ImageObservable,
    type RelationshipGraph as GraphData, type EvidenceItem
} from '../../../services/api';
import { formatDateTime } from '../../ThreatIntelligence/ThreatIntelligenceShared';
import RiskAssessmentBlock from '../../ThreatIntelligence/sections/RiskAssessmentBlock';
import RelationshipGraphViz from '../../ThreatIntelligence/sections/RelationshipGraph';

function RiskBadge({ risk }: { risk: string | null | undefined }) {
    if (!risk) return <span className="im-risk-badge im-risk-badge--none">Not assessed</span>;
    return <span className={`im-risk-badge im-risk-badge--${risk.toLowerCase()}`}>{risk}</span>;
}
function ConfBadge({ confidence }: { confidence: string | null | undefined }) {
    if (!confidence) return <span className="im-badge im-badge--unknown">Unknown</span>;
    return <span className={`im-badge im-badge--${confidence.toLowerCase()}`}>{confidence}</span>;
}
function copyToClipboard(value: string) {
    navigator.clipboard?.writeText(value).catch(() => {});
}

function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onCancel }: { title: string; message: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
    return createPortal(
        <div className="im-confirm-overlay" data-lenis-prevent role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <div className="im-confirm-box">
                <h3>{title}</h3>
                <p>{message}</p>
                <div className="im-confirm-actions">
                    <button type="button" className="im-btn" onClick={onCancel}>Cancel</button>
                    <button type="button" className="im-btn im-btn--danger" onClick={onConfirm}>{confirmLabel}</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

function ImagePreviewModal({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return createPortal(
        <div className="im-confirm-overlay" data-lenis-prevent role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="im-lightbox-box">
                <button type="button" className="im-lightbox-close" aria-label="Close preview" onClick={onClose}>×</button>
                <img src={src} alt={alt} />
            </div>
        </div>,
        document.body
    );
}

function ExternalSearchConsentDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
    return createPortal(
        <div className="im-confirm-overlay" data-lenis-prevent role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <div className="im-confirm-box">
                <h3>External Search</h3>
                <p>This action may send the selected image to a third-party search provider (whichever providers are selected below). Internal Similarity never leaves LekirraX and does not require this confirmation.</p>
                <div className="im-confirm-actions">
                    <button type="button" className="im-btn" onClick={onCancel}>Cancel</button>
                    <button type="button" className="im-btn im-btn--primary" onClick={onConfirm}>Continue</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

interface ImageIntelligenceHomeProps {
    onNavigateToModule?: (moduleId: string, targetValue?: string) => void;
    // Opens ONE specific entity on the Threat Intelligence page. The
    // Relationship Graph emits a real (type, id) per node; previously every
    // node except 'ioc' was ignored and 'ioc' was sent to the OSINT
    // 'vulnerability-intel' module — the wrong destination, and one that was
    // an unimplemented placeholder, so the click dead-ended.
    onOpenEntity?: (entityType: string, entityId: string) => void;
}

const ImageIntelligenceHome: React.FC<ImageIntelligenceHomeProps> = ({ onNavigateToModule, onOpenEntity }) => {
    const [urlInput, setUrlInput] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);
    const [recentImages, setRecentImages] = useState<ImageRecord[]>([]);
    const [recentLoading, setRecentLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadRecent = useCallback(() => {
        setRecentLoading(true);
        getImages({ pageSize: 20 })
            .then((res) => setRecentImages(res.items))
            .catch(() => {})
            .finally(() => setRecentLoading(false));
    }, []);
    useEffect(() => { loadRecent(); }, [loadRecent]);

    const runUpload = async (file: File) => {
        setAnalyzing(true); setAnalyzeError(null);
        try {
            const result = await analyzeImageUpload(file);
            setSelectedId(result.image.id);
            loadRecent();
        } catch (err: any) {
            setAnalyzeError(err?.message || 'Failed to analyze image.');
        } finally {
            setAnalyzing(false);
        }
    };

    const runUrlAnalyze = async () => {
        if (!urlInput.trim()) return;
        setAnalyzing(true); setAnalyzeError(null);
        try {
            const result = await analyzeImageUrl(urlInput.trim());
            setSelectedId(result.image.id);
            setUrlInput('');
            loadRecent();
        } catch (err: any) {
            setAnalyzeError(err?.message || 'Failed to analyze image.');
        } finally {
            setAnalyzing(false);
        }
    };

    // §3 optional "[ Paste Image ]" — reads an image directly off the system clipboard.
    const handlePaste = (e: React.ClipboardEvent) => {
        const item = Array.from(e.clipboardData.items || []).find((i) => i.type.startsWith('image/'));
        if (!item) return;
        const file = item.getAsFile();
        if (file) runUpload(file);
    };

    if (selectedId != null) {
        return <ImageDetail imageId={selectedId} onBack={() => { setSelectedId(null); loadRecent(); }} onOpenImage={setSelectedId} onNavigateToModule={onNavigateToModule} onOpenEntity={onOpenEntity} />;
    }

    return (
        <div className="im-page" onPaste={handlePaste}>
            <div className="im-header">
                <div className="im-header-text">
                    <h2>Image Intelligence</h2>
                    <p>Analyze images for forensic information, visual relationships, source discovery, extracted observables, and potential security threats.</p>
                </div>
            </div>

            <div className="im-card im-intake">
                <div
                    className={dragActive ? 'im-dropzone im-dropzone--active' : 'im-dropzone'}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                        e.preventDefault(); setDragActive(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) runUpload(file);
                    }}
                >
                    Click to upload, drag and drop, or paste (Ctrl+V) an image — JPG, PNG, or WEBP.
                    <input
                        ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) runUpload(f); e.target.value = ''; }}
                    />
                </div>
                <div className="im-intake-divider">or analyze by URL</div>
                <div className="im-intake-row">
                    <input
                        type="url" placeholder="https://example.com/image.png" value={urlInput}
                        onChange={(e) => { setUrlInput(e.target.value); setAnalyzeError(null); }}
                        onKeyDown={(e) => e.key === 'Enter' && runUrlAnalyze()}
                    />
                    <button type="button" className="im-btn im-btn--primary" onClick={runUrlAnalyze} disabled={analyzing || !urlInput.trim()}>
                        {analyzing ? 'Analyzing…' : 'Analyze'}
                    </button>
                </div>
                {analyzeError && <div className="im-error">{analyzeError}</div>}
            </div>

            <div className="im-card">
                <div className="im-card-title">Recent Images</div>
                {recentLoading ? (
                    <div className="im-loading">Loading…</div>
                ) : recentImages.length === 0 ? (
                    <div className="im-empty">Upload an image or provide an image URL to begin analysis.</div>
                ) : (
                    <div className="im-list-images">
                        {recentImages.map((img) => (
                            <div key={img.id} className="im-image-row" onClick={() => setSelectedId(img.id)}>
                                <div className="im-image-row-left">
                                    <img className="im-image-row-thumb" src={imageFileUrl(img)} alt="" onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />
                                    <div>
                                        <div className="im-image-row-name">{img.originalFilename || img.filename || `Image #${img.id}`}</div>
                                        <div className="im-image-row-meta">{img.format || '—'} · {img.width && img.height ? `${img.width}×${img.height}` : '—'} · {img.createdAt ? timeAgo(img.createdAt) : ''}</div>
                                    </div>
                                </div>
                                {img.signatureMismatch && <span className="im-badge im-badge--warning">Signature mismatch</span>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────
// Image Detail
// ─────────────────────────────────────────────────────────────────────────

interface ImageDetailProps { imageId: number; onBack: () => void; onOpenImage: (id: number) => void; onNavigateToModule?: (moduleId: string, targetValue?: string) => void; onOpenEntity?: (entityType: string, entityId: string) => void; }

const ImageDetail: React.FC<ImageDetailProps> = ({ imageId, onBack, onOpenImage, onNavigateToModule, onOpenEntity }) => {
    const [image, setImage] = useState<ImageRecord | null>(null);
    const [similarity, setSimilarity] = useState<ImageSimilarityMatch[]>([]);
    const [reverseHistory, setReverseHistory] = useState<ImageReverseSearchHistoryEntry[]>([]);
    const [reverseResults, setReverseResults] = useState<ImageReverseSearchResult[]>([]);
    const [sources, setSources] = useState<ImageSourceDiscoveryEntry[]>([]);
    const [sourceTimeline, setSourceTimeline] = useState<ImageSourceTimelineYear[]>([]);
    const [providers, setProviders] = useState<ImageProviderStatus[]>([]);
    const [timeline, setTimeline] = useState<ImageTimelineEntry[]>([]);
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reanalyzing, setReanalyzing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        Promise.all([
            getImage(imageId), getImageSimilarity(imageId), getImageReverseSearchHistory(imageId), getImageProviders(),
            apiGetImageTimeline(imageId), getRelationshipGraph('image', imageId, 1).catch(() => ({ nodes: [], edges: [], truncated: false })),
            getEvidence('image', imageId).catch(() => [])
        ])
            .then(([img, sim, rev, prov, tl, g, ev]) => {
                setImage(img); setSimilarity(sim);
                setReverseHistory(rev.history); setReverseResults(rev.results); setSources(rev.sources); setSourceTimeline(rev.timeline);
                setProviders(prov); setTimeline(tl.items); setGraph(g); setEvidence(ev);
            })
            .catch((err) => setError(err?.message || 'Failed to load image'))
            .finally(() => setLoading(false));
    }, [imageId]);
    useEffect(() => { load(); }, [load]);

    const reanalyze = async () => {
        setReanalyzing(true);
        try { await reanalyzeImage(imageId); load(); } finally { setReanalyzing(false); }
    };
    const doDelete = async () => {
        setConfirmDelete(false);
        await deleteImageRecord(imageId);
        onBack();
    };

    if (loading) return <div className="im-page"><div className="im-loading">Loading image analysis…</div></div>;
    if (error || !image) return (
        <div className="im-page"><div className="im-error">{error || 'Image not found'}<button type="button" className="im-btn im-btn--sm" onClick={onBack}>Back</button></div></div>
    );

    const ocrObservables = image.ocrJson?.observables || [];
    const qrObservables = (image.qrJson || []).flatMap((q) => q.observables || []);

    return (
        <div className="im-page">
            <div className="im-header">
                <div className="im-header-text">
                    <button type="button" className="im-btn im-btn--sm" onClick={onBack} style={{ marginBottom: '10px' }}>‹ All Images</button>
                    <h2>{image.originalFilename || image.filename || `Image #${image.id}`}</h2>
                    <p>{image.format || '—'} · {image.width && image.height ? `${image.width}×${image.height}` : 'Dimensions unknown'} · {image.source === 'url' ? 'Source: URL' : 'Source: Upload'}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button type="button" className="im-btn im-btn--sm" onClick={reanalyze} disabled={reanalyzing}>{reanalyzing ? 'Analyzing…' : 'Re-Analyze'}</button>
                    <button type="button" className="im-btn im-btn--danger im-btn--sm" onClick={() => setConfirmDelete(true)}>Delete</button>
                </div>
            </div>

            {image.signatureMismatch && (
                <div className="im-warning-banner">⚠ File extension/declared type and the detected file signature do not match. See Forensics below.</div>
            )}

            {/* §5 Overview */}
            <div className="im-card">
                <div className="im-card-title">Image Overview</div>
                <div className="im-overview-grid">
                    <div className="im-preview">
                        <img src={imageFileUrl(image)} alt={image.originalFilename || 'Uploaded image'} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <button type="button" className="im-preview-btn" onClick={() => setPreviewOpen(true)}>Preview</button>
                    </div>
                    <div className="im-kv-grid-2col">
                        <div className="im-kv">
                            <span className="k">Filename</span><span className="v">{image.originalFilename || '—'}</span>
                            <span className="k">Format</span><span className="v">{image.format || '—'}</span>
                            <span className="k">MIME Type</span><span className="v">{image.detectedMimeType || image.mimeType || '—'}</span>
                            <span className="k">File Size</span><span className="v">{image.fileSize != null ? `${(image.fileSize / 1024).toFixed(1)} KB` : '—'}</span>
                        </div>
                        <div className="im-kv">
                            <span className="k">Dimensions</span><span className="v">{image.width && image.height ? `${image.width} × ${image.height}` : '—'}</span>
                            <span className="k">Color Model</span><span className="v">{image.colorModel || '—'}</span>
                            <span className="k">SHA256</span><span className="v im-mono" style={{ fontSize: '0.76rem' }}>{image.sha256}</span>
                            <span className="k">Analysis Time</span><span className="v">{image.analyzedAt ? formatDateTime(image.analyzedAt) : 'Not yet analyzed'}</span>
                            <span className="k">Source</span><span className="v">{image.source === 'url' ? (image.sourceUrl || 'URL') : 'Upload'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* §6/§7 Metadata & EXIF + Geolocation */}
            <div className="im-card">
                <div className="im-card-title">Metadata &amp; EXIF</div>
                {!image.metadataJson?.exif?.available ? (
                    <div className="im-empty">No EXIF/XMP/IPTC metadata available in this image.</div>
                ) : (
                    <div className="im-kv-grid-2col">
                        <div className="im-kv">
                            <span className="k">Camera Make</span><span className="v">{image.metadataJson.exif.fields.cameraMake || 'Not Available'}</span>
                            <span className="k">Camera Model</span><span className="v">{image.metadataJson.exif.fields.cameraModel || 'Not Available'}</span>
                            <span className="k">Lens</span><span className="v">{image.metadataJson.exif.fields.lens || 'Not Available'}</span>
                            <span className="k">Software</span><span className="v">{image.metadataJson.exif.fields.software || 'Not Available'}</span>
                            <span className="k">Date Taken</span><span className="v">{image.metadataJson.exif.fields.dateTaken || 'Not Available'}</span>
                            <span className="k">Date Modified</span><span className="v">{image.metadataJson.exif.fields.dateModified || 'Not Available'}</span>
                        </div>
                        <div className="im-kv">
                            <span className="k">Orientation</span><span className="v">{image.metadataJson.exif.fields.orientation || 'Not Available'}</span>
                            <span className="k">Exposure</span><span className="v">{image.metadataJson.exif.fields.exposureTime || 'Not Available'}</span>
                            <span className="k">ISO</span><span className="v">{image.metadataJson.exif.fields.iso || 'Not Available'}</span>
                            <span className="k">Focal Length</span><span className="v">{image.metadataJson.exif.fields.focalLength || 'Not Available'}</span>
                            <span className="k">Author</span><span className="v">{image.metadataJson.exif.fields.author || 'Not Available'}</span>
                            <span className="k">Copyright</span><span className="v">{image.metadataJson.exif.fields.copyright || 'Not Available'}</span>
                        </div>
                    </div>
                )}
                <div className="im-card-title" style={{ marginTop: '18px', fontSize: '0.82rem' }}>Geolocation</div>
                {!image.metadataJson?.exif?.gps ? (
                    <div className="im-empty">GPS location data not found.</div>
                ) : (
                    <div className="im-kv">
                        <span className="k">Latitude</span><span className="v">{image.metadataJson.exif.gps.latitude}</span>
                        <span className="k">Longitude</span><span className="v">{image.metadataJson.exif.gps.longitude}</span>
                        <span className="k">Altitude</span><span className="v">{image.metadataJson.exif.gps.altitude ?? 'Not Available'}</span>
                        <span className="k">Timestamp</span><span className="v">{image.metadataJson.exif.gps.timestamp || 'Not Available'}</span>
                    </div>
                )}
            </div>

            {/* §8 Hashing */}
            <div className="im-card">
                <div className="im-card-title">Image Hashing</div>
                {[
                    ['MD5', image.md5], ['SHA1', image.sha1], ['SHA256', image.sha256],
                    ['pHash', image.phash], ['dHash', image.dhash], ['aHash', image.ahash]
                ].map(([label, value]) => (
                    <div key={label} className="im-hash-row">
                        <span className="im-hash-label">{label}</span>
                        <span className="im-hash-value">{value || 'Not available for this format'}</span>
                        {value && <button type="button" className="im-hash-copy" onClick={() => copyToClipboard(value)}>Copy</button>}
                    </div>
                ))}
            </div>

            {/* §9/§35 Forensics */}
            <div className="im-card">
                <div className="im-card-title">Forensics</div>
                <div className="im-kv" style={{ marginBottom: '12px' }}>
                    <span className="k">Extension/MIME vs Signature</span>
                    <span className="v">{image.signatureMismatch ? <span className="im-badge im-badge--warning">Mismatch — {image.forensicsJson?.mismatchReason}</span> : 'Match'}</span>
                </div>
                {!image.forensicsJson?.indicators?.length ? (
                    <div className="im-empty">No file-structure anomalies detected.</div>
                ) : (
                    <ul className="im-ai-list">
                        {image.forensicsJson.indicators.map((ind, i) => (
                            <li key={i}><span className={`im-badge im-badge--${ind.severity}`}>{ind.severity}</span> {ind.description}</li>
                        ))}
                    </ul>
                )}
                <div className="im-ai-note" style={{ marginTop: '8px' }}>Steganography/embedded-data detection here is limited to structural indicators (appended data, signature mismatch) — not a full forensic steganalysis engine. "Potential manipulation indicators" is descriptive, not a determination.</div>
            </div>

            {/* §10 OCR */}
            <div className="im-card">
                <div className="im-card-title">OCR &amp; Text Extraction</div>
                {!image.ocrJson?.available ? (
                    <div className="im-empty">{image.ocrJson?.reason || 'OCR unavailable.'}</div>
                ) : !image.ocrJson.text ? (
                    <div className="im-empty">No text detected in image.</div>
                ) : (
                    <>
                        <div className="im-code-block">{image.ocrJson.text}</div>
                        <ObservablesTable observables={ocrObservables} imageId={imageId} />
                    </>
                )}
            </div>

            {/* §11 QR */}
            <div className="im-card">
                <div className="im-card-title">QR Code Analysis <span className="im-card-title-count">{image.qrJson?.length || 0}</span></div>
                {!image.qrJson?.length ? (
                    <div className="im-empty">No QR codes detected.</div>
                ) : (
                    <div className="im-table-wrap">
                        <table className="im-table">
                            <thead><tr><th>Type</th><th>Decoded Value</th><th>Confidence</th><th></th></tr></thead>
                            <tbody>
                                {image.qrJson.map((qr, i) => (
                                    <tr key={i}>
                                        <td>{qr.qrType}</td>
                                        <td className="im-mono"><span className="im-truncate" title={qr.decodedValue}>{qr.decodedValue}</span></td>
                                        <td><ConfBadge confidence={qr.confidence} /></td>
                                        <td>{qr.qrType === 'URL' && <button type="button" className="im-btn im-btn--sm" onClick={() => onNavigateToModule?.('domain-intel', new URL(qr.decodedValue).hostname)}>Analyze with Web Intelligence</button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <ObservablesTable observables={qrObservables} imageId={imageId} />
                    </div>
                )}
            </div>

            {/* §12 Screenshot Analysis */}
            <div className="im-card">
                <div className="im-card-title">Screenshot Analysis</div>
                {!image.screenshotJson?.looksLikeScreenshot ? (
                    <div className="im-empty">No screenshot-style elements detected.</div>
                ) : image.screenshotJson.indicators.length === 0 ? (
                    <div className="im-empty">Image appears to be a screenshot, but no notable form/warning language was detected.</div>
                ) : (
                    <ul className="im-ai-list">{image.screenshotJson.indicators.map((ind, i) => <li key={i}>{ind}</li>)}</ul>
                )}
            </div>

            {/* §13 Brand & Logo Analysis */}
            <div className="im-card">
                <div className="im-card-title">Brand Analysis <span className="im-card-title-count">{image.brandJson?.length || 0}</span></div>
                {!image.brandJson?.length ? (
                    <div className="im-empty">No recognizable brand or organization names detected in this image's text.</div>
                ) : (
                    <div className="im-table-wrap">
                        <table className="im-table">
                            <thead><tr><th>Brand</th><th>Source</th><th>Confidence</th><th></th></tr></thead>
                            <tbody>
                                {image.brandJson.map((b, i) => (
                                    <tr key={i}>
                                        <td>{b.brand}</td><td>{b.source}</td><td><ConfBadge confidence={b.confidence} /></td>
                                        <td><button type="button" className="im-btn im-btn--sm" onClick={() => onNavigateToModule?.('brand-intel', b.brand)}>Analyze Brand</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="im-ai-note" style={{ marginTop: '8px' }}>Brand name matches are a text-pattern heuristic, not verified computer-vision logo detection, and are never treated as evidence of malicious activity on their own.</div>
            </div>

            {/* §14 Local Image Similarity */}
            <div className="im-card">
                <div className="im-card-title">Local Image Similarity <span className="im-card-title-count">{similarity.length}</span></div>
                {similarity.length === 0 ? (
                    <div className="im-empty">No comparable images available.</div>
                ) : (
                    <div className="im-table-wrap">
                        <table className="im-table">
                            <thead><tr><th>Similar Image</th><th>Similarity</th><th>Hash Type</th><th>First Seen</th><th>Last Seen</th><th></th></tr></thead>
                            <tbody>
                                {similarity.map((m) => (
                                    <tr key={m.imageId}>
                                        <td>{m.filename}</td><td>{m.similarity}%</td><td>{m.hashType}</td>
                                        <td>{timeAgo(m.firstSeen)}</td><td>{timeAgo(m.lastSeen)}</td>
                                        <td><button type="button" className="im-btn im-btn--sm" onClick={() => onOpenImage(m.imageId)}>Related Investigation</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* §15-25 Reverse Image Search + Visual Source Discovery + Timeline */}
            <ReverseSearchSection
                imageId={imageId} providers={providers} history={reverseHistory} results={reverseResults}
                sources={sources} sourceTimeline={sourceTimeline} brandMentions={image.brandJson || []}
                onSearched={load} onNavigateToModule={onNavigateToModule}
            />

            {/* §38 Threat Analysis */}
            <div className="im-card">
                <div className="im-card-title">Threat Analysis</div>
                {image.threatJson ? (
                    <>
                        <div className="im-kv" style={{ marginBottom: '10px' }}><span className="k">Risk</span><span className="v"><RiskBadge risk={image.threatJson.risk} /></span></div>
                        {image.threatJson.evidence.length === 0 ? (
                            <div className="im-empty">{image.threatJson.note}</div>
                        ) : (
                            <ul className="im-ai-list">{image.threatJson.evidence.map((e, i) => <li key={i}>✓ {e}</li>)}</ul>
                        )}
                    </>
                ) : <div className="im-empty">Not yet assessed.</div>}
            </div>

            {/* §39/§21 Risk Assessment (reused as-is) */}
            <div className="im-card">
                <div className="im-card-title">Risk Assessment</div>
                <RiskAssessmentBlock entityType="image" entityId={image.id} />
            </div>

            {/* Relationship Graph (reused as-is) */}
            <div className="im-card">
                <div className="im-card-title">Relationship Graph</div>
                {graph && (graph.nodes.length > 1) ? <RelationshipGraphViz data={graph} onNodeOpen={(type, id) => onOpenEntity?.(type, id)} /> : <div className="im-empty">No relationships to graph yet.</div>}
            </div>

            {/* Timeline (audit history) */}
            <div className="im-card">
                <div className="im-card-title">Timeline <span className="im-card-title-count">{timeline.length}</span></div>
                {timeline.length === 0 ? (
                    <div className="im-empty">No activity recorded yet.</div>
                ) : (
                    timeline.map((t) => (
                        <div key={t.id} className="im-timeline-item">
                            <div className="im-timeline-dot" />
                            <div className="im-timeline-content">
                                <span className="im-timeline-action">{t.action.replace(/_/g, ' ')}</span>
                                {t.newValue && <span> — {t.newValue}</span>}
                                <div className="im-timeline-meta">{t.source || 'System'}{t.username ? ` · ${t.username}` : ''} · {t.createdAt ? timeAgo(t.createdAt) : ''}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="im-card">
                <div className="im-card-title">Evidence <span className="im-card-title-count">{evidence.length}</span></div>
                <div className="im-kv" style={{ marginBottom: '12px' }}>
                    <span className="k">Original Evidence</span>
                    <span className="v">The uploaded image itself — SHA256 {image.sha256.slice(0, 16)}…, preserved unmodified on disk.</span>
                </div>
                {evidence.length === 0 ? (
                    <div className="im-empty">No derived evidence saved yet. Use [Save Evidence] on a reverse search result below.</div>
                ) : (
                    <div className="im-table-wrap">
                        <table className="im-table">
                            <thead><tr><th>Kind</th><th>Source</th><th>Description</th><th>URL</th><th>Confidence</th><th>Saved</th></tr></thead>
                            <tbody>
                                {evidence.map((e) => (
                                    <tr key={e.id}>
                                        <td><span className="im-badge im-badge--info">Derived</span></td>
                                        <td>{e.source}</td>
                                        <td><span className="im-truncate" title={e.description || ''}>{e.description || '—'}</span></td>
                                        <td>{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer">Open ↗</a> : '—'}</td>
                                        <td><ConfBadge confidence={e.confidence} /></td>
                                        <td>{e.created_at ? timeAgo(e.created_at) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* §40 AI Summary */}
            <AiSummarySection imageId={imageId} />

            {confirmDelete && <ConfirmDialog title="Delete image?" message="This will remove the image and its collected analysis from Image Intelligence. This action cannot be undone from this screen." onConfirm={doDelete} onCancel={() => setConfirmDelete(false)} />}
            {previewOpen && <ImagePreviewModal src={imageFileUrl(image)} alt={image.originalFilename || 'Uploaded image'} onClose={() => setPreviewOpen(false)} />}
        </div>
    );
};

function ObservablesTable({ observables, imageId }: { observables: ImageObservable[]; imageId: number }) {
    const [added, setAdded] = useState<Set<string>>(new Set());
    if (!observables.length) return null;
    const add = async (o: ImageObservable) => {
        try { await addImageObservable(imageId, o.type, o.value); setAdded((s) => new Set(s).add(`${o.type}:${o.value}`)); } catch { /* best-effort */ }
    };
    return (
        <div className="im-table-wrap" style={{ marginTop: '10px' }}>
            <table className="im-table">
                <thead><tr><th>Type</th><th>Value</th><th>Source</th><th>Confidence</th><th></th></tr></thead>
                <tbody>
                    {observables.map((o, i) => {
                        const key = `${o.type}:${o.value}`;
                        return (
                            <tr key={i}>
                                <td>{o.type}</td>
                                <td className="im-mono"><span className="im-truncate" title={o.value}>{o.value}</span></td>
                                <td>{o.source}</td><td><ConfBadge confidence={o.confidence} /></td>
                                <td>
                                    {added.has(key) ? <span className="im-badge im-badge--info">Added</span> :
                                        <button type="button" className="im-btn im-btn--sm" onClick={() => add(o)}>Add to Observables</button>}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

const MATCH_TYPE_LABEL: Record<string, string> = {
    exact: 'Exact Match', near_exact: 'Possible Match', visually_similar: 'Visually Similar',
    related_page: 'Related Page', possible_source: 'Potential Source'
};
export function matchTypeLabel(matchType: string): string {
    return MATCH_TYPE_LABEL[matchType] || matchType.replace(/_/g, ' ');
}

function resultKey(r: ImageReverseSearchResult): string {
    return r.pageUrl || r.imageUrl || `${r.provider}:${r.title || ''}:${r.retrievedAt}`;
}

export function ReverseSearchSection({ imageId, providers, history, results, sources, sourceTimeline, brandMentions, onSearched, onNavigateToModule }: {
    imageId: number; providers: ImageProviderStatus[]; history: ImageReverseSearchHistoryEntry[]; results: ImageReverseSearchResult[];
    sources: ImageSourceDiscoveryEntry[]; sourceTimeline: ImageSourceTimelineYear[];
    brandMentions: { brand: string; officialDomains: string[] }[]; onSearched: () => void;
    onNavigateToModule?: (moduleId: string, targetValue?: string) => void;
}) {
    const [selectedProviders, setSelectedProviders] = useState<Set<string>>(new Set());
    const [showConsent, setShowConsent] = useState(false);
    const [searchState, setSearchState] = useState<'idle' | 'queued' | 'searching' | 'processing'>('idle');
    const [searchError, setSearchError] = useState<string | null>(null);
    const [providerTab, setProviderTab] = useState<string>('all');
    const [addedObservables, setAddedObservables] = useState<Set<string>>(new Set());
    const [savedEvidence, setSavedEvidence] = useState<Set<string>>(new Set());

    const externalProviders = providers.filter((p) => p.id !== 'internal');
    const toggle = (id: string) => setSelectedProviders((s) => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next; });

    const doSearch = async (providerIds?: string[]) => {
        setSearchState('queued'); setSearchError(null);
        try {
            setSearchState('searching');
            await runImageReverseSearch(imageId, providerIds);
            setSearchState('processing');
            onSearched();
        } catch (err: any) {
            setSearchError(err?.message || 'Reverse image search failed.');
        } finally {
            setSearchState('idle');
        }
    };
    const searchButtonLabel = searchState === 'queued' ? 'Queued…' : searchState === 'searching' ? 'Searching…' : searchState === 'processing' ? 'Processing Results…' : null;

    const runInternalOnly = () => doSearch(['internal']);
    const requestExternal = () => {
        if (selectedProviders.size === 0) { setSearchError('Select at least one provider.'); return; }
        setShowConsent(true);
    };
    const confirmExternal = () => { setShowConsent(false); doSearch(['internal', ...Array.from(selectedProviders)]); };

    // §26/§REVERSE SEARCH UI "Provider tabs: Internal / Google Vision / Bing"
    const tabs = useMemo(() => [{ id: 'all', label: 'All', count: results.length }, ...providers.map((p) => ({ id: p.id, label: p.label, count: results.filter((r) => r.provider === p.id || r.providers?.includes(p.label)).length }))], [providers, results]);
    const filteredResults = providerTab === 'all' ? results : results.filter((r) => r.provider === providerTab || r.providers?.includes(providers.find((p) => p.id === providerTab)?.label || '__none__'));

    const addResultObservable = async (r: ImageReverseSearchResult) => {
        if (!r.sourceDomain) return;
        try { await addImageObservable(imageId, 'Domain', r.sourceDomain); setAddedObservables((s) => new Set(s).add(resultKey(r))); } catch { /* best-effort */ }
    };

    const saveResultEvidence = async (r: ImageReverseSearchResult) => {
        try {
            const descriptionParts = [
                `Derived Evidence — ${matchTypeLabel(r.matchType)}`,
                r.title ? `Title: ${r.title}` : null,
                r.sourceDomain ? `Domain: ${r.sourceDomain}` : null,
                `Retrieved: ${formatDateTime(r.retrievedAt)}`,
                r.searchId != null ? `Search ID: ${r.searchId}` : null
            ].filter(Boolean);
            await addEvidence({
                entityType: 'image', entityId: imageId,
                source: r.providers?.join(', ') || r.provider,
                url: r.pageUrl || r.imageUrl || undefined,
                description: descriptionParts.join(' · '),
                confidence: r.confidence || undefined
            });
            setSavedEvidence((s) => new Set(s).add(resultKey(r)));
            onSearched(); // refresh the Evidence section below with the new row
        } catch { /* best-effort */ }
    };

    return (
        <div className="im-card">
            <div className="im-card-title">Reverse Image Search</div>
            <div className="im-provider-list">
                {providers.length === 0 ? <span className="im-empty">Loading provider status…</span> : providers.map((p) => (
                    <div key={p.id} className="im-provider-pill">
                        <span className={`im-provider-pill-dot im-provider-pill-dot--${p.status.available ? 'available' : 'unavailable'}`} />
                        {p.label}
                        <span style={{ color: 'rgba(148,163,184,0.7)' }}>— {p.status.available ? 'Available' : (p.status.reason || 'Unavailable')}</span>
                        {p.id !== 'internal' && (
                            <label className="im-provider-checkbox" style={{ marginLeft: '6px' }}>
                                <input type="checkbox" disabled={!p.status.available} checked={selectedProviders.has(p.id)} onChange={() => toggle(p.id)} />
                            </label>
                        )}
                    </div>
                ))}
            </div>
            {externalProviders.every((p) => !p.status.available) && (
                <div className="im-empty" style={{ marginBottom: '10px' }}>External reverse image search is not configured or currently unavailable. Internal Similarity still works.</div>
            )}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                <button type="button" className="im-btn im-btn--sm" onClick={runInternalOnly} disabled={searchState !== 'idle'}>{searchButtonLabel || 'Search Internal'}</button>
                <button type="button" className="im-btn im-btn--primary im-btn--sm" onClick={requestExternal} disabled={searchState !== 'idle' || externalProviders.every((p) => !p.status.available)}>{searchButtonLabel || 'Search All'}</button>
            </div>
            {searchError && <div className="im-error" style={{ marginBottom: '10px' }}>{searchError}</div>}

            {results.length > 0 && (
                <div className="im-provider-list" role="tablist" aria-label="Filter results by provider">
                    {tabs.map((t) => (
                        <button key={t.id} type="button" role="tab" aria-selected={providerTab === t.id}
                            className={providerTab === t.id ? 'im-btn im-btn--sm im-btn--primary' : 'im-btn im-btn--sm'}
                            onClick={() => setProviderTab(t.id)}>{t.label} ({t.count})</button>
                    ))}
                </div>
            )}

            {results.length === 0 ? (
                <div className="im-empty">No reverse image search results found.</div>
            ) : filteredResults.length === 0 ? (
                <div className="im-empty">No results from this provider.</div>
            ) : (
                <div className="im-result-grid">
                    {filteredResults.map((r, i) => {
                        const key = resultKey(r);
                        const relatedBrand = r.sourceDomain ? brandMentions.find((b) => {
                            const domainLower = r.sourceDomain!.toLowerCase();
                            const slug = b.brand.toLowerCase().replace(/\s+/g, '');
                            const isOfficial = b.officialDomains.some((d) => domainLower === d.toLowerCase() || domainLower.endsWith(`.${d.toLowerCase()}`));
                            return !isOfficial && slug.length >= 3 && domainLower.includes(slug);
                        }) : undefined;
                        return (
                            <div key={i} className="im-result-card">
                                {r.thumbnailUrl ? <img className="im-result-thumb" src={r.thumbnailUrl} alt="" /> : <div className="im-result-thumb im-result-thumb--placeholder">No preview</div>}
                                <div className="im-result-match-type">{matchTypeLabel(r.matchType)}</div>
                                {r.sourceDomain && <div className="im-result-domain">{r.sourceDomain}</div>}
                                {r.title && <div className="im-result-title" title={r.title}>{r.title}</div>}
                                <div className="im-result-meta">
                                    Provider: {r.providers?.join(', ') || r.providerLabel || r.provider}<br />
                                    Confidence: {r.confidence ? r.confidence : (r.similarity != null ? `LekirraX Similarity ${r.similarity}%` : 'Not provided')}<br />
                                    Retrieved: {timeAgo(r.retrievedAt)}
                                    {r.publicationDate ? ` · Published: ${r.publicationDate}` : ' · Published: Date unavailable'}
                                </div>
                                {relatedBrand && (
                                    <div className="im-badge im-badge--warning" style={{ alignSelf: 'flex-start' }} title="Not automatically classified as malicious">
                                        Potential Brand Relationship: {relatedBrand.brand}
                                    </div>
                                )}
                                <div className="im-result-actions">
                                    {r.pageUrl && <a className="im-btn im-btn--sm" href={r.pageUrl} target="_blank" rel="noopener noreferrer" title="Opens an external destination">Open Source ↗ (external)</a>}
                                    {r.sourceDomain && <button type="button" className="im-btn im-btn--sm" onClick={() => onNavigateToModule?.('domain-intel', r.sourceDomain!)}>Analyze Domain</button>}
                                    {relatedBrand && <button type="button" className="im-btn im-btn--sm" onClick={() => onNavigateToModule?.('brand-intel', relatedBrand.brand)}>Analyze Brand</button>}
                                    {r.sourceDomain && (addedObservables.has(key)
                                        ? <span className="im-badge im-badge--info">Observable Added</span>
                                        : <button type="button" className="im-btn im-btn--sm" onClick={() => addResultObservable(r)}>Add Observable</button>)}
                                    {savedEvidence.has(key)
                                        ? <span className="im-badge im-badge--info">Evidence Saved</span>
                                        : <button type="button" className="im-btn im-btn--sm" onClick={() => saveResultEvidence(r)}>Save Evidence</button>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="im-card-title" style={{ marginTop: '18px', fontSize: '0.82rem' }}>Visual Source Discovery <span className="im-card-title-count">{sources.length}</span></div>
            {sources.length === 0 ? (
                <div className="im-empty">No potential source page could be established from available results.</div>
            ) : (
                <div className="im-table-wrap">
                    <table className="im-table">
                        <thead><tr><th>Domain</th><th>Page</th><th>Earlier Observed</th><th>Match</th><th>Match Confidence</th><th>Provider Confidence</th></tr></thead>
                        <tbody>
                            {sources.map((s, i) => (
                                <tr key={i}>
                                    <td>{s.domain || '—'}</td>
                                    <td><span className="im-truncate" title={s.pageTitle || ''}>{s.pageTitle || '—'}</span></td>
                                    <td>{s.earliestObserved || 'Date unavailable'}</td>
                                    <td>{matchTypeLabel(s.matchType)}</td>
                                    <td><ConfBadge confidence={s.matchConfidence} /></td>
                                    <td>{s.providerConfidence || 'Not provided'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="im-ai-note" style={{ marginTop: '6px' }}>"Earlier Observed" reflects when a result was first indexed by a search provider — it does not mean this is the image's original source. "Match Confidence" is LekirraX's own assessment derived from match type, kept separate from "Provider Confidence" (only populated when a provider actually returns one).</div>

            {sourceTimeline.length > 0 && (
                <>
                    <div className="im-card-title" style={{ marginTop: '18px', fontSize: '0.82rem' }}>Image Source Timeline</div>
                    <div className="im-table-wrap">
                        <table className="im-table">
                            <thead><tr><th>Date</th><th>Domain</th><th>Page</th><th>Match Type</th><th>Provider</th></tr></thead>
                            <tbody>
                                {sourceTimeline.map((y) => y.entries.map((e, i) => (
                                    <tr key={`${y.year}-${i}`}>
                                        <td>{e.date}</td>
                                        <td>{e.domain || '—'}</td>
                                        <td><span className="im-truncate" title={e.pageTitle || ''}>{e.pageTitle || '—'}</span></td>
                                        <td>{matchTypeLabel(e.matchType)}</td>
                                        <td>{e.providers?.join(', ') || '—'}</td>
                                    </tr>
                                )))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {history.length > 0 && (
                <>
                    <div className="im-card-title" style={{ marginTop: '18px', fontSize: '0.82rem' }}>Search History</div>
                    <div className="im-table-wrap">
                        <table className="im-table">
                            <thead><tr><th>Provider</th><th>Status</th><th>Results</th><th>When</th></tr></thead>
                            <tbody>
                                {history.map((h) => (
                                    <tr key={h.id}>
                                        <td>{h.provider}</td>
                                        <td style={{ textTransform: 'capitalize' }}>{h.status.replace(/_/g, ' ')}{h.errorMessage ? ` — ${h.errorMessage}` : ''}</td>
                                        <td>{h.resultCount}</td>
                                        <td>{h.startedAt ? timeAgo(h.startedAt) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {showConsent && <ExternalSearchConsentDialog onConfirm={confirmExternal} onCancel={() => setShowConsent(false)} />}
        </div>
    );
}

function AiSummarySection({ imageId }: { imageId: number }) {
    const [result, setResult] = useState<{ evidence: any; summary: ImageAiSummary } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = async () => {
        setLoading(true); setError(null);
        try { setResult(await getImageAiSummary(imageId)); } catch (err: any) { setError(err?.message || 'Failed to generate summary.'); } finally { setLoading(false); }
    };

    return (
        <div className="im-card">
            <div className="im-card-title">
                AI Intelligence Summary
                <button type="button" className="im-btn im-btn--sm" onClick={generate} disabled={loading}>{loading ? 'Generating…' : result ? 'Regenerate' : 'Generate Summary'}</button>
            </div>
            {error && <div className="im-error">{error}</div>}
            {!result && !loading && !error && <div className="im-empty">Generate an AI summary of everything collected above — it only summarizes real, already-observed evidence and never invents findings.</div>}
            {result && (
                <div className="im-ai-section">
                    <div>
                        <span className="im-interpretation-tag">AI Interpretation</span>
                        <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'rgba(224,224,224,0.92)' }}>{result.summary.executiveSummary}</p>
                    </div>
                    {result.summary.keyFindings.length > 0 && (
                        <div><div className="im-ai-block-title">Key Findings</div><ul className="im-ai-list">{result.summary.keyFindings.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
                    )}
                    {result.summary.riskFactors.length > 0 && (
                        <div><div className="im-ai-block-title">Risk Factors</div><ul className="im-ai-list">{result.summary.riskFactors.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
                    )}
                    {result.summary.observedEvidence.length > 0 && (
                        <div>
                            <span className="im-evidence-tag">Observed Evidence</span>
                            <ul className="im-ai-list">{result.summary.observedEvidence.map((f, i) => <li key={i}>{f}</li>)}</ul>
                        </div>
                    )}
                    {result.summary.aiInterpretation.length > 0 && (
                        <div>
                            <span className="im-interpretation-tag">AI Interpretation</span>
                            <ul className="im-ai-list">{result.summary.aiInterpretation.map((f, i) => <li key={i}>{f}</li>)}</ul>
                        </div>
                    )}
                    {result.summary.recommendedActions.length > 0 && (
                        <div><div className="im-ai-block-title">Recommended Analyst Actions</div><ul className="im-ai-list">{result.summary.recommendedActions.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
                    )}
                    <div className="im-ai-note">{result.summary.note}</div>
                </div>
            )}
        </div>
    );
}

export default ImageIntelligenceHome;
