import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts';
import { useTranslation } from 'react-i18next';
import './YieldChartPanel.css';

// 1. Add `farms` to the props so we can receive the live Firebase data
function YieldChartPanel({ farms = [] }) {
  const { t } = useTranslation(); 

  // 2. Transform your real data into the exact format Recharts needs
  const chartData = farms.map((farm) => ({
    name: farm.farmName || 'Unnamed Farm',
    area: Number(farm.areaHectares) || 0
  }));

  return (
    <section className="panel">
      {/* 3. Update the header to reflect our real data */}
      <div className="panel-header">{t('overview.chart.title', 'Farm Area Comparison (ha)')}</div>
      
      <div className="yield-chart-wrap" style={{ minHeight: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        
        {/* 4. Show a friendly message if the database is empty */}
        {chartData.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            {t('overview.chart.empty', 'No farm data to chart yet.')}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            {/* 5. Feed your real chartData into the BarChart */}
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
              
              {/* XAxis now shows the farm 'name' */}
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }} 
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
                labelStyle={{ color: 'var(--text-main)', fontWeight: 'bold', marginBottom: '4px' }}
                // Make the tooltip show the area with "ha"
                formatter={(value) => [`${value.toFixed(2)} ha`, t('overview.chart.area', 'Area')]}
              />
              
              {/* The bars are now mapped to the 'area' of the farm */}
              <Bar dataKey="area" fill="var(--farm-green-main)" radius={[2, 2, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

export default YieldChartPanel;