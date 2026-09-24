import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Sparkles, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { LiveSession } from './services/LiveSession';
import { AudioOrb } from './components/AudioOrb';
import { VibeAtmosphere } from './components/VibeAtmosphere';
import { ToolActionBanner } from './components/ToolActionBanner';
import { VoiceIcebreakers } from './components/VoiceIcebreakers';
import { SettingsModal } from './components/SettingsModal';
import { FlashlightOverlay } from './components/FlashlightOverlay';
import { VIBE_CONFIGS } from './constants/vibes';
import type { AssistantState, AppVibe, VoiceName, ActiveToolEvent, ActiveTimer } from './types/assistant';

export default function App() {
  const [state, setState] = useState<AssistantState>('disconnected');
  const [currentVibe, setCurrentVibe] = useState<AppVibe>('cyberpunk_neon');
  const [currentVoice, setCurrentVoice] = useState<VoiceName>('Aoede');
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.9);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isFlashlightActive, setIsFlashlightActive] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<ActiveToolEvent | null>(null);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const liveSessionRef = useRef<LiveSession | null>(null);

  // Initialize LiveSession coordinator
  useEffect(() => {
    const session = new LiveSession({ voice: currentVoice });
    liveSessionRef.current = session;

    session.onStateChange = (newState) => {
      setState(newState);
      if (newState === 'error') {
        setErrorMessage(session.getErrorMessage() || 'An error occurred during live session.');
      } else if (newState === 'listening' || newState === 'speaking') {
        setErrorMessage('');
      }
    };

    session.onError = (msg) => {
      setErrorMessage(msg);
    };

    session.onToolCall = (call) => {
      const toolEvent: ActiveToolEvent = {
        id: call.id,
        name: call.name,
        args: call.args,
        timestamp: Date.now(),
      };
      setActiveTool(toolEvent);

      // Handle specific frontend side-effects
      if (call.name === 'openWebsite') {
        const url = call.args?.url;
        if (url) {
          try {
            // Attempt to open link directly in new window/tab
            window.open(url, '_blank', 'noopener,noreferrer');
          } catch (e) {
            console.warn('[ToolAction] Popup blocked, banner allows manual tap:', e);
          }
        }
      } else if (call.name === 'setAppVibe') {
        const vibe = call.args?.vibe as AppVibe;
        if (vibe && VIBE_CONFIGS[vibe]) {
          setCurrentVibe(vibe);
        }
      } else if (call.name === 'setTimer') {
        const seconds = Number(call.args?.seconds) || 60;
        const label = String(call.args?.label || 'Timer');
        setActiveTimer({
          id: call.id,
          durationSeconds: seconds,
          remainingSeconds: seconds,
          label,
          isRunning: true,
        });
      } else if (call.name === 'toggleFlashlight') {
        setIsFlashlightActive(Boolean(call.args?.enable));
      }
    };

    return () => {
      session.cleanup();
      liveSessionRef.current = null;
    };
  }, []);

  // Update voice if changed in settings
  const handleSelectVoice = (voice: VoiceName) => {
    setCurrentVoice(voice);
    if (liveSessionRef.current) {
      liveSessionRef.current.setVoice(voice);
      // If currently connected, reconnect with new voice
      if (state === 'listening' || state === 'speaking') {
        liveSessionRef.current.disconnect();
        setTimeout(() => {
          liveSessionRef.current?.connect();
        }, 300);
      }
    }
  };

  const handleToggleSession = async () => {
    if (!liveSessionRef.current) return;

    if (state === 'disconnected' || state === 'error') {
      setErrorMessage('');
      await liveSessionRef.current.connect();
    } else {
      liveSessionRef.current.disconnect();
    }
  };

  const handleToggleMicMute = () => {
    if (!liveSessionRef.current) return;
    const muted = liveSessionRef.current.toggleMuteMic();
    setIsMicMuted(muted);
  };

  const handleToggleAudioMute = () => {
    setIsAudioMuted((prev) => {
      const next = !prev;
      if (liveSessionRef.current) {
        liveSessionRef.current.setVolume(next ? 0 : volume);
      }
      return next;
    });
  };

  const handleChangeVolume = (vol: number) => {
    setVolume(vol);
    if (!isAudioMuted && liveSessionRef.current) {
      liveSessionRef.current.setVolume(vol);
    }
  };

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const getVisualizerMetrics = useCallback(() => {
    if (!liveSessionRef.current) {
      return {
        frequencyData: new Uint8Array(64),
        volume: 0,
        activeSource: 'none' as const,
      };
    }
    return liveSessionRef.current.getVisualizerMetrics();
  }, []);

  const activeVibeConfig = VIBE_CONFIGS[currentVibe] || VIBE_CONFIGS.cyberpunk_neon;

  return (
    <main className="relative min-h-[100dvh] w-full flex flex-col justify-between text-slate-100 overflow-x-hidden select-none">
      {/* Dynamic Aura Atmosphere */}
      <VibeAtmosphere vibe={activeVibeConfig} />

      {/* Screen Spotlight Flashlight Overlay */}
      <FlashlightOverlay
        isActive={isFlashlightActive}
        onDismiss={() => setIsFlashlightActive(false)}
      />

      {/* Interactive Tool Banner (Timers, Website Launches, Aura alerts) */}
      <ToolActionBanner
        activeTool={activeTool}
        activeTimer={activeTimer}
        onClearTool={() => setActiveTool(null)}
        onUpdateTimer={setActiveTimer}
        onOpenUrl={handleOpenUrl}
      />

      {/* Header Bar */}
      <header className="w-full max-w-5xl mx-auto px-4 py-4 sm:py-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span
              className="w-3 h-3 rounded-full block animate-pulse"
              style={{ background: activeVibeConfig.accentColor }}
            />
            <span
              className="absolute -inset-1 rounded-full opacity-60 blur-sm"
              style={{ background: activeVibeConfig.accentColor }}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-white/95 to-white/70">
                mahi
              </h1>
              <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-pink-300 border border-white/10">
                Live Voice
              </span>
            </div>
            <p className="text-[11px] text-white/50 tracking-wide">
              {activeVibeConfig.name} · {currentVoice}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Output Mute button */}
          <button
            onClick={handleToggleAudioMute}
            className="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95"
            title={isAudioMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Settings button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95"
            title="Assistant settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Core Voice Interface */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 z-20 py-6">
        {/* Dynamic Tagline */}
        <div className="text-center max-w-md mx-auto mb-6 px-2">
          <p className="text-sm sm:text-base font-medium text-white/90 leading-snug">
            {state === 'disconnected' && 'Confident, smart, and delightfully sassy.'}
            {state === 'connecting' && 'Establishing live audio link with Mahi...'}
            {state === 'listening' && 'Listening closely. Say whatever is on your mind.'}
            {state === 'speaking' && 'Mahi is speaking...'}
            {state === 'error' && 'Something interrupted the audio stream.'}
          </p>
          <p className="text-xs text-white/40 mt-1">
            {state === 'disconnected'
              ? 'Real-time voice-to-voice conversation. No typing needed.'
              : state === 'listening'
              ? 'Interrupt anytime by speaking aloud.'
              : state === 'speaking'
              ? 'Voice streaming at 24kHz with instant tool execution.'
              : ''}
          </p>
        </div>

        {/* Error Alert Banner if connection drops or mic denied */}
        {state === 'error' && errorMessage && (
          <div className="mb-6 max-w-md w-full p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-3 backdrop-blur-md">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-rose-300">Connection Error</p>
              <p className="text-[11px] text-rose-200/80">{errorMessage}</p>
            </div>
            <button
              onClick={handleToggleSession}
              className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-medium text-xs shrink-0 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Interactive Responsive Audio Orb */}
        <AudioOrb
          state={state}
          vibe={activeVibeConfig}
          isMicMuted={isMicMuted}
          onToggleSession={handleToggleSession}
          onToggleMute={handleToggleMicMute}
          getVisualizerMetrics={getVisualizerMetrics}
        />

        {/* Conversation Icebreakers & Tools showcase */}
        <VoiceIcebreakers isConnected={state === 'listening' || state === 'speaking'} />
      </section>

      {/* Footer Info Bar */}
      <footer className="w-full max-w-5xl mx-auto px-4 py-4 text-center z-20 flex flex-col sm:flex-row items-center justify-between text-xs text-white/40 gap-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Gemini Live Audio Engine · 16kHz in / 24kHz out</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span>Mahi Assistant</span>
          <span>·</span>
          <span>Voice-to-Voice AI</span>
          <span>·</span>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-pink-400 hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>Customize Vibe</span>
          </button>
        </div>
      </footer>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentVibe={currentVibe}
        onSelectVibe={setCurrentVibe}
        currentVoice={currentVoice}
        onSelectVoice={handleSelectVoice}
        volume={volume}
        onChangeVolume={handleChangeVolume}
      />
    </main>
  );
}
