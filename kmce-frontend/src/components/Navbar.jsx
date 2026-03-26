import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Zap, LogOut, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { isAuthenticated, username, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) return null;

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/" className="logo">
          <div className="logo-icon"><Zap size={18} /></div>
          <span className="logo-text">Nutri<span>Vision</span></span>
        </NavLink>
        <div className="nav-links">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
          <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>History</NavLink>
          <NavLink to="/analytics" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Analytics</NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Settings</NavLink>
        </div>
        <div className="nav-user">
          <div className="nav-user-badge">
            <User size={14} />
            <span>{username}</span>
          </div>
          <button className="nav-logout" onClick={handleLogout} title="Log out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>
  );
}
