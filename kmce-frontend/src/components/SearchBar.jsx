import React, { useState } from 'react';
import axios from 'axios';
import { Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = 'http://127.0.0.1:8000';

export default function SearchBar({ onSelect }) {
  const { authHeader } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const search = async (q) => {
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await axios.get(`${API}/search?q=${encodeURIComponent(q)}`, authHeader());
      setResults(res.data.results || []);
      setOpen(true);
    } catch { setResults([]); }
    setLoading(false);
  };

  const handleChange = (e) => {
    setQuery(e.target.value);
    search(e.target.value);
  };

  const handleSelect = (item) => {
    setOpen(false);
    setQuery('');
    if (onSelect) onSelect(item);
  };

  return (
    <div className="search-bar-wrapper">
      <div className="search-input-row">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search food manually..."
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {query && <button className="search-clear" onClick={() => { setQuery(''); setOpen(false); }}><X size={14} /></button>}
      </div>
      {open && results.length > 0 && (
        <div className="search-dropdown">
          {results.map((r, i) => (
            <div key={i} className="search-result" onClick={() => handleSelect(r)}>
              <div className="search-result-name">{r.name}</div>
              <div className="search-result-meta">
                <span>{r.calories} kcal</span>
                <span>P: {r.protein}g</span>
                <span>C: {r.carbs}g</span>
                <span>F: {r.fat}g</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {loading && <div className="search-loading">Searching...</div>}
    </div>
  );
}
