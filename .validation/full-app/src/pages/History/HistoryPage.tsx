import { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import './HistoryPage.css';
import {
  deleteHistoryOsint,
  deleteHistoryScan,
  deleteUserHistoryOsint,
  deleteUserHistoryScan,
  bulkDeleteHistoryScans,
  bulkDeleteUserHistoryScans,
  bulkDeleteHistoryOsint,
  bulkDeleteUserHistoryOsint,
  permanentlyDeleteHistoryScan,
  permanentlyDeleteHistoryOsint,
  bulkPermanentlyDeleteHistoryScans,
  bulkPermanentlyDeleteHistoryOsint,
  getHistoryOsint,
  getHistoryOsintDetails,
  getHistoryScans,
  getHistoryScanDetails,
  getUserHistoryOsint,
  getUserHistoryOsintDetails,
  getUserHistoryScanDetails,
  getUserHistoryScans
} from '../../services/api';
import JsonViewer from '../../components/JsonViewer';
import SecurityReport from '../../components/SecurityReport';
import PrintableScanReport from '../../components/PrintableScanReport';
import { notifyAuthStatus } from '../../services/authEvents';
import { buildOsintEntries, buildOsintStateFromStoredResults, validateOsintEntries, WEB_CHECK_OSINT_MODULES } from '../../utils/osintReport';
import { buildHostingCountriesData, buildScanSections } from '../../utils/scanReport';
import { downloadBlob } from '../../components/shared/downloadFile';  // P1-5 — was open-coded here

type HistoryListItem = {
  id: number;
  target: string;
  scan_date: string | null;
  has_snapshot: boolean;
  threat_level: number | null;
  summary: string | null;
  firewall_detected: boolean | null;
  waf_name: string | null;
  systems_count: number;
  osint_count: number;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by_user_id?: number | null;
};

type HistoryListResponse = {
  status: 'success' | 'error';
  items: HistoryListItem[];
  total: number;
  page: number;
  pageSize: number;
};

type HistoryDetailResponse = {
  status: 'success' | 'error';
  data: any;
};

type OsintListItem = {
  id: number;
  created_at: string | null;
  investigation_type: string;
  module: string;
  target: string;
  risk_level: string | null;
  username: string | null;
  scan_id: number | null;
  result_version: number;
  encrypted: boolean;
  payload_available: boolean;
  is_deleted?: boolean;
  deleted_at?: string | null;
  deleted_by_user_id?: number | null;
};

type OsintListResponse = {
  status: 'success' | 'error';
  items: OsintListItem[];
  total: number;
  page: number;
  pageSize: number;
};

interface HistoryPageProps {
  onBack: () => void;
  onRunQuery?: (target: string) => void;
  isAdmin?: boolean;
}

function buildHistoryPrintSource(detail: any) {
  const snapshot = detail?.scan?.page_content && typeof detail.scan.page_content === 'object'
    ? detail.scan.page_content
    : {};
  const snapshotSystems = Array.isArray(snapshot?.systems) ? snapshot.systems : [];
  const detailSystems = Array.isArray(detail?.systems) ? detail.systems : [];

  const mergedSystems = detailSystems.length > 0
    ? detailSystems.map((system: any, index: number) => {
        const snapshotSystem = snapshotSystems[index] && typeof snapshotSystems[index] === 'object'
          ? snapshotSystems[index]
          : {};

        return {
          ...snapshotSystem,
          ...system,
          location: {
            ...(snapshotSystem?.location || {}),
            ...(system?.location || {})
          },
          ports: Array.isArray(snapshotSystem?.ports) || Array.isArray(snapshotSystem?.ports?.results)
            ? snapshotSystem.ports
            : Array.isArray(system?.ports)
              ? system.ports
              : []
        };
      })
    : snapshotSystems;

  const primarySystem = mergedSystems[0] || snapshot?.primarySystem || {};

  return {
    ...snapshot,
    target: detail?.scan?.target ?? snapshot?.target,
    scanDate: detail?.scan?.scan_date ?? snapshot?.scanDate ?? snapshot?.scan_date ?? null,
    firewall: detail?.firewall ? { ...(snapshot?.firewall || {}), ...detail.firewall } : snapshot?.firewall,
    systems: mergedSystems,
    primarySystem,
    headers: snapshot?.headers ?? primarySystem?.headers?.headers,
    security: snapshot?.security ?? primarySystem?.headers?.security
  };
}

export default function HistoryPage({ onBack, onRunQuery, isAdmin = false }: HistoryPageProps) {
  const [tab, setTab] = useState<'scans' | 'osint'>('scans');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'scan_date' | 'target' | 'threat_level'>('scan_date');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [moduleFilter, setModuleFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [osintView, setOsintView] = useState<'timeline' | 'table'>('timeline');
  const [osintPayloadView, setOsintPayloadView] = useState<'tree' | 'code'>('tree');
  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HistoryListResponse | null>(null);
  const [osintData, setOsintData] = useState<OsintListResponse | null>(null);

  const [selected, setSelected] = useState<{ kind: 'scan' | 'osint'; id: number } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [showAllSystems, setShowAllSystems] = useState(false);
  const [showAllOsint, setShowAllOsint] = useState(false);
  const drawerBodyRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: 'scan' | 'osint';
    id: number;
    label?: string;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Multi-select bulk delete (soft-delete only — see plan). Scoped to the
  // current tab; cleared whenever the underlying list changes so a stale
  // selection can never target rows the user isn't currently looking at.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState<{ kind: 'scan' | 'osint'; ids: number[] } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Admin-only permanent (hard) delete — irreversible, only offered on
  // already soft-deleted rows, gated behind typing the record's label.
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState<{
    kind: 'scan' | 'osint';
    id: number;
    label: string;
  } | null>(null);
  const [permanentConfirmInput, setPermanentConfirmInput] = useState('');
  const [permanentBusy, setPermanentBusy] = useState(false);

  // Admin-only bulk permanent delete — same recycle-bin gate (ids not yet
  // soft-deleted are skipped server-side, not force-deleted), typed
  // confirmation is the selection count since a batch has no single label.
  const [confirmBulkPermanentDelete, setConfirmBulkPermanentDelete] = useState<{ kind: 'scan' | 'osint'; ids: number[] } | null>(null);
  const [bulkPermanentConfirmInput, setBulkPermanentConfirmInput] = useState('');
  const [bulkPermanentBusy, setBulkPermanentBusy] = useState(false);

  useEffect(() => {
    if (!confirmDelete && !confirmBulkDelete && !confirmPermanentDelete && !confirmBulkPermanentDelete) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [confirmDelete, confirmBulkDelete, confirmPermanentDelete, confirmBulkPermanentDelete]);
    
  useEffect(() => {
    if (!selected) return;
    
    const resetScroll = () => {
      if (rightScrollRef.current) {
        rightScrollRef.current.scrollTop = 0;
        if (typeof rightScrollRef.current.scrollTo === 'function') {
          rightScrollRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
      }
      
      if (drawerBodyRef.current) {
        drawerBodyRef.current.scrollTop = 0;
        if (typeof drawerBodyRef.current.scrollTo === 'function') {
          drawerBodyRef.current.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
      }
      
      const jsonEl = document.querySelector('.history-json') as HTMLElement | null;
      if (jsonEl) {
        jsonEl.scrollTop = 0;
        if (typeof jsonEl.scrollTo === 'function') {
          jsonEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
      }
    };
    
    requestAnimationFrame(() => {
      resetScroll();
      requestAnimationFrame(resetScroll);
      setTimeout(resetScroll, 50);
      setTimeout(resetScroll, 100);
      setTimeout(resetScroll, 150);
    });
  }, [selected]);

  const totalPages = useMemo(() => {
    const total = tab === 'scans' ? (data?.total ?? 0) : (osintData?.total ?? 0);
    return Math.max(1, Math.ceil(total / pageSize));
  }, [data?.total, osintData?.total, pageSize, tab]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    
    const getScansFn = isAdmin ? getHistoryScans : getUserHistoryScans;
    const getOsintFn = isAdmin ? getHistoryOsint : getUserHistoryOsint;
    
    const p =
      tab === 'scans'
        ? getScansFn({ q, from, to, sort, order, page, pageSize }).then((res: HistoryListResponse) => {
            if (cancelled) return;
            setData(res);
          })
        : getOsintFn({
            q,
            from,
            to,
            module: moduleFilter,
            page,
            pageSize
          }).then((res: OsintListResponse) => {
            if (cancelled) return;
            setOsintData(res);
          });

    p.catch((e: any) => {
      if (cancelled) return;
      setError(e?.message || 'Failed to load history');
    }).finally(() => {
      if (cancelled) return;
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, q, from, to, sort, order, page, pageSize, tab, moduleFilter, refreshKey]);

  // A stale selection must never survive the list it was made against changing.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [tab, page, pageSize, q, from, to, sort, order, moduleFilter, refreshKey]);

  // Handle risk filter changes locally (no API reload needed)
  useEffect(() => {
    // Only update HUD, not reload data
  }, [riskFilter]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    setDetail(null);
    setShowAllSystems(false);
    setShowAllOsint(false);
    setOsintPayloadView('tree');
    const getScanDetailsFn = isAdmin ? getHistoryScanDetails : getUserHistoryScanDetails;
    const getOsintDetailsFn = isAdmin ? getHistoryOsintDetails : getUserHistoryOsintDetails;
    const p = selected.kind === 'scan' ? getScanDetailsFn(selected.id) : getOsintDetailsFn(selected.id);
    p.then((res: HistoryDetailResponse) => {
      if (cancelled) return;
      setDetail(res.data);
    })
      .catch((e: any) => {
        if (cancelled) return;
        setDetailError(e?.message || 'Failed to load details');
      })
      .finally(() => {
        if (cancelled) return;
        setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, selected]);

  const openDeleteConfirm = (payload: { kind: 'scan' | 'osint'; id: number; label?: string }) => {
    setConfirmDelete(payload);
  };

  const onConfirmDelete = async () => {
    if (!confirmDelete || confirmBusy) return;
    setConfirmBusy(true);
    try {
      if (confirmDelete.kind === 'scan') {
        const deleteScanFn = isAdmin ? deleteHistoryScan : deleteUserHistoryScan;
        await deleteScanFn(confirmDelete.id);
      } else {
        const deleteOsintFn = isAdmin ? deleteHistoryOsint : deleteUserHistoryOsint;
        await deleteOsintFn(confirmDelete.id);
      }
      setConfirmDelete(null);
      setConfirmBusy(false);
      if (selected?.kind === confirmDelete.kind && selected.id === confirmDelete.id) {
        setSelected(null);
      }
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      const msg = e?.message || 'Delete failed';
      if (msg === 'Not found') {
        setConfirmDelete(null);
        setConfirmBusy(false);
        if (selected?.kind === confirmDelete.kind && selected.id === confirmDelete.id) {
          setSelected(null);
        }
        setRefreshKey((k) => k + 1);
        setError(isAdmin ? 'Already deleted. Refreshing history…' : 'Already removed from your history. Refreshing…');
        return;
      }
      setConfirmBusy(false);
      setError(msg);
    }
  };

  const toggleSelectId = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = (pageIds: number[]) => {
    setSelectedIds((prev) => {
      const allSelected = pageIds.length > 0 && pageIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...pageIds]);
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openBulkDeleteConfirm = (kind: 'scan' | 'osint') => {
    if (selectedIds.size === 0) return;
    setConfirmBulkDelete({ kind, ids: Array.from(selectedIds) });
  };

  const onConfirmBulkDelete = async () => {
    if (!confirmBulkDelete || bulkBusy) return;
    setBulkBusy(true);
    try {
      if (confirmBulkDelete.kind === 'scan') {
        const fn = isAdmin ? bulkDeleteHistoryScans : bulkDeleteUserHistoryScans;
        await fn(confirmBulkDelete.ids);
      } else {
        const fn = isAdmin ? bulkDeleteHistoryOsint : bulkDeleteUserHistoryOsint;
        await fn(confirmBulkDelete.ids);
      }
      setConfirmBulkDelete(null);
      setBulkBusy(false);
      clearSelection();
      if (selected && confirmBulkDelete.ids.includes(selected.id) && selected.kind === confirmBulkDelete.kind) {
        setSelected(null);
      }
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      setBulkBusy(false);
      setError(e?.message || 'Bulk delete failed');
    }
  };

  const openPermanentDeleteConfirm = (payload: { kind: 'scan' | 'osint'; id: number; label: string }) => {
    setPermanentConfirmInput('');
    setConfirmPermanentDelete(payload);
  };

  const onConfirmPermanentDelete = async () => {
    if (!confirmPermanentDelete || permanentBusy) return;
    if (permanentConfirmInput.trim() !== confirmPermanentDelete.label) return;
    setPermanentBusy(true);
    try {
      const fn = confirmPermanentDelete.kind === 'scan' ? permanentlyDeleteHistoryScan : permanentlyDeleteHistoryOsint;
      await fn(confirmPermanentDelete.id);
      setConfirmPermanentDelete(null);
      setPermanentBusy(false);
      setPermanentConfirmInput('');
      if (selected?.kind === confirmPermanentDelete.kind && selected.id === confirmPermanentDelete.id) {
        setSelected(null);
      }
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      setPermanentBusy(false);
      setError(e?.message || 'Permanent delete failed');
    }
  };

  const openBulkPermanentDeleteConfirm = (kind: 'scan' | 'osint') => {
    if (selectedIds.size === 0) return;
    setBulkPermanentConfirmInput('');
    setConfirmBulkPermanentDelete({ kind, ids: Array.from(selectedIds) });
  };

  const onConfirmBulkPermanentDelete = async () => {
    if (!confirmBulkPermanentDelete || bulkPermanentBusy) return;
    if (bulkPermanentConfirmInput.trim() !== String(confirmBulkPermanentDelete.ids.length)) return;
    setBulkPermanentBusy(true);
    try {
      const fn =
        confirmBulkPermanentDelete.kind === 'scan' ? bulkPermanentlyDeleteHistoryScans : bulkPermanentlyDeleteHistoryOsint;
      const result = await fn(confirmBulkPermanentDelete.ids);
      const skipped = Array.isArray(result?.data?.notSoftDeletedIds) ? result.data.notSoftDeletedIds.length : 0;
      const missing = Array.isArray(result?.data?.notFoundIds) ? result.data.notFoundIds.length : 0;

      setConfirmBulkPermanentDelete(null);
      setBulkPermanentBusy(false);
      setBulkPermanentConfirmInput('');
      clearSelection();
      if (selected && confirmBulkPermanentDelete.ids.includes(selected.id) && selected.kind === confirmBulkPermanentDelete.kind) {
        setSelected(null);
      }
      setRefreshKey((k) => k + 1);

      if (skipped > 0 || missing > 0) {
        setError(
          `${skipped} record${skipped === 1 ? '' : 's'} were not yet deleted and were skipped` +
            (missing > 0 ? `; ${missing} no longer existed.` : '.') +
            ' Delete them first, then permanently delete.'
        );
      }
    } catch (e: any) {
      setBulkPermanentBusy(false);
      setError(e?.message || 'Bulk permanent delete failed');
    }
  };

  const items = data?.items ?? [];
  const osintItems = useMemo(() => {
    const raw = osintData?.items ?? [];
    let out = raw;
    if (riskFilter) {
      out = out.filter((r) => (r.risk_level || '').toLowerCase() === riskFilter);
    }
    return out;
  }, [osintData?.items, riskFilter]);
  const printableScanSource = useMemo(() => {
    if (selected?.kind !== 'scan' || !detail) return null;
    return buildHistoryPrintSource(detail);
  }, [detail, selected]);
  const printableScanSections = useMemo(() => buildScanSections(printableScanSource), [printableScanSource]);
  const printableHostingCountries = useMemo(
    () => buildHostingCountriesData(Array.isArray(printableScanSource?.systems) ? printableScanSource.systems : []),
    [printableScanSource]
  );
  const printableOsintState = useMemo(() => buildOsintStateFromStoredResults(detail?.osintResults || []), [detail?.osintResults]);
  const printableOsintEntries = useMemo(() => buildOsintEntries(WEB_CHECK_OSINT_MODULES, printableOsintState), [printableOsintState]);
  const printableOsintValidation = useMemo(() => validateOsintEntries(printableOsintEntries), [printableOsintEntries]);
  const showingFrom = (tab === 'scans' ? items.length : osintItems.length) ? (page - 1) * pageSize + 1 : 0;
  const showingTo = (page - 1) * pageSize + (tab === 'scans' ? items.length : osintItems.length);

  const downloadOsintExport = async (format: 'json' | 'csv') => {
    try {
      const token = localStorage.getItem('token') || '';
      const qs = new URLSearchParams();
      qs.set('format', format);
      if (q) qs.set('q', q);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (moduleFilter) qs.set('module', moduleFilter);
      if (riskFilter) qs.set('risk', riskFilter);
      qs.set('limit', '1000');

      const res = await fetch(`/api/history/osint/export?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.status === 401 || res.status === 403) {
        notifyAuthStatus(res.status);
      }
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      downloadBlob(blob, `osint-history.${format}`);
    } catch (e: any) {
      setError(e?.message || 'Export failed');
    }
  };

  const osintGroups = useMemo(() => {
    const groups = new Map<string, OsintListItem[]>();
    for (const row of osintItems) {
      const dt = row.created_at ? new Date(row.created_at) : null;
      const key = dt ? dt.toISOString().slice(0, 10) : 'unknown';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return Array.from(groups.entries()).map(([day, rows]) => ({ day, rows }));
  }, [osintItems]);

  const formatRiskLabel = (risk: any) => {
    const raw = typeof risk === 'string' ? risk.trim() : '';
    if (!raw) return '—';
    const lower = raw.toLowerCase();
    if (lower === 'critical') return 'CRITICAL';
    if (lower === 'high') return 'HIGH';
    if (lower === 'medium') return 'MEDIUM';
    if (lower === 'low') return 'LOW';
    return raw.toUpperCase();
  };

  const riskTone = (risk: any) => {
    const lower = typeof risk === 'string' ? risk.toLowerCase() : '';
    if (lower === 'critical') return 'critical';
    if (lower === 'high') return 'high';
    if (lower === 'medium') return 'medium';
    if (lower === 'low') return 'low';
    return 'unknown';
  };

  const formatDeletedMeta = (deletedAt?: string | null, deletedByUserId?: number | null) => {
    if (!deletedAt && deletedByUserId == null) return 'Deleted';
    const parts = ['Deleted'];
    if (deletedByUserId != null) parts.push(`by User #${deletedByUserId}`);
    if (deletedAt) parts.push(`on ${new Date(deletedAt).toLocaleString()}`);
    return parts.join(' ');
  };

  const renderScanSnapshot = (snapshot: any) => {
    const obj = (() => {
      if (!snapshot) return null;
      if (typeof snapshot === 'string') {
        try {
          return JSON.parse(snapshot);
        } catch {
          return null;
        }
      }
      return snapshot;
    })();

    if (!obj || typeof obj !== 'object') {
      return <div className="history-small">No scan snapshot stored for this record.</div>;
    }

    const pick = (v: any) => (v == null || v === '' ? '—' : String(v));
    const yesNo = (v: any) => (v ? 'Yes' : 'No');
    const truncate = (v: any, n = 72) => {
      const s = v == null ? '' : String(v);
      if (!s) return '—';
      return s.length > n ? `${s.slice(0, n)}…` : s;
    };

    const ssl = (obj as any).ssl;
    const dns = (obj as any).dns;
    const whois = (obj as any).whois;
    const securityTxt = (obj as any).securityTxt;
    const crawlRules = (obj as any).crawlRules;
    const socialTags = (obj as any).socialTags;
    const firewall = (obj as any).firewall;

    const scanDate = (obj as any).scanDate || (obj as any).scan_date || null;
    const scanDateText = scanDate ? new Date(String(scanDate)).toLocaleString() : '—';

    const dnsSecurity = dns?.security;
    const spf = dnsSecurity?.spf;
    const dmarc = dnsSecurity?.dmarc;
    const dkim = Array.isArray(dnsSecurity?.dkim) ? dnsSecurity.dkim : [];
    const dmarcPolicy = typeof dmarc === 'string'
      ? dmarc.match(/\bp\s*=\s*(reject|quarantine|none)\b/i)?.[1]?.toLowerCase()
      : undefined;
    const dkimSelectors: string[] = dkim
      .map((entry: any) => (typeof entry?.selector === 'string' ? entry.selector : null))
      .filter((selector: string | null): selector is string => Boolean(selector));

    return (
      <div className="history-snapshot-grid">
        <div className="history-snapshot-section">
          <div className="history-section-title">Snapshot</div>
          <div className="history-kv history-kv--flat">
            <div className="k">Version</div>
            <div className="v">{pick((obj as any).version)}</div>
            <div className="k">Scan Date</div>
            <div className="v">{scanDateText}</div>
            <div className="k">SSL</div>
            <div className="v">{ssl ? 'Present' : '—'}</div>
            <div className="k">DNS</div>
            <div className="v">{dns ? 'Present' : '—'}</div>
            <div className="k">WHOIS</div>
            <div className="v">{whois ? 'Present' : '—'}</div>
            <div className="k">security.txt</div>
            <div className="v">{securityTxt?.present ? 'Present' : '—'}</div>
            <div className="k">Social Tags</div>
            <div className="v">{socialTags ? 'Present' : '—'}</div>
          </div>
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">SSL</div>
          {!ssl ? (
            <div className="history-small">No SSL data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">Subject</div>
              <div className="v">{pick(ssl?.subject?.CN || ssl?.subject?.O)}</div>
              <div className="k">Issuer</div>
              <div className="v">{pick(ssl?.issuer?.O || ssl?.issuer?.CN)}</div>
              <div className="k">Valid From</div>
              <div className="v">{pick(ssl?.validFrom || ssl?.valid_from)}</div>
              <div className="k">Valid To</div>
              <div className="v">{pick(ssl?.validTo || ssl?.valid_to)}</div>
              <div className="k">SANs</div>
              <div className="v">{Array.isArray(ssl?.subjectaltname) ? String(ssl.subjectaltname.length) : '—'}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">DNS</div>
          {!dns ? (
            <div className="history-small">No DNS data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">IPv4 (A)</div>
              <div className="v">{pick(dns?.total_a_recs)}</div>
              <div className="k">IPv6 (AAAA)</div>
              <div className="v">{Array.isArray(dns?.aaaa) ? String(dns.aaaa.length) : '—'}</div>
              <div className="k">CNAME</div>
              <div className="v">{Array.isArray(dns?.cname) ? String(dns.cname.length) : '—'}</div>
              <div className="k">MX</div>
              <div className="v">{Array.isArray(dns?.mx) ? String(dns.mx.length) : '—'}</div>
              <div className="k">NS</div>
              <div className="v">{Array.isArray(dns?.ns) ? String(dns.ns.length) : '—'}</div>
              <div className="k">TXT</div>
              <div className="v">{Array.isArray(dns?.txt) ? String(dns.txt.length) : '—'}</div>
              <div className="k">SPF</div>
              <div className="v">{spf ? 'Present' : '—'}</div>
              <div className="k">DMARC</div>
              <div className="v">{dmarc ? 'Present' : '—'}</div>
              <div className="k">DKIM</div>
              <div className="v">{dkim.length ? String(dkim.length) : '—'}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">Firewall / WAF</div>
          {!firewall ? (
            <div className="history-small">No firewall data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">Detected</div>
              <div className="v">{yesNo(firewall?.firewall || firewall?.firewall_detected)}</div>
              <div className="k">WAF</div>
              <div className="v">{pick(firewall?.waf || firewall?.waf_name)}</div>
              <div className="k">Confidence</div>
              <div className="v">{pick(firewall?.confidence)}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">Metadata</div>
          {!socialTags ? (
            <div className="history-small">No social tag data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">OG Title</div>
              <div className="v">{truncate(socialTags?.ogTitle)}</div>
              <div className="k">OG Description</div>
              <div className="v">{truncate(socialTags?.ogDescription)}</div>
              <div className="k">Twitter Card</div>
              <div className="v">{pick(socialTags?.twitterCard)}</div>
              <div className="k">Twitter Site</div>
              <div className="v">{pick(socialTags?.twitterSite)}</div>
              <div className="k">Image</div>
              <div className="v">{socialTags?.image ? 'Present' : '—'}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">security.txt</div>
          {!securityTxt ? (
            <div className="history-small">No security.txt data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">Present</div>
              <div className="v">{securityTxt?.present ? 'Yes' : 'No'}</div>
              <div className="k">Contact</div>
              <div className="v">{pick(securityTxt?.contact)}</div>
              <div className="k">Encryption</div>
              <div className="v">{pick(securityTxt?.encryption)}</div>
              <div className="k">Policy</div>
              <div className="v">{pick(securityTxt?.policy)}</div>
              <div className="k">Expires</div>
              <div className="v">{pick(securityTxt?.expires)}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">WHOIS</div>
          {!whois ? (
            <div className="history-small">No WHOIS data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">Registrar</div>
              <div className="v">{pick(whois?.registrar)}</div>
              <div className="k">Registered</div>
              <div className="v">{pick(whois?.registeredDate)}</div>
              <div className="k">Updated</div>
              <div className="v">{pick(whois?.updatedDate)}</div>
              <div className="k">Expiry</div>
              <div className="v">{pick(whois?.expiryDate)}</div>
              <div className="k">Status</div>
              <div className="v">{pick(whois?.status)}</div>
              <div className="k">Name Servers</div>
              <div className="v">{Array.isArray(whois?.nameServers) ? String(whois.nameServers.length) : '—'}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">Email Security</div>
          {!dnsSecurity ? (
            <div className="history-small">No email security data stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">SPF</div>
              <div className="v">{spf ? `Present — ${truncate(spf, 48)}` : 'Missing'}</div>
              <div className="k">DMARC</div>
              <div className="v">
                {dmarc
                  ? `Present${dmarcPolicy ? ` — p=${dmarcPolicy}` : ''}`
                  : 'Missing'}
              </div>
              <div className="k">DKIM</div>
              <div className="v">
                {dkimSelectors.length > 0
                  ? `${dkimSelectors.length} Selector${dkimSelectors.length > 1 ? 's' : ''} Found`
                  : 'None Found'}
              </div>
              <div className="k">DKIM Selectors</div>
              <div className="v">{dkimSelectors.length > 0 ? dkimSelectors.join(', ') : '—'}</div>
            </div>
          )}
        </div>

        <div className="history-snapshot-section">
          <div className="history-section-title">Crawl Rules</div>
          {!crawlRules ? (
            <div className="history-small">No crawl rules stored.</div>
          ) : (
            <div className="history-kv history-kv--flat">
              <div className="k">robots.txt</div>
              <div className="v">{crawlRules?.robotsTxt ? 'Present' : '—'}</div>
              <div className="k">Allowed</div>
              <div className="v">{Array.isArray(crawlRules?.allowed) ? String(crawlRules.allowed.length) : '—'}</div>
              <div className="k">Disallowed</div>
              <div className="v">{Array.isArray(crawlRules?.disallowed) ? String(crawlRules.disallowed.length) : '—'}</div>
              <div className="k">Sitemaps</div>
              <div className="v">{Array.isArray(crawlRules?.sitemaps) ? String(crawlRules.sitemaps.length) : '—'}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="history-page">
      <header className="history-header">
        <div className="history-header-main">
          <button className="history-back" onClick={onBack} type="button">
            ← Back
          </button>
          <div className="history-header-text">
            <h1>{isAdmin ? 'Full History' : 'My History'}</h1>
            <p>{isAdmin
              ? 'Browse all Web Check scans and OSINT investigations.'
              : 'Browse your Web Check scans and OSINT investigations.'}</p>
          </div>
        </div>

        <div className="history-header-actions">
          <div className="history-tabs" role="tablist" aria-label="History tabs">
            <button
              type="button"
              className={`history-tab ${tab === 'scans' ? 'active' : ''}`}
              onClick={() => {
                setSelected(null);
                setDetail(null);
                setDetailError(null);
                setPage(1);
                setTab('scans');
              }}
              role="tab"
              aria-selected={tab === 'scans'}
            >
              Web Check
            </button>
            <button
              type="button"
              className={`history-tab ${tab === 'osint' ? 'active' : ''}`}
              onClick={() => {
                setSelected(null);
                setDetail(null);
                setDetailError(null);
                setPage(1);
                setTab('osint');
              }}
              role="tab"
              aria-selected={tab === 'osint'}
            >
              OSINT
            </button>
          </div>
        </div>
      </header>

      <div className={`history-main ${selected ? 'has-selected' : ''}`}>
        <div className="history-left-panel">
          <section className="history-controls" aria-label="History controls">
        {/* ROW 1: Search, Module, From, To, Export */}
        <div className="history-row">
          <input
            className="history-input"
            placeholder={tab === 'scans' ? 'Search target (domain/IP)…' : 'Search target / module / user…'}
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
          {tab === 'osint' && (
            <>
              <input
                className="history-input history-input--sm"
                placeholder="Module…"
                value={moduleFilter}
                onChange={(e) => {
                  setPage(1);
                  setModuleFilter(e.target.value);
                }}
                aria-label="Module filter"
              />
              <label className="history-date">
                <span>From</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setPage(1);
                    setFrom(e.target.value);
                  }}
                />
              </label>
              <label className="history-date">
                <span>To</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setPage(1);
                    setTo(e.target.value);
                  }}
                />
              </label>
              {isAdmin && (
                <>
                  <button className="history-export" type="button" onClick={() => downloadOsintExport('json')}>
                    Export JSON
                  </button>
                  <button className="history-export" type="button" onClick={() => downloadOsintExport('csv')}>
                    Export CSV
                  </button>
                </>
              )}
            </>
          )}
          {tab === 'scans' && (
            <>
              <label className="history-date">
                <span>From</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setPage(1);
                    setFrom(e.target.value);
                  }}
                />
              </label>
              <label className="history-date">
                <span>To</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setPage(1);
                    setTo(e.target.value);
                  }}
                />
              </label>
              <select
                className="history-select"
                value={sort}
                onChange={(e) => {
                  setPage(1);
                  setSort(e.target.value as any);
                }}
                aria-label="Sort by"
              >
                <option value="scan_date">Sort: Date</option>
                <option value="target">Sort: Target</option>
                <option value="threat_level">Sort: Threat</option>
              </select>
              <button
                className="history-order"
                type="button"
                onClick={() => {
                  setPage(1);
                  setOrder((o) => (o === 'desc' ? 'asc' : 'desc'));
                }}
                aria-label="Toggle sort order"
              >
                {order === 'desc' ? '↓' : '↑'}
              </button>
            </>
          )}
        </div>



        {/* ROW 3: Severity [left], Timeline/Table/Per-page/Pagination [right] */}
        <div className="history-row history-row--osint-filters">
          {tab === 'osint' && (
            <div className="history-chip-group" role="group" aria-label="Risk filter">
              {[
                { key: '', label: 'All' },
                { key: 'low', label: 'Low' },
                { key: 'medium', label: 'Medium' },
                { key: 'high', label: 'High' },
                { key: 'critical', label: 'Critical' }
              ].map((opt) => (
                <button
                  key={opt.key || 'all'}
                  type="button"
                  className={`history-chip ${riskFilter === opt.key ? 'active' : ''}`}
                  onClick={() => {
                    setRiskFilter(opt.key);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {/* Right-aligned control group */}
          <div className="history-right-controls">
            {tab === 'osint' && (
              <div className="history-seg" role="group" aria-label="OSINT view">
                <button
                  type="button"
                  className={`history-seg-btn ${osintView === 'timeline' ? 'active' : ''}`}
                  onClick={() => setOsintView('timeline')}
                >
                  Timeline
                </button>
                <button
                  type="button"
                  className={`history-seg-btn ${osintView === 'table' ? 'active' : ''}`}
                  onClick={() => setOsintView('table')}
                >
                  Table
                </button>
              </div>
            )}
            <select
              className="history-select"
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value));
              }}
              aria-label="Page size"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
            <div className="history-pagination">
              <button
                type="button"
                className="history-page-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <div className="history-page-info">
                Page {page} / {totalPages}
                <span className="history-page-range">
                  {showingFrom}-{showingTo} of {tab === 'scans' ? (data?.total ?? 0) : (osintData?.total ?? 0)}
                </span>
              </div>
              <button
                type="button"
                className="history-page-btn"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        </div>
          </section>

          <div className="history-left-scroll" data-lenis-prevent>
            {error && (
              <div className="history-error" role="alert">
                {error}
              </div>
            )}

            <section className="history-table-wrap" aria-label="History results">
        {!(tab === 'osint' && osintView === 'timeline') && selectedIds.size > 0 && (
          <div className="history-bulk-bar" role="toolbar" aria-label="Bulk actions">
            <span className="history-bulk-count">{selectedIds.size} selected</span>
            <button type="button" className="history-action secondary" onClick={clearSelection}>
              Clear selection
            </button>
            <button
              type="button"
              className="history-action danger"
              onClick={() => openBulkDeleteConfirm(tab === 'scans' ? 'scan' : 'osint')}
            >
              Delete Selected
            </button>
            {isAdmin && (
              <button
                type="button"
                className="history-action danger-strong"
                onClick={() => openBulkPermanentDeleteConfirm(tab === 'scans' ? 'scan' : 'osint')}
              >
                Permanently Delete Selected
              </button>
            )}
          </div>
        )}
        {tab === 'osint' && osintView === 'timeline' ? (
          <div className="history-timeline">
            {loading && (
              <div className="history-loading-inline" role="status" aria-live="polite">
                Updating…
              </div>
            )}
            {osintItems.length === 0 ? (
              loading ? (
                <div className="history-loading">Loading…</div>
              ) : (
                <div className="history-empty">No history found</div>
              )
            ) : (
              osintGroups.map(({ day, rows }) => {
                const label =
                  day === 'unknown'
                    ? 'Unknown date'
                    : new Date(`${day}T00:00:00.000Z`).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      });
                return (
                  <div className="history-timeline-day" key={day}>
                    <div className="history-timeline-day-label">{label}</div>
                    <div className="history-timeline-list" role="list">
                      {rows.map((row) => {
                        const dt = row.created_at ? new Date(row.created_at) : null;
                        const time = dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
                        const risk = formatRiskLabel(row.risk_level);
                        const tone = riskTone(row.risk_level);
                        return (
                          <button
                            key={row.id}
                            type="button"
                            className={`history-timeline-item ${row.is_deleted ? 'is-deleted' : ''}`}
                            onClick={() => setSelected({ kind: 'osint', id: row.id })}
                            role="listitem"
                            aria-label={`OSINT ${row.module} ${row.target}`}
                          >
                            <div className="history-timeline-dot" aria-hidden="true" />
                            <div className="history-timeline-card">
                              <div className="history-timeline-top">
                                <div className="history-timeline-title">
                                  <span className="history-timeline-module">{row.module}</span>
                                  <span className="history-timeline-type">{row.investigation_type}</span>
                                </div>
                                <div className="history-timeline-time">{time}</div>
                              </div>
                              <div className="history-timeline-target" title={row.target}>
                                {row.target}
                              </div>
                              <div className="history-timeline-meta">
                                <span className={`history-pill ${tone}`}>{risk}</span>
                                <span className="history-pill subtle">v{row.result_version}</span>
                                <span className="history-pill subtle">{row.username || '—'}</span>
                                {row.encrypted && <span className="history-pill subtle">Encrypted</span>}
                                {row.payload_available && <span className="history-pill subtle">Payload</span>}
                                {row.is_deleted && (
                                  <span className="history-pill deleted" title={formatDeletedMeta(row.deleted_at, row.deleted_by_user_id)}>
                                    Deleted
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className={`history-table ${tab === 'osint' ? 'osint' : ''}`}>
            {tab === 'scans' ? (
              <div className="history-thead">
                <div className="history-cell-check">
                  <input
                    type="checkbox"
                    aria-label="Select all scans on this page"
                    checked={items.length > 0 && items.every((row) => selectedIds.has(row.id))}
                    onChange={() => toggleSelectAllOnPage(items.map((row) => row.id))}
                  />
                </div>
                <div>Date</div>
                <div>Target</div>
                <div>Threat</div>
                <div>Result</div>
                <div>WAF</div>
                <div>Systems</div>
                <div>OSINT</div>
                <div className="history-cell-actions">Actions</div>
              </div>
            ) : (
              <div className="history-thead">
                <div className="history-cell-check">
                  <input
                    type="checkbox"
                    aria-label="Select all OSINT records on this page"
                    checked={osintItems.length > 0 && osintItems.every((row) => selectedIds.has(row.id))}
                    onChange={() => toggleSelectAllOnPage(osintItems.map((row) => row.id))}
                  />
                </div>
                <div>Date</div>
                <div>Type</div>
                <div>Module</div>
                <div>Target</div>
                <div>User</div>
                <div>Version</div>
                <div className="history-cell-actions">Actions</div>
              </div>
            )}

            {loading && (tab === 'scans' ? items.length > 0 : osintItems.length > 0) && (
              <div className="history-loading-inline" role="status" aria-live="polite">
                Updating…
              </div>
            )}

            {tab === 'scans' ? (
              items.length === 0 ? (
                loading ? (
                  <div className="history-loading">Loading…</div>
                ) : (
                  <div className="history-empty">No history found</div>
                )
              ) : (
                items.map((row) => (
                  <div key={row.id} className={`history-tr ${row.is_deleted ? 'is-deleted' : ''}`}>
                    <div className="history-cell history-cell-check">
                      <input
                        type="checkbox"
                        aria-label={`Select scan ${row.target}`}
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleSelectId(row.id)}
                      />
                    </div>
                    <div className="history-cell">{row.scan_date ? new Date(row.scan_date).toLocaleString() : '—'}</div>
                    <div className="history-cell history-target" title={row.target}>
                      {row.target}
                      {row.is_deleted && (
                        <span className="history-inline-status" title={formatDeletedMeta(row.deleted_at, row.deleted_by_user_id)}>
                          Deleted
                        </span>
                      )}
                    </div>
                    <div className="history-cell">{row.threat_level == null ? '—' : `${row.threat_level}/10`}</div>
                    <div className="history-cell">{row.has_snapshot ? 'Saved' : '—'}</div>
                    <div className="history-cell">{row.waf_name || (row.firewall_detected ? 'Detected' : '—')}</div>
                    <div className="history-cell">{row.systems_count}</div>
                    <div className="history-cell">{row.osint_count}</div>
                    <div className="history-cell history-actions history-cell-actions">
                      <button type="button" className="history-action" onClick={() => setSelected({ kind: 'scan', id: row.id })}>
                        Details
                      </button>
                      <button
                        type="button"
                        className="history-action secondary"
                        onClick={() => onRunQuery?.(row.target)}
                        disabled={!onRunQuery}
                      >
                        Re-run
                      </button>
                      {!(isAdmin && row.is_deleted) && (
                        <button
                          type="button"
                          className="history-action danger"
                          onClick={() => {
                            openDeleteConfirm({ kind: 'scan', id: row.id, label: row.target });
                          }}
                        >
                          Delete
                        </button>
                      )}
                      {isAdmin && row.is_deleted && (
                        <button
                          type="button"
                          className="history-action danger-strong"
                          onClick={() => openPermanentDeleteConfirm({ kind: 'scan', id: row.id, label: row.target })}
                        >
                          Permanently Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )
            ) : osintItems.length === 0 ? (
              loading ? (
                <div className="history-loading">Loading…</div>
              ) : (
                <div className="history-empty">No history found</div>
              )
            ) : (
              osintItems.map((row) => (
                <div key={row.id} className={`history-tr ${row.is_deleted ? 'is-deleted' : ''}`}>
                  <div className="history-cell history-cell-check">
                    <input
                      type="checkbox"
                      aria-label={`Select OSINT record ${row.module} ${row.target}`}
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelectId(row.id)}
                    />
                  </div>
                  <div className="history-cell">{row.created_at ? new Date(row.created_at).toLocaleString() : '—'}</div>
                  <div className="history-cell">{row.investigation_type}</div>
                  <div className="history-cell">{row.module}</div>
                  <div className="history-cell history-target" title={row.target}>
                    {row.target}
                    {row.is_deleted && (
                      <span className="history-inline-status" title={formatDeletedMeta(row.deleted_at, row.deleted_by_user_id)}>
                        Deleted
                      </span>
                    )}
                  </div>
                  <div className="history-cell">{row.username || '—'}</div>
                  <div className="history-cell">v{row.result_version}</div>
                  <div className="history-cell history-actions history-cell-actions">
                    <button type="button" className="history-action" onClick={() => setSelected({ kind: 'osint', id: row.id })}>
                      Details
                    </button>
                    {!(isAdmin && row.is_deleted) && (
                      <button
                        type="button"
                        className="history-action danger"
                        onClick={() => {
                          openDeleteConfirm({
                            kind: 'osint',
                            id: row.id,
                            label: `${row.module} • ${row.target}`
                          });
                        }}
                      >
                        Delete
                      </button>
                    )}
                    {isAdmin && row.is_deleted && (
                      <button
                        type="button"
                        className="history-action danger-strong"
                        onClick={() =>
                          openPermanentDeleteConfirm({
                            kind: 'osint',
                            id: row.id,
                            label: `${row.module} • ${row.target}`
                          })
                        }
                      >
                        Permanently Delete
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
            </section>
          </div>
        </div>

        {selected && (
          <div className="history-right-panel">
            <div className="history-drawer-header">
              <div className="history-drawer-title">
                {selected.kind === 'scan' ? `Scan #${selected.id}` : `OSINT #${selected.id}`}
                {isAdmin && ((selected.kind === 'scan' && detail?.scan?.is_deleted) || (selected.kind === 'osint' && detail?.is_deleted)) && (
                  <span className="history-inline-status" title={selected.kind === 'scan'
                    ? formatDeletedMeta(detail?.scan?.deleted_at, detail?.scan?.deleted_by_user_id)
                    : formatDeletedMeta(detail?.deleted_at, detail?.deleted_by_user_id)}>
                    Deleted
                  </span>
                )}
              </div>
              <div className="history-drawer-actions">
                {(() => {
                  if (!selected) return null;
                  const label =
                    selected.kind === 'scan'
                      ? (detail?.scan?.target ? String(detail.scan.target) : undefined)
                      : detail?.module && detail?.target
                        ? `${String(detail.module)} • ${String(detail.target)}`
                        : undefined;
                  const isDeletedNow = selected.kind === 'scan' ? Boolean(detail?.scan?.is_deleted) : Boolean(detail?.is_deleted);

                  if (isAdmin && isDeletedNow) {
                    return (
                      <button
                        type="button"
                        className="history-action danger-strong"
                        onClick={() => openPermanentDeleteConfirm({ kind: selected.kind, id: selected.id, label: label || `#${selected.id}` })}
                      >
                        Permanently Delete
                      </button>
                    );
                  }

                  return (
                    <button
                      type="button"
                      className="history-action danger"
                      onClick={() => openDeleteConfirm({ kind: selected.kind, id: selected.id, label })}
                    >
                      Delete
                    </button>
                  );
                })()}
              <button
                type="button"
                className="history-drawer-close"
                onClick={() => setSelected(null)}
                aria-label="Close"
              >
                ×
              </button>
              </div>
            </div>

            <div ref={rightScrollRef} className="history-right-scroll" data-lenis-prevent>
              {detailLoading ? (
                <div ref={drawerBodyRef} className="history-drawer-body">Loading details…</div>
              ) : detailError ? (
                <div ref={drawerBodyRef} className="history-drawer-body history-error" role="alert">
                  {detailError}
                </div>
              ) : !detail ? (
                <div ref={drawerBodyRef} className="history-drawer-body">No details available.</div>
              ) : (
                <div ref={drawerBodyRef} className="history-drawer-body">
                {selected.kind === 'scan' ? (
                  <>
                    <PrintableScanReport
                      analysis={detail.aiAnalysis}
                      sections={printableScanSections}
                      osintEntries={printableOsintEntries}
                      osintValidation={printableOsintValidation}
                      hostingCountries={printableHostingCountries}
                      meta={{
                        target: detail.scan?.target,
                        scanId: detail.scan?.id,
                        scanDate: detail.scan?.scan_date
                      }}
                    />
                    <div className="mb-8">
                      <SecurityReport 
                        analysis={detail.aiAnalysis} 
                        loading={false} 
                        meta={{ target: detail.scan?.target, scanId: detail.scan?.id }} 
                      />
                    </div>
                    <div className="history-kv">
                      <div className="k">Target</div>
                      <div className="v">{detail.scan?.target}</div>
                      <div className="k">Timestamp</div>
                      <div className="v">
                        {detail.scan?.scan_date ? new Date(detail.scan.scan_date).toLocaleString() : '—'}
                      </div>
                      <div className="k">Threat</div>
                      <div className="v">
                        {detail.aiAnalysis?.threat_level != null ? `${detail.aiAnalysis.threat_level}/10` : '—'}
                      </div>
                      <div className="k">WAF</div>
                      <div className="v">{detail.firewall?.waf_name || '—'}</div>
                      {isAdmin && detail.scan?.is_deleted && (
                        <>
                          <div className="k">Status</div>
                          <div className="v">{formatDeletedMeta(detail.scan?.deleted_at, detail.scan?.deleted_by_user_id)}</div>
                        </>
                      )}
                    </div>

                    <div className="history-section">
                      <div className="history-section-title">Scan Result</div>
                      <div className="history-unified-grid">
                        <div className="history-unified-block">
                          <div className="history-subtitle">Systems</div>
                          {Array.isArray(detail.systems) && detail.systems.length ? (
                            <>
                              <div className="history-list">
                                {(showAllSystems ? detail.systems : detail.systems.slice(0, 3)).map((s: any) => {
                                  const title = s?.subdomain || s?.ip || (s?.id != null ? `System #${s.id}` : 'System');
                                  const country = s?.location?.country || s?.location?.countryCode;
                                  const city = s?.location?.city;
                                  const place = [city, country].filter(Boolean).join(', ');
                                  const riskLevel = s?.risk?.level || '—';
                                  const riskScore = s?.risk?.score != null ? String(s.risk.score) : '—';
                                  const ports = Array.isArray(s?.ports) ? s.ports.map((p: any) => p?.port).filter(Boolean) : [];
                                  const portsText = ports.length ? `Ports: ${ports.slice(0, 6).join(', ')}${ports.length > 6 ? '…' : ''}` : 'Ports: —';
                                  return (
                                    <div className="history-list-item" key={String(s?.id ?? title)}>
                                      <div className="history-list-main">{title}</div>
                                      <div className="history-list-meta">
                                        {riskLevel} · {riskScore}
                                      </div>
                                      {(place || portsText) && (
                                        <div className="history-list-sub">
                                          {place ? `${place} · ` : ''}
                                          {portsText}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              {detail.systems.length > 3 && (
                                <button
                                  className="history-link"
                                  type="button"
                                  onClick={() => setShowAllSystems((v) => !v)}
                                >
                                  {showAllSystems ? 'Show less' : `Show all (${detail.systems.length})`}
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="history-small">No systems stored for this scan.</div>
                          )}
                        </div>

                        <div className="history-unified-block">
                          <div className="history-subtitle">OSINT</div>
                          {Array.isArray(detail.osintResults) && detail.osintResults.length ? (
                            <>
                              <div className="history-list">
                                {(showAllOsint ? detail.osintResults : detail.osintResults.slice(0, 4)).map((r: any, i: number) => {
                                  const mod = r?.module || 'Module';
                                  const risk = r?.risk_level || '—';
                                  const when = r?.created_at ? new Date(String(r.created_at)).toLocaleString() : '—';
                                  return (
                                    <div className="history-list-item" key={`${mod}-${i}`}>
                                      <div className="history-list-main">{mod}</div>
                                      <div className="history-list-meta">{risk}</div>
                                      <div className="history-list-sub">{when}</div>
                                    </div>
                                  );
                                })}
                              </div>
                              {detail.osintResults.length > 4 && (
                                <button className="history-link" type="button" onClick={() => setShowAllOsint((v) => !v)}>
                                  {showAllOsint ? 'Show less' : `Show all (${detail.osintResults.length})`}
                                </button>
                              )}
                            </>
                          ) : (
                            <div className="history-small">No OSINT results linked to this scan.</div>
                          )}
                        </div>
                      </div>

                      <div className="history-divider" />
                      {renderScanSnapshot(detail.scan?.page_content)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="history-kv">
                      <div className="k">Target</div>
                      <div className="v">{detail.target}</div>
                      <div className="k">Timestamp</div>
                      <div className="v">{detail.created_at ? new Date(detail.created_at).toLocaleString() : '—'}</div>
                      <div className="k">Module</div>
                      <div className="v">{detail.module}</div>
                      <div className="k">Type</div>
                      <div className="v">{detail.investigation_type}</div>
                      <div className="k">User</div>
                      <div className="v">{detail.username || '—'}</div>
                      <div className="k">Risk</div>
                      <div className="v">
                        <span className={`history-pill ${riskTone(detail.risk_level)}`}>{formatRiskLabel(detail.risk_level)}</span>
                      </div>
                      <div className="k">Version</div>
                      <div className="v">v{detail.result_version}</div>
                      <div className="k">Integrity</div>
                      <div className="v">
                        {detail.payload_available
                          ? detail.integrityOk === true
                            ? 'OK'
                            : detail.integrityOk === false
                              ? 'Mismatch'
                              : '—'
                          : 'Not stored'}
                      </div>
                      {isAdmin && detail.is_deleted && (
                        <>
                          <div className="k">Status</div>
                          <div className="v">{formatDeletedMeta(detail.deleted_at, detail.deleted_by_user_id)}</div>
                        </>
                      )}
                    </div>

                    {Array.isArray(detail.sources) && detail.sources.length > 0 && (
                      <div className="history-section">
                        <div className="history-section-title">Sources</div>
                        <div className="history-tags" role="list" aria-label="Sources">
                          {detail.sources.map((s: any, i: number) => (
                            <span className="history-tag" key={`${String(s)}-${i}`} role="listitem">
                              {String(s)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {detail.error_message && (
                      <div className="history-section">
                        <div className="history-section-title">Error</div>
                        <div className="history-summary">{detail.error_message}</div>
                      </div>
                    )}

                    <div className="history-section">
                      <div className="history-section-title history-section-title-row">
                        <span>Payload</span>
                        {detail.payload_available && (
                          <div className="history-seg" role="group" aria-label="Payload view">
                            <button
                              type="button"
                              className={`history-seg-btn ${osintPayloadView === 'tree' ? 'active' : ''}`}
                              onClick={() => setOsintPayloadView('tree')}
                            >
                              Pretty
                            </button>
                            <button
                              type="button"
                              className={`history-seg-btn ${osintPayloadView === 'code' ? 'active' : ''}`}
                              onClick={() => setOsintPayloadView('code')}
                            >
                              Raw JSON
                            </button>
                          </div>
                        )}
                      </div>
                      {!detail.payload_available ? (
                        <div className="history-small">Payload not stored (encryption key missing or operation failed).</div>
                      ) : (
                        <div className="history-json-viewer">
                          <JsonViewer value={detail.payload} mode={osintPayloadView === 'code' ? 'code' : 'tree'} />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            </div>
          </div>
        )}
      </div>

      {confirmDelete &&
        createPortal(
          <div
            className="history-confirm-overlay"
            role="dialog"
            aria-label="Confirm delete"
            aria-modal="true"
            onMouseDown={(e) => {
              if (confirmBusy) return;
              if (e.target === e.currentTarget) setConfirmDelete(null);
            }}
          >
            <div className="history-confirm">
              <div className="history-confirm-title">Confirm deletion</div>
              <div className="history-confirm-body">
                <div className="history-confirm-text">
                  {isAdmin
                    ? `Mark this ${confirmDelete.kind === 'scan' ? 'scan' : 'OSINT record'} as deleted?`
                    : `Remove this ${confirmDelete.kind === 'scan' ? 'scan' : 'OSINT record'} from your history?`}
                </div>
                {confirmDelete.label && <div className="history-confirm-meta">{confirmDelete.label}</div>}
                {isAdmin && (
                  <div className="history-confirm-warn">
                    The record stays in the database and remains visible to administrators.
                  </div>
                )}
              </div>
              <div className="history-confirm-actions">
                <button
                  type="button"
                  className="history-action secondary"
                  onClick={() => {
                    if (confirmBusy) return;
                    setConfirmDelete(null);
                  }}
                  disabled={confirmBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="history-action danger"
                  onClick={onConfirmDelete}
                  disabled={confirmBusy}
                  autoFocus
                >
                  {confirmBusy ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {confirmBulkDelete &&
        createPortal(
          <div
            className="history-confirm-overlay"
            role="dialog"
            aria-label="Confirm bulk delete"
            aria-modal="true"
            onMouseDown={(e) => {
              if (bulkBusy) return;
              if (e.target === e.currentTarget) setConfirmBulkDelete(null);
            }}
          >
            <div className="history-confirm">
              <div className="history-confirm-title">Confirm deletion</div>
              <div className="history-confirm-body">
                <div className="history-confirm-text">
                  {isAdmin
                    ? `Mark ${confirmBulkDelete.ids.length} ${confirmBulkDelete.kind === 'scan' ? 'scan' : 'OSINT'} record${confirmBulkDelete.ids.length > 1 ? 's' : ''} as deleted?`
                    : `Remove ${confirmBulkDelete.ids.length} ${confirmBulkDelete.kind === 'scan' ? 'scan' : 'OSINT'} record${confirmBulkDelete.ids.length > 1 ? 's' : ''} from your history?`}
                </div>
                {isAdmin && (
                  <div className="history-confirm-warn">
                    Records stay in the database and remain visible to administrators.
                  </div>
                )}
              </div>
              <div className="history-confirm-actions">
                <button
                  type="button"
                  className="history-action secondary"
                  onClick={() => {
                    if (bulkBusy) return;
                    setConfirmBulkDelete(null);
                  }}
                  disabled={bulkBusy}
                >
                  Cancel
                </button>
                <button type="button" className="history-action danger" onClick={onConfirmBulkDelete} disabled={bulkBusy} autoFocus>
                  {bulkBusy ? 'Deleting…' : `Delete ${confirmBulkDelete.ids.length}`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {confirmPermanentDelete &&
        createPortal(
          <div
            className="history-confirm-overlay"
            role="dialog"
            aria-label="Confirm permanent delete"
            aria-modal="true"
            onMouseDown={(e) => {
              if (permanentBusy) return;
              if (e.target === e.currentTarget) {
                setConfirmPermanentDelete(null);
                setPermanentConfirmInput('');
              }
            }}
          >
            <div className="history-confirm history-confirm--danger">
              <div className="history-confirm-title">Permanently delete this record?</div>
              <div className="history-confirm-body">
                <div className="history-confirm-text">
                  This cannot be undone. The {confirmPermanentDelete.kind === 'scan' ? 'scan' : 'OSINT record'} and all
                  associated data will be removed from the database permanently.
                </div>
                <div className="history-confirm-meta">{confirmPermanentDelete.label}</div>
                <div className="history-confirm-type-label">
                  Type <strong>{confirmPermanentDelete.label}</strong> to confirm:
                </div>
                <input
                  type="text"
                  className="history-confirm-type-input"
                  value={permanentConfirmInput}
                  onChange={(e) => setPermanentConfirmInput(e.target.value)}
                  autoFocus
                  disabled={permanentBusy}
                  aria-label="Type the record label to confirm permanent deletion"
                />
              </div>
              <div className="history-confirm-actions">
                <button
                  type="button"
                  className="history-action secondary"
                  onClick={() => {
                    if (permanentBusy) return;
                    setConfirmPermanentDelete(null);
                    setPermanentConfirmInput('');
                  }}
                  disabled={permanentBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="history-action danger-strong"
                  onClick={onConfirmPermanentDelete}
                  disabled={permanentBusy || permanentConfirmInput.trim() !== confirmPermanentDelete.label}
                >
                  {permanentBusy ? 'Deleting…' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {confirmBulkPermanentDelete &&
        createPortal(
          <div
            className="history-confirm-overlay"
            role="dialog"
            aria-label="Confirm bulk permanent delete"
            aria-modal="true"
            onMouseDown={(e) => {
              if (bulkPermanentBusy) return;
              if (e.target === e.currentTarget) {
                setConfirmBulkPermanentDelete(null);
                setBulkPermanentConfirmInput('');
              }
            }}
          >
            <div className="history-confirm history-confirm--danger">
              <div className="history-confirm-title">
                Permanently delete {confirmBulkPermanentDelete.ids.length} record{confirmBulkPermanentDelete.ids.length > 1 ? 's' : ''}?
              </div>
              <div className="history-confirm-body">
                <div className="history-confirm-text">
                  This cannot be undone. Any selected {confirmBulkPermanentDelete.kind === 'scan' ? 'scans' : 'OSINT records'} and
                  all associated data will be removed from the database permanently.
                </div>
                <div className="history-confirm-warn">
                  Any selected record that isn't already marked Deleted will be skipped — delete it first, then permanently delete.
                </div>
                <div className="history-confirm-type-label">
                  Type <strong>{confirmBulkPermanentDelete.ids.length}</strong> to confirm:
                </div>
                <input
                  type="text"
                  className="history-confirm-type-input"
                  value={bulkPermanentConfirmInput}
                  onChange={(e) => setBulkPermanentConfirmInput(e.target.value)}
                  autoFocus
                  disabled={bulkPermanentBusy}
                  aria-label="Type the number of selected records to confirm bulk permanent deletion"
                />
              </div>
              <div className="history-confirm-actions">
                <button
                  type="button"
                  className="history-action secondary"
                  onClick={() => {
                    if (bulkPermanentBusy) return;
                    setConfirmBulkPermanentDelete(null);
                    setBulkPermanentConfirmInput('');
                  }}
                  disabled={bulkPermanentBusy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="history-action danger-strong"
                  onClick={onConfirmBulkPermanentDelete}
                  disabled={bulkPermanentBusy || bulkPermanentConfirmInput.trim() !== String(confirmBulkPermanentDelete.ids.length)}
                >
                  {bulkPermanentBusy ? 'Deleting…' : 'Permanently Delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
