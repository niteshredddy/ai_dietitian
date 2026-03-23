import React, { useState, useMemo } from 'react';
import axios from 'axios';
import {
  Upload, CheckCircle, Flame, Droplets, Wheat,
  Zap, PieChart, Activity, Info
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const DAILY_GOAL = 2500;

function App() {
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState(null);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(false);
  const [dailyTotal, setDailyTotal] = useState(0);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setData(null);
  };

  // HELPER: Returns a numeric value for specific nutrient keys
  const getNutrient = (keys) => {
    if (!data?.nutrition_facts) return 0;
    const foundKey = keys.find(k => data.nutrition_facts[k] !== undefined);
    const val = foundKey ? data.nutrition_facts[foundKey] : 0;
    return parseFloat(val) || 0; 
  };

  const analyzeImage = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post('http://127.0.0.1:8000/analyze', formData);
      const resData = res.data;
      setData(resData);
      
      // Calculate Energy for progress ring
      const facts = resData.nutrition_facts;
      const energyKeys = ['Energy (kcal)', 'Code Energy (kcal)', '208'];
      const foundEnergyKey = energyKeys.find(k => facts[k] !== undefined);
      const kcal = foundEnergyKey ? parseFloat(facts[foundEnergyKey]) : 0;
      
      if (!isNaN(kcal)) {
        setDailyTotal(prev => prev + kcal);
      }
    } catch (err) {
      console.error("Analysis Error:", err);
    }
    setLoading(false);
  };

  const protein = getNutrient(['Protein (g)', 'Code Protein (g)', '203']);
  const carbs   = getNutrient(['Carbohydrate (g)', 'Code Carbohydrate (g)', '205']);
  const fat     = getNutrient(['Total Fat (g)', 'Code Total Fat (g)', '204']);

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
  const ringPct  = Math.min(dailyTotal / DAILY_GOAL, 1);

  return (
    <div className="app" style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* NAVBAR */}
      <nav className="navbar" style={{ backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 0' }}>
        <div className="navbar-inner" style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 2rem' }}>
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="logo-icon" style={{ backgroundColor: '#22c55e', color: 'white', padding: '6px', borderRadius: '8px' }}><Zap size={18} /></div>
            <span className="logo-text" style={{ fontWeight: 'bold', fontSize: '1.25rem' }}>Nutri<span style={{ color: '#22c55e' }}>Vision</span></span>
          </div>
          <div className="nav-links" style={{ display: 'flex', gap: '2rem', color: '#64748b', fontSize: '0.9rem' }}>
            <span className="nav-link active" style={{ color: '#16a34a', fontWeight: '600' }}>Dashboard</span>
            <span className="nav-link">History</span>
            <span className="nav-link">Settings</span>
          </div>
        </div>
      </nav>

      <main className="main" style={{ maxWidth: '1200px', margin: '2rem auto', display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', padding: '0 2rem' }}>
        
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <p className="section-header" style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Upload Meal Photo</p>
            <div className={`upload-zone${preview ? ' has-image' : ''}`} onClick={() => document.getElementById('food-input').click()} style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', height: '200px', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
              {preview ? (
                <><img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /><div className="upload-overlay" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', opacity: 0, transition: '0.3s' }}><Upload size={20} /> Change</div></>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}><Upload size={24} color="#22c55e" style={{ marginBottom: '0.5rem' }} /><p style={{ fontSize: '0.85rem' }}>Click to browse</p></div>
              )}
              <input id="food-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
            </div>
            <button className="btn-primary" onClick={analyzeImage} disabled={!file || loading} style={{ width: '100%', marginTop: '1rem', backgroundColor: '#22c55e', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              {loading ? <div className="spinner" /> : <Activity size={16} />} Analyze Meal
            </button>
          </div>

          <div className="card" style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <p className="section-header" style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1rem' }}>Daily Progress</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div className="ring-wrapper" style={{ position: 'relative', width: '80px', height: '80px' }}>
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#dcfce7" strokeWidth="8" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#16a34a" strokeWidth="8" strokeDasharray={ringCirc} strokeDashoffset={ringCirc * (1 - ringPct)} strokeLinecap="round" style={{ transition: 'all 1s' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>{Math.round(dailyTotal)}</span>
                  <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>kcal</span>
                </div>
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Today's Intake</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Goal: {DAILY_GOAL} kcal · {Math.round((dailyTotal/DAILY_GOAL)*100)}% used</p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {data ? (
            <div className="results fade-in">
              <div className="food-banner" style={{ backgroundColor: '#16a34a', color: 'white', padding: '2rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', marginBottom: '0.75rem' }}><CheckCircle size={12} /> AI Detected</div>
                <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '2.25rem' }}>{data.ai_detection.label}</h2>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', opacity: 0.9 }}>
                  <span>Confidence: <strong>{data.ai_detection.confidence}</strong></span>
                  <span>Match: <strong>{data.database_match.similarity}</strong></span>
                </div>
                <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '0.85rem' }}>
                  FNDDS Match: <strong>{data.database_match.name}</strong>
                </div>
              </div>

              <div className="macros-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                {[{label: 'Protein', val: protein, color: '#16a34a', icon: <Droplets/>}, {label: 'Carbs', val: carbs, color: '#22c55e', icon: <Wheat/>}, {label: 'Fat', val: fat, color: '#ca8a04', icon: <Flame/>}].map(m => (
                  <div key={m.label} style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ color: m.color, marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}>{m.icon}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{m.val}g</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>{m.label}</div>
                  </div>
                ))}
              </div>

              <div className="data-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <p className="section-header" style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1.5rem' }}>Macro Split</p>
                  <div style={{ display: 'flex', justifyContent: 'center' }}><div style={{ width: 150, height: 150 }}><Doughnut data={chartData} options={chartOptions} /></div></div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                  <p className="section-header" style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '1rem' }}>Micro-Nutrients</p>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                    {Object.entries(data.nutrition_facts).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem' }}>
                        <span style={{ color: '#64748b' }}>{k}</span>
                        <span style={{ fontWeight: '600' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '4rem', textAlign: 'center' }}>
              <PieChart size={48} color="#e2e8f0" style={{ marginBottom: '1rem' }} />
              <h3 style={{ margin: 0, color: '#475569' }}>Ready to Scan</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '300px' }}>Upload a photo to see Semantic Neural Search in action.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;