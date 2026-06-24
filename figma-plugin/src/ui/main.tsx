import { createRoot } from 'react-dom/client';
import { applyFigmaTheme } from './lib/theme';
import { App } from './App';
import './styles.css';

applyFigmaTheme();

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');
createRoot(container).render(<App />);
