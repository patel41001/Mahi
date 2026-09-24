import { AudioRecorder } from './AudioRecorder';
import { AudioStreamer } from './AudioStreamer';
import type { AssistantState, VoiceName } from '../types/assistant';

export interface LiveSessionConfig {
  voice?: VoiceName;
}

export class LiveSession {
  private ws: WebSocket | null = null;
  private recorder: AudioRecorder;
  private streamer: AudioStreamer;
  private state: AssistantState = 'disconnected';
  private voice: VoiceName = 'Aoede';
  private errorMessage = '';

  public onStateChange?: (state: AssistantState) => void;
  public onToolCall?: (event: { id: string; name: string; args: Record<string, any> }) => void;
  public onError?: (message: string) => void;
  public onModelInfo?: (info: { model: string; voice: string }) => void;

  constructor(config?: LiveSessionConfig) {
    if (config?.voice) {
      this.voice = config.voice;
    }
    this.recorder = new AudioRecorder();
    this.streamer = new AudioStreamer();

    this.streamer.onSpeakingChange = (isSpeaking) => {
      if (this.state === 'listening' && isSpeaking) {
        this.setState('speaking');
      } else if (this.state === 'speaking' && !isSpeaking) {
        this.setState('listening');
      }
    };
  }

  public getState(): AssistantState {
    return this.state;
  }

  public getErrorMessage(): string {
    return this.errorMessage;
  }

  public setVoice(voice: VoiceName): void {
    this.voice = voice;
  }

  public getVoice(): VoiceName {
    return this.voice;
  }

  private setState(newState: AssistantState) {
    if (this.state !== newState) {
      this.state = newState;
      this.onStateChange?.(newState);
    }
  }

  /**
   * Connects to the Gemini Live session and starts audio streaming.
   */
  public async connect(): Promise<void> {
    if (this.state === 'connecting' || this.state === 'listening' || this.state === 'speaking') {
      return;
    }

    this.errorMessage = '';
    this.setState('connecting');

    try {
      // 1. Resume / initialize output audio context
      await this.streamer.resume();

      // 2. Request mic permission and start recording
      await this.recorder.start();

      // 3. Open WebSocket to backend Live proxy
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live?voice=${encodeURIComponent(this.voice)}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[LiveClient] WebSocket opened');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'connected') {
            console.log('[LiveClient] Session ready:', msg);
            this.setState('listening');
            this.onModelInfo?.({ model: msg.model, voice: msg.voice });
          } else if (msg.type === 'audio' && msg.data) {
            // Feed incoming 24kHz PCM16 chunk to streamer
            this.streamer.playChunk(msg.data);
          } else if (msg.type === 'interrupted') {
            console.log('[LiveClient] Interrupted received from server');
            this.streamer.interrupt();
            this.setState('listening');
          } else if (msg.type === 'turn_complete') {
            // Model finished turn, streamer will transition back to listening when buffer ends
          } else if (msg.type === 'tool_call') {
            console.log('[LiveClient] Tool call triggered:', msg.name, msg.args);
            this.onToolCall?.({
              id: msg.id,
              name: msg.name,
              args: msg.args || {}
            });
          } else if (msg.type === 'error') {
            console.error('[LiveClient] Error from server:', msg.message);
            this.errorMessage = msg.message;
            this.onError?.(msg.message);
            this.setState('error');
          } else if (msg.type === 'disconnected') {
            this.disconnect();
          }
        } catch (err) {
          console.error('[LiveClient] Failed to parse message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('[LiveClient] WebSocket error:', err);
        this.errorMessage = 'Network connection to Live session failed.';
        this.onError?.(this.errorMessage);
        this.setState('error');
      };

      this.ws.onclose = () => {
        console.log('[LiveClient] WebSocket closed');
        if (this.state !== 'disconnected' && this.state !== 'error') {
          this.disconnect();
        }
      };

      // 4. Hook microphone output to WebSocket input
      this.recorder.onAudioChunk = (base64Chunk: string) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'audio',
            data: base64Chunk
          }));
        }
      };

      this.recorder.onError = (err: Error) => {
        console.error('[LiveClient] Recorder error:', err);
        this.errorMessage = `Microphone error: ${err.message}`;
        this.onError?.(this.errorMessage);
        this.disconnect();
        this.setState('error');
      };

    } catch (err: any) {
      console.error('[LiveClient] Failed to start live session:', err);
      this.errorMessage = err?.message || 'Failed to access microphone or connect.';
      this.onError?.(this.errorMessage);
      this.disconnect();
      this.setState('error');
    }
  }

  /**
   * Disconnects the session and stops all audio.
   */
  public disconnect(): void {
    this.recorder.stop();
    this.streamer.interrupt();

    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
      } catch {}
      this.ws = null;
    }

    this.setState('disconnected');
  }

  public toggleMuteMic(): boolean {
    return this.recorder.toggleMute();
  }

  public isMicMuted(): boolean {
    return this.recorder.getIsMuted();
  }

  public setVolume(vol: number): void {
    this.streamer.setVolume(vol);
  }

  /**
   * Returns live frequency data and volume for UI visualizers.
   */
  public getVisualizerMetrics(): { frequencyData: Uint8Array; volume: number; activeSource: 'assistant' | 'user' | 'none' } {
    if (this.state === 'speaking') {
      const data = this.streamer.getFrequencyData();
      const vol = this.streamer.getAverageVolume();
      return { frequencyData: data, volume: vol, activeSource: 'assistant' };
    } else if (this.state === 'listening') {
      const data = this.recorder.getFrequencyData();
      const vol = this.recorder.getAverageVolume();
      return { frequencyData: data, volume: vol, activeSource: 'user' };
    }

    return {
      frequencyData: new Uint8Array(64),
      volume: 0,
      activeSource: 'none'
    };
  }

  public cleanup(): void {
    this.disconnect();
    this.streamer.close();
  }
}
