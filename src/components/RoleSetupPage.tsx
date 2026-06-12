import React, { useState } from "react";
import { GraduationCap, Users, ShieldCheck, ArrowRight, UserCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { UserRole } from "../types";

export function RoleSetupPage() {
  const { updateUserRole, profile } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [studentId, setStudentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setErrorMsg("Please select your academic account type.");
      return;
    }

    if (selectedRole === "student" && !studentId.trim()) {
      setErrorMsg("Students are required to enter their Student ID.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      await updateUserRole(selectedRole, selectedRole === "student" ? studentId.trim() : undefined);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to finalize account role selection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-[80vh]">
      <div className="w-full max-w-lg bg-slate-900/40 border border-white/10 backdrop-blur-2xl rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative lighting elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400 mb-4 animate-bounce">
            <UserCheck className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Complete Your AU Profile
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Hi {profile?.displayName || "there"}, please select your account role to access your classroom boards.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-red-500/10 border-l-4 border-red-500 text-red-300 text-sm font-medium rounded-r-xl">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Instructor role choice card */}
            <div
              type="button"
              onClick={() => {
                setSelectedRole("teacher");
                setErrorMsg(null);
              }}
              className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col text-left ${
                selectedRole === "teacher"
                  ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className={`p-2.5 rounded-xl border w-fit mb-4 ${
                selectedRole === "teacher" ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/20" : "bg-white/5 text-slate-350 border-white/10"
              }`}>
                <GraduationCap className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Academic Staff</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Choose this option if you are a lecturer or teaching instructor hosting active quizzes and lessons.
              </p>
            </div>

            {/* Student role choice card */}
            <div
              type="button"
              onClick={() => {
                setSelectedRole("student");
                setErrorMsg(null);
              }}
              className={`p-5 rounded-2xl border cursor-pointer transition-all flex flex-col text-left ${
                selectedRole === "student"
                  ? "border-cyan-500 bg-cyan-500/10 ring-2 ring-cyan-500/20"
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            >
              <div className={`p-2.5 rounded-xl border w-fit mb-4 ${
                selectedRole === "student" ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/20" : "bg-white/5 text-slate-350 border-white/10"
              }`}>
                <Users className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Student Portal</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Choose this option if you are enrolled in a class and need to participate in live quiz games.
              </p>
            </div>
          </div>

          {/* Conditional Student ID entry */}
          {selectedRole === "student" && (
            <div className="space-y-2 animate-fade-in">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                Student ID (8 digits) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                maxLength={10}
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ""))}
                placeholder="e.g. 65123456"
                className="w-full px-4 py-3 bg-slate-950/60 border border-white/15 focus:border-cyan-500 focus:outline-none rounded-xl text-white font-semibold tracking-wider font-mono text-sm placeholder-slate-600 transition-colors"
              />
            </div>
          )}

          {/* Verification info disclaimer card */}
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-white/5 text-[11px] leading-relaxed text-slate-400 flex items-start space-x-2.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>V1 Role Policy Check:</strong> Account roles are currently self-selected for immediate testing. Back-office instructor verification or administrative approval checks can be toggled on later.
            </span>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !selectedRole}
            className={`w-full py-3 rounded-xl font-bold text-sm tracking-wide transition-all ${
              selectedRole
                ? "bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer hover:shadow-lg shadow-indigo-500/10"
                : "bg-white/5 text-slate-500 cursor-not-allowed"
            } flex items-center justify-center space-x-2`}
          >
            <span>{isSubmitting ? "Saving Profile..." : "Setup & Continue to Dashboard"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
