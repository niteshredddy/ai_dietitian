import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart as BarChartIcon, Download, TrendingUp } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import { saveAs } from 'file-saver';
import { useAuth } from '../context/AuthContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

const API = 'http://127.0.0.1:8000';

export default function Analytics() {
  const { authHeader } = useAuth();
  const [range, setRange] = useState('week');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/analytics?range=${range}`, authHeader());
        setData(res.data);
      } catch {
        toast.error('Failed to load analytics');
      }
      setLoading(false);
    };
    load();
  }, [range]);

  const exportData = async (format) => {
    try {
      const res = await axios.get(`${API}/export?format=${format}&range=${range}`, {
        ...authHeader(),
        responseType: 'blob',
      });
      const ext = format === 'csv' ? 'csv' : 'pdf';
      saveAs(res.data, `nutrivision_${range}.${ext}`);
      toast.success(`${format.toUpperCase()} downloaded!`);
    } catch {
      toast.error('Export failed');
    }
  };

  const labels = data?.days?.map(d => d.date.slice(5)) || [];
  
  const lineChartData = {
    labels,
    datasets: [
      {
        label: 'Calories',
        data: data?.days?.map(d => d.calories) || [],
        borderColor: '#16a34a',
        backgroundColor: '#16a34a',
        tension: 0.3,
        borderWidth: 2.5,
        pointRadius: 4,
        pointHoverRadius: 6,
      }
    ]
  };

  const barChartData = {
    labels,
    datasets: [
      { label: 'Protein (g)', data: data?.days?.map(d => d.protein) || [], backgroundColor: '#16a34a', borderRadius: { topLeft: 4, topRight: 4 } },
      { label: 'Carbs (g)', data: data?.days?.map(d => d.carbs) || [], backgroundColor: '#4ade80', borderRadius: { topLeft: 4, topRight: 4 } },
      { label: 'Fat (g)', data: data?.days?.map(d => d.fat) || [], backgroundColor: '#f59e0b', borderRadius: { topLeft: 4, topRight: 4 } }
    ]
  };

  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8 } },
      tooltip: { backgroundColor: '#1e293b', padding: 10, cornerRadius: 8 },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 12 } } },
      y: { grid: { color: '#f1f5f9', drawBorder: false }, ticks: { color: '#94a3b8', font: { size: 12 } } }
    }
  };

  const lineOptions = {
    ...commonOptions,
    plugins: { ...commonOptions.plugins, legend: { display: false } },
  };

  return (
    <main className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Your nutrition trends and insights</p>
        </div>
        <div className="analytics-controls">
          <div className="history-filter">
            {['week', 'month'].map(r => (
              <button key={r} className={`filter-btn ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                {r === 'week' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
          <div className="export-btns">
            <button className="export-btn" onClick={() => exportData('csv')}><Download size={14} /> CSV</button>
            <button className="export-btn" onClick={() => exportData('pdf')}><Download size={14} /> PDF</button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="skeleton-list">
          {[1, 2].map(i => <div key={i} className="skeleton-card" style={{ height: '300px' }} />)}
        </div>
      ) : data ? (
        <div className="analytics-grid fade-in">
          <div className="analytics-summary">
            {[
              { label: 'Avg Daily Calories', value: `${data.summary.avg_calories}`, unit: 'kcal', color: '#ea580c' },
              { label: 'Total Protein', value: `${data.summary.total_protein}`, unit: 'g', color: '#16a34a' },
              { label: 'Total Meals', value: `${data.summary.total_meals}`, unit: 'meals', color: '#2563eb' },
              { label: 'Active Days', value: `${data.summary.active_days}`, unit: `/ ${data.days.length}`, color: '#7c3aed' },
            ].map(s => (
              <div key={s.label} className="analytics-stat-card">
                <p className="stat-label">{s.label}</p>
                <p className="stat-value" style={{ color: s.color }}>{s.value} <span className="stat-unit">{s.unit}</span></p>
              </div>
            ))}
          </div>

          <div className="card chart-section">
            <p className="section-header"><TrendingUp size={14} /> Calorie Trend</p>
            <div style={{ height: 280, width: '100%' }}>
              <Line data={lineChartData} options={lineOptions} />
            </div>
          </div>

          <div className="card chart-section">
            <p className="section-header"><BarChartIcon size={14} /> Daily Macro Breakdown</p>
            <div style={{ height: 280, width: '100%' }}>
              <Bar data={barChartData} options={commonOptions} />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
