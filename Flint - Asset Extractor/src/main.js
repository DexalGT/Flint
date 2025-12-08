/**
 * Flint - League of Legends Modding IDE
 * Frontend Entry Point
 */

// Import styles
import './styles/index.css';

// Import app
import { initApp } from './components/App.js';

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
