import { useState, useEffect } from 'react';
import type { FormEvent, ChangeEvent, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { CheckCircle, XCircle, Upload, Smartphone, Loader2, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { socket } from '../lib/socket';
import { VerificationStatus, SOCKET_EVENTS } from '@donation-app/shared-types';
import type { DonationSubmissionResponse, SlipUploadedPayload } from '@donation-app/shared-types';

type SubmitState = 'idle' | 'submitting' | 'success' | 'failed' | 'error';

const PROMPTPAY_ID   = import.meta.env.VITE_PROMPTPAY_ID ?? '';
const QUICK_AMOUNTS  = [20, 50, 100, 200, 500];

export default function DonationPage() {
  const [senderName,         setSenderName]         = useState('');
  const [message,            setMessage]            = useState('');
  const [amount,             setAmount]             = useState('');
  const [slipFile,           setSlipFile]           = useState<File | null>(null);
  const [formError,          setFormError]          = useState<string | null>(null);
  const [submitState,        setSubmitState]        = useState<SubmitState>('idle');
  const [failureMessage,     setFailureMessage]     = useState<string | null>(null);
  const [qrDataUrl,          setQrDataUrl]          = useState<string | null>(null);
  const [qrError,            setQrError]            = useState<string | null>(
    !PROMPTPAY_ID ? 'PromptPay QR is not configured.' : null
  );
  const [sessionId]                                 = useState(() => uuidv4());
  const [mobileQrDataUrl,    setMobileQrDataUrl]    = useState<string | null>(null);
  const [slipFromPhone,      setSlipFromPhone]      = useState<string | null>(null);
  const [showPhoneUpload,    setShowPhoneUpload]    = useState(false);
  const [isDragging,         setIsDragging]         = useState(false); // State สำหรับ Drag & Drop
  const [timerConfig, setTimerConfig] = useState<{
    enabled: boolean;
    baseAmount: number;
    baseMinutes: number;
  } | null>(null);

  const parsedAmount = Number(amount);
  const isValidAmt   = !!amount && !Number.isNaN(parsedAmount) && parsedAmount > 0;

  // Minutes added to the subathon timer for this donation amount
  const timerBonus = timerConfig && isValidAmt
    ? (parsedAmount / timerConfig.baseAmount) * timerConfig.baseMinutes
    : 0;
  const timerBonusLabel = timerBonus >= 1
    ? `+${Math.round(timerBonus)} min`
    : timerBonus > 0
    ? `+${Math.round(timerBonus * 60)} sec`
    : '';

  // ── PromptPay QR ──────────────────────────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!PROMPTPAY_ID || !isValidAmt) { setQrDataUrl(null); return; }
    const t = setTimeout(async () => {
      try {
        const payload = generatePayload(PROMPTPAY_ID, { amount: parsedAmount });
        const url = await QRCode.toDataURL(payload, { width: 220, margin: 2, color: { dark: '#18181b', light: '#ffffff' } });
        setQrDataUrl(url); setQrError(null);
      } catch { setQrDataUrl(null); setQrError('Could not generate QR code.'); }
    }, 300);
    return () => clearTimeout(t);
  }, [amount, isValidAmt, parsedAmount]);

  // Fetch subathon timer config so we can show the time-added incentive
  useEffect(() => {
    api.get<{ enabled: boolean; timerBaseAmount: number; timerBaseMinutes: number }>(
      '/api/widget/timer'
    )
      .then(({ data }) => {
        if (data.enabled) {
          setTimerConfig({
            enabled:     data.enabled,
            baseAmount:  data.timerBaseAmount,
            baseMinutes: data.timerBaseMinutes,
          });
        }
      })
      .catch(() => {}); // non-critical — badge simply won't appear
  }, []);

  // ── Mobile cross-device upload ────────────────────────────────────────────
  useEffect(() => {
    const origin = window.location.origin; // e.g. "https://your-app.vercel.app"
    const url = `${origin}/mobile-upload?sessionId=${sessionId}`;
    QRCode.toDataURL(url, { width: 160, margin: 2, color: { dark: '#18181b', light: '#ffffff' } })
      .then(setMobileQrDataUrl).catch(console.error);

    socket.connect();
    socket.emit('join:session', sessionId);

    const handle = (p: SlipUploadedPayload) => {
      if (p.sessionId !== sessionId) return;
      setSlipFromPhone(p.slipUrl);
      setSlipFile(null);
      setShowPhoneUpload(false);
    };
    socket.on(SOCKET_EVENTS.SLIP_UPLOADED, handle);
    return () => { socket.off(SOCKET_EVENTS.SLIP_UPLOADED, handle); socket.disconnect(); };
  }, [sessionId]);


  // ── Drag & Drop Handlers ──────────────────────────────────────────────────
  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragEnter(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.match('image/jpeg') || file.type.match('image/png') || file.type.match('image/webp')) {
        setSlipFile(file);
        setSlipFromPhone(null);
        setFormError(null);
      } else {
        setFormError('Please upload a valid image (JPEG, PNG, WEBP).');
      }
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setSlipFile(e.target.files?.[0] ?? null);
    setSlipFromPhone(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!senderName.trim()) return setFormError('Please enter your name.');
    if (!isValidAmt)        return setFormError('Please enter a valid amount.');
    if (!slipFile && !slipFromPhone) return setFormError('Please upload your payment slip.');

    const fd = new FormData();
    fd.append('senderName', senderName.trim());
    if (message.trim()) fd.append('message', message.trim());
    fd.append('amount', String(parsedAmount));
    if (slipFile)      fd.append('slipImage',   slipFile);
    else if (slipFromPhone) fd.append('slipImageUrl', slipFromPhone);

    setSubmitState('submitting');
    try {
      const { data } = await api.post<DonationSubmissionResponse>('/api/donations', fd);
      if (data.status === VerificationStatus.VERIFIED)  { setSubmitState('success'); }
      else if (data.status === VerificationStatus.FAILED) { setFailureMessage(data.message ?? null); setSubmitState('failed'); }
      else { setSubmitState('success'); }
    } catch { setSubmitState('error'); setFormError('Something went wrong. Please try again.'); }
  }

  function reset() {
    setSenderName(''); setMessage(''); setAmount(''); setSlipFile(null);
    setSlipFromPhone(null); setFormError(null); setFailureMessage(null);
    setQrDataUrl(null); setShowPhoneUpload(false); setSubmitState('idle');
  }

  if (submitState === 'success') return <Result icon={<CheckCircle className="w-10 h-10 text-[#4B5E53]" />} title="You're on the stream!" body="Your payment was verified. Watch for your name to appear soon." action="Send another" onAction={reset} />;
  if (submitState === 'failed')  return <Result icon={<XCircle className="w-10 h-10 text-red-400" />}  title="Couldn't verify your slip" body={failureMessage ?? 'Please check your transfer details and try again.'} action="Try again" onAction={reset} />;

  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-[#1A1C1A] tracking-tight">Send a donation</h1>
          <p className="text-sm text-[#6B726A] mt-1">Your name and message appear live on stream.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Name */}
          <div className="bg-white rounded-2xl shadow-sm border   border-[#E5E3DD] p-6 space-y-4">
            <h2 className="text-sm font-medium text-zinc-700">Your details</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#6B726A] mb-1.5">Name shown on stream</label>
                <input
                  type="text"
                  data-cy="sender-name-input"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="How should we credit you?"
                  className="w-full rounded-xl border   border-[#E5E3DD] bg-[#F9F8F6] px-4 py-2.5 text-sm text-[#1A1C1A] placeholder:text-[#6B726A] focus:outline-none focus:ring-2 focus:ring-[#4B5E53]/20 focus:border-[#4B5E53] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B726A] mb-1.5">Message <span className="text-[#6B726A] font-normal">(optional)</span></label>
                <textarea
                  data-cy="message-input"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Say something to the stream…"
                  rows={2}
                  className="w-full rounded-xl border   border-[#E5E3DD] bg-[#F9F8F6] px-4 py-2.5 text-sm text-[#1A1C1A] placeholder:text-[#6B726A] focus:outline-none focus:ring-2 focus:ring-[#4B5E53]/20 focus:border-[#4B5E53] transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="bg-white rounded-2xl shadow-sm border   border-[#E5E3DD] p-6 space-y-4">
            <h2 className="text-sm font-medium text-zinc-700">Amount</h2>

            {/* Quick-select */}
            <div className="flex gap-2 flex-wrap">
              {QUICK_AMOUNTS.map((v) => (
                <button key={v} type="button"
                  onClick={() => setAmount(String(v))}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    amount === String(v)
                      ? 'bg-[#4B5E53] border-[#4B5E53] text-white shadow-sm'
                      : 'bg-white   border-[#E5E3DD] text-zinc-600 hover:border-[#4B5E53] hover:text-[#4B5E53]'
                  }`}>
                  ฿{v}
                </button>
              ))}
            </div>

            {/* Custom input */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B726A] text-sm font-medium">฿</span>
              {/* Subathon timer incentive badge */}
              {timerBonusLabel && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {timerBonusLabel} added to the stream timer
                </div>
              )}
              <input
                type="number"
                data-cy="amount-input"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Custom amount"
                className="w-full rounded-xl border   border-[#E5E3DD] bg-[#F9F8F6] pl-8 pr-4 py-2.5 text-sm text-[#1A1C1A] placeholder:text-[#6B726A] focus:outline-none focus:ring-2 focus:ring-[#4B5E53]/20 focus:border-[#4B5E53] transition-all"
              />
            </div>

            {/* PromptPay QR */}
            <AnimatePresence>
              {isValidAmt && qrDataUrl && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="pt-2 flex flex-col items-center gap-2">
                    <p className="text-xs text-[#6B726A]">Scan with your banking app to pay</p>
                    <div className="bg-white rounded-xl border  border-[#E5E3DD] p-3 shadow-sm">
                      <img src={qrDataUrl} alt="PromptPay QR" className="w-48 h-48" data-cy="promptpay-qr" />
                    </div>
                    <p className="text-sm font-semibold text-[#1A1C1A]">฿{parsedAmount.toLocaleString()}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {qrError && <p className="text-xs text-red-500">{qrError}</p>}
          </div>

          {/* Slip upload */}
          <div className="bg-white rounded-2xl shadow-sm border   border-[#E5E3DD] p-6 space-y-3">
            <h2 className="text-sm font-medium text-zinc-700">Upload payment slip</h2>

            {slipFromPhone ? (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                <CheckCircle className="w-4 h-4 text-[#4B5E53] shrink-0" />
                <span className="text-sm text-[#4B5E53] font-medium">Slip received from your phone</span>
                <button type="button" onClick={() => setSlipFromPhone(null)} className="ml-auto text-xs text-[#6B726A] hover:text-red-400 transition-colors">Remove</button>
              </div>
            ) : (
              <>
                {/* File drop zone */}
                <label 
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition-all group ${
                    isDragging 
                      ? 'border-[#4B5E53] bg-[#4B5E53]/10' 
                      : 'border-[#E5E3DD] hover:border-[#4B5E53]/40 hover:bg-[#4B5E53]/5'
                  }`}
                >
                  <Upload className={`w-5 h-5 transition-colors ${isDragging ? 'text-[#4B5E53]' : 'text-[#6B726A] group-hover:text-blue-400'}`} />
                  <span className={`text-sm transition-colors ${isDragging ? 'text-[#4B5E53] font-medium' : 'text-[#6B726A] group-hover:text-[#4B5E53]'}`}>
                    {slipFile ? slipFile.name : (isDragging ? 'Drop it like it\'s hot!' : 'Tap to upload or drag a photo here')}
                  </span>
                  <input type="file" data-cy="slip-upload" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
                </label>

                {/* Phone upload toggle */}
                <button type="button" onClick={() => setShowPhoneUpload(p => !p)}
                  className="w-full flex items-center justify-between text-sm text-[#6B726A] hover:text-[#4B5E53] transition-colors py-1">
                  <span className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> Upload from phone instead</span>
                  <motion.span animate={{ rotate: showPhoneUpload ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="w-4 h-4" />
                  </motion.span>
                </button>

                <AnimatePresence initial={false}>
                  {showPhoneUpload && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                      <div className="flex flex-col items-center gap-2 pt-1">
                        {mobileQrDataUrl && (
                          <div className="bg-white rounded-xl border  border-[#E5E3DD] p-2.5 shadow-sm">
                            <img src={mobileQrDataUrl} alt="Mobile upload QR" className="w-36 h-36" />
                          </div>
                        )}
                        <p className="text-xs text-[#6B726A] text-center">Scan with your phone to upload the slip from your camera roll.</p>
                        {window.location.hostname === 'localhost' && (
                          <p className="text-xs text-amber-600 text-center">⚠ Open this page via your LAN IP for phone scanning to work.</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>

          {/* Error */}
          {formError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-600">{formError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            data-cy="submit-button"
            disabled={submitState === 'submitting'}
            className="w-full bg-[#4B5E53] hover:bg-[#3A4B42] active:bg-[#2E3D35] text-white font-semibold text-sm py-3 rounded-xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitState === 'submitting'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying slip…</>
              : 'Send donation'}
          </button>

          <p className="text-center text-xs text-[#6B726A]">Your slip is verified automatically. Donations are non-refundable.</p>
        </form>
      </div>
    </div>
  );
}

function Result({ icon, title, body, action, onAction }: {
  icon: ReactNode; title: string; body: string; action: string; onAction: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#F9F8F6] flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="flex justify-center mb-4">{icon}</div>
        <h2 className="text-xl font-semibold text-[#1A1C1A] mb-2">{title}</h2>
        <p className="text-sm text-[#6B726A] mb-6 leading-relaxed">{body}</p>
        <button onClick={onAction} className="px-6 py-2.5 bg-white border   border-[#E5E3DD] rounded-xl text-sm font-medium text-zinc-600 hover:border-[#4B5E53] hover:text-[#4B5E53] shadow-sm transition-all">
          {action}
        </button>
      </div>
    </div>
  );
}