import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, LayersControl, useMap } from 'react-leaflet';
import {
  LoaderCircle, MapPin, Layers, ChevronRight,
  Wheat, Droplets, Ruler, LocateFixed,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import FieldClimatePanel from './FieldClimatePanel';   // ← NEW
import './FarmCreationPanel.css';

const INITIAL_CENTER = [52.2689, 10.5268];
const FARM_REQUIRED = ['farmName', 'ownerName', 'location', 'contactEmail'];
const CROP_OPTIONS = [
  'Winter Wheat', 'Corn', 'Barley', 'Rapeseed', 'Sunflower',
  'Rye', 'Oats', 'Soybean', 'Sugar Beet', 'Potato', 'Other',
];
const SOIL_OPTIONS = [
  'Sandy', 'Sandy Loam', 'Loam', 'Clay Loam', 'Clay',
  'Silt', 'Silty Loam', 'Peaty', 'Chalky', 'Other',
];
const CROP_ICONS = {
  'Winter Wheat': '🌾', Corn: '🌽', Barley: '🌿', Rapeseed: '🌻',
  Sunflower: '🌻', Rye: '🌾', Oats: '🌾', Soybean: '🫘',
  'Sugar Beet': '🌱', Potato: '🥔', Other: '🌱',
};

function toMeters(point, referenceLat) {
  const mPerDegLat = 111320;
  const mPerDegLng = Math.cos((referenceLat * Math.PI) / 180) * 111320;
  return { x: point.lng * mPerDegLng, y: point.lat * mPerDegLat };
}

function calcArea(points) {
  if (points.length < 3) return 0;
  const refLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const proj = points.map((p) => toMeters(p, refLat));
  let area = 0;
  for (let i = 0; i < proj.length; i++) {
    const cur = proj[i];
    const nxt = proj[(i + 1) % proj.length];
    area += cur.x * nxt.y - nxt.x * cur.y;
  }
  return Math.abs(area) / 2;
}

function calcPerimeter(points) {
  if (points.length < 2) return 0;
  const refLat = points.reduce((s, p) => s + p.lat, 0) / points.length;
  const proj = points.map((p) => toMeters(p, refLat));
  let perimeter = 0;
  for (let i = 0; i < proj.length; i++) {
    const cur = proj[i];
    const nxt = proj[(i + 1) % proj.length];
    perimeter += Math.sqrt((nxt.x - cur.x) ** 2 + (nxt.y - cur.y) ** 2);
  }
  return perimeter;
}

function parseCoordinates(input) {
  if (!input) return null;
  const matched = input.trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!matched) return null;
  const lat = Number(matched[1]);
  const lng = Number(matched[2]);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function getPolygonCenter(points) {
  if (!points || points.length === 0) return null;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
  };
}

function getBoundingBox(fields) {
  if (!fields || fields.length === 0) return null;
  const allPoints = fields.flatMap((f) => f.borderPolygon ?? []);
  if (allPoints.length === 0) return null;
  return {
    minLat: Math.min(...allPoints.map((p) => p.lat)),
    maxLat: Math.max(...allPoints.map((p) => p.lat)),
    minLng: Math.min(...allPoints.map((p) => p.lng)),
    maxLng: Math.max(...allPoints.map((p) => p.lng)),
  };
}

function MapNavigator({ targetLocation }) {
  const map = useMap();
  const markerRef = useRef(null);
  useEffect(() => {
    if (!targetLocation) return;
    map.flyTo([targetLocation.lat, targetLocation.lng], 16, { duration: 0.8 });
    if (markerRef.current) map.removeLayer(markerRef.current);
    markerRef.current = L.circleMarker([targetLocation.lat, targetLocation.lng], {
      radius: 7, color: '#1b5e20', fillColor: '#2e7d32', fillOpacity: 0.8, weight: 2,
    }).addTo(map);
  }, [map, targetLocation]);
  useEffect(() => () => { if (markerRef.current) map.removeLayer(markerRef.current); }, [map]);
  return null;
}

function FieldZoomNavigator({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.8 });
  }, [map, target]);
  return null;
}

