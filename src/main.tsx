/**
 * Flint - League of Legends Modding IDE
 * React Entry Point
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppProvider } from './lib/state';
import { App } from './components/App';

// Import styles
import './styles/index.css';
// Import default theme (can be swapped via custom theme import)
import './themes/default.css';

// Initialize app
const container = document.getElementById('app');
if (!container) {
    throw new Error('[Flint] Could not find #app element');
}

const root = createRoot(container);
root.render(
    React.createElement(
        React.StrictMode,
        null,
        React.createElement(AppProvider, null, React.createElement(App))
    )
);
