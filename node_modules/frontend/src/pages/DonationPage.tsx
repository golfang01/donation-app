import { useState } from 'react';
import type { FormEvent, ChangeEvent, ReactNode } from 'react';
import { Radio, Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { VerificationStatus } from '@donation-app/shared-types';
import type { DonationSubmissionResponse } from '@donation-app/shared-types';

type SubmitState = 'idle' | 'submitting' | 'success' | 'failed' | 'error';

const MAX_METER_AMOUNT = 1000;
const PANEL_CLIP = 'polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 0 100%)';

export default function DonationPage() {
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');

  const meterPercent = Math.min(100, ((Number(amount) || 0) / MAX_METER_AMOUNT) * 100);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setSlipFile(e.target.files?.[0] ?? null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsedAmount = Number(amount);
    if (!senderName.trim()) return setFormError('Enter your name so we know who to thank on screen.');
    if (!amount || parsedAmount <= 0) return setFormError('Enter an amount greater than 0.');
    if (!slipFile) return setFormError('Upload a photo of your transfer slip.');

    const formData = new FormData();
    formData.append('senderName', senderName.trim());
    if (message.trim()) formData.append('message', message.trim());
    formData.append('amount', String(parsedAmount));
    formData.append('slipImage', slipFile);

    setSubmitState('submitting');

    try {
      const { data } = await api.post<DonationSubmissionResponse>('/api/donations', formData);

      if (data.status === VerificationStatus.VERIFIED) {
        setSubmitState('success');
      } else if (data.status === VerificationStatus.FAILED) {
        setSubmitState('failed');
      } else {
        setSubmitState('success');
      }
    } catch (err) {
      console.error(err);
      setSubmitState('error');
      setFormError('Something went wrong sending your donation. Try again.');
    }
  }

  function handleReset() {
    setSenderName('');
    setMessage('');
    setAmount('');
    setSlipFile(null);
    setFormError(null);
    setSubmitState('idle');
  }

  if (submitState === 'success') {
    return (
      <StatusScreen
        icon={<CheckCircle2 className="w-12 h-12 text-signal" />}
        title="Your message is on its way"
        body="Your slip checked out. Watch the stream — your name's about to show up."
        onReset={handleReset}
      />
    );
  }

  if (submitState === 'failed') {
    return (
      <StatusScreen
        icon={<XCircle className="w-12 h-12 text-live" />}
        title="We couldn't verify that slip"
        body="Double-check the transfer details match and try uploading again."
        onReset={handleReset}
      />
    );
  }

  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-panel border border-white/5" style={{ clipPath: PANEL_CLIP }}>
        <div className="px-8 pt-8">
          <div className="flex items-center gap-2 text-signal mb-2">
            <Radio className="w-4 h-4" />
            <span className="font-mono text-xs tracking-[0.2em] uppercase">Send your message</span>
          </div>
          <h1 className="font-display text-3xl text-ink uppercase tracking-wide">Send a signal</h1>
          <p className="font-body text-ink-muted text-sm mt-2 leading-relaxed">
            Your name and message go live on screen the moment your transfer is verified.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-8 pt-6 space-y-5">
          <div>
            <label className="block font-mono text-xs text-ink-muted uppercase tracking-wide mb-1.5">
              Your name
            </label>
            <input
              type="text"
              data-cy="sender-name-input"
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              placeholder="How should we show your name?"
              className="w-full bg-panel-raised border border-white/10 px-4 py-2.5 text-ink font-body text-sm focus:outline-none focus:border-signal/60 transition-colors"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-ink-muted uppercase tracking-wide mb-1.5">
              Message <span className="text-ink-muted/60">(optional)</span>
            </label>
            <textarea
              data-cy="message-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Say something to the stream..."
              rows={3}
              className="w-full bg-panel-raised border border-white/10 px-4 py-2.5 text-ink font-body text-sm focus:outline-none focus:border-signal/60 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-ink-muted uppercase tracking-wide mb-1.5">
              Amount (THB)
            </label>
            <input
              type="number"
              data-cy="amount-input"
              min="1"
              step="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100"
              className="w-full bg-panel-raised border border-white/10 px-4 py-2.5 text-ink font-mono text-sm focus:outline-none focus:border-signal/60 transition-colors"
            />
            <div className="h-1 bg-white/5 mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-signal to-gold transition-all duration-300"
                style={{ width: `${meterPercent}%` }}
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-ink-muted uppercase tracking-wide mb-1.5">
              Transfer slip
            </label>
            <label className="flex items-center gap-3 border border-dashed border-white/15 px-4 py-3 cursor-pointer hover:border-signal/50 transition-colors">
              <Upload className="w-4 h-4 text-ink-muted flex-shrink-0" />
              <span className="font-body text-sm text-ink-muted truncate">
                {slipFile ? slipFile.name : 'Upload a photo of your slip'}
              </span>
              <input
                type="file"
                data-cy="slip-upload"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {formError && <p className="font-body text-sm text-live">{formError}</p>}

          <button
            type="submit"
            data-cy="submit-button"
            disabled={submitState === 'submitting'}
            className="w-full bg-signal text-void font-display uppercase tracking-wide text-sm py-3 flex items-center justify-center gap-2 hover:bg-signal/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {submitState === 'submitting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
              </>
            ) : (
              'Send donation'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function StatusScreen({
  icon,
  title,
  body,
  onReset,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  onReset: () => void;
}) {
  return (
    <div className="min-h-screen bg-void flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4">{icon}</div>
        <h2 className="font-display text-2xl text-ink uppercase tracking-wide mb-2">{title}</h2>
        <p className="font-body text-ink-muted text-sm leading-relaxed mb-6">{body}</p>
        <button onClick={onReset} className="font-mono text-xs text-signal uppercase tracking-wide hover:underline">
          Send another
        </button>
      </div>
    </div>
  );
}