function FarmBoundsZoomer({ fields }) {
  const map = useMap();
  useEffect(() => {
    if (!fields || fields.length === 0) return;
    const bb = getBoundingBox(fields);
    if (!bb) return;
    map.flyToBounds(
      [[bb.minLat, bb.minLng], [bb.maxLat, bb.maxLng]],
      { padding: [48, 48], duration: 0.9, maxZoom: 17 }
    );
  }, [fields, map]);
  return null;
}

function FieldDrawer({
  fields, selectedFieldId, editingShapeId,
  onPolygonDrawn, onPolygonEdited, onFieldClick,
}) {
  const map = useMap();
  const layerMapRef = useRef({});
  const drawingRef = useRef(false);
  const onPolygonDrawnRef = useRef(onPolygonDrawn);
  const onPolygonEditedRef = useRef(onPolygonEdited);
  const onFieldClickRef = useRef(onFieldClick);

  useEffect(() => { onPolygonDrawnRef.current = onPolygonDrawn; }, [onPolygonDrawn]);
  useEffect(() => { onPolygonEditedRef.current = onPolygonEdited; }, [onPolygonEdited]);
  useEffect(() => { onFieldClickRef.current = onFieldClick; }, [onFieldClick]);

  useEffect(() => {
    for (const id of Object.keys(layerMapRef.current)) {
      if (!fields.find((f) => f.id === Number(id))) {
        const layer = layerMapRef.current[id];
        if (map.hasLayer(layer)) map.removeLayer(layer);
        delete layerMapRef.current[id];
      }
    }
    for (const field of fields) {
      const isSelected     = field.id === selectedFieldId;
      const isEditingShape = field.id === editingShapeId;
      const style = isSelected || isEditingShape
        ? { color: '#f59e0b', weight: 3.5, fillOpacity: 0.30, fillColor: '#fde68a', dashArray: null }
        : { color: '#ffffff', weight: 2.5, fillOpacity: 0.10, fillColor: '#4ade80', dashArray: null };
      const existingLayer = layerMapRef.current[field.id];
      if (existingLayer && map.hasLayer(existingLayer)) {
        existingLayer.setStyle(style);
        if (isEditingShape) {
          if (!existingLayer.pm.enabled()) existingLayer.pm.enable({ allowSelfIntersection: false });
        } else {
          if (existingLayer.pm.enabled()) existingLayer.pm.disable();
        }
      } else {
        if (existingLayer && map.hasLayer(existingLayer)) map.removeLayer(existingLayer);
        const layer = L.polygon(field.borderPolygon.map((p) => [p.lat, p.lng]), style).addTo(map);
        layer.on('click', () => onFieldClickRef.current(field.id));
        layer.bindTooltip(field.fieldName || 'Unnamed field', { permanent: false, direction: 'center', className: 'field-tooltip' });
        layerMapRef.current[field.id] = layer;
        if (isEditingShape) layer.pm.enable({ allowSelfIntersection: false });
      }
    }
  }, [fields, selectedFieldId, editingShapeId, map]);

  useEffect(() => {
    if (!editingShapeId) return;
    const layer = layerMapRef.current[editingShapeId];
    if (!layer) return;
    const onEdit = () => {
      const coords = layer.getLatLngs()[0].map(({ lat, lng }) => ({ lat, lng }));
      onPolygonEditedRef.current(editingShapeId, coords);
    };
    map.on('pm:edit', onEdit);
    return () => { map.off('pm:edit', onEdit); if (layer.pm.enabled()) layer.pm.disable(); };
  }, [editingShapeId, map]);

  useEffect(() => {
    map.pm.addControls({
      position: 'topright',
      drawMarker: false, drawCircleMarker: false, drawRectangle: false,
      drawCircle: false, drawPolyline: false, drawText: false,
      drawPolygon: true, editMode: false, dragMode: false,
      cutPolygon: false, removalMode: false,
    });
    map.pm.setPathOptions({ color: '#f59e0b', weight: 2.5, fillOpacity: 0.22 });
    const onCreate = (e) => {
      if (drawingRef.current) return;
      if (!(e.layer instanceof L.Polygon)) return;
      drawingRef.current = true;
      const coords = e.layer.getLatLngs()[0].map(({ lat, lng }) => ({ lat, lng }));
      map.removeLayer(e.layer);
      onPolygonDrawnRef.current(coords);
      setTimeout(() => { drawingRef.current = false; }, 100);
    };
    map.on('pm:create', onCreate);
    return () => { map.off('pm:create', onCreate); map.pm.removeControls(); };
  }, [map]);

  useEffect(() => () => {
    Object.values(layerMapRef.current).forEach((l) => { if (map.hasLayer(l)) map.removeLayer(l); });
  }, [map]);

  return null;
}

