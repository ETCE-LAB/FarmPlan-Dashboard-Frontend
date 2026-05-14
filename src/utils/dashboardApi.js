const API_BASE = '/api/flask/api';

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export function getTreelineOverview() {
  return requestJson('/treeline/overview');
}

export function importTreelineCsv() {
  return requestJson('/treeline/import', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function getTreelineRecords({ page = 1, limit = 10, search = '', category = 'all', strata = 'all', hardiness = 'all' } = {}) {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search,
    category,
    strata,
    hardiness, // Now JavaScript knows what this is!
  });

  return requestJson(`/treeline/records?${query.toString()}`);
}
