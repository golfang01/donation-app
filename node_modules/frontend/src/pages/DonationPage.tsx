import { useState, useEffect } from 'react';
import type { FormEvent, ChangeEvent, ReactNode } from 'react';
import { Radio, Upload, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
import { api } from '../lib/api';
import { VerificationStatus, SOCKET_EVENTS } from '@donation-app/shared-types';
import type { DonationSubmissionResponse, SlipUploadedPayload } from '@donation-app/shared-types';
import { v4 as uuidv4 } from 'uuid';
import { socket } from '../lib/socket';

type SubmitState = 'idle' | 'submitting' | 'success' | 'failed' | 'error';

const MAX_METER_AMOUNT = 1000;
const PANEL_CLIP = 'polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 0 100%)';
const PROMPTPAY_ID = import.meta.env.VITE_PROMPTPAY_ID ?? '';

export default function DonationPage() {
  const [senderName, setSenderName] = useState('');
  const [message, setMessage] = useState('');
  const [amount, setAmount] = useState('');
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(
    !PROMPTPAY_ID ? 'Payment QR is not configured. Set VITE_PROMPTPAY_ID.' : null
  );
  const [sessionId] = useState<string>(() => uuidv4());
  const [mobileQrDataUrl, setMobileQrDataUrl] = useState<string | null>(null);
  const [slipAttachedViaPhone, setSlipAttachedViaPhone] = useState<string | null>(null);

  const isValidAmount = !!amount && !Number.isNaN(Number(amount)) && Number(amount) > 0;
  const meterPercent = Math.min(100, ((Number(amount) || 0) / MAX_METER_AMOUNT) * 100);

  // PromptPay QR — regenerates 300ms after amount changes
  useEffect(() => {
    if (!PROMPTPAY_ID) return;

    const parsedAmount = Number(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) return;

    const timer = setTimeout(async () => {
      try {
        const payload = generatePayload(PROMPTPAY_ID, { amount: parsedAmount });
        const dataUrl = await QRCode.toDataURL(payload, {
          width: 240,
          margin: 1,
          color: { dark: '#0A0D12', light: '#FFFFFF' },
        });
        setQrDataUrl(dataUrl);
        setQrError(null);
      } catch (err) {
        console.error('Failed to generate PromptPay QR:', err);
        setQrDataUrl(null);
        setQrError('Could not generate a payment QR for this amount.');
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [amount]);

  // Mobile cross-device upload — socket room + QR generation
  useEffect(() => {
    const { hostname, port } = window.location;
    const mobileUrl = `http://${hostname}:${port}/mobile-upload?sessionId=${sessionId}`;

    QRCode.toDataURL(mobileUrl, {
      width: 180,
      margin: 1,
      color: { dark: '#0A0D12', light: '#FFFFFF' },
    })
      .then(setMobileQrDataUrl)
      .catch(console.error);

    socket.connect();
    socket.emit('join:session', sessionId);

    const handleSlipUploaded = (payload: SlipUploadedPayload) => {
      if (payload.sessionId !== sessionId) return;
      setSlipAttachedViaPhone(payload.slipUrl);
      setSlipFile(null);
    };

    socket.on(SOCKET_EVENTS.SLIP_UPLOADED, handleSlipUploaded);

    return () => {
      socket.off(SOCKET_EVENTS.SLIP_UPLOADED, handleSlipUploaded);
      socket.disconnect();
    };
  }, [sessionId]);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setSlipFile(e.target.files?.[0] ?? null);
    setSlipAttachedViaPhone(null); // manual file overrides phone upload
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsedAmount = Number(amount);
    if (!senderName.trim()) return setFormError('Enter your name so we know who to thank on screen.');
    if (!amount || parsedAmount <= 0) return setFormError('Enter an amount greater than 0.');
    if (!slipFile && !slipAttachedViaPhone) {
      return setFormError('Upload a photo of your transfer slip, or scan the QR with your phone.');
    }

    const formData = new FormData();
    formData.append('senderName', senderName.trim());
    if (message.trim()) formData.append('message', message.trim());
    formData.append('amount', String(parsedAmount));

    if (slipFile) {
      formData.append('slipImage', slipFile);
    } else if (slipAttachedViaPhone) {
      // Slip already saved server-side via mobile upload — send its path
      // instead of uploading again.
      formData.append('slipImageUrl', slipAttachedViaPhone);
    }

    setSubmitState('submitting');

    try {
      const { data } = await api.post<DonationSubmissionResponse>('/api/donations', formData);

      if (data.status === VerificationStatus.VERIFIED) {
        setSubmitState('success');
      } else if (data.status === VerificationStatus.FAILED) {
        setFailureMessage(data.message ?? null);
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
    setSlipAttachedViaPhone(null);
    setMobileQrDataUrl(null);
    setFormError(null);
    setFailureMessage(null);
    setQrDataUrl(null);
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
        body={failureMessage ?? "Double-check the transfer details match and try uploading again."}
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

          {/* Name */}
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

          {/* Message */}
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

          {/* Amount */}
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
                className="h-full bg-linear-to-r from-signal to-gold transition-all duration-300"
                style={{ width: `${meterPercent}%` }}
              />
            </div>
          </div>

          {/* PromptPay QR */}
          <div>
            <label className="block font-mono text-xs text-ink-muted uppercase tracking-wide mb-1.5">
              Scan to pay
            </label>
            {isValidAmount && qrDataUrl && (
              <div className="flex flex-col items-center gap-2">
                <div className="bg-white p-3 rounded-sm">
                  <img src={qrDataUrl} alt="PromptPay QR code" className="w-48 h-48" data-cy="promptpay-qr" />
                </div>
                <p className="font-mono text-sm text-gold">฿{Number(amount).toLocaleString()}</p>
                <p className="font-body text-xs text-ink-muted text-center leading-relaxed">
                  Scan with your banking app, complete the transfer, then upload your slip below.
                </p>
              </div>
            )}
            {qrError && <p className="font-body text-sm text-live">{qrError}</p>}
            {!isValidAmount && !qrError && (
              <p className="font-body text-xs text-ink-muted">
                Enter an amount above to generate your payment QR.
              </p>
            )}
          </div>

          {/* Mobile cross-device slip upload */}
          <div>
            <label className="block font-mono text-xs text-ink-muted uppercase tracking-wide mb-1.5">
              Upload slip from your phone
            </label>
            {slipAttachedViaPhone ? (
              <div className="flex items-center gap-3 border border-signal/40 bg-panel-raised px-4 py-3">
                <span className="w-2 h-2 rounded-full bg-signal animate-pulse shrink-0" />
                <span className="font-body text-sm text-signal">Slip received from phone ✓</span>
              </div>
            ) : (
              <>
                {mobileQrDataUrl && (
                  <div className="flex flex-col items-center gap-2">
                    <div className="bg-white p-3 rounded-sm">
                      <img src={mobileQrDataUrl} alt="Scan to upload slip from phone" className="w-44 h-44" />
                    </div>
                    <p className="font-body text-xs text-ink-muted text-center leading-relaxed">
                      Scan with your phone camera to upload the slip from your gallery or camera.
                    </p>
                    {window.location.hostname === 'localhost' && (
                      <p className="font-mono text-xs text-live text-center">
                        ⚠ You're on localhost — access this page via your LAN IP
                        (e.g. http://192.168.x.x:5173) so the phone QR works.
                      </p>
                    )}
                  </div>
                )}
                <p className="font-body text-xs text-ink-muted mt-2 text-center">— or upload manually below —</p>
              </>
            )}
          </div>

          {/* Manual slip upload */}
          <div>
            <label className="block font-mono text-xs text-ink-muted uppercase tracking-wide mb-1.5">
              Transfer slip
            </label>
            <label className="flex items-center gap-3 border border-dashed border-white/15 px-4 py-3 cursor-pointer hover:border-signal/50 transition-colors">
              <Upload className="w-4 h-4 text-ink-muted shrink-0" />
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
              <><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</>
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