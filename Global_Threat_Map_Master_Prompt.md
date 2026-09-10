I want to completely remove the current `globe.gl` implementation from the Global Threat Map and rebuild the map implementation from scratch.

## FILES TO MODIFY

Primary files:

* `CyberThreatMap.tsx`
* `CyberThreatMap.css`

You may inspect the existing project structure and related files only when necessary to understand existing data flow, socket events, types, geographic data, API usage, or reusable components.

Do not unnecessarily modify unrelated files.

---

# 1. MAIN OBJECTIVE

Completely remove `globe.gl` from the Global Threat Map.

Do NOT try to preserve, patch, or extend the existing `globe.gl` rendering architecture.

The new map implementation must be independent from `globe.gl`.

Remove all of the following from the map implementation:

* `Globe from 'globe.gl'`
* `Globe()`
* all `globe.gl` methods
* all `globe.gl` specific lifecycle handling
* all `globe.gl` specific camera handling
* all `globe.gl` specific arc rendering
* all `globe.gl` specific point rendering
* all `globe.gl` specific ring rendering
* all `globe.gl` specific object caching
* all old globe rendering helpers that exist only for `globe.gl`

Do not leave commented-out old `globe.gl` code.

If `globe.gl` is no longer used anywhere else in the project, remove its dependency from the relevant package configuration. Before doing so, inspect the project to make sure it is not required by another component.

---

# 2. IMPORTANT PRESERVATION RULE

I am rebuilding the VISUALIZATION ENGINE, not rebuilding the entire application.

Do NOT destroy or replace the existing CTI backend integration.

Preserve existing functionality and data flow including, where applicable:

* `ThreatData`
* existing threat data types
* `ExtendedThreatData`
* existing threat socket
* `threatMapSocket`
* existing API requests
* existing live threat events
* existing filters
* existing severity values
* existing threat types
* existing timestamps
* existing source coordinates
* destination coordinates when they actually exist
* existing click handlers
* existing loading states
* existing error handling
* existing navigation behavior
* existing parent component contracts
* existing live threat feed
* existing threat statistics

Only replace the old map rendering layer.

The new map must consume the same underlying CTI data.

---

# 3. BEFORE EDITING

Before changing the implementation, inspect:

* `CyberThreatMap.tsx`
* `CyberThreatMap.css`
* `package.json`
* package lock file if relevant
* existing map related components
* existing geographic data
* GeoJSON files
* TopoJSON files
* country boundary data
* existing threat socket implementation
* existing threat API responses
* existing geographic utilities
* existing TypeScript types

Understand how the current application receives and stores threat events.

Do not invent APIs, fields, database values, or socket messages that do not exist.

If geographic data already exists in the project, reuse it.

If no geographic data exists, choose an appropriate local geographic data approach that fits the current project architecture.

Do not add a large unnecessary dependency without first checking whether the project already contains something suitable.

---

# 4. NEW MAP ARCHITECTURE

Build the map as a completely new geographic visualization system.

The new system must support:

1. 3D Globe
2. 2D Flat World Map
3. Real country polygons
4. Accurate country boundaries
5. Threat markers
6. Attack connections
7. Heatmap
8. Country selection
9. Country hover
10. Country intelligence
11. Event details
12. Time range filtering
13. Live / Pause
14. Map search
15. Event clustering
16. Threat filters
17. Country filter
18. Fullscreen
19. Zoom controls
20. Threat legend
21. Live threat feed
22. Node statistics

The user must be able to switch between:

`3D Globe` ↔ `2D Flat Map`

without losing the current threat state or filter state.

---

# 5. DESIGN PHILOSOPHY

The visual priority must be:

REAL GEOGRAPHY FIRST
DATA CLARITY SECOND
ANALYST WORKFLOW THIRD
CYBER VISUAL EFFECTS FOURTH

The map must look like a serious Cyber Threat Intelligence platform.

Do NOT make it look like a fictional cyberpunk website.

Avoid:

* excessive neon
* excessive glow
* huge green halos
* glowing fake continents
* excessive particles
* futuristic fantasy Earth textures
* random country colors
* excessive animations
* visual effects that reduce geographic clarity
* decorative effects that compete with threat information

Use restrained cyber styling only where it improves usability.

The geographic information must remain the dominant visual element.

---

# 6. REALISTIC 3D GLOBE

The 3D Globe must NOT use `globe.gl`.

Use a suitable custom rendering solution compatible with the current React application.

The Earth should look realistic rather than like a glowing cyber object.

The 3D globe should have:

* realistic continent shapes
* accurate country geography
* accurate coastlines
* realistic oceans
* natural land appearance
* subtle terrain
* directional day/night lighting
* subtle atmosphere
* optional city lights where appropriate
* optional cloud layer if performance allows
* subtle geographic grid
* professional lighting

Do not overuse:

* cyan glow
* green atmosphere
* bloom
* giant halos
* particle storms
* fake sci-fi textures

The globe should feel like Earth with CTI data overlaid on top.

---

# 7. 2D FLAT WORLD MAP

Build a proper 2D flat world map using real country polygons.

The map must contain:

* all available country polygons
* accurate country boundaries
* coastlines
* continents
* oceans
* threat activity
* event markers
* optional connections
* heatmap
* country highlighting

Every country should be individually selectable.

Inactive countries should have a neutral dark appearance.

Do NOT randomly color countries.

Country coloring should represent actual state or interaction only.

Suggested visual hierarchy:

Normal:
dark neutral

Hovered:
slightly brighter

Selected:
cyan highlight

Threat activity:
subtle intensity overlay

Critical:
red

High:
orange

Medium:
yellow

Low:
subtle highlight

Countries with no threat activity should remain neutral.

---

# 8. COUNTRY POLYGONS

Country interaction must be polygon based.

Do NOT represent countries using only:

* center points
* circles
* labels
* markers

The actual geographic polygon must be selectable.

On hover:

* highlight the country boundary or polygon
* display country name
* display a compact tooltip
* display available threat activity information

On click:

open the Country Intelligence panel.

Country selection must work on both:

* 2D Flat Map
* 3D Globe

where the chosen rendering technology supports it.

---

# 9. COUNTRY INTELLIGENCE PANEL

When the user selects a country, show a Country Intelligence panel.

Only display values that can be derived from actual application data.

Possible fields:

* Country
* Region
* Threat Count
* Critical
* High
* Medium
* Low
* Top Threat Types
* Recent Events
* Source Count
* Destination Count

Do NOT fabricate values.

Do NOT use placeholder intelligence that looks real.

If a particular field does not exist in the backend data, hide it.

---

# 10. COUNTRY FILTER

When a country is selected, allow the user to filter intelligence by that country.

Provide:

`Clear Country Filter`

The selected country should remain visibly highlighted.

The rest of the world should remain visible but de-emphasized.

Do not completely remove unrelated countries unless necessary for an existing filtering behavior.

The country filter must affect:

* map events
* heatmap
* threat feed
* event statistics
* country intelligence
* event list

Everything should use the same filtered dataset.

---

# 11. COUNTRY DRILLDOWN

Support this analyst flow where the data exists:

`Global → Country → Region → Event`

Provide contextual breadcrumbs where useful.

Example:

`Global / Malaysia / Southeast Asia / Event`

Do NOT invent region mappings.

If region metadata does not exist in the available backend data:

* hide the region level
* or disable it

Do not fabricate region information just to populate the interface.

---

# 12. THREAT EVENT DATA

Threat events must use real coordinates from the application data.

Source coordinates should be shown exactly as provided.

If destination coordinates exist:

render:

`SOURCE → DESTINATION`

If destination coordinates do NOT exist:

do not invent a destination.

The existing application may use monitoring sensors or visualization-only endpoints for source-only events.

Do not present those as actual victims.

Clearly distinguish between:

* Source
* Destination
* Monitoring Sensor
* Visualization-only endpoint

Never represent a visualization convention as confirmed intelligence.

---

# 13. THREAT MARKERS

Preserve the existing threat types where available:

* DDoS
* Phishing
* Malware
* SQL Injection
* Brute Force
* other existing threat categories

Preserve severity values:

* low
* medium
* high
* critical

Marker styling must clearly communicate severity.

Critical events should have the strongest visual emphasis.

Low severity should remain subtle.

Do not use excessive animation.

---

# 14. ATTACK CONNECTIONS

Add:

`Show Connections`

and

`Hide Connections`

When enabled:

show directional connections between actual source and destination locations.

When disabled:

hide connection lines.

Only use real source and destination information.

Do NOT generate:

* random routes
* random destinations
* fake attack paths

Do not connect unrelated events simply to make the map look busy.

---

# 15. EVENTS / HEATMAP MODE

Provide:

`Events`
`Heatmap`

Events mode:

show individual threat events.

Heatmap mode:

aggregate threat activity geographically.

The heatmap must be generated from real threat coordinates.

Do not generate synthetic hotspots.

The same filtered threat dataset must drive both modes.

---

# 16. LIVE / PAUSE

Provide:

`LIVE`
`PAUSE`

LIVE:

* receive new events
* update map
* update statistics
* update threat feed

PAUSE:

* stop visual updates
* retain current events
* retain current map state
* retain current filters

Do not destroy currently displayed threat data when paused.

When LIVE is resumed, continue using the existing socket/data flow.

---

# 17. TIME RANGE

Add a time range selector:

* 15M
* 1H
* 6H
* 24H
* 7D
* CUSTOM

The time filter must affect the SAME underlying threat dataset used by:

* 3D Globe
* 2D Flat Map
* Events mode
* Heatmap mode
* threat feed
* country intelligence
* event details
* statistics

Do not create separate datasets for each UI mode.

For CUSTOM:

provide a usable date and time range selector.

---

# 18. SEARCH

Add map search supporting:

* IP
* Domain
* IOC
* Country
* City

Search must use existing application data or existing backend functionality where available.

Do not create fake search responses.

If a matching geographic object exists:

* focus the map on it
* highlight it
* show the related intelligence

If nothing matches:

show a clear empty state.

---

# 19. EVENT DETAILS

Clicking an event must open an Event Details panel.

Show fields only when available:

* Threat Type
* Severity
* Timestamp
* Source
* Source Country
* Source Latitude
* Source Longitude
* Destination
* Destination Country
* Destination Latitude
* Destination Longitude
* IOC
* Identifier
* Related information

Do NOT invent values.

The event panel must clearly communicate which values are:

* known
* unavailable
* derived

Do not make unavailable values look like real intelligence.

---

# 20. EVENT CLUSTERING

When many threat events are located close together:

cluster them.

A cluster should show:

* event count
* geographic position

When clicking a cluster:

* zoom into the region
* expand or reveal the events

Do not allow thousands of individual markers to overwhelm the map.

Clustering must remain performant during live updates.

---

# 21. EXISTING THREAT FILTERS

Preserve the current filters:

* ALL
* DDOS
* PHISHING
* MALWARE
* SQL INJECTION
* BRUTE FORCE

Do not remove them.

Ensure these filters work in:

* 3D Globe
* 2D Flat Map
* Events mode
* Heatmap mode
* Live Threat Feed

The selected threat filter must remain synchronized across all views.

---

# 22. LIVE THREAT FEED

Preserve the existing Live Threat Feed.

The feed must use the SAME filtered dataset displayed on the map.

When clicking an event in the feed:

* select the corresponding event
* focus the map where possible
* open Event Details where appropriate

Do not create a duplicate fake dataset specifically for the feed.

---

# 23. NODE STATISTICS

Preserve the existing Node Statistics concept.

Only display values derived from actual application state or backend data.

Possible values include:

* Feed Status
* Active Events
* Active Nodes
* Current Threat Level

Do NOT leave hard-coded fake statistics that appear to be live intelligence.

If a value cannot be reliably calculated, do not display fake numbers.

---

# 24. MAP CONTROLS

Provide clear controls for:

* Zoom In
* Zoom Out
* Reset View
* 3D Globe / 2D Flat Map
* Events / Heatmap
* Live / Pause
* Show / Hide Connections
* Time Range
* Fullscreen

Controls must be:

* visually clear
* compact
* accessible
* keyboard accessible

Add tooltips where useful.

---

# 25. THREAT LEGEND

Provide a compact threat legend.

Explain the severity levels:

* Low
* Medium
* High
* Critical

Also explain map symbols where necessary.

Do not let the legend dominate the interface.

---

# 26. FULLSCREEN

Add a fullscreen button.

Fullscreen mode should allow the map to occupy the available viewport.

The following should remain usable in fullscreen:

* map controls
* filters
* legend
* event selection
* country selection
* time range
* fullscreen toggle

The map must resize correctly when entering and exiting fullscreen.

---

# 27. MAP SEARCH / LOCATION FOCUS

When a country, city, IP, domain, or IOC resolves to geographic information:

focus the current map view on the relevant location.

In 2D:

pan / zoom appropriately.

In 3D:

rotate / move the camera appropriately.

Do not reset unrelated filter state.

The current selected event/country should remain synchronized.

---

# 28. STATE SYNCHRONIZATION

Switching between:

`3D Globe`
and
`2D Flat Map`

must not reset:

* threat type filter
* severity filter
* time range
* country filter
* selected country
* selected event
* event mode
* heatmap mode
* connection visibility
* live/pause state
* search state where appropriate

The map mode is only a visualization mode.

It must not create a second application state.

---

# 29. ONE SOURCE OF TRUTH

There must be one authoritative threat dataset/state.

Do NOT maintain separate independent datasets for:

* globe
* flat map
* heatmap
* threat feed
* country panel
* statistics

Use derived filtered views from the same underlying state.

This is important for consistency.

---

# 30. PERFORMANCE

Performance is extremely important.

Do NOT reinitialize the entire map every time:

* a new event arrives
* a filter changes
* a country is selected
* the time range changes
* a UI state changes

Separate:

