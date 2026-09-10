import { beforeEach, describe, expect, it, vi } from 'vitest';

const notifyAuthStatus = vi.fn();

vi.mock('../authEvents', () => ({
  notifyAuthStatus
}));

describe('api auth', () => {
  beforeEach(() => {
    localStorage.clear();
    notifyAuthStatus.mockReset();
  });

  it('does not trigger auth recovery on invalid credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ message: 'Invalid credentials' })
    }));

    const { login } = await import('../api');

    await expect(login('student', 'wrongpass')).rejects.toThrow('Invalid credentials');
    expect(notifyAuthStatus).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('does not send a stale authorization header to the login endpoint', async () => {
    localStorage.setItem('token', 'stale-token');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ token: 'fresh-token', user: { id: 1, username: 'student' } })
    });
    vi.stubGlobal('fetch', fetchMock);

    const { login } = await import('../api');
    await login('student', 'correctpass');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
    expect(localStorage.getItem('token')).toBe('fresh-token');

    vi.unstubAllGlobals();
  });

  it('sends the active authorization header when logging out', async () => {
    localStorage.setItem('token', 'active-token');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success' })
    });
    vi.stubGlobal('fetch', fetchMock);

    const { logout } = await import('../api');
    await logout();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0];
    expect(options.credentials).toBe('include');
    expect(options.headers.Authorization).toBe('Bearer active-token');

    vi.unstubAllGlobals();
  });

  it('calls the student scan delete endpoint with auth', async () => {
    localStorage.setItem('token', 'student-token');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', data: { deleted: true, id: 8 } })
    });
    vi.stubGlobal('fetch', fetchMock);

    const { deleteUserHistoryScan } = await import('../api');
    await deleteUserHistoryScan(8);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/user/history/scans/8'),
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer student-token' })
      })
    );

    vi.unstubAllGlobals();
  });

  it('calls the student OSINT delete endpoint with auth', async () => {
    localStorage.setItem('token', 'student-token');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'success', data: { deleted: true, id: 12 } })
    });
    vi.stubGlobal('fetch', fetchMock);

    const { deleteUserHistoryOsint } = await import('../api');
    await deleteUserHistoryOsint(12);

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/user/history/osint/12'),
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer student-token' })
      })
    );

    vi.unstubAllGlobals();
  });

  it('surfaces OSINT backend failures as fetch errors', async () => {
    localStorage.setItem('token', 'student-token');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: {
        get: (name: string) => name === 'content-type' ? 'application/json' : null
      },
      json: async () => ({ error: 'GeoSpy lookup failed: invalid query' })
    }));

    const { getOsintData } = await import('../api');

    await expect(getOsintData('geo-spy', 'not-an-ip')).rejects.toThrow('GeoSpy lookup failed: invalid query');

    vi.unstubAllGlobals();
  });
});
