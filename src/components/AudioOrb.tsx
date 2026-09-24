import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Sparkles, Radio } from 'lucide-react';
import type { AssistantState, VibeConfig } from '../types/assistant';

interface AudioOrbProps {
  state: AssistantState;
  vibe: VibeConfig;
  isMicMuted: boolean;
  onToggleSession: () => void;
  onToggleMute: () => void;
  getVisualizerMetrics: () => {
    frequencyData: Uint8Array;
    volume: number;
    activeSource: 'assistant' | 'user' | 'none';
  };
}

export const AudioOrb: React.FC<AudioOrbProps> = ({
  state,
  vibe,
  isMicMuted,
  onToggleSession,
  onToggleMute,
  getVisualizerMetrics,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = 86;

      ctx.clearRect(0, 0, width, height);

      const metrics = getVisualizerMetrics();
      const volume = metrics.volume;
      const freqData = metrics.frequencyData;
      phase += 0.04;

      // 1. Draw outer dynamic ripples
      if (state === 'speaking' || state === 'listening' || state === 'connecting') {
        const rippleCount = state === 'speaking' ? 3 : 2;
        const rippleColor = state === 'speaking' ? vibe.primaryGlow : vibe.secondaryGlow;

        for (let i = 0; i < rippleCount; i++) {
          const rippleRadius = baseRadius + 20 + i * 28 + Math.sin(phase + i) * (8 + volume * 50);
          ctx.beginPath();
          ctx.arc(centerX, centerY, Math.max(10, rippleRadius), 0, Math.PI * 2);
          ctx.strokeStyle = rippleColor;
          ctx.lineWidth = 1.5 + (1 - i / rippleCount) * (volume * 4);
          ctx.globalAlpha = Math.max(0.1, (1 - i / rippleCount) * 0.45 * (volume > 0.05 ? 1 : 0.6));
          ctx.stroke();
        }
      }

      // 2. Radial frequency spikes / petal equalizer
      if (freqData && freqData.length > 0 && (state === 'speaking' || state === 'listening')) {
        const barCount = 48;
        const step = (Math.PI * 2) / barCount;
        ctx.save();
        ctx.translate(centerX, centerY);

        for (let i = 0; i < barCount; i++) {
          const freqIndex = Math.floor((i / barCount) * Math.min(32, freqData.length));
          const normalizedVal = (freqData[freqIndex] || 0) / 255;
          const barHeight = Math.max(4, normalizedVal * 42 + volume * 25);
          const angle = i * step + (state === 'speaking' ? phase * 0.3 : 0);

          const x1 = Math.cos(angle) * (baseRadius + 4);
          const y1 = Math.sin(angle) * (baseRadius + 4);
          const x2 = Math.cos(angle) * (baseRadius + 4 + barHeight);
          const y2 = Math.sin(angle) * (baseRadius + 4 + barHeight);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = state === 'speaking' ? vibe.accentColor : vibe.waveformColor;
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.globalAlpha = Math.max(0.25, normalizedVal * 0.95);
          ctx.stroke();
        }
        ctx.restore();
      }

      ctx.globalAlpha = 1.0;
      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state, vibe, getVisualizerMetrics]);

  // Determine state labels and glow styles
  const isConnected = state === 'listening' || state === 'speaking';
  const isConnecting = state === 'connecting';

  let statusText = 'Tap to call Mahi';
  let statusBadgeClass = 'text-white/60 bg-white/5 border-white/10';
  let orbCoreClass = 'scale-100 shadow-[0_0_40px_rgba(255,255,255,0.08)]';

  if (state === 'connecting') {
    statusText = 'Connecting with Mahi...';
    statusBadgeClass = 'text-cyan-400 bg-cyan-950/40 border-cyan-500/30 animate-pulse';
    orbCoreClass = 'scale-105 shadow-[0_0_50px_rgba(6,182,212,0.4)] animate-pulse';
  } else if (state === 'speaking') {
    statusText = 'Mahi is speaking...';
    statusBadgeClass = 'text-pink-400 bg-pink-950/50 border-pink-500/40 animate-pulse';
    orbCoreClass = 'scale-110 shadow-[0_0_80px_rgba(236,72,153,0.6)]';
  } else if (state === 'listening') {
    statusText = isMicMuted ? 'Muted (Tap mic to unmute)' : 'Listening to you...';
    statusBadgeClass = isMicMuted
      ? 'text-amber-400 bg-amber-950/40 border-amber-500/30'
      : 'text-cyan-300 bg-cyan-950/40 border-cyan-500/30';
    orbCoreClass = 'scale-105 shadow-[0_0_60px_rgba(56,189,248,0.4)]';
  } else if (state === 'error') {
    statusText = 'Connection failed · Tap to retry';
    statusBadgeClass = 'text-rose-400 bg-rose-950/40 border-rose-500/30';
    orbCoreClass = 'scale-100 shadow-[0_0_30px_rgba(244,63,94,0.3)]';
  }

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* Canvas for dynamic audio reactive waves and radial spectrum */}
      <div className="relative w-80 h-80 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="absolute inset-0 pointer-events-none z-0"
        />

        {/* Ambient atmospheric aura halo */}
        <div
          className="absolute inset-4 rounded-full filter blur-2xl transition-all duration-700 opacity-60 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${vibe.primaryGlow} 0%, ${vibe.secondaryGlow} 60%, transparent 80%)`,
            transform: state === 'speaking' ? 'scale(1.25)' : state === 'listening' ? 'scale(1.1)' : 'scale(0.95)',
          }}
        />

        {/* Rotating Orbital tech ring */}
        <div
          className={`absolute w-60 h-60 rounded-full border border-dashed border-white/20 pointer-events-none transition-all duration-1000 ${
            isConnected ? 'animate-[spin_24s_linear_infinite] opacity-60' : 'opacity-20'
          }`}
        />
        <div
          className={`absolute w-72 h-72 rounded-full border border-dotted border-white/10 pointer-events-none transition-all duration-1000 ${
            state === 'speaking'
              ? 'animate-[spin_12s_linear_infinite_reverse] opacity-50'
              : 'opacity-10'
          }`}
        />

        {/* Central Core Interactive Orb Button */}
        <button
          onClick={onToggleSession}
          aria-label={isConnected ? 'End voice call with Mahi' : 'Start voice call with Mahi'}
          className={`group relative z-10 w-44 h-44 rounded-full flex flex-col items-center justify-center transition-all duration-500 cursor-pointer overflow-hidden border border-white/20 active:scale-95 ${orbCoreClass}`}
          style={{
            background: `linear-gradient(135deg, ${vibe.orbGradient[0]}, ${vibe.orbGradient[1]}, ${vibe.orbGradient[2]})`,
          }}
        >
          {/* Glass reflection highlight */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-black/30 pointer-events-none" />

          {/* Fluid shimmering aura inside orb */}
          <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/40 via-transparent to-transparent pointer-events-none" />

          {/* Core Icon & Visual Cue */}
          <div className="relative z-20 flex flex-col items-center justify-center gap-1.5 text-white">
            {state === 'disconnected' && (
              <>
                <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                  <Mic className="w-7 h-7 text-white drop-shadow-md" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-white/90 drop-shadow">
                  Start Call
                </span>
              </>
            )}

            {isConnecting && (
              <>
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center animate-spin">
                  <Radio className="w-7 h-7 text-white" />
                </div>
                <span className="text-xs font-medium uppercase tracking-wider text-white/90">
                  Connecting
                </span>
              </>
            )}

            {state === 'listening' && (
              <>
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:bg-rose-500/80 transition-colors">
                  {isMicMuted ? (
                    <MicOff className="w-7 h-7 text-amber-300" />
                  ) : (
                    <Mic className="w-7 h-7 text-white animate-pulse" />
                  )}
                </div>
                <span className="text-xs font-medium tracking-wide text-white/90 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  {isMicMuted ? 'Muted' : 'Listening'}
                </span>
              </>
            )}

            {state === 'speaking' && (
              <>
                <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:bg-rose-500/80 transition-colors">
                  <Sparkles className="w-7 h-7 text-white animate-bounce" />
                </div>
                <span className="text-xs font-medium tracking-wide text-white/90 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
                  Speaking
                </span>
              </>
            )}

            {state === 'error' && (
              <>
                <div className="w-14 h-14 rounded-full bg-rose-600/60 backdrop-blur-md flex items-center justify-center">
                  <PhoneOff className="w-7 h-7 text-white" />
                </div>
                <span className="text-xs font-medium uppercase tracking-wider text-white/90">
                  Retry
                </span>
              </>
            )}
          </div>
        </button>
      </div>

      {/* Floating Status & Controls Pill */}
      <div className="mt-4 flex flex-col items-center gap-3 z-10">
        {/* Status Pill */}
        <div
          className={`px-4 py-1.5 rounded-full border text-xs font-medium tracking-wide flex items-center gap-2 backdrop-blur-md shadow-sm transition-all ${statusBadgeClass}`}
        >
          {isConnected && (
            <span
              className={`w-2 h-2 rounded-full ${
                state === 'speaking'
                  ? 'bg-pink-400 animate-ping'
                  : isMicMuted
                  ? 'bg-amber-400'
                  : 'bg-emerald-400 animate-pulse'
              }`}
            />
          )}
          <span>{statusText}</span>
        </div>

        {/* In-Call Quick Controls (Mute Mic & End Call) */}
        {isConnected && (
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMute();
              }}
              className={`px-3 py-1.5 rounded-full border text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-all ${
                isMicMuted
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/15'
              }`}
            >
              {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              <span>{isMicMuted ? 'Unmute' : 'Mute Mic'}</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSession();
              }}
              className="px-3 py-1.5 rounded-full border border-rose-500/30 bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-medium flex items-center gap-1.5 backdrop-blur-md transition-all"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>End Call</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
