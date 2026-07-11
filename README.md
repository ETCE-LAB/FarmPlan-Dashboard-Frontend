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
npm run dev:frontend
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

## Agroforestry Optimizer

`optimizer/end_to_end.py` generates the crop placement plan that feeds
`plan_placements.json`, which the Field Mapping tab reads to auto-align
crops on a drawn field.

It is a deterministic, rule-based layout generator (no training step
required to run it) that fills a 60 m × 40 m reference field with 6
treelines (spaced 8 m apart) and 5 trellis/alley columns interleaved
between them, stacking species top-to-bottom per column by stratum
(Emergent → High → Medium → Low canopy → Shrub, with Climbers/Herbs
filling the trellis columns), while enforcing minimum spacing distances
between plant tiers (the Rancho Mastatal spacing matrix).

### Running it

```bash
cd optimizer
python end_to_end.py
```

This reads the species CSV, builds the layout, validates spacing, and
writes `optimizer/output/plan_placements.json` and
`optimizer/output/plan_result.json`.

### Latest run statistics

```
Total placements:   297
Unique species:     35
Total calories:     6,840,750 kcal / year
Spacing check:      PASS ✓ (0 violations)
Treelines:          147 plants
Trellis columns:    150 plants
```

Breakdown by strata:

| Strata             | Plants | Species | Calories (kcal/yr) |
| ------------------ | -----: | ------: | -----------------: |
| Emergent canopy    |     21 |       4 |          3,911,250 |
| Medium tree        |     36 |       7 |            935,400 |
| Shrub layer        |     72 |      13 |            722,925 |
| Low/medium tree    |     12 |       2 |            624,000 |
| Climber/liana      |    100 |       5 |            402,200 |
| Low tree           |      6 |       1 |            177,600 |
| Tall herb geophyte |     20 |       1 |             30,400 |
| Herb               |     15 |       1 |             21,600 |
| Herb geophyte      |     15 |       1 |             15,375 |

Species diversity highlights:

- **Emergent canopy:** Black walnut, Heartnut, Shagbark hickory, Walnut
- **Medium tree:** Apple (semi-standard), Cornelian cherry, Elder (tree form), Hardy persimmon (hybrids), Pear (semi-standard), +2 more
- **Shrub layer:** Autumn olive, Blackthorn (sloe), Buffaloberry, Cornelian cherry (shrub), Elder (multi-stem), +8 more
- **Climber/liana:** Chocolate vine, Five-flavor berry, Grapevine, Groundnut, Hardy kiwi

Full details, spacing matrix, and customization options are documented
in `optimizer/README.md`.

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

optimizer/
  end_to_end.py                  # deterministic treeline/trellis layout generator
  output/
    plan_placements.json         # generated plan consumed by FarmCreationPanel.jsx
    plan_result.json             # summary stats for the generated plan
  README.md                      # optimizer documentation (spacing matrix, algorithm)
```

# Production Deployment (Docker & CI/CD)

The application is fully configured for production deployment using Docker and runtime configuration.

## 1. Backend Deployment (Docker)

The backend is containerized via Docker and requires system dependencies (like `libexpat1` for `rasterio`) which are pre-configured in the Dockerfile.

Ensure your server `.env` file is populated with production values:

```env
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net
FLASK_PORT=5000
FLASK_ENV=production
```

Build the Docker image:

```bash
docker build -t farmplan-dashboard-backend:latest .
```

Run the container:

```bash
docker run -p 5000:5000 --env-file .env farmplan-dashboard-backend:latest
```

## 2. Frontend Deployment (Runtime Configuration)

The frontend uses a dynamic runtime configuration pattern. This means the server administrator can change the backend API URL without needing to rebuild the React application.

Build the production assets:

```bash
npm run build
```

On your live server, locate the `dist/config.js` file.

Edit the file to point to your live Python backend:

```javascript
window.FARM_PLAN_CONFIG = {
  API_BASE_URL: 'https://your-production-api-url.com',
};
```

The frontend will instantly begin routing traffic to the new URL.

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
