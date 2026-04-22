import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { LayersControl, MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import './FarmCreationPanel.css';

const INITIAL_CENTER = [52.2689, 10.5268];

function toMeters(point, referenceLat) {
  const meterPerDegLat = 111320;
  const meterPerDegLng = Math.cos((referenceLat * Math.PI) / 180) * 111320;

  return {
    x: point.lng * meterPerDegLng,
    y: point.lat * meterPerDegLat,
  };
}

function calculateAreaSquareMeters(points) {
  if (points.length < 3) {
    return 0;
  }

  const referenceLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const projected = points.map((point) => toMeters(point, referenceLat));

  let area = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const current = projected[i];
    const next = projected[(i + 1) % projected.length];
    area += current.x * next.y - next.x * current.y;
  }

  return Math.abs(area) / 2;
}

function calculatePerimeterMeters(points) {
  if (points.length < 2) {
    return 0;
  }

  const referenceLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const projected = points.map((point) => toMeters(point, referenceLat));

  let perimeter = 0;
  for (let i = 0; i < projected.length; i += 1) {
    const current = projected[i];
    const next = projected[(i + 1) % projected.length];
    const dx = next.x - current.x;
    const dy = next.y - current.y;
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }

  return perimeter;
}

const REQUIRED_FIELDS = [
  'farmName',
  'ownerName',
  'location',
  'contactEmail',
];

function parseCoordinates(input) {
  if (!input) {
    return null;
  }

  const matched = input
    .trim()
    .match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);

  if (!matched) {
    return null;
  }

  const lat = Number(matched[1]);
  const lng = Number(matched[2]);

  const isLatValid = lat >= -90 && lat <= 90;
  const isLngValid = lng >= -180 && lng <= 180;

  if (!isLatValid || !isLngValid) {
    return null;
  }

  return { lat, lng };
}

function MapNavigator({ targetLocation }) {
  const map = useMap();
  const resultLayerRef = useRef(null);

  useEffect(() => {
    if (!targetLocation) {
      return;
    }

    map.flyTo([targetLocation.lat, targetLocation.lng], 16, {
      duration: 0.8,
    });

    if (resultLayerRef.current) {
      map.removeLayer(resultLayerRef.current);
    }

    resultLayerRef.current = L.circleMarker([targetLocation.lat, targetLocation.lng], {
      radius: 7,
      color: '#1b5e20',
      fillColor: '#2e7d32',
      fillOpacity: 0.8,
      weight: 2,
    }).addTo(map);
  }, [map, targetLocation]);

  useEffect(() => {
    return () => {
      if (!resultLayerRef.current) {
        return;
      }

      map.removeLayer(resultLayerRef.current);
      resultLayerRef.current = null;
    };
  }, [map]);

  return null;
}

function PolygonDrawManager({ onPolygonChange, resetToken }) {
  const map = useMap();
  const polygonLayerRef = useRef(null);

  useEffect(() => {
    map.pm.addControls({
      position: 'topright',
      drawMarker: false,
      drawCircleMarker: false,
      drawRectangle: false,
      drawCircle: false,
      drawPolyline: false,
      drawText: false,
      drawPolygon: true,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
    });

    map.pm.setPathOptions({
      color: '#2e7d32',
      weight: 3,
      fillOpacity: 0.2,
    });

    const syncPolygon = (layer) => {
      const coordinates = layer.getLatLngs()?.[0] ?? [];
      onPolygonChange(coordinates.map(({ lat, lng }) => ({ lat, lng })));
    };

    const onCreate = (event) => {
      if (!(event.layer instanceof L.Polygon)) {
        return;
      }

      if (polygonLayerRef.current && polygonLayerRef.current !== event.layer) {
        map.removeLayer(polygonLayerRef.current);
      }

      polygonLayerRef.current = event.layer;
      syncPolygon(event.layer);
    };

    const onEdit = () => {
      if (!polygonLayerRef.current) {
        return;
      }

      syncPolygon(polygonLayerRef.current);
    };

    const onRemove = (event) => {
      if (!polygonLayerRef.current || event.layer !== polygonLayerRef.current) {
        return;
      }

      polygonLayerRef.current = null;
      onPolygonChange([]);
    };

    map.on('pm:create', onCreate);
    map.on('pm:edit', onEdit);
    map.on('pm:remove', onRemove);

    return () => {
      map.off('pm:create', onCreate);
      map.off('pm:edit', onEdit);
      map.off('pm:remove', onRemove);
      map.pm.removeControls();
    };
  }, [map, onPolygonChange]);

  useEffect(() => {
    if (!polygonLayerRef.current) {
      return;
    }

    map.removeLayer(polygonLayerRef.current);
    polygonLayerRef.current = null;
    onPolygonChange([]);
  }, [map, onPolygonChange, resetToken]);

  return null;
}

