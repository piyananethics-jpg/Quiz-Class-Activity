import React from "react";
import { ShieldAlert, LogOut, Home, KeyRound } from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface AccessDeniedPageProps {
  onGoHome: () => void;
  reason?: string;
}

export function AccessDeniedPage({ onGoHome, reason }: AccessDeniedPageProps) {
  const { signOutUser, profile } = useAuth();

  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-[70vh]">
      <div className="w-full max-w-md bg-slate-900/60 border border-red-500/20 backdrop-blur-xl rounded-2xl p-8 shadow-2xl relative overflow-hidden text-center">
        {/* Ambient warning aura */}
        <div className="absolute -top-12 -left-12 w-40 h-40 bg-red-500/10 rounded-full blur-2xl pointer-events-none"></div>
        
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full mx-auto flex items-center justify-center mb-6">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <h2 className="text-xl font-bold text-white tracking-tight mb-2">
          Access Denied
        </h2>
        
        <p className="text-sm text-slate-400 mb-6 font-mono bg-slate-950/40 p-3 rounded-xl border border-white/5">
          {reason || "You are not authorized to access this section."}
        </p>

        {profile && (
          <div className="mb-6 text-xs text-left text-slate-350 bg-white/5 border border-white/10 p-4 rounded-xl">
            <p className="font-semibold text-slate-200 mb-1">Signed-In Account:</p>
            <p className="truncate"><strong>Name:</strong> {profile.displayName}</p>
            <p className="truncate"><strong>Email:</strong> {profile.email}</p>
            <p className="capitalize"><strong>Active Role:</strong> {profile.role || "None selected"}</p>
          </div>
        )}

        <div className="flex flex-col space-y-2">
          <button
            onClick={onGoHome}
            className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold text-sm rounded-xl cursor-pointer transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-indigo-500/10"
          >
            <Home className="h-4 w-4" />
            <span>Go to Home Page</span>
          </button>

          <button
            onClick={() => signOutUser()}
            className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs rounded-xl cursor-pointer border border-white/10 transition-colors flex items-center justify-center space-x-2"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sign Out Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
