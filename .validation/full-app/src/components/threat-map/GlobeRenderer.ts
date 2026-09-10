import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { geoDistance, geoEquirectangular, geoInterpolate, geoPath } from 'd3-geo';
import { createCountryPicker, countryFocus } from './geographicData';
import { clusterThreatEvents } from './threatSelectors';
import { paintHeatmap } from './threatHeatmap';
import { SEVERITY_COLORS } from './types';
import type { CountryFeature, MapError, NormalizedThreatEvent, RendererProps, ThreatCluster } from './types';

export interface GlobeRendererController {
    initialize(container: HTMLElement): void;
    update(props: RendererProps): void;
    setEvents(events: NormalizedThreatEvent[]): void;
    setSelectedEvent(eventId: string | null): void;
    setSelectedCountry(countryId: string | null): void;
    setConnectionsVisible(visible: boolean): void;
    focusCoordinate(latitude: number, longitude: number, zoom?: number): void;
    focusEvent(event: NormalizedThreatEvent): void;
    focusCountry(countryId: string): void;
    resetView(): void;
    resize(): void;
    dispose(): void;
}

export function latLngToVector3(latitude: number, longitude: number, radius = 1): THREE.Vector3 {
    const latitudeRadians = THREE.MathUtils.degToRad(latitude);
    const longitudeRadians = THREE.MathUtils.degToRad(longitude);
    return new THREE.Vector3(radius * Math.cos(latitudeRadians) * Math.cos(longitudeRadians), radius * Math.sin(latitudeRadians), -radius * Math.cos(latitudeRadians) * Math.sin(longitudeRadians));
}

function vectorToLatLng(point: THREE.Vector3) {
    return { latitude: THREE.MathUtils.radToDeg(Math.asin(point.y / point.length())), longitude: THREE.MathUtils.radToDeg(Math.atan2(-point.z, point.x)) };
}

interface MarkerObject {
    object: THREE.Mesh | THREE.Sprite;
    count: number;
    cluster: ThreatCluster;
}

