import React, { useState } from 'react';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import './FieldInventoryPanel.css';

function PlantsPanel({
  rows = [],
  filters = { search: '', category: 'all', strata: 'all', hardiness: 'all', limit: 10 },
  options = { categories: [], strata: [], hardinessZones: [] },
  pagination = { page: 1, totalPages: 1, total: 0, hasPrev: false, hasNext: false },
  onSearch,
  onCategoryChange,
  onStrataChange,
  onHardinessChange,
  onLimitChange,
  onPageChange,
  onReload,
  isLoading = false,
}) {
  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [expandedRowId, setExpandedRowId] = useState(null);

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (onSearch) onSearch(searchInput.trim());
  };

  const toggleRow = (id) => {
    setExpandedRowId(expandedRowId === id ? null : id);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <span>Treeline Plants Explorer</span>
        <button className="refresh-btn" type="button" onClick={onReload} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} style={{ marginRight: '6px' }} /> 
          {isLoading ? 'Loading...' : 'Reload CSV'}
        </button>
      </div>

      <div className="table-toolbar">
        <form className="search-wrap" onSubmit={handleSearchSubmit}>
          <input className="table-control" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search species..." />
          <button className="search-btn" type="submit">Search</button>
        </form>

        <select className="table-control" value={filters.category} onChange={(event) => onCategoryChange && onCategoryChange(event.target.value)}>
          <option value="all">All types</option>
          {(options?.categories || []).map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>

        <select className="table-control" value={filters.strata} onChange={(event) => onStrataChange && onStrataChange(event.target.value)}>
          <option value="all">All strata</option>
          {(options?.strata || []).map((strata) => (
            <option key={strata} value={strata}>{strata}</option>
          ))}
        </select>

        <select className="table-control" value={filters.hardiness || 'all'} onChange={(event) => onHardinessChange && onHardinessChange(event.target.value)}>
          <option value="all">All zones</option>
          {(options?.hardinessZones || []).map((zone) => (
            <option key={zone} value={zone}>Zone {zone}</option>
          ))}
        </select>

        <select className="table-control" value={String(filters.limit)} onChange={(event) => onLimitChange && onLimitChange(Number(event.target.value))}>
          <option value="10">10 rows</option>
          <option value="20">20 rows</option>
          <option value="50">50 rows</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: '40px' }}></th>
            <th>ID</th>
            <th>Plant Species</th>
            <th>Type</th>
            <th>Strata</th>
            <th>Hardiness</th>
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((log) => (
            <React.Fragment key={log.id}>
              <tr onClick={() => toggleRow(log.id)} style={{ cursor: 'pointer', transition: 'background-color 0.2s' }} className={expandedRowId === log.id ? 'active-row' : ''}>
                <td>{expandedRowId === log.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</td>
                <td className="field-id">{log.id}</td>
                <td>
                  <strong>{log.name}</strong><br />
                  <small className="crop-name">{log.crop}</small>
                </td>
                <td>{log.category}</td>
                <td>{log.strata}</td>
                <td>{log.hardiness}</td>
              </tr>

              {/* DETAILED PROFILE ACCORDION */}
              {expandedRowId === log.id && (
                <tr style={{ backgroundColor: '#f8fafc' }}>
                  <td colSpan={6} style={{ padding: '20px', borderBottom: '2px solid #e2e8f0' }}>
                    <div style={{ padding: '10px 0' }}>
                      <h4 style={{ margin: '0 0 12px 0', color: '#0f172a' }}>Plant Profile</h4>
                      <p style={{ margin: '6px 0', fontSize: '0.95rem' }}>
                        <strong>Primary Purpose:</strong> {log.rawDetails?.purpose || log.rawDetails?.primary_use || 'Data not in CSV'}
                      </p>
                      
                      {/* FIXED: Reverted to the dropdown but added "/year" to the text */}
                      <p style={{ margin: '6px 0', fontSize: '0.95rem' }}>
                        <strong>Expected Calories:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{log.calories ? log.calories.toLocaleString() + ' kcal/year' : 'Data not in CSV'}</span>
                      </p>
                      
                    </div>
                    
                    <details style={{ marginTop: '15px', fontSize: '0.8rem', color: '#64748b' }}>
                      <summary style={{ cursor: 'pointer' }}>View raw CSV record</summary>
                      <pre style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '4px', overflowX: 'auto', marginTop: '10px' }}>
                        {JSON.stringify(log.rawDetails, null, 2)}
                      </pre>
                    </details>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
          {(!rows || rows.length === 0) && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                No plants found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="pagination-row">
        <div className="pagination-info">
          {pagination?.total > 0
            ? `Showing page ${pagination.page} of ${pagination.totalPages} (${pagination.total} records)`
            : 'No records found for current filters'}
        </div>
        <div className="pagination-actions">
          <button className="pagination-btn" type="button" onClick={() => onPageChange && onPageChange(pagination.page - 1)} disabled={!pagination?.hasPrev || isLoading}>Prev</button>
          <span className="page-count">Page {pagination?.page || 1}</span>
          <button className="pagination-btn" type="button" onClick={() => onPageChange && onPageChange(pagination.page + 1)} disabled={!pagination?.hasNext || isLoading}>Next</button>
        </div>
      </div>
    </section>
  );
}

export default PlantsPanel;