import { RefreshCw, Droplets } from 'lucide-react';
import { FIELD_LOGS } from '../data/dashboardData';
import './FieldInventoryPanel.css';

// Operational table for field status and moisture snapshots.
function FieldInventoryPanel() {
  return (
    <section className="panel">
      <div className="panel-header">
        <span>Field Table (manual check)</span>
        <button className="refresh-btn" type="button">
          <RefreshCw size={10} /> Reload demo
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Sektor ID</th>
            <th>Field Name</th>
            <th>Moisture</th>
            <th>Last Sync</th>
          </tr>
        </thead>
        <tbody>
          {FIELD_LOGS.map((log) => (
            <tr key={log.id}>
              <td className="field-id">{log.id}</td>
              <td>
                {log.name}
                <br />
                <small className="crop-name">{log.crop}</small>
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
