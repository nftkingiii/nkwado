import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);
