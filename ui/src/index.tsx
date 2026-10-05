import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// Stop Safari/Chrome pinch-zooming the *page*: a zoomed page is wider than the
// screen, so the layout's left/right get cut off. The board's own pinch-zoom
// lives inside the SVG (touch-action:none there), which these do not affect.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('gesturechange', (e) => e.preventDefault());
document.addEventListener(
    'touchmove',
    (e) => {
        // Two fingers on ordinary UI (not the board) => a pinch: block it.
        if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false }
);
