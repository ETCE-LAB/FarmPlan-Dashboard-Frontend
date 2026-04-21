import { RefreshCw, Droplets } from 'lucide-react';
import { useTranslation } from 'react-i18next'; // 1. Import hook
import { FIELD_LOGS } from '../data/dashboardData';
import './FieldInventoryPanel.css';

function FieldInventoryPanel() {
  const { t } = useTranslation(); // 2. Initialize translation

  return (
    <section className="panel">
      <div className="panel-header">
        {/* 3. Wrap all strings in t() */}
        <span>{t('overview.inventory.title', 'Field Table (manual check)')}</span>
        <button className="refresh-btn" type="button">
          <RefreshCw size={10} /> {t('overview.inventory.reload', 'Reload demo')}
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>{t('overview.inventory.sector_id', 'Sektor ID')}</th>
            <th>{t('overview.inventory.field_name', 'Field Name')}</th>
            <th>{t('overview.inventory.moisture', 'Moisture')}</th>
            <th>{t('overview.inventory.last_sync', 'Last Sync')}</th>
          </tr>
        </thead>
        <tbody>
          {FIELD_LOGS.map((log) => (
            <tr key={log.id}>
              <td className="field-id">{log.id}</td>
              <td>
                {log.name}
                <br />
                {/* Optional: Translate crop names if they are keys in your JSON */}
                <small className="crop-name">{t(`crops.${log.crop.toLowerCase()}`, log.crop)}</small>
              </td>
              <td>
                <div className="moisture-row">
                  <Droplets size={12} color="#2196f3" /> {log.moisture}
                </div>
              </td>
              <td className="last-update">{log.lastUpdate}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export default FieldInventoryPanel;