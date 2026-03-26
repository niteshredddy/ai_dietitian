import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trash2, Calendar, Utensils, Flame } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const API = 'http://127.0.0.1:8000';

export default function History() {
  const { authHeader } = useAuth();
  const [meals, setMeals] = useState([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  const loadMeals = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/meals?days=${days}`, authHeader());
      setMeals(res.data.meals || []);
    } catch {
      toast.error('Failed to load history');
    }
    setLoading(false);
  };

  useEffect(() => { loadMeals(); }, [days]);

  const deleteMeal = async (id) => {
    try {
      await axios.delete(`${API}/meals/${id}`, authHeader());
      setMeals(prev => prev.filter(m => m._id !== id));
      toast.success('Meal removed');
    } catch {
      toast.error('Delete failed');
    }
  };

  // Group meals by date
  const grouped = meals.reduce((acc, m) => {
    const date = m.logged_at.split('T')[0];
    if (!acc[date]) acc[date] = [];
    acc[date].push(m);
    return acc;
  }, {});

  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Meal History</h1>
          <p className="page-subtitle">Track everything you've eaten</p>
        </div>
        <div className="history-filter">
          {[7, 14, 30].map(d => (
            <button key={d} className={`filter-btn ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="skeleton-list">
          {[1, 2, 3].map(i => <div key={i} className="skeleton-card" />)}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="empty-state" style={{ minHeight: '300px' }}>
          <div className="empty-icon"><Utensils size={32} color="#22c55e" /></div>
          <h3>No Meals Logged</h3>
          <p>Start by analyzing a food on the Dashboard and clicking "Log This Meal".</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, dateMeals]) => {
          const dayCals = dateMeals.reduce((s, m) => s + m.calories, 0);
          return (
            <div key={date} className="history-day fade-in">
              <div className="history-day-header">
                <div className="history-date">
                  <Calendar size={14} />
                  <span>{new Date(date + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
                </div>
                <div className="history-day-total">
                  <Flame size={14} /> {Math.round(dayCals)} kcal
                </div>
              </div>
              {dateMeals.map(m => (
                <div key={m._id} className="history-meal-card">
                  <div className="history-meal-info">
                    <h4>{m.food_name}</h4>
                    <div className="history-meal-macros">
                      <span>{Math.round(m.calories)} kcal</span>
                      <span>P: {m.protein.toFixed(1)}g</span>
                      <span>C: {m.carbs.toFixed(1)}g</span>
                      <span>F: {m.fat.toFixed(1)}g</span>
                      {m.portion_size !== 1 && <span className="portion-badge">{m.portion_size}x</span>}
                    </div>
                  </div>
                  <button className="history-delete" onClick={() => deleteMeal(m._id)} title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          );
        })
      )}
    </main>
  );
}