export class GlobeRenderer implements GlobeRendererController {
    private scene = new THREE.Scene();
    private camera = new THREE.PerspectiveCamera(40, 1, 0.01, 30);
    private renderer: THREE.WebGLRenderer | null = null;
    private controls: OrbitControls | null = null;
    private container: HTMLElement | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private animationFrame = 0;
    private disposed = false;
    private dirty = true;
    private props: RendererProps | null = null;
    private raycaster = new THREE.Raycaster();
    private pointer = new THREE.Vector2();
    private pointerPosition: { x: number; y: number } | null = null;
    private pointerDown: { x: number; y: number } | null = null;
    private pickCountry: ReturnType<typeof createCountryPicker> = () => undefined;
    private hoverId: string | null = null;
    private sphereGeometry = new THREE.SphereGeometry(1, 96, 64);
    private dotGeometry = new THREE.SphereGeometry(1, 10, 8);
    private earthMaterial = new THREE.MeshPhongMaterial({ color: '#c5ccd0', shininess: 9, specular: '#294555' });
    private earth = new THREE.Mesh(this.sphereGeometry, this.earthMaterial);
    private countryCanvas = document.createElement('canvas');
    private countryTexture = new THREE.CanvasTexture(this.countryCanvas);
    private heatCanvas = document.createElement('canvas');
    private heatTexture = new THREE.CanvasTexture(this.heatCanvas);
    private countryOverlay = new THREE.Mesh(this.sphereGeometry, new THREE.MeshBasicMaterial({ map: this.countryTexture, transparent: true, depthWrite: false }));
    private heatOverlay = new THREE.Mesh(this.sphereGeometry, new THREE.MeshBasicMaterial({ map: this.heatTexture, transparent: true, depthWrite: false }));
    private borders = new Map<string, THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>>();
    private markers = new Map<string, MarkerObject>();
    private markerGroup = new THREE.Group();
    private investigationGroup = new THREE.Group();
    private connectionGeometry = new THREE.BufferGeometry();
    private connectionMaterial = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7 });
    private connections = new THREE.LineSegments(this.connectionGeometry, this.connectionMaterial);
    private arrowGeometry = new THREE.ConeGeometry(0.004, 0.015, 5);
    private arrowMaterial = new THREE.MeshBasicMaterial({ color: '#d4e1e6' });
    private arrows: THREE.InstancedMesh | null = null;
    private dotMaterials = new Map<string, THREE.MeshBasicMaterial>();
    private clusterCell = 0;
    private countryDirty = true;
    private heatDirty = true;
    private markerDirty = true;
    private connectionDirty = true;
    private textures = new Set<THREE.Texture>();
    private motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    private selection = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0015, 6, 40), new THREE.MeshBasicMaterial({ color: '#81d0dd' }));
    private onError: (error: MapError) => void;

    constructor(onError: (error: MapError) => void) { this.onError = onError; }

    initialize(container: HTMLElement): void {
        if (this.renderer || this.disposed) return;
        this.container = container;
        try {
            this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.setClearColor('#0b141c', 1);
            const canvas = this.renderer.domElement;
            canvas.tabIndex = 0;
            canvas.setAttribute('role', 'group');
            canvas.setAttribute('aria-label', 'Interactive Earth. Drag to rotate, scroll to zoom, or use arrow keys and plus or minus. Search countries or use the flat map to select countries with a keyboard.');
            container.appendChild(canvas);
            this.controls = new OrbitControls(this.camera, canvas);
            this.controls.enablePan = false;
            this.controls.enableDamping = !this.motion.matches;
            this.controls.dampingFactor = 0.12;
            this.controls.minDistance = 1.18;
            this.controls.maxDistance = 5;
            this.controls.rotateSpeed = 0.5;
            this.controls.addEventListener('change', this.onControlsChange);
            this.motion.addEventListener('change', this.onMotionChange);
            canvas.addEventListener('pointerdown', this.onPointerDown);
            canvas.addEventListener('pointerup', this.onPointerUp);
            canvas.addEventListener('pointermove', this.onPointerMove);
            canvas.addEventListener('pointerleave', this.onPointerLeave);
            canvas.addEventListener('keydown', this.onKeyDown);
            canvas.addEventListener('webglcontextlost', this.onContextLost);
            this.scene.add(this.earth);
            this.scene.add(new THREE.AmbientLight('#d2e2ed', 1.1));
            const sun = new THREE.DirectionalLight('#fff5dc', 2.1);
            sun.position.set(3, 2, 2);
            this.scene.add(sun);
            this.countryCanvas.width = 2048; this.countryCanvas.height = 1024;
            this.countryTexture.colorSpace = THREE.SRGBColorSpace;
            this.heatTexture.colorSpace = THREE.SRGBColorSpace;
            this.countryOverlay.scale.setScalar(1.002);
            this.heatOverlay.scale.setScalar(1.004);
            this.heatOverlay.visible = false;
            this.selection.visible = false;
            this.scene.add(this.countryOverlay, this.heatOverlay, this.markerGroup, this.investigationGroup, this.connections, this.selection);
            this.addGraticule();
            this.loadEarthTextures();
            this.resetView();
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(container);
            this.resize();
            this.animationFrame = requestAnimationFrame(this.render);
        } catch {
            this.dispose();
            throw new Error('3D rendering unavailable');
        }
    }

    private loadEarthTextures() {
        const loader = new THREE.TextureLoader();
        const load = (url: URL, apply: (texture: THREE.Texture) => void) => {
            loader.load(url.href, texture => {
                if (this.disposed) { texture.dispose(); return; }
                this.textures.add(texture);
                texture.anisotropy = Math.min(8, this.renderer?.capabilities.getMaxAnisotropy() ?? 1);
                apply(texture); this.earthMaterial.needsUpdate = true; this.dirty = true;
            }, undefined, () => {
                if (!this.disposed) this.onError({ code: 'RENDERER', message: 'Earth surface imagery could not load. Country boundaries are still available.', recoverable: true });
            });
        };
        load(new URL('./assets/earth-day.jpg', import.meta.url), texture => { texture.colorSpace = THREE.SRGBColorSpace; this.earthMaterial.map = texture; this.earthMaterial.color.set('#ffffff'); });
        load(new URL('./assets/earth-normal.jpg', import.meta.url), texture => { this.earthMaterial.normalMap = texture; this.earthMaterial.normalScale.set(0.35, 0.35); });
        load(new URL('./assets/earth-specular.jpg', import.meta.url), texture => { this.earthMaterial.specularMap = texture; });
    }

    private addGraticule() {
        const vertices: number[] = [];
        for (let latitude = -60; latitude <= 60; latitude += 30) {
            for (let longitude = -180; longitude < 180; longitude += 2) vertices.push(...latLngToVector3(latitude, longitude, 1.001).toArray(), ...latLngToVector3(latitude, longitude + 2, 1.001).toArray());
        }
        for (let longitude = -180; longitude < 180; longitude += 30) {
            for (let latitude = -90; latitude < 90; latitude += 2) vertices.push(...latLngToVector3(latitude, longitude, 1.001).toArray(), ...latLngToVector3(latitude + 2, longitude, 1.001).toArray());
        }
        const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        this.scene.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#a3c0ce', transparent: true, opacity: 0.12 })));
    }

    private setCountries(countries: CountryFeature[]) {
        for (const border of this.borders.values()) { this.scene.remove(border); border.geometry.dispose(); border.material.dispose(); }
        this.borders.clear();
        this.pickCountry = createCountryPicker(countries);
        for (const country of countries) {
            const vertices: number[] = [];
            const polygons = country.geometry.type === 'Polygon' ? [country.geometry.coordinates] : country.geometry.coordinates;
            for (const polygon of polygons) for (const ring of polygon) for (let index = 1; index < ring.length; index++) {
                const start: [number, number] = [ring[index - 1][0], ring[index - 1][1]];
                const end: [number, number] = [ring[index][0], ring[index][1]];
                const interpolate = geoInterpolate(start, end);
                const steps = Math.max(1, Math.ceil(geoDistance(start, end) / (Math.PI / 180)));
                for (let step = 0; step < steps; step++) {
                    const a = interpolate(step / steps); const b = interpolate((step + 1) / steps);
                    vertices.push(...latLngToVector3(a[1], a[0], 1.003).toArray(), ...latLngToVector3(b[1], b[0], 1.003).toArray());
                }
            }
            const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            const border = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#a6bbc1', transparent: true, opacity: 0.34 }));
            this.borders.set(country.id, border); this.scene.add(border);
        }
        this.countryDirty = true;
    }

    update(props: RendererProps): void {
        const previous = this.props;
        this.props = props;
        if (previous?.countries !== props.countries) this.setCountries(props.countries);
        if (previous?.events !== props.events) { this.markerDirty = true; this.heatDirty = true; this.connectionDirty = true; }
        if (previous?.activity !== props.activity || previous?.selectedCountryId !== props.selectedCountryId || previous?.hoveredCountryId !== props.hoveredCountryId || previous?.countryFilter !== props.countryFilter) this.countryDirty = true;
        if (previous?.investigations !== props.investigations) this.updateInvestigations();
        this.markerGroup.visible = props.displayMode === 'events';
        this.heatOverlay.visible = props.displayMode === 'heatmap';
        this.connections.visible = props.showConnections && props.displayMode === 'events';
        if (this.arrows) this.arrows.visible = this.connections.visible;
        this.updateSelection();
        if (props.focus && previous?.focus !== props.focus) this.focusCoordinate(props.focus.latitude, props.focus.longitude, props.focus.zoom);
        if (props.viewCommand && previous?.viewCommand !== props.viewCommand) {
            if (props.viewCommand.action === 'reset') this.resetView();
            else this.zoomBy(props.viewCommand.action === 'in' ? 0.8 : 1.25);
        }
        this.dirty = true;
    }

    setEvents(events: NormalizedThreatEvent[]): void { if (this.props) this.update({ ...this.props, events }); }
    setSelectedEvent(selectedEventId: string | null): void { if (this.props) this.update({ ...this.props, selectedEventId }); }
    setSelectedCountry(selectedCountryId: string | null): void { if (this.props) this.update({ ...this.props, selectedCountryId }); }
    setConnectionsVisible(showConnections: boolean): void { if (this.props) this.update({ ...this.props, showConnections }); }

    private paintCountries() {
        const props = this.props;
        const context = this.countryCanvas.getContext('2d');
        if (!props || !context) return;
        context.clearRect(0, 0, 2048, 1024);
        const path = geoPath(geoEquirectangular().scale(2048 / (2 * Math.PI)).translate([1024, 512]), context);
        for (const country of props.countries) {
            const selected = country.id === props.selectedCountryId;
            const hovered = country.id === props.hoveredCountryId;
            const value = props.activity.get(country.id);
            const dimmed = !!props.countryFilter && country.id !== props.countryFilter;
            const border = this.borders.get(country.id);
            if (border) {
                border.material.color.set(selected || hovered ? '#8bd6e2' : value ? SEVERITY_COLORS[value.severity] : '#a6bbc1');
                border.material.opacity = dimmed ? 0.14 : selected || hovered ? 0.95 : value ? 0.65 : 0.34;
            }
            if (!selected && !hovered && !value && !dimmed) continue;
            context.globalAlpha = selected ? 0.35 : hovered ? 0.23 : dimmed ? 0.38 : 0.17;
            context.fillStyle = selected || hovered ? '#62c2d6' : dimmed ? '#06121c' : SEVERITY_COLORS[value!.severity];
            context.beginPath(); path(country); context.fill();
        }
        context.globalAlpha = 1;
        this.countryTexture.needsUpdate = true;
        this.countryDirty = false;
    }

    private materialFor(color: string) {
        let material = this.dotMaterials.get(color);
        if (!material) { material = new THREE.MeshBasicMaterial({ color }); this.dotMaterials.set(color, material); }
        return material;
    }

    private removeMarker(marker: MarkerObject) {
        this.markerGroup.remove(marker.object);
        if (marker.object instanceof THREE.Sprite) { marker.object.material.map?.dispose(); marker.object.material.dispose(); }
    }

    private makeClusterSprite(cluster: ThreatCluster): THREE.Sprite {
        const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 96;
        const context = canvas.getContext('2d')!;
        context.beginPath(); context.arc(48, 48, 41, 0, Math.PI * 2);
        context.fillStyle = '#162b37'; context.fill(); context.lineWidth = 4; context.strokeStyle = SEVERITY_COLORS[cluster.severity]; context.stroke();
        context.fillStyle = '#edf4f6'; context.font = 'bold 30px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
        context.fillText(cluster.count > 999 ? `${(cluster.count / 1000).toFixed(1)}k` : String(cluster.count), 48, 50);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: true, transparent: true }));
    }

    private updateMarkers() {
        if (!this.props) return;
        const cell = Math.max(1.5, Math.round((this.camera.position.length() - 1) * 3));
        if (!this.markerDirty && this.clusterCell === cell) return;
        this.clusterCell = cell; this.markerDirty = false;
        const clusters = clusterThreatEvents(this.props.events, cell);
        const ids = new Set(clusters.map(cluster => cluster.id));
        for (const [id, marker] of this.markers) if (!ids.has(id)) { this.removeMarker(marker); this.markers.delete(id); }
        for (const cluster of clusters) {
            let marker = this.markers.get(cluster.id);
            if (marker && (marker.count !== cluster.count || marker.cluster.severity !== cluster.severity)) { this.removeMarker(marker); this.markers.delete(cluster.id); marker = undefined; }
            if (!marker) {
                const object = cluster.count > 1 ? this.makeClusterSprite(cluster) : new THREE.Mesh(this.dotGeometry, this.materialFor(SEVERITY_COLORS[cluster.severity]));
                marker = { object, count: cluster.count, cluster };
                this.markerGroup.add(object); this.markers.set(cluster.id, marker);
            }
            marker.cluster = cluster;
            marker.object.position.copy(latLngToVector3(cluster.latitude, cluster.longitude, 1.012));
            marker.object.scale.setScalar(cluster.count > 1 ? Math.max(0.025, (this.camera.position.length() - 1) * 0.035) : cluster.severity === 'critical' ? 0.010 : 0.007);
        }
        this.dirty = true;
    }

    private updateConnections() {
        if (!this.props) return;
        const events = this.props.events.filter(event => event.destination);
        const segments = 32;
        const positions = new Float32Array(events.length * segments * 6);
        const colors = new Float32Array(positions.length);
        if (!this.arrows || this.arrows.instanceMatrix.count < events.length) {
            if (this.arrows) { this.scene.remove(this.arrows); this.arrows.dispose(); }
            this.arrows = new THREE.InstancedMesh(this.arrowGeometry, this.arrowMaterial, Math.max(16, events.length));
            this.arrows.frustumCulled = false;
            this.scene.add(this.arrows);
        }
        this.arrows.count = events.length;
        this.arrows.visible = this.connections.visible;
        const arrow = new THREE.Object3D();
        const up = new THREE.Vector3(0, 1, 0);
        events.forEach((event, index) => {
            const source: [number, number] = [event.source.longitude, event.source.latitude];
            const target: [number, number] = [event.destination!.longitude, event.destination!.latitude];
            const interpolate = geoInterpolate(source, target);
            const height = Math.min(0.32, geoDistance(source, target) * 0.18);
            const position = (t: number) => { const point = interpolate(t); return latLngToVector3(point[1], point[0], 1.009 + Math.sin(Math.PI * t) * height); };
            const color = new THREE.Color(SEVERITY_COLORS[event.severity]);
            for (let step = 0; step < segments; step++) {
                const offset = (index * segments + step) * 6;
                position(step / segments).toArray(positions, offset); position((step + 1) / segments).toArray(positions, offset + 3);
                color.toArray(colors, offset); color.toArray(colors, offset + 3);
            }
            arrow.position.copy(position(0.82));
            const direction = position(0.84).sub(position(0.80)).normalize();
            arrow.quaternion.setFromUnitVectors(up, direction.lengthSq() > 0 ? direction : up);
            arrow.updateMatrix(); this.arrows!.setMatrixAt(index, arrow.matrix);
        });
        this.arrows.instanceMatrix.needsUpdate = true;
        this.connectionGeometry.dispose();
        this.connectionGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)).setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.connections.geometry = this.connectionGeometry;
        this.connectionDirty = false;
    }

    private updateInvestigations() {
        for (const object of [...this.investigationGroup.children]) {
            if (object instanceof THREE.Mesh) object.geometry.dispose();
            this.investigationGroup.remove(object);
        }
        for (const point of this.props?.investigations ?? []) {
            const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.008), this.materialFor('#85c1be'));
            marker.position.copy(latLngToVector3(point.latitude, point.longitude, 1.008));
            this.investigationGroup.add(marker);
        }
    }

    private updateSelection() {
        const event = this.props?.events.find(event => event.id === this.props?.selectedEventId);
        this.selection.visible = !!event;
        if (event) {
            const normal = latLngToVector3(event.source.latitude, event.source.longitude);
            this.selection.position.copy(normal.clone().multiplyScalar(1.018));
            this.selection.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        }
    }

    focusCoordinate(latitude: number, longitude: number, zoom = 3): void {
        const distance = Math.max(1.18, Math.min(5, 1 + 2.25 / Math.sqrt(zoom)));
        this.camera.position.copy(latLngToVector3(latitude, longitude, distance));
        this.camera.lookAt(0, 0, 0); this.controls?.update(); this.dirty = true;
    }
    focusEvent(event: NormalizedThreatEvent): void { this.focusCoordinate(event.source.latitude, event.source.longitude, 5); }
    focusCountry(id: string): void { const country = this.props?.countries.find(country => country.id === id); if (country) { const point = countryFocus(country); this.focusCoordinate(point.latitude, point.longitude, 3); } }
    resetView(): void { this.focusCoordinate(20, 20, 1); }
    private zoomBy(factor: number) { this.camera.position.setLength(Math.min(5, Math.max(1.18, this.camera.position.length() * factor))); this.controls?.update(); this.dirty = true; }

    resize(): void {
        if (!this.container || !this.renderer) return;
        const { width, height } = this.container.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height); this.dirty = true;
    }

    private pick(x: number, y: number) {
        if (!this.renderer) return {};
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const earthHit = this.raycaster.intersectObject(this.earth)[0];
        if (this.markerGroup.visible) {
            const hits = this.raycaster.intersectObjects(this.markerGroup.children, false);
            const hit = hits.find(hit => !earthHit || hit.distance < earthHit.distance + 0.02);
            if (hit) { const marker = [...this.markers.values()].find(marker => marker.object === hit.object); if (marker) return { cluster: marker.cluster }; }
        }
        if (!earthHit) return {};
        const point = vectorToLatLng(earthHit.point);
        return { country: this.pickCountry(point.longitude, point.latitude) };
    }

    private onControlsChange = () => { this.dirty = true; };
    private onMotionChange = () => { if (this.controls) this.controls.enableDamping = !this.motion.matches; };
    private onContextLost = (event: Event) => { event.preventDefault(); this.onError({ code: 'RENDERER', message: '3D view lost its graphics context. The flat map remains available.', recoverable: false }); };
    private onPointerDown = (event: PointerEvent) => { this.pointerDown = { x: event.clientX, y: event.clientY }; };
    private onPointerMove = (event: PointerEvent) => { this.pointerPosition = { x: event.clientX, y: event.clientY }; };
    private onPointerLeave = () => { this.pointerPosition = null; this.hoverId = null; this.props?.onCountryHover(null); };
    private onPointerUp = (event: PointerEvent) => {
        const down = this.pointerDown; this.pointerDown = null;
        if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
        const result = this.pick(event.clientX, event.clientY);
        if (result.cluster) {
            if (result.cluster.count === 1) this.props?.onEventSelect(result.cluster.events[0]);
            else { this.props?.onClusterSelect(result.cluster); const distance = this.camera.position.length(); this.focusCoordinate(result.cluster.latitude, result.cluster.longitude, (2.25 / Math.max(0.18, distance * 0.72 - 1)) ** 2); }
        } else if (result.country) this.props?.onCountrySelect(result.country.id);
    };
    private onKeyDown = (event: KeyboardEvent) => {
        const point = vectorToLatLng(this.camera.position);
        const distance = this.camera.position.length();
        const offsets: Record<string, [number, number]> = { ArrowLeft: [0, -10], ArrowRight: [0, 10], ArrowUp: [10, 0], ArrowDown: [-10, 0] };
        const offset = offsets[event.key];
        if (offset) {
            event.preventDefault(); this.camera.position.copy(latLngToVector3(Math.max(-85, Math.min(85, point.latitude + offset[0])), point.longitude + offset[1], distance)); this.controls?.update(); this.dirty = true;
        } else if (event.key === '+' || event.key === '=') { event.preventDefault(); this.zoomBy(0.8); }
        else if (event.key === '-') { event.preventDefault(); this.zoomBy(1.25); }
    };

    private render = () => {
        if (this.disposed || !this.renderer) return;
        this.controls?.update();
        if (this.props) {
            if (this.countryDirty) { this.paintCountries(); this.dirty = true; }
            if (this.heatDirty && this.props.displayMode === 'heatmap') { paintHeatmap(this.heatCanvas, this.props.events); this.heatTexture.needsUpdate = true; this.heatDirty = false; this.dirty = true; }
            if (this.props.displayMode === 'events') this.updateMarkers();
            if (this.connectionDirty && this.connections.visible) { this.updateConnections(); this.dirty = true; }
        }
        if (this.pointerPosition) {
            const result = this.pick(this.pointerPosition.x, this.pointerPosition.y);
            const countryId = result.country?.id ?? null;
            if (countryId !== this.hoverId) { this.hoverId = countryId; this.props?.onCountryHover(countryId); }
            this.renderer.domElement.style.cursor = result.country || result.cluster ? 'pointer' : 'grab';
            this.pointerPosition = null;
        }
        if (this.dirty) { this.renderer.render(this.scene, this.camera); this.dirty = false; }
        this.animationFrame = requestAnimationFrame(this.render);
    };

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true; cancelAnimationFrame(this.animationFrame); this.resizeObserver?.disconnect();
        this.controls?.removeEventListener('change', this.onControlsChange); this.controls?.dispose();
        this.motion.removeEventListener('change', this.onMotionChange);
        const canvas = this.renderer?.domElement;
        canvas?.removeEventListener('pointerdown', this.onPointerDown); canvas?.removeEventListener('pointerup', this.onPointerUp);
        canvas?.removeEventListener('pointermove', this.onPointerMove); canvas?.removeEventListener('pointerleave', this.onPointerLeave);
        canvas?.removeEventListener('keydown', this.onKeyDown); canvas?.removeEventListener('webglcontextlost', this.onContextLost);
        const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>();
        this.scene.traverse(object => {
            if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Sprite) {
                if ('geometry' in object) geometries.add(object.geometry);
                for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                    materials.add(material);
                    if ('map' in material && material.map instanceof THREE.Texture) this.textures.add(material.map);
                }
            }
        });
        geometries.add(this.sphereGeometry); geometries.add(this.dotGeometry); geometries.add(this.arrowGeometry); geometries.add(this.connectionGeometry);
        materials.add(this.arrowMaterial); materials.add(this.connectionMaterial);
        for (const material of this.dotMaterials.values()) materials.add(material);
        for (const geometry of geometries) geometry.dispose();
        for (const material of materials) material.dispose();
        this.textures.add(this.countryTexture); this.textures.add(this.heatTexture);
        for (const texture of this.textures) texture.dispose();
        this.arrows?.dispose(); this.renderer?.dispose(); this.renderer?.forceContextLoss(); canvas?.remove();
        this.scene.clear(); this.borders.clear(); this.markers.clear(); this.props = null;
    }
}
