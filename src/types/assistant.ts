export type AssistantState = 'disconnected' | 'connecting' | 'listening' | 'speaking' | 'error';

export type AppVibe = 
  | 'cyberpunk_neon'
  | 'romantic_rose'
  | 'midnight_sapphire'
  | 'electric_violet'
  | 'emerald_matrix'
  | 'golden_hour';

export interface VibeConfig {
  id: AppVibe;
  name: string;
  tagline: string;
  primaryGlow: string;
  secondaryGlow: string;
  accentColor: string;
  orbGradient: [string, string, string];
  waveformColor: string;
}

export interface ActiveToolEvent {
  id: string;
  name: string;
  args: Record<string, any>;
  timestamp: number;
}

export interface ActiveTimer {
  id: string;
  durationSeconds: number;
  remainingSeconds: number;
  label: string;
  isRunning: boolean;
}

export type VoiceName = 'Aoede' | 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
