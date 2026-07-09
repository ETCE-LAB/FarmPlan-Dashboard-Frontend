# FarmPlan Dashboard

FarmPlan is a farm planning dashboard for creating farms, drawing field borders, exploring plant data, checking soil information, and reviewing hardiness zones. The frontend is split into tabs so each workflow stays focused:

- Overview dashboard with live statistics, inventory summaries, soil lookup, and a yield chart
- Farm creation workspace with map drawing, drag-and-drop crop placement, recipe creation, and hardiness lookup
- Farm editing workspace for updating or deleting saved farms
- Plant inventory browser with search, filters, pagination, and data reload
- Theme and settings panel for live layout color customization

## Features

### Dashboard overview

- KPI cards powered by saved farm data
- Field inventory table
- Soil lookup panel for coordinate-based soil queries
- Yield chart built with Recharts

### Farm creation

- Required farm form fields with validation
- Map-based polygon drawing for borders
- Edit and delete drawn field polygons
- Automatic area and perimeter calculations
- Location search by coordinates or address
- Hardiness zone analysis for a selected field polygon
- Drag-and-drop crop placement inside an active field polygon
- Recipe creation and editing for assigning plants to a farm
- Farm data stored in Firestore

### Farm editing

- View existing farms
- Update farm metadata
- Delete farms from the collection

### Plant inventory

- MongoDB-backed plant table
- Search by ID, German name, English name, or Latin name
- Filter by category, strata, and hardiness zone
- Pagination and page-size control
- Manual reload of the treeline CSV into the backend

### Theme and layout

- Light and dark theme modes
- Live accent, sidebar, background, and panel color controls
- Theme values are applied through CSS variables

### Localization and UI

- i18next-based text handling
- English and German locale files
- Sidebar navigation and top bar layout shared across all tabs


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

Vite proxies backend calls from the frontend to `http://localhost:5000`.

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
  App.jsx                        # app-level state, tabs, theme vars, Firebase sync
  components/
    Sidebar.jsx                  # left navigation
    TopBar.jsx                   # top header row
    StatsRow.jsx                 # KPI cards
    FieldInventoryPanel.jsx      # overview inventory panel
    SoilLookupPanel.jsx          # soil lookup panel
    YieldChartPanel.jsx          # overview chart panel
    FarmCreationPanel.jsx        # create farm + map drawing + recipes + hardiness
    DragDropCrops.jsx            # draggable crop cards for field placement
    FarmEditPanel.jsx            # edit and delete farms
    PlantsPanel.jsx              # plant inventory browser
    ThemeConfigurationPanel.jsx  # theme controls
    FieldClimatePanel.jsx        # hardiness analysis for selected field
    Recipe.jsx                   # recipe builder dialog
  data/
    dashboardData.js             # demo/static data
  hooks/
    usePlantImage.js             # plant image helper hook
  locales/
    en.json
    de.json
  utils/
    dashboardApi.js              # backend API helpers
    soilUtils.js                 # coordinate transform + result helpers
  styles/
    AppLayout.css
vite.config.js                   # proxy setup for external APIs
```

## App Flow

Main state is in src/App.jsx:

- activeTab
- farms list synchronized with Firestore
- theme object
- tableFilters and tableData for treeline inventory queries

Tab mapping:

- Overview: stats cards, soil lookup, yield chart
- Farm Setup: farm creation + polygon drawing + hardiness + recipe editor
- Farm Edit: update or delete existing farms
- Treeline Plants: searchable and filterable plant inventory with pagination
- Settings: dark/light + colors

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

The farm creation panel also shows the hardiness results for the selected field and lets you create or edit a recipe for that farm.

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

1. Gets a polygon from the selected field
2. Makes a POST call to the backend API
3. Displays the returned hardiness data in FieldClimatePanel

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
License note: Refer to DATALICENSE&ATTRIBUTION.md for data usage and license information.

## Theme System Notes

Theme state is managed in src/App.jsx and injected as CSS variables.

Current controls:

- light/dark switch
- accent color
- sidebar color
- page background
- panel/card color

Theme UI is in src/components/ThemeConfigurationPanel.jsx.

## Languages & Translations (i18n)

This application supports multiple languages and uses an automated script to manage translations. If you are contributing to the project and want to update translations or add a new language, follow this workflow:

### 1. Locate the Translation Files
All translation dictionaries are stored as JSON files. You can find them located in your frontend source folder (typically under `src/locales/` or the root `locales/` directory, such as `en.json` for English).

### 2. Updating Existing Translations
Whenever you add new text to the React UI, run the automated translation script. This script will extract any new translation keys you've added to the code and automatically generate the missing translations:

```bash
# Run this command every time you update or add new text to the UI
npm run i18n


## Final Handoff Tip

Start reading from src/App.jsx first. It gives the clearest picture of how tabs, theme, and shared state are wired together.
