import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import axios from 'axios'

// Set dynamic base URL for deployed environments (normalize trailing slashes)
const rawBaseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";
axios.defaults.baseURL = rawBaseURL.replace(/\/$/, "");

// Global interceptor to attach JWT token to all requests
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
