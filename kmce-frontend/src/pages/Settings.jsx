import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, User, Ruler, Weight, Calendar, Activity, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const API = 'http://127.0.0.1:8000';

export default function Settings() {
  const { authHeader, username } = useAuth();
  const [form, setForm] = useState({
    weight_kg: '', height_cm: '', age: '', gender: 'male', activity_level: 'moderate',
  });
  const [tdee, setTdee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [profRes, goalRes] = await Promise.all([
          axios.get(`${API}/profile`, authHeader()),
          axios.get(`${API}/daily-goal`, authHeader()),
        ]);
        if (profRes.data.status === 'success' && profRes.data.profile) {
          const p = profRes.data.profile;
          setForm({
            weight_kg: p.weight_kg || '',
            height_cm: p.height_cm || '',
            age: p.age || '',
            gender: p.gender || 'male',
            activity_level: p.activity_level || 'moderate',
          });
        }
        if (goalRes.data.daily_goal) setTdee(goalRes.data);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.weight_kg || !form.height_cm || !form.age) {
      toast.error('Please fill all fields'); return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/profile`, {
        weight_kg: parseFloat(form.weight_kg),
        height_cm: parseFloat(form.height_cm),
        age: parseInt(form.age),
        gender: form.gender,
        activity_level: form.activity_level,
      }, authHeader());
      // Refresh TDEE
      const goalRes = await axios.get(`${API}/daily-goal`, authHeader());
      setTdee(goalRes.data);
      toast.success('Profile saved!');
    } catch {
      toast.error('Failed to save profile');
    }
    setSaving(false);
  };

  const activityOptions = [
    { value: 'sedentary', label: 'Sedentary (office job)' },
    { value: 'light', label: 'Light (1-3 days/week)' },
    { value: 'moderate', label: 'Moderate (3-5 days/week)' },
    { value: 'active', label: 'Active (6-7 days/week)' },
    { value: 'very_active', label: 'Very Active (athlete)' },
  ];

  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Personalize your nutrition goals</p>
        </div>
      </div>

      <div className="settings-grid fade-in">
        {/* Profile Form */}
        <div className="card settings-form-card">
          <p className="section-header"><User size={14} /> Body Profile</p>
          <form onSubmit={handleSave} className="settings-form">
            <div className="settings-row">
              <div className="input-group">
                <Weight size={16} className="input-icon" />
                <input type="number" placeholder="Weight (kg)" value={form.weight_kg}
                  onChange={e => setForm({ ...form, weight_kg: e.target.value })} step="0.1" required />
              </div>
              <div className="input-group">
                <Ruler size={16} className="input-icon" />
                <input type="number" placeholder="Height (cm)" value={form.height_cm}
                  onChange={e => setForm({ ...form, height_cm: e.target.value })} step="0.1" required />
              </div>
            </div>
            <div className="settings-row">
              <div className="input-group">
                <Calendar size={16} className="input-icon" />
                <input type="number" placeholder="Age" value={form.age}
                  onChange={e => setForm({ ...form, age: e.target.value })} min="10" max="120" required />
              </div>
              <div className="input-group select-group">
                <User size={16} className="input-icon" />
                <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>
            <div className="input-group select-group">
              <Activity size={16} className="input-icon" />
              <select value={form.activity_level} onChange={e => setForm({ ...form, activity_level: e.target.value })}>
                {activityOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <div className="spinner" /> : <Save size={16} />} Save Profile
            </button>
          </form>
        </div>

        {/* TDEE Display */}
        <div className="card tdee-card">
          <p className="section-header"><Zap size={14} /> Your Daily Target</p>
          {tdee ? (
            <div className="tdee-display">
              <div className="tdee-big">
                <span className="tdee-number">{tdee.daily_goal}</span>
                <span className="tdee-unit">kcal / day</span>
              </div>
              {tdee.bmr && (
                <div className="tdee-detail">
                  <p>BMR: <strong>{tdee.bmr} kcal</strong> (resting metabolic rate)</p>
                  <p>Source: <strong>{tdee.source === 'calculated' ? 'Mifflin-St Jeor Equation' : 'Default'}</strong></p>
                </div>
              )}
              <div className="tdee-info">
                This is your Total Daily Energy Expenditure (TDEE) — the estimated calories your body uses per day based on your profile and activity level.
              </div>
            </div>
          ) : (
            <div className="tdee-display">
              <p style={{ color: '#94a3b8' }}>Fill in your profile to calculate your personalized daily goal.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
