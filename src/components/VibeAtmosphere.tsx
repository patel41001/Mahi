import React from 'react';
import type { VibeConfig } from '../types/assistant';

interface VibeAtmosphereProps {
  vibe: VibeConfig;
}

export const VibeAtmosphere: React.FC<VibeAtmosphereProps> = ({ vibe }) => {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden transition-colors duration-1000 bg-slate-950">
      {/* Primary Ambient Light Beam */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full blur-[140px] opacity-40 transition-all duration-1000"
        style={{ background: vibe.primaryGlow }}
      />

      {/* Secondary Ambient Light Beam Bottom */}
      <div
        className="absolute -bottom-40 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full blur-[150px] opacity-30 transition-all duration-1000"
        style={{ background: vibe.secondaryGlow }}
      />

      {/* Cyber Grid / Star Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.7) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />

      {/* Vignette border */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(2,6,23,0.85)_100%)]" />
    </div>
  );
};
