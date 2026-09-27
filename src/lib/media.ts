// Getting photos and voice into a shape the backend can read: small, and in a format that works everywhere.

export class MediaError extends Error {
  constructor(public code: 'unsupported' | 'denied' | 'nomic' | 'empty', message: string) {
    super(message);
  }
}

/* ---------------- photos ---------------- */

const MAX_SIDE = 1600; // a slip is text: this is plenty to read it, and keeps the upload small
const JPEG_QUALITY = 0.85;

export interface PreparedImage {
  mime: 'image/jpeg';
  /** base64, no "data:" prefix */
  data: string;
  /** a tiny data-URL preview for the list */
  thumb: string;
}

function drawn(bmp: ImageBitmap, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new MediaError('unsupported', 'This browser cannot process pictures.');
  ctx.fillStyle = '#FFFFFF'; // transparent PNG screenshots become white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Shrinks a photo or screenshot to JPEG. Rejects with MediaError('unsupported') for files that are not pictures. */
export async function prepareImage(file: File): Promise<PreparedImage> {
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new MediaError('unsupported', 'That file is not a picture this phone can open.');
  }
  try {
    const main = drawn(bmp, MAX_SIDE).toDataURL('image/jpeg', JPEG_QUALITY);
    const thumb = drawn(bmp, 96).toDataURL('image/jpeg', 0.6);
    return { mime: 'image/jpeg', data: main.slice(main.indexOf(',') + 1), thumb };
  } finally {
    bmp.close?.();
  }
}

/* ---------------- voice ---------------- */

export interface PreparedAudio {
  mime: 'audio/wav';
  data: string;
  seconds: number;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** 16-bit mono PCM in a WAV file. Every phone can record what this can be made from, and the reader accepts it. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const out = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, s: string) => [...s].forEach((c, i) => out.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  out.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  out.setUint32(16, 16, true); // fmt chunk size
  out.setUint16(20, 1, true); // PCM
  out.setUint16(22, 1, true); // mono
  out.setUint32(24, sampleRate, true);
  out.setUint32(28, sampleRate * 2, true); // bytes per second
  out.setUint16(32, 2, true); // bytes per sample
  out.setUint16(34, 16, true);
  text(36, 'data');
  out.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(out.buffer);
}

const SPEECH_RATE = 16000;

async function toWav(blob: Blob): Promise<PreparedAudio> {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    if (decoded.duration < 0.3) throw new MediaError('empty', 'That was too short to hear.');
    // resample to 16 kHz mono: speech needs no more, and it keeps the upload small
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * SPEECH_RATE), SPEECH_RATE);
    const src = off.createBufferSource();
    src.buffer = decoded;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    return { mime: 'audio/wav', data: bytesToBase64(encodeWav(rendered.getChannelData(0), SPEECH_RATE)), seconds: decoded.duration };
  } catch (e) {
    if (e instanceof MediaError) throw e;
    throw new MediaError('unsupported', 'This phone could not process the recording.');
  } finally {
    void ctx.close();
  }
}

export class VoiceRecorder {
  private rec?: MediaRecorder;
  private stream?: MediaStream;
  private chunks: Blob[] = [];

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new MediaError('nomic', 'Recording is not available here.');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new MediaError('denied', 'The microphone is blocked.');
    }
    this.chunks = [];
    this.rec = new MediaRecorder(this.stream);
    this.rec.ondataavailable = e => e.data.size && this.chunks.push(e.data);
    this.rec.start();
  }

  async stop(): Promise<PreparedAudio> {
    const rec = this.rec;
    if (!rec) throw new MediaError('empty', 'Nothing was recorded.');
    await new Promise<void>(done => {
      rec.onstop = () => done();
      rec.state === 'inactive' ? done() : rec.stop();
    });
    this.release();
    return toWav(new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' }));
  }

  cancel() {
    try {
      if (this.rec && this.rec.state !== 'inactive') this.rec.stop();
    } catch {
      /* already stopped */
    }
    this.release();
  }

  private release() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = undefined;
  }
}
