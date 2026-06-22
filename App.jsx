import { useCallback, useEffect, useState } from 'react';
import LungIllustration from './components/LungIllustration';
import ImageUpload from './components/ImageUpload';
import PredictionResult from './components/PredictionResult';
import PredictionHistory from './components/PredictionHistory';
import {
  checkHealth,
  predictImage,
  getHistory,
  deletePrediction,
  getImageUrl,
} from './services/api';

export default function App() {
  const [result, setResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);
  const [apiStatus, setApiStatus] = useState('checking');

  const loadHistory = useCallback(async () => {
    try {
      const data = await getHistory();
      setHistory(data.predictions || []);
    } catch {
      /* history unavailable */
    }
  }, []);

  useEffect(() => {
    checkHealth()
      .then((data) => {
        setApiStatus(data.model_loaded ? 'ready' : 'no-model');
      })
      .catch(() => setApiStatus('offline'))
      .finally(loadHistory);
  }, [loadHistory]);

  const handleUpload = async (file) => {
    setLoading(true);
    setError(null);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const data = await predictImage(file);
      setResult(data);
      await loadHistory();
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectHistory = (item) => {
    setResult(item);
    setPreviewUrl(getImageUrl(item.image_url));
    setError(null);
  };

  const handleDelete = async (id) => {
    try {
      await deletePrediction(id);
      if (result?.id === id) {
        setResult(null);
        setPreviewUrl(null);
      }
      await loadHistory();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-medical-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">Lung Cancer Detection</h1>
              <p className="text-xs text-slate-400 hidden sm:block">AI-Powered Medical Analysis</p>
            </div>
          </div>
          <StatusBadge status={apiStatus} />
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-medical-600 via-medical-700 to-medical-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-medical-100 text-xs font-medium mb-4">
                TensorFlow 2.x CNN Model
              </span>
              <h2 className="text-3xl lg:text-4xl font-bold leading-tight">
                Early Detection Saves Lives
              </h2>
              <p className="mt-4 text-medical-100 leading-relaxed max-w-lg">
                Upload CT scans or X-ray images for instant AI-powered lung cancer screening.
                Get predictions with confidence scores and downloadable medical reports.
              </p>
              <div className="mt-6 flex flex-wrap gap-4 text-sm">
                <FeaturePill icon="🔬" text="CNN Deep Learning" />
                <FeaturePill icon="⚡" text="Instant Results" />
                <FeaturePill icon="📄" text="PDF Reports" />
              </div>
            </div>
            <div className="hidden lg:flex justify-center">
              <LungIllustration className="w-full max-w-sm drop-shadow-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* Main Dashboard */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-danger-50 border border-danger-500/20 text-danger-700 text-sm flex items-start gap-3">
            <AlertCircleIcon />
            <div>
              <p className="font-medium">Analysis Error</p>
              <p className="mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {apiStatus === 'no-model' && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            <p className="font-medium">Model not trained yet</p>
            <p className="mt-1">
              Run <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">python train.py</code> in the{' '}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">model/</code> directory to enable predictions.
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          <ImageUpload onUpload={handleUpload} loading={loading} />
          <PredictionResult result={result} previewUrl={previewUrl} />
        </div>

        <PredictionHistory
          history={history}
          onSelect={handleSelectHistory}
          onDelete={handleDelete}
          activeId={result?.id}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-400">
          <p>
            Lung Cancer Detection System — For research and educational purposes only.
            Not intended for clinical diagnosis.
          </p>
        </div>
      </footer>
    </div>
  );
}

function StatusBadge({ status }) {
  const config = {
    ready: { label: 'System Ready', color: 'bg-success-50 text-success-700 border-success-200' },
    'no-model': { label: 'No Model', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    offline: { label: 'API Offline', color: 'bg-danger-50 text-danger-700 border-danger-200' },
    checking: { label: 'Connecting...', color: 'bg-slate-50 text-slate-500 border-slate-200' },
  };
  const { label, color } = config[status] || config.checking;

  return (
    <span className={`text-xs font-medium px-3 py-1.5 rounded-full border ${color}`}>
      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
        status === 'ready' ? 'bg-success-500' : status === 'offline' ? 'bg-danger-500' : 'bg-amber-400'
      }`} />
      {label}
    </span>
  );
}

function FeaturePill({ icon, text }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-sm">
      <span>{icon}</span>
      {text}
    </span>
  );
}

function AlertCircleIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
