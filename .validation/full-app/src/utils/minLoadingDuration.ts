// A fast async action (e.g. Telegram Intelligence's Message Search, which
// often resolves in well under 100ms against a small/local result set) flips
// a loading flag on and back off so quickly that it reads as a single flash
// or "blink" rather than a visible loading state. Wrapping the promise here
// keeps it pending for at least `minMs`, so the caller's loading state stays
// on long enough to actually be seen — without ever slowing down a request
// that already took longer than that on its own.
export function withMinDuration<T>(promise: Promise<T>, minMs: number, startedAt: number = Date.now()): Promise<T> {
    const waitForMinimum = () => {
        const remaining = minMs - (Date.now() - startedAt);
        return remaining > 0 ? new Promise<void>((resolve) => setTimeout(resolve, remaining)) : Promise.resolve();
    };
    return promise.then(
        (value) => waitForMinimum().then(() => value),
        (err) => waitForMinimum().then(() => { throw err; })
    );
}
