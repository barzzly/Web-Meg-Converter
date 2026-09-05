import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Download,
  FileBox,
  GitBranch,
  LoaderCircle,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  Link,
} from 'lucide-react';

const POLL_INTERVAL = 5000;
const POLL_TIMEOUT = 25 * 60 * 1000;

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
}

const STEPS = [
  { id: 'upload', label: 'Upload package' },
  { id: 'queue', label: 'Start conversion' },
  { id: 'convert', label: 'Build Bedrock files' },
  { id: 'download', label: 'Download result' },
];

function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
}

function StepIcon({ state }) {
  if (state === 'done') return <Check size={14} strokeWidth={2.5} />;
  if (state === 'active') return <LoaderCircle size={14} className="spin" />;
  return <Circle size={12} />;
}

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('barzzly-theme') || 'dark');
  const [sourceUrl, setSourceUrl] = useState('');
  const [phase, setPhase] = useState('idle');
  const [statusText, setStatusText] = useState('Ready when you are.');
  const [error, setError] = useState('');
  const [runId, setRunId] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [startedAt, setStartedAt] = useState(0);
  const pollTimer = useRef(null);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme !== 'dark');
    localStorage.setItem('barzzly-theme', theme);
  }, [theme]);

  useEffect(() => () => window.clearTimeout(pollTimer.current), []);

  const currentStep = phase === 'idle' ? 0 : phase === 'selecting' ? 1 : phase === 'uploading' ? 1 : phase === 'queued' ? 2 : phase === 'converting' ? 3 : phase === 'success' ? 4 : 1;

  const reset = () => {
    window.clearTimeout(pollTimer.current);
    setSourceUrl('');
    setPhase('idle');
    setStatusText('Ready when you are.');
    setError('');
    setRunId('');
    setDownloadUrl('');
    setStartedAt(0);
  };

  const pollStatus = async (id, started) => {
    if (!isUuid(id)) throw new Error('Invalid conversion request returned by server.');
    if (Date.now() - started > POLL_TIMEOUT) {
      throw new Error('Conversion timed out. GitHub Actions may still be running; retry later or check workflow history.');
    }

    const response = await fetch(`/api/status?request_id=${encodeURIComponent(id)}&since=${encodeURIComponent(new Date(started).toISOString())}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not read conversion status.');

    if (data.status === 'completed') {
      if (data.conclusion !== 'success') throw new Error(`Conversion ${data.conclusion || 'failed'}. Check your model package and retry.`);
      setPhase('success');
      setStatusText('Conversion complete. Your Bedrock package is ready.');
      setDownloadUrl(`/api/download?run_id=${encodeURIComponent(data.run_id || id)}`);
      return;
    }
    if (['failure', 'cancelled', 'timed_out', 'action_required'].includes(data.status)) {
      throw new Error(`Conversion ${data.status.replace('_', ' ')}. Check your package and retry.`);
    }

    setPhase('converting');
    setStatusText(data.status === 'queued' ? 'Waiting for a GitHub Actions runner…' : 'Blockbench is exporting your models…');
    pollTimer.current = window.setTimeout(() => pollStatus(id, started).catch(handleError), POLL_INTERVAL);
  };

  const handleError = (conversionError) => {
    window.clearTimeout(pollTimer.current);
    setPhase('error');
    setError(getErrorMessage(conversionError));
    setStatusText('Conversion stopped.');
  };

  const startConversion = async () => {
    if (!sourceUrl.trim() || ['uploading', 'queued', 'converting'].includes(phase)) return;
    setError('');
    setDownloadUrl('');
    const started = Date.now();
    setStartedAt(started);
    try {
      setPhase('queued');
      setStatusText('Starting GitHub Actions conversion…');
      const dispatchResponse = await fetch('/api/convert', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: sourceUrl.trim() }) });
      const dispatchData = await dispatchResponse.json().catch(() => ({}));
      if (!dispatchResponse.ok) throw new Error(dispatchData.error || 'Could not start conversion.');
      if (!isUuid(dispatchData.request_id)) throw new Error('Invalid conversion request returned by server.');
      setRunId(dispatchData.request_id);
      await pollStatus(dispatchData.request_id, started);
    } catch (conversionError) {
      handleError(conversionError);
    }
  };

  const isBusy = ['uploading', 'queued', 'converting'].includes(phase);
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <img src="/images/barzzly-logo-dark.png" alt="BarzzLy logo" className="brand-mark" />
          <span className="brand-name">BarzzLy</span>
          <span className="topbar-divider" />
          <span className="product-label">MEG Converter</span>
        </div>
        <div className="topbar-actions">
          <span className="status-pill"><span className="status-dot" /> Private workspace</span>
          <button className="icon-button" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      <main className="main-shell">
        <section className="intro animate-panelIn">
          <div className="eyebrow"><Sparkles size={14} /> BLOCKBENCH PIPELINE</div>
          <h1>MEG models.<br /><span>Bedrock ready.</span></h1>
          <p>Drop your GeyserModelEngine model package. Blockbench converts each model into clean, server-ready Bedrock files.</p>
        </section>

        <section className="workspace animate-panelIn" aria-label="MEG converter">
          <aside className="steps-panel">
            <div className="panel-kicker">CONVERSION FLOW</div>
            <div className="step-list">
              {STEPS.map((step, index) => {
                const state = index < currentStep ? 'done' : index === currentStep && phase !== 'idle' && phase !== 'selecting' ? 'active' : 'idle';
                return <div className={`step ${state}`} key={step.id}><div className="step-icon"><StepIcon state={state} /></div><div><strong>{step.label}</strong><span>{index === 0 ? 'ZIP with .bbmodel files' : index === 1 ? 'Secure GitHub runner' : index === 2 ? 'Web Blockbench export' : 'One downloadable archive'}</span></div>{index < STEPS.length - 1 && <ChevronRight size={14} className="step-arrow" />}</div>;
              })}
            </div>
            <div className="privacy-note"><ShieldCheck size={16} /><div><strong>Temporary by design</strong><span>Files live only long enough to finish your conversion.</span></div></div>
          </aside>

          <div className="convert-panel">
             <div className="panel-heading"><div><div className="panel-kicker">INPUT PACKAGE</div><h2>Paste ZIP link</h2></div><Link size={23} className="heading-icon" /></div>
             <div className="url-input-card"><label htmlFor="source-url">Public ZIP download URL</label><input id="source-url" type="url" placeholder="https://www.dropbox.com/...zip?dl=1" value={sourceUrl} onChange={(event) => { setSourceUrl(event.target.value); setError(''); setPhase(event.target.value ? 'selecting' : 'idle'); }} disabled={isBusy} /><span>Use a direct-download link. The ZIP must contain your .bbmodel files.</span></div>

            <div className={`status-card ${phase === 'error' ? 'error' : phase === 'success' ? 'success' : ''}`} aria-live="polite"><div className="status-card-icon">{phase === 'error' ? <AlertCircle size={17} /> : phase === 'success' ? <CheckCircle2 size={17} /> : isBusy ? <LoaderCircle size={17} className="spin" /> : <FileBox size={17} />}</div><div><strong>{statusText}</strong>{runId && <span className="run-id">Run #{runId}</span>}</div></div>
            {error && <div className="error-message" role="alert"><AlertCircle size={15} /> <span>{error}</span></div>}

             <div className="action-row">{phase === 'success' && downloadUrl ? <a className="primary-button" href={downloadUrl} download="meg-bedrock.zip"><Download size={17} /> Download Bedrock ZIP</a> : <button type="button" className="primary-button" onClick={startConversion} disabled={!sourceUrl.trim() || isBusy}>{isBusy ? <LoaderCircle size={17} className="spin" /> : <ArrowRight size={17} />}{isBusy ? 'Converting…' : 'Start conversion'}</button>}{(phase === 'error' || phase === 'success') && <button type="button" className="secondary-button" onClick={reset}><RefreshCw size={15} /> Start over</button>}</div>
            <div className="panel-footer"><span><GitBranch size={14} /> Powered by GitHub Actions</span><span>Node · Puppeteer · Blockbench</span></div>
          </div>
        </section>

        <footer className="page-footer"><span>BarzzLy tools</span><span className="footer-dot">·</span><span>Built for Minecraft creators</span></footer>
      </main>
    </div>
  );
}

export default App;
