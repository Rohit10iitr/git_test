const express = require('express');
const axios = require('axios');

const router = express.Router();

const BUSTIME_BASE = 'https://bustime.mta.info/api';

/**
 * GET /api/bustime/stops?lat=&lon=&radius=
 * Find MTA bus stops near a coordinate.
 * Returns stops with their IDs (the 6-digit code on the pole).
 */
router.get('/stops', async (req, res) => {
  const { lat, lon, radius = 150 } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  const apiKey = process.env.MTA_BUS_TIME_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'MTA_BUS_TIME_API_KEY not configured' });
  }

  try {
    const { data } = await axios.get(`${BUSTIME_BASE}/where/stops-for-location.json`, {
      params: {
        lat,
        lon,
        latSpan: metersToDegreesLat(Number(radius)),
        lonSpan: metersToDegreesLon(Number(radius), Number(lat)),
        key: apiKey,
      },
    });

    if (data.code !== 200) {
      return res.status(502).json({ error: 'MTA Bus Time API error', detail: data });
    }

    const stops = (data.data?.list || []).map((s) => ({
      id: s.id,
      // The stop code displayed on the physical pole (numeric part after last underscore or the full code)
      code: s.code || extractCode(s.id),
      name: s.name,
      direction: s.direction,
      lat: s.lat,
      lon: s.lon,
      routes: (s.routes || []).map((r) => ({
        id: r.id,
        shortName: r.shortName,
        longName: r.longName,
        color: r.color,
      })),
    }));

    return res.json({ stops });
  } catch (err) {
    console.error('Stops error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch stops' });
  }
});

/**
 * GET /api/bustime/arrivals?stopId=&lineRef=
 * Real-time bus arrival predictions for a given stop.
 * stopId: MTA stop ID (e.g. "MTA_305423") or numeric code
 * lineRef: optional, filter by route (e.g. "B38" or "MTA NYCT_B38")
 */
router.get('/arrivals', async (req, res) => {
  const { stopId, lineRef } = req.query;

  if (!stopId) {
    return res.status(400).json({ error: 'stopId is required' });
  }

  const apiKey = process.env.MTA_BUS_TIME_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'MTA_BUS_TIME_API_KEY not configured' });
  }

  // Normalize the monitoring ref — MTA expects just the numeric stop code
  // or the full "MTA_XXXXXX" style ID.
  const monitoringRef = normalizeStopId(stopId);

  try {
    const params = {
      key: apiKey,
      OperatorRef: 'MTA',
      MonitoringRef: monitoringRef,
      MaximumStopVisits: 5,
    };

    if (lineRef) {
      params.LineRef = normalizeLineRef(lineRef);
    }

    const { data } = await axios.get(`${BUSTIME_BASE}/siri/stop-monitoring.json`, { params });

    const visits =
      data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];

    const arrivals = visits.map((v) => {
      const journey = v.MonitoredVehicleJourney;
      const call = journey?.MonitoredCall;

      const expectedArrival = call?.ExpectedArrivalTime || call?.ExpectedDepartureTime || null;
      const aimedArrival = call?.AimedArrivalTime || call?.AimedDepartureTime || null;

      let minutesAway = null;
      if (expectedArrival) {
        minutesAway = Math.round((new Date(expectedArrival) - Date.now()) / 60000);
      }

      return {
        lineRef: journey?.LineRef,
        publishedLineName: journey?.PublishedLineName,
        destination: journey?.DestinationName,
        vehicleRef: journey?.VehicleRef,
        occupancy: journey?.Occupancy || null,
        progressStatus: journey?.ProgressStatus || null,
        stopName: call?.StopPointName,
        distanceFromStop: call?.Extensions?.Distances?.PresentableDistance || null,
        stopsAway: call?.Extensions?.Distances?.StopsFromCall ?? null,
        expectedArrival,
        aimedArrival,
        minutesAway,
        atStop: minutesAway !== null && minutesAway <= 0,
      };
    });

    // Sort by arrival time
    arrivals.sort((a, b) => (a.minutesAway ?? 999) - (b.minutesAway ?? 999));

    return res.json({
      stopId: monitoringRef,
      fetchedAt: new Date().toISOString(),
      arrivals,
    });
  } catch (err) {
    console.error('Arrivals error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch arrivals' });
  }
});

/**
 * GET /api/bustime/arrivals-by-location?lat=&lon=&lineRef=&radius=
 * Convenience: find stops near a coordinate then return arrivals.
 * Useful for the route planner — pass the departure stop lat/lon from Google Maps.
 */