1. Map initialization
2. Geographic data
3. Threat state
4. UI state
5. Rendering updates

Use efficient rendering and memoization where appropriate.

Avoid unnecessary React renders.

Avoid unnecessary recreation of geographic polygons.

Avoid unnecessary DOM nodes.

Use Canvas / WebGL / SVG appropriately based on the chosen implementation.

The map must remain responsive when live events are continuously arriving.

---

# 31. MAP INITIALIZATION

Initialize the selected map engine only when required.

Do not recreate the renderer whenever ordinary application state changes.

Use proper React lifecycle management.

Clean up:

* event listeners
* observers
* timers
* animation frames
* socket subscriptions if owned by this component
* rendering resources

Avoid memory leaks.

---

# 32. RESPONSIVE DESIGN

Desktop:

* large central map
* Live Threat Feed panel
* Node Statistics panel
* map controls
* threat legend

Tablet:

* adaptive panels
* compact controls
* reduced secondary information

Mobile:

* map remains usable
* panels become collapsible
* controls remain accessible
* no horizontal overflow
* no broken dimensions
* no unusable tiny map viewport

---

# 33. ACCESSIBILITY

All important controls must support:

* keyboard navigation
* visible focus
* readable labels
* sufficient contrast
* accessible buttons
* accessible tooltips where appropriate

Respect:

`prefers-reduced-motion`

When reduced motion is enabled:

* reduce marker animation
* reduce connection animation
* reduce transitions
* disable decorative motion

Core intelligence functionality must remain available.

---

# 34. VISUAL STYLE

Use the current LekirraX design language as the foundation, but improve the map itself.

Preferred characteristics:

* dark professional interface
* realistic geography
* subtle cyan accents
* restrained severity colors
* clean typography
* clear hierarchy
* analyst-focused layout

Do not create:

* excessive cyberpunk styling
* excessive glowing borders
* massive neon effects
* fake sci-fi atmosphere
* randomly glowing countries

The result should look like an actual CTI analysis product.

---

# 35. CSS REBUILD

Completely remove CSS that only existed for the old `globe.gl` implementation.

Do not leave obsolete selectors.

Remove old styles related to:

* globe.gl canvas assumptions
* old globe containers
* unused globe animations
* unused pulse effects
* obsolete arc classes
* obsolete ring classes
* obsolete rendering helpers

Reorganize the CSS around the new architecture.

Suggested sections:

```text
Map Wrapper
Map Viewport
3D Globe
2D Flat Map
Country Polygons
Threat Events
Connections
Heatmap
Map Controls
Time Controls
Live Controls
Search
Threat Legend
Live Feed
Node Statistics
Country Intelligence
Event Details
Fullscreen
Responsive
Reduced Motion
```

Keep the CSS maintainable and avoid excessive `!important` unless genuinely necessary.

---

# 36. TYPESCRIPT QUALITY

Use proper TypeScript types.

Avoid `any` unless absolutely necessary.

Do not leave:

* unused imports
* unused state
* unused refs
* unused functions
* dead variables
* commented-out implementation
* debug logging
* temporary test code

Use meaningful names.

Keep components and helper functions reasonably modular.

---

# 37. DATA ACCURACY

This is a CTI application.

Do not fabricate intelligence.

Never fabricate:

* attack destinations
* countries
* regions
* cities
* IP information
* threat counts
* severity
* timestamps
* IOC values
* attack paths
* country statistics

Use actual backend/application data.

If information does not exist:

show:

`Unavailable`

or hide the field.

Never make fake information look real.

---

# 38. GEOGRAPHIC ACCURACY

Country boundaries must come from real geographic data.

Do not manually draw approximate countries.

Do not use random polygons.

Do not use simplified shapes that make countries incorrect unless the selected map technology inherently requires an acceptable simplification.

The 2D Flat Map must have individually selectable countries.

The 3D Globe should also visually respect real country boundaries where supported by the selected implementation.

---

# 39. MAP DATA CONSISTENCY

The following must all use the same source of truth:

* 3D Globe
* 2D Flat Map
* Events mode
* Heatmap
* Country Intelligence
* Event Details
* Live Threat Feed
* Node Statistics
* Country Filter
* Time Filter
* Threat Type Filter
* Severity Filter

Changing one filter must consistently update all relevant views.

---

# 40. ERROR HANDLING

Handle:

* geographic data loading failure
* invalid coordinates
* missing destination
* missing country information
* empty threat data
* socket failure
* API failure
* renderer failure

Do not crash the entire page.

Show useful user-facing states such as:

* Loading map...
* No threat data available
* Geographic data unavailable
* Live feed disconnected
* No matching event
* No country data available

Do not display raw technical errors to normal users unless appropriate.

---

# 41. LOADING STATE

The map should have a clean loading state while geographic data or renderer resources are initializing.

Do not display excessive animated cyber effects.

A simple professional loader is preferred.

---

# 42. SOCKET / LIVE DATA

Do not replace the existing live socket architecture unnecessarily.

Continue using the existing threat socket/data flow.

Make the visualization react to incoming events.

Avoid reinitializing the entire map every time a new event arrives.

Only update the affected data/rendering state.

---

# 43. CLEANUP OF OLD IMPLEMENTATION

After the new implementation works:

remove all old `globe.gl` related code.

There should be no remaining:

* `Globe`
* `Globe()`
* `globe.gl`
* old globe-specific helper functions
* old globe-specific refs
* old globe-specific rendering structures
* old globe-specific CSS

Do not leave a partially migrated implementation.

---

# 44. DO NOT OVERENGINEER

Do not add unnecessary:

* backend changes
* database changes
* new API endpoints
* authentication changes
* unrelated dependencies
* UI systems
* state management libraries

This task is specifically to rebuild the Global Threat Map visualization.

Keep the implementation focused.

---

# 45. FINAL VALIDATION

After implementation, verify all of the following.

## Globe

* `globe.gl` is completely removed
* no `Globe()` remains
* no old globe.gl methods remain
* 3D Globe works
* Earth looks realistic
* map can rotate / navigate
* zoom works
* reset works

## Flat Map

* 2D Flat Map works
* real country polygons are displayed
* country boundaries are accurate
* every country is individually selectable
* hover works
* click works
* selected country is highlighted

## Threat Data

* real threat events appear
* source coordinates are correct
* destination is shown only when actually available
* no fake destinations are introduced
* severity is preserved
* threat type is preserved
* timestamps are preserved

## Filters

* ALL
* DDOS
* PHISHING
* MALWARE
* SQL INJECTION
* BRUTE FORCE

All work correctly.

## Time

* 15M
* 1H
* 6H
* 24H
* 7D
* CUSTOM

All work correctly.

## Modes

* Events
* Heatmap
* Show Connections
* Hide Connections
* Live
* Pause

All work correctly.

## Intelligence

* Event Details works
* Country Intelligence works
* Country Filter works
* Clear Country Filter works
* Search works where data exists
* Drilldown works where metadata exists

## UI

* Live Threat Feed remains functional
* Node Statistics remain functional
* Threat Legend exists
* Fullscreen works
* responsive behavior works
* keyboard accessibility works
* reduced-motion support works

## Performance

* no unnecessary map reinitialization
* no obvious memory leaks
* no excessive React renders
* no major lag from live events
* map remains usable with many threat events

## Code

* no unused imports
* no dead code
* no debug logging
* no obsolete `globe.gl` code
* no obsolete CSS
* no obvious TypeScript errors
* no obvious console errors

---

# 46. FINAL DESIGN STANDARD

The final result should feel like:

A professional Cyber Threat Intelligence geographic analysis platform.

It should NOT feel like:

A generic globe demo.

It should NOT feel like:

A cyberpunk animation.

It should NOT feel like:

A fake intelligence dashboard.

The final visual hierarchy should follow:

REAL GEOGRAPHY FIRST
THREAT DATA SECOND
ANALYST INTERACTION THIRD
DECORATIVE CYBER EFFECTS LAST

Accuracy, usability, performance, and real geographic representation are more important than visual effects.

Build the new map implementation cleanly from the ground up.

Do not preserve the old `globe.gl` architecture.

# APPROVED RENDERING STACK

Use the following rendering stack for the new Global Threat Map.

## Primary Rendering Engine

**Three.js**

Use Three.js as the primary rendering engine for the 3D Globe.

Requirements:

* Native Three.js scene
* Perspective camera
* WebGL renderer
* Proper Earth sphere
* Texture based Earth rendering
* Directional lighting
* Camera controls
* Real geographic overlays
* Threat markers rendered as Three.js objects
* Attack connections rendered using Three.js geometry
* Efficient object management

Do NOT use:

* `globe.gl`
* `react-globe.gl`
* any wrapper around `globe.gl`

The 3D Globe must be built directly with Three.js.

---

# 2D FLAT MAP

Use:

**SVG + React**

for the 2D Flat World Map.

Country boundaries must come from real geographic data.

Preferred geographic data format:

**GeoJSON**

Use actual country polygons.

Requirements:

* each country is an independent SVG path
* hoverable
* clickable
* selectable
* highlightable
* threat activity can be overlaid
* country boundaries remain visually accurate

Do NOT manually draw country boundaries.

Do NOT use approximate rectangles or placeholder polygons.

---

# GEOGRAPHIC DATA

Use the project's existing geographic dataset when available.

Preferred order:

1. Existing project GeoJSON / geographic dataset
2. Existing local TopoJSON dataset
3. A suitable local country boundary dataset already compatible with the project

The geographic data should be bundled/local where practical.

Do not make the core map dependent on a remote map service.

Do not introduce Google Maps.

Do not introduce Google Earth.

Do not introduce a proprietary map SDK unless absolutely required.

---

# 3D COUNTRY BOUNDARIES

The 3D Globe and 2D Flat Map must use the same underlying geographic country data.

For the 3D Globe:

convert geographic coordinates from the GeoJSON country polygons into Three.js coordinates on the Earth sphere.

Country borders may be rendered using:

* `THREE.Line`
* `THREE.LineLoop`
* `THREE.LineSegments`

or another native Three.js geometry approach.

Country polygons can also be used for interaction where appropriate.

Do not create an unrelated country dataset specifically for the 3D globe.

---

# THREAT MARKERS

Use native Three.js objects for the 3D Globe.

Suitable approaches include:

* `THREE.Mesh`
* `THREE.Sprite`
* `THREE.Points`
* InstancedMesh where appropriate

Marker rendering should depend on event count and performance.

Do not create unnecessary DOM elements for thousands of events.

For the 2D map, use SVG elements or another lightweight 2D rendering approach appropriate to the event count.

---

# ATTACK CONNECTIONS

3D:

Use native Three.js geometry.

Examples:

* `THREE.Line`
* `THREE.LineBasicMaterial`
* `THREE.LineCurve3`
* `THREE.CatmullRomCurve3`

Connections must follow real source → destination coordinates.

Do not generate random attack paths.

2D:

Use SVG paths or an equivalent lightweight vector representation.

Connections should remain directional and visually clear.

---

# HEATMAP

For the 2D Flat Map:

Use a canvas based or SVG based implementation depending on performance requirements.

For the 3D Globe:

Render heat intensity as a geographic overlay projected onto the Earth.

Prefer efficient GPU/canvas based rendering when event density becomes high.

Do not install a separate large heatmap framework unless the existing project genuinely requires it.

---

# CLUSTERING

Use a lightweight client side clustering approach.

The clustering implementation must work from the real threat coordinates.

Do not create fake aggregate events.

Clusters should contain:

* latitude
* longitude
* event count
* underlying event references where necessary

Clicking a cluster should zoom into the geographic area.

---

# CAMERA / CONTROLS

Use:

**Three.js camera + OrbitControls**

for the 3D Globe.

Required behavior:

* rotate
* zoom
* optional pan where appropriate
* reset view
* smooth but restrained interaction

Do not recreate the renderer when React state changes.

---

# 2D MAP INTERACTION

Use standard React + SVG interaction.

Support:

* mouse hover
* click
* zoom
* pan
* country selection
* country highlighting
* location focus

Use a stable geographic projection.

Do not distort country geometry unnecessarily.

---

# PROJECTION

For the 2D Flat Map, use a geographic projection compatible with GeoJSON.

A suitable projection library may be used if the project does not already have one.

Preferred approach:

**D3 geographic projection utilities**

Use D3 only for geographic projection / path generation where useful.

Do not use D3 to replace the entire application architecture.

Three.js remains the 3D rendering engine.

React remains responsible for the UI/application state.

---

# APPROVED STACK SUMMARY

Use this architecture:

```text
React
│
├── Application State
│   ├── Threat Data
│   ├── Filters
│   ├── Time Range
│   ├── Country Selection
│   ├── Event Selection
│   ├── Live / Pause
│   └── Map Mode
│
├── 3D Globe
│   └── Three.js
│       ├── WebGLRenderer
│       ├── Scene
│       ├── Camera
│       ├── OrbitControls
│       ├── Earth
│       ├── Country Boundaries
│       ├── Threat Markers
│       ├── Connections
│       └── Heatmap Overlay
│
└── 2D Flat Map
    └── React + SVG
        ├── GeoJSON
        ├── Geographic Projection
        ├── Country Polygons
        ├── Threat Markers
        ├── Connections
        └── Heatmap
```

---

# STRICTLY PROHIBITED

Do NOT use:

* `globe.gl`
* `react-globe.gl`
* Google Maps
* Google Earth
* Mapbox GL
* MapLibre
* Leaflet for the primary 3D Globe
* Cesium
* a hosted map iframe
* an external map website
* a proprietary map SDK

Do not replace Three.js with another 3D globe framework.

Do not replace the SVG based flat map with a completely different mapping platform.

---

# DEPENDENCY RULE

Before installing anything:

