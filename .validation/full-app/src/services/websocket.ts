type TerminationEvent = {
    type: 'account_terminated' | 'account_deleted';
    userId: number;
    username: string;
    title: string;
    message: string;
    reason?: string;
    timestamp: string;
};

type ConnectionEvent = {
    type: 'connection_established';
    userId: number;
    username: string;
    timestamp: string;
};

type WsMessage = TerminationEvent | ConnectionEvent;

type TerminationCallback = (event: TerminationEvent) => void;

class WebSocketService {
    private ws: WebSocket | null = null;
    private wsUrl: string = '';
    private terminationCallbacks: TerminationCallback[] = [];
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private isIntentionallyClosed = false;

    connect() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsBase = import.meta.env.VITE_WS_BASE_URL || `${protocol}//${window.location.host}`;
        this.wsUrl = `${wsBase}/ws/events`;

        this.isIntentionallyClosed = false;
        this.attemptConnection();
    }

    private attemptConnection() {
        try {
            this.ws = new WebSocket(this.wsUrl);

            this.ws.onopen = () => {
                console.log('[WS] Connected to events endpoint');
                this.reconnectAttempts = 0;
            };

            this.ws.onmessage = (event) => {
                try {
                    const message: WsMessage = JSON.parse(event.data);

                    if (message.type === 'connection_established') {
                        console.log('[WS] Connection established for user:', message.username);
                    } else if (message.type === 'account_terminated' || message.type === 'account_deleted') {
                        console.warn('[WS] Received termination event:', message);
                        this.handleTerminationEvent(message as TerminationEvent);
                    }
                } catch (err) {
                    console.error('[WS] Failed to parse message:', err);
                }
            };

            this.ws.onerror = (error) => {
                console.error('[WS] WebSocket error:', error);
            };

            this.ws.onclose = (event) => {
                console.log('[WS] Connection closed:', event.code, event.reason);
                this.ws = null;

                if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
                    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    setTimeout(() => this.attemptConnection(), delay);
                }
            };
        } catch (err) {
            console.error('[WS] Failed to create WebSocket:', err);
        }
    }

    private handleTerminationEvent(event: TerminationEvent) {
        for (const callback of this.terminationCallbacks) {
            try {
                callback(event);
            } catch (err) {
                console.error('[WS] Termination callback error:', err);
            }
        }
    }

    onTermination(callback: TerminationCallback): () => void {
        this.terminationCallbacks.push(callback);
        return () => {
            const index = this.terminationCallbacks.indexOf(callback);
            if (index > -1) {
                this.terminationCallbacks.splice(index, 1);
            }
        };
    }

    disconnect() {
        this.isIntentionallyClosed = true;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}

export const wsService = new WebSocketService();
