import { BusArrivalCard } from './BusArrivalCard';

// MTA subway line colors
const SUBWAY_COLORS = {
  '1': '#EE352E', '2': '#EE352E', '3': '#EE352E',
  '4': '#00933C', '5': '#00933C', '6': '#00933C',
  '7': '#B933AD',
  'A': '#0039A6', 'C': '#0039A6', 'E': '#0039A6',
  'B': '#FF6319', 'D': '#FF6319', 'F': '#FF6319', 'M': '#FF6319',
  'G': '#6CBE45',
  'J': '#996633', 'Z': '#996633',
  'L': '#A7A9AC',
  'N': '#FCCC0A', 'Q': '#FCCC0A', 'R': '#FCCC0A', 'W': '#FCCC0A',
  'S': '#808183',
  'SI': '#0039A6',
};

const PATH_COLORS = { 'PATH': '#003E9B' };

function LineChip({ lineName, type, lineColor, lineTextColor }) {
  let bg = lineColor || '#555';
  let text = lineTextColor || '#fff';

  if (type === 'SUBWAY') {
    bg = SUBWAY_COLORS[lineName?.toUpperCase()] || '#555';
    text = ['N', 'Q', 'R', 'W'].includes(lineName?.toUpperCase()) ? '#000' : '#fff';
  }

  if (type === 'RAIL') {
    bg = PATH_COLORS[lineName?.toUpperCase()] || '#003E9B';
    text = '#fff';
  }

  return (
    <span
      className="inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold flex-shrink-0"
      style={{ backgroundColor: bg, color: text }}
    >
      {lineName}
    </span>
  );
}

function TypeIcon({ type }) {
  const icons = {
    BUS: '🚌',
    SUBWAY: '🚇',
    RAIL: '🚂',
    WALK: '🚶',
    TRAM: '🚋',
    FERRY: '⛴️',
    OTHER: '🚍',
  };
  return <span className="text-base">{icons[type] || '🚍'}</span>;
}

function LegBadge({ type }) {
  const styles = {
    BUS:    'bg-bus-light text-bus-DEFAULT border-bus-border',
    SUBWAY: 'bg-subway-light text-subway border-subway-border',
    RAIL:   'bg-rail-light text-rail border-rail-border',
    WALK:   'bg-walk-light text-walk border-walk-border',
    TRAM:   'bg-purple-50 text-purple-700 border-purple-200',
    FERRY:  'bg-cyan-50 text-cyan-700 border-cyan-200',
  };
  const labels = { BUS: 'Bus', SUBWAY: 'Subway', RAIL: 'Train', WALK: 'Walk', TRAM: 'Tram', FERRY: 'Ferry' };
  return (
    <span className={`pill border ${styles[type] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {labels[type] || type}
    </span>
  );
}

/**
 * Renders a single route leg (walk, bus, subway, rail).
 * Bus legs additionally show the live BusArrivalCard.
 */
export function RouteLeg({ leg, index }) {
  const isWalk = leg.type === 'WALK';

  if (isWalk) {
    return (
      <div className="slide-up card opacity-80 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚶</span>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <LegBadge type="WALK" />
              <span className="text-sm font-medium text-gray-600">
                Walk · {leg.duration} · {leg.distance}
              </span>
            </div>
            {leg.instructions && (
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{leg.instructions}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isTransit = ['BUS', 'SUBWAY', 'RAIL', 'TRAM', 'FERRY'].includes(leg.type);

  return (
    <div className="slide-up card">
      {/* Top row: line chip + route info */}
      <div className="flex items-start gap-3">
        {isTransit ? (
          <LineChip
            lineName={leg.lineName}
            type={leg.type}
            lineColor={leg.lineColor}
            lineTextColor={leg.lineTextColor}
          />
        ) : (
          <div className="w-9 h-9 flex items-center justify-center">
            <TypeIcon type={leg.type} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <LegBadge type={leg.type} />
            {leg.headsign && (
              <span className="text-sm font-semibold text-gray-900 truncate">
                towards {leg.headsign}
              </span>
            )}
          </div>

          {leg.operator && (
            <p className="text-xs text-gray-400 mt-0.5">{leg.operator}</p>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <span className="text-sm font-semibold text-gray-700">{leg.duration}</span>
          {leg.numStops && (
            <p className="text-xs text-gray-400 mt-0.5">
              {leg.numStops} stop{leg.numStops !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Stop info */}
      {leg.departureStop && leg.arrivalStop && (
        <div className="mt-3 ml-12 relative">
          {/* Vertical connector */}
          <div className="absolute left-[-20px] top-3 bottom-3 w-0.5 bg-gray-200" />

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full border-2 border-current text-gray-400 flex-shrink-0" style={{ borderColor: '#9CA3AF' }} />
              <div>
                <span className="text-xs font-medium text-gray-700">{leg.departureStop.name}</span>
                {leg.departureTime && (
                  <span className="ml-2 text-xs text-gray-400">{leg.departureTime}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
              <div>
                <span className="text-xs font-medium text-gray-700">{leg.arrivalStop.name}</span>
                {leg.arrivalTime && (
                  <span className="ml-2 text-xs text-gray-400">{leg.arrivalTime}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Live bus arrivals — the whole point of this app! */}
      {leg.type === 'BUS' && leg.needsRealtime && (
        <BusArrivalCard leg={leg} />
      )}
    </div>
  );
}
