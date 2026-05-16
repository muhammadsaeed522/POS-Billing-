/**
 * Lightweight Web Audio beeps for POS feedback (no external sound files).
 * Safe no-op if AudioContext is unavailable.
 */

let sharedCtx;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!sharedCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    sharedCtx = new AC();
  }
  return sharedCtx;
}

function playTone(freq, durationMs, gain = 0.07) {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g);
    g.connect(ctx.destination);
    const t0 = ctx.currentTime;
    osc.start(t0);
    osc.stop(t0 + durationMs / 1000);
  } catch {
    /* ignore */
  }
}

/** Short ascending tone — product matched and added. */
export function playScanSuccess() {
  playTone(920, 55, 0.065);
  window.setTimeout(() => playTone(1180, 70, 0.055), 55);
}

/** Low buzz — unknown barcode / error. */
export function playScanError() {
  playTone(180, 120, 0.09);
}
