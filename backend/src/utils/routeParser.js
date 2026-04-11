/**
 * Parses a Google Maps Directions API transit response into structured legs.
 * Each leg includes type, line info, stops, duration, and distance.
 */
function parseTransitRoute(gmapsRoute) {
  const legs = [];

  for (const leg of gmapsRoute.legs) {
    for (const step of leg.steps) {
      if (step.travel_mode === 'WALKING') {
        legs.push({
          type: 'WALK',
          duration: step.duration.text,
          durationSeconds: step.duration.value,
          distance: step.distance.text,
          instructions: step.html_instructions.replace(/<[^>]+>/g, ''),
          startLocation: step.start_location,
          endLocation: step.end_location,
        });
      } else if (step.travel_mode === 'TRANSIT') {
        const t = step.transit_details;
        const vehicleType = t.line.vehicle.type; // BUS, SUBWAY, COMMUTER_TRAIN, HEAVY_RAIL, etc.

        const parsed = {
          type: normalizeVehicleType(vehicleType),
          lineName: t.line.short_name || t.line.name,
          lineColor: t.line.color || null,
          lineTextColor: t.line.text_color || null,
          operator: t.line.agencies?.[0]?.name || null,
          headsign: t.headsign,
          numStops: t.num_stops,
          duration: step.duration.text,
          durationSeconds: step.duration.value,
          departureStop: {
            name: t.departure_stop.name,
            location: t.departure_stop.location,
          },
          arrivalStop: {
            name: t.arrival_stop.name,
            location: t.arrival_stop.location,
          },
          departureTime: t.departure_time?.text || null,
          arrivalTime: t.arrival_time?.text || null,
        };

        // For bus legs, flag them so the frontend can request real-time MTA data
        if (parsed.type === 'BUS') {
          parsed.needsRealtime = true;
          // Stop ID will be resolved by the bustime route using lat/lon lookup
          parsed.departureStopCoords = t.departure_stop.location;
        }

        legs.push(parsed);
      }
    }
  }

  return legs;
}

function normalizeVehicleType(gmapsType) {
  const map = {
    BUS: 'BUS',
    SUBWAY: 'SUBWAY',
    TRAM: 'TRAM',
    RAIL: 'RAIL',
    HEAVY_RAIL: 'RAIL',
    COMMUTER_TRAIN: 'RAIL',
    HIGH_SPEED_TRAIN: 'RAIL',
    FERRY: 'FERRY',
    CABLE_CAR: 'CABLE_CAR',
    GONDOLA: 'GONDOLA',
    FUNICULAR: 'FUNICULAR',
    OTHER: 'OTHER',
  };
  return map[gmapsType] || 'OTHER';
}

module.exports = { parseTransitRoute };