function FarmCreationPanel({ onCreateFarm, farms }) {
  const [formData, setFormData] = useState({
    farmName: '',
    ownerName: '',
    location: '',
    contactEmail: '',
    notes: '',
  });
  const [polygon, setPolygon] = useState([]);
  const [resetToken, setResetToken] = useState(0);
  const [errors, setErrors] = useState({});
  const [locationSearchInput, setLocationSearchInput] = useState('');
  const [locationSearchFeedback, setLocationSearchFeedback] = useState({ type: '', message: '' });
  const [isSearching, setIsSearching] = useState(false);
  const [mapTargetLocation, setMapTargetLocation] = useState(null);

  const areaSquareMeters = useMemo(() => calculateAreaSquareMeters(polygon), [polygon]);
  const perimeterMeters = useMemo(() => calculatePerimeterMeters(polygon), [polygon]);

  const handlePolygonChange = useCallback((nextPolygon) => {                              //CallBack to prevent unnecessary re-renders of the map component when polygon changes, as the function reference remains stable across renders.
    console.log('Updated polygon points:', nextPolygon, 'length:', nextPolygon.length);  // Debug log to verify polygon updates
    setPolygon(nextPolygon);
    if (nextPolygon.length > 0 && errors.polygon) {
      setErrors((previous) => ({ ...previous, polygon: undefined }));
    }
  }, [errors.polygon]);

  const validate = () => {
    const nextErrors = {};

    REQUIRED_FIELDS.forEach((field) => {
      if (!formData[field].trim()) {
        nextErrors[field] = 'This field is required.';
      }
    });

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.contactEmail && !emailPattern.test(formData.contactEmail)) {
      nextErrors.contactEmail = 'Please provide a valid email address.';
    }

    if (polygon.length < 3) {
      nextErrors.polygon = 'Draw a polygon with at least 3 points to define the border.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((previous) => ({ ...previous, [name]: undefined }));
    }
  };

  const resetForm = () => {
    setFormData({
      farmName: '',
      ownerName: '',
      location: '',
      contactEmail: '',
      notes: '',
    });
    setPolygon([]);
    setErrors({});
    setResetToken((previous) => previous + 1);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    onCreateFarm({
      id: Date.now(),
      ...formData,
      borderPolygon: polygon.map((point) => ({
        lat: Number(point.lat.toFixed(6)),
        lng: Number(point.lng.toFixed(6)),
      })),
      areaHectares: Number((areaSquareMeters / 10000).toFixed(2)),
      perimeterKm: Number((perimeterMeters / 1000).toFixed(2)),
      createdAt: new Date().toISOString(),
    });

    resetForm();
  };

  const handleLocationSearch = async () => {
    const cleanedInput = locationSearchInput.trim();
    if (!cleanedInput) {
      setLocationSearchFeedback({
        type: 'error',
        message: 'Enter an address or coordinates (lat, lng).',
      });
      return;
    }

    const coordinateResult = parseCoordinates(cleanedInput);
    if (coordinateResult) {
      setMapTargetLocation(coordinateResult);
      setLocationSearchFeedback({
        type: 'success',
        message: `Centered map at ${coordinateResult.lat.toFixed(5)}, ${coordinateResult.lng.toFixed(5)}.`,
      });
      return;
    }

    try {
      setIsSearching(true);
      setLocationSearchFeedback({ type: '', message: '' });

      const query = encodeURIComponent(cleanedInput);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`
      );

      if (!response.ok) {
        throw new Error('Address lookup failed.');
      }

      const searchResults = await response.json();
      if (!Array.isArray(searchResults) || searchResults.length === 0) {
        setLocationSearchFeedback({
          type: 'error',
          message: 'No matching place found. Try a more specific address.',
        });
        return;
      }

      const firstResult = searchResults[0];
      const lat = Number(firstResult.lat);
      const lng = Number(firstResult.lon);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        setLocationSearchFeedback({
          type: 'error',
          message: 'Result did not contain valid coordinates.',
        });
        return;
      }

      setMapTargetLocation({ lat, lng });
      setLocationSearchFeedback({
        type: 'success',
        message: `Found: ${firstResult.display_name}`,
      });
      setFormData((previous) => ({
        ...previous,
        location: previous.location || firstResult.display_name,
      }));
    } catch {
      setLocationSearchFeedback({
        type: 'error',
        message: 'Could not search this location right now. Please try again.',
      });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <section className="farm-create-grid">
      <article className="panel farm-create-form-panel">
        <div className="panel-header">
          <span>Create New Farm</span>
        </div>

        <form className="farm-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="farmName">Farm Name *</label>
          <input
            id="farmName"
            name="farmName"
            value={formData.farmName}
            onChange={handleChange}
            placeholder="e.g., Green Valley Farm"
            required
          />
          {errors.farmName && <p className="error-text">{errors.farmName}</p>}

          <label htmlFor="ownerName">Owner Name *</label>
          <input
            id="ownerName"
            name="ownerName"
            value={formData.ownerName}
            onChange={handleChange}
            placeholder="e.g., Max Mustermann"
            required
          />
          {errors.ownerName && <p className="error-text">{errors.ownerName}</p>}

          <label htmlFor="location">Location/Address *</label>
          <input
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="e.g., Wolfenbuttel, Lower Saxony"
            required
          />
          {errors.location && <p className="error-text">{errors.location}</p>}

          <label htmlFor="contactEmail">Contact Email *</label>
          <input
            id="contactEmail"
            name="contactEmail"
            type="email"
            value={formData.contactEmail}
            onChange={handleChange}
            placeholder="e.g., owner@farm.com"
            required
          />
          {errors.contactEmail && <p className="error-text">{errors.contactEmail}</p>}

          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            value={formData.notes}
            onChange={handleChange}
            placeholder="Optional details: soil, legal notes, irrigation plan..."
          />

          <div className="polygon-metrics">
            <span>Points: {polygon.length}</span>
            <span>Area: {(areaSquareMeters / 10000).toFixed(2)} ha</span>
            <span>Perimeter: {(perimeterMeters / 1000).toFixed(2)} km</span>
          </div>
          {errors.polygon && <p className="error-text">{errors.polygon}</p>}

          <div className="form-actions">
            <button type="button" className="secondary-btn" onClick={resetForm}>
              Reset
            </button>
            <button type="submit" className="primary-btn">
              Save Farm
            </button>
          </div>
        </form>
      </article>

      <article className="panel farm-map-panel">
        <div className="panel-header">
          <span>Farm Border Drawing</span>
        </div>
        <p className="map-help-text">
          Use the polygon tool to draw the border. You can edit or delete the shape any time.
        </p>

        <div className="location-search-row">
          <input
            type="text"
            value={locationSearchInput}
            onChange={(event) => setLocationSearchInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleLocationSearch();
              }
            }}
            placeholder="Search by address or lat,lng (e.g., 52.2689, 10.5268)"
            aria-label="Search location by address or coordinates"
          />
          <button
            type="button"
            className="secondary-btn"
            onClick={handleLocationSearch}
            disabled={isSearching}
          >
            {isSearching ? 'Searching...' : 'Find'}
          </button>
        </div>
        {locationSearchFeedback.message && (
          <p className={`location-search-feedback ${locationSearchFeedback.type}`}>
            {locationSearchFeedback.message}
          </p>
        )}

        <MapContainer className="farm-map" center={INITIAL_CENTER} zoom={13} scrollWheelZoom>
          <MapNavigator targetLocation={mapTargetLocation} />
          <PolygonDrawManager onPolygonChange={handlePolygonChange} resetToken={resetToken} />

          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Satellite (Esri World Imagery)">
              <TileLayer
                attribution="Tiles &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              />
            </LayersControl.BaseLayer>
          </LayersControl>
        </MapContainer>
      </article>

      <article className="panel farm-list-panel">
        <div className="panel-header">
          <span>Saved Farms/Homesteads ({farms.length})</span>
        </div>
        {farms.length === 0 ? (
          <p className="empty-state">No farms saved yet.</p>
        ) : (
          <div className="farm-list">
            {farms.map((farm) => (
              <div key={farm.id} className="farm-list-item">
                <h4>{farm.farmName}</h4>
                <p>{farm.location}</p>
                <small>
                  {farm.areaHectares} ha | {farm.perimeterKm} km | {farm.borderPolygon.length} points
                </small>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

export default FarmCreationPanel;
