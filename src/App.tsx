/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Navigation } from "./components/Navigation";
import { TeacherDashboard } from "./components/TeacherDashboard";
import { StudentPortal } from "./components/StudentPortal";
import { LoadingScreen } from "./components/LoadingScreen";
import { RoleSetupPage } from "./components/RoleSetupPage";
import { AccessDeniedPage } from "./components/AccessDeniedPage";
import { subscribeToDB, resetLocalDatabase, getCourses } from "./dbStore";
import { useAuth } from "./context/AuthContext";
import { GraduationCap, Users, ShieldAlert, KeyRound, Sparkles, UserCheck } from "lucide-react";

export default function App() {
  const {
    profile,
    role,
    loading,
    error,
    signInWithGoogle,
    signOutUser,
    simulateSignIn,
    clearError
  } = useAuth();

  const [splitScreen, setSplitScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"teacher" | "student">("teacher");
  const [tick, setTick] = useState(0);

  // Custom Simulator Form Inputs
  const [simName, setSimName] = useState("");
  const [simEmail, setSimEmail] = useState("");
  const [simRole, setSimRole] = useState<"teacher" | "student">("teacher");
  const [simStudentId, setSimStudentId] = useState("");

  // Re-sync local state counts on changes
  useEffect(() => {
    const unsubscribe = subscribeToDB(() => {
      setTick((prev) => prev + 1);
    });
    return () => unsubscribe();
  }, []);

  // Bidirectional Hash <-> activeTab synchronization
  useEffect(() => {
    const handleHashSync = () => {
      const hash = window.location.hash || "";
      if (hash.startsWith("#/student")) {
        setActiveTab("student");
      } else if (hash.startsWith("#/teacher")) {
        setActiveTab("teacher");
      }
    };

    window.addEventListener("hashchange", handleHashSync);
    window.addEventListener("popstate", handleHashSync);
    handleHashSync(); // check initially

    return () => {
      window.removeEventListener("hashchange", handleHashSync);
      window.removeEventListener("popstate", handleHashSync);
    };
  }, []);

  useEffect(() => {
    const currentHash = window.location.hash || "";
    if (activeTab === "teacher" && !currentHash.startsWith("#/teacher")) {
      window.location.hash = "#/teacher/live";
    } else if (activeTab === "student" && !currentHash.startsWith("#/student")) {
      window.location.hash = "#/student/join";
    }
  }, [activeTab]);

  // Sync active view based on actual user role
  useEffect(() => {
    if (role && !splitScreen) {
      const currentHash = window.location.hash || "";
      if (!currentHash.startsWith("#/student") && !currentHash.startsWith("#/teacher")) {
        setActiveTab(role);
      }
    }
  }, [role, splitScreen]);

  const triggerRefresh = () => {
    setTick((prev) => prev + 1);
  };

  const handleReset = () => {
    resetLocalDatabase();
    setSplitScreen(false);
    if (role) {
      setActiveTab(role);
    }
    triggerRefresh();
  };

  // Render Loader
  if (loading) {
    return (
      <LoadingScreen message="Resolving secure AU classroom channels & syncing Firestore data..." />
    );
  }

  // Render Landing with Google Authentication / Testing Sandbox
  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none">
        {/* Decorative background blurs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="max-w-md w-full relative z-10 space-y-6">
          {/* Logo Title Group */}
          <div className="text-center space-y-3">
            <div className="mx-auto w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20 border border-indigo-400/20">
              <GraduationCap className="h-9 w-9 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white font-sans bg-gradient-to-r from-white via-slate-105 to-slate-200 bg-clip-text text-transparent">
                ClassPulse
              </h1>
              <p className="text-xs text-indigo-300 font-bold uppercase tracking-wider font-mono">
                AU Classroom Quiz & Live-Response
              </p>
            </div>
            <p className="text-xs text-slate-400">
              Engage students instantly with live quiz games, session statistics, and enrollment checkers.
            </p>
          </div>

          {/* Core Sign In Card */}
          <div className="bg-slate-900/60 border border-white/10 p-6 rounded-2xl backdrop-blur-xl shadow-2xl space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider text-center border-b border-white/5 pb-3">
              Academic Portal Authentication
            </h2>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300 flex items-start space-x-2 animate-pulse">
                <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold">Access Aborted:</span> {error}
                </div>
                <button onClick={clearError} className="text-red-400 hover:text-white font-mono text-[10px]">✕</button>
              </div>
            )}

            {/* Google Authentication Button */}
            <button
              id="google-signin-btn"
              onClick={signInWithGoogle}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center justify-center space-x-3 transition-all cursor-pointer shadow-lg shadow-indigo-600/15 group"
            >
              <KeyRound className="h-4 w-4 text-indigo-200 group-hover:rotate-12 transition-transform" />
              <span className="text-xs">Sign In with AU email (@au.edu)</span>
            </button>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 text-[9px] text-slate-500 uppercase font-mono tracking-widest">
                Grading Evaluation Sandbox
              </span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            {/* Simulated Live Roles Block */}
            <div className="space-y-3">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">
                Simulate Preconfigured Credentials (Dry Run)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => simulateSignIn("elena.vance@au.edu", "teacher", "Dr. Elena Vance")}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-white/20 transition-all text-left cursor-pointer"
                >
                  <p className="text-xs font-bold text-white">Elena Vance</p>
                  <p className="text-[9px] text-indigo-400 mt-1 font-mono">Instructor</p>
                </button>
                <button
                  type="button"
                  onClick={() => simulateSignIn("bob.carter@au.edu", "student", "Bob Carter", "64234589")}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 hover:border-white/20 transition-all text-left cursor-pointer"
                >
                  <p className="text-xs font-bold text-white">Bob Carter</p>
                  <p className="text-[9px] text-cyan-400 mt-1 font-mono">Student (#64234589)</p>
                </button>
              </div>

              {/* Advanced custom simulator */}
              <details className="text-xs text-slate-400">
                <summary className="cursor-pointer hover:text-white transition-colors text-center text-[10px] font-mono py-1">
                  Or launch a custom AU profile...
                </summary>
                <div className="bg-slate-950/40 p-4 border border-white/5 rounded-xl mt-2 space-y-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-bold">Email (Required: @au.edu)</label>
                    <input
                      type="email"
                      placeholder="someone@au.edu"
                      value={simEmail}
                      onChange={(e) => setSimEmail(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-white/10 rounded text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1 font-bold">Full Display Name</label>
                    <input
                      type="text"
                      placeholder="Alice Kingsleigh"
                      value={simName}
                      onChange={(e) => setSimName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-white/10 rounded text-slate-100"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 font-bold">Role Selection</label>
                      <select
                        value={simRole}
                        onChange={(e) => setSimRole(e.target.value as any)}
                        className="w-full px-2 py-1.5 text-xs bg-slate-900 border border-white/10 rounded text-slate-100"
                      >
                        <option value="teacher">Teacher</option>
                        <option value="student">Student</option>
                      </select>
                    </div>
                    {simRole === "student" && (
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1 font-bold">Student ID</label>
                        <input
                          type="text"
                          placeholder="64188990"
                          value={simStudentId}
                          onChange={(e) => setSimStudentId(e.target.value)}
                          className="w-full px-2 py-1 bg-slate-900 border border-white/10 rounded text-slate-100"
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!simEmail || !simName) {
                        alert("Please specify email and display name.");
                        return;
                      }
                      simulateSignIn(simEmail, simRole, simName, simRole === "student" ? simStudentId : undefined);
                    }}
                    className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs rounded transition-colors"
                  >
                    Launch Custom Sandbox
                  </button>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render role selection screen if user has authenticated but missing a role assignment
  if (!role) {
    return (
      <RoleSetupPage />
    );
  }

  // Render main core application layout
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased relative overflow-hidden font-sans">
      {/* Decorative ambient gradients */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="absolute -bottom-20 -right-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* Navigation Header */}
      <Navigation
        splitScreen={splitScreen}
        setSplitScreen={setSplitScreen}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReset={handleReset}
      />

      {/* Main Body Layout */}
      <div className="flex-1 flex flex-col relative z-10">
        {splitScreen ? (
          /* SIDE - BY - SIDE REAL - TIME MULTIPLAYER SPLIT VIEW */
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
            {/* Left Panel: Instructor console (Securely loaded) */}
            <div className="bg-slate-900/40 backdrop-blur-md overflow-y-auto max-h-[calc(100vh-4rem)] p-4">
              <div className="p-3 bg-white/5 border border-white/10 text-white rounded-2xl shadow-lg mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-455 bg-indigo-400 animate-pulse"></span>
                  <span className="text-xs font-bold font-sans uppercase tracking-wider text-slate-205 text-slate-200">
                    Dr. Elena Vance (Instructor Console Simulation)
                  </span>
                </div>
                <span className="text-[10px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-mono font-bold px-2 py-0.5 rounded-full">
                  Split Screen Loop
                </span>
              </div>
              <TeacherDashboard
                currentUser={{
                  uid: "teacher-1",
                  role: "teacher",
                  email: "elena.vance@au.edu",
                  displayName: "Dr. Elena Vance",
                  createdAt: Date.now()
                }}
                triggerRefresh={triggerRefresh}
                tick={tick}
              />
            </div>

            {/* Right Panel: Student portal (Active authenticated student) */}
            <div className="bg-slate-950/20 backdrop-blur-md overflow-y-auto max-h-[calc(100vh-4rem)] p-4">
              <div className="p-3 bg-white/10 border border-white/20 text-white rounded-2xl shadow-lg mb-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-405 bg-cyan-400 animate-pulse"></span>
                  <span className="text-xs font-bold font-sans uppercase tracking-wider text-slate-100">
                    Student Sandbox ({profile.displayName})
                  </span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-405 bg-emerald-400 animate-ping"></span>
                  <span className="text-[10px] text-emerald-355 text-emerald-300 font-bold uppercase tracking-wider font-mono">Lobby Synced</span>
                </div>
              </div>
              <StudentPortal
                currentUser={profile}
                triggerRefresh={triggerRefresh}
                tick={tick}
              />
            </div>
          </div>
        ) : (
          /* STANDARD ROUTE GUARDED FULL SCREEN VIEW */
          <div className="flex-1">
            {activeTab === "teacher" ? (
              // Secure Routing Check: If a student tries to navigate to teacher tabs, render AccessDeniedPage
              role !== "teacher" ? (
                <div className="py-12">
                  <AccessDeniedPage
                    onGoHome={() => setActiveTab(role === "student" ? "student" : "teacher")}
                    reason={`Required Role: teacher. Your authenticated campus account is set as a registered ${role || "student"}.`}
                  />
                </div>
              ) : (
                <TeacherDashboard
                  currentUser={profile}
                  triggerRefresh={triggerRefresh}
                  tick={tick}
                />
              )
            ) : (
              // Secure Routing Check: If a teacher tries to navigate to student tabs, render AccessDeniedPage
              role !== "student" ? (
                <div className="py-12">
                  <AccessDeniedPage
                    onGoHome={() => setActiveTab(role === "teacher" ? "teacher" : "student")}
                    reason={`Required Role: student. Your authenticated campus account is set as a registered ${role || "teacher"}.`}
                  />
                </div>
              ) : (
                <StudentPortal
                  currentUser={profile}
                  triggerRefresh={triggerRefresh}
                  tick={tick}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Styled minimalistic footer */}
      <footer className="bg-slate-950/60 backdrop-blur-md border-t border-white/5 py-4 text-center text-[10px] text-slate-505 text-slate-500 font-mono relative z-20">
        ClassPulse Live Session Platform • Fully Persistent Schema-Checked Layout • Frosted Glass Design Theme
      </footer>
    </div>
  );
}
