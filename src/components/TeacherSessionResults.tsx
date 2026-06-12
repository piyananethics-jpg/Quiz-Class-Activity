/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { SessionDoc, CourseDoc } from "../types";
import {
  getParticipants,
  getSubmissions,
  getLeaderboard,
  getCourses,
  getSections,
  getLessons,
  getEnrollments,
  finalizeSessionScores
} from "../dbStore";
import { Top5Leaderboard } from "./Top5Leaderboard";
import {
  ChevronLeft,
  RefreshCw,
  FileDown,
  Award,
  Users,
  TrendingUp,
  Sliders,
  CheckCircle,
  HelpCircle,
  Clock,
  Briefcase,
  AlertCircle
} from "lucide-react";
import { motion } from "motion/react";

interface TeacherSessionResultsProps {
  session: SessionDoc;
  onBack: () => void;
  triggerRefresh: () => void;
}

export function TeacherSessionResults({ session, onBack, triggerRefresh }: TeacherSessionResultsProps) {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Core entities mapping
  const course = getCourses().find((c) => c.courseId === session.courseId);
  const section = course ? getSections(course.courseId).find((s) => s.sectionId === session.sectionId) : undefined;
  const lesson = course ? getLessons(course.courseId).find((l) => l.lessonId === session.lessonId) : undefined;
  const enrollments = course && section ? getEnrollments(course.courseId, section.sectionId) : [];

  // Live collections
  const participants = getParticipants(session.sessionId);
  const submissions = getSubmissions(session.sessionId);
  const leaderboard = getLeaderboard(session.sessionId);

  // Sort submissions by score descending, then duration ascending for full report clarity
  const sortedSubmissions = [...submissions].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.durationMs - b.durationMs;
  });

  // Stats Calculations
  const joinedCount = participants.length;
  const submittedCount = submissions.length;
  const scoredCount = submissions.filter((s) => s.status === "scored").length;

  const scores = submissions.map((s) => s.score);
  const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;

  const handleFinalize = async () => {
    setLoading(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      await finalizeSessionScores(session.sessionId);
      setSuccessMsg("All digital submissions lock-graded! Live top-5 leaderboard built & committed successfully.");
      triggerRefresh();
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to finalize session scores.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      // Columns: Session ID, Course Code, Section Name, Lesson Title, Student ID, Full Name, Email, Score, Max Score, Correct Answers, Total Questions, Duration, Submission Time, Status
      const headers = [
        "Session ID",
        "Course Code",
        "Section Name",
        "Lesson Title",
        "Student ID",
        "Full Name",
        "Email",
        "Score",
        "Max Score",
        "Correct Answers",
        "Total Questions",
        "Duration (seconds)",
        "Submission Time",
        "Status"
      ];

      const rows = submissions.map((sub) => {
        const subTimeText = sub.submittedAt ? new Date(sub.submittedAt).toISOString() : "N/A";
        return [
          session.sessionId,
          course ? course.courseCode : "N/A",
          section ? section.sectionName : "N/A",
          lesson ? lesson.title : "N/A",
          sub.studentId,
          sub.fullName || sub.studentDisplayName,
          sub.studentEmail,
          sub.score,
          sub.maxScore,
          sub.correctCount,
          session.totalQuestions,
          (sub.durationMs / 1000).toFixed(1),
          subTimeText,
          sub.status
        ];
      });

      // Escape fields & join with commas
      const csvContent = [
        headers.join(","),
        ...rows.map((r) =>
          r
            .map((val) => {
              const str = String(val ?? "").replace(/"/g, '""');
              return str.includes(",") || str.includes("\n") || str.includes('"') ? `"${str}"` : str;
            })
            .join(",")
        )
      ].join("\n");

      // Set UTF-8 BOM
      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `session_${session.sessionId}_grading_report_${course?.courseCode || "quiz"}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setErrorMsg("Failed to export: " + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-6 text-white font-sans">
      {/* Session Breadcrumb & Header Box */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 border border-white/10 backdrop-blur-xl p-5 rounded-2xl shadow-xl animate-fade-in">
        <div className="space-y-1.5">
          <button
            onClick={onBack}
            className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-all cursor-pointer font-semibold group"
          >
            <ChevronLeft className="h-4 w-4 transform group-hover:-translate-x-0.5 transition-transform" />
            <span>Return to sessions board</span>
          </button>
          
          <div className="flex items-center space-x-3 pt-1">
            <span className="text-[10px] uppercase font-mono bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-400/25 px-2.5 py-0.5 rounded-full select-none">
              Grading Summary
            </span>
            <span className="text-slate-400 text-xs">ID: {session.sessionId}</span>
          </div>

          <h2 className="text-xl font-extrabold text-white tracking-tight leading-none pt-1">
            {course ? `${course.courseCode}: ${course.courseName}` : "AU Class Quiz Module"}
          </h2>

          <p className="text-xs text-slate-400">
            Section: <span className="font-bold text-slate-205 text-slate-200">{section ? section.sectionName : "Default Section"}</span> | Lesson: <span className="font-bold text-slate-205 text-slate-205 text-slate-200">{lesson ? lesson.title : "Live Quiz"}</span>
          </p>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2.5 self-start md:self-auto">
          {session.status === "closed" ? (
            <span className="inline-flex px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 uppercase tracking-wider items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              Evaluation Finalized
            </span>
          ) : (
            <span className="inline-flex px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/20 uppercase tracking-wider items-center gap-1 animate-pulse">
              <Clock className="h-3.5 w-3.5" />
              Scoring Review Pending
            </span>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 text-xs rounded-xl flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border-l-4 border-rose-500 text-rose-800 text-xs rounded-xl flex items-center space-x-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {/* Analytics Dashboard Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Participation summary */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider font-mono">
            <span>Room Attendance</span>
            <Users className="h-4.5 w-4.5 text-indigo-400" />
          </div>
          <div className="pt-1.5 flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-white">{submittedCount}</span>
            <span className="text-xs text-slate-400">/ {joinedCount} joined ({enrollments.length} enrolled)</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-indigo-500 h-1.5 rounded-full"
              style={{ width: `${joinedCount > 0 ? Math.min(100, Math.round((submittedCount / joinedCount) * 100)) : 0}%` }}
            ></div>
          </div>
          <span className="text-[10px] text-slate-400 block font-sans">
            Submit Rate: {joinedCount > 0 ? Math.round((submittedCount / joinedCount) * 100) : 0}% of quiz room attendees
          </span>
        </div>

        {/* Avg Score */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider font-mono">
            <span>Average Evaluation</span>
            <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div className="pt-1.5 flex items-baseline space-x-1">
            <span className="text-2xl font-black text-emerald-400">{averageScore}</span>
            <span className="text-xs text-slate-400">pts / {session.maxScore} max</span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-400 h-1.5 rounded-full"
              style={{ width: `${session.maxScore > 0 ? Math.round((averageScore / session.maxScore) * 100) : 0}%` }}
            ></div>
          </div>
          <span className="text-[10px] text-slate-400 block font-sans">
            Accurate Response Metric: {session.maxScore > 0 ? Math.round((averageScore / session.maxScore) * 105 || 0) / 1.05 : 0}% Correct Rate
          </span>
        </div>

        {/* Top score */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider font-mono">
            <span>High Scoring Peak</span>
            <Award className="h-4.5 w-4.5 text-amber-400 animate-pulse" />
          </div>
          <div className="pt-2">
            <span className="text-2xl font-black text-amber-300 font-mono">{highestScore}</span>
            <span className="text-slate-400 text-xs font-sans block mt-1 leading-normal">
              Acquired by session leader
            </span>
          </div>
        </div>

        {/* Low score */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider font-mono">
            <span>Lower scoring bound</span>
            <Sliders className="h-4.5 w-4.5 text-purple-400" />
          </div>
          <div className="pt-2">
            <span className="text-2xl font-black text-purple-300 font-mono">{lowestScore}</span>
            <span className="text-slate-400 text-xs font-sans block mt-1 leading-normal">
              Minimum scored submission
            </span>
          </div>
        </div>
      </div>

      {/* Action triggers and visual leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Controls and Operations Dock */}
        <div className="lg:col-span-1 bg-white/5 border border-white/10 backdrop-blur-xl p-6 rounded-2xl space-y-4">
          <h3 className="font-bold text-white text-sm font-sans border-b border-white/5 pb-2 uppercase tracking-wider">
            Evaluation Control Board
          </h3>

          <div className="space-y-2.5">
            {/* Finalization Action Button */}
            <button
              id="btn-finalize-scores"
              disabled={loading || session.status === "closed" && submissions.every(s => s.status === "scored")}
              onClick={handleFinalize}
              className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer border ${
                session.status === "closed" && submissions.every(s => s.status === "scored")
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300 opacity-60 cursor-not-allowed"
                  : "bg-indigo-500 hover:bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/10"
              }`}
            >
              {loading ? (
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              <span>
                {session.status === "closed" && submissions.every(s => s.status === "scored")
                  ? "Grading Review Locked"
                  : "Finalize & Record Scores"}
              </span>
            </button>

            {/* Refresh Action Trigger */}
            <button
              id="btn-refresh-results"
              onClick={triggerRefresh}
              className="w-full py-2.5 px-4 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-205 text-slate-200 hover:text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh live replies</span>
            </button>

            {/* CSV Download Trigger */}
            <button
              id="btn-export-csv"
              disabled={submissions.length === 0}
              onClick={handleExportCSV}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-600 border border-emerald-400 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-md transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Download Session CSV</span>
            </button>
          </div>

          <div className="bg-slate-950/60 p-4 border border-white/5 rounded-xl space-y-2 text-[10.5px] text-slate-400 font-sans leading-relaxed">
            <span className="font-bold text-white block font-mono text-[9px] uppercase tracking-wider text-slate-200">
              Scoring Guidance Mode
            </span>
            <p>
              Students taking the quiz submit choices resulting in a <span className="font-bold underline text-indigo-300">scored_pending</span> status.
              Clicking <span className="font-bold text-slate-200">"Finalize & Record Scores"</span> executes grading, unlocks direct student review dashboards, updates transcripts, and compiles the dynamic scoreboard standings.
            </p>
          </div>
        </div>

        {/* Podium Leaderboard Stands */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 backdrop-blur-xl p-5 rounded-2xl">
          <Top5Leaderboard entries={leaderboard} showDetails={true} />
        </div>
      </div>

      {/* Comprehensive Student Submissions Table List */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div>
            <h3 className="font-semibold text-white text-sm font-sans tracking-tight">
              AUM Classroom Participant Report
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Currently displaying {submissions.length} student answers recorded in Firestore.
            </p>
          </div>
          <span className="font-mono text-[10px] bg-white/5 text-slate-300 border border-white/10 px-2.5 py-1 rounded-lg">
            Scored Count: {scoredCount} / {submissions.length}
          </span>
        </div>

        {submissions.length === 0 ? (
          <div className="text-center py-12">
            <Briefcase className="h-10 w-10 text-slate-500 mx-auto opacity-30 mb-2" />
            <span className="text-xs text-slate-400 font-sans font-medium italic block">
              No replies submitted yet. Simulate classroom participation on the session monitor tab.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl">
            <table className="w-full text-left text-xs bg-slate-900/40 divide-y divide-white/5">
              <thead className="bg-[#19192c] text-slate-400 uppercase tracking-wider text-[9px] font-bold font-mono">
                <tr>
                  <th className="px-4 py-3">Rank No</th>
                  <th className="px-4 py-3">Reg ID</th>
                  <th className="px-4 py-3">Full Student Name</th>
                  <th className="px-4 py-3">University Email</th>
                  <th className="px-4 py-3 text-center">Commits</th>
                  <th className="px-4 py-3 text-center">Correct Count</th>
                  <th className="px-4 py-3 text-center">Score Result</th>
                  <th className="px-4 py-3 text-center">Duration</th>
                  <th className="px-4 py-3">Submission UTC</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {sortedSubmissions.map((sub, sIdx) => {
                  const durationSeconds = (sub.durationMs / 1000).toFixed(1);
                  const isLeader = leaderboard.slice(0, 3).some((l) => l.studentUid === sub.studentUid);

                  return (
                    <tr
                      id={`student-report-row-${sub.studentUid}`}
                      key={sub.studentUid}
                      className={`hover:bg-white/5 transition-colors ${
                        isLeader ? "bg-amber-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3.5 font-mono text-slate-400 font-bold">
                        {sIdx + 1}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-350 text-slate-300">
                        {sub.studentId}
                      </td>
                      <td className="px-4 py-3.5 font-sans font-bold text-white">
                        {sub.fullName || sub.studentDisplayName}
                      </td>
                      <td className="px-4 py-3.5 text-slate-400 font-mono text-[11px]">
                        {sub.studentEmail}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-slate-350">
                        {sub.answeredCount} / {session.totalQuestions}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-bold text-emerald-400">
                        {sub.correctCount}
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono font-extrabold text-sm text-emerald-400 text-emerald-300">
                        {sub.score} <span className="text-[10px] text-slate-405 text-slate-400 font-medium">pts</span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono text-[11px] text-slate-400">
                        {durationSeconds}s
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[10px] text-slate-400">
                        {sub.submittedAt ? new Date(sub.submittedAt).toLocaleTimeString() : "Pending"}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        {sub.status === "scored" ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/25 border border-emerald-500/20 text-emerald-300 font-mono">
                            Scored
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/25 border border-amber-500/20 text-amber-300 font-mono animate-pulse">
                            Pending
                          </span>
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
    </div>
  );
}
