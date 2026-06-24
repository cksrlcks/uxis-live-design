import { createRoot } from 'react-dom/client';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('root element missing');
createRoot(container).render(<div>cova</div>);
