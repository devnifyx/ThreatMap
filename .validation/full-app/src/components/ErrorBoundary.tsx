import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// "Failed to fetch dynamically imported module" / "error loading dynamically
// imported module" is a well-known class of error for code-split (lazy())
// apps: it fires whenever the browser's already-loaded page holds a
// reference to a module graph the server no longer serves that exact way —
// the Vite dev server restarted mid-session, or (in production) a new
// deploy replaced the built chunk files while this tab was still open on
// the old build. It is not a defect in whatever page happened to be
// lazy-loaded when it hit; a single reload re-fetches the CURRENT module
// graph and resolves it every time. A sessionStorage guard keyed off the
// failing URL keeps this to ONE automatic attempt per distinct failure, so
// a genuinely broken/missing chunk still falls through to the normal error
// screen instead of reload-looping forever.
const CHUNK_LOAD_ERROR_PATTERN = /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed/i;
const RELOAD_GUARD_KEY = 'lekirrax:chunkLoadReloadedFor';

function isChunkLoadError(error: Error): boolean {
  return CHUNK_LOAD_ERROR_PATTERN.test(error.message || '');
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);

    if (isChunkLoadError(error)) {
      // Key on the failing message (it embeds the module URL) rather than a
      // single flat flag, so a DIFFERENT chunk failing later — e.g. another
      // stale-tab reload right after a subsequent deploy — still gets its
      // own one-time auto-reload instead of being silently suppressed by an
      // earlier, unrelated attempt.
      let alreadyTried = false;
      try { alreadyTried = sessionStorage.getItem(RELOAD_GUARD_KEY) === error.message; } catch { /* sessionStorage unavailable (private mode, etc.) — fall through to the manual error screen */ }
      if (!alreadyTried) {
        try { sessionStorage.setItem(RELOAD_GUARD_KEY, error.message); } catch { /* best effort — worst case this reloads more than once */ }
        window.location.reload();
      }
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          color: '#ff4d4d',
          backgroundColor: '#0f1115',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'monospace',
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '20px', color: '#00e5ff' }}>SENTINEL ERROR</h1>
          <div style={{
            padding: '20px',
            border: '1px solid #333',
            borderRadius: '8px',
            backgroundColor: '#181b21',
            maxWidth: '800px',
            overflow: 'auto',
            textAlign: 'left'
          }}>
            <p style={{ color: '#90a4ae', marginBottom: '10px' }}>The system encountered a critical rendering exception:</p>
            <pre style={{ whiteSpace: 'pre-wrap', color: '#ff4d4d' }}>{this.state.error?.toString()}</pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '30px',
              padding: '12px 24px',
              backgroundColor: 'transparent',
              color: '#00e5ff',
              border: '1px solid #00e5ff',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          >
            Reboot System
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
