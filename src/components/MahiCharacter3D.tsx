import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Radio, Eye, Heart, MessageSquare } from 'lucide-react';
import type { AssistantState, VibeConfig } from '../types/assistant';
import type { SpeechVisemeMetrics } from '../services/AudioStreamer';

import mahiIdleImg from '../assets/images/mahi_3d_idle_1790255405795.jpg';
import mahiListeningImg from '../assets/images/mahi_3d_listening_1790255422149.jpg';
import mahiSpeakingImg from '../assets/images/mahi_3d_speaking_1790255433906.jpg';
import mahiFlirtyImg from '../assets/images/mahi_3d_flirty_1790255447399.jpg';

interface MahiCharacter3DProps {
  state: AssistantState;
  vibe: VibeConfig;
  isMicMuted: boolean;
  getVisualizerMetrics: () => {
    frequencyData: Uint8Array;
    volume: number;
    activeSource: 'assistant' | 'user' | 'none';
  };
  getSpeechVisemeMetrics?: () => SpeechVisemeMetrics;
}

export const MahiCharacter3D: React.FC<MahiCharacter3DProps> = ({
  state,
  vibe,
  isMicMuted,
  getVisualizerMetrics,
  getSpeechVisemeMetrics,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rotate, setRotate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Eyelid blinking physics states
  const [leftBlinkProgress, setLeftBlinkProgress] = useState(0);   // 0 = open, 1 = closed
  const [rightBlinkProgress, setRightBlinkProgress] = useState(0); // 0 = open, 1 = closed
  const [isWinking, setIsWinking] = useState(false);
  
  // Real-time lip-sync metrics
  const [jawOpen, setJawOpen] = useState(0);       // 0 to 1
  const [mouthSpread, setMouthSpread] = useState(0); // -0.4 to 0.7
  const [teethReveal, setTeethReveal] = useState(0); // 0 to 1
  const [speechVolume, setSpeechVolume] = useState(0); // 0 to 1
  
  // Character subtle organic body dynamics
  const [headNod, setHeadNod] = useState(0);
  const [audioScale, setAudioScale] = useState(1);
  const [audioGlow, setAudioGlow] = useState(0.4);
  const [heartParticles, setHeartParticles] = useState<{ id: number; x: number; y: number }[]>([]);

  const animationFrameRef = useRef<number | null>(null);

  // 1. Realistic Human Eye Blinking Cycle (with natural random intervals and double-blinks)
  useEffect(() => {
    let timeoutId: number;
    let isCancelled = false;

    const performBlink = (isDouble = false) => {
      if (isCancelled || isWinking) return;

      const startTime = performance.now();
      const blinkDuration = 150; // ms

      const step = (now: number) => {
        if (isCancelled || isWinking) return;
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / blinkDuration);

        // Sinusoidal blink curve: 0 -> 1 -> 0
        const blinkVal = Math.sin(progress * Math.PI);
        setLeftBlinkProgress(blinkVal);
        setRightBlinkProgress(blinkVal);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          setLeftBlinkProgress(0);
          setRightBlinkProgress(0);

          if (isDouble) {
            // Second blink in double-blink combo
            timeoutId = window.setTimeout(() => {
              performBlink(false);
            }, 60);
          } else {
            // Schedule next natural blink (every 2.6s - 4.8s)
            const nextInterval = Math.random() * 2200 + 2600;
            const willDouble = Math.random() < 0.22; // 22% chance of human double-blink
            timeoutId = window.setTimeout(() => performBlink(willDouble), nextInterval);
          }
        }
      };

      requestAnimationFrame(step);
    };

    timeoutId = window.setTimeout(() => performBlink(false), 2000);

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isWinking]);

  // 2. Interactive 3D mouse parallax tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setRotate({ x: -y * 12, y: x * 16 });
  };

  const handleMouseLeave = () => {
    setRotate({ x: 0, y: 0 });
  };

  // 3. Real-Time Lip-Sync & Viseme Interpolation Loop (60 FPS)
  useEffect(() => {
    let lastTime = performance.now();

    const updateDynamics = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      // Extract real-time speech viseme metrics
      let targetJaw = 0;
      let targetSpread = 0;
      let targetTeeth = 0;
      let targetVol = 0;

      if (state === 'speaking') {
        if (getSpeechVisemeMetrics) {
          const m = getSpeechVisemeMetrics();
          targetJaw = m.jawOpen;
          targetSpread = m.mouthSpread;
          targetTeeth = m.teethReveal;
          targetVol = m.volume;
        } else {
          // Fallback from visualizer metrics
          const metrics = getVisualizerMetrics();
          targetVol = metrics.volume;
          targetJaw = Math.min(1.0, metrics.volume * 1.6);
          targetSpread = 0.2;
          targetTeeth = metrics.volume > 0.3 ? 0.6 : 0.1;
        }

        // Conversational head nod / tilt modulation
        const nod = Math.sin(now * 0.006) * (targetJaw * 2.2);
        setHeadNod(nod);

        setAudioScale(1 + Math.min(0.04, targetVol * 0.12));
        setAudioGlow(0.45 + Math.min(0.55, targetVol * 1.2));
      } else if (state === 'listening') {
        const metrics = getVisualizerMetrics();
        targetVol = metrics.volume;
        setAudioScale(1 + Math.min(0.02, targetVol * 0.05));
        setAudioGlow(0.35 + Math.min(0.3, targetVol * 0.8));
        setHeadNod(Math.sin(now * 0.002) * 0.6); // Subtle listening head tilt
      } else {
        setAudioScale(1);
        setAudioGlow(0.35);
        setHeadNod(0);
      }

      // Smooth physics lerp interpolation for natural lip movement
      const lerpSpeed = 22; // Quick responsive mouth tracking
      const alpha = Math.min(1, dt * lerpSpeed);

      setJawOpen((prev) => prev + (targetJaw - prev) * alpha);
      setMouthSpread((prev) => prev + (targetSpread - prev) * alpha);
      setTeethReveal((prev) => prev + (targetTeeth - prev) * alpha);
      setSpeechVolume((prev) => prev + (targetVol - prev) * alpha);

      animationFrameRef.current = requestAnimationFrame(updateDynamics);
    };

    animationFrameRef.current = requestAnimationFrame(updateDynamics);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state, getVisualizerMetrics, getSpeechVisemeMetrics]);

  // Handle sassy tap easter egg: playful wink + floating hearts
  const handleCharacterTap = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsWinking(true);
    setRightBlinkProgress(1); // Winks right eye shut
    setLeftBlinkProgress(0.15); // Cute slight squint on left eye

    // Add floating heart particle
    const rect = e.currentTarget.getBoundingClientRect();
    const particleX = e.clientX - rect.left;
    const particleY = e.clientY - rect.top;
    const newId = Date.now();
    setHeartParticles((prev) => [...prev, { id: newId, x: particleX, y: particleY }]);

    setTimeout(() => {
      setHeartParticles((prev) => prev.filter((p) => p.id !== newId));
    }, 1800);

    setTimeout(() => {
      setIsWinking(false);
      setRightBlinkProgress(0);
      setLeftBlinkProgress(0);
    }, 1600);
  };

  // Determine active character pose image
  let currentImage = mahiIdleImg;
  let expressionTag = 'Relaxed & Sassy';

  if (isWinking) {
    currentImage = mahiFlirtyImg;
    expressionTag = 'Playful Wink ;)';
  } else if (state === 'speaking') {
    currentImage = mahiSpeakingImg;
    expressionTag = 'Talking Live · Lip-Sync Active';
  } else if (state === 'listening') {
    currentImage = mahiListeningImg;
    expressionTag = isMicMuted ? 'Microphone Muted' : 'Attentive & Listening';
  } else if (state === 'connecting') {
    currentImage = mahiListeningImg;
    expressionTag = 'Connecting Voice Link...';
  }

  // Calculate dynamic mouth geometry for realistic SVG lip-sync overlay
  // Lips are centered horizontally at ~48.5% and vertically at ~61.5% of avatar card
  const mouthWidthPx = 54 + mouthSpread * 14;   // Expands with 'ee'/'ai', narrows with 'oo'
  const mouthOpenPx = jawOpen * 22;             // Vertical separation of lips
  const teethHeightPx = Math.min(12, teethReveal * 10 + jawOpen * 4);
  const jawDropPx = jawOpen * 3.5;              // Subtle chin movement

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleCharacterTap}
      className="relative flex flex-col items-center justify-center cursor-pointer select-none group"
      style={{ perspective: '1000px' }}
      title="Tap Mahi for a playful reaction"
    >
      {/* Floating Heart Particles on Interaction */}
      {heartParticles.map((particle) => (
        <div
          key={particle.id}
          className="absolute z-50 pointer-events-none animate-[ping_1.6s_ease-out_forwards] flex items-center gap-1 text-pink-400 font-semibold text-xs drop-shadow-lg"
          style={{ left: particle.x - 12, top: particle.y - 20 }}
        >
          <Heart className="w-5 h-5 fill-pink-400 text-pink-300 drop-shadow-md" />
        </div>
      ))}

      {/* 3D Character Card Frame */}
      <div
        className="relative w-64 sm:w-72 h-80 sm:h-92 rounded-3xl p-1.5 transition-transform duration-150 ease-out"
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y + headNod}deg) scale(${audioScale})`,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Holographic rim light & outer aura glow */}
        <div
          className="absolute inset-0 rounded-3xl filter blur-xl transition-all duration-700 pointer-events-none -z-10"
          style={{
            background: `radial-gradient(circle, ${vibe.primaryGlow} 0%, ${vibe.secondaryGlow} 60%, transparent 80%)`,
            opacity: audioGlow,
            transform: 'translateZ(-30px)',
          }}
        />

        {/* Outer futuristic glass border */}
        <div
          className="relative w-full h-full rounded-[22px] overflow-hidden border border-white/20 shadow-2xl bg-slate-950/85 backdrop-blur-md transition-shadow duration-500"
          style={{
            boxShadow: `0 20px 50px -10px ${vibe.primaryGlow}, inset 0 0 20px rgba(255,255,255,0.08)`,
          }}
        >
          {/* 3D Character Avatar Image & Dynamic Face Overlays */}
          <div className="relative w-full h-full overflow-hidden">
            {/* Base Character Image with micro-breathing motion */}
            <img
              src={currentImage}
              alt="Mahi 3D Digital Avatar"
              referrerPolicy="no-referrer"
              className={`w-full h-full object-cover object-center transition-all duration-300 will-change-transform ${
                state === 'speaking'
                  ? 'animate-[pulse_2.8s_ease-in-out_infinite]'
                  : 'animate-[bounce_7s_ease-in-out_infinite]'
              }`}
              style={{
                filter: state === 'speaking' ? 'contrast(1.04) brightness(1.02)' : 'none',
              }}
            />

            {/* ================================================================ */}
            {/* REALISTIC ANATOMICAL EYE BLINKING OVERLAYS                       */}
            {/* Left & Right upper and lower eyelids smoothly sweep down         */}
            {/* ================================================================ */}

            {/* Left Eyelid (Viewer's Left Eye) */}
            <div
              className="absolute pointer-events-none overflow-hidden rounded-[50%]"
              style={{
                top: '41.6%',
                left: '42.0%',
                width: '9.8%',
                height: '5.8%',
                transform: `scaleY(${leftBlinkProgress})`,
                transformOrigin: 'top center',
                opacity: leftBlinkProgress > 0.05 ? 1 : 0,
                transition: 'opacity 40ms linear',
                zIndex: 15,
              }}
            >
              {/* Natural Skin Tone Eyelid Gradient & Lash Rim */}
              <div
                className="w-full h-full rounded-[50%] border-b border-[#24130e]"
                style={{
                  background: 'linear-gradient(to bottom, #ca9683 0%, #b8816e 55%, #925844 90%, #3d2017 100%)',
                  boxShadow: 'inset 0 -1.5px 3px rgba(35, 15, 10, 0.7), 0 1px 2px rgba(0,0,0,0.35)',
                }}
              />
            </div>

            {/* Right Eyelid (Viewer's Right Eye) */}
            <div
              className="absolute pointer-events-none overflow-hidden rounded-[50%]"
              style={{
                top: '41.8%',
                left: '54.2%',
                width: '9.8%',
                height: '5.8%',
                transform: `scaleY(${rightBlinkProgress})`,
                transformOrigin: 'top center',
                opacity: rightBlinkProgress > 0.05 ? 1 : 0,
                transition: 'opacity 40ms linear',
                zIndex: 15,
              }}
            >
              {/* Natural Skin Tone Eyelid Gradient & Lash Rim */}
              <div
                className="w-full h-full rounded-[50%] border-b border-[#24130e]"
                style={{
                  background: 'linear-gradient(to bottom, #ca9683 0%, #b8816e 55%, #925844 90%, #3d2017 100%)',
                  boxShadow: 'inset 0 -1.5px 3px rgba(35, 15, 10, 0.7), 0 1px 2px rgba(0,0,0,0.35)',
                }}
              />
            </div>

            {/* ================================================================ */}
            {/* REAL-TIME DYNAMIC LIP-SYNC & VISEME MOUTH ENGINE                  */}
            {/* Renders dynamic lips, oral cavity, teeth & subtle jaw movement   */}
            {/* ================================================================ */}
            {state === 'speaking' && (
              <div
                className="absolute pointer-events-none transition-transform duration-75 ease-out"
                style={{
                  top: '61.2%',
                  left: '48.6%',
                  transform: `translate(-50%, -50%) translateY(${jawDropPx}px)`,
                  width: `${mouthWidthPx}px`,
                  height: `${36 + mouthOpenPx}px`,
                  zIndex: 16,
                }}
              >
                <svg
                  viewBox="0 0 100 60"
                  className="w-full h-full drop-shadow-sm filter"
                  style={{ overflow: 'visible' }}
                >
                  <defs>
                    {/* Natural Inner Mouth Cavity Depth Gradient */}
                    <radialGradient id="mouthCavity" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#1a0406" />
                      <stop offset="70%" stopColor="#2c090c" />
                      <stop offset="100%" stopColor="#451217" />
                    </radialGradient>

                    {/* Pearly Upper Teeth Gradient with gentle shading */}
                    <linearGradient id="teethGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f7f3ee" />
                      <stop offset="75%" stopColor="#ebe4db" />
                      <stop offset="100%" stopColor="#d1c5b8" />
                    </linearGradient>

                    {/* Natural Upper & Lower Lip Gloss Gradient */}
                    <linearGradient id="lipGlossUpper" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c57470" />
                      <stop offset="50%" stopColor="#b45155" />
                      <stop offset="100%" stopColor="#8d3439" />
                    </linearGradient>

                    <linearGradient id="lipGlossLower" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#963b40" />
                      <stop offset="45%" stopColor="#bb585d" />
                      <stop offset="85%" stopColor="#cf767b" />
                      <stop offset="100%" stopColor="#b85f64" />
                    </linearGradient>

                    {/* Soft Lip Highlight Sheen */}
                    <linearGradient id="lipSheen" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="20%" stopColor="rgba(255,255,255,0)" />
                      <stop offset="50%" stopColor="rgba(255,230,230,0.5)" />
                      <stop offset="80%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>

                  {/* 1. Inner Oral Cavity (visible as jaw opens) */}
                  {jawOpen > 0.08 && (
                    <path
                      d={`M 15 28 Q 50 ${26 - jawOpen * 4} 85 28 Q 50 ${30 + mouthOpenPx * 1.1} 15 28 Z`}
                      fill="url(#mouthCavity)"
                      opacity={Math.min(1, jawOpen * 1.8)}
                    />
                  )}

                  {/* 2. Pearly Upper Teeth (revealed on speech phonemes) */}
                  {jawOpen > 0.12 && teethReveal > 0.15 && (
                    <path
                      d={`M 26 27 Q 50 25 74 27 L 72 ${27 + teethHeightPx * 0.45} Q 50 ${28 + teethHeightPx * 0.55} 28 ${27 + teethHeightPx * 0.45} Z`}
                      fill="url(#teethGrad)"
                      opacity={Math.min(0.95, teethReveal * 1.4)}
                    />
                  )}

                  {/* 3. Upper Lip (Natural Cupid's Bow with soft contour) */}
                  <path
                    d={`M 10 30 C 26 ${22 - jawOpen * 2}, 38 20, 50 24 C 62 20, 74 ${22 - jawOpen * 2}, 90 30 C 72 ${28 - jawOpen * 3}, 58 27, 50 28 C 42 27, 28 ${28 - jawOpen * 3}, 10 30 Z`}
                    fill="url(#lipGlossUpper)"
                    opacity="0.96"
                  />

                  {/* Upper Lip Gloss Highlight */}
                  <path
                    d="M 36 23 Q 50 26 64 23 Q 50 24.5 36 23 Z"
                    fill="url(#lipSheen)"
                    opacity={0.65}
                  />

                  {/* 4. Lower Lip (Pouty, fuller, moves downward with jaw articulation) */}
                  <path
                    d={`M 10 30 C 28 ${31 + mouthOpenPx * 0.4}, 42 ${32 + mouthOpenPx * 0.6}, 50 ${32 + mouthOpenPx * 0.6} C 58 ${32 + mouthOpenPx * 0.6}, 72 ${31 + mouthOpenPx * 0.4}, 90 30 C 76 ${42 + mouthOpenPx * 0.95}, 60 ${46 + mouthOpenPx * 1.1}, 50 ${46 + mouthOpenPx * 1.1} C 40 ${46 + mouthOpenPx * 1.1}, 24 ${42 + mouthOpenPx * 0.95}, 10 30 Z`}
                    fill="url(#lipGlossLower)"
                    opacity="0.96"
                  />

                  {/* Lower Lip Gloss Center Highlight */}
                  <ellipse
                    cx="50"
                    cy={38 + mouthOpenPx * 0.75}
                    rx="14"
                    ry={2.5 + jawOpen * 1.2}
                    fill="url(#lipSheen)"
                    opacity={0.7}
                  />

                  {/* Corner Dimples & Mouth Shadows */}
                  <circle cx="10" cy="30" r="1.5" fill="#4d171c" opacity="0.6" />
                  <circle cx="90" cy="30" r="1.5" fill="#4d171c" opacity="0.6" />
                </svg>
              </div>
            )}

            {/* Subtle Chin/Jaw Ambient Shadow tracking jaw open */}
            {state === 'speaking' && jawOpen > 0.15 && (
              <div
                className="absolute pointer-events-none rounded-full blur-[3px] bg-black/25"
                style={{
                  top: '68.5%',
                  left: '44%',
                  width: '12%',
                  height: '3%',
                  opacity: Math.min(0.4, jawOpen * 0.5),
                  transform: `translateY(${jawDropPx * 0.7}px)`,
                  zIndex: 14,
                }}
              />
            )}

            {/* Ambient Lighting & Depth Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/30 pointer-events-none" />

            {/* Dynamic Colored Rim Light overlay matching Vibe */}
            <div
              className="absolute inset-0 pointer-events-none mix-blend-color-dodge opacity-35 transition-all duration-700"
              style={{
                background: `radial-gradient(ellipse at 80% 20%, ${vibe.accentColor} 0%, transparent 60%)`,
              }}
            />

            {/* Glowing Audio Earpiece Communicator indicator */}
            <div
              className="absolute pointer-events-none rounded-full blur-[1px] transition-all duration-150"
              style={{
                top: '46.5%',
                left: '74.2%',
                width: '7px',
                height: '7px',
                background: state === 'speaking' ? vibe.accentColor : '#06b6d4',
                boxShadow: `0 0 ${8 + speechVolume * 16}px ${vibe.accentColor}`,
                opacity: state === 'speaking' ? 0.9 + speechVolume * 0.1 : 0.6,
                zIndex: 20,
              }}
            />

            {/* Neural sync wave / scanline when connecting */}
            {state === 'connecting' && (
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent animate-[scan_2s_linear_infinite] pointer-events-none" />
            )}

            {/* Sound Wave ripple overlay when speaking */}
            {state === 'speaking' && (
              <div
                className="absolute -bottom-8 left-0 right-0 h-24 pointer-events-none opacity-50 filter blur-sm"
                style={{
                  background: `radial-gradient(ellipse at center, ${vibe.accentColor} 0%, transparent 70%)`,
                }}
              />
            )}

            {/* Top Bar Floating Status Tag */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-20">
              <div className="px-2.5 py-1 rounded-full bg-slate-950/75 border border-white/15 backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                <span
                  className={`w-2 h-2 rounded-full ${
                    state === 'speaking'
                      ? 'bg-pink-400 animate-ping'
                      : state === 'listening'
                      ? 'bg-cyan-400 animate-pulse'
                      : 'bg-emerald-400'
                  }`}
                />
                <span className="text-[10px] font-semibold text-white/90 tracking-wider uppercase font-mono">
                  Mahi 3D
                </span>
              </div>

              <div className="px-2.5 py-1 rounded-full bg-slate-950/75 border border-white/15 backdrop-blur-md flex items-center gap-1 text-[10px] text-white/80 font-medium">
                {isWinking ? (
                  <>
                    <Heart className="w-3 h-3 text-pink-400 fill-pink-400 animate-bounce" />
                    <span>Wink</span>
                  </>
                ) : state === 'speaking' ? (
                  <>
                    <Radio className="w-3 h-3 text-pink-400 animate-pulse" />
                    <span>Lip-Sync 24kHz</span>
                  </>
                ) : state === 'listening' ? (
                  <>
                    <Eye className="w-3 h-3 text-cyan-400" />
                    <span>Listening</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 text-white/60" />
                    <span>Ready</span>
                  </>
                )}
              </div>
            </div>

            {/* Bottom Expression & Interaction Cue */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white/75 bg-slate-950/80 border border-white/10 px-3 py-1.5 rounded-xl backdrop-blur-md z-20">
              <span className="font-medium text-white/90 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: vibe.accentColor }} />
                {expressionTag}
              </span>
              <span className="text-[10px] text-white/40 group-hover:text-pink-300 transition-colors flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                <span>Tap to tease</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
