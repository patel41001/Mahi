import React, { useEffect, useState } from 'react';
import { ExternalLink, Timer, Sparkles, Sun, Clock, X, Play, Pause } from 'lucide-react';
import type { ActiveToolEvent, ActiveTimer } from '../types/assistant';

interface ToolActionBannerProps {
  activeTool: ActiveToolEvent | null;
  activeTimer: ActiveTimer | null;
  onClearTool: () => void;
  onUpdateTimer: (timer: ActiveTimer | null) => void;
  onOpenUrl: (url: string) => void;
}

export const ToolActionBanner: React.FC<ToolActionBannerProps> = ({
  activeTool,
  activeTimer,
  onClearTool,
  onUpdateTimer,
  onOpenUrl,
}) => {
  const [timerRemaining, setTimerRemaining] = useState<number>(0);

  // Sync and tick timer
  useEffect(() => {
    if (!activeTimer) {
      setTimerRemaining(0);
      return;
    }

    setTimerRemaining(activeTimer.remainingSeconds);

    if (!activeTimer.isRunning) return;

    const interval = window.setInterval(() => {
      setTimerRemaining((prev) => {
        if (prev <= 1) {
          // Play short chime audio
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
            osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.6);
          } catch {}

          onUpdateTimer({
            ...activeTimer,
            remainingSeconds: 0,
            isRunning: false,
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimer, onUpdateTimer]);

  // Auto-dismiss short informational tool calls after 8 seconds (except active timer)
  useEffect(() => {
    if (!activeTool || activeTool.name === 'setTimer') return;
    const timeout = setTimeout(() => {
      onClearTool();
    }, 8000);
    return () => clearTimeout(timeout);
  }, [activeTool, onClearTool]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-40 flex flex-col gap-2.5 pointer-events-none">
      {/* Active Timer Card */}
      {activeTimer && timerRemaining >= 0 && (
        <div className="pointer-events-auto bg-slate-900/90 border border-emerald-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Timer className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Mahi Timer · {activeTimer.label || 'Countdown'}
                </p>
                <p className="text-2xl font-mono font-bold text-white tracking-tight">
                  {formatTime(timerRemaining)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onUpdateTimer({
                    ...activeTimer,
                    isRunning: !activeTimer.isRunning,
                  });
                }}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                title={activeTimer.isRunning ? 'Pause' : 'Resume'}
              >
                {activeTimer.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>

              <button
                onClick={() => onUpdateTimer(null)}
                className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                title="Dismiss timer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full transition-all duration-1000 ease-linear rounded-full"
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, (timerRemaining / Math.max(1, activeTimer.durationSeconds)) * 100)
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Website Opened Card */}
      {activeTool && activeTool.name === 'openWebsite' && (
        <div className="pointer-events-auto bg-slate-900/90 border border-cyan-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ExternalLink className="w-5 h-5" />
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                Website Action
              </p>
              <p className="text-sm font-medium text-white truncate">
                {activeTool.args?.siteName || 'Opening Web Page'}
              </p>
              <p className="text-xs text-white/50 truncate font-mono">
                {activeTool.args?.url}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {activeTool.args?.url && (
              <button
                onClick={() => onOpenUrl(activeTool.args.url)}
                className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <span>Open</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClearTool}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Vibe Changed Notification */}
      {activeTool && activeTool.name === 'setAppVibe' && (
        <div className="pointer-events-auto bg-slate-900/90 border border-pink-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <Sparkles className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <p className="text-xs font-semibold text-pink-400 uppercase tracking-wider">
                Vibe Shifted
              </p>
              <p className="text-sm font-medium text-white">
                Mahi set theme to{' '}
                <span className="text-pink-300 font-semibold capitalize">
                  {String(activeTool.args?.vibe || '').replace('_', ' ')}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClearTool}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Flashlight Activated Notification */}
      {activeTool && activeTool.name === 'toggleFlashlight' && (
        <div className="pointer-events-auto bg-slate-900/90 border border-amber-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sun className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Spotlight Torch
              </p>
              <p className="text-sm font-medium text-white">
                Screen flashlight turned {activeTool.args?.enable ? 'ON' : 'OFF'}
              </p>
            </div>
          </div>
          <button
            onClick={onClearTool}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Time Checked Notification */}
      {activeTool && activeTool.name === 'getCurrentTime' && (
        <div className="pointer-events-auto bg-slate-900/90 border border-indigo-500/40 rounded-2xl p-4 shadow-xl backdrop-blur-xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Local Time
              </p>
              <p className="text-sm font-medium text-white">
                Mahi checked the current time
              </p>
            </div>
          </div>
          <button
            onClick={onClearTool}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
