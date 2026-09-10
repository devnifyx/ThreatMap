import { useCallback, useEffect, useRef, useState } from 'react';
import { threatMapSocket, type ThreatEvent } from '../../services/threatMapSocket';
import { mergeThreatEvents, normalizeThreatEvent } from './threatNormalization';
import type { FeedState, NormalizedThreatEvent, ThreatData } from './types';

export const MAX_RETAINED_EVENTS = 50_000;

export function useThreatMapData(isLive: boolean) {
    const [events, setEvents] = useState<NormalizedThreatEvent[]>([]);
    const [feedState, setFeedState] = useState<FeedState>('connecting');
    const [loading, setLoading] = useState(true);
    const [rejectedCount, setRejectedCount] = useState(0);
    const [limited, setLimited] = useState(false);
    const live = useRef(isLive);
    const pending = useRef(new Map<string, NormalizedThreatEvent>());
    const originals = useRef(new WeakMap<NormalizedThreatEvent, ThreatData>());

    const flush = useCallback(() => {
        if (!live.current || !pending.current.size) return;
        const incoming = [...pending.current.values()];
        pending.current.clear();
        setEvents(previous => mergeThreatEvents(previous, incoming).slice(0, MAX_RETAINED_EVENTS));
    }, []);

    useEffect(() => { live.current = isLive; if (isLive) flush(); }, [isLive, flush]);

    useEffect(() => {
        let unavailable = false;
        let received = false;
        const ingest = (batch: ThreatEvent[]) => {
            received = true;
            unavailable = false;
            let rejected = 0;
            for (const raw of batch) {
                const event = normalizeThreatEvent(raw);
                if (!event) { rejected++; continue; }
                originals.current.set(event, raw);
                pending.current.set(event.id, event);
            }
            // Bound the paused transport buffer without inventing expiry times.
            if (pending.current.size > MAX_RETAINED_EVENTS) {
                const latest = mergeThreatEvents([], [...pending.current.values()]).slice(0, MAX_RETAINED_EVENTS);
                pending.current = new Map(latest.map(event => [event.id, event]));
                setLimited(true);
            }
            if (rejected) setRejectedCount(previous => previous + rejected);
            setFeedState('live');
            setLoading(false);
        };
        const unsubscribeSnapshot = threatMapSocket.onSnapshot(ingest);
        const unsubscribeEvents = threatMapSocket.onEvents(ingest);
        const unsubscribeUnavailable = threatMapSocket.onUnavailable(() => {
            unavailable = true; setFeedState('unavailable'); setLoading(false);
        });
        const unsubscribeError = threatMapSocket.onError(() => { setFeedState('disconnected'); setLoading(false); });
        try { if (!threatMapSocket.isConnected()) threatMapSocket.connect(); }
        catch { setFeedState('disconnected'); setLoading(false); }
        const batchTimer = window.setInterval(flush, 250);
        const statusTimer = window.setInterval(() => {
            if (unavailable) return;
            const connected = threatMapSocket.isConnected();
            setFeedState(connected ? 'live' : received ? 'disconnected' : 'connecting');
            if (connected) setLoading(false);
        }, 1000);
        const loadingTimer = window.setTimeout(() => setLoading(false), 8000);
        return () => {
            unsubscribeSnapshot(); unsubscribeEvents(); unsubscribeUnavailable(); unsubscribeError();
            window.clearInterval(batchTimer); window.clearInterval(statusTimer); window.clearTimeout(loadingTimer);
            pending.current.clear();
            // This singleton is also subscribed to by the Dashboard and Global
            // Threat Map page. A visualization must not disconnect their feed.
        };
    }, [flush]);

    const originalEvent = useCallback((event: NormalizedThreatEvent) => originals.current.get(event), []);
    return { events, feedState, loading, rejectedCount, limited: limited || events.length === MAX_RETAINED_EVENTS, originalEvent };
}
