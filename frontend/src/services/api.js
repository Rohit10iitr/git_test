const BASE = '/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

/**
 * Plan a transit route from origin to destination.
 * Returns { totalDuration, totalDistance, legs, ... }
 */
export async function planRoute(origin, destination) {
  return apiFetch('/directions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination }),
  });
}

/**
 * Autocomplete a location string (NYC-biased).
 * Returns { suggestions: [{ description, placeId, mainText, secondaryText }] }
 */
export async function autocompleteLocation(input) {
  if (!input || input.trim().length < 2) return { suggestions: [] };
  const encoded = encodeURIComponent(input.trim());
  return apiFetch(`/directions/autocomplete?input=${encoded}`);
}

/**
 * Get real-time bus arrivals for a stop.
 * stopId: numeric stop code or full MTA ID
 * lineRef: optional route filter (e.g. "B38")
 */
export async function getBusArrivals(stopId, lineRef) {
  let path = `/bustime/arrivals?stopId=${encodeURIComponent(stopId)}`;
  if (lineRef) path += `&lineRef=${encodeURIComponent(lineRef)}`;
  return apiFetch(path);
}

/**
 * Get real-time bus arrivals by geographic location.
 * lat/lon: departure stop coordinates (from Google Maps route leg)
 * lineRef: optional route filter
 */
export async function getBusArrivalsByLocation(lat, lon, lineRef) {
  let path = `/bustime/arrivals-by-location?lat=${lat}&lon=${lon}`;
  if (lineRef) path += `&lineRef=${encodeURIComponent(lineRef)}`;
  return apiFetch(path);
}

/**
 * Find MTA bus stops near a coordinate.
 */
export async function getNearbyStops(lat, lon, radiusMeters = 150) {
  return apiFetch(`/bustime/stops?lat=${lat}&lon=${lon}&radius=${radiusMeters}`);
}

/**
 * Health check — verify API keys are configured.
 */
export async function checkHealth() {
  return apiFetch('/health');
}
