import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Register the service worker for offline / installability (PWA). Path is
// relative to BASE_URL so it works at the domain root or a Pages subpath.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is a nicety; ignore failures */
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
