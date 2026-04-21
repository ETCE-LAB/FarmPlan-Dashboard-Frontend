import { useState } from 'react';
import { MapPin, LoaderCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // 1. Import
import { SOIL_SERVICES } from '../data/dashboardData';
import { transformCoordinates, getPrimaryResultValue, getAttributePreview } from '../utils/soilUtils';
import './SoilLookupPanel.css';

function SoilLookupPanel() {
  const { t } = useTranslation(); // 2. Initialize
  const [lat, setLat] = useState('50.0');
  const [lon, setLon] = useState('10.0');
  const [serviceKey, setServiceKey] = useState('bodenpotenziale');
  const [loadingSoil, setLoadingSoil] = useState(false);
  const [soilError, setSoilError] = useState('');
  const [soilData, setSoilData] = useState(null);
  const [transformedPoint, setTransformedPoint] = useState(null);

  const activeService = SOIL_SERVICES[serviceKey];
  const soilResults = soilData?.results || [];

  const lookupSoilData = async () => {
    const latNum = Number(lat);
    const lonNum = Number(lon);

    if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
      setSoilError(t('soil.errors.invalid_coords', 'Please enter valid numeric coordinates.'));
      setSoilData(null);
      return;
    }

    setLoadingSoil(true);
    setSoilError('');

    try {
      const [x, y] = transformCoordinates(latNum, lonNum, activeService.spatialRef);
      setTransformedPoint({ x, y, sr: activeService.spatialRef });

      const params = new URLSearchParams({
        geometry: `${x},${y}`,
        geometryType: 'esriGeometryPoint',
        sr: activeService.spatialRef.replace('EPSG:', ''),
        layers: 'all',
        tolerance: '1',
        mapExtent: '9,50,12,53',
        imageDisplay: '800,600,96',
        returnGeometry: 'false',
        f: 'json',
      });

      const response = await fetch(`/api/bgr/arcgis/rest/services/${activeService.path}/MapServer/identify?${params.toString()}`);

      if (!response.ok) {
        throw new Error(t('soil.errors.http_fail', { status: response.status }));
      }

      const payload = await response.json();

      if (payload.error) {
        throw new Error(payload.error.message || t('soil.errors.api_error'));
      }

      setSoilData(payload);
    } catch (error) {
      setSoilData(null);
      setSoilError(error.message || t('soil.errors.generic'));
    } finally {
      setLoadingSoil(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">{t('soil.title', 'Soil API quick test')}</div>
      <div className="soil-form">
        <label>
          {t('soil.lat', 'Latitude')}
          <input value={lat} onChange={(e) => setLat(e.target.value)} type="text" placeholder="50.0" />
        </label>
        <label>
          {t('soil.lng', 'Longitude')}
          <input value={lon} onChange={(e) => setLon(e.target.value)} type="text" placeholder="10.0" />
        </label>
        <label className="soil-service-select">
          {t('soil.service_label', 'Service')}
          <select value={serviceKey} onChange={(e) => setServiceKey(e.target.value)}>
            {Object.entries(SOIL_SERVICES).map(([key, service]) => (
              <option key={key} value={key}>
                {/* We try to translate the service label, or use the default */}
                {t(`soil.services.${key}`, service.label)} ({service.spatialRef})
              </option>
            ))}
          </select>
        </label>
        <button className="soil-lookup-btn" type="button" onClick={lookupSoilData} disabled={loadingSoil}>
          {loadingSoil ? <LoaderCircle size={14} className="spin" /> : <MapPin size={14} />} 
          {t('soil.button_run', 'Run lookup')}
        </button>
      </div>

      {transformedPoint && (
        <p className="soil-meta">
          {t('soil.transformed', 'Transformed point')}: X {transformedPoint.x.toFixed(2)} / Y {transformedPoint.y.toFixed(2)} ({transformedPoint.sr})
        </p>
      )}

      {soilError && (
        <div className="soil-error">
          <AlertCircle size={14} /> {soilError}
        </div>
      )}

      {soilData && (
        <div className="soil-results-wrap">
          <p className="soil-meta">{t('soil.hits', 'API hits')}: {soilResults.length}</p>
          <div className="soil-results-list">
            {soilResults.slice(0, 6).map((result) => (
              <article key={`${result.layerId}-${result.layerName}`} className="soil-result-item">
                <h4>{result.layerName || `${t('soil.layer')} ${result.layerId}`}</h4>
                <p className="soil-main-value">{getPrimaryResultValue(result)}</p>
                <p className="soil-attr-preview">{getAttributePreview(result.attributes)}</p>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default SoilLookupPanel;