/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { UserDoc, CourseDoc, SectionDoc, LessonDoc, QuestionDoc, SessionDoc } from "../types";
import {
  getCourses,
  addCourse,
  getSections,
  addSection,
  getEnrollments,
  addEnrollment,
  getLessons,
  addLesson,
  getQuestions,
  addQuestion,
  createSession,
  getSession,
  getSessions,
  batchAddEnrollments,
  fetchLessons,
  fetchQuestions,
  createLessonInFirestore,
  updateLessonInFirestore,
  createQuestionInFirestore,
  updateQuestionInFirestore
} from "../dbStore";
import { TeacherSessionMonitor } from "./TeacherSessionMonitor";
import { StudentCSVImporter } from "./StudentCSVImporter";
import { TeacherSessionResults } from "./TeacherSessionResults";

import {
  BookOpen,
  Plus,
  Users,
  FolderPlus,
  Check,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  Flame,
  UserPlus,
  Calendar,
  HelpCircle,
  FileSpreadsheet,
  ToggleLeft,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  X,
  Upload,
  AlertCircle,
  Play,
  Grid,
  Sparkles
} from "lucide-react";
import { motion } from "motion/react";

interface TeacherDashboardProps {
  currentUser: UserDoc;
  triggerRefresh: () => void;
  tick: number;
}

