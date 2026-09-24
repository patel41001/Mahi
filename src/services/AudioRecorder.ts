/**
 * AudioRecorder captures microphone input, resamples to 16kHz PCM16,
 * and streams Base64 chunks to the Live API session.
 */
export class AudioRecorder {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private isRecording = false;
  private isMuted = false;
  public onAudioChunk?: (base64Pcm16: string) => void;
  public onError?: (error: Error) => void;

  constructor() {}

  /**
   * Starts capturing microphone audio at 16kHz PCM16.
   */
  public async start(): Promise<void> {
    if (this.isRecording) return;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      // Request 16kHz AudioContext for standard Gemini Live mic input
      this.audioCtx = new AudioCtxClass({ sampleRate: 16000 });

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.5;

      // 4096 buffer size at 16kHz produces chunks approximately every 256ms
      this.processorNode = this.audioCtx.createScriptProcessor(4096, 1, 1);

      this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
        if (!this.isRecording || this.isMuted) return;

        const inputChannelData = e.inputBuffer.getChannelData(0);
        const base64Pcm16 = this.float32ToPcm16Base64(inputChannelData);
        if (base64Pcm16) {
          this.onAudioChunk?.(base64Pcm16);
        }
      };

      this.sourceNode.connect(this.analyser);
      this.analyser.connect(this.processorNode);
      // ScriptProcessor needs to connect to destination to trigger events
      this.processorNode.connect(this.audioCtx.destination);

      this.isRecording = true;
    } catch (err: any) {
      this.stop();
      const error = err instanceof Error ? err : new Error(String(err));
      this.onError?.(error);
      throw error;
    }
  }

  /**
   * Converts Float32Array to 16-bit PCM little-endian Base64 string.
   */
  private float32ToPcm16Base64(float32Array: Float32Array): string {
    const pcm16 = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const uint8 = new Uint8Array(pcm16.buffer);
    let binary = '';
    const len = uint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    return btoa(binary);
  }

  /**
   * Gets frequency data from AnalyserNode for mic visualizer.
   */
  public getFrequencyData(outputArray?: Uint8Array): Uint8Array {
    if (!this.analyser || !this.isRecording || this.isMuted) {
      return outputArray || new Uint8Array(64);
    }
    const data = outputArray || new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data as any);
    return data;
  }

  /**
   * Returns average mic input volume (0.0 to 1.0).
   */
  public getAverageVolume(): number {
    if (!this.analyser || !this.isRecording || this.isMuted) return 0;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data as any);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum / (data.length * 255);
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Stops recording and releases microphone resources.
   */
  public stop(): void {
    this.isRecording = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
