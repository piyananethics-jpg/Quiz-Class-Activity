/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { UserDoc } from "../types";
import { GraduationCap, Users, RefreshCw, Layers, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";


interface NavigationProps {
  splitScreen: boolean;
  setSplitScreen: (split: boolean) => void;
  activeTab: "teacher" | "student";
  setActiveTab: (tab: "teacher" | "student") => void;
  onReset: () => void;
}

export function Navigation({
  splitScreen,
  setSplitScreen,
  activeTab,
  setActiveTab,
  onReset
}: NavigationProps) {
  const { profile, signOutUser } = useAuth();


  return (
    <header className="bg-white/5 backdrop-blur-xl border-b border-white/10 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Platform Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="font-sans font-bold text-lg tracking-tight bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
                ClassPulse
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-mono px-2 py-0.5 bg-white/5 text-indigo-300 border border-white/10 rounded-full">
                Classroom Live Session & Quiz
              </span>
            </div>
          </div>

          {/* Center Navigation Controls (When not in Split Screen) */}
          {!splitScreen && (
            <div className="flex space-x-1 bg-white/5 border border-white/10 p-1 rounded-xl">
              <button
                id="nav-tab-teacher"
                onClick={() => setActiveTab("teacher")}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === "teacher"
                    ? "bg-indigo-505 bg-indigo-500/30 border border-indigo-400/40 text-white shadow-md shadow-indigo-500/10"
                    : "text-slate-400 hover:text-white border border-transparent"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Teacher Workspace</span>
              </button>
              <button
                id="nav-tab-student"
                onClick={() => setActiveTab("student")}
                className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                  activeTab === "student"
                    ? "bg-indigo-505 bg-indigo-500/30 border border-indigo-400/40 text-white shadow-md shadow-indigo-500/10"
                    : "text-slate-400 hover:text-white border border-transparent"
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                <span>Student Portal</span>
              </button>
            </div>
          )}

          {/* Right Controls: Simulators & Quick Actions */}
          <div className="flex items-center space-x-4">
            {/* Split Screen Toggle */}
            <button
              id="nav-toggle-split"
              onClick={() => {
                setSplitScreen(!splitScreen);
                // Ensure default tab is appropriate if moving off split
                if (splitScreen) {
                  setActiveTab(profile?.role === "teacher" ? "teacher" : "student");
                }
              }}
              className={`hidden md:flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-medium cursor-pointer border transition-all ${
                splitScreen
                  ? "bg-indigo-500/30 border-indigo-400/50 text-indigo-305 text-indigo-300"
                  : "bg-white/5 border-white/10 text-slate-305 text-slate-300 hover:bg-white/10"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Split Screen Preview</span>
            </button>

            {/* Dynamic Authenticated Account Profile & Sign Out action */}
            <div className="flex items-center space-x-2 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10 font-mono text-xs">
              <div className="text-left hidden md:block">
                <span className="text-white font-bold block truncate max-w-[120px]">
                  {profile ? profile.displayName : "AU Academic"}
                </span>
                <span className="text-[10px] text-indigo-300 block capitalize">
                  {profile ? profile.role || "No Role Setup" : "Offline Guest"}
                </span>
              </div>
              <span className="text-white/10 hidden md:block">|</span>
              <button
                id="nav-btn-signout"
                onClick={() => signOutUser()}
                title="Sign Out Account"
                className="p-1.5 hover:bg-white/10 text-slate-300 hover:text-red-400 rounded-lg transition-all cursor-pointer flex items-center space-x-1"
              >
                <LogOut className="h-4 w-4 text-slate-400" />
                <span className="text-[9px] md:hidden font-mono">Sign Out</span>
              </button>
            </div>


            {/* Debug Reset Database Button */}
            <button
              id="nav-reset-db"
              onClick={() => {
                if (confirm("Are you sure you want to reset all quiz data, courses, and active sessions?")) {
                  onReset();
                }
              }}
              title="Reset Demo Database"
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
