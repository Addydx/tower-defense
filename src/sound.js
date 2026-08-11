// Todos los sonidos se generan proceduralmente con la Web Audio API,
// sin archivos externos.
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.musicGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicIntensity = 0;
    this.muted = false;
  }

  /** Debe llamarse tras un gesto del usuario (click) por la política de autoplay. */
  unlock() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.6;
    this.masterGain.connect(this.ctx.destination);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.12;
    this.musicGain.connect(this.masterGain);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain) this.masterGain.gain.value = muted ? 0 : 0.6;
  }

  _tone(freq, { duration = 0.15, type = 'sine', delay = 0, gain = 0.3, freqEnd = null } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  _noise({ duration = 0.15, delay = 0, gain = 0.2 } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(g);
    g.connect(this.masterGain);
    source.start(t0);
  }

  playShoot(towerType = 'ARROW') {
    const pitch = { ARROW: 880, CANNON: 220, ICE: 660 }[towerType] ?? 700;
    this._tone(pitch, { duration: 0.08, type: 'triangle', gain: 0.18, freqEnd: pitch * 0.7 });
  }

  playImpact() {
    this._noise({ duration: 0.08, gain: 0.15 });
  }

  playDeath() {
    this._tone(180, { duration: 0.3, type: 'sawtooth', gain: 0.2, freqEnd: 40 });
  }

  playBuild() {
    this._tone(440, { duration: 0.12, type: 'sine', gain: 0.2, delay: 0 });
    this._tone(660, { duration: 0.15, type: 'sine', gain: 0.2, delay: 0.08 });
  }

  playUpgrade() {
    this._tone(523.25, { duration: 0.12, type: 'square', gain: 0.15, delay: 0 });
    this._tone(659.25, { duration: 0.12, type: 'square', gain: 0.15, delay: 0.1 });
    this._tone(783.99, { duration: 0.18, type: 'square', gain: 0.15, delay: 0.2 });
  }

  playWaveStart() {
    this._tone(220, { duration: 0.2, type: 'sawtooth', gain: 0.22, delay: 0 });
    this._tone(330, { duration: 0.35, type: 'sawtooth', gain: 0.22, delay: 0.15 });
  }

  playVictory() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this._tone(f, { duration: 0.3, type: 'triangle', gain: 0.22, delay: i * 0.15 });
    });
  }

  playDefeat() {
    this._tone(200, { duration: 0.6, type: 'sawtooth', gain: 0.25, freqEnd: 60 });
  }

  playCoin() {
    this._tone(988, { duration: 0.06, type: 'square', gain: 0.1 });
  }

  playLeak() {
    this._tone(140, { duration: 0.2, type: 'square', gain: 0.18, freqEnd: 90 });
  }

  playClick() {
    this._tone(700, { duration: 0.04, type: 'square', gain: 0.08 });
  }

  /** Loop de bajo simple; `intensity` (0..1) acelera el tempo con más enemigos en pantalla. */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const pattern = [130.81, 130.81, 155.56, 174.61];
    const step = () => {
      const freq = pattern[this.musicStep % pattern.length];
      this._toMusic(freq);
      this.musicStep++;
      const baseInterval = 420 - this.musicIntensity * 180;
      this.musicTimer = setTimeout(step, Math.max(baseInterval, 180));
    };
    step();
  }

  _toMusic(freq) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + 0.3);
  }

  setMusicIntensity(activeEnemyCount) {
    this.musicIntensity = Math.min(1, activeEnemyCount / 20);
  }

  stopMusic() {
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
    this.musicStep = 0;
  }
}
