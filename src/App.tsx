import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, Sparkles, Volume2, VolumeX, ShieldAlert, Phone, PhoneOff, Mic, MicOff, Heart, Radio, User } from 'lucide-react';
import { LiveSession } from './services/LiveSession';
import { AudioOrb } from './components/AudioOrb';
import { MahiCharacter3D } from './components/MahiCharacter3D';
import { VibeAtmosphere } from './components/VibeAtmosphere';
import { ToolActionBanner } from './components/ToolActionBanner';
import { VoiceIcebreakers } from './components/VoiceIcebreakers';
import { SettingsModal } from './components/SettingsModal';
import { FlashlightOverlay } from './components/FlashlightOverlay';
import { VIBE_CONFIGS } from './constants/vibes';
import type { AssistantState, AppVibe, VoiceName, ActiveToolEvent, ActiveTimer } from './types/assistant';

type DisplayMode = '3d_avatar' | 'orb';

export default function App() {
  const [state, setState] = useState<AssistantState>('disconnected');
  const [currentVibe, setCurrentVibe] = useState<AppVibe>('cyberpunk_neon');
  const [currentVoice, setCurrentVoice] = useState<VoiceName>('Kore');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('3d_avatar');
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

  const getSpeechVisemeMetrics = useCallback(() => {
    if (!liveSessionRef.current) {
      return {
        isSpeaking: false,
        volume: 0,
        jawOpen: 0,
        mouthSpread: 0,
        teethReveal: 0,
      };
    }
    return liveSessionRef.current.getSpeechVisemeMetrics();
  }, []);

  const activeVibeConfig = VIBE_CONFIGS[currentVibe] || VIBE_CONFIGS.cyberpunk_neon;
  const isConnected = state === 'listening' || state === 'speaking';
  const isConnecting = state === 'connecting';

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
      <header className="w-full max-w-5xl mx-auto px-4 py-3 sm:py-5 flex items-center justify-between z-30">
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
                3D Live
              </span>
            </div>
            <p className="text-[11px] text-white/50 tracking-wide">
              {activeVibeConfig.name} · {currentVoice}
            </p>
          </div>
        </div>

        {/* View Mode & Control Buttons */}
        <div className="flex items-center gap-2">
          {/* Toggle 3D Avatar vs Orb */}
          <div className="flex items-center p-1 rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-md">
            <button
              onClick={() => setDisplayMode('3d_avatar')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                displayMode === '3d_avatar'
                  ? 'bg-white/20 text-white shadow-sm font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">3D Character</span>
            </button>
            <button
              onClick={() => setDisplayMode('orb')}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1 ${
                displayMode === 'orb'
                  ? 'bg-white/20 text-white shadow-sm font-semibold'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Orb</span>
            </button>
          </div>

          {/* Audio Output Mute button */}
          <button
            onClick={handleToggleAudioMute}
            className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95"
            title={isAudioMuted ? 'Unmute audio' : 'Mute audio'}
          >
            {isAudioMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Settings button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all active:scale-95"
            title="Assistant settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Core Voice Interface */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 z-20 py-2 sm:py-4">
        {/* Dynamic Tagline */}
        <div className="text-center max-w-md mx-auto mb-4 px-2">
          <p className="text-sm sm:text-base font-medium text-white/90 leading-snug">
            {state === 'disconnected' && 'Your realistic, witty, and playfully sassy 3D AI girlfriend.'}
            {state === 'connecting' && 'Establishing live audio neural link with Mahi...'}
            {state === 'listening' && 'Mahi is listening to you... speak freely.'}
            {state === 'speaking' && 'Mahi is speaking in real-time...'}
            {state === 'error' && 'Audio connection interrupted.'}
          </p>
          <p className="text-xs text-white/40 mt-0.5">
            {state === 'disconnected'
              ? 'Real-time voice-to-voice conversation. No typing needed.'
              : state === 'listening'
              ? 'Interrupt anytime by talking aloud.'
              : state === 'speaking'
              ? 'Voice streaming at 24kHz with instant tool execution.'
              : ''}
          </p>
        </div>

        {/* Error Alert Banner */}
        {state === 'error' && errorMessage && (
          <div className="mb-4 max-w-md w-full p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-3 backdrop-blur-md">
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

        {/* Center Presentation: 3D Character Mode or Orb Mode */}
        {displayMode === '3d_avatar' ? (
          <div className="flex flex-col items-center gap-4">
            {/* Realistic 3D Character with Parallax & Dynamics */}
            <MahiCharacter3D
              state={state}
              vibe={activeVibeConfig}
              isMicMuted={isMicMuted}
              getVisualizerMetrics={getVisualizerMetrics}
              getSpeechVisemeMetrics={getSpeechVisemeMetrics}
            />

            {/* In-Call Action Control Bar */}
            <div className="flex flex-col items-center gap-2.5 z-30">
              {/* Call Control Button */}
              <div className="flex items-center gap-3">
                {isConnected && (
                  <button
                    onClick={handleToggleMicMute}
                    className={`p-3 rounded-full border text-xs font-medium flex items-center justify-center backdrop-blur-md transition-all active:scale-95 shadow-lg ${
                      isMicMuted
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                        : 'bg-white/10 border-white/20 text-white hover:bg-white/15'
                    }`}
                    title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                  >
                    {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>
                )}

                <button
                  onClick={handleToggleSession}
                  className={`px-6 py-3 rounded-full font-semibold text-sm flex items-center gap-2.5 transition-all duration-300 active:scale-95 shadow-xl border cursor-pointer ${
                    isConnected
                      ? 'bg-rose-600/90 hover:bg-rose-500 border-rose-400/40 text-white shadow-rose-900/40'
                      : isConnecting
                      ? 'bg-cyan-600/90 hover:bg-cyan-500 border-cyan-400/40 text-white animate-pulse shadow-cyan-900/40'
                      : 'border-white/25 text-white hover:brightness-110 shadow-pink-900/30 hover:scale-105'
                  }`}
                  style={
                    !isConnected && !isConnecting
                      ? {
                          background: `linear-gradient(135deg, ${activeVibeConfig.orbGradient[0]}, ${activeVibeConfig.orbGradient[1]})`,
                        }
                      : undefined
                  }
                >
                  {isConnected ? (
                    <>
                      <PhoneOff className="w-4 h-4" />
                      <span>End Call with Mahi</span>
                    </>
                  ) : isConnecting ? (
                    <>
                      <Radio className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4" />
                      <span>Start Voice Call</span>
                    </>
                  )}
                </button>

                {isConnected && (
                  <button
                    onClick={() => {
                      // Trigger playful audio reaction by asking in character
                      if (liveSessionRef.current) {
                        // Flirty wink trigger visual
                        const target = document.querySelector('[title="Tap Mahi for a playful reaction"]');
                        if (target) (target as HTMLElement).click();
                      }
                    }}
                    className="p-3 rounded-full border border-pink-500/30 bg-pink-500/15 text-pink-300 hover:bg-pink-500/25 flex items-center justify-center transition-all active:scale-95 shadow-lg"
                    title="Send a playful wink to Mahi"
                  >
                    <Heart className="w-5 h-5 fill-pink-400/40" />
                  </button>
                )}
              </div>

              {/* Status Badge */}
              <div className="flex items-center gap-2 text-xs font-medium text-white/70 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    state === 'speaking'
                      ? 'bg-pink-400 animate-ping'
                      : state === 'listening'
                      ? isMicMuted
                        ? 'bg-amber-400'
                        : 'bg-emerald-400 animate-pulse'
                      : state === 'connecting'
                      ? 'bg-cyan-400 animate-ping'
                      : 'bg-white/40'
                  }`}
                />
                <span>
                  {state === 'speaking'
                    ? 'Mahi is speaking live'
                    : state === 'listening'
                    ? isMicMuted
                      ? 'Microphone muted'
                      : 'Listening to your voice...'
                    : state === 'connecting'
                    ? 'Connecting...'
                    : 'Tap "Start Voice Call" to talk'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Classic Interactive Audio Orb View */
          <AudioOrb
            state={state}
            vibe={activeVibeConfig}
            isMicMuted={isMicMuted}
            onToggleSession={handleToggleSession}
            onToggleMute={handleToggleMicMute}
            getVisualizerMetrics={getVisualizerMetrics}
          />
        )}

        {/* Conversation Icebreakers & Tools showcase */}
        <VoiceIcebreakers isConnected={isConnected} />
      </section>

      {/* Footer Info Bar */}
      <footer className="w-full max-w-5xl mx-auto px-4 py-3 text-center z-20 flex flex-col sm:flex-row items-center justify-between text-xs text-white/40 gap-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Realistic 3D Persona · Gemini Live Audio Engine (16kHz / 24kHz)</span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span>Mahi Assistant</span>
          <span>·</span>
          <span>3D Voice Companion</span>
          <span>·</span>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-pink-400 hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>Settings & Vibes</span>
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
