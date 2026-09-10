import { useEffect, useState } from 'react';
import './AdminDashboardPage.css';
import { getSystemStats } from '../../services/api';

interface AdminDashboardPageProps {
  onNavigateToUserManagement: () => void;
  onNavigateToFullHistory: () => void;
  onNavigateToSessionManagement: () => void;
}

export default function AdminDashboardPage({
  onNavigateToUserManagement,
  onNavigateToFullHistory,
  onNavigateToSessionManagement,
}: AdminDashboardPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    totalScans: number;
    totalOsint: number;
    activeUsers: number;
    activeSessions: number;
  } | null>(null);

  useEffect(() => {
    async function loadStats() {
      try {
        setError(null);
        const data = await getSystemStats();
        setStats(data.stats);
      } catch (e: any) {
        setError(e?.message || 'Failed to load system stats');
      }
    }
    loadStats();
  }, []);

  return (
    <div className="admin-dashboard-page">
      <header className="admin-dashboard-header">
        <h1>Admin | System Control Center</h1>
      </header>

      {error && (
        <div className="admin-dashboard-error" role="alert">
          {error}
        </div>
      )}

      <main className="admin-dashboard-content">
        <div className="admin-mission-control">
          <button
            className="admin-mission-card"
            onClick={onNavigateToUserManagement}
          >
            <div className="card-icon">
                <img src="/ManageUser.png" alt="UserManage" style={{width: '40px', height: '40px', objectFit: 'contain'}} />
            </div>
            <div>
              <h3>User Management</h3>
              <p>Manage users and permissions</p>
            </div>
            <div className="card-arrow">→</div>
          </button>

          <button
            className="admin-mission-card"
            onClick={onNavigateToFullHistory}
          >
            <div className="card-icon">
                <img src="/FullHistory.png" alt="FullHistory" style={{width: '40px', height: '40px', objectFit: 'contain'}} />
            </div>
            <div>
              <h3>Full History</h3>
              <p>View all system activity</p>
            </div>
            <div className="card-arrow">→</div>
          </button>

          <button
            className="admin-mission-card"
            onClick={onNavigateToSessionManagement}
          >
            <div className="card-icon">
                <img src="/SessionManagement.png" alt="Sessions" style={{width: '40px', height: '40px', objectFit: 'contain'}} />
            </div>
            <div>
              <h3>Session Management</h3>
              <p>Manage active user sessions</p>
            </div>
            <div className="card-arrow">→</div>
          </button>
        </div>

        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-icon">🌐</div>
            <div className="admin-stat-content">
              <div className="admin-stat-label">Total Scans</div>
              <div className="admin-stat-value">{stats?.totalScans ?? 0}</div>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon">🔍</div>
            <div className="admin-stat-content">
              <div className="admin-stat-label">OSINT Investigations</div>
              <div className="admin-stat-value">{stats?.totalOsint ?? 0}</div>
            </div>
          </div>

          <div className="admin-stat-card">
            <div className="admin-stat-icon">👤</div>
            <div className="admin-stat-content">
              <div className="admin-stat-label">Active Users</div>
              <div className="admin-stat-value">{stats?.activeUsers ?? 0}</div>
            </div>
          </div>

          <div className="admin-stat-card sessions clickable" onClick={onNavigateToSessionManagement}>
            <div className="admin-stat-icon">🟢</div>
            <div className="admin-stat-content">
              <div className="admin-stat-label">Active Sessions</div>
              <div className="admin-stat-value">
                {stats?.activeSessions ?? 0} / {Number(import.meta.env.VITE_MAX_CONCURRENT_USERS) || 10}
              </div>
            </div>
          </div>
        </div>

        <div className="admin-system-status">
          <h2>System Status</h2>
          <div className="status-grid">
            <div className="status-item">
              <div className="status-dot online" />
              <div className="status-label">Database</div>
              <div className="status-value">Online</div>
            </div>
            <div className="status-item">
              <div className="status-dot online" />
              <div className="status-label">API Server</div>
              <div className="status-value">Online</div>
            </div>
            <div className="status-item">
              <div className="status-dot online" />
              <div className="status-label">WebSocket</div>
              <div className="status-value">Online</div>
            </div>
            <div className="status-item">
              <div className="status-dot online" />
              <div className="status-label">Session Capacity</div>
              <div className="status-value">{Math.round(((stats?.activeSessions ?? 0) / 3) * 100)}%</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