1. inspect `package.json`
2. inspect existing dependencies
3. reuse existing libraries where possible
4. only add a dependency when it provides a clear requirement for the approved rendering stack

Expected core additions, only when not already present:

```text
three
@types/three
```

For geographic projection:

```text
d3-geo
```

only when required and not already available.

Do not add dependencies simply because they are popular.

---

# ARCHITECTURE RULE

Keep rendering completely separate from application state.

The architecture should conceptually be:

```text
Threat Data
     ↓
Filtering / Transformation
     ↓
Normalized Geographic Threat State
     ↓
 ┌───────────────┬───────────────┐
 ↓               ↓
3D Globe      2D Flat Map
Three.js       React + SVG
```

Both map modes must consume the same normalized data.

Do not create separate threat logic for the globe and flat map.

---

# PERFORMANCE RULES

Three.js:

* reuse geometries where possible
* reuse materials where possible
* dispose resources correctly
* avoid recreating the scene unnecessarily
* use instancing for large event counts where beneficial
* update only changed objects

SVG:

* avoid unnecessary React re-renders
* memoize country paths where appropriate
* use efficient event handling
* avoid creating excessive DOM nodes

Large datasets should degrade gracefully.

---

# LOCAL FIRST

The Global Threat Map should primarily operate from:

* local application code
* local geographic data
* existing CTI backend data
* existing WebSocket data

Do not make map rendering dependent on:

* Google services
* Google Search
* Tor
* external map iframes
* live commercial map APIs

The CTI application should remain locally deployable.

---

# FINAL REQUIREMENT

This rendering stack is APPROVED and should be treated as a hard architectural constraint.

Do not switch to another rendering engine because it is easier.

Use:

**Three.js for 3D Globe**

**React + SVG + GeoJSON for 2D Flat Map**

**D3 geographic utilities only where required for projection/path conversion**

**Existing LekirraX backend and threat socket for real CTI data**

The implementation must remain independent from `globe.gl`.

# NORMALIZED THREAT DATA CONTRACT

Before rendering anything on the map, normalize all incoming threat data into ONE consistent internal structure.

The map rendering layer must NOT depend directly on different backend response formats.

The architecture must be:

```text
Backend / WebSocket / API
        ↓
Existing Raw Threat Data
        ↓
Normalization Layer
        ↓
NormalizedThreatEvent
        ↓
Filters / Time Range / Country Filter
        ↓
 ┌─────────────┬─────────────┬─────────────┐
 │             │             │             │
3D Globe     2D Map       Heatmap       Threat Feed
```

The `NormalizedThreatEvent` object becomes the single source of truth for all map visualization and geographic intelligence.

---

# 1. REQUIRED TYPES

Create a strongly typed normalized structure similar to:

```ts
export interface GeographicPoint {
    latitude: number;
    longitude: number;
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
}

export interface NormalizedThreatEvent {
    id: string;

    type: string;

    severity: 'low' | 'medium' | 'high' | 'critical';

    timestamp: string;

    source: GeographicPoint;

    destination?: GeographicPoint;

    ioc?: string;

    identifier?: string;

    metadata?: Record<string, unknown>;
}
```

The exact field names may be adapted to the existing application's TypeScript conventions, but the semantic structure must remain equivalent.

Do NOT blindly replace the existing `ThreatData` interface if other parts of the application depend on it.

Instead, introduce the normalized representation at the visualization boundary.

---

# 2. EVENT ID

Every normalized event MUST have a stable unique:

```ts
id: string
```

The ID must be deterministic and must remain unchanged during:

* filtering
* sorting
* clustering
* rendering
* map mode switching
* event selection

Do not generate a new random ID every render.

Do not use array indexes as event IDs.

---

# 3. THREAT TYPE

The normalized event must contain:

```ts
type: string
```

Preserve the actual threat type from the backend.

Existing supported examples include:

* DDoS
* Phishing
* Malware
* SQL Injection
* Brute Force

Do not silently convert unknown threat types into a fake category.

Unknown but valid backend types should remain available as their original value.

For UI filtering, normalize casing consistently while preserving the display name where appropriate.

---

# 4. SEVERITY

Severity MUST be normalized to exactly:

```ts
'low' | 'medium' | 'high' | 'critical'
```

Backend values must be converted into this internal format only when a reliable mapping exists.

Do NOT invent severity.

If the backend provides an unknown or missing severity:

do not automatically assume `critical`, `high`, or another value.

Handle the unavailable/unknown case explicitly in the normalization process if the existing application permits it.

Do not make unknown severity appear to be confirmed intelligence.

---

# 5. TIMESTAMP

Every normalized event should contain:

```ts
timestamp: string
```

Prefer the original backend timestamp.

Do not replace the original event time with the browser's current time.

The timestamp must be usable for:

* 15M filtering
* 1H filtering
* 6H filtering
* 24H filtering
* 7D filtering
* CUSTOM filtering
* chronological sorting
* event feed display

Use a consistently parseable timestamp format.

If the source timestamp cannot be parsed reliably, handle that event safely rather than inventing a timestamp.

---

# 6. SOURCE LOCATION

Every event requires a source location when geographic coordinates are available:

```ts
source: {
    latitude: number;
    longitude: number;
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
}
```

Requirements:

* latitude must be between `-90` and `90`
* longitude must be between `-180` and `180`

Validate coordinates before rendering.

Invalid coordinates must not be sent into the map renderer.

Do not silently replace invalid coordinates with:

```text
0, 0
```

unless `0,0` is actually provided by the backend and known to be valid data.

---

# 7. SOURCE COUNTRY

When the backend provides country information, preserve it.

Possible values:

```ts
country?: string;
countryCode?: string;
```

Do not derive or guess the country from coordinates inside the rendering layer unless an existing trusted geographic lookup already exists in the application.

The normalized object should preferably contain the country metadata before rendering.

---

# 8. REGION

Region is OPTIONAL.

```ts
region?: string;
```

Only populate it when the actual data source provides reliable region information.

Do NOT create artificial mappings such as:

```text
Malaysia → Southeast Asia
Germany → Europe
```

just to populate the UI.

If the region is unavailable:

```ts
region: undefined
```

The UI must gracefully hide or disable region-based functionality.

---

# 9. CITY

City is OPTIONAL.

```ts
city?: string;
```

Only populate it when the backend or a trusted existing geographic source provides it.

Do not infer a city from approximate coordinates inside the rendering layer unless a trusted existing lookup service is part of the application.

---

# 10. DESTINATION

Destination is OPTIONAL.

```ts
destination?: GeographicPoint;
```

This field MUST only exist when an actual destination is available from the source data.

Example:

```ts
destination: {
    latitude: 3.139,
    longitude: 101.6869,
    country: "Malaysia",
    countryCode: "MY"
}
```

If destination information does not exist:

```ts
destination: undefined
```

DO NOT:

* generate random destinations
* use random monitoring nodes
* use the nearest country
* use the nearest sensor
* create fake victim locations
* connect source events to arbitrary locations

A missing destination means the event is source-only.

---

# 11. MONITORING SENSOR

If the existing application uses a monitoring sensor for visualization of source-only events, DO NOT store it as:

```ts
destination
```

Instead, represent it separately if required.

Example:

```ts
monitoringSensor?: GeographicPoint;
```

A monitoring sensor must never be presented as:

* actual victim
* confirmed destination
* attack target

The UI must clearly distinguish:

```text
Source
Destination
Monitoring Sensor
```

---

# 12. IOC

IOC information is OPTIONAL.

Use:

```ts
ioc?: string;
```

Only populate this field when an actual IOC exists.

Possible examples:

* IP
* domain
* URL
* hash
* email
* other existing IOC value

Do not manufacture an IOC from a random identifier.

---

# 13. IDENTIFIER

Optional backend or intelligence identifier:

```ts
identifier?: string;
```

Examples may include:

* alert ID
* incident ID
* event ID
* source record ID

Preserve the original value when available.

Do not overwrite the stable normalized `id` unless the existing backend contract explicitly requires it.

---

# 14. METADATA

Additional source-specific information may be retained under:

```ts
metadata?: Record<string, unknown>;
```

Use this for information that is useful but does not belong in the core geographic schema.

Examples:

```ts
metadata: {
    protocol: "...",
    port: 443,
    sourceName: "...",
    confidence: "...",
}
```

Do NOT move critical fields into arbitrary metadata when they are required by the map.

Important filtering and geographic fields must remain strongly typed.

---

# 15. NORMALIZATION RULES

Create a normalization function such as:

```ts
function normalizeThreatEvent(
    rawEvent: unknown
): NormalizedThreatEvent | null
```

The normalization function must:

1. validate the incoming structure
2. extract the event ID
3. normalize threat type
4. normalize severity
5. normalize timestamp
6. normalize source coordinates
7. normalize destination coordinates when available
8. preserve country information
9. preserve region information when available
10. preserve city information when available
11. preserve IOC information when available
12. preserve the original metadata where useful
13. reject invalid geographic events safely

Invalid events should return:

```ts
null
```

or be handled through an equivalent safe mechanism.

Do not crash the entire map because one event has malformed data.

---

# 16. NORMALIZATION MUST HAPPEN BEFORE RENDERING

Do NOT perform raw backend field interpretation independently inside:

* 3D Globe renderer
* 2D renderer
* Heatmap
* Cluster logic
* Country Intelligence
* Event Details
* Threat Feed

All rendering components must consume:

```ts
NormalizedThreatEvent
```

This ensures every view interprets threat data identically.

---

# 17. FILTERING

Filtering must operate on normalized events.

Example conceptual flow:

```ts
const normalizedEvents = rawEvents
    .map(normalizeThreatEvent)
    .filter(Boolean);

const filteredEvents = normalizedEvents.filter(event => {
    // threat type
    // severity
    // time range
    // country
});
```

Do not implement different filtering logic for the 3D and 2D map.

---

# 18. TIME FILTERING

Time filtering must use:

```ts
event.timestamp
```

from the normalized contract.

Example:

```text
NOW - 15 minutes
NOW - 1 hour
NOW - 6 hours
NOW - 24 hours
NOW - 7 days
CUSTOM RANGE
```

Do not depend on the order in which events arrived.

Do not use array position as a time indicator.

---

# 19. COUNTRY FILTERING

Country filtering should use normalized geographic metadata.

Prefer:

```ts
event.source.countryCode
```

when available.

If destination country filtering is supported, use:

```ts
event.destination?.countryCode
```

Do not compare country names inconsistently across different components.

Use a normalized country code where available.

---

# 20. CLUSTERING

Clustering must operate on normalized geographic coordinates:

```ts
event.source.latitude
event.source.longitude
```

or destination coordinates where the UX specifically requires destination clustering.

The cluster must reference the original normalized event IDs.

Example:

```ts
interface ThreatCluster {
    id: string;
    latitude: number;
    longitude: number;
    eventIds: string[];
    count: number;
}
```

Do not create synthetic threat events for clusters.

A cluster is a visualization structure only.

---

# 21. HEATMAP

The heatmap must derive its positions from:

```ts
NormalizedThreatEvent
```

Do not create independent heatmap data that can become inconsistent with the event dataset.

The heatmap must use the currently filtered events.

---

# 22. EVENT DETAILS

Event Details must receive the selected normalized event directly.

Example:

```ts
const selectedEvent: NormalizedThreatEvent | null
```

Do not reconstruct the selected event from rendered map objects.

This guarantees that the Event Details panel displays the same data used by the map.

---

# 23. COUNTRY INTELLIGENCE

Country statistics must be derived from normalized events.

Examples:

```text
Threat Count
Critical Count
High Count
Medium Count
Low Count
Top Threat Types
Source Count
Destination Count
Recent Events
```

Do not hard-code these statistics.

Do not maintain a separate fake country dataset.

---

# 24. LIVE SOCKET EVENTS

Incoming WebSocket events must pass through the SAME normalization function.

Conceptually:

```text
WebSocket Event
      ↓
normalizeThreatEvent()
      ↓
NormalizedThreatEvent
      ↓
existing threat state
      ↓
filters
      ↓
map / feed / statistics
```

Do not create a special normalized structure only for live events.

Historical/API events and live socket events should converge into the same internal contract.

---

# 25. DEDUPLICATION

The normalized event ID must be used to prevent accidental duplication.

If the same event arrives from multiple channels:

* WebSocket
* API refresh
* initial load

the application should avoid rendering duplicate copies when they represent the same underlying event.

Do not deduplicate based solely on array position.

Use the stable event identifier whenever available.

---

# 26. IMMUTABILITY

Normalized event objects should be treated as immutable application data.

Do not mutate event coordinates or severity directly inside render functions.

Example:

DO NOT:

```ts
event.source.latitude = ...
```

Instead derive transformed rendering coordinates separately.

This is especially important because the same normalized event is shared by:

* Globe
* Flat Map
* Heatmap
* Feed
* Event Details

---

# 27. RENDERING ADAPTERS

The normalized contract should be independent of the rendering engine.

Conceptually:

```text
NormalizedThreatEvent
        │
        ├── Three.js Adapter
        │
        ├── SVG Adapter
        │
        ├── Heatmap Adapter
        │
        └── Cluster Adapter
```

The rendering layer should convert geographic coordinates into its required coordinate system.

Do not modify the normalized data to suit Three.js.

Do not modify the normalized data to suit SVG.

---

# 28. DATA VALIDATION

Validate at minimum:

```text
id exists
type exists
severity is valid
timestamp is parseable
source exists
source latitude is valid
source longitude is valid
destination coordinates are valid when destination exists
```

If a destination exists but has invalid coordinates:

do not render the destination connection.

Do not replace it with a random coordinate.

---

# 29. UNKNOWN / MISSING DATA

Missing information must remain missing.

Examples:

```ts
country: undefined
region: undefined
city: undefined
destination: undefined
ioc: undefined
```

The UI should display a clean unavailable state where appropriate.

