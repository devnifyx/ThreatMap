import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AuthRecoveryPrompt from '../AuthRecoveryPrompt';

describe('AuthRecoveryPrompt', () => {
  it('renders an accessible re-login dialog and triggers the callback', () => {
    const onRelogin = vi.fn();

    render(
      <AuthRecoveryPrompt
        title="Session expired"
        message="Your session has expired."
        onRelogin={onRelogin}
      />
    );

    expect(screen.getByRole('alertdialog', { name: 'Session expired' })).toBeInTheDocument();

    const button = screen.getByRole('button', { name: 'Re-login' });
    fireEvent.click(button);

    expect(onRelogin).toHaveBeenCalledTimes(1);
  });
});

