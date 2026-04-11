import { useState, useEffect, useCallback } from 'react';
import { getBusArrivalsByLocation } from '../services/api';

const OCCUPANCY_LABELS = {
  seatsAvailable: { label: 'Seats available', color: 'text-green-600', bg: 'bg-green-50', icon: '🟢' },
  standingRoomOnly: { label: 'Standing room', color: 'text-yellow-600', bg: 'bg-yellow-50', icon: '🟡' },
  crushedStandingRoomOnly: { label: 'Very crowded', color: 'text-orange-600', bg: 'bg-orange-50', icon: '🟠' },
  full: { label: 'Full', color: 'text-red-600', bg: 'bg-red-50', icon: '🔴' },
  notAcceptingPassengers: { label: 'Not accepting', color: 'text-gray-600', bg: 'bg-gray-50', icon: '⚫' },
};

function OccupancyBadge({ occupancy }) {
  if (!occupancy) return null;
  const key = occupancy.charAt(0).toLowerCase() + occupancy.slice(1);
  const info = OCCUPANCY_LABELS[key] || { label: occupancy, color: 'text-gray-600', bg: 'bg-gray-50', icon: '⚪' };
  return (
    <span className={`pill ${info.bg} ${info.color}`}>
      {info.icon} {info.label}
    </span>
  );
}

function ArrivalRow({ arrival, index }) {
  const mins = arrival.minutesAway;

  let timeDisplay;
  let timeColor;

  if (arrival.atStop || mins === 0) {
    timeDisplay = 'Approaching';
    timeColor = 'text-green-600';
  } else if (mins < 0) {
    timeDisplay = 'Just left';
    timeColor = 'text-gray-400';
  } else if (mins === 1) {
    timeDisplay = '1 min';
    timeColor = 'text-orange-500';
  } else if (mins !== null) {
    timeDisplay = `${mins} min`;
    timeColor = mins <= 5 ? 'text-orange-500' : 'text-gray-900';
  } else if (arrival.expectedArrival) {
    timeDisplay = new Date(arrival.expectedArrival).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    timeColor = 'text-gray-700';
  } else {
    timeDisplay = '—';
    timeColor = 'text-gray-400';
  }

  return (
    <div className={`flex items-center justify-between py-2.5 ${index > 0 ? 'border-t border-gray-50' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-bus-light border border-bus-border
                        flex items-center justify-center">
          <span className="text-xs font-bold text-bus-DEFAULT leading-tight text-center">
            {arrival.publishedLineName || '?'}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {arrival.destination || 'Unknown destination'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {arrival.distanceFromStop && (
              <span className="text-xs text-gray-500">{arrival.distanceFromStop}</span>
            )}
            {arrival.stopsAway != null && (
              <span className="text-xs text-gray-400">
                {arrival.stopsAway === 0 ? '(at stop)' : `${arrival.stopsAway} stop${arrival.stopsAway !== 1 ? 's' : ''} away`}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col items-end gap-1 ml-2">
        <span className={`text-lg font-bold tabular-nums ${timeColor}`}>{timeDisplay}</span>
        {arrival.occupancy && <OccupancyBadge occupancy={arrival.occupancy} />}
      </div>
    </div>
  );
}

/**
 * Fetches and displays live MTA bus arrivals for a bus route leg.
 * Automatically refreshes every 30 seconds.
 */
export function BusArrivalCard({ leg }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);
  const [countdown, setCountdown] = useState(30);

  const { lat, lng } = leg.departureStopCoords || {};

  const fetchArrivals = useCallback(async () => {
    if (!lat || !lng) {
      setError('No location data for this stop');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await getBusArrivalsByLocation(lat, lng, leg.lineName);
      setData(result);
      setLastFetched(new Date());
      setCountdown(30);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, leg.lineName]);

  // Initial fetch
  useEffect(() => { fetchArrivals(); }, [fetchArrivals]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchArrivals, 30_000);
    return () => clearInterval(interval);
  }, [fetchArrivals]);

  // Countdown ticker
  useEffect(() => {
    const tick = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 30)), 1000);
    return () => clearInterval(tick);
  }, [lastFetched]);

  const arrivals = data?.arrivals || [];
  const stop = data?.stop;

  return (
    <div className="mt-3 rounded-xl border border-bus-border bg-bus-light overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-bus-DEFAULT/10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 live-dot" />
          <span className="text-xs font-semibold text-bus-DEFAULT uppercase tracking-wide">
            Live arrivals
          </span>
          {stop && (
            <span className="text-xs text-gray-500">
              · {stop.name}
              {stop.code && <span className="ml-1 text-gray-400">(#{stop.code})</span>}
            </span>
          )}
        </div>
        <button
          onClick={fetchArrivals}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-bus-DEFAULT font-medium
                     hover:text-blue-800 disabled:opacity-50 transition-colors"
          title="Refresh arrivals"
        >
          <span className={loading ? 'animate-spin' : ''}>↻</span>
          {loading ? 'Updating…' : `${countdown}s`}
        </button>
      </div>

      {/* Body */}
      <div className="px-3">
        {loading && arrivals.length === 0 && (
          <div className="py-5 text-center">
            <div className="inline-block w-6 h-6 border-2 border-bus-DEFAULT border-t-transparent
                            rounded-full animate-spin mb-2" />
            <p className="text-xs text-gray-500">Fetching live arrivals…</p>
          </div>
        )}

        {error && !loading && (
          <div className="py-4 text-center">
            <p className="text-sm text-red-500 font-medium">Could not load arrivals</p>
            <p className="text-xs text-gray-400 mt-1">{error}</p>
            <button onClick={fetchArrivals} className="btn-ghost mt-2 text-xs">
              Try again
            </button>
          </div>
        )}

        {!error && arrivals.length === 0 && !loading && (
          <div className="py-4 text-center">
            <p className="text-sm text-gray-500">No buses found near this stop</p>
            <p className="text-xs text-gray-400 mt-1">
              Try refreshing or check that the route is running
            </p>
          </div>
        )}

        {arrivals.map((arrival, i) => (
          <ArrivalRow key={`${arrival.vehicleRef}-${i}`} arrival={arrival} index={i} />
        ))}
      </div>

      {lastFetched && arrivals.length > 0 && (
        <div className="px-3 py-2 text-xs text-gray-400 border-t border-bus-border/50">
          Updated {lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      )}
    </div>
  );
}
