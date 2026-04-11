import { useState, useEffect, useRef, useCallback } from 'react';
import { autocompleteLocation } from '../services/api';

/**
 * Single-field location input with debounced autocomplete dropdown.
 */
export function LocationInput({ label, placeholder, value, onChange, icon }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const fetchSuggestions = useCallback(async (q) => {
    if (q.length < 2) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const { suggestions: s } = await autocompleteLocation(q);
      setSuggestions(s || []);
      setOpen(true);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleChange(e) {
    const q = e.target.value;
    setQuery(q);
    onChange(q); // keep parent in sync with raw text (for fallback)
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 280);
  }

  function handleSelect(suggestion) {
    setQuery(suggestion.description);
    onChange(suggestion.description);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">{icon}</span>
        )}
        <input
          type="text"
          className={`input-field ${icon ? 'pl-9' : ''}`}
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <LoadingDots />
          </span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <li
              key={s.placeId}
              className="px-4 py-3 cursor-pointer hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-b-0"
              onMouseDown={() => handleSelect(s)}
            >
              <p className="text-sm font-medium text-gray-900 truncate">{s.mainText}</p>
              <p className="text-xs text-gray-500 truncate">{s.secondaryText}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="flex gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * Two-field search form (origin + destination) with a swap button.
 */
export function RouteSearchForm({ onSearch, loading }) {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');

  // Pre-fill with user's known commute for convenience
  const QUICK_FILLS = [
    {
      label: 'My Daily Commute',
      origin: 'Journal Square PATH Station, Jersey City, NJ',
      destination: '10 Grand Street, Brooklyn, NY',
    },
    {
      label: 'Return Home',
      origin: '10 Grand Street, Brooklyn, NY',
      destination: 'Journal Square PATH Station, Jersey City, NJ',
    },
  ];

  function handleSwap() {
    setOrigin(destination);
    setDestination(origin);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) return;
    onSearch(origin.trim(), destination.trim());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* Quick fill chips */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_FILLS.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => { setOrigin(q.origin); setDestination(q.destination); }}
            className="pill bg-mta-blue/10 text-mta-blue hover:bg-mta-blue/20 transition-colors cursor-pointer"
          >
            {q.label}
          </button>
        ))}
      </div>

      <LocationInput
        label="From"
        placeholder="e.g. Journal Square PATH Station"
        value={origin}
        onChange={setOrigin}
        icon="📍"
      />

      {/* Swap button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 border-t border-dashed border-gray-200" />
        <button
          type="button"
          onClick={handleSwap}
          title="Swap origin and destination"
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
        >
          ⇅
        </button>
        <div className="flex-1 border-t border-dashed border-gray-200" />
      </div>

      <LocationInput
        label="To"
        placeholder="e.g. 10 Grand Street, Brooklyn"
        value={destination}
        onChange={setDestination}
        icon="🏁"
      />

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={loading || !origin.trim() || !destination.trim()}
      >
        {loading ? 'Planning route…' : 'Plan My Commute'}
      </button>
    </form>
  );
}
