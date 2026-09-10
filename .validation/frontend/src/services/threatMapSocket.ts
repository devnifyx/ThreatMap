export interface ThreatEvent {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
    source: { lat: number; lng: number; country: string; countryCode?: string | null };
    destination?: { lat: number; lng: number; country: string; countryCode?: string | null };
}

type SnapshotCallback = (events: ThreatEvent[]) => void;
type EventsCallback = (events: ThreatEvent[]) => void;
type UnavailableCallback = () => void;
type ErrorCallback = () => void;

type WsMessage =
    | { type: 'threat-snapshot'; data: ThreatEvent[] }
    | { type: 'threat-events'; data: ThreatEvent[] }
    | { type: 'threat-feed-unavailable' };

class ThreatMapSocket {
    private ws: WebSocket | null = null;
    private wsUrl = '';
    private snapshotCallbacks: SnapshotCallback[] = [];
    private eventsCallbacks: EventsCallback[] = [];
    private unavailableCallbacks: UnavailableCallback[] = [];
    private errorCallbacks: ErrorCallback[] = [];
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 6;
    private reconnectDelay = 1000;
    private isIntentionallyClosed = false;

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsBase = import.meta.env.VITE_WS_BASE_URL || `${protocol}//${window.location.host}`;
        this.wsUrl = `${wsBase}/ws/threat-map`;

        this.isIntentionallyClosed = false;
        this.attemptConnection();
    }

    private attemptConnection() {
        try {
            const ws = new WebSocket(this.wsUrl);
            this.ws = ws;

            const isStale = () => this.ws !== ws;

            ws.onopen = () => {
                if (isStale()) return;
                console.log('[ThreatMapWS] Connected');
                this.reconnectAttempts = 0;
            };

            ws.onmessage = (event) => {
                if (isStale()) return;
                let message: WsMessage;
                try {
                    message = JSON.parse(event.data);
                } catch (err) {
                    console.error('[ThreatMapWS] Failed to parse message:', err);
                    return;
                }

                if (message.type === 'threat-snapshot') {
                    this.emit(this.snapshotCallbacks, Array.isArray(message.data) ? message.data : []);
                } else if (message.type === 'threat-events') {
                    this.emit(this.eventsCallbacks, Array.isArray(message.data) ? message.data : []);
                } else if (message.type === 'threat-feed-unavailable') {
                    for (const cb of this.unavailableCallbacks) {
                        try { cb(); } catch (err) { console.error('[ThreatMapWS] unavailable callback error:', err); }
                    }
                }
            };

            ws.onerror = () => {
                if (isStale()) return;
                for (const cb of this.errorCallbacks) {
                    try { cb(); } catch (err) { console.error('[ThreatMapWS] error callback error:', err); }
                }
            };

            ws.onclose = () => {
                if (isStale()) return; // a newer socket already took over
                this.ws = null;
                if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
                    setTimeout(() => this.attemptConnection(), delay);
                }
            };
        } catch (err) {
            console.error('[ThreatMapWS] Failed to create WebSocket:', err);
        }
    }

    private emit<T>(callbacks: ((arg: T) => void)[], arg: T) {
        for (const cb of callbacks) {
            try { cb(arg); } catch (err) { console.error('[ThreatMapWS] callback error:', err); }
        }
    }

    onSnapshot(cb: SnapshotCallback): () => void {
        this.snapshotCallbacks.push(cb);
        return () => { this.snapshotCallbacks = this.snapshotCallbacks.filter((c) => c !== cb); };
    }

    onEvents(cb: EventsCallback): () => void {
        this.eventsCallbacks.push(cb);
        return () => { this.eventsCallbacks = this.eventsCallbacks.filter((c) => c !== cb); };
    }

    onUnavailable(cb: UnavailableCallback): () => void {
        this.unavailableCallbacks.push(cb);
        return () => { this.unavailableCallbacks = this.unavailableCallbacks.filter((c) => c !== cb); };
    }

    onError(cb: ErrorCallback): () => void {
        this.errorCallbacks.push(cb);
        return () => { this.errorCallbacks = this.errorCallbacks.filter((c) => c !== cb); };
    }

    disconnect() {
        this.isIntentionallyClosed = true;
        const ws = this.ws;
        this.ws = null;
        if (!ws) return;

        if (ws.readyState === WebSocket.CONNECTING) {
            ws.addEventListener('open', () => { try { ws.close(); } catch { /* already gone */ } }, { once: true });
            ws.addEventListener('error', () => { /* never opened — nothing to close */ }, { once: true });
            return;
        }

        try { ws.close(); } catch { /* already closed */ }
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}

export const threatMapSocket = new ThreatMapSocket();
