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

## Flask + MongoDB Backend

The dashboard overview can now load treeline data from MongoDB through a Flask API.

### 1) Start MongoDB

Run MongoDB locally (default URI: `mongodb://localhost:27017`).

### 2) Start Flask API

From `farmplan/backend`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python app.py
```

API endpoints:

- `GET /api/health`
- `POST /api/treeline/import`
- `GET /api/treeline/overview`
- `GET /api/treeline/records?limit=50`
- `POST /api/hardiness/field`

On first overview request, Flask auto-imports `20260320_Neorx-treeline-planning.csv` if the collection is empty.

### 3) Start React frontend

From `farmplan`:

```bash
npm run dev
```

Vite proxies Flask calls from `/api/flask/*` to `http://localhost:5000`.

### One-command startup (frontend + backend)

From `farmplan`:

```bash
npm run dev:full
```

This runs Vite and Flask together in one command.

## Treeline Table Query API

The inventory table now supports MongoDB-backed search/filter/pagination via:

- `GET /api/treeline/records?page=1&limit=10&search=walnut&category=Tree&strata=Emergent canopy`

Query params:

- `page` (default `1`)
- `limit` (default `10`, max `100`)
- `search` (matches ID/German/English/Latin names)
- `category` (`all` or exact category)
- `strata` (`all` or exact strata)

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
- tableFilters & tableData (for treeline inventory queries)

Tab mapping:

- Overview: stats cards, soil lookup, yield chart
- Field Mapping: farm creation + polygon drawing
- Treeline Plants: searchable/filterable plant inventory with pagination
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

## Hardiness Zone API Notes

Files:

- src/utils/dashboardApi.js
- src/components/FarmCreationPanel.jsx
- src/components/FieldClimatePanel.jsx

1. Gets Polygon from selected Field 
2. Makes POST call to Backend API
3. gets JSON respones and display in FieldClimatePanel

Example: 

```json
{
  "status": "ok",
  "distribution": {
    "7a": 38.01,
    "7b": 61.99
  },
  "dominantZone": "7b",
  "rawPixelCount": 3389,
  "temperature": [
    -15.0,
    -12.2
  ]
}
```
LICENS NOTE: Regard DATALICENC&ATTRIBUTION.md for data usegage and licenc information. 

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
