import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Save, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getTreelineRecords } from '../utils/dashboardApi';
import './Recipe.css';

const DEFAULT_FILTERS = {
  search: '',
  category: 'all',
  strata: 'all',
  hardiness: 'all',
  page: 1,
  limit: 10,
};

function parseSpacingMeters(value) {
  if (value === null || value === undefined) return 1;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0.25, value);
  }

  const text = String(value).replace(',', '.');
  const matched = text.match(/\d+(?:\.\d+)?/);
  if (!matched) return 1;

  const parsed = Number(matched[0]);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(0.25, parsed);
}

function toRecipePlant(row) {
  const minimumSpacingRaw = row?.rawDetails?.minimum_spacing ?? row?.rawDetails?.recommended_spacing ?? row?.minimum_spacing ?? row?.recommended_spacing ?? '';
  return {
    id: row?.id || row?.source_id || '',
    name: row?.name || row?.crop || row?.german_name || 'Unknown crop',
    latinName: row?.rawDetails?.latin_name || row?.latinName || '',
    category: row?.category || row?.rawDetails?.category || 'n/a',
    strata: row?.strata || row?.rawDetails?.strata || 'n/a',
    hardiness: row?.hardiness || row?.rawDetails?.hardiness_zones || 'n/a',
    minimumSpacingRaw,
    minimumSpacingMeters: parseSpacingMeters(minimumSpacingRaw),
    rawDetails: row?.rawDetails || row,
  };
}

function buildInitialFilters(initialRecipe) {
  return {
    ...DEFAULT_FILTERS,
    ...(initialRecipe?.filters || {}),
  };
}

