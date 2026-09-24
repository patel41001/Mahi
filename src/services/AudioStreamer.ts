/**
 * AudioStreamer handles high-fidelity, low-latency 24kHz PCM16 audio playback
 * from Gemini Live API using the Web Audio API.
 */
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

  constructor() {
    // Lazy initialization on first user gesture
  }

  private initAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

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
    }, 100);
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
      return outputArray || new Uint8Array(64);
    }
    const data = outputArray || new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data as any);
    return data;
  }

  /**
   * Returns average volume amplitude (0.0 to 1.0) for visual pulse.
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
