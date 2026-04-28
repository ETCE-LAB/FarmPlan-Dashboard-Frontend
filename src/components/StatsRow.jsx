import './StatsRow.css';

// KPI cards rendered from shared stat definitions.
function StatsRow({ stats = [], isLoading = false }) {
  return (
    <div className="stats-row">
      {stats.map((stat) => (
        <div key={stat.label} className="card">
          <span className="card-label">{stat.label}</span>
          <div className="card-content">
            <span className="card-value">{stat.value}</span>
            <span className="card-unit">{stat.unit}</span>
          </div>
        </div>
      ))}
      {stats.length === 0 && (
        <div className="card">
          <span className="card-label">Treeline Stats</span>
          <div className="card-content">
            <span className="card-value">{isLoading ? '...' : '0'}</span>
            <span className="card-unit">rows</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default StatsRow;
