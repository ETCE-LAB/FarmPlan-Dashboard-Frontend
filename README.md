# FarmPlan Dashboard


- overview page with stats, table, soil lookup, chart
- field mapping page where you can create a farm and draw borders
- location search by lat/lng or address


## What Is Built So Far

Main things currently working:

1. Farm creation form with required inputs
2. Map-based border drawing (polygon create/edit/delete)
3. Area/perimeter calculation from the drawn polygon
4. Soil API lookup (through Vite proxy)


## Stack

- React 19
- Vite 8
- Recharts
- Leaflet + react-leaflet
- Leaflet-Geoman (drawing)
- proj4 (coordinate transform)
- lucide-react (icons)

## Quick Setup

Requirements:

- Node.js 18+ (Node 20 recommended)
- npm

Install and run:

```bash
npm install
npm run dev
```

Build commands:

```bash
npm run build
npm run preview
```

Lint:

```bash
npm run lint
```

## Project Structure (Important Files)

```text
src/
  App.jsx                        # app-level state + tab rendering + theme vars
  components/
    Sidebar.jsx                  # left navigation
    TopBar.jsx                   # top search/profile row
    StatsRow.jsx                 # KPI cards
    FieldInventoryPanel.jsx      # table panel
    SoilLookupPanel.jsx          # BGR API lookup panel
    YieldChartPanel.jsx          # chart panel
    FarmCreationPanel.jsx        # create farm + map drawing
    ThemeConfigurationPanel.jsx  # theme controls
  data/
    dashboardData.js             # demo/static data
  utils/
    soilUtils.js                 # coordinate transform + result helpers
  styles/
    AppLayout.css
vite.config.js                   # includes proxy for BGR API
```

## App Flow

Main state is in src/App.jsx:

- activeTab
- farms list (currently in-memory only)
- theme object

Tab mapping:

- Overview: stats/table/soil/chart
- Field Mapping: farm creation + polygon drawing
- Theme and Settings: dark/light + colors

## Farm Mapping Notes

File: src/components/FarmCreationPanel.jsx

What it does:

- validates required fields
- allows drawing exactly one active polygon
- supports edit/delete polygon
- computes area (ha) and perimeter (km)
- supports location search:
  - coordinates like 52.2689, 10.5268
  - address lookup with Nominatim

Map layers:

- OpenStreetMap
- Esri World Imagery (satellite)

## Soil API Notes

Files:

- src/components/SoilLookupPanel.jsx
- src/utils/soilUtils.js

How it works:

1. User enters lat/lon
2. We transform EPSG:4326 to service projection (3034/3035)
3. We call BGR ArcGIS Identify endpoint through proxy
4. We show top result cards

Proxy setup is in vite.config.js:

- local route starts with /api/bgr
- forwarded to https://services.bgr.de

## Theme System Notes

Theme state is managed in src/App.jsx and injected as CSS variables.

Current controls:

- light/dark switch
- accent color
- sidebar color
- page background
- panel/card color

Theme UI is in src/components/ThemeConfigurationPanel.jsx.


## Final Handoff Tip

Start reading from src/App.jsx first. It gives the clearest picture of how tabs, theme, and shared state are wired together.
