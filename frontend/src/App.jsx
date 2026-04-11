import { useState, useEffect } from 'react';
import { RouteSearchForm } from './components/LocationSearch';
import { RouteDisplay } from './components/RouteDisplay';
import { planRoute, checkHealth } from './services/api';

function Header() {
  return (
    <header className="bg-mta-blue text-white px-4 pt-safe-top">
      <div className="max-w-lg mx-auto py-4 flex items-center gap-3">
        <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl">
          🚌
        </div>
        <div>
          <h1 className="text-lg font-extrabold leading-tight tracking-tight">
            Brooklyn Bus
          </h1>
          <p className="text-xs text-blue-200 font-medium">Real-time commute planner</p>
        </div>
      </div>
    </header>
  );
}

function ApiKeyBanner({ health }) {
  if (!health) return null;
  const missing = [];
  if (!health.googleMaps) missing.push('Google Maps');
  if (!health.mtaBusTime) missing.push('MTA Bus Time');
  if (missing.length === 0) return null;

  return (
    <div className="mx-4 mt-3 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
      <p className="font-semibold">⚠️ API keys not configured</p>
      <p className="text-xs mt-0.5 text-red-600">
        Missing: {missing.join(', ')}. Copy <code>.env.example</code> to{' '}
        <code>backend/.env</code> and add your keys.
      </p>
    </div>
  );
}

function ErrorCard({ message, onDismiss }) {
  return (
    <div className="card border-red-200 bg-red-50">
      <div className="flex items-start gap-2">
        <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-700">Could not plan route</p>
          <p className="text-xs text-red-600 mt-0.5">{message}</p>
        </div>
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-600 transition-colors flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function LoadingRoute() {
  return (
    <div className="card text-center py-10">
      <div className="inline-block w-10 h-10 border-3 border-mta-blue border-t-transparent
                      rounded-full animate-spin mb-4" style={{ borderWidth: '3px' }} />
      <p className="text-sm font-semibold text-gray-700">Planning your commute…</p>
      <p className="text-xs text-gray-400 mt-1">Fetching real-time data</p>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  const [lastSearch, setLastSearch] = useState(null);

  // Check API key status on mount
  useEffect(() => {
    checkHealth()
      .then(setHealth)
      .catch(() => {}); // ignore — server may not be up yet
  }, []);

  async function handleSearch(origin, destination) {
    setLoading(true);
    setError(null);
    setRoute(null);
    setLastSearch({ origin, destination });

    try {
      const result = await planRoute(origin, destination);
      setRoute(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    setRoute(null);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <ApiKeyBanner health={health} />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-4">
        {/* Search form — always visible at top */}
        <div className="card">
          <RouteSearchForm onSearch={handleSearch} loading={loading} />
        </div>

        {/* Results area */}
        {loading && <LoadingRoute />}

        {error && !loading && (
          <ErrorCard message={error} onDismiss={() => setError(null)} />
        )}

        {route && !loading && (
          <RouteDisplay route={route} onRefresh={handleRefresh} />
        )}

        {/* Empty state */}
        {!route && !loading && !error && (
          <div className="card text-center py-10">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="text-base font-semibold text-gray-700">Enter your commute above</p>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">
              We'll show you the exact route with real-time MTA bus arrivals —
              no need to be at the stop to get the codes.
            </p>

            {/* Example commute card */}
            <div className="mt-5 text-left bg-gray-50 rounded-xl p-3 text-xs text-gray-500 space-y-1">
              <p className="font-semibold text-gray-600 mb-1.5">Your daily commute</p>
              <p>📍 Journal Square (PATH)</p>
              <p className="ml-3 text-gray-400">↓ PATH train → 14 St / 6 Av</p>
              <p className="ml-3 text-gray-400">↓ L train → Metropolitan Av</p>
              <p>🚌 MTA bus → Grand St</p>
              <p>🏁 10 Grand Street, Brooklyn</p>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center py-4 text-xs text-gray-400">
        Data from MTA Bus Time · Google Maps
      </footer>
    </div>
  );
}
