import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('nv_token'));
  const [username, setUsername] = useState(localStorage.getItem('nv_username') || '');
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);

  useEffect(() => {
    if (token) {
      localStorage.setItem('nv_token', token);
      localStorage.setItem('nv_username', username);
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem('nv_token');
      localStorage.removeItem('nv_username');
      setIsAuthenticated(false);
    }
  }, [token, username]);

  const login = (newToken, newUsername) => {
    setToken(newToken);
    setUsername(newUsername);
  };

  const logout = () => {
    setToken(null);
    setUsername('');
  };

  const authHeader = () => ({
    headers: { Authorization: `Bearer ${token}` },
  });

  return (
    <AuthContext.Provider value={{ token, username, isAuthenticated, login, logout, authHeader }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
