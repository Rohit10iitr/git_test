require('dotenv').config();
const express = require('express');
const cors = require('cors');

const directionsRouter = require('./routes/directions');
const bustimeRouter = require('./routes/bustime');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/directions', directionsRouter);
app.use('/api/bustime', bustimeRouter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    googleMaps: !!process.env.GOOGLE_MAPS_API_KEY,
    mtaBusTime: !!process.env.MTA_BUS_TIME_API_KEY,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Brooklyn Bus backend running on http://localhost:${PORT}`);
});
