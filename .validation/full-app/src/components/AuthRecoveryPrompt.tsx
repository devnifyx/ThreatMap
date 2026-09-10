import './AuthRecoveryPrompt.css';

type AuthRecoveryPromptProps = {
  title: string;
  message: string;
  onRelogin: () => void;
};

export default function AuthRecoveryPrompt({ title, message, onRelogin }: AuthRecoveryPromptProps) {
  return (
    <div className="auth-recovery-overlay" role="presentation">
      <div
        className="auth-recovery-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="auth-recovery-title"
        aria-describedby="auth-recovery-message"
      >
        <div className="auth-recovery-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M12 2a10 10 0 1 1-10 10A10 10 0 0 1 12 2Zm0 5a1.5 1.5 0 1 0 1.5 1.5A1.5 1.5 0 0 0 12 7Zm-2 5v1.5h1v3h-1V18h4v-1.5h-1V12Z"
            />
          </svg>
        </div>
        <h2 id="auth-recovery-title" className="auth-recovery-title">{title}</h2>
        <p id="auth-recovery-message" className="auth-recovery-message">{message}</p>
        <p className="auth-recovery-caption">
          Select Re-login to return to the login page and restore access.
        </p>
        <button
          type="button"
          className="auth-recovery-button"
          onClick={onRelogin}
          autoFocus
        >
          Re-login
        </button>
      </div>
    </div>
  );
}

