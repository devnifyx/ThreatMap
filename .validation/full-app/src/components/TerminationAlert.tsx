import React from 'react';
import './TerminationAlert.css';

type TerminationAlertProps = {
    type: 'account_terminated' | 'account_deleted';
    title: string;
    message: string;
    reason?: string;
    onLogout: () => void;
};

const TerminationAlert: React.FC<TerminationAlertProps> = ({
    type,
    title,
    message,
    reason,
    onLogout
}) => {
    const isDeleted = type === 'account_deleted';

    return (
        <div className="termination-overlay">
            <div className="termination-modal">
                <div className="termination-icon">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>

                <h2 className="termination-title">{title}</h2>

                <p className="termination-message">{message}</p>

                {reason && (
                    <p className="termination-reason">{reason}</p>
                )}

                <div className="termination-info">
                    <p>This is a permanent action. Your access to the system has been revoked.</p>
                    <p className="termination-contact">
                        If you believe this action was taken in error, please contact your institution&apos;s administration.
                    </p>
                </div>

                <button
                    className="termination-logout-btn"
                    onClick={onLogout}
                >
                    {isDeleted ? 'Close' : 'Return to Login'}
                </button>
            </div>
        </div>
    );
};

export default TerminationAlert;
