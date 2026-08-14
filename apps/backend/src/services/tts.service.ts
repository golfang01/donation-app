import * as googleTTS from 'google-tts-api';

const MAX_TTS_CHARS = 200;

// Replaces banned words with beep characters so the TTS still reads
// naturally without the banned word being audible.
function censorText(text: string, profanityList: string[]): string {
  if (profanityList.length === 0) return text;

  let censored = text;
  for (const word of profanityList) {
    // Word-boundary match, case-insensitive, global.
    const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    censored = censored.replace(pattern, '*'.repeat(word.length));
  }
  return censored;
}

export function shouldReadAloud(amount: number, minTtsAmount: number): boolean {
  return minTtsAmount === 0 || amount >= minTtsAmount;
}

export async function synthesizeThaiSpeech(
  text: string,
  profanityList: string[] = []
): Promise<string> {
  const cleaned  = censorText(text.trim(), profanityList);
  const trimmed  = cleaned.length > MAX_TTS_CHARS
    ? `${cleaned.slice(0, MAX_TTS_CHARS)}...`
    : cleaned;

  if (trimmed.length <= MAX_TTS_CHARS) {
    return googleTTS.getAudioBase64(trimmed, {
      lang:    'th',
      slow:    false,
      host:    'https://translate.google.com',
      timeout: 10000,
    });
  }

  const chunks = await googleTTS.getAllAudioBase64(trimmed, {
    lang:       'th',
    slow:       false,
    host:       'https://translate.google.com',
    timeout:    10000,
    splitPunct: ',.?!',
  });

  const combined = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk.base64, 'base64'))
  );

  return combined.toString('base64');
}