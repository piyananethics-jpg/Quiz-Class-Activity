/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { SessionDoc } from "../types";
import {
  getParticipants,
  getSubmissions,
  getLeaderboard,
  updateSessionStatus,
  joinActiveSession,
  submitQuizAnswers,
  generateDynamicCode
} from "../dbStore";
import {
  Users,
  Award,
  CirclePlay,
  CircleStop,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  RotateCcw,
  Sparkles,
  CheckCircle,
  HelpCircle,
  BookOpen,
  QrCode,
  ShieldAlert
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TeacherSessionMonitorProps {
  session: SessionDoc;
  onBack: () => void;
  triggerRefresh: () => void;
}

export function TeacherSessionMonitor({ session, onBack, triggerRefresh }: TeacherSessionMonitorProps) {
  // Read live states
  const participants = getParticipants(session.sessionId);
  const submissions = getSubmissions(session.sessionId);
  const leaderboard = getLeaderboard(session.sessionId);

  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<"leaderboard" | "participants">("leaderboard");
  const [successMsg, setSuccessMsg] = useState("");

  const [rotatingCode, setRotatingCode] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState<number>(10);

  // Computes and rotates the dynamic alphanumeric join code securely every 10 seconds (browser-only, minimal writes)
  useEffect(() => {
    if (session.status !== "open" || !session.sessionSecret) {
      setRotatingCode("");
      return;
    }

    const updateCode = () => {
      const now = Date.now();
      const intervalMs = 10000; // 10s rotational interval
      const secondsPassed = Math.floor((now % intervalMs) / 1000);
      setTimeLeft(10 - secondsPassed);

      const wIndex = Math.floor(now / intervalMs);
      const code = generateDynamicCode(session.sessionId, session.sessionSecret || "", wIndex);
      setRotatingCode(code);
    };

    updateCode(); // initial calculation
    const handle = setInterval(updateCode, 1000);

    return () => clearInterval(handle);
  }, [session.status, session.sessionId, session.sessionSecret]);

  // Periodically refresh states to simulate "live" pooling if changes happen
  useEffect(() => {
    const handle = setInterval(() => {
      triggerRefresh();
    }, 1500);
    return () => clearInterval(handle);
  }, [triggerRefresh]);

  const handleStartSession = () => {
    updateSessionStatus(session.sessionId, "open");
    setSuccessMsg("Class session is now open! Instruct students to enter the Join Code.");
    setTimeout(() => setSuccessMsg(""), 4000);
    triggerRefresh();
  };

  const handleCloseSession = () => {
    updateSessionStatus(session.sessionId, "closed");
    setSuccessMsg("Session closed! Submissions frozen and final leaderboard locked.");
    setTimeout(() => setSuccessMsg(""), 4000);
    triggerRefresh();
  };

  // Helper to trigger simulated student actions
  const handleSimulateJoin = (id: string, name: string, email: string, studentId: string) => {
    joinActiveSession(session.sessionId, id);
    setSuccessMsg(`Simulated user '${name}' joined!`);
    setTimeout(() => setSuccessMsg(""), 2000);
    triggerRefresh();
  };

  const handleSimulateSubmit = (studentId: string, name: string) => {
    // Generate randomized answers indices
    const answers = session.questionSnapshot.map((q) => {
      // 75% chance to choose correct answer to make leaderboard stats realistic
      return Math.random() > 0.25 ? q.correctChoiceIndex : Math.floor(Math.random() * q.choices.length);
    });
    const randomDuration = Math.round(5000 + Math.random() * 15000); // 5 to 20 sec

    submitQuizAnswers(session.sessionId, studentId, answers, randomDuration);
    setSuccessMsg(`Simulated '${name}' successfully submitted answers!`);
    setTimeout(() => setSuccessMsg(""), 2500);
    triggerRefresh();
  };

  // Run all remaining simulation steps
  const handleSimulateAll = () => {
    const availableStudents = [
      { id: "student-1", name: "Bob Carter", email: "student.bob@university.edu", code: "64234589" },
      { id: "student-2", name: "Alice Jenkins", email: "student.alice@university.edu", code: "64987612" },
      { id: "student-3", name: "Charlie Vance", email: "student.charlie@university.edu", code: "64555123" }
    ];

    availableStudents.forEach((student) => {
      // 1. Join if not already joined
      joinActiveSession(session.sessionId, student.id);
      // 2. Submit if not already submitted
      const hasSub = submissions.some((s) => s.studentUid === student.id);
      if (!hasSub) {
        const answers = session.questionSnapshot.map((q) => {
          return Math.random() > 0.2 ? q.correctChoiceIndex : Math.floor(Math.random() * q.choices.length);
        });
        const duration = Math.round(4000 + Math.random() * 12000);
        submitQuizAnswers(session.sessionId, student.id, answers, duration);
      }
    });

    setSuccessMsg("Simulated all classroom students joining & submitting core answers!");
    setTimeout(() => setSuccessMsg(""), 3500);
    triggerRefresh();
  };

  // Percent calculation
  const submissionPercent =
    participants.length > 0 ? Math.round((submissions.length / participants.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header and Back navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/10">
        <div>
          <button
            id="btn-back-workspace"
            onClick={onBack}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1.5 cursor-pointer mb-2"
          >
            <span>← Back to Course Workspace</span>
          </button>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center mb-1">
            <BookOpen className="h-6 w-6 text-indigo-600 mr-2" />
            Live Classroom Session Dashboard
          </h2>
          <p className="text-sm text-slate-500">
            Session ID: <span className="font-mono text-xs">{session.sessionId}</span>
          </p>
        </div>

        {/* Status Actions */}
        <div className="mt-3 md:mt-0 flex items-center space-x-3">
          {session.status === "draft" && (
            <button
              id="btn-start-session"
              onClick={handleStartSession}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center space-x-2 shadow-sm cursor-pointer transition-all"
            >
              <CirclePlay className="h-4 w-4" />
              <span>🚀 Launch Session (Open Quiz)</span>
            </button>
          )}

          {session.status === "open" && (
            <button
              id="btn-close-session"
              onClick={handleCloseSession}
              className="bg-rose-500 hover:bg-rose-600 text-white font-medium px-4 py-2 rounded-lg text-sm flex items-center space-x-2 shadow-sm cursor-pointer transition-all animate-pulse"
            >
              <CircleStop className="h-4 w-4" />
              <span>🛑 End Session (Lock Quiz)</span>
            </button>
          )}

          {session.status === "closed" && (
            <div className="flex items-center space-x-2.5">
              <a
                href={`#/teacher/sessions/${session.sessionId}/results`}
                className="bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold px-4.5 py-2.5 rounded-xl text-xs flex items-center space-x-1.5 shadow-lg shadow-indigo-550/10 hover:shadow-indigo-550/20 transition-all cursor-pointer"
                id="btn-view-results-monitor"
              >
                <Award className="h-4 w-4" />
                <span>View Results & Grade</span>
              </a>
              <div className="bg-white/5 text-slate-350 font-semibold px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 border border-white/5">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span>Closed</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Real-time Toast success message */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-emerald-500/20 border-l-4 border-emerald-400 text-emerald-300 text-sm font-medium rounded-lg border border-emerald-500/10 shadow-md"
          >
            {successMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Code display & stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Huge Join Code Display & Quick Information */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl text-white animate-fade-in space-y-6">
            <div>
              <span className="text-xs uppercase tracking-wider text-indigo-300 font-mono font-bold block mb-1">
                Static Fallback Code
              </span>
              <div className="text-4xl font-mono font-black tracking-widest text-center py-3.5 bg-indigo-950/40 rounded-xl border border-indigo-800/60 select-all font-display text-indigo-200">
                {session.joinCode}
              </div>
              <p className="text-[10px] text-slate-400 text-center mt-1">
                Constant classroom workspace entry code
              </p>
            </div>

            {session.status === "open" && rotatingCode && (
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl">
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-mono font-bold block mb-1 text-center">
                  🔐 Active Rotating Student Code
                </span>
                <div className="text-5xl font-mono font-black tracking-widest text-center py-4 select-all font-display text-emerald-400">
                  {rotatingCode}
                </div>
                
                {/* Countdown visual bar */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-mono font-bold text-slate-400">
                    <span>Token rotating in</span>
                    <span className="text-emerald-400 animate-pulse">{timeLeft}s</span>
                  </div>
                  <div className="w-full bg-emerald-950/40 h-1.5 rounded-full overflow-hidden border border-emerald-950">
                    <div
                      className="bg-emerald-400 h-1.5 rounded-full transition-all duration-1000 ease-linear"
                      style={{ width: `${timeLeft * 10}%` }}
                    ></div>
                  </div>
                </div>
                <p className="text-[9px] text-emerald-400/80 text-center mt-2 leading-relaxed">
                  Refreshed every 10 seconds to discourage sharing.
                </p>
              </div>
            )}

            {/* Deep-link scan section */}
            <div className="text-center space-y-2.5 pt-2 border-t border-white/5">
              <span className="text-xs uppercase tracking-wider text-indigo-300 font-mono font-bold block">
                QR Instant Connection Link
              </span>
              
              <div className="inline-block p-2 bg-white rounded-xl shadow-lg shadow-indigo-950/20">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&color=4f46e5&data=${encodeURIComponent(
                    `${window.location.origin}${window.location.pathname}#/student/join?sessionId=${session.sessionId}&code=${rotatingCode || session.joinCode}`
                  )}`}
                  referrerPolicy="no-referrer"
                  alt="Students Join URL QR Code"
                  className="w-36 h-36 border border-slate-100"
                />
              </div>

              <p className="text-[10px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                Students scan using mobile devices to automatically load credentials, verify enrollment, and link instantly.
              </p>
            </div>

            {/* Strict evaluation disclaimer warn block */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl flex items-start space-x-2 text-[10px] leading-relaxed">
              <ShieldAlert className="h-4.5 w-4.5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-amber-400 mb-0.5">👮 Evaluation Warning:</span>
                This rotating join code reduces casual sharing but is not intended for high-stakes exam security without a trusted backend.
              </div>
            </div>

            <div className="pt-4 border-t border-white/5 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-indigo-300">Total Questions Snapshot</span>
                <span className="font-bold font-mono">{session.totalQuestions} Questions</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-indigo-300">Max Possible Score</span>
                <span className="font-bold text-emerald-400 font-mono">{session.maxScore} pts</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-indigo-300">Session Status</span>
                <span className="font-bold flex items-center">
                  <span
                    className={`h-2 w-2 rounded-full mr-1.5 ${
                      session.status === "open"
                        ? "bg-emerald-400 animate-ping"
                        : session.status === "closed"
                        ? "bg-rose-400"
                        : "bg-slate-400"
                    }`}
                  ></span>
                  {session.status.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Realtime tally card */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl text-white animate-fade-in">
            <h3 className="text-sm font-bold text-white uppercase tracking-wide mb-3 flex items-center">
              <Users className="h-4 w-4 text-indigo-600 mr-1.5" />
              Submission Progress
            </h3>

            <div className="flex items-center justify-between font-mono py-1">
              <div className="flex items-baseline space-x-1">
                <span className="text-3xl font-extrabold text-indigo-400">{submissions.length}</span>
                <span className="text-slate-400 text-sm">/ {participants.length} submitted</span>
              </div>
              <span className="text-slate-500 font-medium text-lg">{submissionPercent}%</span>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full bg-white/10 rounded-full h-2.5 mt-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${submissionPercent || 0}%` }}
              ></div>
            </div>

            {/* Quick Helper */}
            <div className="mt-4 p-3 bg-white/5 rounded-xl text-xs leading-relaxed text-slate-400 border border-white/5">
              {participants.length === 0 ? (
                <span>No students have joined yet. Use the Simulator panel below or have students sign in and join!</span>
              ) : submissions.length < participants.length ? (
                <span>Waiting for remaining students to finish answering...</span>
              ) : (
                <span>All joined students have successfully submitted their quizzes!</span>
              )}
            </div>
          </div>

          {/* Simulation Playground Panel */}
          <div className="bg-white/5 rounded-2xl border border-white/10 p-5 shadow-xl text-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-300 tracking-wider uppercase flex items-center">
                <Sparkles className="h-4 w-4 text-indigo-500 mr-2" />
                Live Demo Simulator
              </h3>
              <button
                id="btn-simulate-join-all"
                onClick={handleSimulateAll}
                className="text-[10px] bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 font-bold px-2.5 py-1 rounded-lg cursor-pointer"
              >
                Simulate All
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Quickly seed interactive student activity (joins and test submissions) to see real-time scoreboard & charts update on the fly code.
            </p>

            <div className="space-y-2.5">
              {/* Client User 1 */}
              <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10 text-xs shadow-md">
                <div>
                  <span className="font-semibold text-white">Bob Carter</span>
                  <span className="text-[10px] text-slate-400 block">ID: 64234589</span>
                </div>
                <div className="flex space-x-1">
                  {!participants.some((p) => p.studentUid === "student-1") ? (
                    <button
                      onClick={() => handleSimulateJoin("student-1", "Bob Carter", "student.bob@university.edu", "64234589")}
                      className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-550/25 font-semibold rounded-lg text-[10px] border border-indigo-500/20 cursor-pointer"
                    >
                      Join
                    </button>
                  ) : !submissions.some((s) => s.studentUid === "student-1") ? (
                    <button
                      onClick={() => handleSimulateSubmit("student-1", "Bob Carter")}
                      className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-555/25 font-semibold rounded-lg text-[10px] border border-emerald-500/20 cursor-pointer"
                    >
                      Submit
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[10px] italic">Submitted</span>
                  )}
                </div>
              </div>

              {/* Client User 2 */}
              <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-100 text-xs shadow-sm">
                <div>
                  <span className="font-semibold text-slate-800">Alice Jenkins</span>
                  <span className="text-[10px] text-slate-400 block">ID: 64987612</span>
                </div>
                <div className="flex space-x-1">
                  {!participants.some((p) => p.studentUid === "student-2") ? (
                    <button
                      onClick={() => handleSimulateJoin("student-2", "Alice Jenkins", "student.alice@university.edu", "64987612")}
                      className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium rounded text-[10px] border border-indigo-100 cursor-pointer"
                    >
                      Join
                    </button>
                  ) : !submissions.some((s) => s.studentUid === "student-2") ? (
                    <button
                      onClick={() => handleSimulateSubmit("student-2", "Alice Jenkins")}
                      className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold rounded text-[10px] border border-emerald-100 cursor-pointer"
                    >
                      Submit
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[10px] italic">Submitted</span>
                  )}
                </div>
              </div>

              {/* Client User 3 */}
              <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-100 text-xs shadow-sm">
                <div>
                  <span className="font-semibold text-slate-800">Charlie Vance</span>
                  <span className="text-[10px] text-slate-400 block">ID: 64555123</span>
                </div>
                <div className="flex space-x-1">
                  {!participants.some((p) => p.studentUid === "student-3") ? (
                    <button
                      onClick={() => handleSimulateJoin("student-3", "Charlie Vance", "student.charlie@university.edu", "64555123")}
                      className="px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium rounded text-[10px] border border-indigo-100 cursor-pointer"
                    >
                      Join
                    </button>
                  ) : !submissions.some((s) => s.studentUid === "student-3") ? (
                    <button
                      onClick={() => handleSimulateSubmit("student-3", "Charlie Vance")}
                      className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold rounded text-[10px] border border-emerald-100 cursor-pointer"
                    >
                      Submit
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[10px] italic">Submitted</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns: Leaderboard, participant list */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs for switching between Leaderboard view & Active roster */}
          <div className="border-b border-white/10">
            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
              <button
                id="tab-view-leaderboard"
                onClick={() => setActiveLeaderboardTab("leaderboard")}
                className={`flex items-center space-x-1.5 py-2.5 px-1 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
                  activeLeaderboardTab === "leaderboard"
                    ? "border-indigo-400 text-indigo-400 font-bold"
                    : "border-transparent text-slate-400 hover:text-indigo-300 hover:border-white/10"
                }`}
              >
                <Award className="h-4 w-4" />
                <span>Live Leaderboard</span>
                {submissions.length > 0 && (
                  <span className="bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 font-mono">
                    {submissions.length}
                  </span>
                )}
              </button>

              <button
                id="tab-view-roster"
                onClick={() => setActiveLeaderboardTab("participants")}
                className={`flex items-center space-x-1.5 py-2.5 px-1 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
                  activeLeaderboardTab === "participants"
                    ? "border-indigo-400 text-indigo-400 font-bold"
                    : "border-transparent text-slate-400 hover:text-indigo-300 hover:border-white/10"
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Active Classroom Roster</span>
                <span className="bg-white/10 border border-white/10 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 font-mono">
                  {participants.length}
                </span>
              </button>
            </nav>
          </div>

          {activeLeaderboardTab === "leaderboard" ? (
            <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden text-white animate-fade-in">
              {/* Heading */}
              <div className="p-4 bg-white/5 border-b border-white/10 flex justify-between items-center text-white">
                <div>
                  <h4 className="font-bold text-white text-sm flex items-center">
                    <TrendingUp className="h-4.5 w-4.5 text-indigo-600 mr-2" />
                    Student Standings
                  </h4>
                  <p className="text-slate-400 text-[10px]">Ranked by total score, then by fastest duration.</p>
                </div>
                <div className="text-slate-400 font-mono text-[10px] uppercase">
                  Class Live stats feed
                </div>
              </div>

              {leaderboard.length === 0 ? (
                <div className="p-12 text-center">
                  <Award className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Leaderboard is empty</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-[280px] mx-auto">
                    Once students complete and submit the interactive quiz questions, results will display here in real-time.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {/* PODIUM CARDS (Top 3 Visuals) */}
                  <div className="p-4 bg-white/5 border-b border-white/10 grid grid-cols-3 gap-3 text-white">
                    {/* 2nd Place */}
                    <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 text-center flex flex-col justify-between shadow-md">
                      <div>
                        <span className="text-xs font-bold text-slate-400 block">2nd Place</span>
                        <span className="text-lg font-bold text-white truncate block mt-1">
                          {leaderboard[1]?.displayName || "---"}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block">
                          {leaderboard[1]?.studentIdMasked || ""}
                        </span>
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-white/10 flex justify-center items-baseline space-x-1">
                        <span className="text-sm font-black text-white">
                          {leaderboard[1] ? `${leaderboard[1].score}` : "0"}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">pts</span>
                      </div>
                    </div>

                    {/* 1st Place (Featured Card) */}
                    <div className="bg-amber-500/10 p-4 rounded-xl border-2 border-amber-400/50 text-center flex flex-col justify-between shadow shadow-amber-500/10 text-white">
                      <div>
                        <span className="text-xs font-bold text-amber-600 block flex items-center justify-center">
                          <Sparkles className="h-3 w-3 text-amber-500 mr-1" />
                          Winner 🏆
                        </span>
                        <span className="text-base font-extrabold text-white truncate block mt-1">
                          {leaderboard[0]?.displayName || "---"}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 block">
                          {leaderboard[0]?.studentIdMasked || ""}
                        </span>
                      </div>
                      <div className="mt-2.5 pt-1.5 border-t border-amber-400/30 flex justify-center items-baseline space-x-1">
                        <span className="text-base font-black text-amber-300">
                          {leaderboard[0] ? `${leaderboard[0].score}` : "0"}
                        </span>
                        <span className="text-[9px] text-amber-600 font-mono font-semibold">pts</span>
                      </div>
                    </div>

                    {/* 3rd Place */}
                    <div className="bg-white p-3 rounded-lg border border-slate-100 text-center flex flex-col justify-between shadow-sm">
                      <div>
                        <span className="text-xs font-bold text-amber-800/60 block">3rd Place</span>
                        <span className="text-lg font-bold text-slate-800 truncate block mt-1">
                          {leaderboard[2]?.displayName || "---"}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block">
                          {leaderboard[2]?.studentIdMasked || ""}
                        </span>
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-slate-55 flex justify-center items-baseline space-x-1">
                        <span className="text-sm font-black text-slate-700">
                          {leaderboard[2] ? `${leaderboard[2].score}` : "0"}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">pts</span>
                      </div>
                    </div>
                  </div>

                  {/* Complete List with Animation */}
                  <div className="p-1">
                    {leaderboard.map((item, index) => {
                      const durationSec = (item.durationMs / 1000).toFixed(1);
                      return (
                        <div
                          key={item.studentUid}
                          id={`leaderboard-item-${item.studentUid}`}
                          className="flex items-center justify-between p-3.5 hover:bg-white/5 rounded-xl transition-all text-white"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            {/* Rank Circle */}
                            <span
                              className={`h-7 w-7 rounded-full flex items-center justify-center font-bold font-mono text-xs ${
                                index === 0
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/20"
                                  : index === 1
                                  ? "bg-white/20 text-slate-200 border-white/20"
                                  : index === 2
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/10"
                                  : "bg-transparent text-slate-400"
                              }`}
                            >
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <span className="font-bold text-white text-sm block truncate">
                                {item.displayName}
                              </span>
                              <span className="text-xs font-mono text-slate-400">
                                Masked StuID: {item.studentIdMasked}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-5">
                            <span className="text-xs font-mono text-slate-400 italic">
                              ⏱️ {durationSec}s
                            </span>
                            <div className="text-right">
                              <span className="font-extrabold text-white text-base font-mono block">
                                {item.score}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono block">points</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-white/5 border-b border-white/10 text-white">
                <h4 className="font-bold text-white text-sm">Active Joined Roster</h4>
                <p className="text-slate-400 text-[10px]">
                  Real-time list of students connected in this interactive session.
                </p>
              </div>

              {participants.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">Classroom list is empty</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-[280px] mx-auto">
                    Students will show up here as soon as they log into their account, join via the code, or are simulated.
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10 text-slate-350 text-slate-300 font-bold uppercase tracking-wider h-10 px-4">
                        <th className="py-2.5 px-4 font-semibold">Student Name</th>
                        <th className="py-2.5 px-4 font-semibold">Student ID</th>
                        <th className="py-2.5 px-4 font-semibold">Email</th>
                        <th className="py-2.5 px-4 font-semibold">Status Badge</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Details / Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {participants.map((p) => {
                        const sub = submissions.find((s) => s.studentUid === p.studentUid);
                        return (
                          <tr key={p.studentUid} className="hover:bg-white/5 text-white border-b border-white/5 h-12">
                            <td className="py-3 px-4 font-bold text-white">{p.fullName}</td>
                            <td className="py-3 px-4 font-mono text-slate-500">{p.studentId}</td>
                            <td className="py-3 px-4 text-slate-500 truncate max-w-[120px]">{p.email}</td>
                            <td className="py-3 px-4">
                              {p.status === "submitted" ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/20">
                                  Submitted 🏆
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/20">
                                  Joined 🟢
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-right">
                              {sub ? (
                                <div className="text-white">
                                  <span className="font-bold">{sub.score} pts</span>
                                  <span className="text-slate-400 text-[10px] block">
                                    ({sub.correctCount} correct)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300 italic">No submission</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Question snapshots table */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl text-white mt-6">
            <h4 className="font-bold text-white text-xs uppercase tracking-wide mb-4 flex items-center">
              <HelpCircle className="h-4.5 w-4.5 text-indigo-500 mr-2" />
              Active Lesson Questions ({session.questionSnapshot.length})
            </h4>

            <div className="space-y-3">
              {session.questionSnapshot.map((q, idx) => {
                return (
                  <div key={q.questionId} className="p-3.5 bg-white/5 rounded-xl text-xs hover:bg-white/10 border border-white/10 transition-all text-white">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-white">
                        Question {idx + 1}: {q.questionText}
                      </span>
                      <span className="bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 font-mono text-[10px] px-2.5 py-0.5 rounded-full block">
                        {q.points} pts
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/10">
                      {q.choices.map((choice, cIdx) => (
                        <div
                          key={cIdx}
                          className={`p-2 rounded font-medium flex items-center ${
                            cIdx === q.correctChoiceIndex
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                              : "bg-white text-slate-600 border border-slate-100"
                          }`}
                        >
                          <span className="font-bold font-mono mr-1.5">{String.fromCharCode(65 + cIdx)}.</span>
                          {choice}
                          {cIdx === q.correctChoiceIndex && (
                            <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                              Correct Key
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