function FieldPropertiesPanel({
  polygon, existingField, onSave, onCancel, onDelete,
  farmName, onEditShape, isEditingShape,
}) {
  const [form, setForm] = useState(
    existingField
      ? { fieldName: existingField.fieldName, cropType: existingField.cropType, soilType: existingField.soilType, irrigated: existingField.irrigated, notes: existingField.notes }
      : { fieldName: '', cropType: '', soilType: '', irrigated: false, notes: '' }
  );
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (existingField) {
      setForm({ fieldName: existingField.fieldName, cropType: existingField.cropType, soilType: existingField.soilType, irrigated: existingField.irrigated, notes: existingField.notes });
    } else {
      setForm({ fieldName: '', cropType: '', soilType: '', irrigated: false, notes: '' });
    }
    setErrors({});
  }, [existingField]);

  const area = useMemo(() => calcArea(polygon) / 10000, [polygon]);
  const perimeter = useMemo(() => calcPerimeter(polygon) / 1000, [polygon]);

  const validate = () => {
    const next = {};
    if (!form.fieldName.trim()) next.fieldName = 'Field name is required.';
    if (!form.cropType.trim()) next.cropType = 'Please select a crop type.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      ...form,
      borderPolygon: polygon.map((p) => ({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) })),
      areaHectares: Number(area.toFixed(2)),
      perimeterKm: Number(perimeter.toFixed(2)),
    });
  };

  return (
    <aside className="field-props-panel">
      <div className="fpp-header">
        <div className="fpp-header-left">
          <div className="fpp-header-icon">🌿</div>
          <div>
            <div className="fpp-title">{existingField ? 'Edit Field' : 'New Field'}</div>
            {farmName && <div className="fpp-subtitle">in {farmName}</div>}
          </div>
        </div>
        <button className="fpp-close" type="button" onClick={onCancel}>✕</button>
      </div>
      <div className="fpp-metrics-bar">
        <div className="fpp-metric"><Ruler size={13} /><span>{area.toFixed(2)} ha</span></div>
        <div className="fpp-metric-divider" />
        <div className="fpp-metric"><LocateFixed size={13} /><span>{perimeter.toFixed(2)} km</span></div>
        <div className="fpp-metric-divider" />
        <div className="fpp-metric"><MapPin size={13} /><span>{polygon.length} pts</span></div>
      </div>
      <div className="fpp-body">
        <div className="fpp-field-group">
          <label className="fpp-label">Field Name <span className="fpp-req">*</span></label>
          <input
            className={`fpp-input ${errors.fieldName ? 'fpp-input-error' : ''}`}
            value={form.fieldName}
            onChange={(e) => { setForm(p => ({ ...p, fieldName: e.target.value })); if (errors.fieldName) setErrors(p => ({ ...p, fieldName: undefined })); }}
            placeholder="e.g., North Plot A"
          />
          {errors.fieldName && <p className="fpp-error-msg">{errors.fieldName}</p>}
        </div>
        <div className="fpp-field-group">
          <label className="fpp-label">Crop Type <span className="fpp-req">*</span></label>
          <div className="fpp-crop-grid">
            {CROP_OPTIONS.map((c) => (
              <button key={c} type="button"
                className={`fpp-crop-btn ${form.cropType === c ? 'active' : ''}`}
                onClick={() => { setForm(p => ({ ...p, cropType: c })); if (errors.cropType) setErrors(p => ({ ...p, cropType: undefined })); }}
              >
                <span className="fpp-crop-icon">{CROP_ICONS[c]}</span>
                <span className="fpp-crop-label">{c}</span>
              </button>
            ))}
          </div>
          {errors.cropType && <p className="fpp-error-msg">{errors.cropType}</p>}
        </div>
        <div className="fpp-field-group">
          <label className="fpp-label">Soil Type</label>
          <select className="fpp-select" value={form.soilType} onChange={(e) => setForm(p => ({ ...p, soilType: e.target.value }))}>
            <option value="">Select soil type…</option>
            {SOIL_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="fpp-field-group">
          <label className="fpp-label"><Droplets size={13} style={{ display: 'inline', marginRight: 4 }} />Irrigation</label>
          <div className="fpp-toggle-row">
            <button type="button" className={`fpp-toggle-opt ${form.irrigated ? 'active' : ''}`} onClick={() => setForm(p => ({ ...p, irrigated: true }))}>
              💧 Yes, irrigated
            </button>
            <button type="button" className={`fpp-toggle-opt ${!form.irrigated ? 'active' : ''}`} onClick={() => setForm(p => ({ ...p, irrigated: false }))}>
              🌧 Rain-fed only
            </button>
          </div>
        </div>
        <div className="fpp-field-group">
          <label className="fpp-label">Notes</label>
          <textarea className="fpp-textarea" rows={3} value={form.notes}
            onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Soil tests, irrigation plan, observations…" />
        </div>
        {existingField && (
          <button type="button" className={`fp-edit-shape-btn ${isEditingShape ? 'active' : ''}`} onClick={() => onEditShape(existingField.id)}>
            {isEditingShape ? '✓ Finish Reshaping' : '✏ Edit Shape on Map'}
          </button>
        )}
      </div>
      <div className="fpp-footer">
        {existingField && (
          <button type="button" className="fpp-btn fpp-btn-danger" onClick={() => onDelete(existingField.id)}>Delete</button>
        )}
        <button type="button" className="fpp-btn fpp-btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="fpp-btn fpp-btn-primary" onClick={handleSave}>
          <Wheat size={14} /> Save Field
        </button>
      </div>
    </aside>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

function FarmCreationPanel({ onCreateFarm, farms, onUpdateFarm }) {
  const [formData, setFormData] = useState({ farmName: '', ownerName: '', location: '', contactEmail: '', notes: '' });
  const [formErrors, setFormErrors] = useState({});
  const [formCollapsed, setFormCollapsed] = useState(false);
  const [selectedFarmId, setSelectedFarmId] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [editingShapeId, setEditingShapeId] = useState(null);
  const [draftFieldPolygon, setDraftFieldPolygon] = useState(null);
  const [farmBoundsFields, setFarmBoundsFields] = useState(null);
  const [mapTargetLocation, setMapTargetLocation] = useState(null);
  const [fieldZoomTarget, setFieldZoomTarget] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchFeedback, setSearchFeedback] = useState({ type: '', message: '' });
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (selectedFarmId) setFormCollapsed(true);
    else setFormCollapsed(false);
  }, [selectedFarmId]);

  const selectedFarm  = farms.find((f) => f.id === selectedFarmId) ?? null;
  const selectedField = selectedFarm?.fields?.find((f) => f.id === selectedFieldId) ?? null;
  const isFieldPanelOpen = draftFieldPolygon !== null || selectedFieldId !== null;
  const activeFieldPoly  = draftFieldPolygon ?? selectedField?.borderPolygon ?? [];
  const activeFields     = selectedFarm?.fields ?? [];

  const handleFarmChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (formErrors[name]) setFormErrors((p) => ({ ...p, [name]: undefined }));
  };

  const validateFarm = () => {
    const next = {};
    FARM_REQUIRED.forEach((f) => { if (!formData[f].trim()) next[f] = 'This field is required.'; });
    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) next.contactEmail = 'Please provide a valid email address.';
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetFarmForm = () => { setFormData({ farmName: '', ownerName: '', location: '', contactEmail: '', notes: '' }); setFormErrors({}); };

  const handleFarmSubmit = (e) => {
    e.preventDefault();
    if (!validateFarm()) return;
    onCreateFarm({ id: Date.now(), ...formData, createdAt: new Date().toISOString(), fields: [] });
    resetFarmForm();
  };

  const handleFarmSelect = useCallback((id) => {
    setSelectedFarmId((prev) => {
      const nextId = prev === id ? null : id;
      if (nextId !== null) {
        const farm = farms.find((f) => f.id === nextId);
        if (farm?.fields?.length > 0) setFarmBoundsFields([...farm.fields]);
        else setFarmBoundsFields(null);
      } else setFarmBoundsFields(null);
      return nextId;
    });
    setSelectedFieldId(null); setEditingShapeId(null); setDraftFieldPolygon(null);
  }, [farms]);

  const handleFieldClick = useCallback((id) => {
    setSelectedFieldId((prev) => {
      const nextId = prev === id ? null : id;
      if (nextId !== null && selectedFarm) {
        const field = selectedFarm.fields?.find((f) => f.id === nextId);
        if (field?.borderPolygon?.length > 0) {
          const center = getPolygonCenter(field.borderPolygon);
          setFieldZoomTarget({ ...center, zoom: 18 });
        }
      } else setFieldZoomTarget(null);
      return nextId;
    });
    setDraftFieldPolygon(null); setEditingShapeId(null);
  }, [selectedFarm]);

  const handleFieldPolygonDrawn = useCallback((coords) => {
    setDraftFieldPolygon(coords); setSelectedFieldId(null); setEditingShapeId(null);
  }, []);

  const handleFieldPolygonEdited = useCallback((id, coords) => {
    if (!selectedFarm) return;
    const updatedFields = (selectedFarm.fields ?? []).map((f) =>
      f.id === id
        ? { ...f, borderPolygon: coords.map((p) => ({ lat: Number(p.lat.toFixed(6)), lng: Number(p.lng.toFixed(6)) })), areaHectares: Number((calcArea(coords) / 10000).toFixed(2)), perimeterKm: Number((calcPerimeter(coords) / 1000).toFixed(2)) }
        : f
    );
    onUpdateFarm({ ...selectedFarm, fields: updatedFields });
  }, [selectedFarm, onUpdateFarm]);

  const handleEditShape = useCallback((id) => { setEditingShapeId((prev) => (prev === id ? null : id)); }, []);

  const handleFieldSave = (fieldData) => {
    if (!selectedFarm) return;
    let updatedFields;
    if (draftFieldPolygon) {
      updatedFields = [...(selectedFarm.fields ?? []), { id: Date.now(), ...fieldData, createdAt: new Date().toISOString() }];
    } else if (selectedFieldId) {
      updatedFields = (selectedFarm.fields ?? []).map((f) => f.id === selectedFieldId ? { ...f, ...fieldData } : f);
    }
    onUpdateFarm({ ...selectedFarm, fields: updatedFields });
    setDraftFieldPolygon(null); setSelectedFieldId(null); setEditingShapeId(null);
  };

  const handleFieldDelete = (id) => {
    if (!selectedFarm) return;
    onUpdateFarm({ ...selectedFarm, fields: (selectedFarm.fields ?? []).filter((f) => f.id !== id) });
    setSelectedFieldId(null); setEditingShapeId(null); setDraftFieldPolygon(null);
  };

  const handleFieldCancel = () => { setDraftFieldPolygon(null); setSelectedFieldId(null); setEditingShapeId(null); };

  const handleLocationSearch = async () => {
    const cleaned = searchInput.trim();
    if (!cleaned) { setSearchFeedback({ type: 'error', message: 'Enter an address or coordinates.' }); return; }
    const coords = parseCoordinates(cleaned);
    if (coords) { setMapTargetLocation(coords); setSearchFeedback({ type: 'success', message: `Centered at ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}.` }); return; }
    try {
      setIsSearching(true); setSearchFeedback({ type: '', message: '' });
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(cleaned)}`);
      if (!r.ok) throw new Error();
      const results = await r.json();
      if (!results.length) { setSearchFeedback({ type: 'error', message: 'No matching place found.' }); return; }
      const { lat, lon, display_name } = results[0];
      setMapTargetLocation({ lat: Number(lat), lng: Number(lon) });
      setSearchFeedback({ type: 'success', message: `Found: ${display_name}` });
    } catch { setSearchFeedback({ type: 'error', message: 'Could not search right now.' }); }
    finally { setIsSearching(false); }
  };

  return (
    <section className="farm-create-grid">
      <article className="panel farm-create-form-panel">
        <div className="panel-header" style={{ cursor: selectedFarm ? 'pointer' : 'default' }} onClick={() => selectedFarm && setFormCollapsed(c => !c)}>
          <span>🌾 Register New Farm</span>
          {selectedFarm && <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{formCollapsed ? '▼ show' : '▲ hide'}</span>}
        </div>

        {!formCollapsed && (
          <form className="farm-form" onSubmit={handleFarmSubmit} noValidate>
            <label htmlFor="farmName">Farm Name *</label>
            <input id="farmName" name="farmName" value={formData.farmName} onChange={handleFarmChange} placeholder="e.g., Green Valley Farm" required />
            {formErrors.farmName && <p className="error-text">{formErrors.farmName}</p>}
            <label htmlFor="ownerName">Owner Name *</label>
            <input id="ownerName" name="ownerName" value={formData.ownerName} onChange={handleFarmChange} placeholder="e.g., Max Mustermann" required />
            {formErrors.ownerName && <p className="error-text">{formErrors.ownerName}</p>}
            <label htmlFor="location">Location / Address *</label>
            <input id="location" name="location" value={formData.location} onChange={handleFarmChange} placeholder="e.g., Wolfenbüttel, Lower Saxony" required />
            {formErrors.location && <p className="error-text">{formErrors.location}</p>}
            <label htmlFor="contactEmail">Contact Email *</label>
            <input id="contactEmail" name="contactEmail" type="email" value={formData.contactEmail} onChange={handleFarmChange} placeholder="e.g., owner@farm.com" required />
            {formErrors.contactEmail && <p className="error-text">{formErrors.contactEmail}</p>}
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" name="notes" rows={3} value={formData.notes} onChange={handleFarmChange} placeholder="Optional details…" />
            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={resetFarmForm}>Reset</button>
              <button type="submit" className="primary-btn">Save Farm</button>
            </div>
          </form>
        )}

        {selectedFarm && (
          <>
            <div style={{ height: 1, background: 'var(--panel-divider)', margin: '8px 0' }} />
            <div className="panel-header" style={{ padding: '10px 16px' }}>
              <span>📍 {selectedFarm.farmName}</span>
              <button className="close-btn" type="button" onClick={() => { setSelectedFarmId(null); setSelectedFieldId(null); setEditingShapeId(null); setDraftFieldPolygon(null); }}>✕</button>
            </div>
            <div className="farm-detail-body">
              <div className="farm-detail-card">
                <p className="farm-detail-meta"><strong>Owner</strong><span>{selectedFarm.ownerName}</span></p>
                <p className="farm-detail-meta"><strong>Location</strong><span>{selectedFarm.location}</span></p>
                <p className="farm-detail-meta"><strong>Email</strong><span>{selectedFarm.contactEmail}</span></p>
                {selectedFarm.notes && <p className="farm-detail-meta"><strong>Notes</strong><span>{selectedFarm.notes}</span></p>}
              </div>
              <div className="farm-detail-divider" />
              <p className="farm-detail-hint">
                <Layers size={13} style={{ display: 'inline', marginRight: 5 }} />
                Use the polygon tool on the map to draw a field anywhere, then fill in its details.
              </p>
              <div className="farm-fields-summary">
                <div className="fields-count-header">
                  <strong>Fields</strong>
                  <span className="fields-badge">{(selectedFarm.fields ?? []).length}</span>
                </div>
                {(selectedFarm.fields ?? []).length === 0 ? (
                  <p className="empty-state">No fields yet — draw a polygon on the map.</p>
                ) : (
                  <div className="field-list">
                    {(selectedFarm.fields ?? []).map((f) => (
                      <div key={f.id}
                        className={`field-list-item ${f.id === selectedFieldId ? 'selected' : ''}`}
                        onClick={() => handleFieldClick(f.id)}
                        role="button" tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleFieldClick(f.id)}
                      >
                        <div className="fli-top">
                          <span className="fli-icon">{CROP_ICONS[f.cropType] || '🌱'}</span>
                          <span className="fli-name fli-name-zoomable" title="Click to zoom to this field"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (f.borderPolygon?.length > 0) {
                                const bb = getBoundingBox([f]);
                                setFieldZoomTarget({ lat: (bb.minLat + bb.maxLat) / 2, lng: (bb.minLng + bb.maxLng) / 2, zoom: 18 });
                                setFarmBoundsFields(null);
                              }
                            }}
                          >{f.fieldName || 'Unnamed'}</span>
                          <ChevronRight size={13} className="fli-arrow" />
                        </div>
                        <div className="fli-badges">
                          {f.cropType && <span className="field-badge crop">{f.cropType}</span>}
                          {f.soilType && <span className="field-badge soil">{f.soilType}</span>}
                          {f.irrigated && <span className="field-badge irrigated">💧 Irrigated</span>}
                        </div>
                        <div className="fli-stats">{f.areaHectares} ha · {f.perimeterKm} km</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Climate & Soil panel — auto-fetches when a field is selected ── */}
              {selectedField && (
                <FieldClimatePanel field={selectedField} />
              )}
            </div>
          </>
        )}
      </article>

      <article className="panel farm-map-panel" style={{ position: 'relative', overflow: 'visible' }}>
        <div className="panel-header">
          <span>
            {selectedFarm
              ? <><Layers size={15} style={{ display: 'inline', marginRight: 6 }} />Fields — {selectedFarm.farmName}</>
              : <><MapPin size={15} style={{ display: 'inline', marginRight: 6 }} />Map</>}
          </span>
        </div>
        <p className={`map-help-text ${selectedFarm ? '' : 'map-help-neutral'}`}>
          {selectedFarm ? 'Use the polygon tool (top-right) to draw a field, or click an existing field to edit.' : 'Select a farm from the list below to start adding fields.'}
        </p>
        <div className="location-search-row">
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLocationSearch(); } }}
            placeholder="Search address or lat, lng…" aria-label="Search location" />
          <button type="button" className="secondary-btn" onClick={handleLocationSearch} disabled={isSearching}>
            {isSearching ? <LoaderCircle size={14} className="spin" /> : 'Find'}
          </button>
        </div>
        {searchFeedback.message && <p className={`location-search-feedback ${searchFeedback.type}`}>{searchFeedback.message}</p>}

        <MapContainer className="farm-map" center={INITIAL_CENTER} zoom={13} scrollWheelZoom>
          <MapNavigator targetLocation={mapTargetLocation} />
          <FieldZoomNavigator target={fieldZoomTarget} />
          <FarmBoundsZoomer fields={farmBoundsFields} />
          {selectedFarm && (
            <FieldDrawer fields={activeFields} selectedFieldId={selectedFieldId} editingShapeId={editingShapeId}
              onPolygonDrawn={handleFieldPolygonDrawn} onPolygonEdited={handleFieldPolygonEdited} onFieldClick={handleFieldClick} />
          )}
          <LayersControl position="topleft">
            <LayersControl.BaseLayer checked name="OpenStreetMap">
              <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satellite (Esri)">
              <TileLayer attribution="Tiles &copy; Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            </LayersControl.BaseLayer>
          </LayersControl>
        </MapContainer>

        {isFieldPanelOpen && selectedFarm && (
          <FieldPropertiesPanel polygon={activeFieldPoly} existingField={selectedField}
            onSave={handleFieldSave} onCancel={handleFieldCancel} onDelete={handleFieldDelete}
            farmName={selectedFarm.farmName} onEditShape={handleEditShape} isEditingShape={editingShapeId === selectedFieldId} />
        )}
      </article>

      <article className="panel farm-list-panel">
        <div className="panel-header"><span>🏡 Saved Farms ({farms.length})</span></div>
        {farms.length === 0 ? (
          <p className="empty-state">No farms saved yet. Fill in the form above to register your first farm.</p>
        ) : (
          <div className="farm-list">
            {farms.map((farm) => (
              <div key={farm.id}
                className={`farm-list-item ${farm.id === selectedFarmId ? 'selected' : ''}`}
                onClick={() => handleFarmSelect(farm.id)}
                role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleFarmSelect(farm.id)}
                style={{ cursor: 'pointer' }}
              >
                <div className="fli-top">
                  <span className="farm-list-name">{farm.farmName}</span>
                  <span className="field-badge crop">{(farm.fields ?? []).length} field{(farm.fields ?? []).length !== 1 ? 's' : ''}</span>
                </div>
                <p className="farm-list-loc">{farm.location}</p>
                <small className="farm-list-stats">{farm.ownerName}</small>
                {(farm.fields ?? []).length > 0 && (
                  <div className="farm-field-chips">
                    {(farm.fields ?? []).map((f) => (
                      <span key={f.id} className="field-badge soil">{CROP_ICONS[f.cropType] || '🌱'} {f.fieldName}</span>
                    ))}
                  </div>
                )}
                {farm.id === selectedFarmId && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--farm-green-main)', fontWeight: 600 }}>✓ Selected — draw fields on the map</div>
                )}
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

export default FarmCreationPanel;