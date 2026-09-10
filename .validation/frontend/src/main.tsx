import React from 'react';
import { createRoot } from 'react-dom/client';
import CyberThreatMap from './components/CyberThreatMap';
import './preview.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><header className="preview-header"><div><small>LEKIRRAX / THREAT INTELLIGENCE</small><h1>Global Threat Map</h1></div><span>Local implementation preview</span></header><CyberThreatMap /></React.StrictMode>);
