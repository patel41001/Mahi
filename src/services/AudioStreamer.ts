/**
 * AudioStreamer handles high-fidelity, low-latency 24kHz PCM16 audio playback
 * from Gemini Live API using the Web Audio API with anti-click de-ramping and
 * real-time speech viseme analysis for 3D character lip-sync.
 */

export interface SpeechVisemeMetrics {
  isSpeaking: boolean;
  volume: number;       // 0.0 to 1.0 (overall audio energy)
  jawOpen: number;      // 0.0 to 1.0 (jaw drop & vowel resonance)
  mouthSpread: number;  // -0.5 to 1.0 (negative for round 'O', positive for smile 'Ee')
  teethReveal: number;  // 0.0 to 1.0 (sibilants 'S'/'T' revealing teeth)
}

export class AudioStreamer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private nextStartTime = 0;
  private activeSources = new Set<AudioBufferSourceNode>();
  private isMuted = false;
  private volume = 1.0;
  private checkSpeakingInterval: number | null = null;
  public onSpeakingChange?: (isSpeaking: boolean) => void;
  private isCurrentlySpeaking = false;

  // Smoothed viseme values for organic lip movement
  private smoothedJaw = 0;
  private smoothedSpread = 0;
  private smoothedTeeth = 0;
  private smoothedVolume = 0;

  constructor() {
    // Lazy initialization on first user gesture
  }

  private initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.5; // Fast response for lip sync

      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;

      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);

      this.startSpeakingMonitor();
    }
  }

  public async resume(): Promise<void> {
    this.initAudioContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  /**
   * Converts Base64 encoded PCM16 (signed 16-bit little-endian) to Float32Array
   * and applies micro anti-click fades at chunk edges.
   */
  private pcm16Base64ToFloat32(base64: string): Float32Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      // Normalize int16 range [-32768, 32767] to float [-1.0, 1.0]
      float32[i] = int16[i] < 0 ? int16[i] / 32768 : int16[i] / 32767;
    }

    // Micro fade-in and fade-out (16 samples ~0.66ms) to eliminate boundary clicks/pops
    const fadeSamples = Math.min(16, Math.floor(float32.length / 4));
    for (let i = 0; i < fadeSamples; i++) {
      const ramp = i / fadeSamples;
      float32[i] *= ramp;
      float32[float32.length - 1 - i] *= ramp;
    }

    return float32;
  }

  /**
   * Schedules a 24kHz PCM16 audio chunk for gapless playback.
   */
  public playChunk(base64Pcm16: string): void {
    this.initAudioContext();
    if (!this.audioCtx || !this.analyser) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    const float32Data = this.pcm16Base64ToFloat32(base64Pcm16);
    if (float32Data.length === 0) return;

    const audioBuffer = this.audioCtx.createBuffer(1, float32Data.length, 24000);
    audioBuffer.getChannelData(0).set(float32Data);

    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.analyser);

    const currentTime = this.audioCtx.currentTime;
    // Align next start time to prevent overlaps or gaps
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime;
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;

    this.activeSources.add(source);
    this.updateSpeakingState(true);

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        // Double-check if still playing
        if (this.audioCtx && this.audioCtx.currentTime >= this.nextStartTime - 0.05) {
          this.updateSpeakingState(false);
        }
      }
    };
  }

  /**
   * Interrupts playback immediately, clears pending audio, and stops all active source nodes.
   */
  public interrupt(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore errors for already stopped sources
      }
    }
    this.activeSources.clear();

    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
    this.updateSpeakingState(false);
  }

  private startSpeakingMonitor() {
    if (this.checkSpeakingInterval) return;
    this.checkSpeakingInterval = window.setInterval(() => {
      if (!this.audioCtx) return;
      const isStillActive = this.activeSources.size > 0 && this.audioCtx.currentTime < this.nextStartTime;
      if (!isStillActive && this.isCurrentlySpeaking) {
        this.updateSpeakingState(false);
      }
    }, 80);
  }

  private updateSpeakingState(speaking: boolean) {
    if (this.isCurrentlySpeaking !== speaking) {
      this.isCurrentlySpeaking = speaking;
      this.onSpeakingChange?.(speaking);
    }
  }

  /**
   * Gets frequency data from AnalyserNode for audio visualization.
   */
  public getFrequencyData(outputArray?: Uint8Array): Uint8Array {
    if (!this.analyser) {
      return outputArray || new Uint8Array(128);
    }
    const data = outputArray || new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data as any);
    return data;
  }

  /**
   * Returns average volume amplitude (0.0 to 1.0).
   */
  public getAverageVolume(): number {
    if (!this.analyser || !this.isCurrentlySpeaking) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data as any);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum / (data.length * 255);
  }

  /**
   * Computes real-time speech viseme metrics for realistic lip-syncing:
   * - Jaw openness: from low-frequency vowel formants (100Hz - 900Hz)
   * - Mouth spread/smile: ratio of high sibilance to low warmth
   * - Teeth reveal: high-frequency consonant bursts
   */
  public getSpeechVisemeMetrics(): SpeechVisemeMetrics {
    if (!this.analyser || !this.isCurrentlySpeaking) {
      // Smooth decay to rest pose
      this.smoothedJaw *= 0.85;
      this.smoothedSpread *= 0.85;
      this.smoothedTeeth *= 0.85;
      this.smoothedVolume *= 0.85;

      return {
        isSpeaking: false,
        volume: this.smoothedVolume,
        jawOpen: this.smoothedJaw,
        mouthSpread: this.smoothedSpread,
        teethReveal: this.smoothedTeeth,
      };
    }

    const binCount = this.analyser.frequencyBinCount;
    const freqData = new Uint8Array(binCount);
    this.analyser.getByteFrequencyData(freqData);

    // Band calculations:
    // Low band (vowels / jaw drop): bins 1 - 10 (~90Hz - 940Hz)
    let lowSum = 0;
    const lowEnd = Math.min(10, binCount);
    for (let i = 1; i < lowEnd; i++) {
      lowSum += freqData[i];
    }
    const lowAvg = lowSum / ((lowEnd - 1) * 255);

    // Mid band (vocal formants): bins 11 - 28 (~1000Hz - 2600Hz)
    let midSum = 0;
    const midEnd = Math.min(28, binCount);
    for (let i = lowEnd; i < midEnd; i++) {
      midSum += freqData[i];
    }
    const midAvg = midSum / ((midEnd - lowEnd) * 255);

    // High band (sibilants 'S', 'T', consonants, smiling teeth): bins 29 - 60 (~2700Hz - 5600Hz)
    let highSum = 0;
    const highEnd = Math.min(60, binCount);
    for (let i = midEnd; i < highEnd; i++) {
      highSum += freqData[i];
    }
    const highAvg = highSum / ((highEnd - midEnd) * 255);

    // Total average volume
    let totalSum = 0;
    for (let i = 0; i < binCount; i++) {
      totalSum += freqData[i];
    }
    const currentVol = Math.min(1.0, (totalSum / (binCount * 255)) * 1.8);

    // Target jaw drop based on low formant energy and total volume
    const targetJaw = Math.min(1.0, (lowAvg * 1.5 + currentVol * 0.8));
    
    // Target mouth spread: positive for high 'ee' / 'ay' sounds, negative for round 'oh' / 'oo'
    const targetSpread = Math.max(-0.4, Math.min(0.8, (highAvg - lowAvg * 0.6) * 1.4));

    // Target teeth reveal: sibilant high frequency bursts
    const targetTeeth = Math.min(1.0, highAvg * 1.8 + (targetSpread > 0.2 ? 0.3 : 0));

    // Smooth with exponential moving average (approx 30ms latency for natural mouth fluidity)
    const alpha = 0.35;
    this.smoothedVolume = this.smoothedVolume * (1 - alpha) + currentVol * alpha;
    this.smoothedJaw = this.smoothedJaw * (1 - alpha) + targetJaw * alpha;
    this.smoothedSpread = this.smoothedSpread * (1 - alpha) + targetSpread * alpha;
    this.smoothedTeeth = this.smoothedTeeth * (1 - alpha) + targetTeeth * alpha;

    return {
      isSpeaking: true,
      volume: this.smoothedVolume,
      jawOpen: this.smoothedJaw,
      mouthSpread: this.smoothedSpread,
      teethReveal: this.smoothedTeeth,
    };
  }

  public setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && !this.isMuted) {
      this.masterGain.gain.value = this.volume;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume;
    }
    return this.isMuted;
  }

  public close() {
    if (this.checkSpeakingInterval) {
      clearInterval(this.checkSpeakingInterval);
      this.checkSpeakingInterval = null;
    }
    this.interrupt();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
