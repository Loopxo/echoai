import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Owns the full palette, including the --ec-* bridge that @echoai/design
// components read. The package's own tokens.css is deliberately not imported:
// its theme selectors outrank a local override and would win the cascade.
import './styles/index.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('EchoAI desktop root element is missing');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
