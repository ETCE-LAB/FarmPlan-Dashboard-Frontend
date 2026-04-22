import { Map, Tractor, Scaling, Maximize } from 'lucide-react';
import { useTranslation } from 'react-i18next';
// If your friend had a StatsRow.css file, keep this import! If not, you can delete it.
import './StatsRow.css'; 

function StatsRow({ farms = [] }) {
  const { t } = useTranslation();

  // 1. Calculate the real math from your Firebase database!
  const totalArea = farms.reduce((sum, farm) => sum + (Number(farm.areaHectares) || 0), 0);
  const fieldCount = farms.length;
  const avgSize = fieldCount > 0 ? totalArea / fieldCount : 0;
  const largestSize = fieldCount > 0 ? Math.max(...farms.map(f => Number(f.areaHectares) || 0)) : 0;

  return (
    <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
      
      {/* Box 1: Total Area */}
      <div className="panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ backgroundColor: 'var(--farm-green-soft)', color: 'var(--farm-green-main)', padding: '12px', borderRadius: '8px', display: 'flex' }}>
          <Map size={24} />
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>
            {t('stats.total_area', 'Total Area')}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--heading-main)' }}>
            {totalArea.toFixed(1)} ha
          </div>
        </div>
      </div>

      {/* Box 2: Total Farms */}
      <div className="panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ backgroundColor: 'var(--surface-alt)', color: '#2196f3', padding: '12px', borderRadius: '8px', display: 'flex' }}>
          <Tractor size={24} />
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>
            {t('stats.field_count', 'Total Farms')}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--heading-main)' }}>
            {fieldCount}
          </div>
        </div>
      </div>

      {/* Box 3: Average Size */}
      <div className="panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ backgroundColor: 'var(--surface-alt)', color: '#ff9800', padding: '12px', borderRadius: '8px', display: 'flex' }}>
          <Scaling size={24} />
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>
            {t('stats.avg_size', 'Average Size')}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--heading-main)' }}>
            {avgSize.toFixed(1)} ha
          </div>
        </div>
      </div>

      {/* Box 4: Largest Farm */}
      <div className="panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ backgroundColor: 'var(--surface-alt)', color: '#9c27b0', padding: '12px', borderRadius: '8px', display: 'flex' }}>
          <Maximize size={24} />
        </div>
        <div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '4px' }}>
            {t('stats.largest_farm', 'Largest Farm')}
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--heading-main)' }}>
            {largestSize.toFixed(1)} ha
          </div>
        </div>
      </div>

    </div>
  );
}

export default StatsRow;