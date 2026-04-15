import { useMemo, useState } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import StatsRow from './components/StatsRow';
import FieldInventoryPanel from './components/FieldInventoryPanel';
import SoilLookupPanel from './components/SoilLookupPanel';
import YieldChartPanel from './components/YieldChartPanel';
import FarmCreationPanel from './components/FarmCreationPanel';
import ThemeConfigurationPanel from './components/ThemeConfigurationPanel';

const LIGHT_THEME_DEFAULTS = {
  mode: 'light',
  primary: '#2e7d32',
  sidebar: '#1b5e20',
  background: '#f8faf8',
  panel: '#ffffff',
};

const DARK_THEME_DEFAULTS = {
  mode: 'dark',
  primary: '#66bb6a',
  sidebar: '#0f3d12',
  background: '#0f1410',
  panel: '#1a241a',
};

function hexToRgb(hexColor) {
  if (!hexColor) {
    return null;
  }

  const hex = hexColor.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return null;
  }

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function withAlpha(hexColor, alpha) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) {
    return `rgba(0, 0, 0, ${alpha})`;
  }

  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function getAccessibleTextColor(hexColor) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) {
    return '#ffffff';
  }

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? '#172317' : '#ffffff';
}

function getThemeDefaultsByMode(mode) {
  return mode === 'dark' ? DARK_THEME_DEFAULTS : LIGHT_THEME_DEFAULTS;
}

function buildThemeVariables(theme) {
  const isDark = theme.mode === 'dark';
  const sidebarText = getAccessibleTextColor(theme.sidebar);

  return {
    '--farm-green-main': theme.primary,
    '--farm-green-dark': theme.sidebar,
    '--farm-green-soft': withAlpha(theme.primary, isDark ? 0.2 : 0.12),
    '--bg-main': theme.background,
    '--panel-bg': theme.panel,
    '--panel-border': isDark ? '#334033' : '#dce3dc',
    '--panel-divider': isDark ? '#2a332a' : '#eeeeee',
    '--surface-alt': isDark ? '#202b20' : '#f9faf9',
    '--surface-alt-2': isDark ? '#1a231a' : '#fafbfa',
    '--input-bg': isDark ? '#1e2a1f' : '#ffffff',
    '--input-border': isDark ? '#3a473a' : '#dce3dc',
    '--text-main': isDark ? '#e2ebe2' : '#2c312c',
    '--text-muted': isDark ? '#a5b2a5' : '#6a736a',
    '--heading-main': isDark ? '#f5f7f5' : '#111111',
    '--danger-bg': isDark ? '#3b2323' : '#fff2f2',
    '--danger-border': isDark ? '#7d4141' : '#f1d2d2',
    '--danger-text': isDark ? '#ffb8b8' : '#8d2f2f',
    '--chart-grid': isDark ? '#374437' : '#eeeeee',
    '--chart-cursor': isDark ? 'rgba(102, 187, 106, 0.16)' : '#f1f8f1',
    '--sidebar-text': sidebarText,
    '--sidebar-text-muted': withAlpha(sidebarText, 0.78),
    '--sidebar-hover-bg': withAlpha(sidebarText, 0.12),
  };
}

// App is intentionally thin: it composes page-level sections and only keeps
// truly global UI state (currently the active sidebar tab).
function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [farms, setFarms] = useState([]);
  const [theme, setTheme] = useState(LIGHT_THEME_DEFAULTS);

  const themeVariables = useMemo(() => buildThemeVariables(theme), [theme]);

  const handleCreateFarm = (newFarm) => {
    setFarms((previous) => [newFarm, ...previous]);
  };

  const handleThemeModeChange = (nextMode) => {
    setTheme(getThemeDefaultsByMode(nextMode));
  };

  const handleThemeColorChange = (colorKey, colorValue) => {
    setTheme((previous) => ({
      ...previous,
      [colorKey]: colorValue,
    }));
  };

  const handleThemeReset = () => {
    setTheme(getThemeDefaultsByMode(theme.mode));
  };

  const getPageMeta = () => {
    switch (activeTab) {
      case 'farm-create':
        return {
          title: 'Farm Setup',
          subtitle: 'Fill the basics and draw your farm border on the map.',
        };
      case 'overview':
        return {
          title: 'Project Overview',
          subtitle: 'Demo data mode: local + API tests',
        };
      case 'configuration':
        return {
          title: 'Theme Playground',
          subtitle: 'Try your own colors and quickly switch dark and light mode.',
        };
      default:
        return {
          title: 'Dashboard',
          subtitle: 'This section is under development.',
        };
    }
  };

  const pageMeta = getPageMeta();

  return (
    <div className={`layout ${theme.mode === 'dark' ? 'theme-dark' : 'theme-light'}`} style={themeVariables}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="main-panel">
        <TopBar />

        <div className="dashboard-container">
          <div className="page-header">
            <h2>{pageMeta.title}</h2>
            <p className="page-subtitle">
              <span className="page-subtitle-dot">●</span>
              {pageMeta.subtitle}
            </p>
          </div>

          {activeTab === 'overview' && (
            <>
              <StatsRow />

              <div className="content-grid">
                {/* Left: operational table. Right: analytics + API tools. */}
                <FieldInventoryPanel />

                <div className="panel-column">
                  <SoilLookupPanel />
                  <YieldChartPanel />
                </div>
              </div>
            </>
          )}

          {activeTab === 'farm-create' && (
            <FarmCreationPanel onCreateFarm={handleCreateFarm} farms={farms} />
          )}

          {activeTab === 'configuration' && (
            <ThemeConfigurationPanel
              theme={theme}
              onModeChange={handleThemeModeChange}
              onColorChange={handleThemeColorChange}
              onResetTheme={handleThemeReset}
            />
          )}

          {activeTab !== 'overview' && activeTab !== 'farm-create' && activeTab !== 'configuration' && (
            <section className="panel">
              <div className="panel-header">This module is coming soon</div>
              <p>Use the Farm Setup tab to register a farm and draw its boundary polygon.</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