export function TeacherDashboard({ currentUser, triggerRefresh, tick }: TeacherDashboardProps) {
  const courses = getCourses().filter((c) => c.ownerUid === currentUser.uid);

  // States
  const [selectedCourseId, setSelectedCourseId] = useState<string>(courses[0]?.courseId || "");
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"sections" | "lessons" | "sessions">("lessons");

  // Input states for adding new course
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourseCode, setNewCourseCode] = useState("");
  const [newCourseName, setNewCourseName] = useState("");

  // Input states for adding section
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionTerm, setNewSectionTerm] = useState("Fall 2026");

  // Input states for adding enrollment
  const [showAddEnrollment, setShowAddEnrollment] = useState(false);
  const [showCSVImporter, setShowCSVImporter] = useState(false);
  const [newEnrollStudentId, setNewEnrollStudentId] = useState("");

  const [newEnrollFullName, setNewEnrollFullName] = useState("");
  const [newEnrollEmail, setNewEnrollEmail] = useState("");

  // Rich Lesson and Question management States
  const [subView, setSubView] = useState<{ type: "lessons" | "questions"; lessonId?: string }>({ type: "lessons" });
  const [editLesson, setEditLesson] = useState<LessonDoc | null>(null);
  const [editQuestion, setEditQuestion] = useState<QuestionDoc | null>(null);
  
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [lessonError, setLessonError] = useState<string | null>(null);
  const [questionError, setQuestionError] = useState<string | null>(null);

  // Lesson Form local states
  const [showAddLesson, setShowAddLesson] = useState(false);
  const [lessonFormNo, setLessonFormNo] = useState<string>("");
  const [lessonFormTitle, setLessonFormTitle] = useState("");
  const [lessonFormDesc, setLessonFormDesc] = useState("");
  const [lessonFormActive, setLessonFormActive] = useState(true);

  // Question Form local states
  const [questionFormNo, setQuestionFormNo] = useState<string>("");
  const [questionFormText, setQuestionFormText] = useState("");
  const [questionFormChoices, setQuestionFormChoices] = useState<string[]>(["", "", "", ""]);
  const [questionFormCorrect, setQuestionFormCorrect] = useState<number>(0);
  const [questionFormPoints, setQuestionFormPoints] = useState<string>("10");
  const [questionFormExpl, setQuestionFormExpl] = useState("");
  const [questionFormActive, setQuestionFormActive] = useState(true);

  // Browser-only Question CSV Importer local states
  const [showCsvBox, setShowCsvBox] = useState(false);
  const [csvPreviewQuestions, setCsvPreviewQuestions] = useState<any[]>([]);
  const [csvPreviewError, setCsvPreviewError] = useState<string | null>(null);

  // Active Session Monitor state
  const [activeSession, setActiveSession] = useState<SessionDoc | null>(null);
  const [resultsSession, setResultsSession] = useState<SessionDoc | null>(null);

  // Synchronize Active & Results Sessions with Hash Routing for instructors
  React.useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash || "";
      
      const matchResults = hash.match(/^#\/teacher\/sessions\/([A-Za-z0-9_-]+)\/results$/);
      const matchActive = hash.match(/^#\/teacher\/sessions\/([A-Za-z0-9_-]+)$/);
      
      if (matchResults) {
        const sessId = matchResults[1];
        const sess = getSession(sessId);
        if (sess) {
          setResultsSession(sess);
          setActiveSession(null);
        }
      } else if (matchActive) {
        const sessId = matchActive[1];
        const sess = getSession(sessId);
        if (sess) {
          setActiveSession(sess);
          setResultsSession(null);
        }
      } else {
        setActiveSession(null);
        setResultsSession(null);
      }
    };

    window.addEventListener("hashchange", handleHash);
    handleHash();

    return () => {
      window.removeEventListener("hashchange", handleHash);
    };
  }, []);

  // Sync state back to URL Hash
  React.useEffect(() => {
    if (activeSession) {
      const expectedHash = `#/teacher/sessions/${activeSession.sessionId}`;
      if (window.location.hash !== expectedHash) {
        window.location.hash = expectedHash;
      }
    } else if (resultsSession) {
      const expectedHash = `#/teacher/sessions/${resultsSession.sessionId}/results`;
      if (window.location.hash !== expectedHash) {
        window.location.hash = expectedHash;
      }
    } else {
      if (window.location.hash.startsWith("#/teacher/sessions/")) {
        window.location.hash = "#/teacher/live";
      }
    }
  }, [activeSession, resultsSession]);

  const selectedCourse = courses.find((c) => c.courseId === selectedCourseId) || courses[0];

  // Load secondary collections
  const sections = selectedCourse ? getSections(selectedCourse.courseId) : [];
  const lessons = selectedCourse ? getLessons(selectedCourse.courseId) : [];
  
  // Reactively fetch lessons on course selection change
  React.useEffect(() => {
    if (selectedCourse?.courseId) {
      setLoadingLessons(true);
      setLessonError(null);
      fetchLessons(selectedCourse.courseId)
        .then(() => setLoadingLessons(false))
        .catch((err) => {
          setLoadingLessons(false);
          setLessonError("Error syncing lessons with central registry: " + err.message);
        });
    }
  }, [selectedCourseId, tick]);

  // Reactively fetch questions on subView or course change
  React.useEffect(() => {
    if (selectedCourse?.courseId && subView.type === "questions" && subView.lessonId) {
      setLoadingQuestions(true);
      setQuestionError(null);
      fetchQuestions(selectedCourse.courseId, subView.lessonId)
        .then(() => setLoadingQuestions(false))
        .catch((err) => {
          setLoadingQuestions(false);
          setQuestionError("Error syncing lesson questions with central registry: " + err.message);
        });
    }
  }, [selectedCourseId, subView, tick]);
  const sessions = selectedCourse ? getSessions().filter((s) => s.courseId === selectedCourse.courseId) : [];

  // Automatically select first section if none selected
  React.useEffect(() => {
    if (sections.length > 0 && !selectedSectionId) {
      setSelectedSectionId(sections[0].sectionId);
    }
  }, [sections, selectedSectionId]);

  const enrollments = selectedCourse && selectedSectionId ? getEnrollments(selectedCourse.courseId, selectedSectionId) : [];

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseCode || !newCourseName) return;
    const added = addCourse(newCourseCode.trim(), newCourseName.trim(), currentUser.uid);
    setSelectedCourseId(added.courseId);
    setShowAddCourse(false);
    setNewCourseCode("");
    setNewCourseName("");
    triggerRefresh();
  };

  const handleCreateSection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !newSectionName || !newSectionTerm) return;
    const added = addSection(selectedCourse.courseId, newSectionName.trim(), newSectionTerm.trim());
    setSelectedSectionId(added.sectionId);
    setShowAddSection(false);
    setNewSectionName("");
    triggerRefresh();
  };

  const handleCreateEnrollment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !selectedSectionId || !newEnrollStudentId || !newEnrollFullName || !newEnrollEmail) return;
    addEnrollment(
      selectedCourse.courseId,
      selectedSectionId,
      newEnrollStudentId.trim(),
      newEnrollFullName.trim(),
      newEnrollEmail.trim()
    );
    setShowAddEnrollment(false);
    setNewEnrollStudentId("");
    setNewEnrollFullName("");
    setNewEnrollEmail("");
    triggerRefresh();
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setLessonError(null);

    const parsedNo = parseInt(lessonFormNo, 10);
    if (isNaN(parsedNo) || parsedNo < 1 || parsedNo > 24) {
      setLessonError("Lesson number must be a valid integer between 1 and 24.");
      return;
    }

    const trimmedTitle = lessonFormTitle.trim();
    if (!trimmedTitle) {
      setLessonError("Lesson title cannot be empty.");
      return;
    }

    // Check for duplicate active lesson number within course
    const duplicates = lessons.filter(l => l.lessonNo === parsedNo && l.active);
    if (duplicates.length > 0) {
      setLessonError(`A lesson with number ${parsedNo} already exists in this course.`);
      return;
    }

    try {
      setLoadingLessons(true);
      await createLessonInFirestore(
        selectedCourse.courseId,
        parsedNo,
        trimmedTitle,
        lessonFormDesc.trim(),
        lessonFormActive
      );
      // Reset lesson form
      setLessonFormNo("");
      setLessonFormTitle("");
      setLessonFormDesc("");
      setLessonFormActive(true);
      setShowAddLesson(false);
      triggerRefresh();
    } catch (err: any) {
      setLessonError("Failed to publish lesson to Firestore: " + err.message);
    } finally {
      setLoadingLessons(false);
    }
  };

  const handleUpdateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !editLesson) return;
    setLessonError(null);

    const parsedNo = parseInt(lessonFormNo, 10);
    if (isNaN(parsedNo) || parsedNo < 1 || parsedNo > 24) {
      setLessonError("Lesson number must be a valid integer between 1 and 24.");
      return;
    }

    const trimmedTitle = lessonFormTitle.trim();
    if (!trimmedTitle) {
      setLessonError("Lesson title cannot be empty.");
      return;
    }

    // Duplicate check excluding self
    const duplicates = lessons.filter(l => l.lessonId !== editLesson.lessonId && l.lessonNo === parsedNo && l.active);
    if (duplicates.length > 0) {
      setLessonError(`A lesson with number ${parsedNo} already exists in this course.`);
      return;
    }

    try {
      setLoadingLessons(true);
      await updateLessonInFirestore(selectedCourse.courseId, editLesson.lessonId, {
        lessonNo: parsedNo,
        lessonTitle: trimmedTitle,
        description: lessonFormDesc.trim(),
        active: lessonFormActive
      });
      setEditLesson(null);
      setLessonFormNo("");
      setLessonFormTitle("");
      setLessonFormDesc("");
      setLessonFormActive(true);
      triggerRefresh();
    } catch (err: any) {
      setLessonError("Failed to update lesson database record: " + err.message);
    } finally {
      setLoadingLessons(false);
    }
  };

  const handleToggleLessonActive = async (lesson: LessonDoc) => {
    if (!selectedCourse) return;
    setLessonError(null);
    try {
      await updateLessonInFirestore(selectedCourse.courseId, lesson.lessonId, {
        active: !lesson.active
      });
      triggerRefresh();
    } catch (err: any) {
      setLessonError("Failed to toggle lesson active state: " + err.message);
    }
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !subView.lessonId) return;
    setQuestionError(null);

    const parsedNo = parseInt(questionFormNo, 10);
    if (isNaN(parsedNo) || parsedNo < 1 || parsedNo > 10) {
      setQuestionError("Question number must be a valid integer between 1 and 10.");
      return;
    }

    const trimmedText = questionFormText.trim();
    if (!trimmedText) {
      setQuestionError("Question prompt text is required.");
      return;
    }

    // Choices check
    const choices = questionFormChoices.map(c => c.trim());
    if (choices.some(c => !c)) {
      setQuestionError("All 4 multiple-choice answers must be filled in.");
      return;
    }

    const parsedPoints = parseFloat(questionFormPoints);
    if (isNaN(parsedPoints) || parsedPoints <= 0) {
      setQuestionError("Question weight points must be a positive number.");
      return;
    }

    // Duplicate question number check
    const lQuestions = getQuestions(selectedCourse.courseId, subView.lessonId);
    const duplicate = lQuestions.filter(q => q.questionNo === parsedNo && q.active);
    if (duplicate.length > 0) {
      setQuestionError(`An active question with number ${parsedNo} already exists in this lesson.`);
      return;
    }

    try {
      setLoadingQuestions(true);
      await createQuestionInFirestore(
        selectedCourse.courseId,
        subView.lessonId,
        parsedNo,
        trimmedText,
        choices,
        questionFormCorrect,
        parsedPoints,
        questionFormExpl.trim(),
        questionFormActive
      );

      // Reset
      setQuestionFormNo("");
      setQuestionFormText("");
      setQuestionFormChoices(["", "", "", ""]);
      setQuestionFormCorrect(0);
      setQuestionFormPoints("10");
      setQuestionFormExpl("");
      setQuestionFormActive(true);
      triggerRefresh();
    } catch (err: any) {
      setQuestionError("Failed to store test question inside Firestore: " + err.message);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !subView.lessonId || !editQuestion) return;
    setQuestionError(null);

    const parsedNo = parseInt(questionFormNo, 10);
    if (isNaN(parsedNo) || parsedNo < 1 || parsedNo > 10) {
      setQuestionError("Question number must be an integer between 1 and 10.");
      return;
    }

    const trimmedText = questionFormText.trim();
    if (!trimmedText) {
      setQuestionError("Question prompt text cannot be empty.");
      return;
    }

    const choices = questionFormChoices.map(c => c.trim());
    if (choices.some(c => !c)) {
      setQuestionError("All 4 multiple-choice answers must be filled in.");
      return;
    }

    const parsedPoints = parseFloat(questionFormPoints);
    if (isNaN(parsedPoints) || parsedPoints <= 0) {
      setQuestionError("Question weight points must be a positive number.");
      return;
    }

    // Duplicate checks
    const lQuestions = getQuestions(selectedCourse.courseId, subView.lessonId);
    const duplicate = lQuestions.filter(q => q.questionId !== editQuestion.questionId && q.questionNo === parsedNo && q.active);
    if (duplicate.length > 0) {
      setQuestionError(`An active question with number ${parsedNo} already exists in this lesson.`);
      return;
    }

    try {
      setLoadingQuestions(true);
      await updateQuestionInFirestore(selectedCourse.courseId, subView.lessonId, editQuestion.questionId, {
        questionNo: parsedNo,
        questionText: trimmedText,
        choices,
        correctChoiceIndex: questionFormCorrect,
        points: parsedPoints,
        explanation: questionFormExpl.trim(),
        active: questionFormActive
      });
      setEditQuestion(null);
      setQuestionFormNo("");
      setQuestionFormText("");
      setQuestionFormChoices(["", "", "", ""]);
      setQuestionFormCorrect(0);
      setQuestionFormPoints("10");
      setQuestionFormExpl("");
      setQuestionFormActive(true);
      triggerRefresh();
    } catch (err: any) {
      setQuestionError("Failed to update test question inside Firestore: " + err.message);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleToggleQuestionActive = async (q: QuestionDoc) => {
    if (!selectedCourse || !subView.lessonId) return;
    setQuestionError(null);
    try {
      await updateQuestionInFirestore(selectedCourse.courseId, subView.lessonId, q.questionId, {
        active: !q.active
      });
      triggerRefresh();
    } catch (err: any) {
      setQuestionError("Failed to toggle question status: " + err.message);
    }
  };

  const handleCSVQuestionsImport = async () => {
    if (!selectedCourse || !subView.lessonId || csvPreviewQuestions.length === 0) return;
    setCsvPreviewError(null);
    try {
      setLoadingQuestions(true);
      
      // Perform batch import sequentially or in loop
      for (const q of csvPreviewQuestions) {
        await createQuestionInFirestore(
          selectedCourse.courseId,
          subView.lessonId,
          q.questionNo,
          q.questionText,
          q.choices,
          q.correctChoiceIndex,
          q.points,
          q.explanation,
          true
        );
      }

      setCsvPreviewQuestions([]);
      setShowCsvBox(false);
      triggerRefresh();
    } catch (err: any) {
      setCsvPreviewError("Batch CSV import database storage failed: " + err.message);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const handleLaunchSession = (lessonId: string, sectionId: string) => {
    if (!selectedCourse) return;
    // Create new live session in db
    const sess = createSession(selectedCourse.courseId, sectionId, lessonId, currentUser.uid);
    setActiveSession(sess);
    triggerRefresh();
  };

  // If a session monitor is active, hook the UI entirely into that monitor HUD
  if (activeSession) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 animate-fade-in">
        <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl shadow-2xl text-slate-100">
          <TeacherSessionMonitor
            session={activeSession}
            onBack={() => {
              setActiveSession(null);
              triggerRefresh();
            }}
            triggerRefresh={triggerRefresh}
          />
        </div>
      </div>
    );
  }

  // If a session grading results screen is active, render results panel
  if (resultsSession) {
    return (
      <TeacherSessionResults
        session={resultsSession}
        onBack={() => {
          setResultsSession(null);
          // Navigate to sessions tab
          window.location.hash = "#/teacher/live";
          triggerRefresh();
        }}
        triggerRefresh={triggerRefresh}
      />
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative z-10 animate-fade-in">
      {/* Upper Grid: Course Picker with beautiful layout panel */}
      <section className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl text-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div className="space-y-1">
            <span className="text-xs uppercase font-mono tracking-wider text-indigo-400 font-bold">
              Teacher Control Console
            </span>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Manage Courses & Students
            </h2>
          </div>

          <div className="mt-3 md:mt-0 flex space-x-2">
            <button
              id="btn-add-course"
              onClick={() => setShowAddCourse(!showAddCourse)}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-indigo-500/20 transition-all"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Course</span>
            </button>
          </div>
        </div>

        {/* Create Course Form container */}
        {showAddCourse && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            onSubmit={handleCreateCourse}
            className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5 space-y-4 text-white"
          >
            <h4 className="text-sm font-bold text-white">Add New Course Document</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Course Code (e.g. CS-101)
                </label>
                <input
                  type="text"
                  required
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  placeholder="CS-102"
                  className="w-full text-white text-xs px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 glass-input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Course Name
                </label>
                <input
                  type="text"
                  required
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="Object Oriented Programing"
                  className="w-full text-white text-xs px-3 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 glass-input"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCourse(false)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/15 text-slate-300 rounded-lg text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow cursor-pointer"
              >
                Create
              </button>
            </div>
          </motion.form>
        )}

        {/* Course Grid selector */}
        {courses.length === 0 ? (
          <div className="text-center py-6 text-slate-405 text-slate-400 text-sm">
            No courses found. Add a new course to get started!
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {courses.map((course) => {
              const active = course.courseId === selectedCourseId;
              return (
                <button
                  key={course.courseId}
                  id={`course-select-${course.courseId}`}
                  onClick={() => {
                    setSelectedCourseId(course.courseId);
                    setSelectedSectionId("");
                  }}
                  className={`px-4 py-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    active
                      ? "bg-indigo-500/30 border-indigo-400/50 text-white shadow-lg"
                      : "bg-white/5 border-white/10 text-slate-300 hover:border-white/20 hover:bg-white/10"
                  }`}
                >
                  <span className="font-mono font-bold text-[10px] block opacity-85 text-indigo-300">{course.courseCode}</span>
                  <span className="font-semibold text-sm truncate max-w-[170px] block text-white">{course.courseName}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Main split display: Tabs and sub-views */}
      {selectedCourse && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Inner Sidebar tabs */}
          <div className="lg:col-span-1 space-y-3 text-white">
            <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl overflow-hidden">
              <div className="p-4 bg-white/5 border-b border-white/10">
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-450 text-indigo-300 font-bold block">
                  Workspace
                </span>
                <h4 className="font-bold text-white text-sm block truncate mt-0.5">
                  {selectedCourse.courseName}
                </h4>
              </div>
              <div className="p-2 space-y-1">
                <button
                  id="tab-select-lessons"
                  onClick={() => setActiveTab("lessons")}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left cursor-pointer ${
                    activeTab === "lessons"
                      ? "bg-white/10 text-white border border-white/10 shadow-sm"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <BookOpen className="h-4 w-4 text-indigo-400" />
                  <span>Lessons & Questions</span>
                  <span className="ml-auto font-mono text-[10px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 h-4.5 px-2 rounded-full flex items-center justify-center">
                    {lessons.length}
                  </span>
                </button>

                <button
                  id="tab-select-sections"
                  onClick={() => setActiveTab("sections")}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left cursor-pointer ${
                    activeTab === "sections"
                      ? "bg-white/10 text-white border border-white/10 shadow-sm"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Users className="h-4 w-4 text-indigo-400" />
                  <span>Sections & Enrollments</span>
                  <span className="ml-auto font-mono text-[10px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 h-4.5 px-2 rounded-full flex items-center justify-center">
                    {sections.length}
                  </span>
                </button>

                <button
                  id="tab-select-sessions"
                  onClick={() => setActiveTab("sessions")}
                  className={`w-full flex items-center space-x-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all text-left cursor-pointer ${
                    activeTab === "sessions"
                      ? "bg-white/10 text-white border border-white/10 shadow-sm"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <ClipboardList className="h-4 w-4 text-indigo-400" />
                  <span>Quiz Class Sessions</span>
                  <span className="ml-auto font-mono text-[10px] bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 h-4.5 px-2 rounded-full flex items-center justify-center">
                    {sessions.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Session Launch Widget */}
            <div className="bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/20 space-y-3 shadow-inner backdrop-blur-md">
              <h5 className="font-bold text-indigo-300 text-xs flex items-center">
                <Flame className="h-3.5 w-3.5 text-indigo-400 mr-1 animate-pulse" />
                Quick Session Starter
              </h5>
              <p className="text-[11px] text-slate-300 opacity-90 leading-normal">
                To run a live quizzing session, choose a lesson, active section, and start. In-class students will see updates in real-time.
              </p>
              {lessons.length > 0 && sections.length > 0 ? (
                <div className="space-y-11">
                  <button
                    id="btn-quick-launch-first"
                    onClick={() => handleLaunchSession(lessons[0].lessonId, sections[0].sectionId)}
                    className="w-full bg-indigo-500/30 hover:bg-indigo-500/40 border border-indigo-400/30 text-white font-bold text-[11px] py-2 rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-all"
                  >
                    <span>🚀 Launch: {lessons[0].title.substring(0,18)}...</span>
                  </button>
                </div>
              ) : (
                <span className="text-[10px] text-slate-400 italic block">
                  Add at least 1 lesson and section first.
                </span>
              )}
            </div>
          </div>

          {/* Core Content Area */}
          <div className="lg:col-span-3">
            {/* TAB CONTENT: SECTIONS & ENROLLMENTS */}
            {activeTab === "sections" && (
              <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-6 text-white shadow-xl">
                <div>
                  <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                    <h3 className="font-bold text-white text-sm flex items-center">
                      <Users className="h-4.5 w-4.5 text-indigo-400 mr-2" />
                      Course Sections ({sections.length})
                    </h3>
                    <button
                      id="btn-add-section-toggle"
                      onClick={() => setShowAddSection(!showAddSection)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Create Section</span>
                    </button>
                  </div>

                  {/* Add Section form */}
                  {showAddSection && (
                    <form onSubmit={handleCreateSection} className="bg-white/5 border border-white/10 p-4 rounded-xl mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-white">
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1">
                          Section Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newSectionName}
                          onChange={(e) => setNewSectionName(e.target.value)}
                          placeholder="e.g. Section A"
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 glass-input"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-300 uppercase tracking-wider mb-1">
                          Term / Semester
                        </label>
                        <input
                          type="text"
                          required
                          value={newSectionTerm}
                          onChange={(e) => setNewSectionTerm(e.target.value)}
                          placeholder="e.g. Fall 2026"
                          className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 glass-input"
                        />
                      </div>
                      <div className="sm:col-span-2 flex justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddSection(false)}
                          className="px-2.5 py-1 bg-white/10 hover:bg-white/15 rounded text-xs text-slate-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-2.5 py-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-xs font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Section tabs */}
                  {sections.length === 0 ? (
                    <div className="text-center py-4 text-xs text-slate-400">
                      No groups or sections found for this course. Click "Create Section" to begin.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mb-4 border-b border-white/10 pb-3">
                      {sections.map((sec) => (
                        <button
                          key={sec.sectionId}
                          id={`section-sel-${sec.sectionId}`}
                          onClick={() => setSelectedSectionId(sec.sectionId)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-all ${
                            sec.sectionId === selectedSectionId
                              ? "bg-indigo-500/30 border border-indigo-400/40 text-white shadow-md shadow-indigo-500/10"
                              : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          {sec.sectionName} ({sec.term})
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Enrollments container */}
                {selectedSectionId && (
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
                      <div>
                        <h4 className="font-bold text-white text-xs uppercase tracking-wide">
                          Student Enrollments
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Students matches of email logic find interactive active sessions automatically.
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          id="btn-add-student-toggle"
                          onClick={() => {
                            setShowAddEnrollment(!showAddEnrollment);
                            setShowCSVImporter(false);
                          }}
                          className="text-[11px] text-indigo-405 text-indigo-400 hover:text-indigo-300 font-bold flex items-center space-x-1 cursor-pointer bg-white/5 px-2 py-1 rounded"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>Enroll Student</span>
                        </button>
                        <button
                          id="btn-add-student-csv"
                          onClick={() => {
                            setShowCSVImporter(!showCSVImporter);
                            setShowAddEnrollment(false);
                          }}
                          className="text-[11px] text-indigo-405 text-indigo-400 hover:text-indigo-300 font-bold flex items-center space-x-1 cursor-pointer bg-white/5 px-2 py-1 rounded"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                          <span>Import CSV</span>
                        </button>
                      </div>
                    </div>

                    {/* Student CSV Importer subcomponent */}
                    {showCSVImporter && (
                      <div className="mb-4">
                        <StudentCSVImporter
                          courseId={selectedCourse.courseId}
                          sectionId={selectedSectionId}
                          onCancel={() => setShowCSVImporter(false)}
                          onImportCompleted={async (count, records) => {
                            try {
                              await batchAddEnrollments(selectedCourse.courseId, selectedSectionId, records, currentUser.uid);
                              setShowCSVImporter(false);
                              triggerRefresh();
                            } catch (err: any) {
                              alert("Bulk enrollment failed: " + err.message);
                            }
                          }}
                        />
                      </div>
                    )}

                    {/* Enroll Student modal-form */}
                    {showAddEnrollment && (
                      <form onSubmit={handleCreateEnrollment} className="bg-white/5 border border-white/10 p-4 rounded-xl mb-4 space-y-3">
                        <h5 className="text-xs font-semibold text-white">Enroll new student record</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Student ID</label>
                            <input
                              type="text"
                              required
                              value={newEnrollStudentId}
                              onChange={(e) => setNewEnrollStudentId(e.target.value)}
                              placeholder="e.g. 64234589"
                              className="w-full px-2.5 py-1.5 text-xs text-white bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 glass-input"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Full Name</label>
                            <input
                              type="text"
                              required
                              value={newEnrollFullName}
                              onChange={(e) => setNewEnrollFullName(e.target.value)}
                              placeholder="Bob Carter"
                              className="w-full px-2.5 py-1.5 text-xs text-white bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 glass-input"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">University Email</label>
                            <input
                              type="email"
                              required
                              value={newEnrollEmail}
                              onChange={(e) => setNewEnrollEmail(e.target.value)}
                              placeholder="bob@university.edu"
                              className="w-full px-2.5 py-1.5 text-xs text-white bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 glass-input"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowAddEnrollment(false)}
                            className="px-2.5 py-1 bg-white/10 hover:bg-white/15 rounded text-xs text-slate-300 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="px-2.5 py-1 bg-indigo-505 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            Enroll
                          </button>
                        </div>
                      </form>
                    )}

                    {enrollments.length === 0 ? (
                      <div className="p-8 text-center bg-white/5 border border-dashed border-white/10 rounded-xl text-xs text-slate-400">
                        No students enrolled in this section yet. Click 'Enroll Student' to add Bob, Alice, or anyone.
                      </div>
                    ) : (
                      <div className="border border-white/10 rounded-xl overflow-hidden text-xs bg-white/5">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/10 text-slate-300 font-bold">
                              <th className="py-2.5 px-3">Student Name</th>
                              <th className="py-2.5 px-3">Student ID</th>
                              <th className="py-2.5 px-3">University Email</th>
                              <th className="py-2.5 px-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/10">
                            {enrollments.map((enr) => (
                              <tr key={enr.studentUidOrEmail} className="hover:bg-white/5">
                                <td className="py-2.5 px-3 font-semibold text-white">{enr.fullName}</td>
                                <td className="py-2.5 px-3 font-mono text-slate-300">{enr.studentId}</td>
                                <td className="py-2.5 px-3 text-slate-400">{enr.email}</td>
                                <td className="py-2.5 px-3 text-[10px]">
                                  <span className="inline-flex px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-305 text-emerald-300 border border-emerald-500/20 font-bold uppercase">
                                    {enr.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: LESSONS & QUESTIONS */}
            {activeTab === "lessons" && (
              <div className="space-y-6 animate-fade-in">
                {/* 1. VIEW OF LESSONS SUB-SCREEN */}
                {subView.type === "lessons" ? (
                  <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-6 text-white shadow-xl" id="lessons-view-container">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center">
                          <BookOpen className="h-5 w-5 text-indigo-400 mr-2" />
                          Curriculum Lessons Outlines ({lessons.length} of 24 max)
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Configure up to 24 lessons per course, each requiring exactly 10 questions to go live.
                        </p>
                      </div>
                      <div className="mt-3 sm:mt-0 flex gap-2">
                        <button
                          id="btn-add-lesson-toggle"
                          onClick={() => {
                            setEditLesson(null);
                            setLessonFormNo(String(lessons.length + 1 <= 24 ? lessons.length + 1 : 24));
                            setLessonFormTitle("");
                            setLessonFormDesc("");
                            setLessonFormActive(true);
                            setShowAddLesson(!showAddLesson);
                          }}
                          className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs px-3 py-2 rounded-lg flex items-center space-x-1 cursor-pointer transition-all shadow-md shadow-indigo-500/10"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>{showAddLesson ? "Collapse Form" : "Write Lesson Outlines"}</span>
                        </button>
                      </div>
                    </div>

                    {/* Lesson Error Info */}
                    {lessonError && (
                      <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-2 text-rose-300 text-xs">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="font-semibold">{lessonError}</span>
                      </div>
                    )}

                    {/* Add / Edit Lesson Form */}
                    {(showAddLesson || editLesson) && (
                      <form
                        onSubmit={editLesson ? handleUpdateLesson : handleCreateLesson}
                        className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4 text-white"
                        id="lesson-outlines-form"
                      >
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <h4 className="text-xs uppercase font-mono tracking-wider font-bold text-indigo-300">
                            {editLesson ? "Modify Curriculum Lesson Outlines" : "Publish New Lesson Outlines"}
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              setShowAddLesson(false);
                              setEditLesson(null);
                            }}
                            className="text-slate-400 hover:text-white"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div className="sm:col-span-1">
                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                              Lesson Number (1 - 24)
                            </label>
                            <input
                              type="number"
                              required
                              min="1"
                              max="24"
                              value={lessonFormNo}
                              onChange={(e) => setLessonFormNo(e.target.value)}
                              placeholder="e.g. 1"
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-505 focus:ring-indigo-500 glass-input"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                              Lesson Title
                            </label>
                            <input
                              type="text"
                              required
                              value={lessonFormTitle}
                              onChange={(e) => setLessonFormTitle(e.target.value)}
                              placeholder="e.g. Object Oriented Programming Concepts"
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-505 focus:ring-indigo-500 glass-input"
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                              Curriculum Description (Optional)
                            </label>
                            <textarea
                              value={lessonFormDesc}
                              onChange={(e) => setLessonFormDesc(e.target.value)}
                              placeholder="Describe learning goals, keywords, parameters and key concepts of this module."
                              rows={2}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-505 focus:ring-indigo-500 glass-input resize-none"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={lessonFormActive}
                              onChange={(e) => setLessonFormActive(e.target.checked)}
                              className="rounded border-white/10 text-indigo-500 focus:ring-0 bg-transparent h-4 w-4"
                            />
                            <span className="text-xs text-slate-300 font-semibold selection:bg-transparent">
                              Active (Students can access this lesson's game mode when session launches)
                            </span>
                          </label>

                          <div className="flex space-x-2">
                            <button
                              type="button"
                              onClick={() => {
                                setShowAddLesson(false);
                                setEditLesson(null);
                              }}
                              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-slate-300 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={loadingLessons}
                              className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-700 text-white font-semibold rounded-lg text-xs shadow-md shadow-indigo-505/10 cursor-pointer flex items-center space-x-1"
                            >
                              {loadingLessons && (
                                <svg className="animate-spin h-3.5 w-3.5 text-white mr-1" viewBox="0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                              )}
                              <span>{editLesson ? "Update Info" : "Publish Lesson"}</span>
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {/* Check Loading */}
                    {loadingLessons && lessons.length === 0 ? (
                      <div className="py-20 flex flex-col items-center justify-center space-y-3.5">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-400 border-solid"></div>
                        <p className="text-xs text-indigo-300 font-mono tracking-wider">Syncing AU Curriculum Records...</p>
                      </div>
                    ) : lessons.length === 0 ? (
                      /* Empty state */
                      <div className="py-16 text-center border-2 border-dashed border-white/10 rounded-3xl p-8" id="lessons-empty-state">
                        <BookOpen className="h-10 w-10 text-slate-500 mx-auto opacity-70 mb-3" />
                        <h4 className="text-sm font-bold text-white mb-1">No lessons published yet</h4>
                        <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                          Establish modules for {selectedCourse.courseName}. You can write up to 24 lessons.
                        </p>
                        <button
                          onClick={() => {
                            setLessonFormNo("1");
                            setLessonFormTitle("");
                            setLessonFormDesc("");
                            setLessonFormActive(true);
                            setShowAddLesson(true);
                          }}
                          className="px-3.5 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow cursor-pointer transition-all"
                        >
                          Publish First Lesson
                        </button>
                      </div>
                    ) : (
                      /* Lessons Grid list */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="lessons-card-grid">
                        {lessons.map((lesson) => {
                          const activeQ = getQuestions(selectedCourse.courseId, lesson.lessonId).filter(q => q.active).length;
                          let statusColor = "bg-amber-500/10 border-amber-500/25 text-amber-300";
                          let statusText = "Needs questions";
                          if (activeQ === 10) {
                            statusColor = "bg-emerald-500/10 border-emerald-500/25 text-emerald-300";
                            statusText = "Ready";
                          } else if (activeQ > 10) {
                            statusColor = "bg-rose-500/10 border-rose-500/25 text-rose-300";
                            statusText = `${activeQ} Qs (Overflow)`;
                          }

                          return (
                            <div
                              key={lesson.lessonId}
                              id={`lesson-card-${lesson.lessonId}`}
                              className={`bg-white/5 border rounded-2xl p-5 hover:bg-white/10 transition-all text-xs text-white relative flex flex-col justify-between ${
                                lesson.active ? "border-white/10" : "border-white/5 opacity-70"
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono text-[11px] font-bold bg-indigo-500/20 border border-indigo-400/35 text-indigo-300 px-2 py-0.5 rounded-md">
                                      L{String(lesson.lessonNo).padStart(2, "0")}
                                    </span>
                                    {!lesson.active && (
                                      <span className="bg-slate-500/20 text-slate-400 border border-slate-500/20 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">
                                        Draft/Inactive
                                      </span>
                                    )}
                                  </div>
                                  <div className={`px-2 py-0.5 border text-[9px] font-bold uppercase tracking-wider rounded-full ${statusColor}`}>
                                    {statusText}
                                  </div>
                                </div>

                                <h4 className="font-bold text-white text-sm line-clamp-2" id={`lesson-title-display-${lesson.lessonId}`}>
                                  {lesson.title || lesson.lessonTitle}
                                </h4>
                                <p className="text-[11px] text-slate-400 mt-1.5 line-clamp-2 h-8">
                                  {lesson.description || "No learning outcomes described yet."}
                                </p>
                              </div>

                              <div className="border-t border-white/5 pt-3.5 mt-4 flex items-center justify-between">
                                <span className="font-mono text-[10px] text-slate-400">
                                  Configured: <strong className="text-white">{activeQ} Active</strong> / {getQuestions(selectedCourse.courseId, lesson.lessonId).length} Total
                                </span>

                                <div className="flex items-center space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLessonFormNo(String(lesson.lessonNo));
                                      setLessonFormTitle(lesson.title || lesson.lessonTitle || "");
                                      setLessonFormDesc(lesson.description || "");
                                      setLessonFormActive(lesson.active);
                                      setEditLesson(lesson);
                                      setShowAddLesson(false);
                                      // Scroll form smoothly
                                      setTimeout(() => {
                                        document.getElementById("lesson-outlines-form")?.scrollIntoView({ behavior: "smooth" });
                                      }, 80);
                                    }}
                                    className="p-1 px-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded text-[11px] font-medium cursor-pointer"
                                    title="Edit Outlines"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleLessonActive(lesson)}
                                    className={`p-1 px-2 text-[11px] font-medium rounded cursor-pointer ${
                                      lesson.active
                                        ? "bg-slate-500/15 text-slate-405 hover:bg-slate-500/30"
                                        : "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/35"
                                    }`}
                                  >
                                    {lesson.active ? "Pause" : "Play"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSubView({ type: "questions", lessonId: lesson.lessonId });
                                      setEditQuestion(null);
                                      setQuestionFormNo("");
                                      setQuestionFormText("");
                                      setQuestionFormChoices(["", "", "", ""]);
                                      setQuestionFormCorrect(0);
                                      setQuestionFormPoints("10");
                                      setQuestionFormExpl("");
                                      setQuestionFormActive(true);
                                    }}
                                    className="p-1 px-2 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded text-[11px] cursor-pointer shadow-sm flex items-center space-x-0.5"
                                    id={`btn-manage-qs-${lesson.lessonId}`}
                                  >
                                    <span>Questions</span>
                                    <ChevronRight className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* 2. VIEW OF QUESTIONS SUB-SCREEN (lessonId exists) */
                  (() => {
                    const lessonObj = lessons.find(l => l.lessonId === subView.lessonId);
                    if (!lessonObj) {
                      return (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-white">
                          <p>Error: selected curriculum lesson no longer exists.</p>
                          <button onClick={() => setSubView({ type: "lessons" })} className="text-xs text-indigo-400 hover:underline">
                            Back
                          </button>
                        </div>
                      );
                    }

                    const rawQuestions = getQuestions(selectedCourse.courseId, lessonObj.lessonId);
                    const activeQs = rawQuestions.filter(q => q.active);
                    const isReady = activeQs.length === 10;
                    const isOverflow = activeQs.length > 10;

                    return (
                      <div className="space-y-6 animate-fade-in" id="questions-view-container">
                        {/* Questions Header Breadcrumb */}
                        <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between text-white shadow-xl">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center space-x-1.5 text-xs text-indigo-300 font-medium">
                              <span className="opacity-75 selection:bg-transparent cursor-pointer hover:underline" onClick={() => setSubView({ type: "lessons" })}>Lessons</span>
                              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                              <span className="px-1.5 py-0.5 font-mono bg-indigo-500/20 text-indigo-300 rounded font-bold text-[10px]">
                                L{String(lessonObj.lessonNo).padStart(2, "0")}
                              </span>
                              <span className="font-semibold">{lessonObj.title || lessonObj.lessonTitle}</span>
                            </div>
                            <h3 className="text-base font-extrabold text-white tracking-tight mt-1" id="question-bank-header">
                              Question Bank Configurations
                            </h3>
                          </div>
                          
                          <button
                            onClick={() => setSubView({ type: "lessons" })}
                            className="mt-3 md:mt-0 px-3.5 py-1.5 bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 rounded-xl cursor-pointer flex items-center space-x-1.5 transition-all"
                            id="btn-back-to-lessons"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            <span>Return to Lessons</span>
                          </button>
                        </div>

                        {/* Lesson Readiness Panel */}
                        <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-5 text-white shadow-lg grid grid-cols-1 md:grid-cols-4 gap-5" id="readiness-panel">
                          <div className="md:col-span-3 flex items-start space-x-4">
                            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-2xl">
                              <Grid className="h-6 w-6" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-305 text-indigo-300">
                                Lesson Readiness Panel
                              </h4>
                              <p className="text-xs text-slate-300 pr-4 mt-0.5 leading-relaxed">
                                Curriculums mandate exactly <strong>10 active questions</strong> per lesson module before launch. Currently configure weight points dynamically to scale snapshot ratios.
                              </p>
                              {!isReady && (
                                <p className="text-[11px] text-amber-300 font-semibold flex items-center space-x-1 pt-1.5">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                                  <span>Live quiz sessions should only be started when the lesson has exactly 10 active questions.</span>
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="bg-white/5 border border-white/5 p-4 rounded-xl flex flex-col justify-between items-center text-center">
                            <span className="text-[9px] uppercase tracking-wider font-mono font-black text-indigo-300">
                              Active Quiz Slots
                            </span>
                            <div className="my-1.5 font-mono text-xl font-extrabold text-white">
                              {activeQs.length} <span className="text-xs text-slate-400 font-light">/ 10</span>
                            </div>
                            <div className="w-full">
                              {isReady ? (
                                <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full block">
                                  Ready
                                </span>
                              ) : isOverflow ? (
                                <span className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full block">
                                  Invalid Overflow
                                </span>
                              ) : (
                                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full block">
                                  Not Ready
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Optional Bulk CSV Importer collapsible Panel */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-white shadow">
                          <button
                            onClick={() => setShowCsvBox(!showCsvBox)}
                            className="w-full flex items-center justify-between text-left cursor-pointer selection:bg-transparent text-white"
                            type="button"
                          >
                            <div className="flex items-center space-x-2">
                              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                Optional: Import questions via CSV template
                              </span>
                            </div>
                            <span className="text-[11px] text-indigo-300 font-bold">
                              {showCsvBox ? "[Hide Importer]" : "[Show Importer Details]"}
                            </span>
                          </button>

                          {showCsvBox && (
                            <div className="pt-4 space-y-4 border-t border-white/5 mt-4 text-xs animate-fade-in" id="csv-questions-importer">
                              <p className="text-slate-300 leading-relaxed text-[11px]">
                                Upload a standard browser-only CSV containing questions. Must contain exactly these lowercased header columns: <br />
                                <code className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] font-mono select-all text-emerald-300">
                                  questionNo,questionText,choiceA,choiceB,choiceC,choiceD,correctAnswer,points,explanation
                                </code>
                              </p>
                              <div className="bg-white/5 border border-dashed border-white/10 rounded-xl p-6 text-center space-y-3.5 relative">
                                <Upload className="h-7 w-7 text-emerald-400 mx-auto" />
                                <div className="space-y-1">
                                  <label className="bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer inline-block shadow transition-all">
                                    <span>Browse CSV File</span>
                                    <input
                                      type="file"
                                      accept=".csv"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setCsvPreviewError(null);
                                        setCsvPreviewQuestions([]);

                                        const reader = new FileReader();
                                        reader.onload = (evt) => {
                                          try {
                                            const text = evt.target?.result as string;
                                            if (!text) return;

                                            const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
                                            if (lines.length < 2) {
                                              setCsvPreviewError("The uploaded CSV has no record details.");
                                              return;
                                            }

                                            const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
                                            const questionNoIdx = headers.indexOf("questionno");
                                            const questionTextIdx = headers.indexOf("questiontext");
                                            const choiceAIdx = headers.indexOf("choicea");
                                            const choiceBIdx = headers.indexOf("choiceb");
                                            const choiceCIdx = headers.indexOf("choicec");
                                            const choiceDIdx = headers.indexOf("choiced");
                                            const correctAnswerIdx = headers.indexOf("correctanswer");
                                            const pointsIdx = headers.indexOf("points");
                                            const explanationIdx = headers.indexOf("explanation");

                                            if (questionNoIdx === -1 || questionTextIdx === -1 || choiceAIdx === -1 || choiceBIdx === -1 || choiceCIdx === -1 || choiceDIdx === -1 || correctAnswerIdx === -1) {
                                              setCsvPreviewError("Column headers missing. Required: questionNo, questionText, choiceA, choiceB, choiceC, choiceD, correctAnswer");
                                              return;
                                            }

                                            const parsedList: any[] = [];
                                            const seenNos = new Set<number>();

                                            for (let i = 1; i < lines.length; i++) {
                                              const row = lines[i];
                                              
                                              const parts: string[] = [];
                                              let currentStr = "";
                                              let inQuotes = false;
                                              for (let j = 0; j < row.length; j++) {
                                                const char = row[j];
                                                if (char === '"') {
                                                  inQuotes = !inQuotes;
                                                } else if (char === ',' && !inQuotes) {
                                                  parts.push(currentStr.trim());
                                                  currentStr = "";
                                                } else {
                                                  currentStr += char;
                                                }
                                              }
                                              parts.push(currentStr.trim());

                                              if (parts.length < 7) continue;

                                              const qNoRaw = parts[questionNoIdx];
                                              const qText = parts[questionTextIdx];
                                              const choiceA = parts[choiceAIdx];
                                              const choiceB = parts[choiceBIdx];
                                              const choiceC = parts[choiceCIdx];
                                              const choiceD = parts[choiceDIdx];
                                              const correctRaw = parts[correctAnswerIdx]?.toUpperCase();
                                              const ptsRaw = pointsIdx !== -1 ? parts[pointsIdx] : "10";
                                              const expl = explanationIdx !== -1 ? parts[explanationIdx] || "" : "";

                                              const qNo = parseInt(qNoRaw, 10);
                                              if (isNaN(qNo) || qNo < 1 || qNo > 10) {
                                                setCsvPreviewError(`Row ${i + 1}: Invalid questionNo (${qNoRaw}). Must be an integer 1 - 10.`);
                                                return;
                                              }
                                              if (seenNos.has(qNo)) {
                                                setCsvPreviewError(`Row ${i + 1}: Duplicate questionNo ${qNo} is specified.`);
                                                return;
                                              }
                                              seenNos.add(qNo);

                                              if (!qText) {
                                                setCsvPreviewError(`Row ${i + 1}: questionText is empty.`);
                                                return;
                                              }
                                              if (!choiceA || !choiceB || !choiceC || !choiceD) {
                                                setCsvPreviewError(`Row ${i + 1}: One or more choices (A, B, C, D) is blank.`);
                                                return;
                                              }

                                              let correctIdx = -1;
                                              if (correctRaw === "A") correctIdx = 0;
                                              else if (correctRaw === "B") correctIdx = 1;
                                              else if (correctRaw === "C") correctIdx = 2;
                                              else if (correctRaw === "D") correctIdx = 3;
                                              else {
                                                const tempIdx = parseInt(correctRaw, 10);
                                                if (!isNaN(tempIdx) && tempIdx >= 0 && tempIdx <= 3) {
                                                  correctIdx = tempIdx;
                                                }
                                              }

                                              if (correctIdx === -1) {
                                                setCsvPreviewError(`Row ${i + 1}: Invalid correctAnswer "${correctRaw}". Must be A, B, C, or D.`);
                                                return;
                                              }

                                              const pts = parseFloat(ptsRaw || "10");
                                              parsedList.push({
                                                questionNo: qNo,
                                                questionText: qText,
                                                choices: [choiceA, choiceB, choiceC, choiceD],
                                                correctChoiceIndex: correctIdx,
                                                points: isNaN(pts) ? 10 : pts,
                                                explanation: expl
                                              });
                                            }

                                            if (parsedList.length === 0) {
                                              setCsvPreviewError("No questions could be parsed.");
                                            } else {
                                              parsedList.sort((a, b) => a.questionNo - b.questionNo);
                                              setCsvPreviewQuestions(parsedList);
                                            }
                                          } catch (err: any) {
                                            setCsvPreviewError("Execution error: " + err.message);
                                          }
                                        };
                                        reader.readAsText(file);
                                      }}
                                      className="hidden"
                                    />
                                  </label>
                                  <p className="text-[10px] text-slate-400 mt-1">
                                    Files are processed 100% locally. Privacy secured. No external uploading.
                                  </p>
                                </div>
                              </div>

                              {/* CSV errors and preview */}
                              {csvPreviewError && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-lg flex items-start space-x-2 text-[11px]">
                                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                  <span>{csvPreviewError}</span>
                                </div>
                              )}

                              {csvPreviewQuestions.length > 0 && (
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                                    <span className="font-bold text-emerald-400">
                                      ✓ Verified {csvPreviewQuestions.length} Questions Ready for Import
                                    </span>
                                    <button
                                      onClick={handleCSVQuestionsImport}
                                      disabled={loadingQuestions}
                                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer shrink-0 transition-all flex items-center shadow"
                                      type="button"
                                    >
                                      {loadingQuestions && <svg className="animate-spin h-3.5 w-3.5 text-white mr-1" viewBox="0 24 24" fill="none"></svg>}
                                      <span>Install {csvPreviewQuestions.length} Questions</span>
                                    </button>
                                  </div>
                                  <div className="max-h-40 overflow-y-auto space-y-2 pr-1 divide-y divide-white/5 text-[10px]">
                                    {csvPreviewQuestions.map((pq, pqidx) => (
                                      <div key={pqidx} className="pt-2">
                                        <div className="flex items-center justify-between text-[11px]">
                                          <span className="font-bold text-white">Q{pq.questionNo}. {pq.questionText.slice(0, 70)}...</span>
                                          <span className="font-mono text-indigo-305 text-indigo-300 font-bold">{pq.points} pts</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-1 text-[9px] text-slate-400">
                                          {pq.choices.map((ch: string, cidx: number) => (
                                            <span key={cidx} className={cidx === pq.correctChoiceIndex ? "text-emerald-300 font-semibold" : ""}>
                                              {String.fromCharCode(65 + cidx)}. {ch}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Error info banner */}
                        {questionError && (
                          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start space-x-2 text-rose-300 text-xs animate-shake">
                            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span className="font-semibold">{questionError}</span>
                          </div>
                        )}

                        {/* Add / Edit Question Input Form */}
                        <form
                          onSubmit={editQuestion ? handleUpdateQuestion : handleCreateQuestion}
                          className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-4 text-white"
                          id="question-bank-form"
                        >
                          <div className="flex items-center justify-between border-b border-white/5 pb-2">
                            <h4 className="text-xs uppercase font-mono tracking-wider font-bold text-indigo-300">
                              {editQuestion ? `Modify Question Doc ID: ${editQuestion.questionId}` : "Construct New Multiple-Choice Question"}
                            </h4>
                            {editQuestion && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditQuestion(null);
                                  setQuestionFormNo("");
                                  setQuestionFormText("");
                                  setQuestionFormChoices(["", "", "", ""]);
                                  setQuestionFormCorrect(0);
                                  setQuestionFormPoints("10");
                                  setQuestionFormExpl("");
                                  setQuestionFormActive(true);
                                }}
                                className="text-slate-400 hover:text-white"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                            <div className="sm:col-span-1">
                              <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                                Question Number (1 - 10)
                              </label>
                              <input
                                type="number"
                                required
                                min="1"
                                max="10"
                                value={questionFormNo}
                                onChange={(e) => setQuestionFormNo(e.target.value)}
                                placeholder="1"
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 glass-input"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                                Points (Weight Possible)
                              </label>
                              <input
                                type="number"
                                required
                                min="1"
                                value={questionFormPoints}
                                onChange={(e) => setQuestionFormPoints(e.target.value)}
                                placeholder="10"
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 glass-input"
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[10px] font-bold text-slate-305 text-slate-300 uppercase tracking-wider mb-1">
                                Correct Choice INDEX
                              </label>
                              <select
                                value={questionFormCorrect}
                                onChange={(e) => setQuestionFormCorrect(Number(e.target.value))}
                                className="w-full px-3 py-2.5 bg-[#1b1c31] border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-505 focus:ring-indigo-500 cursor-pointer text-white"
                              >
                                <option value={0} className="bg-slate-900">Answer A (Index 0)</option>
                                <option value={1} className="bg-slate-900">Answer B (Index 1)</option>
                                <option value={2} className="bg-slate-900">Answer C (Index 2)</option>
                                <option value={3} className="bg-slate-900">Answer D (Index 3)</option>
                              </select>
                            </div>

                            <div className="sm:col-span-4">
                              <label className="block text-[10px] font-bold text-slate-303 text-slate-300 uppercase tracking-wider mb-1">
                                Question Prompt Text
                              </label>
                              <textarea
                                required
                                rows={2}
                                value={questionFormText}
                                onChange={(e) => setQuestionFormText(e.target.value)}
                                placeholder="Write clear conceptual questions..."
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 glass-input resize-none"
                              />
                            </div>

                            {/* Choices fields */}
                            {questionFormChoices.map((choiceVal, idx) => (
                              <div key={idx} className="sm:col-span-2">
                                <label className="block text-[10px] font-black text-indigo-300 mb-1">
                                  Choice {String.fromCharCode(65 + idx)} {idx === questionFormCorrect ? "(CORRECT ANSWER)" : ""}
                                </label>
                                <input
                                  type="text"
                                  required
                                  value={choiceVal}
                                  onChange={(e) => {
                                    const nextChoices = [...questionFormChoices];
                                    nextChoices[idx] = e.target.value;
                                    setQuestionFormChoices(nextChoices);
                                  }}
                                  placeholder={`Provide Answer option ${String.fromCharCode(65 + idx)}`}
                                  className={`w-full px-3 py-2 bg-white/5 border rounded-lg text-xs text-white focus:outline-none focus:ring-1 transition-all glass-input ${
                                    idx === questionFormCorrect
                                      ? "border-emerald-500/40 focus:ring-emerald-500"
                                      : "border-white/10 focus:ring-indigo-500"
                                  }`}
                                />
                              </div>
                            ))}

                            <div className="sm:col-span-4">
                              <label className="block text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                                Explanation & Justification (Optional)
                              </label>
                              <textarea
                                rows={2}
                                value={questionFormExpl}
                                onChange={(e) => setQuestionFormExpl(e.target.value)}
                                placeholder="Provide the educational rationale and correctness logic. Shown to students post-answer snapshot."
                                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 glass-input resize-none"
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <label className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={questionFormActive}
                                onChange={(e) => setQuestionFormActive(e.target.checked)}
                                className="rounded border-white/10 text-indigo-500 focus:ring-0 bg-transparent h-4 w-4"
                              />
                              <span className="text-xs text-slate-300 font-semibold select-none bg-transparent">
                                Active (Included in active gameplay slots counts)
                              </span>
                            </label>

                            <div className="flex space-x-2">
                              {editQuestion && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditQuestion(null);
                                    setQuestionFormNo("");
                                    setQuestionFormText("");
                                    setQuestionFormChoices(["", "", "", ""]);
                                    setQuestionFormCorrect(0);
                                    setQuestionFormPoints("10");
                                    setQuestionFormExpl("");
                                    setQuestionFormActive(true);
                                  }}
                                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-slate-305 text-slate-300 cursor-pointer"
                                >
                                  Cancel Edit
                                </button>
                              )}
                              <button
                                type="submit"
                                disabled={loadingQuestions}
                                className="px-4 py-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow cursor-pointer flex items-center"
                              >
                                {loadingQuestions && (
                                  <svg className="animate-spin h-3.5 w-3.5 text-white mr-1" viewBox="0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                  </svg>
                                )}
                                <span>{editQuestion ? "Apply Updates" : "Publish Question"}</span>
                              </button>
                            </div>
                          </div>
                        </form>

                        {/* List of Curriculum Questions */}
                        <div>
                          <h4 className="text-xs uppercase font-mono tracking-wider font-bold text-slate-400 mb-3 block">
                            Active Curriculum Questions List ({rawQuestions.length})
                          </h4>

                          {loadingQuestions && rawQuestions.length === 0 ? (
                            <div className="py-12 flex flex-col items-center justify-center space-y-2">
                              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-400 border-solid"></div>
                              <p className="text-xs text-indigo-300 font-mono">Syncing exam questions...</p>
                            </div>
                          ) : rawQuestions.length === 0 ? (
                            <div className="p-12 text-center border-2 border-dashed border-white/10 rounded-2xl">
                              <HelpCircle className="h-9 w-9 text-slate-500 mx-auto opacity-70 mb-2" />
                              <h5 className="font-bold text-white text-xs">No questions loaded for this curriculum lesson.</h5>
                              <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                                Ensure exactly 10 questions are published before launching interactive play sessions.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4" id="questions-card-list">
                              {rawQuestions.map((q) => (
                                <div
                                  key={q.questionId}
                                  id={`question-card-${q.questionId}`}
                                  className={`bg-white/5 border rounded-2xl p-5 hover:bg-shadow transition-all space-y-3 relative ${
                                    q.active ? "border-white/10" : "border-white/5 opacity-65"
                                  }`}
                                >
                                  {/* Upper Meta */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-mono text-xs font-bold bg-indigo-500/20 text-indigo-305 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/10">
                                        Q{q.questionNo}
                                      </span>
                                      {!q.active && (
                                        <span className="bg-slate-500/20 text-slate-400 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">
                                          Inactive
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center space-x-2">
                                      <span className="font-mono font-bold text-[10px] text-white bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                                        {q.points} Points
                                      </span>
                                    </div>
                                  </div>

                                  {/* Prompt */}
                                  <p className="text-xs font-bold text-white leading-relaxed pr-12">
                                    {q.questionText}
                                  </p>

                                  {/* Choices Grid */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    {q.choices.map((ch, idx) => {
                                      const isCorrect = idx === q.correctChoiceIndex;
                                      return (
                                        <div
                                          key={idx}
                                          className={`p-2.5 rounded-lg border flex items-center justify-between ${
                                            isCorrect
                                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                              : "bg-white/5 border-white/5 text-slate-300"
                                          }`}
                                        >
                                          <span>
                                            <strong className="opacity-80 mr-1">{String.fromCharCode(65 + idx)}.</strong> {ch}
                                          </span>
                                          {isCorrect && <Check className="h-3.5 w-3.5 text-emerald-300 shrink-0 ml-1" />}
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {/* Explanation block */}
                                  {q.explanation && (
                                    <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 text-[11px] text-slate-300 leading-relaxed">
                                      <span className="font-bold text-indigo-305 text-indigo-300 block mb-0.5">Educational Explanation:</span>
                                      {q.explanation}
                                    </div>
                                  )}

                                  {/* Actions */}
                                  <div className="border-t border-white/5 pt-3.5 flex justify-end space-x-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setQuestionFormNo(String(q.questionNo));
                                        setQuestionFormText(q.questionText);
                                        setQuestionFormChoices(q.choices);
                                        setQuestionFormCorrect(q.correctChoiceIndex);
                                        setQuestionFormPoints(String(q.points));
                                        setQuestionFormExpl(q.explanation || "");
                                        setQuestionFormActive(q.active);
                                        setEditQuestion(q);
                                        document.getElementById("question-bank-form")?.scrollIntoView({ behavior: "smooth" });
                                      }}
                                      className="p-1 px-3 bg-white/5 hover:bg-white/10 text-slate-305 text-slate-300 rounded text-[11px] font-semibold cursor-pointer"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleQuestionActive(q)}
                                      className={`p-1 px-3 text-[11px] font-semibold rounded cursor-pointer ${
                                        q.active
                                          ? "bg-slate-500/20 text-slate-305 hover:bg-slate-500/30"
                                          : "bg-indigo-500/20 text-indigo-303 text-indigo-300 hover:bg-indigo-500/35"
                                      }`}
                                    >
                                      {q.active ? "Deactivate" : "Activate"}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            )}

            {/* TAB CONTENT: QUIZ CLASS SESSIONS HISTORIC LOGS */}
            {activeTab === "sessions" && (
              <div className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl p-6 space-y-4 text-white shadow-xl">
                <div className="border-b border-white/10 pb-3 mb-4">
                  <h3 className="font-bold text-white text-sm flex items-center">
                    <ClipboardList className="h-4.5 w-4.5 text-indigo-400 mr-2" />
                    Historic Class Sessions ({sessions.length})
                  </h3>
                  <p className="text-slate-400 text-[10px] mt-1">
                    Records of previous launches and current active draft session instances.
                  </p>
                </div>

                {sessions.length === 0 ? (
                  <div className="p-12 text-center bg-white/5 border border-dashed border-white/10 rounded-xl text-xs text-slate-400">
                    No sessions launched for this course yet. Go to 'Lessons & Questions' to start a session.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sessions.map((sess) => {
                      const lessonObj = lessons.find((l) => l.lessonId === sess.lessonId);
                      return (
                        <div
                          key={sess.sessionId}
                          onClick={() => {
                            setActiveSession(sess);
                            triggerRefresh();
                          }}
                          className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between cursor-pointer hover:border-indigo-500/50 hover:bg-white/10 transition-all text-xs text-white"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-white">
                                {lessonObj?.title || `Lesson: ${sess.lessonId}`}
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                  sess.status === "open"
                                    ? "bg-emerald-500/20 text-emerald-300 animate-pulse border border-emerald-500/20"
                                    : sess.status === "closed"
                                    ? "bg-white/10 text-slate-300"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/20"
                                }`}
                              >
                                {sess.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">
                              Access Code Join: <span className="font-mono text-[11px] font-bold text-indigo-305 text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">{sess.joinCode}</span> | Launched: {new Date(sess.startedAt).toLocaleString()}
                            </p>
                          </div>

                          <div className="mt-3.5 sm:mt-0 flex items-center space-x-3.5">
                            <div className="text-right">
                              <span className="font-semibold text-white block">
                                Snapshot: {sess.totalQuestions} Questions
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">
                                Max weight: {sess.maxScore} pts
                              </span>
                            </div>
                            <ChevronRight className="h-5 w-5 text-indigo-400" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Classroom Operation Notes & Spark Plan Help Deck */}
      <section className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4">
        <div className="flex items-center space-x-3 border-b border-white/10 pb-3">
          <HelpCircle className="h-5 w-5 text-indigo-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
            System Notes & Spark Plan Operations Guide
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs text-slate-300 leading-relaxed font-sans">
          <div className="space-y-3">
            <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
              <span className="font-bold text-white block mb-1">🎮 Real-Time Rotating Join Code</span>
              <p className="text-[11px] text-slate-400">
                To combat proxy cheating and code-sharing, dynamic QR codes and numeric keys rotate in-memory every 10 seconds. Calculations are solved client-side based on the session ID timestamp, requiring <strong className="text-white">zero database writes</strong>—keeping Spark-tier quotas perfectly operational.
              </p>
            </div>
            <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
              <span className="font-bold text-white block mb-1">⚡ Spark Quota & Database Boundaries</span>
              <p className="text-[11px] text-slate-400">
                This academic portal executes entirely using local browsers and a serverless client-side Firestore architecture. Score calculations are batched in safe student-sized transactions. If daily Spark unit reads/writes are capped, they auto-reset at midnight (PST).
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
              <span className="font-bold text-white block mb-1">📈 Grading & Leaderboard Finalization</span>
              <p className="text-[11px] text-slate-400">
                Correct answer documents reside in the locked <code className="bg-slate-950 px-1 py-0.5 rounded font-mono text-[10px] text-rose-300 font-bold">privateAnswerKey</code> subcollection. Students cannot access keys during play. Teachers must trigger <strong className="text-white">"Finalize Scores"</strong> at the end of quiz play to batch-grade and sync rankings to the Top 5 scoreboard display safely.
              </p>
            </div>

            <div className="p-3 bg-indigo-500/15 border border-indigo-500/25 rounded-2xl">
              <span className="font-bold text-indigo-300 flex items-center space-x-1 mb-1">
                <Sparkles className="h-4 w-4 mr-1 text-indigo-400 inline" />
                <span>Future Automation & Apps Script Roadmap</span>
              </span>
              <p className="text-[11px] text-indigo-200">
                ClassPulse is built standalone for Netlify hosting. To integrate active Gmail alerts, calendar invites, or automate emails after grade scoring, the recommended path is deploying a unified, lightweight <strong className="text-white">Google Apps Script</strong> endpoint bound to your exported spreadsheet CSV logs.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
