import React from 'react';
import { Sun, X } from 'lucide-react';

interface FlashlightOverlayProps {
  isActive: boolean;
  onDismiss: () => void;
}

export const FlashlightOverlay: React.FC<FlashlightOverlayProps> = ({ isActive, onDismiss }) => {
  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-between p-8 text-slate-900 transition-opacity duration-300 animate-in fade-in">
      <div className="w-full flex justify-end">
        <button
          onClick={onDismiss}
          className="p-3 rounded-full bg-slate-900/10 hover:bg-slate-900/20 text-slate-900 flex items-center justify-center transition-colors"
          title="Turn off flashlight"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex flex-col items-center text-center">
        <Sun className="w-16 h-16 text-amber-500 animate-spin" />
        <h1 className="text-2xl font-bold mt-4 tracking-tight">Spotlight Active</h1>
        <p className="text-sm text-slate-600 mt-1">Screen brightness maximized</p>
      </div>

      <button
        onClick={onDismiss}
        className="px-6 py-2.5 rounded-full bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 transition-colors shadow-lg"
      >
        Turn Off Flashlight
      </button>
    </div>
  );
};
