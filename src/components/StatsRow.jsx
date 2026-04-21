import { useTranslation } from 'react-i18next'; // 1. Import
import { STATS } from '../data/dashboardData';
import './StatsRow.css';

function StatsRow() {
  const { t } = useTranslation(); // 2. Initialize

  return (
    <div className="stats-row">
      {STATS.map((stat) => (
        <div key={stat.label} className="card">
          {/* 3. Use the label string as a key for translation */}
          <span className="card-label">
            {t(`stats.${stat.label.toLowerCase().replace(/\s+/g, '_')}`, stat.label)}
          </span>
          <div className="card-content">
            <span className="card-value">{stat.value}</span>
            <span className="card-unit">{stat.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default StatsRow;