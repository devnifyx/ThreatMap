import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withMinDuration } from './minLoadingDuration';

// Telegram Intelligence "Message Search" — a search that resolves almost
// instantly (small/local result sets) made the loading state flash on and
// off so fast it read as the button "blinking" rather than a visible
// loading indicator. withMinDuration keeps a loading promise pending for at
// least `minMs`, without ever slowing down a genuinely slow request.
describe('withMinDuration', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('does not resolve before the minimum duration even if the promise settles instantly', async () => {
        const fast = Promise.resolve('done');
        let resolved = false;
        withMinDuration(fast, 3000).then(() => { resolved = true; });

        await Promise.resolve(); // let the instant promise's microtask run
        expect(resolved).toBe(false);

        await vi.advanceTimersByTimeAsync(2999);
        expect(resolved).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        expect(resolved).toBe(true);
    });

    it('resolves with the wrapped promise\'s value', async () => {
        const p = withMinDuration(Promise.resolve('search results'), 3000);
        await vi.advanceTimersByTimeAsync(3000);
        await expect(p).resolves.toBe('search results');
    });

    it('rejects with the original error, still after the minimum duration', async () => {
        const p = withMinDuration(Promise.reject(new Error('network down')), 3000);
        const assertion = expect(p).rejects.toThrow('network down');
        await vi.advanceTimersByTimeAsync(3000);
        await assertion;
    });

    it('adds no extra delay when the promise already took longer than the minimum', async () => {
        const slow = new Promise((resolve) => setTimeout(() => resolve('slow result'), 5000));
        let resolved = false;
        withMinDuration(slow, 3000).then(() => { resolved = true; });

        await vi.advanceTimersByTimeAsync(4999);
        expect(resolved).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        expect(resolved).toBe(true);
    });
});
