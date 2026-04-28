import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import './FieldInventoryPanel.css';

// Treeline plants inventory with search, filter, and pagination.
function PlantsPanel({
  rows = [],
  filters,
  options,
  pagination,
  onSearch,
  onCategoryChange,
  onStrataChange,
  onLimitChange,
  onPageChange,
  onReload,
  isLoading = false,
}) {
  const [searchInput, setSearchInput] = useState(filters.search || '');

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    onSearch(searchInput.trim());
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <span>Treeline Plants Inventory (MongoDB)</span>
        <button className="refresh-btn" type="button" onClick={onReload} disabled={isLoading}>
          <RefreshCw size={10} /> {isLoading ? 'Loading...' : 'Reload CSV'}
        </button>
      </div>

      <div className="table-toolbar">
        <form className="search-wrap" onSubmit={handleSearchSubmit}>
          <input
            className="table-control"
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by ID, German, English or Latin name"
          />
          <button className="search-btn" type="submit">
            Search
          </button>
        </form>

        <select
          className="table-control"
          value={filters.category}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="all">All categories</option>
          {options.categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select className="table-control" value={filters.strata} onChange={(event) => onStrataChange(event.target.value)}>
          <option value="all">All strata</option>
          {options.strata.map((strata) => (
            <option key={strata} value={strata}>
              {strata}
            </option>
          ))}
        </select>

        <select className="table-control" value={String(filters.limit)} onChange={(event) => onLimitChange(Number(event.target.value))}>
          <option value="10">10 rows</option>
          <option value="20">20 rows</option>
          <option value="30">30 rows</option>
          <option value="50">50 rows</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Plant</th>
            <th>Category</th>
            <th>Strata</th>
            <th>Typical Share</th>
            <th>Hardiness Zones</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((log) => (
            <tr key={log.id}>
              <td className="field-id">{log.id}</td>
              <td>
                {log.name}
                <br />
                <small className="crop-name">{log.crop}</small>
              </td>
              <td>{log.category}</td>
              <td>{log.strata}</td>
              <td>{log.typicalShare}</td>
              <td className="last-update">{log.hardiness}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="last-update">
                No plants found. Import CSV data first.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="pagination-row">
        <div className="pagination-info">
          {pagination.total > 0
            ? `Showing page ${pagination.page} of ${pagination.totalPages} (${pagination.total} records)`
            : 'No records found for current filters'}
        </div>

        <div className="pagination-actions">
          <button
            className="pagination-btn"
            type="button"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={!pagination.hasPrev || isLoading}
          >
            Prev
          </button>
          <span className="page-count">Page {pagination.page}</span>
          <button
            className="pagination-btn"
            type="button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={!pagination.hasNext || isLoading}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

export default PlantsPanel;
