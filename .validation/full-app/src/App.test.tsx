import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { notifyAuthRequired } from './services/authEvents';

vi.mock('./pages/ScanInput/ScanInputPage', () => ({
  default: () => <div>Mock Scan Input</div>
}));

vi.mock('./pages/ScanResults/ScanResultsPage', () => ({
  default: () => <div>Mock Scan Results</div>
}));

vi.mock('./pages/OsintResults/OsintPage', () => ({
  default: () => <div>Mock Osint Page</div>
}));

vi.mock('./pages/Dashboard/DashboardPage', () => ({
  default: () => <div>Mock Dashboard</div>
}));

vi.mock('./pages/History/HistoryPage', () => ({
  default: () => <div>Mock History</div>
}));

vi.mock('./pages/UserManagement/UserManagementPage', () => ({
  default: () => <div>Mock User Management</div>
}));

vi.mock('./pages/AdminDashboard/AdminDashboardPage', () => ({
  default: () => <div>Mock Admin Dashboard</div>
}));

vi.mock('./pages/SessionManagement/SessionManagementPage', () => ({
  default: () => <div>Mock Session Management</div>
}));

vi.mock('./components/SmoothScroll', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock('./components/AppShell', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock('./components/ErrorBoundary', () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock('./components/TerminationAlert', () => ({
  default: () => <div>Mock Termination Alert</div>
}));

vi.mock('./pages/Login/LoginPage', () => ({
  default: () => <div>Mock Login Page</div>
}));

vi.mock('./services/searchHistory', () => ({
  addSearchHistory: vi.fn()
}));

vi.mock('./services/websocket', () => ({
  wsService: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    onTermination: vi.fn(() => () => {})
  }
}));

describe('App auth recovery', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, username: 'demo', role: 'analyst' }));
    window.history.replaceState({}, '', '#/dashboard');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ user: { id: 1, username: 'demo', role: 'analyst' } })
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the re-login prompt and returns to the login page when clicked', async () => {
    const { default: App } = await import('./App');

    render(<App />);

    expect(await screen.findByText('Mock Dashboard')).toBeTruthy();

    notifyAuthRequired({
      title: 'Session expired',
      message: 'Your session has expired. Please log in again to continue.'
    });

    expect(await screen.findByRole('button', { name: 'Re-login' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Re-login' }));

    await waitFor(() => {
      expect(screen.getByText('Mock Login Page')).toBeTruthy();
    });

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });
});
