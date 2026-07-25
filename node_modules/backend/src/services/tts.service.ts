import * as googleTTS from 'google-tts-api';

const MAX_TTS_CHARS = 200;

export async function synthesizeThaiSpeech(text: string): Promise<string> {
  const trimmed = text.trim();

  if (trimmed.length <= MAX_TTS_CHARS) {
    return googleTTS.getAudioBase64(trimmed, {
      lang: 'th',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 10000,
    });
  }

  const chunks = await googleTTS.getAllAudioBase64(trimmed, {
    lang: 'th',
    slow: false,
    host: 'https://translate.google.com',
    timeout: 10000,
    splitPunct: ',.?! ',
  });

  const combined = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk.base64, 'base64'))
  );

  return combined.toString('base64');
}