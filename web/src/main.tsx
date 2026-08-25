import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

function Probe() {
  const [n, setN] = useState(0);
  const doubled = n * 2;
  return (
    <button type="button" className="rounded bg-slate-900 px-3 py-1 text-white" onClick={() => setN(n + 1)}>
      {doubled}
    </button>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Probe />
  </StrictMode>,
);
