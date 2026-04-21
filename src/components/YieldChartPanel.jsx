import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { useTranslation } from 'react-i18next'; // 1. Import
import { PERFORMANCE_DATA } from '../data/dashboardData';
import './YieldChartPanel.css';

function YieldChartPanel() {
  const { t } = useTranslation(); // 2. Initialize

  return (
    <section className="panel">
      {/* 3. Translate Header */}
      <div className="panel-header">{t('charts.yield_title', 'Yield Growth Index')}</div>
      
      <div className="yield-chart-wrap">
        <ResponsiveContainer>
          <BarChart data={PERFORMANCE_DATA}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
            <XAxis 
              dataKey="week" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }} 
              // Optional: If you want to translate "Week 1" to "Woche 1"
              tickFormatter={(value) => `${t('charts.week_label', 'Week')} ${value.replace('Week ', '')}`}
            />
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
              // Translates the "Value" label inside the tooltip
              formatter={(value) => [value, t('charts.value_label', 'Index Value')]}
            />
            <Bar dataKey="value" fill="var(--farm-green-main)" radius={[2, 2, 0, 0]} barSize={30} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export default YieldChartPanel;