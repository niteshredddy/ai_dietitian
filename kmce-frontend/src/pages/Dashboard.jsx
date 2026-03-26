import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Upload, CheckCircle, Flame, Droplets, Wheat,
  Zap, PieChart, Activity, Info, Plus, Minus, ChevronDown
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import SearchBar from '../components/SearchBar';

ChartJS.register(ArcElement, Tooltip, Legend);

const API = 'http://127.0.0.1:8000';

export default function Dashboard() {
  const { authHeader } = useAuth();
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [dailyGoal, setDailyGoal] = useState(2500);
  const [dailyTotal, setDailyTotal] = useState(0);
  const [portionSize, setPortionSize] = useState(1.0);
  const [showAlternatives, setShowAlternatives] = useState(false);

  // Load daily goal + today's intake
  useEffect(() => {
    const loadDailyData = async () => {
      try {
        const [goalRes, mealsRes] = await Promise.all([
          axios.get(`${API}/daily-goal`, authHeader()),
          axios.get(`${API}/meals?days=1`, authHeader()),
        ]);
        if (goalRes.data.daily_goal) setDailyGoal(goalRes.data.daily_goal);
        const todayCals = (mealsRes.data.meals || []).reduce((sum, m) => sum + m.calories, 0);
        setDailyTotal(todayCals);
      } catch {}
    };
    loadDailyData();
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error('Image must be under 10 MB'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setData(null);
  };

  const analyzeImage = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(
        `${API}/analyze?portion_size=${portionSize}`,
        formData,
        authHeader(),
      );
      setData(res.data);
      toast.success('Analysis complete!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Analysis failed');
    }
    setLoading(false);
  };

  const logMeal = async () => {
    if (!data) return;
    try {
      await axios.post(`${API}/meals`, {
        food_code: data.database_match.food_code,
        food_name: data.ai_detection.label,
        calories: data.macros.calories,
        protein: data.macros.protein,
        carbs: data.macros.carbs,
        fat: data.macros.fat,
        portion_size: portionSize,
        nutrients: data.nutrition_facts,
        recommendations: data.recommendations,
      }, authHeader());
      setDailyTotal(prev => prev + data.macros.calories);
      toast.success('Meal logged!');
    } catch {
      toast.error('Failed to log meal');
    }
  };

  const handleSearchSelect = (item) => {
    setData({
      ai_detection: { label: item.name, confidence: item.similarity },
      database_match: { name: item.name, similarity: item.similarity, food_code: item.food_code },
      nutrition_facts: item.nutrition_facts,
      macros: { calories: item.calories, protein: item.protein, carbs: item.carbs, fat: item.fat },
      recommendations: [],
      alternatives: [],
      portion_size: 1.0,
    });
    setPortionSize(1.0);
    toast.success(`Selected: ${item.name}`);
  };

  const protein = data?.macros?.protein || 0;
  const carbs   = data?.macros?.carbs || 0;
  const fat     = data?.macros?.fat || 0;

  const chartData = useMemo(() => ({
    labels: ['Protein', 'Carbs', 'Fat'],
    datasets: [{
      data: [protein, carbs, fat],
      backgroundColor: ['#16a34a', '#4ade80', '#86efac'],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  }), [protein, carbs, fat]);

  const chartOptions = {
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 8 },
    },
  };

  const ringCirc = 2 * Math.PI * 34;
  const ringPct  = Math.min(dailyTotal / dailyGoal, 1);

  return (
    <main className="main">
      {/* LEFT COLUMN */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Upload Card */}
        <div className="card">
          <p className="section-header">Upload Meal Photo</p>
          <div
            className={`upload-zone${preview ? ' has-image' : ''}`}
            onClick={() => document.getElementById('food-input').click()}
          >
            {preview ? (
              <>
                <img src={preview} alt="preview" />
                <div className="upload-overlay"><Upload size={20} /> Change</div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="upload-icon"><Upload size={24} color="#22c55e" /></div>
                <p className="upload-label">Click to browse</p>
                <p className="upload-hint">JPEG, PNG, or WebP · Max 10 MB</p>
              </div>
            )}
            <input id="food-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          </div>

          {/* Portion Size */}
          <div className="portion-row">
            <span className="portion-label">Portion</span>
            <div className="portion-controls">
              <button className="portion-btn" onClick={() => setPortionSize(p => Math.max(0.25, +(p - 0.25).toFixed(2)))}><Minus size={14} /></button>
              <span className="portion-value">{portionSize}x</span>
              <button className="portion-btn" onClick={() => setPortionSize(p => Math.min(5, +(p + 0.25).toFixed(2)))}><Plus size={14} /></button>
            </div>
          </div>

          <button className="btn-primary" onClick={analyzeImage} disabled={!file || loading}>
            {loading ? <div className="spinner" /> : <Activity size={16} />} Analyze Meal
          </button>
        </div>

        {/* Search Card */}
        <div className="card">
          <p className="section-header">Or Search Manually</p>
          <SearchBar onSelect={handleSearchSelect} />
        </div>

        {/* Daily Ring Card */}
        <div className="card">
          <p className="section-header">Daily Progress</p>
          <div className="ring-card">
            <div className="ring-wrapper">
              <svg viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="#dcfce7" strokeWidth="8" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="#16a34a" strokeWidth="8"
                  strokeDasharray={ringCirc} strokeDashoffset={ringCirc * (1 - ringPct)}
                  strokeLinecap="round" style={{ transition: 'all 1s' }} />
              </svg>
              <div className="ring-center">
                <span className="ring-value">{Math.round(dailyTotal)}</span>
                <span className="ring-unit">kcal</span>
              </div>
            </div>
            <div className="ring-info">
              <h4>Today's Intake</h4>
              <p>Goal: {dailyGoal} kcal · {Math.round((dailyTotal / dailyGoal) * 100)}% used</p>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div>
        {data ? (
          <div className="results fade-in">
            {/* Food Banner */}
            <div className="food-banner">
              <div className="banner-badge"><CheckCircle size={12} /> AI Detected</div>
              <h2 className="banner-food">{data.ai_detection.label}</h2>
              <div className="banner-meta">
                <span>Confidence: <strong>{data.ai_detection.confidence}</strong></span>
                <span>Match: <strong>{data.database_match.similarity}</strong></span>
                {portionSize !== 1.0 && <span>Portion: <strong>{portionSize}x</strong></span>}
              </div>
              <div className="match-row">FNDDS Match: <strong>{data.database_match.name}</strong></div>
              <button className="btn-log-meal" onClick={logMeal}>
                <Plus size={14} /> Log This Meal
              </button>
            </div>

            {/* Macro Cards */}
            <div className="macros-grid">
              {[
                { label: 'Calories', val: data.macros.calories, unit: 'kcal', color: '#ea580c', icon: <Zap /> },
                { label: 'Protein', val: protein, unit: 'g', color: '#16a34a', icon: <Droplets /> },
                { label: 'Carbs', val: carbs, unit: 'g', color: '#22c55e', icon: <Wheat /> },
                { label: 'Fat', val: fat, unit: 'g', color: '#ca8a04', icon: <Flame /> },
              ].map(m => (
                <div key={m.label} className="macro-card">
                  <div className="macro-icon" style={{ background: `${m.color}15`, color: m.color }}>{m.icon}</div>
                  <div className="macro-value">{m.val}<span className="macro-unit">{m.unit}</span></div>
                  <div className="macro-label" style={{ color: m.color }}>{m.label}</div>
                </div>
              ))}
            </div>

            {/* AI Recommendations */}
            {data.recommendations && data.recommendations.length > 0 && (
              <div className="card recs-card">
                <p className="section-header">AI Diet Tips</p>
                {data.recommendations.map((r, i) => (
                  <div key={i} className={`rec-item rec-${r.type}`}>
                    <span className="rec-icon">{r.icon}</span>
                    <span>{r.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Chart + Nutrients */}
            <div className="data-row">
              <div className="chart-card">
                <p className="section-header">Macro Split</p>
                <div style={{ width: 130, height: 130 }}>
                  <Doughnut data={chartData} options={chartOptions} />
                </div>
                <div className="chart-legend">
                  {[
                    { label: 'Protein', val: protein, color: '#16a34a' },
                    { label: 'Carbs', val: carbs, color: '#4ade80' },
                    { label: 'Fat', val: fat, color: '#86efac' },
                  ].map(l => (
                    <div key={l.label} className="legend-item">
                      <span className="legend-left"><span className="legend-dot" style={{ background: l.color }} />{l.label}</span>
                      <span className="legend-value">{l.val}g</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="nutrients-card">
                <p className="section-header">All Nutrients</p>
                {Object.entries(data.nutrition_facts).map(([k, v]) => (
                  <div key={k} className="nutrient-row">
                    <span className="nutrient-name">{k}</span>
                    <span className="nutrient-val">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alternatives */}
            {data.alternatives && data.alternatives.length > 0 && (
              <div className="card">
                <button className="alt-toggle" onClick={() => setShowAlternatives(!showAlternatives)}>
                  <span className="section-header" style={{ margin: 0 }}>Alternative Detections ({data.alternatives.length})</span>
                  <ChevronDown size={16} style={{ transform: showAlternatives ? 'rotate(180deg)' : 'rotate(0)', transition: '0.2s' }} />
                </button>
                {showAlternatives && data.alternatives.map((alt, i) => (
                  <div key={i} className="alt-item">
                    <strong>{alt.label}</strong>
                    <span>Confidence: {alt.confidence} · Match: {alt.database_match.similarity}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><PieChart size={32} color="#22c55e" /></div>
            <h3>Ready to Scan</h3>
            <p>Upload a photo or search a food to see AI-powered nutrition analysis.</p>
          </div>
        )}
      </div>
    </main>
  );
}
