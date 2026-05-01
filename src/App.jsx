import { useMemo, useState, useEffect, useCallback } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import StatsRow from './components/StatsRow';
import SoilLookupPanel from './components/SoilLookupPanel';
import YieldChartPanel from './components/YieldChartPanel';
import FarmCreationPanel from './components/FarmCreationPanel';
import FarmEditPanel from './components/FarmEditPanel';
import ThemeConfigurationPanel from './components/ThemeConfigurationPanel';
// import FieldCreationPanel from './components/FieldCreationPanel'; // Uncomment when ready
import PlantsPanel from './components/PlantsPanel';
import FieldInventoryPanel from './components/FieldInventoryPanel'; 
import { useTranslation } from 'react-i18next';

// --- FIREBASE IMPORTS ---
import { db } from './firebase'; 
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { getTreelineOverview, getTreelineRecords, importTreelineCsv } from './utils/dashboardApi';

// --- THEME UTILS ---
const LIGHT_THEME_DEFAULTS = { mode: 'light', primary: '#2e7d32', sidebar: '#1b5e20', background: '#f8faf8', panel: '#ffffff' };
const DARK_THEME_DEFAULTS = { mode: 'dark', primary: '#66bb6a', sidebar: '#0f3d12', background: '#0f1410', panel: '#1a241a' };

function hexToRgb(hexColor) {
  if (!hexColor) return null;
  const hex = hexColor.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return null;
  return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
}

function withAlpha(hexColor, alpha) {
  const rgb = hexToRgb(hexColor);
  return rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})` : `rgba(0, 0, 0, ${alpha})`;
}

function getAccessibleTextColor(hexColor) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return '#ffffff';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? '#172317' : '#ffffff';
}

function buildThemeVariables(theme) {
  const isDark = theme.mode === 'dark';
  const sidebarText = getAccessibleTextColor(theme.sidebar);
  return {
    '--farm-green-main': theme.primary,
    '--farm-green-dark': theme.sidebar,
    '--bg-main': theme.background,
    '--panel-bg': theme.panel,
    '--text-main': isDark ? '#e2ebe2' : '#2c312c',
    '--sidebar-text': sidebarText,
    // ... add other variables as needed
  };
}

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [farms, setFarms] = useState([]);
  const [theme, setTheme] = useState(LIGHT_THEME_DEFAULTS);
  
  // API State
  const [overviewData, setOverviewData] = useState({ stats: [], performance: [], meta: null });
  const [tableData, setTableData] = useState({ records: [], options: { categories: [], strata: [] }, pagination: { page: 1, limit: 10, total: 0 } });
  const [tableFilters, setTableFilters] = useState({ search: '', category: 'all', strata: 'all', page: 1, limit: 10 });
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const [tableError, setTableError] = useState('');

  const themeVariables = useMemo(() => buildThemeVariables(theme), [theme]);

  // --- FIREBASE SYNC ---
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'farms'), (snapshot) => {
      setFarms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // --- DATA LOADING ---
  const loadOverviewData = useCallback(async () => {
    setIsOverviewLoading(true);
    try {
      const payload = await getTreelineOverview();
      setOverviewData({ stats: payload.stats || [], performance: payload.performance || [], meta: payload.meta || null });
    } catch (e) { setOverviewError(e.message); }
    finally { setIsOverviewLoading(false); }
  }, []);

  const loadTableData = useCallback(async (filters) => {
    setIsTableLoading(true);
    try {
      const payload = await getTreelineRecords(filters);
      setTableData(prev => ({ ...prev, records: payload.records || [], pagination: payload.pagination }));
    } catch (e) { setTableError(e.message); }
    finally { setIsTableLoading(false); }
  }, []);

  useEffect(() => { loadOverviewData(); }, [loadOverviewData]);
  useEffect(() => { loadTableData(tableFilters); }, [tableFilters, loadTableData]);

  // --- HANDLERS ---
  const handleCreateFarm = async (newFarm) => {
    const { id, ...data } = newFarm;
    await addDoc(collection(db, 'farms'), data);
  };

  const handleUpdateFarm = async (id, data) => await updateDoc(doc(db, 'farms', id), data);
  const handleDeleteFarm = async (id) => await deleteDoc(doc(db, 'farms', id));

  const getPageMeta = () => {
    switch (activeTab) {
      case 'farm-create': return { title: 'Farm Setup', subtitle: 'Draw your farm border on the map.' };
      case 'farm-edit': return { title: t('tabs.farm_edit', 'Farm Edit'), subtitle: 'Edit or delete existing farms.' };
      case 'plants': return { title: 'Plants Inventory', subtitle: 'Search and browse plants.' };
      case 'configuration': return { title: 'Settings', subtitle: 'Manage themes and preferences.' };
      default: return { title: 'Project Overview', subtitle: 'Connected to Live Database' };
    }
  };

  const meta = getPageMeta();

  return (
    <div className={`layout theme-${theme.mode}`} style={themeVariables}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="main-panel">
        <TopBar />
        
        <div className="dashboard-container">
          <div className="page-header">
            <h2>{meta.title}</h2>
            <p className="page-subtitle"><span>●</span> {meta.subtitle}</p>
          </div>

          {activeTab === 'overview' && (
            <div className="overview-section">
              <StatsRow farms={farms} />
              <div className="content-grid">
                <FieldInventoryPanel farms={farms} />
                <div className="panel-column">
                  <SoilLookupPanel farms={farms} />
                  <YieldChartPanel farms={farms} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'farm-create' && <FarmCreationPanel onCreateFarm={handleCreateFarm} farms={farms} />}

          {activeTab === 'farm-edit' && (
            <FarmEditPanel farms={farms} onUpdateFarm={handleUpdateFarm} onDeleteFarm={handleDeleteFarm} />
          )}

          {activeTab === 'plants' && (
            <PlantsPanel 
              rows={tableData.records} 
              filters={tableFilters} 
              pagination={tableData.pagination}
              onSearch={(s) => setTableFilters(p => ({...p, search: s, page: 1}))}
              onPageChange={(p) => setTableFilters(prev => ({...prev, page: p}))}
              isLoading={isTableLoading}
            />
          )}

          {activeTab === 'configuration' && (
            <ThemeConfigurationPanel 
              theme={theme} 
              onModeChange={(m) => setTheme(DARK_THEME_DEFAULTS)} // Simplified for example
              onResetTheme={() => setTheme(LIGHT_THEME_DEFAULTS)}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;