Do not use values such as:

```text
Unknown Country
Unknown Region
0.0000, 0.0000
Fake Destination
N/A
```

unless the UI intentionally uses a presentation label rather than modifying the underlying normalized data.

---

# 30. BACKWARD COMPATIBILITY

The existing application currently has its own threat data structure.

Do not unnecessarily rename or delete existing interfaces used elsewhere.

The recommended approach is:

```text
Existing ThreatData
        ↓
normalizeThreatEvent()
        ↓
NormalizedThreatEvent
```

This allows the new map implementation to remain compatible with the rest of the application.

---

# 31. SINGLE SOURCE OF TRUTH

After normalization, ALL map related functionality must consume the normalized dataset.

That includes:

* 3D Globe
* 2D Flat Map
* threat markers
* connections
* heatmap
* clustering
* threat feed
* event details
* country intelligence
* country filtering
* time filtering
* severity filtering
* threat type filtering
* statistics
* search results

There must not be multiple competing interpretations of the same event.

---

# 32. FINAL CONTRACT

The final internal contract should conceptually follow:

```ts
interface GeographicPoint {
    latitude: number;
    longitude: number;
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
}

interface NormalizedThreatEvent {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;

    source: GeographicPoint;

    destination?: GeographicPoint;

    ioc?: string;
    identifier?: string;

    metadata?: Record<string, unknown>;
}
```

The implementation may extend this structure only when an actual existing application requirement justifies the additional field.

Do not add speculative fields.

The normalized contract must remain small, predictable, strongly typed, and rendering-engine independent.

---

# 33. FINAL VALIDATION

Before considering the map implementation complete, verify:

* every rendered event originates from `NormalizedThreatEvent`
* all API events pass through normalization
* all WebSocket events pass through normalization
* source coordinates are validated
* destination coordinates are validated
* invalid events do not crash the map
* no renderer modifies normalized event data
* all filters use normalized data
* heatmap uses normalized data
* clustering uses normalized data
* country intelligence uses normalized data
* event details use normalized data
* live feed uses normalized data
* 3D and 2D views use the same normalized dataset
* no fake geographic data is introduced
* no fake destinations are introduced
* no fake threat statistics are introduced
* switching map modes does not change the underlying normalized events

The normalized threat data contract is the authoritative internal data model for the new Global Threat Map.

# REAL TYPESCRIPT NORMALIZATION IMPLEMENTATION

Implement the normalized threat data contract with actual TypeScript code.

Do NOT leave this as pseudocode.

The normalization layer must be implemented and used by the new Global Threat Map.

---

# 1. NORMALIZED TYPES

Create strongly typed internal types.

Use this as the baseline:

```ts
export type NormalizedSeverity =
    | 'low'
    | 'medium'
    | 'high'
    | 'critical';

export interface GeographicPoint {
    latitude: number;
    longitude: number;
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
}

export interface NormalizedThreatEvent {
    id: string;
    type: string;
    severity: NormalizedSeverity;
    timestamp: string;

    source: GeographicPoint;

    destination?: GeographicPoint;

    ioc?: string;
    identifier?: string;

    metadata?: Record<string, unknown>;
}
```

Do not use `any` for the normalized contract.

---

# 2. NORMALIZATION FUNCTION

Implement a real function:

```ts
function normalizeThreatEvent(
    rawEvent: unknown
): NormalizedThreatEvent | null
```

The function must:

* validate the input
* extract a stable event ID
* normalize threat type
* normalize severity
* normalize timestamp
* normalize source coordinates
* normalize destination coordinates when available
* preserve geographic metadata
* preserve IOC information
* preserve identifiers
* safely preserve additional metadata
* return `null` for invalid events

Do not throw an uncaught exception because one backend event is malformed.

---

# 3. TYPE GUARDS

Create small type guard/helper functions instead of using unsafe casts everywhere.

Example:

```ts
function isRecord(
    value: unknown
): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
```

Use proper runtime checks before reading properties from `unknown`.

Do not do this:

```ts
const event = rawEvent as any;
```

Do not blindly trust backend payloads.

---

# 4. NUMERIC VALIDATION

Implement a helper:

```ts
function toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
}
```

Use it for geographic coordinates and numeric fields where required.

---

# 5. COORDINATE VALIDATION

Implement:

```ts
function normalizeGeographicPoint(
    value: unknown
): GeographicPoint | null
```

Validate:

```text
latitude >= -90
latitude <= 90

longitude >= -180
longitude <= 180
```

Reject invalid coordinates.

Do NOT silently convert invalid values into:

```text
0, 0
```

Do NOT create replacement coordinates.

---

# 6. SUPPORT EXISTING DATA STRUCTURE

The current application already has an existing threat structure.

Do NOT blindly delete or replace it.

The existing data may contain fields such as:

```ts
interface ThreatData {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
    source: {
        lat: number;
        lng: number;
        country: string;
    };
    destination?: {
        lat: number;
        lng: number;
        country: string;
    };
}
```

Adapt the normalization function to the ACTUAL structure discovered in the project.

Do not assume the above structure is identical to the final backend payload.

The goal is:

```text
Existing ThreatData
        ↓
normalizeThreatEvent()
        ↓
NormalizedThreatEvent
```

---

# 7. FIELD MAPPING

Create an explicit mapping from the existing backend representation into the normalized representation.

For example:

```ts
const normalized: NormalizedThreatEvent = {
    id,
    type,
    severity,
    timestamp,
    source: {
        latitude: sourceLatitude,
        longitude: sourceLongitude,
        country: sourceCountry,
        countryCode: sourceCountryCode,
        region: sourceRegion,
        city: sourceCity,
    },
    destination,
    ioc,
    identifier,
    metadata,
};
```

Do not scatter field conversions throughout the renderer.

All raw-to-normalized conversion must happen in the normalization layer.

---

# 8. SEVERITY NORMALIZATION

Create a helper:

```ts
function normalizeSeverity(
    value: unknown
): NormalizedSeverity | null
```

It should handle the actual severity values used by the project.

For example, case differences may be normalized:

```text
LOW
low
Low
```

into:

```text
low
```

Likewise:

```text
MEDIUM
HIGH
CRITICAL
```

must normalize consistently.

Do not map unknown values arbitrarily to `critical`.

Return `null` for unsupported severity values unless the existing application has an explicitly defined mapping.

---

# 9. THREAT TYPE NORMALIZATION

Create:

```ts
function normalizeThreatType(
    value: unknown
): string | null
```

Preserve the original semantic threat type.

Examples:

```text
DDoS
Phishing
Malware
SQL Injection
Brute Force
```

Filtering may use a normalized comparison key, but do not unnecessarily destroy the display value.

Do not convert unknown valid threat types into:

```text
Other
Unknown
Generic Attack
```

unless the existing application explicitly requires that behavior.

---

# 10. TIMESTAMP NORMALIZATION

Create:

```ts
function normalizeTimestamp(
    value: unknown
): string | null
```

The normalized timestamp must be reliably parseable by JavaScript:

```ts
Date.parse(timestamp)
```

Prefer preserving the original timestamp where it is already valid.

Do NOT replace historical event timestamps with:

```ts
new Date().toISOString()
```

The map must represent the actual event time.

---

# 11. DESTINATION NORMALIZATION

Destination must be optional.

Use:

```ts
const destination = normalizeGeographicPoint(
    rawDestination
);
```

When no valid destination exists:

```ts
destination: undefined
```

Do NOT generate:

* random destination
* nearest sensor
* nearest monitoring node
* random country
* random city

The absence of a destination must remain an absence of destination data.

---

# 12. SOURCE NORMALIZATION

Source location is required for an event to become a map event.

If the event has no valid source coordinates:

return:

```ts
null
```

The renderer must not receive malformed geographic data.

Example:

```ts
const source = normalizeGeographicPoint(rawSource);

if (!source) {
    return null;
}
```

---

# 13. STABLE EVENT ID

Use the existing backend ID whenever available.

Only create a deterministic fallback when there is a legitimate existing identifier that can be used to uniquely identify the event.

Do NOT do:

```ts
id: crypto.randomUUID()
```

during every normalization call.

That would break:

* deduplication
* selection
* clustering
* React keys
* live updates

The normalized event ID must remain stable.

---

# 14. DEDUPLICATION

Implement deduplication using the normalized event ID.

For example:

```ts
function mergeThreatEvents(
    existing: NormalizedThreatEvent[],
    incoming: NormalizedThreatEvent[]
): NormalizedThreatEvent[] {
    const eventMap = new Map<string, NormalizedThreatEvent>();

    for (const event of existing) {
        eventMap.set(event.id, event);
    }

    for (const event of incoming) {
        eventMap.set(event.id, event);
    }

    return Array.from(eventMap.values());
}
```

Adapt the behavior to the existing application state management.

Do not duplicate the same threat event just because it arrived through:

* initial API load
* periodic refresh
* WebSocket

---

# 15. NORMALIZE COLLECTIONS

Implement:

```ts
function normalizeThreatEvents(
    rawEvents: unknown[]
): NormalizedThreatEvent[] {
    return rawEvents
        .map(normalizeThreatEvent)
        .filter(
            (event): event is NormalizedThreatEvent =>
                event !== null
        );
}
```

The exact implementation can differ, but the result must be strongly typed.

Invalid events should be excluded safely.

---

# 16. LIVE SOCKET NORMALIZATION

Every incoming WebSocket threat event must go through:

```ts
normalizeThreatEvent()
```

Example architecture:

```text
WebSocket
   ↓
raw event
   ↓
normalizeThreatEvent()
   ↓
NormalizedThreatEvent
   ↓
merge into threat state
   ↓
derived filtered state
   ↓
render
```

Do NOT create a separate live-event schema for the map renderer.

---

# 17. API NORMALIZATION

Events loaded from REST/API endpoints must use the SAME normalization function.

Architecture:

```text
API Response
    ↓
normalizeThreatEvents()
    ↓
NormalizedThreatEvent[]
```

This ensures API events and WebSocket events follow the exact same contract.

---

# 18. SINGLE SOURCE OF TRUTH

After normalization, all map functionality must consume:

```ts
NormalizedThreatEvent[]
```

This includes:

* 3D Globe
* 2D Flat Map
* Events mode
* Heatmap
* clustering
* Live Threat Feed
* Event Details
* Country Intelligence
* statistics
* search
* country filtering
* threat type filtering
* severity filtering
* time filtering

Do NOT allow any of these components to directly interpret raw backend payloads.

---

# 19. FILTERING FROM NORMALIZED DATA

Create derived selectors/helpers where appropriate.

Example:

```ts
function filterThreatEvents(
    events: NormalizedThreatEvent[],
    options: {
        threatType?: string;
        severity?: NormalizedSeverity;
        startTime?: number;
        endTime?: number;
        countryCode?: string;
    }
): NormalizedThreatEvent[] {
    return events.filter((event) => {
        // apply normalized filtering
    });
}
```

The exact implementation should match the existing UI state.

Do not duplicate filter logic between globe and flat map.

---

# 20. TIME RANGE FILTERING

Use the normalized timestamp.

Example helper:

```ts
function isEventWithinRange(
    event: NormalizedThreatEvent,
    startTime: number,
    endTime: number
): boolean {
    const eventTime = Date.parse(event.timestamp);

    if (!Number.isFinite(eventTime)) {
        return false;
    }

    return eventTime >= startTime && eventTime <= endTime;
}
```

The same function should be used by all relevant views.

---

# 21. COUNTRY FILTERING

Use normalized country codes where available.

Prefer:

```ts
event.source.countryCode
```

instead of comparing arbitrary country-name strings.

For destination:

```ts
event.destination?.countryCode
```

Do not create multiple inconsistent country comparison implementations.

---

# 22. RENDERER INDEPENDENCE

The normalized data contract MUST NOT contain Three.js-specific information.

Do not add:

```ts
THREE.Vector3
THREE.Object3D
THREE.Mesh
```

to `NormalizedThreatEvent`.

The normalized data model must remain renderer-independent.

Three.js coordinates should be derived only when rendering:

```text
latitude / longitude
        ↓
Three.js coordinate conversion
        ↓
THREE.Vector3
```

Similarly, the 2D map should convert:

```text
latitude / longitude
        ↓
map projection
        ↓
SVG x / y
```

---

# 23. IMMUTABILITY

Treat normalized events as immutable.

Do NOT mutate:

```ts
event.source.latitude
event.source.longitude
event.severity
```

inside renderers.

When additional rendering information is required, derive a separate object.

Example:

```ts
const renderPoint = {
    x,
    y,
    eventId: event.id,
};
```

The source normalized event remains unchanged.

---

# 24. METADATA

Preserve additional source-specific fields without polluting the core contract.

Use:

```ts
metadata?: Record<string, unknown>;
```

Do not move important map fields into metadata.

These should remain strongly typed:

* id
* type
* severity
* timestamp
* source
* destination

---

# 25. VALIDATION BEHAVIOR

Use safe validation.

Cases:

### Valid event

Normalize and return it.

### Missing optional destination

Return event with:

```ts
destination: undefined
```

### Missing country

Return event with country omitted.

### Missing region

Return event with region omitted.

### Invalid source coordinates

Return:

```ts
null
```

### Invalid timestamp

Return:

```ts
null
```

### Invalid severity

Reject unless a trusted existing mapping exists.

### Missing stable ID

Use a deterministic fallback only when safe.

Do not invent intelligence.

---

# 26. CONCRETE IMPLEMENTATION EXAMPLE

Use code structurally similar to this, but adapt field names to the actual project:

