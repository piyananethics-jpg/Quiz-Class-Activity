import React from "react";

export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div className="flex-1 min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative flex items-center justify-center mb-4">
        {/* Animated concentric loader rings */}
        <div className="absolute w-12 h-12 rounded-full border-2 border-indigo-500/20 animate-ping"></div>
        <div className="w-8 h-8 rounded-full border-2 border-t-indigo-400 border-indigo-500/10 animate-spin"></div>
      </div>
      <p className="text-sm font-semibold tracking-wide text-slate-300 font-mono animate-pulse">
        {message || "Authenticating Live Session..."}
      </p>
    </div>
  );
}
