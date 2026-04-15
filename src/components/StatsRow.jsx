import { STATS } from '../data/dashboardData';
import './StatsRow.css';

// KPI cards rendered from shared stat definitions.
function StatsRow() {
  return (
    <div className="stats-row">
      {STATS.map((stat) => (
        <div key={stat.label} className="card">
          <span className="card-label">{stat.label}</span>
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
