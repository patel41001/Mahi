import React from 'react';
import { MessageSquareQuote, Sparkles } from 'lucide-react';

interface VoiceIcebreakersProps {
  onSelectPrompt?: (text: string) => void;
  isConnected: boolean;
}

const ICEBREAKERS = [
  { text: "Hey Mahi, roast me a little", tag: "Flirty banter" },
  { text: "Open Spotify for me", tag: "Browser Action" },
  { text: "Change your vibe to Romantic Rose", tag: "Aura Switch" },
  { text: "Set a 3-minute tea timer", tag: "Tool Call" },
  { text: "What's the tea with you today?", tag: "Casual Chat" },
  { text: "Give me your boldest hot take", tag: "Witty" },
];

export const VoiceIcebreakers: React.FC<VoiceIcebreakersProps> = ({ isConnected }) => {
  return (
    <div className="w-full max-w-xl mx-auto px-4 mt-8 select-none">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
          <MessageSquareQuote className="w-3.5 h-3.5 text-pink-400" />
          <span>Things you can say to Mahi</span>
        </div>
        <span className="text-[11px] text-white/40 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-pink-400/80" />
          Real-time Spoken Voice
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ICEBREAKERS.map((item, idx) => (
          <div
            key={idx}
            className="group px-3.5 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all backdrop-blur-md flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs text-white/90 font-medium group-hover:text-white leading-relaxed">
                "{item.text}"
              </span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-white/40">
              <span>{item.tag}</span>
              {isConnected && (
                <>
                  <span>·</span>
                  <span className="text-pink-400/80 group-hover:text-pink-300">Just speak it aloud</span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
