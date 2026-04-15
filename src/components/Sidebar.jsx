import { LayoutDashboard, Map as MapIcon, ClipboardList, Settings, Sprout } from 'lucide-react';
import './Sidebar.css';

// Left-side application navigation.
function Sidebar({ activeTab, setActiveTab }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1><Sprout size={24} /> FarmPlan</h1>
        <p className="sidebar-version">v0.3 student build</p>
      </div>

      <nav className="nav-links">
        <div
          className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <LayoutDashboard size={18} /> Overview
        </div>
        <div
          className={`nav-item ${activeTab === 'farm-create' ? 'active' : ''}`}
          onClick={() => setActiveTab('farm-create')}
        >
          <MapIcon size={18} /> Field Mapping
        </div>
        <div className={`nav-item ${activeTab === 'field-logs' ? 'active' : ''}`} onClick={() => setActiveTab('field-logs')}>
          <ClipboardList size={18} /> Field Logs
        </div>
      </nav>

      <div className="nav-bottom">
        <div className={`nav-item ${activeTab === 'configuration' ? 'active' : ''}`} onClick={() => setActiveTab('configuration')}>
          <Settings size={18} /> Theme & Settings
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
