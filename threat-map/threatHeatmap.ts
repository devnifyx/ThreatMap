import type { NormalizedThreatEvent } from './types';

export interface HeatmapRaster {
    width: number;
    height: number;
    density: Float32Array;
    max: number;
}

// Count-based kernel density on an equirectangular geographic raster. Every
// contribution starts at an actual event coordinate; longitude wraps at ±180.
// Kernel width is a visualization bandwidth (2 degrees), not a threat weight.
export function calculateHeatmap(events: NormalizedThreatEvent[], width = 720, height = 360): HeatmapRaster {
    const density = new Float32Array(width * height);
    const occupied = new Map<string, { x: number; y: number; count: number; latitude: number }>();
    for (const event of events) {
        const x = Math.round((event.source.longitude + 180) / 360 * width) % width;
        const y = Math.min(height - 1, Math.max(0, Math.round((90 - event.source.latitude) / 180 * height)));
        const key = `${x}:${y}`;
        const cell = occupied.get(key);
        if (cell) cell.count++; else occupied.set(key, { x, y, count: 1, latitude: event.source.latitude });
    }
    const sigmaY = height / 180 * 2;
    for (const cell of occupied.values()) {
        const sigmaX = Math.min(width / 6, width / 360 * 2 / Math.max(0.04, Math.cos(cell.latitude * Math.PI / 180)));
        const radiusX = Math.ceil(sigmaX * 3);
        const radiusY = Math.ceil(sigmaY * 3);
        for (let dy = -radiusY; dy <= radiusY; dy++) {
            const y = cell.y + dy;
            if (y < 0 || y >= height) continue;
            for (let dx = -radiusX; dx <= radiusX; dx++) {
                const x = (cell.x + dx + width) % width;
                density[y * width + x] += cell.count * Math.exp(-0.5 * ((dx / sigmaX) ** 2 + (dy / sigmaY) ** 2));
            }
        }
    }
    let max = 0;
    for (const value of density) max = Math.max(max, value);
    return { width, height, density, max };
}

export function paintHeatmap(canvas: HTMLCanvasElement, events: NormalizedThreatEvent[]): void {
    const raster = calculateHeatmap(events);
    canvas.width = raster.width; canvas.height = raster.height;
    const context = canvas.getContext('2d');
    if (!context) return;
    const image = context.createImageData(raster.width, raster.height);
    for (let index = 0; index < raster.density.length; index++) {
        const value = raster.max ? Math.sqrt(raster.density[index] / raster.max) : 0;
        if (value < 0.025) continue;
        const offset = index * 4;
        image.data[offset] = Math.round(95 + 150 * value);
        image.data[offset + 1] = Math.round(170 - 65 * value);
        image.data[offset + 2] = Math.round(170 - 75 * value);
        image.data[offset + 3] = Math.round(215 * Math.min(1, value));
    }
    context.putImageData(image, 0, 0);
}
