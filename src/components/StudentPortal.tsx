/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { UserDoc, SessionDoc, SubmissionDoc, ParticipantDoc, LeaderboardDoc, AnswerItem } from "../types";
import {
  findSessionByJoinCode,
  joinActiveSession,
  submitQuizAnswers,
  getParticipants,
  getSubmissions,
  getLeaderboard,
  getSession,
  getSessions,
  createNewUser,
  getEnrollments,
  getCourses,
  getSections,
  getLessons,
  getOrCreateInProgressSubmission,
  saveDraftAnswers,
  submitStructuredQuizAnswers
} from "../dbStore";
import {
  ArrowRight,
  GraduationCap,
  PlayCircle,
  HelpCircle,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  LogOut,
  Trophy,
  Loader2,
  Sparkles,
  Info
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Top5Leaderboard } from "./Top5Leaderboard";

interface StudentPortalProps {
  currentUser: UserDoc;
  triggerRefresh: () => void;
  tick: number;
}

export function StudentPortal({ currentUser, triggerRefresh, tick }: StudentPortalProps) {
  // Current active joined session
  const [joinedSessionId, setJoinedSessionId] = useState<string>("");
  const session: SessionDoc | undefined = joinedSessionId ? getSession(joinedSessionId) : undefined;
  const course = session ? getCourses().find((c) => c.courseId === session.courseId) : undefined;
  const lesson = session ? getLessons(session.courseId).find((l) => l.lessonId === session.lessonId) : undefined;

  const [joinCodeInput, setJoinCodeInput] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Answers State: maps index of question snapshot to index of chosen choice
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  
  // Timer state for duration tracking
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const quizStartTimeRef = useRef<number>(0);

  // New Student Workspace states
  const [loadedDraft, setLoadedDraft] = useState(false);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  // Lazy initialize/load in-progress draft submission
  useEffect(() => {
    if (session && currentUser && session.status === "open") {
      try {
        const inProgressSub = getOrCreateInProgressSubmission(session.sessionId, currentUser.uid);
        if (inProgressSub && inProgressSub.status === "in_progress" && !loadedDraft) {
          const draftMap: Record<number, number> = {};
          inProgressSub.answers.forEach((item) => {
            const snapshotIdx = session.questionSnapshot.findIndex((q) => q.questionId === item.questionId);
            if (snapshotIdx >= 0) {
              draftMap[snapshotIdx] = item.selectedChoiceIndex;
            }
          });
          setSelectedAnswers(draftMap);
          setLoadedDraft(true);
        }
      } catch (err) {
        console.error("Failed to load or create draft submission:", err);
      }
    }
  }, [session, currentUser, loadedDraft]);

  // Handle single answer choice selections and draft updates
  const handleSelectChoice = (questionNoZeroBased: number, choiceIdx: number) => {
    if (!session || hasSubmitted) return;

    setSelectedAnswers((prev) => {
      const updated = {
        ...prev,
        [questionNoZeroBased]: choiceIdx
      };

      // Construct AnswerItem array for drafting update
      const answersToSave: AnswerItem[] = session.questionSnapshot.map((q, idx) => {
        const selected = idx === questionNoZeroBased ? choiceIdx : (prev[idx] !== undefined ? prev[idx] : -1);
        return {
          questionId: q.questionId,
          questionNo: idx + 1,
          selectedChoiceIndex: selected,
          answeredAt: Date.now()
        };
      }).filter((a) => a.selectedChoiceIndex !== -1);

      saveDraftAnswers(session.sessionId, currentUser.uid, answersToSave);
      return updated;
    });
  };

  // Registration states for creating a custom student profile
  const [showRegForm, setShowRegForm] = useState(false);
  const [regFullName, setRegFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regStudentId, setRegStudentId] = useState("");

  // Hash sync for Student URL route mapping
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash || "";
      const matchJoin = hash.match(/^#\/student\/join$/);
      const matchQuiz = hash.match(/^#\/student\/quiz\/([A-Za-z0-9_-]+)$/);
      
      if (matchQuiz) {
        const sessId = matchQuiz[1];
        if (joinedSessionId !== sessId) {
          const found = getSession(sessId);
          if (found) {
            setJoinedSessionId(sessId);
          }
        }
      } else if (matchJoin) {
        if (joinedSessionId) {
          setJoinedSessionId("");
        }
      }
    };

    window.addEventListener("hashchange", handleHash);
    handleHash(); // initial run

    return () => {
      window.removeEventListener("hashchange", handleHash);
    };
  }, [joinedSessionId]);

  // Sync state to URL hash
  useEffect(() => {
    if (joinedSessionId) {
      const expected = `#/student/quiz/${joinedSessionId}`;
      if (window.location.hash !== expected) {
        window.location.hash = expected;
      }
    } else {
      if (window.location.hash.startsWith("#/student/quiz/")) {
        window.location.hash = "#/student/join";
      }
    }
  }, [joinedSessionId]);

  // Read Deep-link connection parameters (?sessionId=...&code=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let hashUrl = window.location.hash || "";
    if (hashUrl.includes("?")) {
      const hashQuery = hashUrl.split("?")[1];
      const hashParams = new URLSearchParams(hashQuery);
      hashParams.forEach((val, key) => {
        params.set(key, val);
      });
    }

    const sessionIdParam = params.get("sessionId");
    const codeParam = params.get("code");

    if (codeParam) {
      setJoinCodeInput(codeParam);
      
      const found = findSessionByJoinCode(codeParam);
      if (found) {
        // Enforce STRICT case-insensitive enrollment checks
        const enrollments = getEnrollments(found.courseId, found.sectionId);
        const enrolled = enrollments.some(e => e.email.toLowerCase() === currentUser.email.toLowerCase());

        if (!enrolled) {
          const course = getCourses().find((c) => c.courseId === found.courseId);
          const sectionsList = getSections(found.courseId);
          const section = sectionsList.find((s) => s.sectionId === found.sectionId);

          const courseText = course ? `${course.courseCode} - ${course.courseName}` : found.courseId;
          const sectionText = section ? section.sectionName : found.sectionId;

          setErrorMsg(`Scan Aborted: Your campus account (${currentUser.email}) is not enrolled under ${courseText}, Section: ${sectionText}. Enroll under section workspace first before playing.`);
        } else {
          try {
            joinActiveSession(found.sessionId, currentUser.uid);
            setJoinedSessionId(found.sessionId);
            setSuccessMsg("Success! Automatically synced deep-link session via scanned QR code.");
            setTimeout(() => setSuccessMsg(""), 3500);
            triggerRefresh();
          } catch (e: any) {
            setErrorMsg(e.message || "Failed auto-synchronization.");
          }
        }
      } else {
        setErrorMsg(`Scanned connection failed: Access code "${codeParam}" is invalid or has expired.`);
      }
    }
  }, [currentUser, triggerRefresh]);

  // Clean up joinedSessionId state if the session is deleted/missing
  useEffect(() => {
    if (joinedSessionId && !session) {
      setJoinedSessionId("");
    }
  }, [joinedSessionId, session]);

  // Periodic polling to check session state (e.g., if draft goes to open, or open goes to closed)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (joinedSessionId) {
      interval = setInterval(() => {
        triggerRefresh();
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [joinedSessionId, triggerRefresh]);

  // Timer run loop when session is open and user hasn't submitted yet
  const hasSubmitted = session
    ? getSubmissions(session.sessionId).some((s) => s.studentUid === currentUser.uid)
    : false;

  useEffect(() => {
    let timerHandle: NodeJS.Timeout;
    if (session && session.status === "open" && !hasSubmitted) {
      // Set start time if not set yet
      if (quizStartTimeRef.current === 0) {
        quizStartTimeRef.current = Date.now();
      }
      timerHandle = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - quizStartTimeRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(timerHandle!);
    }
    return () => clearInterval(timerHandle);
  }, [session, hasSubmitted]);

  // Reset timer if session changes
  useEffect(() => {
    if (!joinedSessionId) {
      setElapsedSeconds(0);
      quizStartTimeRef.current = 0;
      setSelectedAnswers({});
    }
  }, [joinedSessionId]);

  const handleJoinSession = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const joinCodeClean = joinCodeInput.trim().toUpperCase();
    if (!joinCodeClean) {
      setErrorMsg("Please enter an access Code.");
      return;
    }

    const found = findSessionByJoinCode(joinCodeClean);
    if (!found) {
      setErrorMsg("No active quiz session found matching this Join Code. Check with your instructor!");
      return;
    }

    // STRICT case-insensitive enrollment checking
    const enrollments = getEnrollments(found.courseId, found.sectionId);
    const enrolled = enrollments.some(e => e.email.toLowerCase() === currentUser.email.toLowerCase());

    if (!enrolled) {
      const course = getCourses().find((c) => c.courseId === found.courseId);
      const sectionsList = getSections(found.courseId);
      const section = sectionsList.find((s) => s.sectionId === found.sectionId);

      const courseCode = course ? course.courseCode : "N/A";
      const courseName = course ? course.courseName : "Unknown Course";
      const sectionName = section ? section.sectionName : "Unknown Section";

      setErrorMsg(`Access Blocked: Your student email (${currentUser.email.toLowerCase()}) is not registered in list of enrollments for course "${courseCode}: ${courseName}" - Section: "${sectionName}". Ask Dr. Elena Vance to import your record before trying to participate.`);
      return;
    }

    try {
      // Register join event in simulator database
      joinActiveSession(found.sessionId, currentUser.uid);
      setJoinedSessionId(found.sessionId);
      setJoinCodeInput("");
      setSuccessMsg("Success! Connected to the classroom live session.");
      setTimeout(() => setSuccessMsg(""), 3500);
      triggerRefresh();
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to join session.");
    }
  };

  const handleRegisterStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName || !regEmail || !regStudentId) return;
    const customUid = "stu_" + Math.random().toString(36).substring(2, 9);
    createNewUser(customUid, regFullName.trim(), regEmail.trim(), "student", regStudentId.trim());
    
    // Reset
    setShowRegForm(false);
    setRegFullName("");
    setRegEmail("");
    setRegStudentId("");
    setSuccessMsg("Student profile created successfully! Select it in the account top bar menu.");
    setTimeout(() => setSuccessMsg(""), 4000);
    triggerRefresh();
  };

  const handleSubmitAnswers = () => {
    if (!session) return;

    // Compile into final formal AnswerItem list representing all questions
    const answersList: AnswerItem[] = session.questionSnapshot.map((q, idx) => {
      const chosenChoice = selectedAnswers[idx] !== undefined ? selectedAnswers[idx] : -1;
      return {
        questionId: q.questionId,
        questionNo: idx + 1,
        selectedChoiceIndex: chosenChoice,
        answeredAt: Date.now()
      };
    }).filter((item) => item.selectedChoiceIndex !== -1);

    const totalElapsedMs = Date.now() - quizStartTimeRef.current;

    try {
      submitStructuredQuizAnswers(session.sessionId, currentUser.uid, answersList, totalElapsedMs);
      setSuccessMsg("Quiz submitted successfully! Real-time responses synchronized.");
      setConfirmModalOpen(false);
      setTimeout(() => setSuccessMsg(""), 4000);
      triggerRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit answers.");
    }
  };

  const handleLeaveSession = () => {
    setJoinedSessionId("");
    setSelectedAnswers({});
    setElapsedSeconds(0);
    quizStartTimeRef.current = 0;
  };

  // Helper getters
  const participants = session ? getParticipants(session.sessionId) : [];
  const submissions = session ? getSubmissions(session.sessionId) : [];
  const leaderboard = session ? getLeaderboard(session.sessionId) : [];
  const mySubmission = session ? submissions.find((s) => s.studentUid === currentUser.uid) : undefined;
  const myLeaderboardRankIdx = session ? leaderboard.findIndex((l) => l.studentUid === currentUser.uid) : -1;

  // Render Section 1: Dashboard Join Code Form (User not connected to session yet)
  if (!joinedSessionId || !session) {
    return (
      <div className="max-w-xl mx-auto space-y-6 py-8 px-4">
        {/* Banner Card */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 flex flex-col items-center text-center space-y-4 text-white shadow-xl animate-fade-in">
          <div className="h-12 w-12 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/20">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Student Portal Workspace</h2>
            <p className="text-xs text-slate-500 mt-1">
              Active profile: <span className="font-bold text-indigo-300">{currentUser.displayName}</span> (ID: {currentUser.studentId || "None"})
            </p>
          </div>
        </div>

        {/* Join Code Panel */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-5 shadow-xl text-white">
          <div className="space-y-1">
            <h3 className="font-bold text-white text-sm">Enter Access Code</h3>
            <p className="text-[11px] text-slate-400">
              Your instructor will launch a live Quiz Session and show a 6-digit Join Code.
            </p>
          </div>

          <form onSubmit={handleJoinSession} className="space-y-3">
            <div className="relative">
              <input
                id="input-join-code"
                type="text"
                maxLength={9}
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="E.G. 2X8F9A"
                className="w-full text-center px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-lg font-mono font-bold tracking-widest text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 glass-input"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border-l-4 border-rose-500 text-rose-800 text-xs rounded flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 text-xs rounded flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
            )}

            <button
              id="btn-submit-code"
              type="submit"
              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center space-x-2 cursor-pointer shadow-sm transition-all"
            >
              <span>Connect to Quiz Live</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Quick simulation helper info */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-[11px] text-slate-400 leading-normal flex items-start space-x-2.5">
            <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-white block">How to test this?</span>
              Switch accounts in the header to <span className="font-bold underline">Dr. Elena Vance (teacher)</span>, launch to create a session which displays its join code, switch back here, enter the code, and take the live exam!
            </div>
          </div>
        </div>

        {/* Academic Session History Tracker */}
        {(() => {
          const allSessionsList = getSessions();
          // Find either submission or participant record
          const myHistory = allSessionsList.filter((sess) => {
            const subs = getSubmissions(sess.sessionId);
            const parts = getParticipants(sess.sessionId);
            return subs.some((s) => s.studentUid === currentUser.uid) || 
                   parts.some((p) => p.studentUid === currentUser.uid);
          });

          if (myHistory.length === 0) return null;

          return (
            <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-4 text-white shadow-xl animate-fade-in">
              <div>
                <h3 className="font-bold text-white text-sm flex items-center">
                  <Trophy className="h-4.5 w-4.5 text-amber-400 mr-2" />
                  Your Quiz History & Results
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">
                  Historical scores and walkthrough feedback for sessions you participated in.
                </p>
              </div>

              <div className="space-y-3">
                {myHistory.map((sess) => {
                  const sessCourse = getCourses().find((c) => c.courseId === sess.courseId);
                  const sessLesson = sessCourse ? getLessons(sessCourse.courseId).find((l) => l.lessonId === sess.lessonId) : undefined;
                  const subs = getSubmissions(sess.sessionId);
                  const subIdDoc = subs.find((sub) => sub.studentUid === currentUser.uid);

                  return (
                    <div
                      key={sess.sessionId}
                      className="bg-slate-900/40 border border-white/5 rounded-xl p-3.5 flex items-center justify-between hover:border-indigo-500/40 hover:bg-white/5 transition-all text-xs text-white"
                    >
                      <div className="space-y-1 pr-4 min-w-0 text-left">
                        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400 block truncate">
                          {sessCourse ? sessCourse.courseCode : "AU COURSE"} • {sessLesson ? sessLesson.title : "Lesson Quiz"}
                        </span>
                        <span className="font-bold text-white block truncate text-xs">
                          {sessLesson ? sessLesson.description || "Active Participation" : "Lesson Details"}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          ID: <span className="font-mono text-slate-300 font-bold">{sess.sessionId}</span>
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0 text-right">
                        <div>
                          {subIdDoc ? (
                            <>
                              <span className="font-black text-emerald-400 block text-xs">
                                {subIdDoc.score} <span className="text-[10px] font-medium text-slate-400">/ {subIdDoc.maxScore} pts</span>
                              </span>
                              <span className={`text-[9px] font-bold uppercase mt-0.5 inline-block ${
                                subIdDoc.status === "scored" ? "text-emerald-300/80" : "text-amber-300/80 animate-pulse"
                              }`}>
                                {subIdDoc.status === "scored" ? "Scored" : "Locked pending"}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-rose-400 text-xs block">0 / {sess.maxScore}</span>
                              <span className="text-[8px] uppercase font-mono text-rose-300/80 block">No answers committed</span>
                            </>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setJoinedSessionId(sess.sessionId);
                            triggerRefresh();
                          }}
                          className="p-1.5 px-3 bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold rounded-lg text-[10px] uppercase tracking-wider cursor-pointer transition-colors shadow"
                        >
                          Review
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Custom Student Registration Panel */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-5 mt-4 text-center text-white shadow-xl">
          {!showRegForm ? (
            <button
              id="btn-toggle-student-reg"
              onClick={() => setShowRegForm(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline"
            >
              Want to create a custom student identity? Register here.
            </button>
          ) : (
            <form onSubmit={handleRegisterStudent} className="space-y-3.5 text-left bg-white/5 border border-white/10 rounded-xl p-4 text-white animate-fade-in">
              <h4 className="font-bold text-white text-xs text-center border-b border-white/10 pb-2">
                Register Student Account
              </h4>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={regFullName}
                  onChange={(e) => setRegFullName(e.target.value)}
                  placeholder="E.g. Emily Watson"
                  className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white glass-input focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">University Email</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="emily@university.edu"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Student registration ID</label>
                <input
                  type="text"
                  required
                  value={regStudentId}
                  onChange={(e) => setRegStudentId(e.target.value)}
                  placeholder="64888256"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-1 border-t border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setShowRegForm(false)}
                  className="px-3 py-1 bg-white/10 text-slate-300 hover:bg-white/15 rounded-lg text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-md"
                >
                  Create Profile
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Render Sub-Views inside Joined Active Session
  const isDraftState = session.status === "draft";
  const isOpenState = session.status === "open";
  const isClosedState = session.status === "closed";

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-8 px-4">
      {/* Session Header Panel */}
      <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 text-white shadow-xl animate-fade-in">
        <div>
          <span className="text-xs uppercase font-mono tracking-wider text-indigo-300 bg-indigo-500/20 border border-indigo-500/20 px-2 py-0.5 rounded-full font-bold">
            Live Quiz connected
          </span>
          <h3 className="text-lg font-bold text-white mt-1 leading-tight">
            {session.questionSnapshot.length > 0 ? "Interactive Classroom Quiz Session" : "Standby Class Session"}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Access Code: <span className="font-mono text-indigo-300 font-bold bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded">{session.joinCode}</span> | Instructor Uid: {session.teacherUid}
          </p>
        </div>

        <button
          id="btn-leave-session"
          onClick={handleLeaveSession}
          className="text-xs text-rose-400 hover:text-rose-300 font-bold flex items-center space-x-1 border border-rose-500/30 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 cursor-pointer transition-all self-start md:self-auto"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Exit Session</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 text-xs rounded">
          {successMsg}
        </div>
      )}

      {/* STATE 1: WAITING FOR INSTRUCTOR TO START (DRAFT) */}
      {isDraftState && (
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 text-center text-white shadow-xl space-y-4 animate-pulse">
          <div className="relative h-14 w-14 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center border border-indigo-500/20 mx-auto">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-300" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">Standby: Round not launched yet</h4>
            <p className="text-xs text-slate-500 max-w-[340px] mx-auto mt-1 leading-relaxed">
              Dr. Elena Vance has designed the lesson, but has not clicked the "🚀 Launch Session" button. Keep this tab open; the quiz questions will appear automatically as soon as she starts!
            </p>
          </div>
          <div className="pt-2">
            <span className="inline-flex px-2.5 py-0.5 rounded bg-blue-500/20 text-[10px] font-bold text-blue-300 uppercase tracking-widest border border-blue-500/20">
              Live status: Waiting
            </span>
          </div>
        </div>
      )}

      {/* STATE 2: ACTIVE QUIZ IN PROGRESS (OPEN & STUDENT NOT SUBMITTED YET) */}
      {isOpenState && !hasSubmitted && (
        <div className="space-y-6">
          {/* Active Quiz Timer & Course Header Bar */}
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl text-white rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-400 font-bold block">
                {course ? `${course.courseCode} • ${course.courseName}` : "Active Lesson Quiz"}
              </span>
              <h2 className="text-base font-extrabold text-white tracking-tight">
                {lesson ? lesson.title : "Classroom Lesson"}
              </h2>
            </div>
            <div className="flex items-center space-x-2 font-mono text-xs bg-slate-900/60 border border-white/5 px-3 py-1.5 rounded-xl">
              <Clock className="h-4 w-4 text-emerald-400" />
              <span className="text-slate-400 uppercase text-[9px] font-bold">Duration:</span>
              <span className="font-bold text-emerald-400 text-sm">{elapsedSeconds}s</span>
            </div>
          </div>

          {/* Quick HUD progress dot navigation */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium">
                Quiz Progress:{" "}
                <span className="font-bold text-white">
                  Question {currentQuestionIdx + 1} of {session.questionSnapshot.length}
                </span>
              </span>
              <span className="font-mono text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/20 px-2 py-0.5 rounded-full">
                Answered {Object.keys(selectedAnswers).length} / {session.questionSnapshot.length}
              </span>
            </div>

            {/* Pagination Circles */}
            <div className="flex flex-wrap gap-2 pt-1">
              {session.questionSnapshot.map((q, idx) => {
                const isCurrent = idx === currentQuestionIdx;
                const isAnswered = selectedAnswers[idx] !== undefined;

                return (
                  <button
                    key={q.questionId}
                    onClick={() => setCurrentQuestionIdx(idx)}
                    className={`h-7 w-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center transition-all cursor-pointer border ${
                      isCurrent
                        ? "bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20 scale-105"
                        : isAnswered
                        ? "bg-indigo-500/20 border-indigo-500/30 text-indigo-300"
                        : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Display Single Question in Scope */}
          {(() => {
            const q = session.questionSnapshot[currentQuestionIdx];
            if (!q) return null;
            const chosenChoiceIndex = selectedAnswers[currentQuestionIdx];

            return (
              <motion.div
                key={q.questionId}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 text-white shadow-xl space-y-5"
              >
                <div className="flex justify-between items-start gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold text-slate-400 tracking-widest uppercase">
                      Question {currentQuestionIdx + 1} of {session.questionSnapshot.length}
                    </span>
                    <h3 className="font-bold text-white text-base leading-relaxed">
                      {q.questionText}
                    </h3>
                  </div>
                  <span className="font-mono text-[9px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20 block whitespace-nowrap uppercase select-none">
                    {q.points} Points
                  </span>
                </div>

                {/* Choices list - Large customizable buttons with Letters A, B, C, D */}
                <div className="grid grid-cols-1 gap-3">
                  {q.choices.map((choice, cIdx) => {
                    const isSelected = chosenChoiceIndex === cIdx;
                    return (
                      <button
                        key={cIdx}
                        onClick={() => handleSelectChoice(currentQuestionIdx, cIdx)}
                        className={`p-4 rounded-xl border text-left text-xs cursor-pointer font-medium flex items-center transition-all ${
                          isSelected
                            ? "bg-indigo-500/20 border-indigo-400 text-white shadow-lg ring-1 ring-indigo-400"
                            : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        {/* Custom Letter circle badge */}
                        <div
                          className={`h-6 w-6 rounded-lg text-xs font-bold mr-3.5 flex items-center justify-center shrink-0 border ${
                            isSelected
                              ? "bg-indigo-500 border-indigo-400 text-white"
                              : "bg-white/10 border-white/10 text-slate-300"
                          }`}
                        >
                          {String.fromCharCode(65 + cIdx)}
                        </div>
                        <span className="leading-snug">{choice}</span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            );
          })()}

          {/* Previous / Next Actions Dock */}
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-xl text-white">
            <button
              disabled={currentQuestionIdx === 0}
              onClick={() => setCurrentQuestionIdx((p) => p - 1)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            >
              Previous
            </button>

            {currentQuestionIdx < session.questionSnapshot.length - 1 ? (
              <button
                onClick={() => setCurrentQuestionIdx((p) => p + 1)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-500 hover:bg-indigo-600 text-white transition-colors cursor-pointer"
              >
                Next Question
              </button>
            ) : (
              <button
                onClick={() => setConfirmModalOpen(true)}
                className="px-6 py-2 rounded-xl text-xs font-extrabold bg-emerald-500 hover:bg-emerald-600 text-white shadow-md shadow-emerald-500/10 transition-all flex items-center space-x-1 cursor-pointer"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Submit Quiz Session</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* STATE 3: ANSWERS SUBMITTED, BUT SESSION IS STILL OPEN (STANDBY INDICATOR) */}
      {isOpenState && hasSubmitted && (
        <div className="space-y-6 animate-fade-in font-sans">
          <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-8 text-center text-white shadow-xl space-y-4">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center border border-emerald-500/20 mx-auto animate-bounce">
              <Trophy className="h-8 w-8 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-emerald-400 font-mono font-bold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                Submitted successfully
              </span>
              <h4 className="text-lg font-bold text-white pt-2 animate-pulse font-sans">Your Answers Are Locked!</h4>
              <p className="text-xs text-slate-400 max-w-[420px] mx-auto leading-relaxed">
                Thank you for submitting, <span className="font-extrabold text-indigo-300">{currentUser.displayName}</span>. Your choices have been stored in Cloud Firestore.
              </p>
            </div>

            {/* Scoring Pending Status Card */}
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 max-w-sm mx-auto text-xs space-y-3">
              <span className="font-bold text-white text-xs block">Classroom Dynamic Stats</span>
              
              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                  <span className="text-[9px] text-slate-400 block mb-0.5">COMPLETED</span>
                  <span className="text-zinc-200 font-bold block text-sm">
                    {mySubmission?.answers.length || 0} / {session.questionSnapshot.length}
                  </span>
                </div>
                <div className="bg-white/5 p-2 rounded-xl border border-white/10">
                  <span className="text-[9px] text-slate-400 block mb-0.5">SCORING</span>
                  <span className="text-slate-300 font-bold block text-[10px] leading-normal truncate">
                    {mySubmission?.status === "scored" ? "Scored" : "Review Pending"}
                  </span>
                </div>
              </div>

              {mySubmission?.status === "scored" ? (
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 leading-snug">
                  Provisional Score Revealed: <span className="font-bold text-emerald-400">{mySubmission.score} Points</span>
                </div>
              ) : (
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300 leading-snug">
                  ⚠️ Score status: <span className="font-bold">Score will appear after teacher review.</span> Correct keys are securely hidden to prevent cheating.
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 italic pt-1">
              Please wait until your instructor locks and closes the live session. The scoreboard ranks and graded choices will show up immediately.
            </p>
          </div>
        </div>
      )}

      {/* STATE 4: SESSION COMPLETED/CLOSED - GRADING DETAILS & RETROSPECTIVE SCREEN */}
      {isClosedState && (
        <div className="space-y-6 font-sans">
          <div className="bg-indigo-950/30 border border-indigo-500/20 backdrop-blur-xl rounded-2xl p-6 shadow-xl text-center space-y-4 text-white">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20 animate-pulse">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] text-indigo-300 font-mono uppercase tracking-widest bg-indigo-500/20 border border-indigo-500/20 px-3 py-0.5 rounded-full font-bold inline-block">
                Quiz Round Completed
              </span>
              <h3 className="text-lg font-bold mt-2 text-white">Your Evaluation Results</h3>
              <p className="text-[11px] text-slate-400 mt-1">
                Classroom session closed at {mySubmission?.submittedAt ? new Date(mySubmission.submittedAt).toLocaleTimeString() : "Session closure"}.
              </p>
            </div>

            {/* Score HUD Display */}
            {(() => {
              const answersMap = mySubmission?.answers || [];
              let verifiedScore = mySubmission?.score || 0;
              let verifiedCorrectCount = mySubmission?.correctCount || 0;

              // If scored_pending and we have correct Choice index in snapshot, we can grade it in real-time
              const canCalculateNow = session.questionSnapshot.every(q => q.correctChoiceIndex !== undefined);
              if (canCalculateNow && mySubmission) {
                verifiedScore = 0;
                verifiedCorrectCount = 0;
                session.questionSnapshot.forEach((q) => {
                  const match = answersMap.find(a => a.questionId === q.questionId);
                  if (match && match.selectedChoiceIndex === q.correctChoiceIndex) {
                    verifiedScore += q.points;
                    verifiedCorrectCount++;
                  }
                });
              }

              const accuracyRate = session.questionSnapshot.length > 0 
                ? Math.round((verifiedCorrectCount / session.questionSnapshot.length) * 100)
                : 0;

              return (
                <div className="space-y-4">
                  {mySubmission ? (
                    <div className="grid grid-cols-3 gap-3 pt-2 max-w-md mx-auto text-xs font-mono">
                      <div className="bg-slate-900/60 p-3 rounded-xl border border-white/10 flex flex-col justify-center">
                        <span className="text-[9px] text-indigo-400 block mb-1">FINAL SCORE</span>
                        <span className="text-base font-extrabold text-emerald-400 block">{verifiedScore} pts</span>
                      </div>
                      <div className="bg-slate-900/60 p-3 rounded-xl border border-white/10 flex flex-col justify-center font-bold">
                        <span className="text-[9px] text-indigo-400 block mb-1 font-mono">ACCURACY</span>
                        <span className="text-base font-extrabold text-white block">
                          {verifiedCorrectCount} / {session.questionSnapshot.length}
                        </span>
                      </div>
                      <div className="bg-slate-900/60 p-3 rounded-xl border border-white/10 flex flex-col justify-center">
                        <span className="text-[9px] text-indigo-400 block mb-1">RANKING</span>
                        <span className="text-base font-extrabold text-amber-400 block">
                          {myLeaderboardRankIdx >= 0 ? `#${myLeaderboardRankIdx + 1}` : "N/A"}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs leading-normal">
                      Missing submission: You were connected as a participant in this classroom session but didn't commit final responses before block closure.
                    </div>
                  )}

                  {/* Top 5 Leaderboard Standings for Student Portal */}
                  <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-4.5 text-left">
                    <Top5Leaderboard entries={leaderboard} />
                  </div>

                  {/* Dev / Teacher Comments note */}
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 text-left text-slate-300 leading-normal">
                    <span className="font-bold text-[9.5px] uppercase tracking-wider text-slate-200 block mb-1 font-mono">
                      Developer & Grading Security Note
                    </span>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                      This classroom scoring flow is built for real-time local learning engagement. Core answer keys are fully restricted from student retrieval while the session is open to enforce integrity.
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Detailed Question Review Keys */}
          {mySubmission && (
            <div className="space-y-4">
              <div className="flex justify-between items-center px-1">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider">
                  Post-Quiz Answer Key & Review
                </h4>
                <span className="text-[10px] text-slate-400 font-mono font-bold font-sans">
                  {session.questionSnapshot.length} Total Questions
                </span>
              </div>

              {session.questionSnapshot.map((q, idx) => {
                const matchAns = mySubmission.answers.find(a => a.questionId === q.questionId);
                const chosenIdx = matchAns ? matchAns.selectedChoiceIndex : -1;
                const isCorrect = chosenIdx === q.correctChoiceIndex;

                return (
                  <div
                    key={q.questionId}
                    className="bg-white/5 border border-white/10 rounded-2xl p-5 text-white shadow-xl space-y-4"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase font-bold block">
                          Question {idx + 1}
                        </span>
                        <h5 className="font-bold text-white text-sm leading-relaxed font-sans">
                          {q.questionText}
                        </h5>
                      </div>
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider select-none shrink-0 border ${
                          isCorrect
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/20"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/20"
                        }`}
                      >
                        {isCorrect ? `+${q.points} Correct` : "Incorrect / 0 pt"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {q.choices.map((choice, cidx) => {
                        const wasChosen = chosenIdx === cidx;
                        const wasCorrect = q.correctChoiceIndex === cidx;

                        let cardStyle = "bg-white/5 border-white/10 text-slate-300";
                        if (wasCorrect) {
                          cardStyle = "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold";
                        } else if (wasChosen && !isCorrect) {
                          cardStyle = "bg-rose-500/10 border-rose-500/30 text-rose-300 font-bold";
                        }

                        return (
                          <div
                            key={cidx}
                            className={`p-3.5 rounded-xl border text-xs flex items-center transition-all ${cardStyle}`}
                          >
                            <span className="font-bold mr-2 text-[11px] font-mono select-none">
                              {String.fromCharCode(65 + cidx)}.
                            </span>
                            <span className="leading-normal">{choice}</span>

                            <div className="ml-auto flex items-center space-x-1.5 shrink-0">
                              {wasCorrect && (
                                <span className="inline-flex items-center text-[8px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 h-5 px-1.5 rounded">
                                  <CheckCircle className="h-3 w-3 mr-1 shrink-0" />
                                  Correct Key
                                </span>
                              )}
                              {wasChosen && (
                                <span
                                  className={`inline-flex items-center text-[8px] font-bold uppercase tracking-widest h-5 px-1.5 rounded ${
                                    isCorrect
                                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/20"
                                      : "bg-rose-500/20 text-rose-350 border border-rose-500/20"
                                  }`}
                                >
                                  Your Match
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3.5 text-[11px] text-indigo-300 leading-normal flex items-start space-x-2">
                        <Info className="h-4 w-4 shrink-0 text-indigo-400 mt-0.5" />
                        <div>
                          <span className="font-bold block text-[10px] uppercase tracking-wider text-slate-200 font-mono">
                            Explanation:
                          </span>
                          <span className="font-sans leading-relaxed text-slate-300">{q.explanation}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Exit / Return Action back */}
          <div className="text-center pt-2">
            <button
              id="btn-return-lobby"
              onClick={handleLeaveSession}
              className="bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer inline-flex items-center space-x-2 transition-all shadow"
            >
              Return to lobby
            </button>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmModalOpen && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModalOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Dialog container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative z-60 text-white space-y-4 font-sans text-xs"
            >
              <div className="h-12 w-12 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                <HelpCircle className="h-6 w-6 animate-pulse text-indigo-400" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white tracking-tight">Confirm Submission</h3>
                <p className="text-[11px] text-slate-400">
                  Once submitted, your answers are locked and cannot be updated.
                </p>
              </div>

              {/* Answer Statistics */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2 font-sans">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Total Questions:</span>
                  <span className="font-bold text-white font-mono">{session.questionSnapshot.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-sans">Answers Completed:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {Object.keys(selectedAnswers).length} / {session.questionSnapshot.length}
                  </span>
                </div>

                {/* Unanswered warning */}
                {session.questionSnapshot.length > Object.keys(selectedAnswers).length && (
                  <div className="pt-2 border-t border-white/5 text-[10.5px] text-amber-305 space-y-1 leading-normal font-sans">
                    <span className="font-bold uppercase tracking-wider block text-[8.5px] text-amber-400 font-mono">
                      ⚠️ WARNING: UNCOMPLETED EXAM
                    </span>
                    <span className="text-amber-305 leading-relaxed font-sans block">
                      You missed Question(s):{" "}
                      <span className="font-bold">
                        {session.questionSnapshot
                          .map((_, idx) => (selectedAnswers[idx] === undefined ? idx + 1 : null))
                          .filter((v) => v !== null)
                          .join(", ")}
                      </span>
                      . Unanswered questions receive 0 points.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => setConfirmModalOpen(false)}
                  className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold text-slate-300 transition-colors cursor-pointer"
                >
                  Review
                </button>
                <button
                  onClick={handleSubmitAnswers}
                  className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl font-extrabold text-white shadow-md shadow-emerald-500/10 transition-all flex items-center justify-center space-x-1 cursor-pointer font-sans"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span>Submit Quiz</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