```ts
export type NormalizedSeverity =
    | 'low'
    | 'medium'
    | 'high'
    | 'critical';

export interface GeographicPoint {
    latitude: number;
    longitude: number;
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
}

export interface NormalizedThreatEvent {
    id: string;
    type: string;
    severity: NormalizedSeverity;
    timestamp: string;
    source: GeographicPoint;
    destination?: GeographicPoint;
    ioc?: string;
    identifier?: string;
    metadata?: Record<string, unknown>;
}

function isRecord(
    value: unknown
): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function toFiniteNumber(
    value: unknown
): number | null {
    if (
        typeof value === 'number' &&
        Number.isFinite(value)
    ) {
        return value;
    }

    if (
        typeof value === 'string' &&
        value.trim() !== ''
    ) {
        const parsed = Number(value);

        return Number.isFinite(parsed)
            ? parsed
            : null;
    }

    return null;
}

function normalizeSeverity(
    value: unknown
): NormalizedSeverity | null {
    if (typeof value !== 'string') {
        return null;
    }

    const normalized = value
        .trim()
        .toLowerCase();

    switch (normalized) {
        case 'low':
            return 'low';

        case 'medium':
            return 'medium';

        case 'high':
            return 'high';

        case 'critical':
            return 'critical';

        default:
            return null;
    }
}

function normalizeThreatType(
    value: unknown
): string | null {
    if (
        typeof value !== 'string' ||
        value.trim() === ''
    ) {
        return null;
    }

    return value.trim();
}

function normalizeTimestamp(
    value: unknown
): string | null {
    if (typeof value !== 'string') {
        return null;
    }

    const timestamp = value.trim();

    if (!timestamp) {
        return null;
    }

    const parsed = Date.parse(timestamp);

    if (!Number.isFinite(parsed)) {
        return null;
    }

    return new Date(parsed).toISOString();
}

function normalizeGeographicPoint(
    value: unknown
): GeographicPoint | null {
    if (!isRecord(value)) {
        return null;
    }

    const latitude = toFiniteNumber(
        value.latitude ?? value.lat
    );

    const longitude = toFiniteNumber(
        value.longitude ?? value.lng ?? value.lon
    );

    if (
        latitude === null ||
        longitude === null ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }

    return {
        latitude,
        longitude,
        country:
            typeof value.country === 'string' &&
            value.country.trim()
                ? value.country.trim()
                : undefined,
        countryCode:
            typeof value.countryCode === 'string' &&
            value.countryCode.trim()
                ? value.countryCode.trim().toUpperCase()
                : undefined,
        region:
            typeof value.region === 'string' &&
            value.region.trim()
                ? value.region.trim()
                : undefined,
        city:
            typeof value.city === 'string' &&
            value.city.trim()
                ? value.city.trim()
                : undefined,
    };
}

function normalizeThreatEvent(
    rawEvent: unknown
): NormalizedThreatEvent | null {
    if (!isRecord(rawEvent)) {
        return null;
    }

    const id =
        typeof rawEvent.id === 'string'
            ? rawEvent.id.trim()
            : '';

    if (!id) {
        return null;
    }

    const type = normalizeThreatType(
        rawEvent.type
    );

    const severity = normalizeSeverity(
        rawEvent.severity
    );

    const timestamp = normalizeTimestamp(
        rawEvent.timestamp
    );

    const source = normalizeGeographicPoint(
        rawEvent.source
    );

    if (
        !type ||
        !severity ||
        !timestamp ||
        !source
    ) {
        return null;
    }

    const destination =
        rawEvent.destination !== undefined
            ? normalizeGeographicPoint(
                  rawEvent.destination
              )
            : undefined;

    const ioc =
        typeof rawEvent.ioc === 'string' &&
        rawEvent.ioc.trim()
            ? rawEvent.ioc.trim()
            : undefined;

    const identifier =
        typeof rawEvent.identifier === 'string' &&
        rawEvent.identifier.trim()
            ? rawEvent.identifier.trim()
            : undefined;

    return {
        id,
        type,
        severity,
        timestamp,
        source,
        destination,
        ioc,
        identifier,
        metadata: rawEvent.metadata && isRecord(rawEvent.metadata)
            ? rawEvent.metadata
            : undefined,
    };
}
```

IMPORTANT:

Do not copy the example blindly if it conflicts with the actual project's existing data structure.

Inspect the real backend payload first and adapt the field mapping correctly.

---

# 27. NORMALIZATION LOCATION

Prefer keeping normalization logic separate from rendering logic.

Possible structure:

```text
CyberThreatMap.tsx
    ↓
normalization helpers
    ↓
normalized threat state
    ↓
Three.js renderer
    ↓
SVG renderer
```

If adding a small helper file makes the architecture cleaner, such as:

```text
threatNormalization.ts
```

you may create it.

However, do not create unnecessary files if the current project architecture already has a suitable utility location.

---

# 28. NO RAW DATA IN RENDERERS

After normalization is introduced, the renderer should never do things like:

```ts
rawEvent.source.lat
rawEvent.source.lng
rawEvent.destination.lat
```

directly.

Instead use:

```ts
event.source.latitude
event.source.longitude
event.destination?.latitude
event.destination?.longitude
```

This is a strict architectural rule.

---

# 29. FINAL DATA FLOW

The completed implementation should follow:

```text
Existing API / WebSocket
          ↓
Raw Threat Payload
          ↓
Runtime Validation
          ↓
normalizeThreatEvent()
          ↓
NormalizedThreatEvent
          ↓
Deduplication
          ↓
Canonical Threat State
          ↓
Filtering / Time Range / Country
          ↓
Derived Threat Views
          ↓
 ┌────────────┬────────────┬────────────┐
 ↓            ↓            ↓
3D Globe    2D Map      Heatmap
 ↓            ↓            ↓
Feed      Country      Clusters
           /Event
```

Every visual component must ultimately derive from the canonical normalized threat state.

---

# 30. FINAL VALIDATION

Before completing the implementation, verify:

* actual TypeScript normalization code exists
* no normalization pseudocode remains
* no unsafe `any` based parsing exists
* raw API events are validated
* raw WebSocket events are validated
* invalid coordinates are rejected
* invalid timestamps are rejected
* invalid severity values are handled safely
* destination remains optional
* no fake destinations are introduced
* event IDs remain stable
* duplicate events are prevented
* normalized events are immutable
* filters use normalized values
* time filters use normalized timestamps
* country filters use normalized geographic metadata
* clustering uses normalized coordinates
* heatmap uses normalized coordinates
* Event Details uses normalized events
* Country Intelligence uses normalized events
* Live Threat Feed uses normalized events
* 3D Globe uses normalized events
* 2D Flat Map uses normalized events
* no renderer directly parses raw backend payloads
* the normalized contract contains no Three.js-specific types
* TypeScript compilation succeeds
* no obvious runtime errors occur

The normalized threat contract is the canonical internal data model of the new Global Threat Map.

# GLOBAL THREAT MAP IMPLEMENTATION FILE STRUCTURE

Rebuild the Global Threat Map using a modular architecture.

Do NOT place the entire implementation inside `CyberThreatMap.tsx`.

Separate:

* application state
* normalization
* geographic data
* geographic conversion
* Three.js rendering
* 2D SVG rendering
* threat visualization
* clustering
* heatmap
* UI controls
* intelligence panels

The exact folder location must follow the existing project structure. Do not create a completely new application architecture if the project already has an established components/services structure.

---

# 1. TARGET STRUCTURE

Use this structure as the preferred architecture:

```text
src/
└── components/
    └── CyberThreatMap/
        ├── CyberThreatMap.tsx
        ├── CyberThreatMap.css
        │
        ├── types/
        │   └── threatMap.types.ts
        │
        ├── normalization/
        │   └── threatNormalization.ts
        │
        ├── geo/
        │   ├── geographicData.ts
        │   ├── geographicUtils.ts
        │   └── projections.ts
        │
        ├── three/
        │   ├── GlobeRenderer.ts
        │   ├── earth.ts
        │   ├── countryBorders.ts
        │   ├── threatMarkers.ts
        │   ├── threatConnections.ts
        │   └── globeCamera.ts
        │
        ├── flat/
        │   ├── FlatWorldMap.tsx
        │   ├── CountryPolygon.tsx
        │   ├── ThreatMarker2D.tsx
        │   ├── ThreatConnections2D.tsx
        │   └── MapProjection.ts
        │
        ├── visualization/
        │   ├── threatClustering.ts
        │   └── threatHeatmap.ts
        │
        ├── ui/
        │   ├── MapControls.tsx
        │   ├── MapLegend.tsx
        │   ├── MapSearch.tsx
        │   ├── TimeRangeControl.tsx
        │   ├── LiveControl.tsx
        │   ├── ThreatFeed.tsx
        │   ├── NodeStatistics.tsx
        │   ├── CountryIntelligence.tsx
        │   └── EventDetails.tsx
        │
        └── hooks/
            ├── useThreatMapData.ts
            ├── useThreatMapFilters.ts
            ├── useMapResize.ts
            └── useMapFullscreen.ts
```

This is the preferred logical structure.

However, do NOT blindly create every file.

Only create a file when its logic is actually required.

---

# 2. `CyberThreatMap.tsx`

This should become the main orchestration component.

It should NOT contain:

* large Three.js rendering implementation
* geographic conversion utilities
* raw API parsing
* complex clustering algorithms
* large heatmap implementation
* large country polygon rendering logic

It should primarily handle:

* application state
* map mode
* selected event
* selected country
* filters
* time range
* live / pause state
* connections visibility
* events / heatmap mode
* search state
* coordination between child components

Conceptually:

```text
CyberThreatMap
│
├── Map Controls
├── 3D Globe OR 2D Flat Map
├── Threat Feed
├── Node Statistics
├── Country Intelligence
├── Event Details
└── Legend
```

Keep this file readable.

---

# 3. `threatMap.types.ts`

Put shared map-specific types here.

At minimum:

```ts
export type NormalizedSeverity =
    | 'low'
    | 'medium'
    | 'high'
    | 'critical';

export interface GeographicPoint {
    latitude: number;
    longitude: number;
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
}

export interface NormalizedThreatEvent {
    id: string;
    type: string;
    severity: NormalizedSeverity;
    timestamp: string;

    source: GeographicPoint;

    destination?: GeographicPoint;

    ioc?: string;
    identifier?: string;

    metadata?: Record<string, unknown>;
}
```

Also place other shared map types here when required, such as:

```ts
ThreatCluster
MapMode
ThreatDisplayMode
TimeRange
CountryFeature
```

Do not duplicate identical interfaces across different files.

---

# 4. `threatNormalization.ts`

This is the canonical normalization layer.

It should contain:

```ts
normalizeThreatEvent()
normalizeThreatEvents()
normalizeSeverity()
normalizeThreatType()
normalizeTimestamp()
normalizeGeographicPoint()
```

It should also contain validation helpers where appropriate.

Raw backend payloads must enter the map through this layer.

Architecture:

```text
API / WebSocket
      ↓
Raw Threat Data
      ↓
threatNormalization.ts
      ↓
NormalizedThreatEvent
```

No renderer should parse backend fields directly.

---

# 5. `geographicData.ts`

Responsible for loading and exposing the real geographic dataset.

Possible responsibilities:

* GeoJSON loading
* local geographic dataset
* country FeatureCollection
* country metadata
* geographic boundaries

The preferred data source is local project data.

Example conceptual interface:

```ts
export interface CountryFeature {
    id: string;
    name: string;
    countryCode?: string;
    geometry: unknown;
}
```

Adapt this to the actual GeoJSON structure.

Do not create fake country boundaries.

---

# 6. `geographicUtils.ts`

Put reusable geographic conversion utilities here.

Examples:

```ts
latLngToVector3()
normalizeLongitude()
isValidLatitude()
isValidLongitude()
distanceBetweenCoordinates()
```

For example:

```ts
export function latLngToVector3(
    latitude: number,
    longitude: number,
    radius: number
): THREE.Vector3 {
    // convert geographic coordinate
}
```

The exact formula can be implemented based on the globe coordinate convention used by the renderer.

Keep these utilities independent from React.

---

# 7. `projections.ts`

Handle 2D geographic projection.

Preferred approach:

D3 geographic projection utilities where required.

Possible exports:

```ts
createWorldProjection()
projectCoordinate()
```

Do not put projection logic directly inside every country component.

The same projection should be used consistently by:

* country polygons
* threat markers
* connections
* search focus
* heatmap

---

# 8. `GlobeRenderer.ts`

This is the main Three.js rendering engine.

Responsibilities:

* create Three.js scene
* create camera
* create WebGL renderer
* initialize OrbitControls
* create Earth
* add geographic layers
* add threat visualization layers
* resize renderer
* render animation loop
* clean up resources

It should NOT contain React UI logic.

Conceptually:

```text
GlobeRenderer
│
├── Scene
├── Camera
├── Renderer
├── Controls
├── Earth
├── Country Borders
├── Threat Markers
├── Connections
└── Heatmap
```

Do not use:

```text
globe.gl
react-globe.gl
```

---

# 9. `earth.ts`

Responsible only for Earth visual construction.

Possible responsibilities:

* Earth sphere
* Earth textures
* lighting
* atmosphere
* optional cloud layer
* optional city lights
* day/night lighting

Keep it realistic.

Do not put threat data in this file.

Do not mix Earth rendering with CTI state.

---

# 10. `countryBorders.ts`

Responsible for converting geographic country boundaries into Three.js geometry.

Input:

```text
GeoJSON
```

Output:

```text
Three.js country border objects
```

Each country should remain identifiable.

This is important for country selection and highlighting.

Do not combine all countries into one anonymous object if that prevents individual interaction.

---

# 11. `threatMarkers.ts`

Responsible for 3D threat marker rendering.

Input:

```ts
NormalizedThreatEvent[]
```

Responsibilities:

* create/update markers
* update severity appearance
* update selection state
* remove expired/filtered markers
* avoid unnecessary object recreation

Do not parse raw backend events here.

---

# 12. `threatConnections.ts`

