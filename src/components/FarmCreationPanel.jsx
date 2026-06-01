import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, LayersControl, useMap } from 'react-leaflet';
import {
  LoaderCircle, MapPin, Layers, ChevronRight,
  Wheat, Droplets, Ruler, LocateFixed, Thermometer,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';
import FieldClimatePanel from './FieldClimatePanel';   // ← NEW
import DragDropCrops from './DragDropCrops';
import Recipe from './Recipe';
import './FarmCreationPanel.css';
import { useTranslation } from 'react-i18next'; // <-- Imported useTranslation
import { getFieldHardiness } from '../utils/dashboardApi';

const INITIAL_CENTER = [52.2689, 10.5268];
const FARM_REQUIRED = ['farmName', 'ownerName', 'location', 'contactEmail'];
const DRAG_CROP_MIME = 'application/x-farm-crop';
const SOIL_OPTIONS = [
  'Sandy', 'Sandy Loam', 'Loam', 'Clay Loam', 'Clay',
  'Silt', 'Silty Loam', 'Peaty', 'Chalky', 'Other',
];

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

function isPointInPolygon(point, polygon) {
  if (!point || !polygon || polygon.length < 3) return false;

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersects =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function hasSpacingOverlap(placements, targetPoint, targetSpacingMeters) {
  return (placements || []).some((placement) => {
    const distanceM = L.latLng(placement.lat, placement.lng).distanceTo(
      L.latLng(targetPoint.lat, targetPoint.lng)
    );
    return distanceM < (placement.minimumSpacingMeters || 0) + targetSpacingMeters;
  });
}

function offsetPointByMeters(point, eastMeters, northMeters) {
  const mPerDegLat = 111320;
  const mPerDegLng = Math.cos((point.lat * Math.PI) / 180) * 111320 || 1;

  return {
    lat: point.lat + (northMeters / mPerDegLat),
    lng: point.lng + (eastMeters / mPerDegLng),
  };
}

function findAutoSpacedPoint(targetPoint, polygon, placements, spacingMeters) {
  if (!targetPoint || !polygon || polygon.length < 3) return null;
  if (isPointInPolygon(targetPoint, polygon) && !hasSpacingOverlap(placements, targetPoint, spacingMeters)) {
    return targetPoint;
  }

  const step = Math.max(spacingMeters / 2, 1);
  const maxRadius = Math.max(spacingMeters * 8, 20);
  const directions = 16;

  for (let radius = step; radius <= maxRadius; radius += step) {
    for (let index = 0; index < directions; index += 1) {
      const angle = (Math.PI * 2 * index) / directions;
      const candidate = offsetPointByMeters(
        targetPoint,
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      );

      if (!isPointInPolygon(candidate, polygon)) continue;
      if (hasSpacingOverlap(placements, candidate, spacingMeters)) continue;
      return candidate;
    }
  }

  return null;
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

function MapCropDropTarget({ onDropCrop }) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    const handleDragOver = (event) => {
      const hasCrop = event.dataTransfer?.types?.includes(DRAG_CROP_MIME)
        || event.dataTransfer?.types?.includes('application/json');
      if (!hasCrop) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (event) => {
      const payload = event.dataTransfer?.getData(DRAG_CROP_MIME)
        || event.dataTransfer?.getData('application/json');
      if (!payload) return;

      event.preventDefault();

      let crop;
      try {
        crop = JSON.parse(payload);
      } catch {
        return;
      }

      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const latLng = map.containerPointToLatLng([x, y]);

      onDropCrop(crop, { lat: latLng.lat, lng: latLng.lng });
    };

    container.addEventListener('dragover', handleDragOver);
    container.addEventListener('drop', handleDrop);

    return () => {
      container.removeEventListener('dragover', handleDragOver);
      container.removeEventListener('drop', handleDrop);
    };
  }, [map, onDropCrop]);

  return null;
}

function CropPlacementLayer({ fields, draftPolygon, draftPlacements }) {
  const map = useMap();
  const layerGroupRef = useRef(null);

  useEffect(() => {
    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    const group = layerGroupRef.current;
    group.clearLayers();

    (fields || []).forEach((field) => {
      (field.cropPlacements || []).forEach((placement) => {
        const latLng = [placement.lat, placement.lng];

        L.circle(latLng, {
          radius: placement.minimumSpacingMeters,
          color: '#16a34a',
          weight: 2,
          fillOpacity: 0.08,
        }).addTo(group);

        L.circleMarker(latLng, {
          radius: 5,
          color: '#14532d',
          weight: 2,
          fillColor: '#16a34a',
          fillOpacity: 1,
        })
          .bindTooltip(`${placement.cropName} (${placement.minimumSpacingMeters}m)`, {
            permanent: false,
            direction: 'top',
          })
          .addTo(group);
      });
    });

    const hasDraftPolygon = draftPolygon && draftPolygon.length >= 3;
    if (hasDraftPolygon) {
      (draftPlacements || []).forEach((placement) => {
        const latLng = [placement.lat, placement.lng];

        L.circle(latLng, {
          radius: placement.minimumSpacingMeters,
          color: '#0ea5e9',
          weight: 2,
          fillOpacity: 0.08,
          dashArray: '6 4',
        }).addTo(group);

        L.circleMarker(latLng, {
          radius: 5,
          color: '#0369a1',
          weight: 2,
          fillColor: '#0ea5e9',
          fillOpacity: 1,
        })
          .bindTooltip(`Draft: ${placement.cropName} (${placement.minimumSpacingMeters}m)`, {
            permanent: false,
            direction: 'top',
          })
          .addTo(group);
      });
    }
  }, [map, fields, draftPolygon, draftPlacements]);

  useEffect(() => () => {
    if (layerGroupRef.current && map.hasLayer(layerGroupRef.current)) {
      map.removeLayer(layerGroupRef.current);
      layerGroupRef.current = null;
    }
  }, [map]);

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
  const { t } = useTranslation(); // <-- Imported useTranslation

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
        layer.bindTooltip(field.fieldName || t('Unnamed field', 'Unnamed field'), { permanent: false, direction: 'center', className: 'field-tooltip' });
        layerMapRef.current[field.id] = layer;
        if (isEditingShape) layer.pm.enable({ allowSelfIntersection: false });
      }
    }
  }, [fields, selectedFieldId, editingShapeId, map, t]);

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
  farmName, onEditShape, isEditingShape, cropDropFeedback,
  recipePlants, recipeSourceLabel,
}) {
  const [form, setForm] = useState(
    existingField
      ? { fieldName: existingField.fieldName, cropType: existingField.cropType, soilType: existingField.soilType, irrigated: existingField.irrigated, notes: existingField.notes, autoSpacingEnabled: Boolean(existingField.autoSpacingEnabled) }
      : { fieldName: '', cropType: '', soilType: '', irrigated: false, notes: '', autoSpacingEnabled: true }
  );
  const [errors, setErrors] = useState({});
  const { t } = useTranslation(); // <-- Imported useTranslation

  useEffect(() => {
    if (existingField) {
      setForm({ fieldName: existingField.fieldName, cropType: existingField.cropType, soilType: existingField.soilType, irrigated: existingField.irrigated, notes: existingField.notes, autoSpacingEnabled: Boolean(existingField.autoSpacingEnabled) });
    } else {
      setForm({ fieldName: '', cropType: '', soilType: '', irrigated: false, notes: '', autoSpacingEnabled: true });
    }
    setErrors({});
  }, [existingField]);

  const area = useMemo(() => calcArea(polygon) / 10000, [polygon]);
  const perimeter = useMemo(() => calcPerimeter(polygon) / 1000, [polygon]);

  const validate = () => {
    const next = {};
    if (!form.fieldName.trim()) next.fieldName = t('Field name is required.', 'Field name is required.');
    if (!form.cropType.trim()) next.cropType = t('Please select a crop type.', 'Please select a crop type.');
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
            <div className="fpp-title">{existingField ? t('Edit Field', 'Edit Field') : t('New Field', 'New Field')}</div>
            {farmName && <div className="fpp-subtitle">{t('in', 'in')} {farmName}</div>}
          </div>
        </div>
        <button className="fpp-close" type="button" onClick={onCancel}>✕</button>
      </div>
      <div className="fpp-metrics-bar">
        <div className="fpp-metric"><Ruler size={13} /><span>{area.toFixed(2)} {t('ha', 'ha')}</span></div>
        <div className="fpp-metric-divider" />
        <div className="fpp-metric"><LocateFixed size={13} /><span>{perimeter.toFixed(2)} {t('km', 'km')}</span></div>
        <div className="fpp-metric-divider" />
        <div className="fpp-metric"><MapPin size={13} /><span>{polygon.length} {t('pts', 'pts')}</span></div>
      </div>
      <div className="fpp-body">
        <div className="fpp-field-group">
          <label className="fpp-label">{t('Field Name', 'Field Name')} <span className="fpp-req">*</span></label>
          <input
            className={`fpp-input ${errors.fieldName ? 'fpp-input-error' : ''}`}
            value={form.fieldName}
            onChange={(e) => { setForm(p => ({ ...p, fieldName: e.target.value })); if (errors.fieldName) setErrors(p => ({ ...p, fieldName: undefined })); }}
            placeholder={t('e.g., North Plot A', 'e.g., North Plot A')}
          />
          {errors.fieldName && <p className="fpp-error-msg">{errors.fieldName}</p>}
        </div>
        <div className="fpp-field-group">
          <label className="fpp-label">{t('Crop Type', 'Crop Type')} <span className="fpp-req">*</span></label>
          <DragDropCrops
            selectedCropType={form.cropType}
            crops={recipePlants}
            sourceLabel={recipeSourceLabel}
            onSelectCropType={(cropName) => {
              setForm((prev) => ({ ...prev, cropType: cropName }));
              if (errors.cropType) setErrors((prev) => ({ ...prev, cropType: undefined }));
            }}
          />
          {cropDropFeedback && <p className="ddc-map-feedback">{t(cropDropFeedback, cropDropFeedback)}</p>}
          {errors.cropType && <p className="fpp-error-msg">{errors.cropType}</p>}
        </div>
        {existingField?.soilType && (
  <div className="fpp-field-group">
    <label className="fpp-label">{t('Soil Type', 'Soil Type')}</label>
    <div className="fpp-input" style={{background:'#f8fafc', color:'#475569'}}>
      🌱 {t(existingField.soilType, existingField.soilType)} <span style={{fontSize:11, color:'#94a3b8'}}>({t('auto-detected', 'auto-detected')})</span>
    </div>
  </div>
)}
        <div className="fpp-field-group">
          <label className="fpp-label"><Droplets size={13} style={{ display: 'inline', marginRight: 4 }} />{t('Irrigation', 'Irrigation')}</label>
          <div className="fpp-toggle-row">
            <button type="button" className={`fpp-toggle-opt ${form.irrigated ? 'active' : ''}`} onClick={() => setForm(p => ({ ...p, irrigated: true }))}>
              💧 {t('Yes, irrigated', 'Yes, irrigated')}
            </button>
            <button type="button" className={`fpp-toggle-opt ${!form.irrigated ? 'active' : ''}`} onClick={() => setForm(p => ({ ...p, irrigated: false }))}>
              🌧 {t('Rain-fed only', 'Rain-fed only')}
            </button>
          </div>
        </div>
        <div className="fpp-field-group">
          <label className="fpp-label">{t('Auto spacing', 'Auto spacing')}</label>
          <div className="fpp-toggle-row">
            <button
              type="button"
              className={`fpp-toggle-opt ${form.autoSpacingEnabled ? 'active' : ''}`}
              onClick={() => setForm((p) => ({ ...p, autoSpacingEnabled: true }))}
            >
              {t('On', 'On')}
            </button>
            <button
              type="button"
              className={`fpp-toggle-opt ${!form.autoSpacingEnabled ? 'active' : ''}`}
              onClick={() => setForm((p) => ({ ...p, autoSpacingEnabled: false }))}
            >
              {t('Off', 'Off')}
            </button>
          </div>
         
        </div>
        <div className="fpp-field-group">
          <label className="fpp-label">{t('Notes', 'Notes')}</label>
          <textarea className="fpp-textarea" rows={3} value={form.notes}
            onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder={t('Soil tests, irrigation plan, observations…', 'Soil tests, irrigation plan, observations…')} />
        </div>
        {existingField && (
          <button type="button" className={`fp-edit-shape-btn ${isEditingShape ? 'active' : ''}`} onClick={() => onEditShape(existingField.id)}>
            {isEditingShape ? t('✓ Finish Reshaping', '✓ Finish Reshaping') : t('✏ Edit Shape on Map', '✏ Edit Shape on Map')}
          </button>
        )}
      </div>
      <div className="fpp-footer">
        {existingField && (
          <button type="button" className="fpp-btn fpp-btn-danger" onClick={() => onDelete(existingField.id)}>{t('Delete', 'Delete')}</button>
        )}
        <button type="button" className="fpp-btn fpp-btn-ghost" onClick={onCancel}>{t('Cancel', 'Cancel')}</button>
        <button type="button" className="fpp-btn fpp-btn-primary" onClick={handleSave}>
          <Wheat size={14} /> {t('Save Field', 'Save Field')}
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
  const [draftCropPlacements, setDraftCropPlacements] = useState([]);
  const [cropDropFeedback, setCropDropFeedback] = useState('');
  const [recipeDialogMode, setRecipeDialogMode] = useState(null);
  const [farmBoundsFields, setFarmBoundsFields] = useState(null);
  const [mapTargetLocation, setMapTargetLocation] = useState(null);
  const [fieldZoomTarget, setFieldZoomTarget] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchFeedback, setSearchFeedback] = useState({ type: '', message: '' });
  const [isSearching, setIsSearching] = useState(false);
  const [fieldHardninessData, setFieldHardninessData] = useState(null);
  const [isLoadingHardiness, setIsLoadingHardiness] = useState(false);
  const { t } = useTranslation(); // <-- Imported useTranslation

  useEffect(() => {
    if (selectedFarmId) setFormCollapsed(true);
    else setFormCollapsed(false);
  }, [selectedFarmId]);

  const selectedFarm  = farms.find((f) => f.id === selectedFarmId) ?? null;
  const selectedField = selectedFarm?.fields?.find((f) => f.id === selectedFieldId) ?? null;
  const recipePlants = selectedFarm?.recipe?.plants ?? [];
  const isFieldPanelOpen = draftFieldPolygon !== null || selectedFieldId !== null;
  const activeFieldPoly  = draftFieldPolygon ?? selectedField?.borderPolygon ?? [];
  const activeFields     = selectedFarm?.fields ?? [];

  const fetchFieldHardiness = useCallback(async (farm) => {
    if (!farm?.fields || farm.fields.length === 0) {
      setFieldHardninessData(null);
      return;
    }

    // Collect all valid polygons from fields
    const validPolygons = farm.fields
      .filter((f) => f.borderPolygon && f.borderPolygon.length >= 3)
      .map((f) => f.borderPolygon);

    if (validPolygons.length === 0) {
      setFieldHardninessData(null);
      return;
    }

    try {
      setIsLoadingHardiness(true);
      // Use the first field's polygon for now, or combine them later
      const polygon = validPolygons[0];
      // Transform from [{lat, lng}, ...] to [[lat, lng], ...]
      const polygonArray = polygon.map((point) => [point.lat, point.lng]);
      const result = await getFieldHardiness(polygonArray);
      console.log('Hardiness analysis result:', result);
      setFieldHardninessData(result);
    } catch (error) {
      console.error('Error fetching hardiness data:', error);
      setFieldHardninessData(null);
    } finally {
      setIsLoadingHardiness(false);
    }
  }, []);

  useEffect(() => {
    if (selectedFarm) {
      fetchFieldHardiness(selectedFarm);
    } else {
      setFieldHardninessData(null);
    }
  }, [selectedFarm, fetchFieldHardiness]);

  const handleFarmChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (formErrors[name]) setFormErrors((p) => ({ ...p, [name]: undefined }));
  };

  const validateFarm = () => {
    const next = {};
    FARM_REQUIRED.forEach((f) => { if (!formData[f].trim()) next[f] = t('This field is required.', 'This field is required.'); });
    if (formData.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail)) next.contactEmail = t('Please provide a valid email address.', 'Please provide a valid email address.');
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const resetFarmForm = () => { setFormData({ farmName: '', ownerName: '', location: '', contactEmail: '', notes: '' }); setFormErrors({}); };

  const handleFarmSubmit = async (e) => {
    e.preventDefault();
    if (!validateFarm()) return;
    const createdFarmId = await onCreateFarm({ id: Date.now(), ...formData, createdAt: new Date().toISOString(), fields: [], recipe: null });
    resetFarmForm();
    if (createdFarmId) setSelectedFarmId(createdFarmId);
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
    setSelectedFieldId(null); setEditingShapeId(null); setDraftFieldPolygon(null); setDraftCropPlacements([]); setCropDropFeedback('');
  }, [farms]);

  const handleFieldClick = useCallback((id) => {
    setSelectedFieldId((prev) => {
      const nextId = prev === id ? null : id;
      if (nextId !== null && selectedFarm) {
        const field = selectedFarm.fields?.find((f) => f.id === nextId);
        if (field?.borderPolygon?.length > 0) {
          const center = getPolygonCenter(field.borderPolygon);
          setFieldZoomTarget({ ...center, zoom: 20 });
        } else setFieldZoomTarget(null);
      } else setFieldZoomTarget(null);
      return nextId;
    });
    setDraftFieldPolygon(null);
    setDraftCropPlacements([]);
    setEditingShapeId(null);
    setCropDropFeedback('');
  }, [selectedFarm]);

  const handleFieldPolygonDrawn = useCallback((coords) => {
    setDraftFieldPolygon(coords); setDraftCropPlacements([]); setSelectedFieldId(null); setEditingShapeId(null); setCropDropFeedback('');
  }, []);

  const handleSoilDetected = useCallback((soilType) => {
  if (!selectedFarm || !selectedFieldId || !soilType) return;
  const updatedFields = (selectedFarm.fields ?? []).map((f) =>
    f.id === selectedFieldId
      ? { ...f, soilType }
      : f
  );
  onUpdateFarm({ ...selectedFarm, fields: updatedFields });
}, [selectedFarm, selectedFieldId, onUpdateFarm]);
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

  const handleCropDroppedOnMap = useCallback((crop, point) => {
    if (!selectedFarm) {
      setCropDropFeedback(t('Select a farm first.', 'Select a farm first.'));
      return;
    }

    const targetPolygon = draftFieldPolygon ?? selectedField?.borderPolygon ?? null;
    if (!targetPolygon || targetPolygon.length < 3) {
    const autoSpacingEnabled = Boolean(selectedField?.autoSpacingEnabled);
      setCropDropFeedback(t('Draw or select a field polygon before dropping crops.', 'Draw or select a field polygon before dropping crops.'));
      return;
    }

    if (!isPointInPolygon(point, targetPolygon)) {
      setCropDropFeedback(t());
      return;
    }

    const spacingMeters = Number(crop.minimumSpacingMeters) || 1;
    const placement = {
      id: `${crop.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      cropId: crop.id,
      cropName: crop.name,
      minimumSpacingMeters: spacingMeters,
      lat: Number(point.lat.toFixed(7)),
      lng: Number(point.lng.toFixed(7)),
    };

    if (draftFieldPolygon) {
      if (hasSpacingOverlap(draftCropPlacements, point, spacingMeters)) {
        setCropDropFeedback(`${t('Cannot place', 'Cannot place')} ${t(crop.name, crop.name)}: ${t('minimum spacing overlaps another crop.', 'minimum spacing overlaps another crop.')}`);
        return;
      }

      setDraftCropPlacements((prev) => [...prev, placement]);
      setCropDropFeedback(`${t('Placed', 'Placed')} ${t(crop.name, crop.name)} ${t('on draft field.', 'on draft field.')}`);
      return;
    }

    if (!selectedFieldId) {
      setCropDropFeedback(t('Select a field to place crops.', 'Select a field to place crops.'));
      return;
    }

    const existingPlacements = selectedField?.cropPlacements || [];
    let placementPoint = point;

    if (autoSpacingEnabled) {
      const spacedPoint = findAutoSpacedPoint(point, selectedField?.borderPolygon ?? targetPolygon, existingPlacements, spacingMeters);
      if (!spacedPoint) {
        setCropDropFeedback(`${t('Cannot auto-space', 'Cannot auto-space')} ${t(crop.name, crop.name)}: ${t('no valid location was found inside this field.', 'no valid location was found inside this field.')}`);
        return;
      }
      placementPoint = spacedPoint;
    } else if (hasSpacingOverlap(existingPlacements, point, spacingMeters)) {
      setCropDropFeedback(`${t('Cannot place', 'Cannot place')} ${t(crop.name, crop.name)}: ${t('minimum spacing overlaps another crop.', 'minimum spacing overlaps another crop.')}`);
      return;
    }

    const updatedFields = (selectedFarm.fields || []).map((field) => {
      if (field.id !== selectedFieldId) return field;
      return {
        ...field,
        cropType: crop.name,
        cropPlacements: [...existingPlacements, {
          ...placement,
          lat: Number(placementPoint.lat.toFixed(7)),
          lng: Number(placementPoint.lng.toFixed(7)),
        }],
      };
    });

    onUpdateFarm({ ...selectedFarm, fields: updatedFields });
    setCropDropFeedback(autoSpacingEnabled && (placementPoint.lat !== point.lat || placementPoint.lng !== point.lng)
      ? `${t('Auto-spaced', 'Auto-spaced')} ${t(crop.name, crop.name)} ${t('on', 'on')} ${selectedField?.fieldName || t('selected field', 'selected field')}.`
      : `${t('Placed', 'Placed')} ${t(crop.name, crop.name)} ${t('on', 'on')} ${selectedField?.fieldName || t('selected field', 'selected field')}.`);
  }, [selectedFarm, draftFieldPolygon, selectedField, selectedFieldId, draftCropPlacements, onUpdateFarm, t]);

  const handleFieldSave = (fieldData) => {
    if (!selectedFarm) return;
    let updatedFields;
    if (draftFieldPolygon) {
      updatedFields = [
        ...(selectedFarm.fields ?? []),
        {
          id: Date.now(),
          ...fieldData,
          cropPlacements: draftCropPlacements,
          createdAt: new Date().toISOString(),
        },
      ];
    } else if (selectedFieldId) {
      updatedFields = (selectedFarm.fields ?? []).map((f) => f.id === selectedFieldId ? { ...f, ...fieldData } : f);
    }
    onUpdateFarm({ ...selectedFarm, fields: updatedFields });
    setDraftFieldPolygon(null); setDraftCropPlacements([]); setSelectedFieldId(null); setEditingShapeId(null); setCropDropFeedback('');
  };

  const handleFieldDelete = (id) => {
    if (!selectedFarm) return;
    onUpdateFarm({ ...selectedFarm, fields: (selectedFarm.fields ?? []).filter((f) => f.id !== id) });
    setSelectedFieldId(null); setEditingShapeId(null); setDraftFieldPolygon(null); setDraftCropPlacements([]); setCropDropFeedback('');
  };

  const handleFieldCancel = () => { setDraftFieldPolygon(null); setDraftCropPlacements([]); setSelectedFieldId(null); setEditingShapeId(null); setCropDropFeedback(''); };

  const handleOpenRecipeDialog = (mode) => {
    if (!selectedFarm) return;
    setRecipeDialogMode(mode);
  };

  const handleSaveRecipe = (recipe) => {
    if (!selectedFarm) return;
    onUpdateFarm({ ...selectedFarm, recipe });
    setRecipeDialogMode(null);
  };

  const handleLocationSearch = async () => {
    const cleaned = searchInput.trim();
    if (!cleaned) { setSearchFeedback({ type: 'error', message: t('Enter an address or coordinates.', 'Enter an address or coordinates.') }); return; }
    const coords = parseCoordinates(cleaned);
    if (coords) { setMapTargetLocation(coords); setSearchFeedback({ type: 'success', message: `${t('Centered at', 'Centered at')} ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}.` }); return; }
    try {
      setIsSearching(true); setSearchFeedback({ type: '', message: '' });
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(cleaned)}`);
      if (!r.ok) throw new Error();
      const results = await r.json();
      if (!results.length) { setSearchFeedback({ type: 'error', message: t('No matching place found.', 'No matching place found.') }); return; }
      const { lat, lon, display_name } = results[0];
      setMapTargetLocation({ lat: Number(lat), lng: Number(lon) });
      setSearchFeedback({ type: 'success', message: `${t('Found:', 'Found:')} ${display_name}` });
    } catch { setSearchFeedback({ type: 'error', message: t('Could not search right now.', 'Could not search right now.') }); }
    finally { setIsSearching(false); }
  };

  return (
    <section className="farm-create-grid">
      <article className="panel farm-create-form-panel">
        <div className="panel-header" style={{ cursor: selectedFarm ? 'pointer' : 'default' }} onClick={() => selectedFarm && setFormCollapsed(c => !c)}>
          <span>🌾 {t('Register New Farm', 'Register New Farm')}</span>
          {selectedFarm && <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400 }}>{formCollapsed ? `▼ ${t('show', 'show')}` : `▲ ${t('hide', 'hide')}`}</span>}
        </div>

        {!formCollapsed && (
          <form className="farm-form" onSubmit={handleFarmSubmit} noValidate>
            <label htmlFor="farmName">{t('Farm Name', 'Farm Name')} *</label>
            <input id="farmName" name="farmName" value={formData.farmName} onChange={handleFarmChange} placeholder={t('e.g., Green Valley Farm', 'e.g., Green Valley Farm')} required />
            {formErrors.farmName && <p className="error-text">{formErrors.farmName}</p>}
            <label htmlFor="ownerName">{t('Owner Name', 'Owner Name')} *</label>
            <input id="ownerName" name="ownerName" value={formData.ownerName} onChange={handleFarmChange} placeholder={t('e.g., Max Mustermann', 'e.g., Max Mustermann')} required />
            {formErrors.ownerName && <p className="error-text">{formErrors.ownerName}</p>}
            <label htmlFor="location">{t('Location / Address', 'Location / Address')} *</label>
            <input id="location" name="location" value={formData.location} onChange={handleFarmChange} placeholder={t('e.g., Wolfenbüttel, Lower Saxony', 'e.g., Wolfenbüttel, Lower Saxony')} required />
            {formErrors.location && <p className="error-text">{formErrors.location}</p>}
            <label htmlFor="contactEmail">{t('Contact Email', 'Contact Email')} *</label>
            <input id="contactEmail" name="contactEmail" type="email" value={formData.contactEmail} onChange={handleFarmChange} placeholder={t('e.g., owner@farm.com', 'e.g., owner@farm.com')} required />
            {formErrors.contactEmail && <p className="error-text">{formErrors.contactEmail}</p>}
            <label htmlFor="notes">{t('Notes', 'Notes')}</label>
            <textarea id="notes" name="notes" rows={3} value={formData.notes} onChange={handleFarmChange} placeholder={t('Optional details…', 'Optional details…')} />
            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={resetFarmForm}>{t('Reset', 'Reset')}</button>
              <button type="submit" className="primary-btn">{t('Save Farm', 'Save Farm')}</button>
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
                <p className="farm-detail-meta"><strong>{t('Owner', 'Owner')}</strong><span>{selectedFarm.ownerName}</span></p>
                <p className="farm-detail-meta"><strong>{t('Location', 'Location')}</strong><span>{selectedFarm.location}</span></p>
                <p className="farm-detail-meta"><strong>{t('Email', 'Email')}</strong><span>{selectedFarm.contactEmail}</span></p>
                {selectedFarm.notes && <p className="farm-detail-meta"><strong>{t('Notes', 'Notes')}</strong><span>{selectedFarm.notes}</span></p>}
              </div>
              <div className="farm-detail-divider" />
              <div className="recipe-choice-panel">
                <div className="recipe-choice-header">
                  <strong>{t('Recipe setup', 'Recipe setup')}</strong>
                  <span>{selectedFarm.recipe ? t('A recipe already exists for this farm.', 'A recipe already exists for this farm.') : t('Create a recipe to define which plants can be dragged into this farm.', 'Create a recipe to define which plants can be dragged into this farm.')}</span>
                </div>
                <div className="recipe-choice-actions">
                  <button type="button" className="recipe-choice-btn" onClick={() => handleOpenRecipeDialog('create')}>
                    {t('Create new recipe', 'Create new recipe')}
                  </button>
                  {selectedFarm.recipe && (
                    <button type="button" className="recipe-choice-btn secondary" onClick={() => handleOpenRecipeDialog('edit')}>
                      {t('Edit recipe', 'Edit recipe')}
                    </button>
                  )}
                </div>
              </div>
              <div className="farm-fields-summary">
                <div className="fields-count-header">
                  <strong>{t('Fields', 'Fields')}</strong>
                  <span className="fields-badge">{(selectedFarm.fields ?? []).length}</span>
                </div>
                {(selectedFarm.fields ?? []).length === 0 ? (
                  <p className="empty-state">{t('No fields yet — draw a polygon on the map.', 'No fields yet — draw a polygon on the map.')}</p>
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
                          <span className="fli-name fli-name-zoomable" title={t('Click to zoom to this field', 'Click to zoom to this field')}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (f.borderPolygon?.length > 0) {
                                const bb = getBoundingBox([f]);
                                setFieldZoomTarget({ lat: (bb.minLat + bb.maxLat) / 2, lng: (bb.minLng + bb.maxLng) / 2, zoom: 20 });
                                setFarmBoundsFields(null);
                              }
                            }}
                          >{f.fieldName || t('Unnamed', 'Unnamed')}</span>
                          <ChevronRight size={13} className="fli-arrow" />
                        </div>
                        <div className="fli-badges">
                          {f.cropType && <span className="field-badge crop">{t(f.cropType, f.cropType)}</span>}
                          {f.soilType && <span className="field-badge soil">{t(f.soilType, f.soilType)}</span>}
                          {f.irrigated && <span className="field-badge irrigated">💧 {t('Irrigated', 'Irrigated')}</span>}
                        </div>
                        <div className="fli-stats">{f.areaHectares} {t('ha', 'ha')} · {f.perimeterKm} {t('km', 'km')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Climate & Soil panel — auto-fetches when a field is selected ── */}
              {selectedField && (
                <FieldClimatePanel field={selectedField}
                onSoilDetected={handleSoilDetected}
                fieldHardinessData={fieldHardninessData}
                isLoadingHardiness={isLoadingHardiness}
                 />
              )}
            </div>
          </>
        )}
      </article>

      <article className="panel farm-map-panel" style={{ position: 'relative', overflow: 'visible' }}>
        <div className="panel-header">
          <span>
            {selectedFarm
              ? <><Layers size={15} style={{ display: 'inline', marginRight: 6 }} />{t('Fields', 'Fields')} — {selectedFarm.farmName}</>
              : <><MapPin size={15} style={{ display: 'inline', marginRight: 6 }} />{t('Map', 'Map')}</>}
          </span>
        </div>
        <div className="location-search-row">
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLocationSearch(); } }}
            placeholder={t('Search address or lat, lng…', 'Search address or lat, lng…')} aria-label={t('Search location', 'Search location')} />
          <button type="button" className="secondary-btn" onClick={handleLocationSearch} disabled={isSearching}>
            {isSearching ? <LoaderCircle size={14} className="spin" /> : t('Find', 'Find')}
          </button>
        </div>
        {searchFeedback.message && <p className={`location-search-feedback ${searchFeedback.type}`}>{searchFeedback.message}</p>}

        <MapContainer className="farm-map" center={INITIAL_CENTER} zoom={13} scrollWheelZoom maxZoom={22}>
          <MapNavigator targetLocation={mapTargetLocation} />
          <FieldZoomNavigator target={fieldZoomTarget} />
          <FarmBoundsZoomer fields={farmBoundsFields} />
          <MapCropDropTarget onDropCrop={handleCropDroppedOnMap} />
          <CropPlacementLayer
            fields={activeFields}
            draftPolygon={draftFieldPolygon}
            draftPlacements={draftCropPlacements}
          />
          {selectedFarm && (
            <FieldDrawer fields={activeFields} selectedFieldId={selectedFieldId} editingShapeId={editingShapeId}
              onPolygonDrawn={handleFieldPolygonDrawn} onPolygonEdited={handleFieldPolygonEdited} onFieldClick={handleFieldClick} />
          )}