function Recipe({ open, mode = 'create', farmName, initialRecipe, onClose, onSave }) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState(() => buildInitialFilters(initialRecipe));
  const [searchInput, setSearchInput] = useState(() => buildInitialFilters(initialRecipe).search || '');
  const [records, setRecords] = useState([]);
  const [options, setOptions] = useState({ categories: [], strata: [], hardinessZones: [] });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1, hasPrev: false, hasNext: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlantsMap, setSelectedPlantsMap] = useState(() => new Map());

  useEffect(() => {
    if (!open) return;

    const nextFilters = buildInitialFilters(initialRecipe);
    setFilters(nextFilters);
    setSearchInput(nextFilters.search || '');
    setSelectedPlantsMap(new Map((initialRecipe?.plants || []).map((plant) => [plant.id, plant])));
    setError('');
  }, [open, initialRecipe]);

  useEffect(() => {
    if (!open) return;

    let mounted = true;

    async function loadRecords() {
      setIsLoading(true);
      setError('');
      try {
        const payload = await getTreelineRecords(filters);
        if (!mounted) return;
        setRecords((payload.records || []).map(toRecipePlant));
        setOptions(payload.options || { categories: [], strata: [], hardinessZones: [] });
        setPagination(payload.pagination || { page: 1, limit: filters.limit, total: 0, totalPages: 1, hasPrev: false, hasNext: false });
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError?.message || t('Could not load recipe plants.', 'Could not load recipe plants.'));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadRecords();
    return () => {
      mounted = false;
    };
  }, [open, filters, t]);

  const selectedPlants = useMemo(
    () => Array.from(selectedPlantsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
    [selectedPlantsMap],
  );

  const availableCategories = options?.categories || [];
  const availableStrata = options?.strata || [];
  const availableHardiness = options?.hardinessZones || [];

  const updateFilter = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
    }));
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    updateFilter('search', searchInput.trim());
  };

  const togglePlant = (plant) => {
    setSelectedPlantsMap((prev) => {
      const next = new Map(prev);
      if (next.has(plant.id)) next.delete(plant.id);
      else next.set(plant.id, plant);
      return next;
    });
  };

  const handleSave = () => {
    if (selectedPlants.length === 0) {
      setError(t('Select at least one plant before saving the recipe.', 'Select at least one plant before saving the recipe.'));
      return;
    }

    onSave({
      id: initialRecipe?.id || `recipe-${Date.now()}`,
      name: initialRecipe?.name || `${farmName || t('Farm', 'Farm')} Recipe`,
      plants: selectedPlants,
      filters,
      createdAt: initialRecipe?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  if (!open) return null;

  return (
    <div className="recipe-modal-overlay" role="presentation" onClick={onClose}>
      <div className="recipe-modal" role="dialog" aria-modal="true" aria-label={t('Recipe editor', 'Recipe editor')} onClick={(event) => event.stopPropagation()}>
        <div className="recipe-modal-header">
          <div>
            <div className="recipe-modal-kicker">{mode === 'edit' ? t('Edit recipe', 'Edit recipe') : t('Create recipe', 'Create recipe')}</div>
            <h3>{farmName || t('Recipe builder', 'Recipe builder')}</h3>
            <p>{t('Pick the plants that should belong to this farm recipe.', 'Pick the plants that should belong to this farm recipe.')}</p>
          </div>
          <button type="button" className="recipe-close-btn" onClick={onClose} aria-label={t('Close recipe editor', 'Close recipe editor')}>
            <X size={18} />
          </button>
        </div>

        <div className="recipe-toolbar">
          <form className="recipe-search" onSubmit={handleSearchSubmit}>
            <div className="recipe-search-field">
              <Search size={14} />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t('Search plants...', 'Search plants...')}
              />
            </div>
            <button type="submit" className="recipe-search-btn">
              {t('Search', 'Search')}
            </button>
          </form>

          <select className="recipe-filter" value={filters.category} onChange={(event) => updateFilter('category', event.target.value)}>
            <option value="all">{t('All categories', 'All categories')}</option>
            {availableCategories.map((category) => (
              <option key={category} value={category}>{t(category, category)}</option>
            ))}
          </select>

          <select className="recipe-filter" value={filters.strata} onChange={(event) => updateFilter('strata', event.target.value)}>
            <option value="all">{t('All strata', 'All strata')}</option>
            {availableStrata.map((strata) => (
              <option key={strata} value={strata}>{t(strata, strata)}</option>
            ))}
          </select>

          <select className="recipe-filter" value={filters.hardiness} onChange={(event) => updateFilter('hardiness', event.target.value)}>
            <option value="all">{t('All zones', 'All zones')}</option>
            {availableHardiness.map((zone) => (
              <option key={zone} value={zone}>{t('Zone', 'Zone')} {zone}</option>
            ))}
          </select>

          <select className="recipe-filter" value={String(filters.limit)} onChange={(event) => updateFilter('limit', Number(event.target.value))}>
            <option value="10">10 {t('rows', 'rows')}</option>
            <option value="20">20 {t('rows', 'rows')}</option>
            <option value="50">50 {t('rows', 'rows')}</option>
          </select>

          <button type="button" className="recipe-refresh-btn" onClick={() => setFilters((prev) => ({ ...prev }))} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          </button>
        </div>

        <div className="recipe-summary-bar">
          <span>{selectedPlants.length} {t('plants selected', 'plants selected')}</span>
          <span>{pagination.total ? `${pagination.total} ${t('records available', 'records available')}` : t('No records found', 'No records found')}</span>
        </div>

        {error && <p className="recipe-error">{error}</p>}

        <div className="recipe-table-shell">
          <table className="recipe-table">
            <thead>
              <tr>
                <th style={{ width: '42px' }}></th>
                <th>{t('ID', 'ID')}</th>
                <th>{t('Plant Species', 'Plant Species')}</th>
                <th>{t('Category', 'Category')}</th>
                <th>{t('Strata', 'Strata')}</th>
                <th>{t('Hardiness', 'Hardiness')}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="recipe-empty">{t('Loading plants...', 'Loading plants...')}</td>
                </tr>
              )}
              {!isLoading && records.map((record) => {
                const isSelected = selectedPlantsMap.has(record.id);
                return (
                  <tr key={record.id} className={isSelected ? 'selected' : ''} onClick={() => togglePlant(record)} role="button" tabIndex={0} onKeyDown={(event) => event.key === 'Enter' && togglePlant(record)}>
                    <td>
                      <input type="checkbox" checked={isSelected} onChange={() => togglePlant(record)} onClick={(event) => event.stopPropagation()} />
                    </td>
                    <td className="recipe-id">{record.id}</td>
                    <td>
                      <strong>{t(record.name, record.name)}</strong>
                      <br />
                      <small>{t(record.latinName || 'No latin name', record.latinName || 'No latin name')}</small>
                    </td>
                    <td>{t(record.category, record.category)}</td>
                    <td>{t(record.strata, record.strata)}</td>
                    <td>{t(record.hardiness, record.hardiness)}</td>
                  </tr>
                );
              })}
              {!isLoading && records.length === 0 && (
                <tr>
                  <td colSpan={6} className="recipe-empty">{t('No plants found for the current filters.', 'No plants found for the current filters.')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="recipe-selected-list">
          <div className="recipe-selected-label">{t('Selected plants', 'Selected plants')}</div>
          {selectedPlants.length === 0 ? (
            <p className="recipe-empty-inline">{t('Choose one or more plants to build the recipe.', 'Choose one or more plants to build the recipe.')}</p>
          ) : (
            <div className="recipe-chips">
              {selectedPlants.map((plant) => (
                <button key={plant.id} type="button" className="recipe-chip" onClick={() => togglePlant(plant)}>
                  {plant.name} <X size={12} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="recipe-pagination">
          <div className="recipe-pagination-info">
            {pagination.total > 0
              ? `${t('Page', 'Page')} ${pagination.page} ${t('of', 'of')} ${pagination.totalPages} (${pagination.total} ${t('records', 'records')})`
              : t('No records available', 'No records available')}
          </div>
          <div className="recipe-pagination-actions">
            <button type="button" className="recipe-page-btn" onClick={() => updateFilter('page', Math.max(1, pagination.page - 1))} disabled={!pagination.hasPrev || isLoading}>
              <ChevronLeft size={14} /> {t('Prev', 'Prev')}
            </button>
            <button type="button" className="recipe-page-btn" onClick={() => updateFilter('page', pagination.page + 1)} disabled={!pagination.hasNext || isLoading}>
              {t('Next', 'Next')} <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="recipe-actions">
          <button type="button" className="recipe-secondary-btn" onClick={onClose}>
            {t('Cancel', 'Cancel')}
          </button>
          <button type="button" className="recipe-save-btn" onClick={handleSave} disabled={selectedPlants.length === 0}>
            <Save size={14} /> {t('Save recipe', 'Save recipe')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Recipe;
