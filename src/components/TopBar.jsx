import { User, Search } from 'lucide-react';
import './TopBar.css';

// Global header with search and active-user summary.
function TopBar() {
  return (
    <header className="top-bar">
      <div className="search-box">
        <Search size={16} className="search-box-icon" />
        <input type="text" placeholder="Quick search: field id, crop, note..." />
      </div>

      <div className="top-bar-profile">
        <div className="profile-meta">
          <div className="profile-name">Markus Müllermann</div>
          <div className="profile-org">Farmer</div>
        </div>
        <div className="profile-avatar">
          <User size={20} />
        </div>
      </div>
    </header>
  );
}

export default TopBar;
