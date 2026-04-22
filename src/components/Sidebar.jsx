import { LayoutDashboard, Map as MapIcon, ClipboardList, Edit, Settings, Sprout, Rows3 } from 'lucide-react';
import './Sidebar.css';
import { useTranslation } from 'react-i18next';
 

function Sidebar({ activeTab, setActiveTab }) {
  const { t } = useTranslation();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1><Sprout size={24} /> {t('app_title', 'FarmPlan')}</h1>
      </div>

      <nav className="nav-links">
        <div
          className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={18} /> {t('tabs.overview', 'Overview')}
        </div>
        <div
          className={`nav-item ${activeTab === 'farm-create' ? 'active' : ''}`}
          onClick={() => setActiveTab('farm-create')}
        >
          <MapIcon size={18} /> {t('tabs.mapping', 'Field Mapping')}
        </div>
        <div
          className={`nav-item ${activeTab === 'field-create' ? 'active' : ''}`}
          onClick={() => setActiveTab('field-create')}
        >
          <Rows3 size={18} /> {t('tabs.setup', 'Field Setup')}
        </div>
        <div
          className={`nav-item ${activeTab === 'field-logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('field-logs')}
        >
          <ClipboardList size={18} /> {t('tabs.logs', 'Field Logs')}
        </div>
        {/* temporary Tab to flessh out the farm edit file */}
        <div className={`nav-item ${activeTab === 'farm-edit' ? 'active' : ''}`} onClick={() => setActiveTab('farm-edit')}>  
          <Edit size={18} /> {t('tabs.farm_edit', 'Farm Edit')}
        </div>
      </nav>

      <div className="nav-bottom">
        <div
          className={`nav-item ${activeTab === 'configuration' ? 'active' : ''}`}
          onClick={() => setActiveTab('configuration')}
        >
          <Settings size={18} /> {t('tabs.settings', 'Theme & Settings')}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;