Responsible for rendering actual:

```text
SOURCE → DESTINATION
```

connections.

Input:

```ts
NormalizedThreatEvent[]
```

Only events with a real destination should produce attack connections.

Do not create random destinations.

Do not use monitoring sensors as confirmed destinations.

---

# 13. `globeCamera.ts`

Keep camera-related helpers separate.

Possible responsibilities:

* default camera position
* reset view
* focus coordinate
* focus country
* focus event
* zoom handling

For example:

```ts
focusCoordinate(
    latitude: number,
    longitude: number
)
```

The camera should not contain threat filtering logic.

---

# 14. `FlatWorldMap.tsx`

This is the main 2D map component.

Responsibilities:

* render SVG viewport
* render country polygons
* render threat markers
* render connections
* render heatmap layer
* handle map interaction
* handle pan / zoom
* expose country selection

It should consume normalized data.

Architecture:

```text
FlatWorldMap
│
├── CountryPolygon[]
├── ThreatConnections2D
├── ThreatMarker2D[]
└── Heatmap
```

---

# 15. `CountryPolygon.tsx`

Each country should be rendered as an individual selectable geographic polygon.

Props should conceptually include:

```ts
interface CountryPolygonProps {
    feature: CountryFeature;
    selected: boolean;
    hovered: boolean;
    threatLevel?: NormalizedSeverity;
    onHover: ...
    onClick: ...
}
```

Do not hard-code individual countries.

The component must work from geographic data.

---

# 16. `ThreatMarker2D.tsx`

Render individual threat events on the flat map.

Input:

```ts
NormalizedThreatEvent
```

It should:

* convert coordinates through the projection
* render appropriate severity
* support click
* support hover
* support selection

Do not perform raw backend parsing.

---

# 17. `ThreatConnections2D.tsx`

Render source → destination lines on the flat map.

Use normalized coordinates.

Do not connect events without actual destinations.

Keep connections visually subtle.

---

# 18. `MapProjection.ts`

If the project requires a dedicated projection utility, place the shared projection setup here.

It should expose a stable projection used by:

* countries
* events
* connections
* search
* heatmap

Avoid creating a separate projection instance for every country.

---

# 19. `threatClustering.ts`

Clustering is data transformation, not UI.

Input:

```ts
NormalizedThreatEvent[]
```

Output:

```ts
ThreatCluster[]
```

Example:

```ts
export interface ThreatCluster {
    id: string;
    latitude: number;
    longitude: number;
    count: number;
    eventIds: string[];
}
```

The cluster must reference real event IDs.

Never convert a cluster into a fake `NormalizedThreatEvent`.

---

# 20. `threatHeatmap.ts`

Heatmap logic should derive from normalized events.

Input:

```ts
NormalizedThreatEvent[]
```

Output should be suitable for the selected renderer.

Do not create a separate fake dataset.

The heatmap must always represent currently filtered events.

---

# 21. UI COMPONENTS

UI controls should not be tightly coupled to Three.js.

### `MapControls.tsx`

Handles:

* zoom
* reset
* map mode
* events / heatmap
* connections
* fullscreen

### `MapLegend.tsx`

Handles:

* severity legend
* map symbol explanations

### `MapSearch.tsx`

Handles:

* IP search
* domain search
* IOC search
* country search
* city search

### `TimeRangeControl.tsx`

Handles:

* 15M
* 1H
* 6H
* 24H
* 7D
* CUSTOM

### `LiveControl.tsx`

Handles:

* LIVE
* PAUSE

These components should communicate through typed props/callbacks.

Do not let UI components directly manipulate Three.js scenes.

---

# 22. INTELLIGENCE PANELS

Keep intelligence panels independent from rendering.

### `ThreatFeed.tsx`

Receives:

```ts
NormalizedThreatEvent[]
```

### `NodeStatistics.tsx`

Receives derived statistics.

### `CountryIntelligence.tsx`

Receives:

```ts
selectedCountry
countryEvents
```

### `EventDetails.tsx`

Receives:

```ts
NormalizedThreatEvent | null
```

These components should not know whether the event was selected from:

* 3D Globe
* 2D Map
* Threat Feed
* Search

They simply consume the selected normalized event.

---

# 23. CUSTOM HOOKS

Use hooks for non-visual application behaviors.

## `useThreatMapData.ts`

Responsible for:

* API data
* WebSocket data
* normalization
* deduplication
* canonical event state

Conceptually:

```text
API
 ↓
WebSocket
 ↓
normalize
 ↓
deduplicate
 ↓
canonical events
```

Do not put renderer-specific logic here.

---

## `useThreatMapFilters.ts`

Responsible for:

* threat type
* severity
* time range
* country
* derived filtered events

All map views should receive filtered events from the same source.

---

## `useMapResize.ts`

Responsible for:

* ResizeObserver
* renderer dimensions
* map viewport updates

Do not duplicate resize logic in multiple renderers.

---

## `useMapFullscreen.ts`

Responsible for:

* fullscreen state
* enter fullscreen
* exit fullscreen
* resize notification

Keep browser fullscreen APIs out of the rendering engine where practical.

---

# 24. DATA FLOW

The final architecture must look like:

```text
                 Existing Backend
                       │
              API / WebSocket
                       │
                       ▼
              useThreatMapData
                       │
                       ▼
             normalizeThreatEvent
                       │
                       ▼
             Canonical Threat State
                       │
                       ▼
             useThreatMapFilters
                       │
                       ▼
              Filtered Threat Events
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
      Three.js      SVG Map      Heatmap
       Globe
          │            │
          └──────┬─────┘
                 │
                 ▼
          Shared UI State
                 │
       ┌─────────┼──────────┐
       ▼         ▼          ▼
     Feed     Country     Event
              Intel      Details
```

---

# 25. STATE OWNERSHIP

Keep state ownership clear.

`CyberThreatMap.tsx` or appropriate hooks should own:

* map mode
* display mode
* filters
* time range
* country filter
* selected country
* selected event
* live / pause
* connections visibility
* fullscreen
* search

Rendering modules should NOT own duplicate copies of those states.

There should be one source of truth.

---

# 26. THREE.JS LIFECYCLE

Three.js lifecycle must be isolated.

Initialization:

```text
React mount
   ↓
create renderer
   ↓
create scene
   ↓
create camera
   ↓
create Earth
   ↓
create geographic layers
```

Updates:

```text
normalized events change
        ↓
update threat visualization
```

Do NOT:

```text
filter changes
    ↓
destroy entire Three.js scene
    ↓
create new scene
```

The renderer should persist while the component remains mounted.

---

# 27. RESOURCE CLEANUP

When the map unmounts, dispose of:

* renderer
* geometries
* materials
* textures created dynamically
* controls
* animation frames
* event listeners
* resize observers

This is mandatory.

Do not create memory leaks.

---

# 28. FILE CREATION RULE

Do not create every suggested file automatically.

First inspect the existing project.

If the current project already has:

```text
utils/
services/
hooks/
components/
types/
```

reuse those directories where appropriate.

The objective is modularity, not unnecessary file proliferation.

For example, if the project already has a shared:

```text
src/utils/
```

then `threatNormalization.ts` may belong there instead of a new nested directory.

---

# 29. PRIMARY FILES

The final implementation must keep these as the main entry points:

```text
CyberThreatMap.tsx
CyberThreatMap.css
```

Supporting modules can be introduced around them.

The parent component should continue importing `CyberThreatMap` without unnecessary API changes.

---

# 30. DEPENDENCY ARCHITECTURE

Approved rendering stack remains:

```text
React
   │
   ├── Three.js
   │     └── 3D Globe
   │
   ├── SVG
   │     └── 2D Flat Map
   │
   └── D3 geographic utilities
         └── projection/path generation
```

Do not introduce:

* globe.gl
* react-globe.gl
* Mapbox
* MapLibre
* Leaflet
* Cesium
* Google Maps
* Google Earth

The implementation must remain independent of `globe.gl`.

---

# 31. STRICT DEPENDENCY RULE

Before adding dependencies:

1. inspect the existing package configuration
2. check whether the required package already exists
3. reuse existing utilities where possible
4. add only dependencies required by the approved architecture

Do not install unnecessary mapping frameworks.

Expected core rendering dependencies, only if missing:

```text
three
@types/three
```

Possible geographic utility:

```text
d3-geo
```

only if required.

---

# 32. MODULE DEPENDENCY RULE

Keep dependencies flowing in one direction:

```text
Types
  ↑
Normalization
  ↑
Data hooks
  ↑
Visualization
  ↑
UI
  ↑
CyberThreatMap
```

Avoid circular dependencies.

For example:

`threatNormalization.ts`

must not import `CyberThreatMap.tsx`.

`GlobeRenderer.ts`

must not import React UI components.

`CountryIntelligence.tsx`

must not import Three.js renderer internals.

---

# 33. NO RAW BACKEND DATA OUTSIDE NORMALIZATION

After the new architecture is implemented:

Raw backend payloads should only exist in:

* API/socket integration
* normalization boundary

Everything below that boundary should operate on:

```ts
NormalizedThreatEvent
```

This rule is important.

---

# 34. NO THREE.JS TYPES IN APPLICATION DATA

Do not put:

```ts
THREE.Vector3
THREE.Mesh
THREE.Object3D
```

inside:

```ts
NormalizedThreatEvent
```

Geographic data remains:

```ts
latitude
longitude
```

Three.js coordinates are renderer-specific and must be derived inside the Three.js layer.

---

# 35. TESTABILITY

The following modules should ideally be testable without a browser:

* normalization
* coordinate validation
* time filtering
* country filtering
* clustering
* geographic conversion helpers where practical

Do not tightly couple these functions to DOM or WebGL APIs.

---

# 36. FINAL STRUCTURAL VALIDATION

After implementation, verify:

```text
✓ CyberThreatMap.tsx is primarily orchestration
✓ Raw data parsing is isolated
✓ NormalizedThreatEvent is shared
✓ API and WebSocket data use the same normalization
✓ Three.js code is isolated
✓ SVG map code is isolated
✓ Geographic conversion is reusable
✓ Country polygons are independently identifiable
✓ Heatmap logic is separate
✓ Clustering logic is separate
✓ UI controls are separate
✓ Country Intelligence is separate
✓ Event Details is separate
✓ Live Feed is separate
✓ No circular dependencies
✓ No duplicate application state
✓ No renderer-specific types in normalized data
✓ No raw backend parsing inside renderers
✓ No globe.gl dependency
✓ No obsolete globe.gl code
```

The objective is a clean architecture where the map can evolve independently without turning `CyberThreatMap.tsx` into a single massive file.

The most important boundaries are:

```text
RAW DATA
   ↓
NORMALIZATION
   ↓
CANONICAL STATE
   ↓
GEOGRAPHIC TRANSFORMATION
   ↓
RENDERING
   ↓
UI
```

Keep those boundaries clear throughout the implementation.

# COMPONENT INTERFACES AND PROPS

Define explicit TypeScript interfaces for every major Global Threat Map component.

The component architecture must use strongly typed props.

Do NOT use:

```ts
any
```

for component props.

Do NOT allow child components to directly access global application state unless that is already part of the existing architecture.

The main `CyberThreatMap` component should own the shared map state and pass controlled values/callbacks to child components.

---

# 1. SHARED MAP TYPES

Use the existing normalized data contract.

Core types:

```ts
export type MapMode = 'globe' | 'flat';

export type ThreatDisplayMode = 'events' | 'heatmap';

export type TimeRangePreset =
    | '15m'
    | '1h'
    | '6h'
    | '24h'
    | '7d'
    | 'custom';

export interface GeographicPoint {
    latitude: number;
    longitude: number;
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
}

export interface NormalizedThreatEvent {
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
    source: GeographicPoint;
    destination?: GeographicPoint;
    ioc?: string;
    identifier?: string;
    metadata?: Record<string, unknown>;
}

export interface ThreatCluster {
    id: string;
    latitude: number;
    longitude: number;
    count: number;
    eventIds: string[];
}
```

Adapt names only if the existing project already has equivalent types.

Do not create duplicate versions of the same interface.

---

# 2. `CyberThreatMapProps`

The parent component should retain compatibility with the existing application.

First inspect how `CyberThreatMap` is currently imported and what props it currently receives.

Do not arbitrarily change the external API.

Where props are required, define them explicitly:

```ts
export interface CyberThreatMapProps {
    threats?: unknown[];
    onThreatClick?: (
        event: NormalizedThreatEvent
    ) => void;
}
```

However, if the existing parent already owns the threat data, preserve that architecture instead of unnecessarily moving data ownership.

The important requirement is that the map internally reaches:

```ts
NormalizedThreatEvent[]
```

before rendering.

---

# 3. MAIN STATE OWNERSHIP

`CyberThreatMap.tsx` should own or coordinate:

```ts
mapMode
displayMode
selectedEvent
selectedCountry
threatTypeFilter
severityFilter
timeRange
countryFilter
showConnections
isLive
isFullscreen
searchQuery
```

Do not create duplicate copies of these states in:

* GlobeRenderer
* FlatWorldMap
* ThreatFeed
* CountryIntelligence
* EventDetails

Child components should receive values and callbacks.

---

# 4. `GlobeRenderer` INTERFACE

The Three.js renderer must remain independent from React UI.

Use an interface conceptually like:

```ts
export interface GlobeRendererProps {
    events: NormalizedThreatEvent[];

    selectedEventId?: string | null;

    selectedCountryCode?: string | null;

    showConnections: boolean;

    onEventClick?: (
        event: NormalizedThreatEvent
    ) => void;

    onCountryClick?: (
        countryCode: string,
        countryName?: string
    ) => void;

    onCountryHover?: (
        countryCode: string | null
    ) => void;

    onReady?: () => void;

    onError?: (
        error: Error
    ) => void;
}
```

