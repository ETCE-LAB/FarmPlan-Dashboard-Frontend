import { MapPin, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next'; 
import './FieldInventoryPanel.css';

// 1. Accept the live Firebase data as a prop
function FieldInventoryPanel({ farms = [] }) {
  const { t } = useTranslation(); 

  return (
    <section className="panel">
      <div className="panel-header">
        <span>{t('overview.inventory.title', 'Farm Inventory')}</span>
        
        {/* Replaced the fake "Reload" button with a Live Status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--farm-green-main)' }}>
          <CheckCircle2 size={14} />
          {t('overview.inventory.live', 'Live Sync')}
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>{t('overview.inventory.sector_id', 'Farm ID')}</th>
            <th>{t('overview.inventory.field_name', 'Farm Name')}</th>
            {/* Swapped Moisture/Sync for the real data we have: Area and Location */}
            <th>{t('overview.inventory.area', 'Area')}</th>
            <th>{t('overview.inventory.location', 'Location')}</th>
          </tr>
        </thead>
        <tbody>
          {farms.length === 0 ? (
            <tr>
              <td colSpan="4" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                {t('overview.inventory.empty', 'No farms created yet. Draw one in the Setup tab.')}
              </td>
            </tr>
          ) : (
            farms.map((farm) => (
              <tr key={farm.id}>
                {/* Firebase IDs are long strings, so we slice the first 5 characters for a clean Sector ID */}
                <td className="field-id">#{farm.id.substring(0, 5).toUpperCase()}</td>
                
                <td>
                  {farm.farmName}
                  <br />
                  {/* Reusing your friend's crop-name class to display the Owner Name cleanly */}
                  <small className="crop-name">{farm.ownerName}</small>
                </td>
                
                <td>
                  {/* Reusing the moisture-row class so it aligns nicely */}
                  <div className="moisture-row" style={{ fontWeight: '500' }}>
                    {Number(farm.areaHectares || 0).toFixed(2)} ha
                  </div>
                </td>
                
                <td className="last-update">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={12} style={{ color: 'var(--text-muted)' }} /> 
                    {farm.location || t('overview.inventory.no_location', 'N/A')}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

export default FieldInventoryPanel;