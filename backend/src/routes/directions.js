const express = require('express');
const axios = require('axios');
const { parseTransitRoute } = require('../utils/routeParser');

const router = express.Router();

const GMAPS_BASE = 'https://maps.googleapis.com/maps/api';

/**
 * POST /api/directions
 * Body: { origin: string, destination: string, departureTime?: number (unix) }
 * Returns: { route, totalDuration, totalDistance, legs }
 */
router.post('/', async (req, res) => {
  const { origin, destination, departureTime } = req.body;

  if (!origin || !destination) {
    return res.status(400).json({ error: 'origin and destination are required' });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured on server' });
  }

  try {
    const params = {
      origin,
      destination,
      mode: 'transit',
      alternatives: false,
      key: apiKey,
    };

    // Use current time + 2 minutes if not provided, so we get a real-time route
    params.departure_time = departureTime || Math.floor(Date.now() / 1000) + 120;

    const { data } = await axios.get(`${GMAPS_BASE}/directions/json`, { params });

    if (data.status !== 'OK') {
      const message = data.error_message || data.status;
      return res.status(400).json({ error: `Google Maps error: ${message}` });
    }

    const route = data.routes[0];
    const leg = route.legs[0]; // transit usually returns one mega-leg

    const legs = parseTransitRoute(route);

    return res.json({
      summary: route.summary,
      totalDuration: leg.duration.text,
      totalDurationSeconds: leg.duration.value,
      totalDistance: leg.distance.text,
      departureTime: leg.departure_time?.text || null,
      arrivalTime: leg.arrival_time?.text || null,
      legs,
    });
  } catch (err) {
    console.error('Directions error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch directions' });
  }
});

/**
 * GET /api/directions/geocode?address=...
 * Converts a text address to lat/lon + formatted address
 */
router.get('/geocode', async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ error: 'address is required' });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured' });
  }

  try {
    const { data } = await axios.get(`${GMAPS_BASE}/geocode/json`, {
      params: { address, key: apiKey },
    });

    if (data.status !== 'OK') {
      return res.status(400).json({ error: `Geocode error: ${data.status}` });
    }

    const result = data.results[0];
    return res.json({
      formattedAddress: result.formatted_address,
      location: result.geometry.location,
    });
  } catch (err) {
    console.error('Geocode error:', err.message);
    return res.status(500).json({ error: 'Failed to geocode address' });
  }
});

/**
 * GET /api/directions/autocomplete?input=...
 * Returns place suggestions (NYC-biased)
 */
router.get('/autocomplete', async (req, res) => {
  const { input } = req.query;
  if (!input) return res.status(400).json({ error: 'input is required' });

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not configured' });

  try {
    const { data } = await axios.get(`${GMAPS_BASE}/place/autocomplete/json`, {
      params: {
        input,
        key: apiKey,
        // Bias toward NYC metro area
        location: '40.7128,-74.0060',
        radius: 50000,
        types: 'geocode|establishment|transit_station',
      },
    });

    const suggestions = (data.predictions || []).map((p) => ({
      placeId: p.place_id,
      description: p.description,
      mainText: p.structured_formatting.main_text,
      secondaryText: p.structured_formatting.secondary_text,
    }));

    return res.json({ suggestions });
  } catch (err) {
    console.error('Autocomplete error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch suggestions' });
  }
});

module.exports = router;