<LayersControl position="topleft">
  <LayersControl.BaseLayer name={t('OpenStreetMap', 'OpenStreetMap')}>
    <TileLayer
      attribution='&copy; OpenStreetMap contributors'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      maxZoom={19}
    />
  </LayersControl.BaseLayer>
  <LayersControl.BaseLayer name={t('Satellite (Esri)', 'Satellite (Esri)')}>
    <TileLayer
      attribution="Tiles &copy; Esri"
      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      maxZoom={19}
    />
  </LayersControl.BaseLayer>
  <LayersControl.BaseLayer checked name={t('Satellite HD (Google)', 'Satellite HD (Google)')}>
    <TileLayer
      attribution="&copy; Google Maps"
      url="https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
      maxZoom={22}
    />
  </LayersControl.BaseLayer>
  <LayersControl.BaseLayer name={t('Hybrid (Google)', 'Hybrid (Google)')}>
    <TileLayer
      attribution="&copy; Google Maps"
      url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
      maxZoom={22}
    />
  </LayersControl.BaseLayer>
</LayersControl>
        </MapContainer>

        {isFieldPanelOpen && selectedFarm && (
          <FieldPropertiesPanel polygon={activeFieldPoly} existingField={selectedField}
            onSave={handleFieldSave} onCancel={handleFieldCancel} onDelete={handleFieldDelete}
            farmName={selectedFarm.farmName} onEditShape={handleEditShape}
            isEditingShape={editingShapeId === selectedFieldId}
            cropDropFeedback={cropDropFeedback}
            recipePlants={recipePlants}
            recipeSourceLabel={selectedFarm?.recipe ? (selectedFarm.recipe.name || selectedFarm.farmName || '') : undefined}
          />
        )}

        {selectedFarm && recipeDialogMode && (
          <Recipe
            open
            mode={recipeDialogMode}
            farmName={selectedFarm.farmName}
            initialRecipe={selectedFarm.recipe}
            onClose={() => setRecipeDialogMode(null)}
            onSave={handleSaveRecipe}
          />
        )}
      </article>

      <article className="panel farm-list-panel">
        <div className="panel-header"><span>🏡 {t('Saved Farms', 'Saved Farms')} ({farms.length})</span></div>
        {farms.length === 0 ? (
          <p className="empty-state">{t('No farms saved yet. Fill in the form above to register your first farm.', 'No farms saved yet. Fill in the form above to register your first farm.')}</p>
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
                  <span className="field-badge crop">{(farm.fields ?? []).length} {t('field', 'field')}{(farm.fields ?? []).length !== 1 ? t('s', 's') : ''}</span>
                </div>
                <p className="farm-list-loc">{farm.location}</p>
                <small className="farm-list-stats">{farm.ownerName}</small>
                {(farm.fields ?? []).length > 0 && (
                  <div className="farm-field-chips">
                  </div>
                )}
                {farm.id === selectedFarmId && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--farm-green-main)', fontWeight: 600 }}>✓ {t('Selected — draw fields on the map', 'Selected — draw fields on the map')}</div>
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