import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import HistoryPage from '../HistoryPage';

vi.mock('../../../services/api', () => ({
  getHistoryScans: vi.fn(),
  getHistoryScanDetails: vi.fn(),
  getHistoryOsint: vi.fn(),
  getHistoryOsintDetails: vi.fn(),
  deleteHistoryScan: vi.fn(),
  deleteHistoryOsint: vi.fn(),
  getUserHistoryScans: vi.fn(),
  getUserHistoryOsint: vi.fn(),
  getUserHistoryScanDetails: vi.fn(),
  getUserHistoryOsintDetails: vi.fn(),
  deleteUserHistoryScan: vi.fn(),
  deleteUserHistoryOsint: vi.fn()
}));

const {
  getHistoryScans,
  getHistoryScanDetails,
  getHistoryOsint,
  getHistoryOsintDetails,
  deleteHistoryScan,
  deleteHistoryOsint,
  getUserHistoryScans,
  getUserHistoryOsint,
  getUserHistoryScanDetails,
  getUserHistoryOsintDetails,
  deleteUserHistoryScan,
  deleteUserHistoryOsint
} = await import('../../../services/api');

describe('HistoryPage', () => {
  beforeEach(() => {
    (getHistoryScans as any).mockReset();
    (getHistoryScanDetails as any).mockReset();
    (getHistoryOsint as any).mockReset();
    (deleteHistoryScan as any).mockReset();
    (deleteHistoryOsint as any).mockReset();
    (getUserHistoryScans as any).mockReset();
    (getUserHistoryOsint as any).mockReset();
    (getUserHistoryScanDetails as any).mockReset();
    (getUserHistoryOsintDetails as any).mockReset();
    (deleteUserHistoryScan as any).mockReset();
    (deleteUserHistoryOsint as any).mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('loads and renders history rows', async () => {
    (getUserHistoryScans as any).mockResolvedValue({
      status: 'success',
      items: [
        {
          id: 1,
          target: 'example.com',
          scan_date: '2026-01-01T00:00:00.000Z',
          has_snapshot: true,
          threat_level: 5,
          summary: null,
          firewall_detected: true,
          waf_name: 'cloudflare',
          systems_count: 2,
          osint_count: 1,
          is_deleted: false,
          deleted_at: null,
          deleted_by_user_id: null
        }
      ],
      total: 1,
      page: 1,
      pageSize: 25
    });

    render(<HistoryPage onBack={() => {}} onRunQuery={() => {}} />);

    expect(await screen.findByText('example.com')).toBeInTheDocument();
    expect(screen.getByText('cloudflare')).toBeInTheDocument();
  });

  it('opens details drawer', async () => {
    (getUserHistoryScans as any).mockResolvedValue({
      status: 'success',
      items: [
        {
          id: 7,
          target: 'a.com',
          scan_date: '2026-01-01T00:00:00.000Z',
          has_snapshot: false,
          threat_level: 3,
          summary: null,
          firewall_detected: null,
          waf_name: null,
          systems_count: 0,
          osint_count: 0,
          is_deleted: false,
          deleted_at: null,
          deleted_by_user_id: null
        }
      ],
      total: 1,
      page: 1,
      pageSize: 25
    });

    (getUserHistoryScanDetails as any).mockResolvedValue({
      status: 'success',
      data: {
        scan: { id: 7, target: 'a.com', scan_date: '2026-01-01T00:00:00.000Z' },
        aiAnalysis: { threat_level: 3, summary: 's' },
        firewall: null,
        systems: [],
        osintResults: []
      }
    });

    render(<HistoryPage onBack={() => {}} onRunQuery={() => {}} isAdmin={false} />);
    await screen.findByText('a.com');

    fireEvent.click(screen.getByText('Details'));

    await waitFor(() => {
      expect(screen.getByText('Scan #7')).toBeInTheDocument();
    });
    expect(screen.getAllByText('a.com').length).toBeGreaterThan(0);
    expect(getUserHistoryScanDetails).toHaveBeenCalledWith(7);
    expect(getHistoryScanDetails).not.toHaveBeenCalled();
  });

  it('uses admin detail endpoint for admin history details', async () => {
    (getHistoryScans as any).mockResolvedValue({
      status: 'success',
      items: [
        {
          id: 11,
          target: 'admin-view.test',
          scan_date: '2026-01-01T00:00:00.000Z',
          has_snapshot: false,
          threat_level: 2,
          summary: null,
          firewall_detected: null,
          waf_name: null,
          systems_count: 0,
          osint_count: 0,
          is_deleted: false,
          deleted_at: null,
          deleted_by_user_id: null
        }
      ],
      total: 1,
      page: 1,
      pageSize: 25
    });

    (getHistoryScanDetails as any).mockResolvedValue({
      status: 'success',
      data: {
        scan: { id: 11, target: 'admin-view.test', scan_date: '2026-01-01T00:00:00.000Z' },
        aiAnalysis: null,
        firewall: null,
        systems: [],
        osintResults: []
      }
    });

    render(<HistoryPage onBack={() => {}} onRunQuery={() => {}} isAdmin={true} />);
    await screen.findByText('admin-view.test');

    fireEvent.click(screen.getByText('Details'));

    await waitFor(() => {
      expect(screen.getByText('Scan #11')).toBeInTheDocument();
    });
    expect(getHistoryScanDetails).toHaveBeenCalledWith(11);
    expect(getUserHistoryScanDetails).not.toHaveBeenCalled();
  });

  it('deletes scan row after confirmation', async () => {
    (getHistoryScans as any)
      .mockResolvedValueOnce({
        status: 'success',
        items: [
          {
            id: 1,
            target: 'delete-me.com',
            scan_date: '2026-01-01T00:00:00.000Z',
            has_snapshot: false,
            threat_level: 5,
            summary: null,
            firewall_detected: null,
            waf_name: null,
            systems_count: 0,
            osint_count: 0
          }
        ],
        total: 1,
        page: 1,
        pageSize: 25
      })
      .mockResolvedValueOnce({
        status: 'success',
        items: [],
        total: 0,
        page: 1,
        pageSize: 25
      });
    (deleteHistoryScan as any).mockResolvedValue({ status: 'success', data: { deleted: true, id: 1 } });

    render(<HistoryPage onBack={() => {}} onRunQuery={() => {}} isAdmin={true} />);
    await screen.findByText('delete-me.com');

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[0]);

    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButtons[1]);

    await waitFor(() => {
      expect(deleteHistoryScan).toHaveBeenCalledWith(1);
    });
  });

  it('deletes OSINT record in table view after confirmation', async () => {
    (getHistoryScans as any).mockResolvedValue({
      status: 'success',
      items: [],
      total: 0,
      page: 1,
      pageSize: 25
    });
    (getHistoryOsint as any)
      .mockResolvedValueOnce({
        status: 'success',
        items: [
          {
            id: 9,
            created_at: '2026-01-01T00:00:00.000Z',
            investigation_type: 'username',
            module: 'alias-finder',
            target: 'bob',
            risk_level: 'Low',
            username: 'admin',
            scan_id: null,
            result_version: 1,
            encrypted: false,
            payload_available: false
          ,
          is_deleted: false,
          deleted_at: null,
          deleted_by_user_id: null
          }
        ],
        total: 1,
        page: 1,
        pageSize: 25
      })
      .mockResolvedValueOnce({
        status: 'success',
        items: [],
        total: 0,
        page: 1,
        pageSize: 25
      });
    (deleteHistoryOsint as any).mockResolvedValue({ status: 'success', data: { deleted: true, id: 9 } });

    render(<HistoryPage onBack={() => {}} onRunQuery={() => {}} isAdmin={true} />);

    fireEvent.click(screen.getByRole('tab', { name: 'OSINT' }));
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));

    await screen.findByText('alias-finder');

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[0]);

    const confirmButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButtons[1]);

    await waitFor(() => {
      expect(deleteHistoryOsint).toHaveBeenCalledWith(9);
    });
  });

  it('lets a student remove their own scan from personal history', async () => {
    (getUserHistoryScans as any)
      .mockResolvedValueOnce({
        status: 'success',
        items: [
          {
            id: 3,
            target: 'student-delete.test',
            scan_date: '2026-01-01T00:00:00.000Z',
            has_snapshot: false,
            threat_level: 4,
            summary: null,
            firewall_detected: null,
            waf_name: null,
            systems_count: 0,
            osint_count: 0,
            is_deleted: false,
            deleted_at: null,
            deleted_by_user_id: null
          }
        ],
        total: 1,
        page: 1,
        pageSize: 25
      })
      .mockResolvedValueOnce({
        status: 'success',
        items: [],
        total: 0,
        page: 1,
        pageSize: 25
      });
    (deleteUserHistoryScan as any).mockResolvedValue({ status: 'success', data: { deleted: true, id: 3 } });

    render(<HistoryPage onBack={() => {}} onRunQuery={() => {}} isAdmin={false} />);
    await screen.findByText('student-delete.test');

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButtons[0]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]);

    await waitFor(() => {
      expect(deleteUserHistoryScan).toHaveBeenCalledWith(3);
    });
    expect(deleteHistoryScan).not.toHaveBeenCalled();
  });

  it('shows deleted indicator for admins viewing deleted history', async () => {
    (getHistoryScans as any).mockResolvedValue({
      status: 'success',
      items: [
        {
          id: 15,
          target: 'deleted.example',
          scan_date: '2026-01-01T00:00:00.000Z',
          has_snapshot: true,
          threat_level: 6,
          summary: null,
          firewall_detected: false,
          waf_name: null,
          systems_count: 1,
          osint_count: 2,
          is_deleted: true,
          deleted_at: '2026-01-02T00:00:00.000Z',
          deleted_by_user_id: 44
        }
      ],
      total: 1,
      page: 1,
      pageSize: 25
    });

    render(<HistoryPage onBack={() => {}} onRunQuery={() => {}} isAdmin={true} />);
    await screen.findByText('deleted.example');

    expect(screen.getByText('Deleted')).toBeInTheDocument();
  });
});
