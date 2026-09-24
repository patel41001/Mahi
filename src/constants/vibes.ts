import type { AppVibe, VibeConfig } from '../types/assistant';

export const VIBE_CONFIGS: Record<AppVibe, VibeConfig> = {
  cyberpunk_neon: {
    id: 'cyberpunk_neon',
    name: 'Cyberpunk Neon',
    tagline: 'High voltage attitude & neon cyber glow',
    primaryGlow: 'rgba(236, 72, 153, 0.45)', // Pink-500
    secondaryGlow: 'rgba(6, 182, 212, 0.45)', // Cyan-500
    accentColor: '#ec4899',
    orbGradient: ['#f43f5e', '#8b5cf6', '#06b6d4'],
    waveformColor: '#38bdf8'
  },
  romantic_rose: {
    id: 'romantic_rose',
    name: 'Romantic Rose',
    tagline: 'Velvet petals, soft whispers, and warm affection',
    primaryGlow: 'rgba(244, 63, 94, 0.5)',
    secondaryGlow: 'rgba(251, 113, 133, 0.35)',
    accentColor: '#f43f5e',
    orbGradient: ['#e11d48', '#fb7185', '#fda4af'],
    waveformColor: '#fb7185'
  },
  midnight_sapphire: {
    id: 'midnight_sapphire',
    name: 'Midnight Sapphire',
    tagline: 'Starlit obsidian skies and electric deep blue',
    primaryGlow: 'rgba(59, 130, 246, 0.45)',
    secondaryGlow: 'rgba(99, 102, 241, 0.4)',
    accentColor: '#3b82f6',
    orbGradient: ['#2563eb', '#4f46e5', '#38bdf8'],
    waveformColor: '#60a5fa'
  },
  electric_violet: {
    id: 'electric_violet',
    name: 'Electric Violet',
    tagline: 'Mysterious ultraviolet aura with sassy vibes',
    primaryGlow: 'rgba(168, 85, 247, 0.5)',
    secondaryGlow: 'rgba(217, 70, 239, 0.4)',
    accentColor: '#a855f7',
    orbGradient: ['#9333ea', '#c026d3', '#e879f9'],
    waveformColor: '#c084fc'
  },
  emerald_matrix: {
    id: 'emerald_matrix',
    name: 'Emerald Matrix',
    tagline: 'Hyper-vibrant luminescent jade & cyber green',
    primaryGlow: 'rgba(16, 185, 129, 0.45)',
    secondaryGlow: 'rgba(20, 184, 166, 0.4)',
    accentColor: '#10b981',
    orbGradient: ['#059669', '#10b981', '#34d399'],
    waveformColor: '#34d399'
  },
  golden_hour: {
    id: 'golden_hour',
    name: 'Golden Hour',
    tagline: 'Champagne amber brilliance and sunset warmth',
    primaryGlow: 'rgba(245, 158, 11, 0.5)',
    secondaryGlow: 'rgba(251, 191, 36, 0.35)',
    accentColor: '#f59e0b',
    orbGradient: ['#d97706', '#f59e0b', '#fde047'],
    waveformColor: '#fbbf24'
  }
};
