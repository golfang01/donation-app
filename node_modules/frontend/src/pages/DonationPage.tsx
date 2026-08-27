import { useState, useEffect } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import {
  CheckCircle, XCircle, Upload, Smartphone,
  Loader2, ChevronDown, Heart, Sparkles, Moon, Sun,
} from 'lucide-react';
import { api } from '../lib/api';
import { socket } from '../lib/socket';
import { VerificationStatus, SOCKET_EVENTS } from '@donation-app/shared-types';
import type { DonationSubmissionResponse, SlipUploadedPayload } from '@donation-app/shared-types';

type SubmitState = 'idle' | 'submitting' | 'success' | 'failed' | 'error';

const PROMPTPAY_ID  = import.meta.env.VITE_PROMPTPAY_ID ?? '';
const QUICK_AMOUNTS = [20, 50, 100, 200, 500];

// ── Theme toggle ────────────────────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  return { dark, toggle: () => setDark(p => !p) };
}

// ── Success card ────────────────────────────────────────────────────────────
function SuccessCard({
  senderName,
  amount,
  onReset,
}: {
  senderName: string;
  amount: string;
  onReset: () => void;
}) {
  const [txId] = useState(() => `TXN-${Date.now().toString(36).toUpperCase()}`);

  return (
    <div className="min-h-screen bg-linear-to-br from-[#F0F4F1] to-[#E8EFE9] dark:from-zinc-950 dark:to-zinc-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-xl dark:shadow-zinc-950/60 overflow-hidden"
      >
        {/* Top decorative strip */}
        <div className="h-1.5 bg-linear-to-r from-[#8FAD9A] via-[#6B9B7E] to-[#8FAD9A]" />

        <div className="px-8 pt-8 pb-6 flex flex-col items-center gap-6">

          {/* Badge with sparkles */}
          <div className="relative flex items-center justify-center">
            {/* Outer glow ring */}
            <div className="absolute w-24 h-24 rounded-full bg-[#8FAD9A]/20 dark:bg-[#8FAD9A]/10 animate-pulse" />
            {/* Badge circle */}
            <div className="relative w-18 h-18 rounded-full bg-[#8FAD9A] flex items-center justify-center shadow-lg"
              style={{ width: '72px', height: '72px' }}>
              <Heart className="w-8 h-8 text-white fill-white" />
            </div>
            {/* Sparkle accents */}
            <Sparkles className="absolute -top-2 -right-1 w-5 h-5 text-[#8FAD9A]" />
            <Sparkles className="absolute -bottom-1 -left-2 w-4 h-4 text-[#8FAD9A]/60" />
          </div>

          {/* Heading */}
          <div className="text-center space-y-1.5">
            <h2 className="text-xl font-bold text-[#1A1C1A] dark:text-zinc-100 tracking-tight">
              Thank You! 🎉
            </h2>
            <p className="text-sm text-[#6B726A] dark:text-zinc-400 leading-relaxed">
              Your donation was verified and<br />
              you're now live on stream.
            </p>
          </div>

          {/* Summary box */}
          <div className="w-full bg-[#F9F8F6] dark:bg-zinc-800 rounded-2xl p-5 space-y-3.5">
            <p className="text-xs font-semibold text-[#6B726A] dark:text-zinc-400 uppercase tracking-widest">
              Donation Summary
            </p>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#6B726A] dark:text-zinc-400">Recipient</span>
                <span className="text-sm font-semibold text-[#1A1C1A] dark:text-zinc-100 truncate max-w-40">
                  {senderName || 'Anonymous'}
                </span>
              </div>

              <div className="h-px bg-[#E5E3DD] dark:bg-zinc-700" />

              <div className="flex items-center justify-between">
                <span className="text-sm text-[#6B726A] dark:text-zinc-400">Amount</span>
                <span className="text-sm font-bold text-[#4B5E53] dark:text-[#8FAD9A]">
                  ฿{Number(amount).toLocaleString()}
                </span>
              </div>

              <div className="h-px bg-[#E5E3DD] dark:bg-zinc-700" />

              <div className="flex items-center justify-between">
                <span className="text-sm text-[#6B726A] dark:text-zinc-400">Transaction ID</span>
                <span className="text-xs font-mono text-[#6B726A] dark:text-zinc-400 bg-[#E5E3DD] dark:bg-zinc-700 px-2 py-0.5 rounded-lg">
                  {txId}
                </span>
              </div>
            </div>
          </div>

          {/* Status pill */}
          <div className="flex items-center gap-2 bg-[#8FAD9A]/15 dark:bg-[#8FAD9A]/10 rounded-full px-4 py-2">
            <CheckCircle className="w-4 h-4 text-[#4B5E53] dark:text-[#8FAD9A]" />
            <span className="text-sm font-medium text-[#4B5E53] dark:text-[#8FAD9A]">
              Payment Verified
            </span>
          </div>

          {/* Action buttons */}
          <div className="w-full space-y-3 pt-1">
            <button
              onClick={onReset}
              className="w-full bg-[#4B5E53] hover:bg-[#3A4B42] dark:bg-[#8FAD9A] dark:hover:bg-[#7A9D8A] text-white font-semibold text-sm py-3 rounded-xl shadow-sm transition-all"
            >
              Send Another Donation
            </button>
            <button
              onClick={onReset}
              className="w-full bg-transparent border border-[#E5E3DD] dark:border-zinc-700 hover:border-[#4B5E53] dark:hover:border-[#8FAD9A] text-[#4B5E53] dark:text-[#8FAD9A] font-medium text-sm py-3 rounded-xl transition-all"
            >
              Return to Home
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function DonationPage() {
  const { dark, toggle } = useTheme();

  const [senderName,      setSenderName]      = useState('');
  const [message,         setMessage]         = useState('');
  const [amount,          setAmount]          = useState('');
  const [slipFile,        setSlipFile]        = useState<File | null>(null);
  const [formError,       setFormError]       = useState<string | null>(null);
  const [submitState,     setSubmitState]     = useState<SubmitState>('idle');
  const [failureMessage,  setFailureMessage]  = useState<string | null>(null);
  const [qrDataUrl,       setQrDataUrl]       = useState<string | null>(null);
  const [qrError,         setQrError]         = useState<string | null>(
    !PROMPTPAY_ID ? 'PromptPay QR is not configured.' : null
  );
  const [sessionId]                           = useState(() => uuidv4());
  const [mobileQrDataUrl, setMobileQrDataUrl] = useState<string | null>(null);
  const [slipFromPhone,   setSlipFromPhone]   = useState<string | null>(null);
  const [showPhoneUpload, setShowPhoneUpload] = useState(false);
  const [isDragging,      setIsDragging]      = useState(false);
  const [timerConfig,     setTimerConfig]     = useState<{
    enabled: boolean; baseAmount: number; baseMinutes: number;
  } | null>(null);

  const parsedAmount = Number(amount);
  const isValidAmt   = !!amount && !Number.isNaN(parsedAmount) && parsedAmount > 0;

  const timerBonus = timerConfig && isValidAmt
    ? (parsedAmount / timerConfig.baseAmount) * timerConfig.baseMinutes : 0;
  const timerBonusLabel = timerBonus >= 1
    ? `+${Math.round(timerBonus)} min`
    : timerBonus > 0 ? `+${Math.round(timerBonus * 60)} sec` : '';

  // PromptPay QR
  useEffect(() => {
    if (!PROMPTPAY_ID || !isValidAmt) {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  setQrDataUrl(null);
  return;
}
    const t = setTimeout(async () => {
      try {
        const payload = generatePayload(PROMPTPAY_ID, { amount: parsedAmount });
        const url = await QRCode.toDataURL(payload, {
          width: 220, margin: 2,
          color: { dark: dark ? '#f4f4f5' : '#18181b', light: dark ? '#18181b' : '#ffffff' },
        });
        setQrDataUrl(url); setQrError(null);
      } catch { setQrDataUrl(null); setQrError('Could not generate QR code.'); }
    }, 300);
    return () => clearTimeout(t);
  }, [amount, isValidAmt, parsedAmount, dark]);

  // Timer config
  useEffect(() => {
    api.get<{ enabled: boolean; timerBaseAmount: number; timerBaseMinutes: number }>('/api/widget/timer')
      .then(({ data }) => {
        if (data.enabled) setTimerConfig({ enabled: data.enabled, baseAmount: data.timerBaseAmount, baseMinutes: data.timerBaseMinutes });
      }).catch(() => {});
  }, []);

  // Mobile upload QR + socket
  useEffect(() => {
    const origin = window.location.origin;
    const url = `${origin}/mobile-upload?sessionId=${sessionId}`;
    QRCode.toDataURL(url, { width: 160, margin: 2, color: { dark: '#18181b', light: '#ffffff' } })
      .then(setMobileQrDataUrl).catch(console.error);
    socket.connect();
    socket.emit('join:session', sessionId);
    const handle = (p: SlipUploadedPayload) => {
      if (p.sessionId !== sessionId) return;
      setSlipFromPhone(p.slipUrl); setSlipFile(null); setShowPhoneUpload(false);
    };
    socket.on(SOCKET_EVENTS.SLIP_UPLOADED, handle);
    return () => { socket.off(SOCKET_EVENTS.SLIP_UPLOADED, handle); socket.disconnect(); };
  }, [sessionId]);

  // Drag & drop
  function handleDragOver(e: React.DragEvent<HTMLLabelElement>)  { e.preventDefault(); e.stopPropagation(); }
  function handleDragEnter(e: React.DragEvent<HTMLLabelElement>) { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }
  function handleDragLeave(e: React.DragEvent<HTMLLabelElement>) { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }
  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      setFormError('Please upload a valid image (JPEG, PNG, WEBP).'); return;
    }
    setSlipFile(file); setSlipFromPhone(null); setFormError(null);
  }
  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setSlipFile(e.target.files?.[0] ?? null); setSlipFromPhone(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setFormError(null);
    if (!senderName.trim()) return setFormError('Please enter your name.');
    if (!isValidAmt)        return setFormError('Please enter a valid amount.');
    if (!slipFile && !slipFromPhone) return setFormError('Please upload your payment slip.');
    const fd = new FormData();
    fd.append('senderName', senderName.trim());
    if (message.trim()) fd.append('message', message.trim());
    fd.append('amount', String(parsedAmount));
    if (slipFile)           fd.append('slipImage',    slipFile);
    else if (slipFromPhone) fd.append('slipImageUrl', slipFromPhone);
    setSubmitState('submitting');
    try {
      const { data } = await api.post<DonationSubmissionResponse>('/api/donations', fd);
      if (data.status === VerificationStatus.VERIFIED)        setSubmitState('success');
      else if (data.status === VerificationStatus.FAILED) { setFailureMessage(data.message ?? null); setSubmitState('failed'); }
      else setSubmitState('success');
    } catch { setSubmitState('error'); setFormError('Something went wrong. Please try again.'); }
  }

  function reset() {
    setSenderName(''); setMessage(''); setAmount(''); setSlipFile(null);
    setSlipFromPhone(null); setFormError(null); setFailureMessage(null);
    setQrDataUrl(null); setShowPhoneUpload(false); setSubmitState('idle');
  }

  if (submitState === 'success') {
    return <SuccessCard senderName={senderName} amount={amount} onReset={reset} />;
  }
  if (submitState === 'failed') {
    return (
      <div className="min-h-screen bg-[#F9F8F6] dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#1A1C1A] dark:text-zinc-100 mb-2">Couldn't verify your slip</h2>
          <p className="text-sm text-[#6B726A] dark:text-zinc-400 mb-6">{failureMessage ?? 'Please check your transfer details and try again.'}</p>
          <button onClick={reset} className="px-6 py-2.5 bg-white dark:bg-zinc-900 border border-[#E5E3DD] dark:border-zinc-700 rounded-xl text-sm font-medium text-[#6B726A] dark:text-zinc-300 hover:border-[#4B5E53] dark:hover:border-[#8FAD9A] shadow-sm transition-all">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F8F6] dark:bg-zinc-950 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="w-full max-w-lg">

        {/* Header + theme toggle */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1C1A] dark:text-zinc-100 tracking-tight">Send a donation</h1>
            <p className="text-sm text-[#6B726A] dark:text-zinc-400 mt-1">Your name and message appear live on stream.</p>
          </div>
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="mt-1 p-2 rounded-xl bg-white dark:bg-zinc-800 border border-[#E5E3DD] dark:border-zinc-700 text-[#6B726A] dark:text-zinc-400 hover:text-[#4B5E53] dark:hover:text-[#8FAD9A] shadow-sm transition-all"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Details card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-[#E5E3DD] dark:border-zinc-800 p-6 space-y-4">
            <h2 className="text-sm font-medium text-[#1A1C1A] dark:text-zinc-200">Your details</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#6B726A] dark:text-zinc-400 mb-1.5">Name shown on stream</label>
                <input
                  type="text"
                  data-cy="sender-name-input"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="How should we credit you?"
                  className="w-full rounded-xl border border-[#E5E3DD] dark:border-zinc-700 bg-[#F9F8F6] dark:bg-zinc-800 px-4 py-2.5 text-sm text-[#1A1C1A] dark:text-zinc-100 placeholder:text-[#6B726A] dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#4B5E53]/20 dark:focus:ring-[#8FAD9A]/20 focus:border-[#4B5E53] dark:focus:border-[#8FAD9A] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6B726A] dark:text-zinc-400 mb-1.5">
                  Message <span className="font-normal">(optional)</span>
                </label>
                <textarea
                  data-cy="message-input"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Say something to the stream…"
                  rows={2}
                  className="w-full rounded-xl border border-[#E5E3DD] dark:border-zinc-700 bg-[#F9F8F6] dark:bg-zinc-800 px-4 py-2.5 text-sm text-[#1A1C1A] dark:text-zinc-100 placeholder:text-[#6B726A] dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#4B5E53]/20 dark:focus:ring-[#8FAD9A]/20 focus:border-[#4B5E53] dark:focus:border-[#8FAD9A] transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Amount card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-[#E5E3DD] dark:border-zinc-800 p-6 space-y-4">
            <h2 className="text-sm font-medium text-[#1A1C1A] dark:text-zinc-200">Amount</h2>

            <div className="flex gap-2 flex-wrap">
              {QUICK_AMOUNTS.map((v) => (
                <button key={v} type="button" onClick={() => setAmount(String(v))}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    amount === String(v)
                      ? 'bg-[#4B5E53] border-[#4B5E53] text-white shadow-sm dark:bg-[#8FAD9A] dark:border-[#8FAD9A] dark:text-zinc-900'
                      : 'bg-white dark:bg-zinc-800 border-[#E5E3DD] dark:border-zinc-700 text-[#6B726A] dark:text-zinc-400 hover:border-[#4B5E53] dark:hover:border-[#8FAD9A] hover:text-[#4B5E53] dark:hover:text-[#8FAD9A]'
                  }`}>
                  ฿{v}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {timerBonusLabel && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {timerBonusLabel} added to the stream timer
                </div>
              )}
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B726A] dark:text-zinc-400 text-sm font-medium">฿</span>
                <input
                  type="number"
                  data-cy="amount-input"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Custom amount"
                  className="w-full rounded-xl border border-[#E5E3DD] dark:border-zinc-700 bg-[#F9F8F6] dark:bg-zinc-800 pl-8 pr-4 py-2.5 text-sm text-[#1A1C1A] dark:text-zinc-100 placeholder:text-[#6B726A] dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#4B5E53]/20 dark:focus:ring-[#8FAD9A]/20 focus:border-[#4B5E53] dark:focus:border-[#8FAD9A] transition-all"
                />
              </div>
            </div>

            <AnimatePresence>
              {isValidAmt && qrDataUrl && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                  <div className="pt-2 flex flex-col items-center gap-2">
                    <p className="text-xs text-[#6B726A] dark:text-zinc-400">Scan with your banking app to pay</p>
                    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-[#E5E3DD] dark:border-zinc-700 p-3 shadow-sm">
                      <img src={qrDataUrl} alt="PromptPay QR" className="w-48 h-48" data-cy="promptpay-qr" />
                    </div>
                    <p className="text-sm font-semibold text-[#1A1C1A] dark:text-zinc-100">฿{parsedAmount.toLocaleString()}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {qrError && <p className="text-xs text-red-500 dark:text-red-400">{qrError}</p>}
          </div>

          {/* Slip upload card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-[#E5E3DD] dark:border-zinc-800 p-6 space-y-3">
            <h2 className="text-sm font-medium text-[#1A1C1A] dark:text-zinc-200">Upload payment slip</h2>

            {slipFromPhone ? (
              <div className="flex items-center gap-3 bg-[#8FAD9A]/10 dark:bg-[#8FAD9A]/10 border border-[#8FAD9A]/30 dark:border-[#8FAD9A]/20 rounded-xl px-4 py-3">
                <CheckCircle className="w-4 h-4 text-[#4B5E53] dark:text-[#8FAD9A] shrink-0" />
                <span className="text-sm text-[#4B5E53] dark:text-[#8FAD9A] font-medium">Slip received from your phone</span>
                <button type="button" onClick={() => setSlipFromPhone(null)} className="ml-auto text-xs text-[#6B726A] dark:text-zinc-500 hover:text-red-400 transition-colors">Remove</button>
              </div>
            ) : (
              <>
                <label
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-xl px-4 py-5 cursor-pointer transition-all group ${
                    isDragging
                      ? 'border-[#4B5E53] dark:border-[#8FAD9A] bg-[#4B5E53]/10 dark:bg-[#8FAD9A]/10'
                      : 'border-[#E5E3DD] dark:border-zinc-700 hover:border-[#4B5E53]/40 dark:hover:border-[#8FAD9A]/40 hover:bg-[#4B5E53]/5 dark:hover:bg-[#8FAD9A]/5'
                  }`}
                >
                  <Upload className={`w-5 h-5 transition-colors ${isDragging ? 'text-[#4B5E53] dark:text-[#8FAD9A]' : 'text-[#6B726A] dark:text-zinc-500 group-hover:text-[#4B5E53] dark:group-hover:text-[#8FAD9A]'}`} />
                  <span className={`text-sm transition-colors ${isDragging ? 'text-[#4B5E53] dark:text-[#8FAD9A] font-medium' : 'text-[#6B726A] dark:text-zinc-400 group-hover:text-[#4B5E53] dark:group-hover:text-[#8FAD9A]'}`}>
                    {slipFile ? slipFile.name : isDragging ? "Drop it here!" : 'Tap to upload or drag a photo here'}
                  </span>
                  <input type="file" data-cy="slip-upload" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" />
                </label>

                <button type="button" onClick={() => setShowPhoneUpload(p => !p)}
                  className="w-full flex items-center justify-between text-sm text-[#6B726A] dark:text-zinc-400 hover:text-[#4B5E53] dark:hover:text-[#8FAD9A] transition-colors py-1">
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
                          <div className="bg-white dark:bg-zinc-800 rounded-xl border border-[#E5E3DD] dark:border-zinc-700 p-2.5 shadow-sm">
                            <img src={mobileQrDataUrl} alt="Mobile upload QR" className="w-36 h-36" />
                          </div>
                        )}
                        <p className="text-xs text-[#6B726A] dark:text-zinc-400 text-center">Scan with your phone to upload the slip from your camera roll.</p>
                        {window.location.hostname === 'localhost' && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">⚠ Open this page via your LAN IP for phone scanning to work.</p>
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
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 rounded-xl px-4 py-3">
              <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            data-cy="submit-button"
            disabled={submitState === 'submitting'}
            className="w-full bg-[#4B5E53] hover:bg-[#3A4B42] active:bg-[#2E3D35] dark:bg-[#8FAD9A] dark:hover:bg-[#7A9D8A] dark:active:bg-[#6B9B7E] text-white dark:text-zinc-900 font-semibold text-sm py-3 rounded-xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitState === 'submitting'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying slip…</>
              : 'Send donation'}
          </button>

          <p className="text-center text-xs text-[#6B726A] dark:text-zinc-500">
            Your slip is verified automatically. Donations are non-refundable.
          </p>
        </form>
      </div>
    </div>
  );
}