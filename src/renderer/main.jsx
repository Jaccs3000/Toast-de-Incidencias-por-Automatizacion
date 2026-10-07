import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/global.css';

let heartbeatTimer;

async function sendAppHeartbeat() {
  try {
    await fetch('/api/app-heartbeat', { method: 'POST', keepalive: true });
  } catch {
    // The local server can be starting or shutting down while the window changes state.
  }
}

if (import.meta.env.PROD) {
  void sendAppHeartbeat();
  heartbeatTimer = window.setInterval(sendAppHeartbeat, 3000);
  window.addEventListener('pagehide', () => {
    window.clearInterval(heartbeatTimer);
    navigator.sendBeacon('/api/app-window-closed', new Blob(['{}'], { type: 'application/json' }));
  }, { once: true });
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch((error) => {
      console.error('No se pudo registrar el service worker de la PWA.', error);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
