import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import '@echoai/design/tokens.css';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('EchoAI desktop root element is missing');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
