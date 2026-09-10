import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PasswordInput from '../PasswordInput';

afterEach(() => cleanup());

describe('PasswordInput', () => {
  it('toggles password visibility and updates aria-label', () => {
    render(<PasswordInput defaultValue="secret" inputLabel="Access code" />);

    const input = screen.getByDisplayValue('secret') as HTMLInputElement;
    expect(input.type).toBe('password');

    const showButton = screen.getByRole('button', { name: 'Show password' });
    fireEvent.click(showButton);

    expect(input.type).toBe('text');
    const hideButton = screen.getByRole('button', { name: 'Hide password' });
    expect(hideButton).toBeInTheDocument();

    fireEvent.click(hideButton);
    expect(input.type).toBe('password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });
});