router.get('/arrivals-by-location', async (req, res) => {
  const { lat, lon, lineRef, radius = 150 } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  const apiKey = process.env.MTA_BUS_TIME_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'MTA_BUS_TIME_API_KEY not configured' });
  }

  try {
    // Step 1: find stops near the coordinate
    const stopsRes = await axios.get(`${BUSTIME_BASE}/where/stops-for-location.json`, {
      params: {
        lat,
        lon,
        latSpan: metersToDegreesLat(Number(radius)),
        lonSpan: metersToDegreesLon(Number(radius), Number(lat)),
        key: apiKey,
      },
    });

    const allStops = stopsRes.data?.data?.list || [];

    // Filter by route if lineRef given
    const lineShort = lineRef ? normalizeLineShort(lineRef) : null;
    const matchingStops = lineShort
      ? allStops.filter((s) => s.routes?.some((r) => r.shortName === lineShort))
      : allStops;

    if (matchingStops.length === 0) {
      return res.json({ stops: [], arrivals: [], fetchedAt: new Date().toISOString() });
    }

    // Step 2: query arrivals for the closest matching stop
    const closestStop = matchingStops[0];
    const monitoringRef = normalizeStopId(closestStop.id);

    const params = {
      key: apiKey,
      OperatorRef: 'MTA',
      MonitoringRef: monitoringRef,
      MaximumStopVisits: 5,
    };

    if (lineShort) {
      params.LineRef = normalizeLineRef(lineShort);
    }

    const arrivalsRes = await axios.get(`${BUSTIME_BASE}/siri/stop-monitoring.json`, { params });

    const visits =
      arrivalsRes.data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit ||
      [];

    const arrivals = visits.map((v) => {
      const journey = v.MonitoredVehicleJourney;
      const call = journey?.MonitoredCall;
      const expectedArrival = call?.ExpectedArrivalTime || call?.ExpectedDepartureTime || null;
      const aimedArrival = call?.AimedArrivalTime || call?.AimedDepartureTime || null;
      let minutesAway = null;
      if (expectedArrival) {
        minutesAway = Math.round((new Date(expectedArrival) - Date.now()) / 60000);
      }

      return {
        lineRef: journey?.LineRef,
        publishedLineName: journey?.PublishedLineName,
        destination: journey?.DestinationName,
        vehicleRef: journey?.VehicleRef,
        occupancy: journey?.Occupancy || null,
        progressStatus: journey?.ProgressStatus || null,
        stopName: call?.StopPointName,
        distanceFromStop: call?.Extensions?.Distances?.PresentableDistance || null,
        stopsAway: call?.Extensions?.Distances?.StopsFromCall ?? null,
        expectedArrival,
        aimedArrival,
        minutesAway,
        atStop: minutesAway !== null && minutesAway <= 0,
      };
    });

    arrivals.sort((a, b) => (a.minutesAway ?? 999) - (b.minutesAway ?? 999));

    return res.json({
      stop: {
        id: closestStop.id,
        code: closestStop.code || extractCode(closestStop.id),
        name: closestStop.name,
        direction: closestStop.direction,
        routes: closestStop.routes?.map((r) => r.shortName) || [],
      },
      fetchedAt: new Date().toISOString(),
      arrivals,
    });
  } catch (err) {
    console.error('Arrivals-by-location error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch arrivals by location' });
  }
});

// --- Helpers ---

function normalizeStopId(id) {
  // MTA uses IDs like "MTA_305423" — strip prefix for monitoring ref
  if (id.startsWith('MTA_')) return id.replace('MTA_', '');
  return id;
}

function normalizeLineRef(lineRef) {
  // SIRI expects "MTA NYCT_B38" format
  if (lineRef.startsWith('MTA NYCT_')) return lineRef;
  if (lineRef.startsWith('MTA_')) return `MTA NYCT_${lineRef.replace('MTA_', '')}`;
  return `MTA NYCT_${lineRef}`;
}

function normalizeLineShort(lineRef) {
  // Extract just the route name like "B38"
  return lineRef
    .replace('MTA NYCT_', '')
    .replace('MTA_', '')
    .trim();
}

function extractCode(stopId) {
  // "MTA_305423" -> "305423"
  const match = stopId.match(/(\d+)$/);
  return match ? match[1] : stopId;
}

function metersToDegreesLat(meters) {
  return meters / 111320;
}

function metersToDegreesLon(meters, lat) {
  return meters / (111320 * Math.cos((lat * Math.PI) / 180));
}

module.exports = router;
