import React from 'react';
import { X, Volume2, Sparkles, Check, Mic, User } from 'lucide-react';
import type { AppVibe, VoiceName } from '../types/assistant';
import { VIBE_CONFIGS } from '../constants/vibes';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVibe: AppVibe;
  onSelectVibe: (vibe: AppVibe) => void;
  currentVoice: VoiceName;
  onSelectVoice: (voice: VoiceName) => void;
  volume: number;
  onChangeVolume: (vol: number) => void;
}

const VOICES: { id: VoiceName; name: string; desc: string; persona: string }[] = [
  { id: 'Aoede', name: 'Aoede', desc: 'Vibrant, sassy, and bold', persona: 'Recommended for Mahi' },
  { id: 'Kore', name: 'Kore', desc: 'Warm, sweet, and playful', persona: 'Close friend energy' },
  { id: 'Puck', name: 'Puck', desc: 'Energetic and cheeky', persona: 'Playful banter' },
  { id: 'Zephyr', name: 'Zephyr', desc: 'Smooth, calm, and suave', persona: 'Relaxed charm' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentVibe,
  onSelectVibe,
  currentVoice,
  onSelectVoice,
  volume,
  onChangeVolume,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md transition-opacity"
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-slate-900/95 border border-white/15 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl text-white max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Mahi Assistant Settings</h2>
              <p className="text-xs text-white/50">Voice persona, aura vibes & audio</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-6">
          {/* Persona Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 border border-pink-500/20">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pink-400 mb-1">
              <User className="w-3.5 h-3.5" />
              <span>Persona Demeanor</span>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">
              Young, confident, witty, and playfully sassy companion. Casual girlfriend banter with smart one-liners, emotional responsiveness, and instant tool execution.
            </p>
          </div>

          {/* Voice Model Selection */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60 mb-2.5">
              <Mic className="w-3.5 h-3.5 text-pink-400" />
              <span>Voice Preset</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VOICES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => onSelectVoice(v.id)}
                  className={`p-3 rounded-2xl border text-left flex items-start justify-between transition-all ${
                    currentVoice === v.id
                      ? 'bg-pink-500/20 border-pink-500/50 shadow-md shadow-pink-500/10'
                      : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white">{v.name}</span>
                      {currentVoice === v.id && (
                        <Check className="w-3.5 h-3.5 text-pink-400 ml-1" />
                      )}
                    </div>
                    <p className="text-xs text-white/60 mt-0.5">{v.desc}</p>
                    <span className="text-[10px] text-pink-400/80 font-medium block mt-1">
                      {v.persona}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Vibe Selection */}
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Aura & Vibe Lighting</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.values(VIBE_CONFIGS).map((v) => (
                <button
                  key={v.id}
                  onClick={() => onSelectVibe(v.id)}
                  className={`p-2.5 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                    currentVibe === v.id
                      ? 'bg-white/15 border-white/40 shadow-md'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.08]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{
                        background: `linear-gradient(135deg, ${v.orbGradient[0]}, ${v.orbGradient[1]})`,
                      }}
                    />
                    <span className="text-xs font-medium text-white truncate">{v.name}</span>
                  </div>
                  <span className="text-[10px] text-white/50 truncate">{v.tagline}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Output Volume */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mahi Voice Volume</span>
              </label>
              <span className="text-xs font-mono text-white/60">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-pink-500"
            />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white text-slate-900 hover:bg-white/90 font-medium text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
