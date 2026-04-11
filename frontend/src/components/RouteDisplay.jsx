import { RouteLeg } from './RouteLeg';

/**
 * Summary strip shown at the top of the route result.
 */
function RouteSummary({ route }) {
  return (
    <div className="card bg-gradient-to-r from-mta-blue to-blue-700 text-white border-0">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">Total journey</p>
          <p className="text-3xl font-extrabold mt-0.5">{route.totalDuration}</p>
          <p className="text-sm opacity-70 mt-1">{route.totalDistance}</p>
        </div>
        <div className="text-right">
          {route.departureTime && (
            <div>
              <p className="text-xs opacity-70 uppercase tracking-wide">Depart</p>
              <p className="text-xl font-bold">{route.departureTime}</p>
            </div>
          )}
          {route.arrivalTime && (
            <div className="mt-2">
              <p className="text-xs opacity-70 uppercase tracking-wide">Arrive</p>
              <p className="text-xl font-bold">{route.arrivalTime}</p>
            </div>
          )}
        </div>
      </div>

      {/* Mode pills */}
      <div className="mt-3 flex gap-2 flex-wrap">
        {getUniqueModes(route.legs).map((mode) => (
          <span key={mode} className="pill bg-white/20 text-white">
            {modeLabel(mode)}
          </span>
        ))}
      </div>
    </div>
  );
}

function getUniqueModes(legs) {
  const seen = new Set();
  return legs.filter((l) => {
    if (seen.has(l.type)) return false;
    seen.add(l.type);
    return true;
  }).map((l) => l.type);
}

function modeLabel(type) {
  const map = {
    WALK: '🚶 Walk',
    BUS: '🚌 Bus',
    SUBWAY: '🚇 Subway',
    RAIL: '🚂 Train',
    TRAM: '🚋 Tram',
    FERRY: '⛴️ Ferry',
  };
  return map[type] || type;
}

/**
 * Full route display: summary card + ordered leg list.
 */
export function RouteDisplay({ route, onRefresh }) {
  const busLegs = route.legs.filter((l) => l.type === 'BUS');

  return (
    <div className="space-y-3">
      <RouteSummary route={route} />

      {/* Contextual note when bus legs are present */}
      {busLegs.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <span className="flex-shrink-0 mt-0.5">💡</span>
          <span>
            Live bus arrivals below are pulled from the same MTA SMS service —
            the exact data you'd get by texting the stop code. Auto-refreshes every 30s.
          </span>
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">
        Step-by-step
      </h2>

      <div className="space-y-2">
        {route.legs.map((leg, i) => (
          <RouteLeg key={i} leg={leg} index={i} />
        ))}
      </div>

      <button
        onClick={onRefresh}
        className="w-full py-3 text-sm font-semibold text-mta-blue border-2 border-mta-blue
                   rounded-xl hover:bg-blue-50 active:scale-95 transition-all duration-150"
      >
        ↻ Re-plan route
      </button>
    </div>
  );
}
