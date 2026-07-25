import { useState, type ChangeEvent } from 'react';
import { Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

const PANEL_CLIP = 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 0 100%)';

type UploadState = 'idle' | 'uploading' | 'success' | 'error';

export default function MobileUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sessionId = new URLSearchParams(window.location.search).get('sessionId');

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setUploadState('idle');
    setErrorMessage(null);
  }

  async function handleUpload() {
    if (!file) return setErrorMessage('Please select a slip image first.');
    if (!sessionId) return setErrorMessage('Invalid session. Please scan the QR code again.');

    const formData = new FormData();
    formData.append('slipImage', file);

    setUploadState('uploading');
    setErrorMessage(null);

    try {
      await api.post(`/api/upload?sessionId=${sessionId}`, formData);
      setUploadState('success');
    } catch (err) {
      console.error('[mobile-upload] Upload failed:', err);
      setUploadState('error');
      setErrorMessage('Upload failed. Please try again.');
    }
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-6">
        <p className="font-body text-live text-center">Invalid link. Please scan the QR code again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-panel border border-white/5" style={{ clipPath: PANEL_CLIP }}>
        <div className="px-6 pt-6 pb-2">
          <h1 className="font-display text-2xl text-ink uppercase tracking-wide">Upload your slip</h1>
          <p className="font-body text-ink-muted text-sm mt-1 leading-relaxed">
            Select or photograph your bank transfer slip. It will be sent to the donation form automatically.
          </p>
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4">
          {uploadState === 'success' ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <CheckCircle2 className="w-12 h-12 text-signal" />
              <p className="font-display text-xl text-ink uppercase tracking-wide">Slip sent!</p>
              <p className="font-body text-ink-muted text-sm text-center">
                Your slip has been received. You can close this page.
              </p>
            </div>
          ) : (
            <>
              <label className="flex flex-col items-center gap-3 border border-dashed border-white/15 px-4 py-6 cursor-pointer hover:border-signal/50 transition-colors">
                <Upload className="w-6 h-6 text-ink-muted" />
                <span className="font-body text-sm text-ink-muted text-center">
                  {file ? file.name : 'Tap to choose from gallery or take a photo'}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {errorMessage && (
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-live shrink-0" />
                  <p className="font-body text-sm text-live">{errorMessage}</p>
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!file || uploadState === 'uploading'}
                className="w-full bg-signal text-void font-display uppercase tracking-wide text-sm py-3 flex items-center justify-center gap-2 hover:bg-signal/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {uploadState === 'uploading' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                ) : (
                  'Send to desktop'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}