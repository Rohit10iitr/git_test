# Brooklyn Bus — Real-Time Commute Planner

A mobile-first web app that plans your mixed transit commute (PATH + Subway + MTA Bus) and shows **real-time MTA bus arrivals** without needing to be physically at the bus stop.

## The Problem It Solves

NYC's MTA Bus Time SMS service is incredibly accurate — text the 6-digit code from a bus stop pole to get real-time arrivals and occupancy. But you need to be at the stop to see the code.

This app **pre-fetches those stop codes from MTA's public data** so you can get the same information from your phone before you even leave home.

## How It Works

```
User enters start + end address
        ↓
Google Maps Directions API (transit mode)
  → Identifies legs: PATH / L-train / MTA Bus / Walk
        ↓
For each BUS leg:
  MTA Bus Time API (stops-for-location)
  → Finds the stop ID near your departure coordinates
        ↓
  MTA Bus Time SIRI API (stop-monitoring)
  → Returns live arrivals — same data as the SMS service
        ↓
Display: route + real-time bus countdown + occupancy
```

## Setup

### 1. Get API Keys

| Key | Where to get it | Cost |
|-----|----------------|------|
| **Google Maps Platform** | console.cloud.google.com — enable Directions, Geocoding, Places APIs | Free tier ($200/mo credit) |
| **MTA Bus Time** | bustime.mta.info/wiki/Developers/Index — fill out the form | Free |

### 2. Configure the backend

```bash
cp backend/.env.example backend/.env
# Edit backend/.env and add your keys
```

### 3. Install dependencies

```bash
npm install
cd frontend && npm install && cd ..
cd backend  && npm install && cd ..
```

### 4. Run in development

```bash
# Starts both backend (port 3001) and frontend (port 5173)
npm run dev
```

Open http://localhost:5173 in your browser.

## Project Structure

```
brooklyn-bus-commute-app/
├── backend/                    Express API server
│   ├── .env.example            Copy to .env and fill in keys
│   └── src/
│       ├── index.js            Server entry point (port 3001)
│       ├── routes/
│       │   ├── directions.js   Google Maps proxy (directions + geocoding + autocomplete)
│       │   └── bustime.js      MTA Bus Time proxy (stops + live arrivals)
│       └── utils/
│           └── routeParser.js  Parses Google Maps transit legs
│
└── frontend/                   React + Vite app
    └── src/
        ├── App.jsx             Root component + state
        ├── services/api.js     Typed API calls to backend
        └── components/
            ├── LocationSearch.jsx   Autocomplete search form
            ├── RouteDisplay.jsx     Full route layout + summary card
            ├── RouteLeg.jsx         Single leg (walk/bus/subway/rail)
            └── BusArrivalCard.jsx   Live MTA arrivals with auto-refresh
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/directions` | Plan a transit route `{ origin, destination }` |
| `GET`  | `/api/directions/autocomplete?input=` | Address autocomplete (NYC-biased) |
| `GET`  | `/api/directions/geocode?address=` | Address to coordinates |
| `GET`  | `/api/bustime/arrivals?stopId=&lineRef=` | Live arrivals by stop ID |
| `GET`  | `/api/bustime/arrivals-by-location?lat=&lon=&lineRef=` | Live arrivals near a coordinate |
| `GET`  | `/api/bustime/stops?lat=&lon=&radius=` | MTA stops near a coordinate |
| `GET`  | `/api/health` | Check API key configuration status |

## Your Daily Commute

Pre-loaded as a quick-fill button:

```
Journal Square PATH Station, Jersey City, NJ
  ↓ PATH train
14 St / 6 Av (Manhattan)
  ↓ L train
Metropolitan Av / Lorimer St  —OR—  Bedford Av (Brooklyn)
  ↓ MTA bus (live arrivals shown automatically)
10 Grand Street, Brooklyn, NY
```

## Features

- Live bus arrivals — same real-time data as the MTA SMS service
- Auto-refresh — bus times update every 30 seconds
- Occupancy — see how crowded the bus is before it arrives
- Autocomplete — smart address search biased to NYC metro area
- Quick fill — one tap to load your saved commute
- Swap — instantly reverse your route for the commute home
- Mobile-first — designed for your phone screen
