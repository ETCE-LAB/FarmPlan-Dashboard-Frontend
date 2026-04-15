import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { PERFORMANCE_DATA } from '../data/dashboardData';
import './YieldChartPanel.css';

// Compact trend chart for weekly yield index values.
function YieldChartPanel() {
  return (
    <section className="panel">
      <div className="panel-header">Yield Growth Index</div>
      <div className="yield-chart-wrap">
        <ResponsiveContainer>
          <BarChart data={PERFORMANCE_DATA}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <Tooltip
              cursor={{ fill: 'var(--chart-cursor)' }}
              contentStyle={{
                background: 'var(--panel-bg)',
                border: '1px solid var(--panel-border)',
                borderRadius: '6px',
                color: 'var(--text-main)',
              }}
              labelStyle={{ color: 'var(--text-main)' }}
            />
            <Bar dataKey="value" fill="var(--farm-green-main)" radius={[2, 2, 0, 0]} barSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default YieldChartPanel;
