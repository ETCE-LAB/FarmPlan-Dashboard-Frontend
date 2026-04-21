import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { LayersControl, MapContainer, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import './FarmEditPanel.css';

const INITIAL_CENTER = [52.2689, 10.5268];

function calculateAreaSquareMeters(points) {
  if (points.length < 3) {
    return 0;
  }

  const referenceLat = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
  const toMeters = (point) => {
    const meterPerDegLat = 111320;
    const meterPerDegLng = Math.cos((referenceLat * Math.PI) / 180) * 111320;
    return {
      x: point.lng * meterPerDegLng,
      y: point.lat * meterPerDegLat,
    };
  };
  const projected = points.map(toMeters);

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
  const toMeters = (point) => {
    const meterPerDegLat = 111320;
    const meterPerDegLng = Math.cos((referenceLat * Math.PI) / 180) * 111320;
    return {
      x: point.lng * meterPerDegLng,
      y: point.lat * meterPerDegLat,
    };
  };
  const projected = points.map(toMeters);

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

function PolygonEditManager({ initialPolygon, onPolygonChange, resetToken, mapControlRef }) {
  const map = useMap();
  const polygonLayerRef = useRef(null);

  // Expose centerOnPolygon function to parent
  useEffect(() => {
    if (mapControlRef) {
      mapControlRef.current = {
        centerOnPolygon: () => {
          if (polygonLayerRef.current) {
            const bounds = polygonLayerRef.current.getBounds();
            map.fitBounds(bounds, { padding: [50, 50] });
          }
        },
      };
    }
  }, [map, mapControlRef]);

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

    // Draw initial polygon if it exists
    if (initialPolygon && initialPolygon.length > 0) {
      const latLngs = initialPolygon.map(({ lat, lng }) => [lat, lng]);
      polygonLayerRef.current = L.polygon(latLngs, {
        color: '#2e7d32',
        weight: 3,
        fillOpacity: 0.2,
      }).addTo(map);

      // Center on polygon when loaded
      setTimeout(() => {
        if (polygonLayerRef.current) {
          const bounds = polygonLayerRef.current.getBounds();
          map.fitBounds(bounds, { padding: [50, 50] });
        }
      }, 100);
    }

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

      // Center on newly created polygon
      setTimeout(() => {
        const bounds = event.layer.getBounds();
        map.fitBounds(bounds, { padding: [50, 50] });
      }, 100);
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
  }, [map, resetToken]);

  return null;
}

function FarmEditPanel({ farms, onUpdateFarm, onDeleteFarm }) {
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [polygonResetToken, setPolygonResetToken] = useState(0);
  const mapControlRef = useRef(null);

  const areaSquareMeters = useMemo(() => calculateAreaSquareMeters(editData.borderPolygon || []), [editData.borderPolygon]);
  const perimeterMeters = useMemo(() => calculatePerimeterMeters(editData.borderPolygon || []), [editData.borderPolygon]);

  const handleEdit = (farm) => {
    setEditingId(farm.id);
    setEditData({ ...farm });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
    setPolygonResetToken((prev) => prev + 1);
  };

  const handleSave = () => {
    if (editingId) {
      onUpdateFarm(editingId, editData);
      setEditingId(null);
      setEditData({});
      setPolygonResetToken((prev) => prev + 1);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePolygonChange = useCallback((nextPolygon) => {
    setEditData((prev) => ({
      ...prev,
      borderPolygon: nextPolygon,
    }));
  }, []);

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this farm?')) {
      onDeleteFarm(id);
    }
  };

  if (farms.length === 0) {
    return (
      <section className="panel farm-edit-panel">
        <div className="panel-header">
          <span>Farm Edit</span>
        </div>
        <p className="empty-state">No farms created yet. Go to Field Mapping to create one.</p>
      </section>
    );
  }

  return (
    <section className="panel farm-edit-panel">
      <div className="panel-header">
        <span>Farm Edit ({farms.length})</span>
      </div>

      <div className="farm-edit-list">
        {farms.map((farm) => (
          <div key={farm.id} className="farm-edit-item">
            {editingId === farm.id ? (
              // Edit mode
              <div className="farm-edit-form">
                <div className="edit-form-grid">
                  <div className="form-section">
                    <label>Farm Name</label>
                    <input
                      type="text"
                      name="farmName"
                      value={editData.farmName || ''}
                      onChange={handleInputChange}
                    />

                    <label>Owner Name</label>
                    <input
                      type="text"
                      name="ownerName"
                      value={editData.ownerName || ''}
                      onChange={handleInputChange}
                    />

                    <label>Location</label>
                    <input
                      type="text"
                      name="location"
                      value={editData.location || ''}
                      onChange={handleInputChange}
                    />

                    <label>Contact Email</label>
                    <input
                      type="email"
                      name="contactEmail"
                      value={editData.contactEmail || ''}
                      onChange={handleInputChange}
                    />

                    <label>Notes</label>
                    <textarea
                      name="notes"
                      rows={3}
                      value={editData.notes || ''}
                      onChange={handleInputChange}
                    />

                    <div className="polygon-metrics">
                      <span>Points: {(editData.borderPolygon || []).length}</span>
                      <span>Area: {(areaSquareMeters / 10000).toFixed(2)} ha</span>
                      <span>Perimeter: {(perimeterMeters / 1000).toFixed(2)} km</span>
                    </div>
                  </div>

                  <div className="map-section">
                    <div className="map-header">
                      <p className="map-help-text">Edit the polygon below to update your farm border</p>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => mapControlRef.current?.centerOnPolygon()}
                      >
                        📍 Center
                      </button>
                    </div>
                    <MapContainer
                      className="edit-farm-map"
                      center={
                        editData.borderPolygon && editData.borderPolygon.length > 0
                          ? [editData.borderPolygon[0].lat, editData.borderPolygon[0].lng]
                          : INITIAL_CENTER
                      }
                      zoom={13}
                      scrollWheelZoom
                    >
                      <PolygonEditManager
                        initialPolygon={editData.borderPolygon || []}
                        onPolygonChange={handlePolygonChange}
                        resetToken={polygonResetToken}
                        mapControlRef={mapControlRef}
                      />
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
                  </div>
                </div>

                <div className="edit-actions">
                  <button className="primary-btn" onClick={handleSave}>
                    Save Changes
                  </button>
                  <button className="secondary-btn" onClick={handleCancel}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // View mode
              <div className="farm-view">
                <div className="farm-info">
                  <h4>{farm.farmName}</h4>
                  <p>
                    <strong>Owner:</strong> {farm.ownerName}
                  </p>
                  <p>
                    <strong>Location:</strong> {farm.location}
                  </p>
                  <p>
                    <strong>Email:</strong> {farm.contactEmail}
                  </p>
                  <small>
                    {farm.areaHectares} ha | {farm.perimeterKm} km | {farm.borderPolygon.length} points
                  </small>
                </div>
                <div className="farm-actions">
                  <button className="primary-btn" onClick={() => handleEdit(farm)}>
                    Edit
                  </button>
                  <button className="danger-btn" onClick={() => handleDelete(farm.id)}>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default FarmEditPanel;