The exact interface may differ depending on whether `GlobeRenderer` is a React component or a class/service.

Important:

The renderer must NOT own application filters.

It should receive already filtered events.

---

# 5. THREE.JS RENDERER API

If `GlobeRenderer.ts` is implemented as a class/service rather than React component, use a clear imperative API.

Example:

```ts
export interface GlobeRenderer {
    initialize(
        container: HTMLElement
    ): void;

    setEvents(
        events: NormalizedThreatEvent[]
    ): void;

    setSelectedEvent(
        eventId: string | null
    ): void;

    setSelectedCountry(
        countryCode: string | null
    ): void;

    setConnectionsVisible(
        visible: boolean
    ): void;

    focusCoordinate(
        latitude: number,
        longitude: number
    ): void;

    resetView(): void;

    resize(): void;

    dispose(): void;
}
```

Do not expose internal Three.js objects unnecessarily.

Do not expose:

```ts
scene
camera
renderer
```

to unrelated UI components.

---

# 6. `FlatWorldMapProps`

The flat map should receive:

```ts
export interface FlatWorldMapProps {
    events: NormalizedThreatEvent[];

    selectedEventId?: string | null;

    selectedCountryCode?: string | null;

    hoveredCountryCode?: string | null;

    showConnections: boolean;

    showHeatmap: boolean;

    onEventClick?: (
        event: NormalizedThreatEvent
    ) => void;

    onCountryClick?: (
        countryCode: string,
        countryName?: string
    ) => void;

    onCountryHover?: (
        countryCode: string | null
    ) => void;

    onClusterClick?: (
        cluster: ThreatCluster
    ) => void;
}
```

The flat map must not independently fetch threat data.

It receives normalized events from the parent/data layer.

---

# 7. `CountryPolygonProps`

Each country polygon should have a strongly typed interface.

Example:

```ts
export interface CountryPolygonProps {
    countryCode: string;

    countryName: string;

    path: string;

    selected: boolean;

    hovered: boolean;

    threatLevel?:
        | 'low'
        | 'medium'
        | 'high'
        | 'critical';

    threatCount: number;

    onHover: (
        countryCode: string | null
    ) => void;

    onClick: (
        countryCode: string,
        countryName: string
    ) => void;
}
```

Adapt this depending on the actual GeoJSON rendering implementation.

Do not require a threat level when it cannot legitimately be derived.

A country with no activity should have:

```ts
threatLevel: undefined
```

rather than an invented severity.

---

# 8. `ThreatMarker2DProps`

Use:

```ts
export interface ThreatMarker2DProps {
    event: NormalizedThreatEvent;

    x: number;

    y: number;

    selected: boolean;

    onClick: (
        event: NormalizedThreatEvent
    ) => void;
}
```

The parent projection layer should calculate:

```text
latitude / longitude
        ↓
x / y
```

The marker should not modify the normalized event.

---

# 9. `ThreatConnections2DProps`

Use:

```ts
export interface ThreatConnections2DProps {
    events: NormalizedThreatEvent[];

    visible: boolean;

    projection: (
        latitude: number,
        longitude: number
    ) => [number, number];
}
```

Only events with:

```ts
event.destination
```

should produce connections.

Do not create fake destinations inside this component.

---

# 10. `MapControlsProps`

Centralize map controls.

```ts
export interface MapControlsProps {
    mapMode: MapMode;

    displayMode: ThreatDisplayMode;

    showConnections: boolean;

    isLive: boolean;

    isFullscreen: boolean;

    onMapModeChange: (
        mode: MapMode
    ) => void;

    onDisplayModeChange: (
        mode: ThreatDisplayMode
    ) => void;

    onConnectionsChange: (
        visible: boolean
    ) => void;

    onLiveChange: (
        live: boolean
    ) => void;

    onZoomIn: () => void;

    onZoomOut: () => void;

    onResetView: () => void;

    onFullscreenToggle: () => void;
}
```

Controls should be controlled components.

Do not duplicate state inside `MapControls`.

---

# 11. `TimeRangeControlProps`

```ts
export interface TimeRangeControlProps {
    value: TimeRangePreset;

    customStart?: Date | null;

    customEnd?: Date | null;

    onChange: (
        range: TimeRangePreset
    ) => void;

    onCustomRangeChange?: (
        start: Date | null,
        end: Date | null
    ) => void;
}
```

The component should only control the UI.

Actual filtering must happen in the centralized filter/data layer.

---

# 12. `LiveControlProps`

```ts
export interface LiveControlProps {
    isLive: boolean;

    disabled?: boolean;

    onChange: (
        isLive: boolean
    ) => void;
}
```

This should not subscribe to the WebSocket itself.

The WebSocket/data hook owns live data handling.

The UI only controls the live state.

---

# 13. `MapSearchProps`

```ts
export type MapSearchType =
    | 'all'
    | 'ip'
    | 'domain'
    | 'ioc'
    | 'country'
    | 'city';

export interface MapSearchResult {
    type: MapSearchType;

    label: string;

    latitude?: number;

    longitude?: number;

    countryCode?: string;

    eventId?: string;

    source?: 'event' | 'country' | 'backend';
}

export interface MapSearchProps {
    query: string;

    searchType: MapSearchType;

    loading: boolean;

    results: MapSearchResult[];

    onQueryChange: (
        query: string
    ) => void;

    onSearchTypeChange: (
        type: MapSearchType
    ) => void;

    onSearch: () => void;

    onResultSelect: (
        result: MapSearchResult
    ) => void;

    onClear: () => void;
}
```

Search results must come from real application data.

Do not create fake results inside the search component.

---

# 14. `MapLegendProps`

```ts
export interface MapLegendProps {
    showConnections?: boolean;

    displayMode: ThreatDisplayMode;
}
```

The legend should remain presentational.

It should not own threat filter state.

---

# 15. `ThreatFeedProps`

The Live Threat Feed should consume normalized events.

```ts
export interface ThreatFeedProps {
    events: NormalizedThreatEvent[];

    selectedEventId?: string | null;

    maxItems?: number;

    onEventSelect: (
        event: NormalizedThreatEvent
    ) => void;
}
```

The feed must not parse raw backend responses.

It must receive already normalized events.

---

# 16. `NodeStatisticsProps`

Use derived statistics.

Example:

```ts
export interface NodeStatistics {
    feedStatus: string;

    activeEvents: number;

    activeNodes: number;

    threatLevel?: string;
}

export interface NodeStatisticsProps {
    statistics: NodeStatistics;
}
```

Statistics should be calculated outside the presentational component.

Do not hard-code values in the component.

---

# 17. `CountryIntelligenceProps`

```ts
export interface CountryIntelligenceProps {
    countryCode: string | null;

    countryName?: string;

    events: NormalizedThreatEvent[];

    region?: string;

    onClose: () => void;

    onEventSelect?: (
        event: NormalizedThreatEvent
    ) => void;

    onApplyCountryFilter?: (
        countryCode: string
    ) => void;

    onClearCountryFilter?: () => void;
}
```

The panel should derive:

* total threats
* severity counts
* top threat types
* source count
* destination count
* recent activity

from actual events.

Do not pass fabricated statistics.

---

# 18. `EventDetailsProps`

```ts
export interface EventDetailsProps {
    event: NormalizedThreatEvent | null;

    onClose: () => void;

    onFocusMap?: (
        event: NormalizedThreatEvent
    ) => void;
}
```

The panel should directly consume the normalized event.

Do not reconstruct event information from map marker objects.

---

# 19. `ClusterProps`

```ts
export interface ThreatClusterProps {
    cluster: ThreatCluster;

    selected?: boolean;

    onClick: (
        cluster: ThreatCluster
    ) => void;
}
```

A cluster is a visualization object only.

It must never masquerade as a real threat event.

---

# 20. `Country / Event SELECTION CONTRACT`

Use stable IDs.

Country:

```ts
countryCode: string
```

Event:

```ts
eventId: string
```

Do not use:

```ts
array index
```

as the selection identifier.

This must remain stable when:

* filters change
* live events arrive
* map mode changes
* clustering changes
* events are sorted

---

# 21. CALLBACK CONTRACT

Callbacks should communicate user intent rather than expose renderer internals.

Good:

```ts
onEventClick(event)
onCountryClick(countryCode)
onCountryHover(countryCode)
onMapModeChange(mode)
onConnectionsChange(visible)
onTimeRangeChange(range)
```

Avoid callbacks such as:

```ts
onThreeObjectCreated(...)
onSceneChanged(...)
onCameraObject(...)
```

The parent should not need to understand Three.js internals.

---

# 22. MAP FOCUS CONTRACT

When the application wants to focus a geographic location, use a renderer-independent structure.

Example:

```ts
export interface MapFocusTarget {
    latitude: number;
    longitude: number;

    zoom?: number;

    eventId?: string;

    countryCode?: string;
}
```

This can be passed to either:

* Three.js Globe
* 2D Flat Map

The renderer decides how to interpret it.

---

# 23. MAP RENDERER INTERFACE

Define a common conceptual interface so both renderers can support shared actions.

```ts
export interface MapRendererController {
    focusCoordinate(
        latitude: number,
        longitude: number,
        zoom?: number
    ): void;

    focusEvent(
        event: NormalizedThreatEvent
    ): void;

    focusCountry(
        countryCode: string
    ): void;

    resetView(): void;

    resize(): void;

    dispose(): void;
}
```

Three.js and the flat map can implement this differently.

The rest of the application should not need to know how.

---

# 24. FILTERED DATA CONTRACT

Child renderers should receive already filtered events.

Example:

```ts
const filteredEvents: NormalizedThreatEvent[];
```

Do NOT pass raw events and filter again inside:

* GlobeRenderer
* FlatWorldMap
* ThreatFeed
* Heatmap
* CountryIntelligence

Filtering must happen once in the centralized data layer.

---

# 25. COUNTRY EVENT CONTRACT

Country intelligence should use derived country events.

Example:

```ts
const countryEvents = filteredEvents.filter(
    (event) =>
        event.source.countryCode === selectedCountryCode
);
```

Where destination based intelligence is required, use:

```ts
event.destination?.countryCode
```

Do not maintain a separate country event dataset.

---

# 26. DISPLAY MODE CONTRACT

The two display modes are:

```ts
type ThreatDisplayMode =
    | 'events'
    | 'heatmap';
```

Events mode:

```text
individual events
clusters
connections
```

Heatmap mode:

```text
aggregated geographic intensity
```

Both must originate from the same normalized events.

---

# 27. MAP MODE CONTRACT

```ts
type MapMode =
    | 'globe'
    | 'flat';
```

Switching map mode must not change:

* selected event
* selected country
* filters
* time range
* live state
* connection state

Only the rendering engine changes.

---

# 28. COMPONENT RESPONSIBILITY MATRIX

Use this responsibility model:

```text
Component                    Responsibility
────────────────────────────────────────────────────────
CyberThreatMap               State + orchestration
useThreatMapData             API + WebSocket + normalization
useThreatMapFilters          Filtering + derived events

GlobeRenderer                Three.js rendering
FlatWorldMap                 SVG map rendering
CountryPolygon               Country rendering
ThreatMarker2D               2D event rendering
ThreatConnections2D          2D connections

threatClustering             Cluster calculation
threatHeatmap                Heatmap calculation
geographicUtils              Coordinate conversion
projections                  Geographic projection

MapControls                  Map controls
TimeRangeControl             Time selection UI
LiveControl                  Live/Pause UI
MapSearch                    Search UI
MapLegend                    Legend UI

ThreatFeed                   Event list UI
NodeStatistics               Statistics UI
CountryIntelligence          Country intelligence UI
EventDetails                 Event details UI
```

No component should silently take over another component's responsibility.

---

# 29. DATA FLOW CONTRACT

The intended flow is:

```text
RAW API / WebSocket
        ↓
Normalization
        ↓
NormalizedThreatEvent[]
        ↓
Canonical State
        ↓
Filtering
        ↓
Filtered NormalizedThreatEvent[]
        ↓
 ┌───────────────┬───────────────┬───────────────┐
 ↓               ↓               ↓
3D Globe       2D Flat Map     Threat Feed
 ↓               ↓
Country         Heatmap
 ↓               ↓
Event Details  Clusters
```

UI controls update centralized state.

They do not directly mutate renderer internals.

---

# 30. NO DUPLICATE STATE

Do not allow this:

```text
CyberThreatMap
    └── filter state

GlobeRenderer
    └── another filter state

FlatWorldMap
    └── another filter state

ThreatFeed
    └── another filter state
```

Instead:

```text
CyberThreatMap
      ↓
central filter state
      ↓
derived filtered events
      ↓
all visual components
```

---

# 31. NO RAW DATA PROPAGATION

Do not pass raw backend objects into child components.

Avoid:

```ts
rawThreat: unknown
```

in visual components.

Prefer:

```ts
event: NormalizedThreatEvent
```

This rule applies to:

* markers
* feed
* event details
* country intelligence
* clustering
* heatmap
* renderers

---

# 32. NO RENDERER COUPLING

UI components must not import:

```ts
THREE
```

unless that component is specifically part of the Three.js rendering layer.

For example:

`ThreatFeed.tsx`

must not import Three.js.

`CountryIntelligence.tsx`

must not import Three.js.

`MapControls.tsx`

must not import Three.js.

Only the Three.js rendering layer should know about Three.js.

---

# 33. EVENT SELECTION FLOW

When the user selects an event:

```text
User clicks marker
        ↓
renderer emits NormalizedThreatEvent
        ↓
CyberThreatMap updates selectedEvent
        ↓
EventDetails receives selectedEvent
        ↓
map focus state updates if required
```

Do not pass a Three.js mesh or SVG DOM element into the Event Details panel.

---

# 34. COUNTRY SELECTION FLOW

When the user clicks a country:

