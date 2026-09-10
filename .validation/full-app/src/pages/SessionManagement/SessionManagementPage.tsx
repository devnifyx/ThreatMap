import { useEffect, useState } from 'react';
import './SessionManagementPage.css';
import Logo from '../../picture/Logo.png';
import { getActiveSessions, terminateSession, terminateUserSessions, terminateAllSessionsExceptMe } from '../../services/api';

interface Session {
  id: string;
  token: string;
  userId: number;
  username: string;
  email: string;
  role: string;
  loginTime: string;
  lastActivity: string;
  ipAddress?: string;
  userAgent?: string;
  sessionDuration: number;
  isCurrentSession: boolean;
}

interface SessionManagementPageProps {
  onBack: () => void;
}

export default function SessionManagementPage({ onBack }: SessionManagementPageProps) {
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSessions = async () => {
    try {
      setError(null);
      const data = await getActiveSessions();
      setSessions(data.sessions);
    } catch (e: any) {
      setError(e?.message || 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
    // Refresh every 10 seconds
    const interval = setInterval(loadSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleTerminateSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to terminate this session?')) return;
    try {
      await terminateSession(sessionId);
      loadSessions();
    } catch (e: any) {
      setError(e?.message || 'Failed to terminate session');
    }
  };

  const handleTerminateUserSessions = async (userId: number, username: string) => {
    if (!window.confirm(`Are you sure you want to terminate all sessions for user ${username}?`)) return;
    try {
      await terminateUserSessions(userId);
      loadSessions();
    } catch (e: any) {
      setError(e?.message || 'Failed to terminate user sessions');
    }
  };

  const handleTerminateAllSessionsExceptMe = async () => {
    if (!window.confirm('Are you sure you want to terminate all sessions except your current one?')) return;
    try {
      await terminateAllSessionsExceptMe();
      loadSessions();
    } catch (e: any) {
      setError(e?.message || 'Failed to terminate sessions');
    }
  };

  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const getSessionStatus = (session: Session): string => {
    const timeSinceActivity = Date.now() - new Date(session.lastActivity).getTime();
    if (timeSinceActivity < 5 * 60 * 1000) return 'Online';
    if (timeSinceActivity < 30 * 60 * 1000) return 'Idle';
    return 'Disconnected';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'Online': return '#10b981';
      case 'Idle': return '#f59e0b';
      case 'Disconnected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  return (
    <div className="session-management-page">
      <header className="session-management-header">
        <div className="brand">
          <div className="logo-icon">
            <img src={Logo} alt="BaeSpy" />
          </div>
          <div>
            <h1>ADMIN | SESSION MANAGEMENT</h1>
          </div>
        </div>
        <div className="session-management-actions">
          <button className="session-management-btn refresh" onClick={loadSessions} disabled={isLoading}>
            🔄 Refresh
          </button>
          <button
            className="session-management-btn terminate-all"
            onClick={handleTerminateAllSessionsExceptMe}
            disabled={isLoading || sessions.filter(s => !s.isCurrentSession).length === 0}
          >
            🚫 Terminate All Except Me
          </button>
          <button className="session-management-btn back" onClick={onBack}>
            ← Back
          </button>
        </div>
      </header>

      {error && (
        <div className="session-management-error" role="alert">
          {error}
        </div>
      )}

      <main className="session-management-content">
        <div className="session-stats">
          <div className="session-stat-card">
            <div className="stat-label">Total Active Sessions</div>
            <div className="stat-value">{sessions.length}</div>
          </div>
          <div className="session-stat-card">
            <div className="stat-label">Online</div>
            <div className="stat-value" style={{ color: '#10b981' }}>
              {sessions.filter(s => getSessionStatus(s) === 'Online').length}
            </div>
          </div>
          <div className="session-stat-card">
            <div className="stat-label">Idle</div>
            <div className="stat-value" style={{ color: '#f59e0b' }}>
              {sessions.filter(s => getSessionStatus(s) === 'Idle').length}
            </div>
          </div>
        </div>

        {isLoading && <div className="session-loading">Loading sessions...</div>}

        {!isLoading && sessions.length === 0 && (
          <div className="session-empty">No active sessions</div>
        )}

        {!isLoading && sessions.length > 0 && (
          <div className="session-list">
            {sessions.map((session) => (
              <div key={session.id} className="session-card">
                <div className="session-header">
                  <div className="session-user">
                    <div className="session-avatar">
                      {session.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="session-username">{session.username}</div>
                      <div className="session-email">{session.email}</div>
                    </div>
                  </div>
                  <div
                    className="session-status"
                    style={{ backgroundColor: getStatusColor(getSessionStatus(session)) }}
                  >
                    {getSessionStatus(session)}
                  </div>
                  {session.isCurrentSession && (
                    <div className="session-current">Current Session</div>
                  )}
                </div>

                <div className="session-details">
                  <div className="session-detail">
                    <div className="detail-label">Role</div>
                    <div className="detail-value">{session.role}</div>
                  </div>
                  <div className="session-detail">
                    <div className="detail-label">Login Time</div>
                    <div className="detail-value">{new Date(session.loginTime).toLocaleString()}</div>
                  </div>
                  <div className="session-detail">
                    <div className="detail-label">Last Activity</div>
                    <div className="detail-value">{new Date(session.lastActivity).toLocaleString()}</div>
                  </div>
                  <div className="session-detail">
                    <div className="detail-label">Duration</div>
                    <div className="detail-value">{formatDuration(session.sessionDuration)}</div>
                  </div>
                  {session.ipAddress && (
                    <div className="session-detail">
                      <div className="detail-label">IP Address</div>
                      <div className="detail-value">{session.ipAddress}</div>
                    </div>
                  )}
                  {session.userAgent && (
                    <div className="session-detail">
                      <div className="detail-label">User Agent</div>
                      <div className="detail-value user-agent">{session.userAgent}</div>
                    </div>
                  )}
                </div>

                <div className="session-actions">
                  <button
                    className="session-btn terminate-user"
                    onClick={() => handleTerminateUserSessions(session.userId, session.username)}
                    disabled={session.isCurrentSession}
                  >
                    Terminate User Sessions
                  </button>
                  <button
                    className="session-btn terminate"
                    onClick={() => handleTerminateSession(session.id)}
                    disabled={session.isCurrentSession}
                  >
                    Terminate Session
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}