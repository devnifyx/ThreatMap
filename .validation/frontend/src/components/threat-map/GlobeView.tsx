import { useEffect, useRef } from 'react';
import type { GlobeRendererController } from './GlobeRenderer';
import type { MapError, RendererProps } from './types';

interface GlobeViewProps extends RendererProps {
    onReady: () => void;
    onError: (error: MapError) => void;
}

export function GlobeView(props: GlobeViewProps) {
    const container = useRef<HTMLDivElement>(null);
    const controller = useRef<GlobeRendererController | null>(null);
    const latest = useRef(props);
    useEffect(() => { latest.current = props; controller.current?.update(props); });
    useEffect(() => {
        let disposed = false;
        void import('./GlobeRenderer').then(({ GlobeRenderer }) => {
            if (disposed || !container.current) return;
            const renderer = new GlobeRenderer(error => latest.current.onError(error));
            controller.current = renderer;
            try { renderer.initialize(container.current); renderer.update(latest.current); latest.current.onReady(); }
            catch { renderer.dispose(); controller.current = null; latest.current.onError({ code: 'RENDERER', message: '3D rendering is unavailable on this device. Showing the flat world map.', recoverable: false }); }
        }).catch(() => { if (!disposed) latest.current.onError({ code: 'RENDERER', message: '3D rendering could not load. Showing the flat world map.', recoverable: false }); });
        return () => { disposed = true; controller.current?.dispose(); controller.current = null; };
    }, []);
    return <div ref={container} className="ctm-globe-view" />;
}