```text
CountryPolygon
       ↓
countryCode
       ↓
CyberThreatMap
       ↓
selectedCountry
       ↓
CountryIntelligence
```

The country panel should derive its data from the canonical normalized events.

---

# 35. SEARCH FLOW

Search should work as:

```text
MapSearch
    ↓
search request
    ↓
existing application data / backend
    ↓
MapSearchResult
    ↓
CyberThreatMap
    ↓
MapFocusTarget
    ↓
GlobeRenderer OR FlatWorldMap
```

Search must not directly manipulate the Three.js camera.

---

# 36. FULLSCREEN FLOW

Fullscreen should be handled by:

```text
CyberThreatMap
      ↓
useMapFullscreen
      ↓
fullscreen state
      ↓
renderer resize
```

Neither `MapControls` nor individual renderers should independently maintain fullscreen state.

---

# 37. ERROR CALLBACK CONTRACT

Rendering and data errors should use typed callbacks.

Example:

```ts
export interface MapError {
    code:
        | 'GEOGRAPHIC_DATA'
        | 'RENDERER'
        | 'SOCKET'
        | 'API'
        | 'INVALID_DATA';

    message: string;

    recoverable: boolean;
}
```

Components may expose:

```ts
onError?: (error: MapError) => void;
```

Do not expose raw internal exceptions directly to the UI unless appropriate.

---

# 38. LOADING CONTRACT

Use explicit loading states.

Example:

```ts
export interface MapLoadingState {
    geographicData: boolean;
    renderer: boolean;
    threatData: boolean;
    search: boolean;
}
```

Do not make each child invent its own independent loading interpretation.

---

# 39. RESPONSIVE PROPS

Do not create separate mobile and desktop data models.

The same interfaces must work across:

* desktop
* tablet
* mobile

Responsive behavior should primarily be handled by layout/CSS and appropriate UI state.

---

# 40. FINAL COMPONENT VALIDATION

Before completing the implementation, verify:

* all major components have explicit TypeScript props
* no unnecessary `any`
* no raw backend objects passed to UI components
* all visual components use `NormalizedThreatEvent`
* `CyberThreatMap` owns shared state
* child components receive controlled props
* no duplicate filters exist
* no duplicate selected event state exists
* no duplicate selected country state exists
* renderers do not own application filters
* UI components do not access Three.js internals
* Three.js code remains isolated
* SVG map code remains isolated
* callbacks communicate application intent
* stable event IDs are used
* stable country codes are used
* map mode and display mode are typed
* search results are typed
* cluster data is typed
* loading state is typed
* error state is typed
* the parent application contract remains backward compatible

The key architectural rule is:

```text
STATE IS OWNED CENTRALLY
        ↓
DATA IS NORMALIZED ONCE
        ↓
PROPS ARE STRONGLY TYPED
        ↓
RENDERERS ONLY RENDER
        ↓
UI COMPONENTS ONLY PRESENT / EMIT INTENT
```

Do not allow individual components to invent their own interpretation of the CTI data.


# MASTER IMPLEMENTATION CLARIFICATIONS

The following rules override any ambiguity or earlier example in this prompt.

## A. PUBLIC COMPONENT COMPATIBILITY

Preserve the existing `CyberThreatMap` public props and parent component contract after inspecting the real code.

Do not automatically replace an existing `ThreatData[]` prop with `unknown[]` or `NormalizedThreatEvent[]`.

If the parent currently passes raw/existing `ThreatData[]`, keep that public contract and normalize the data at the map boundary.

Do not use `unknown[]` as a permanent visual component prop.

Once data crosses the normalization boundary, visual components must receive `NormalizedThreatEvent[]`.

The final architecture is:

```text
Existing Parent Contract
        ↓
Existing ThreatData / actual backend-compatible type
        ↓
Normalization Boundary
        ↓
NormalizedThreatEvent[]
        ↓
All map rendering and intelligence components
```

## B. THREE.JS RENDERER ARCHITECTURE

Implement `GlobeRenderer.ts` as an imperative Three.js renderer/controller rather than a React UI component.

It should own:

- Three.js scene
- WebGL renderer
- camera
- OrbitControls
- Earth objects
- geographic Three.js layers
- threat marker objects
- connection objects
- render loop
- renderer-specific lifecycle

It must NOT own:

- React application filters
- country filter state
- time filter state
- live/pause application state
- selected event application state
- selected country application state
- UI components

Use a controller-style API such as:

```ts
export interface GlobeRendererController {
    initialize(container: HTMLElement): void;
    setEvents(events: NormalizedThreatEvent[]): void;
    setSelectedEvent(eventId: string | null): void;
    setSelectedCountry(countryCode: string | null): void;
    setConnectionsVisible(visible: boolean): void;
    focusCoordinate(
        latitude: number,
        longitude: number,
        zoom?: number
    ): void;
    focusEvent(event: NormalizedThreatEvent): void;
    focusCountry(countryCode: string): void;
    resetView(): void;
    resize(): void;
    dispose(): void;
}
```

Do not expose the internal Three.js scene, camera, renderer, meshes, or materials to unrelated UI components.

## C. FLAT MAP ARCHITECTURE

Implement `FlatWorldMap.tsx` as a controlled React component.

It receives normalized events and controlled state through typed props.

It may use:

- React
- SVG
- GeoJSON
- D3 geographic projection utilities where required

It must NOT directly parse raw backend payloads.

It must NOT own duplicate application state for filters, time range, selected country, or selected event.

## D. COMMON MAP FOCUS MODEL

Use a renderer-independent focus target:

```ts
export interface MapFocusTarget {
    latitude: number;
    longitude: number;
    zoom?: number;
    eventId?: string;
    countryCode?: string;
}
```

`CyberThreatMap` owns the focus intent.

The active renderer decides how to implement the focus.

`MapSearch` must never directly manipulate a Three.js camera.

## E. HEATMAP SEMANTICS

The heatmap must be geographically anchored to actual normalized threat coordinates.

Do NOT implement the heatmap as a generic decorative radial gradient.

Heat intensity must be derived from actual filtered threat events.

If the backend provides an actual event weight/confidence/severity weighting field, it may be used only according to the existing application semantics.

If no reliable weighting field exists, use event count only.

Do not invent threat weights.

## F. TIMESTAMP AND TIMEZONE

Normalize internal timestamps to UTC-compatible ISO strings.

Use UTC for internal comparison and filtering.

Display timestamps using the application's/user's configured timezone where appropriate.

Do not replace an event timestamp with the current browser time.

Do not infer event age from array ordering.

## G. LIVE / PAUSE SEMANTICS

`PAUSE` means pause map visualization updates.

Do NOT automatically disconnect the existing WebSocket unless the current application architecture explicitly requires that behavior.

Incoming events may continue to arrive according to the existing data architecture.

When LIVE resumes:

- process buffered/new events as appropriate
- preserve stable IDs
- deduplicate events
- do not duplicate events already present

## H. COUNTRY CODE NORMALIZATION

When a country code is actually available, prefer a normalized uppercase ISO 3166-1 alpha-2 representation.

Examples:

```text
MY
US
DE
SG
JP
```

Do not guess country codes.

Do not silently convert country names to codes unless a trusted existing mapping/data source is already part of the application.

If only a country name exists and no trusted mapping exists, preserve the country name and avoid pretending a verified country code exists.

## I. DESTINATION HANDLING

If destination data is:

- missing: keep `destination` undefined
- valid: use it
- partially present or invalid: treat it as unavailable

Do not attempt to repair invalid destination data.

Do not infer a destination from:

- sensors
- nearest country
- nearest node
- source location
- random coordinates

Do not draw an attack connection when a valid destination is unavailable.

## J. MONITORING SENSOR HANDLING

If the existing application uses visualization-only monitoring sensors, keep them separate from destination semantics.

Prefer an explicit field such as:

```ts
monitoringSensor?: GeographicPoint;
```

only if the current application actually needs it.

Never label a monitoring sensor as:

- victim
- destination
- attack target

## K. NORMALIZATION CONTRACT

The canonical normalized model remains renderer-independent:

```ts
export type NormalizedSeverity =
    | 'low'
    | 'medium'
    | 'high'
    | 'critical';

export interface GeographicPoint {
    latitude: number;
    longitude: number;
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
}

export interface NormalizedThreatEvent {
    id: string;
    type: string;
    severity: NormalizedSeverity;
    timestamp: string;
    source: GeographicPoint;
    destination?: GeographicPoint;
    ioc?: string;
    identifier?: string;
    metadata?: Record<string, unknown>;
}
```

Do not add Three.js types to this contract.

Do not add SVG coordinates to this contract.

Do not add renderer-specific objects to this contract.

## L. NORMALIZATION IMPLEMENTATION LOCATION

Prefer:

```text
threatNormalization.ts
```

for raw-to-normalized conversion.

It should expose real TypeScript functions including:

```ts
normalizeThreatEvent()
normalizeThreatEvents()
normalizeSeverity()
normalizeThreatType()
normalizeTimestamp()
normalizeGeographicPoint()
```

If the existing project already has a suitable normalization utility location, reuse it rather than creating duplicate infrastructure.

## M. REAL DATA ONLY

Do not fabricate:

- countries
- regions
- cities
- coordinates
- attack destinations
- attack paths
- IOCs
- statistics
- threat counts
- timestamps
- severity
- search results

When information is unavailable, preserve that absence.

For presentation only, the UI may say `Unavailable`, but the underlying normalized data must not be polluted with fake placeholders.

## N. MINIMAL MODULARITY

The proposed file tree is guidance, not a requirement to create every file.

Create only the files that are genuinely useful.

Prefer:

```text
small number of clear modules
```

over:

```text
one tiny file for every function
```

Reuse existing project directories when suitable.

Do not create duplicate `types`, `utils`, `hooks`, `services`, or map folders when equivalent project structures already exist.

## O. COMPONENT RESPONSIBILITY RULE

Use this responsibility model:

```text
CyberThreatMap
    State + orchestration

Data / Hooks
    API + WebSocket + normalization + canonical state

Filters
    Time / severity / type / country filtering

GlobeRenderer
    Three.js rendering only

FlatWorldMap
    React + SVG geographic rendering

Geo utilities
    Coordinate conversion + projection

Clustering
    Cluster calculation only

Heatmap
    Heatmap calculation/rendering only

UI controls
    Present controls + emit callbacks

ThreatFeed
    Present normalized events

CountryIntelligence
    Present country intelligence derived from normalized events

EventDetails
    Present selected normalized event
```

No component should silently absorb another component's responsibility.

## P. COMPONENT PROP RULE

Use strongly typed props.

Do not use:

```ts
any
```

for convenience.

Do not use:

```ts
unknown[]
```

as a permanent visual component data contract.

Preferred visual data props are:

```ts
events: NormalizedThreatEvent[]
event: NormalizedThreatEvent | null
```

Use callbacks for user intent:

```ts
onEventSelect
onCountrySelect
onCountryHover
onMapModeChange
onDisplayModeChange
onConnectionsChange
onTimeRangeChange
onLiveChange
onFocus
```

Do not pass renderer internals through props.

## Q. SELECTION CONTRACT

Use stable identifiers:

```ts
eventId: string
countryCode: string
```

Do not use array indexes.

When a marker is clicked:

```text
Marker
  ↓
NormalizedThreatEvent
  ↓
CyberThreatMap
  ↓
selectedEventId / selectedEvent
  ↓
EventDetails
```

When a country is clicked:

```text
CountryPolygon
  ↓
countryCode
  ↓
CyberThreatMap
  ↓
selectedCountry
  ↓
CountryIntelligence
```

## R. FILTER CONTRACT

Filtering happens centrally.

Child renderers receive the already-filtered events:

```ts
filteredEvents: NormalizedThreatEvent[]
```

Do not duplicate filter logic in:

- GlobeRenderer
- FlatWorldMap
- ThreatFeed
- Heatmap
- CountryIntelligence
- EventDetails

## S. DATA FLOW CONTRACT

The final data flow must remain:

```text
Existing API / WebSocket
            ↓
Raw / Existing Application Data
            ↓
Runtime Validation
            ↓
Normalization
            ↓
Deduplication
            ↓
Canonical NormalizedThreatEvent[]
            ↓
Centralized Filters
            ↓
Filtered NormalizedThreatEvent[]
            ↓
 ┌─────────────┬─────────────┬─────────────┐
 ↓             ↓             ↓
3D Globe     2D Flat Map    Feed
 ↓             ↓
Country       Heatmap
 ↓             ↓
Event         Clusters
Details
```

All views must derive from the same canonical normalized state.

## T. THREE.JS RESOURCE LIFECYCLE

The Three.js renderer must:

- initialize once for the mounted map
- reuse the same scene/renderer while mounted
- update objects/data incrementally
- avoid full scene recreation on ordinary filter changes
- dispose geometries/materials/textures created by the renderer when appropriate
- stop animation loops on dispose
- remove controls/listeners
- release WebGL resources where appropriate

Do not recreate the entire Three.js renderer for:

- filter changes
- time range changes
- selected event changes
- selected country changes
- live events
- UI state changes

## U. SVG PERFORMANCE

For the flat map:

- reuse geographic path data where possible
- avoid unnecessary path regeneration
- memoize stable country rendering where appropriate
- avoid creating excessive DOM nodes for large event volumes
- use a Canvas/WebGL overlay for high-volume event rendering only if the project actually requires it

Do not add complexity prematurely.

## V. VALIDATION REQUIREMENT

After implementation, run the appropriate project validation/build/type-check commands available in the project.

Verify:

- no TypeScript errors
- no unresolved imports
- no obsolete `globe.gl` references
- no duplicate type definitions
- no obvious console errors
- no broken parent `CyberThreatMap` contract
- all major features remain functional

Do not claim successful validation unless it was actually performed.
