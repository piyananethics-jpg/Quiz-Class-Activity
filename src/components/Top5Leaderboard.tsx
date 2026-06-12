/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { LeaderboardDoc } from "../types";
import { Trophy, Medal, Award, Flame, User, Clock } from "lucide-react";
import { motion } from "motion/react";

interface Top5LeaderboardProps {
  entries: LeaderboardDoc[];
  showDetails?: boolean;
}

export function Top5Leaderboard({ entries, showDetails = true }: Top5LeaderboardProps) {
  // Take only top 5 entries
  const topFive = entries.slice(0, 5);

  const getRankBadge = (idx: number) => {
    switch (idx) {
      case 0:
        return (
          <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center font-bold">
            <Trophy className="h-4 w-4 animate-bounce" />
          </div>
        );
      case 1:
        return (
          <div className="h-7 w-7 rounded-lg bg-slate-200/20 text-slate-300 border border-slate-300/30 flex items-center justify-center font-bold">
            <Medal className="h-4 w-4 text-slate-300" />
          </div>
        );
      case 2:
        return (
          <div className="h-7 w-7 rounded-lg bg-amber-700/20 text-amber-500 border border-amber-800/30 flex items-center justify-center font-bold">
            <Award className="h-4 w-4 text-amber-600" />
          </div>
        );
      default:
        return (
          <div className="h-7 w-7 rounded-lg bg-white/5 text-slate-400 border border-white/10 flex items-center justify-center font-mono font-bold text-xs">
            {idx + 1}
          </div>
        );
    }
  };

  const getRankRowClass = (idx: number) => {
    switch (idx) {
      case 0:
        return "bg-gradient-to-r from-amber-500/10 via-white/5 to-white/0 border border-amber-500/20 shadow-amber-500/5";
      case 1:
        return "bg-white/5 border border-slate-300/10";
      case 2:
        return "bg-amber-800/5 border border-amber-80 * 0.05/10 border-amber-700/10";
      default:
        return "bg-white/0 border border-white/5 hover:bg-white/5 transition-colors";
    }
  };

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 bg-white/5 border border-white/10 rounded-2xl">
        <User className="h-8 w-8 text-slate-500 mx-auto opacity-40 mb-2" />
        <p className="text-xs text-slate-400 font-sans italic">Scoreboard is empty. Waiting for student submissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1.5 pb-1">
        <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
          Top 5 Leaderboard Standings
        </span>
        <span className="text-[9px] font-mono bg-white/5 text-slate-400 border border-white/10 px-2 py-0.5 rounded-full">
          {entries.length} participants graded
        </span>
      </div>

      <div className="space-y-2">
        {topFive.map((entry, idx) => {
          return (
            <div
              id={`leaderboard-row-${idx + 1}`}
              key={`${entry.studentUid}-${idx}`}
              className={`flex items-center justify-between p-3.5 rounded-xl shadow-sm transition-all ${getRankRowClass(
                idx
              )}`}
            >
              <div className="flex items-center space-x-3.5 min-w-0">
                {getRankBadge(idx)}
                <div className="text-left min-w-0">
                  <span className="text-xs font-bold text-white block truncate leading-tight">
                    {entry.displayName}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 block mt-0.5">
                    ID: {entry.studentIdMasked}
                  </span>
                </div>
              </div>

              <div className="text-right flex items-center space-x-3 shrink-0">
                <div className="flex flex-col items-end">
                  <span className="text-sm font-extrabold text-emerald-400 font-mono tracking-tight">
                    {entry.score} <span className="text-[10px] font-medium text-slate-400">pts</span>
                  </span>
                  {showDetails && entry.durationMs > 0 && (
                    <span className="text-[9px] font-mono text-slate-400 flex items-center gap-0.5 mt-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {(entry.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
