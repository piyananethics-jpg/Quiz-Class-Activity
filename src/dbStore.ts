/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserDoc,
  CourseDoc,
  SectionDoc,
  EnrollmentDoc,
  LessonDoc,
  QuestionDoc,
  SessionDoc,
  ParticipantDoc,
  SubmissionDoc,
  LeaderboardDoc,
  QuestionSnapshot,
  AnswerItem
} from "./types";
import { db, isFirebaseConfigured } from "./firebase";
import {
  doc,
  setDoc,
  updateDoc,
  collection,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
  getDocs
} from "firebase/firestore";


// Private mock DB structure
interface MockDatabase {
  users: Record<string, UserDoc>;
  courses: Record<string, CourseDoc>;
  sections: Record<string, SectionDoc[]>; // courseId -> list of sections
  enrollments: Record<string, EnrollmentDoc[]>; // courseId_sectionId -> list
  lessons: Record<string, LessonDoc[]>; // courseId -> list
  questions: Record<string, QuestionDoc[]>; // courseId_lessonId -> list
  sessions: Record<string, SessionDoc>; // sessionId -> SessionDoc
  participants: Record<string, ParticipantDoc[]>; // sessionId -> list
  submissions: Record<string, SubmissionDoc[]>; // sessionId -> list
  leaderboards: Record<string, LeaderboardDoc[]>; // sessionId -> list
  currentUserUid: string;
}

const STORAGE_KEY = "classpulse_db_storage";

// Simple reactive subscriber system
const listeners = new Set<() => void>();
export function subscribeToDB(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error("Listener error", e);
    }
  });
}

// Mask Student ID (e.g. "64234589" -> "64****89")
export function maskStudentId(studentId: string): string {
  if (studentId.length <= 4) return "****";
  const start = studentId.substring(0, 2);
  const end = studentId.substring(studentId.length - 2);
  return `${start}****${end}`;
}

// Generate simple hash/code for join
function generateJoinCode(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // exclude confusing characters e.g. 0, O, I, 1
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper to calculate simple hash
function simpleHash(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash << 5) - hash + code.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return "hash_" + Math.abs(hash).toString(16);
}

// Seed Initial Data
const INITIAL_DB: MockDatabase = {
  users: {
    "teacher-1": {
      uid: "teacher-1",
      role: "teacher",
      email: "piyananethics@gmail.com",
      displayName: "Dr. Elena Vance",
      createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000
    },
    "student-1": {
      uid: "student-1",
      role: "student",
      email: "student.bob@university.edu",
      displayName: "Bob Carter",
      studentId: "64234589",
      createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000
    },
    "student-2": {
      uid: "student-2",
      role: "student",
      email: "student.alice@university.edu",
      displayName: "Alice Jenkins",
      studentId: "64987612",
      createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000
    },
    "student-3": {
      uid: "student-3",
      role: "student",
      email: "student.charlie@university.edu",
      displayName: "Charlie Vance",
      studentId: "64555123",
      createdAt: Date.now() - 24 * 24 * 60 * 60 * 1000
    }
  },
  courses: {
    "cs-101": {
      courseId: "cs-101",
      courseCode: "CS-101",
      courseName: "Introduction to Computer Science",
      ownerUid: "teacher-1",
      createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000
    },
    "mat-210": {
      courseId: "mat-210",
      courseCode: "MAT-210",
      courseName: "Linear Algebra",
      ownerUid: "teacher-1",
      createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000
    }
  },
  sections: {
    "cs-101": [
      { courseId: "cs-101", sectionId: "sec-a", sectionName: "Section A", term: "Fall 2026", active: true },
      { courseId: "cs-101", sectionId: "sec-b", sectionName: "Section B", term: "Fall 2026", active: true }
    ],
    "mat-210": [
      { courseId: "mat-210", sectionId: "sec-01", sectionName: "Section 01", term: "Spring 2026", active: true }
    ]
  },
  enrollments: {
    "cs-101_sec-a": [
      { courseId: "cs-101", sectionId: "sec-a", studentUidOrEmail: "student-1", studentId: "64234589", fullName: "Bob Carter", email: "student.bob@university.edu", status: "active" },
      { courseId: "cs-101", sectionId: "sec-a", studentUidOrEmail: "student-2", studentId: "64987612", fullName: "Alice Jenkins", email: "student.alice@university.edu", status: "active" },
      { courseId: "cs-101", sectionId: "sec-a", studentUidOrEmail: "student-3", studentId: "64555123", fullName: "Charlie Vance", email: "student.charlie@university.edu", status: "active" }
    ],
    "cs-101_sec-b": [
      { courseId: "cs-101", sectionId: "sec-b", studentUidOrEmail: "student-1", studentId: "64234589", fullName: "Bob Carter", email: "student.bob@university.edu", status: "active" }
    ],
    "mat-210_sec-01": [
      { courseId: "mat-210", sectionId: "sec-01", studentUidOrEmail: "student-2", studentId: "64987612", fullName: "Alice Jenkins", email: "student.alice@university.edu", status: "active" }
    ]
  },
  lessons: {
    "cs-101": [
      { courseId: "cs-101", lessonId: "les-1", lessonNo: 1, title: "Introduction to JavaScript and TypeScript", lessonTitle: "Introduction to JavaScript and TypeScript", active: true, questionCount: 3 },
      { courseId: "cs-101", lessonId: "les-2", lessonNo: 2, title: "Understanding React DOM & Event Listeners", lessonTitle: "Understanding React DOM & Event Listeners", active: true, questionCount: 2 }
    ],
    "mat-210": [
      { courseId: "mat-210", lessonId: "les-mat1", lessonNo: 1, title: "Systems of Linear Equations", lessonTitle: "Systems of Linear Equations", active: true, questionCount: 1 }
    ]
  },
  questions: {
    "cs-101_les-1": [
      {
        courseId: "cs-101",
        lessonId: "les-1",
        questionId: "q-1-1",
        questionNo: 1,
        questionText: "What keyword is used to declare an immutable variable block in TypeScript?",
        choices: ["var", "let", "const", "def"],
        correctChoiceIndex: 2,
        points: 10,
        active: true
      },
      {
        courseId: "cs-101",
        lessonId: "les-1",
        questionId: "q-1-2",
        questionNo: 2,
        questionText: "Which of the following is NOT a valid primitive type in TypeScript?",
        choices: ["string", "boolean", "number", "tuple"],
        correctChoiceIndex: 3,
        points: 10,
        active: true
      },
      {
        courseId: "cs-101",
        lessonId: "les-1",
        questionId: "q-1-3",
        questionNo: 3,
        questionText: "What is the primary compilation target output for standard TypeScript code?",
        choices: ["C++", "JavaScript", "Assembly / WASM", "Python"],
        correctChoiceIndex: 1,
        points: 15,
        active: true
      }
    ],
    "cs-101_les-2": [
      {
        courseId: "cs-101",
        lessonId: "les-2",
        questionId: "q-2-1",
        questionNo: 1,
        questionText: "Which DOM method is used to dynamically register an event listener on standard elements?",
        choices: ["addEventListener", "attachEventHandler", "registerEvent", "bindListener"],
        correctChoiceIndex: 0,
        points: 10,
        active: true
      },
      {
        courseId: "cs-101",
        lessonId: "les-2",
        questionId: "q-2-2",
        questionNo: 2,
        questionText: "Which of the following represents standard HTML click events in React JSX?",
        choices: ["onclick", "onClick", "onSelect", "clickEvent"],
        correctChoiceIndex: 1,
        points: 10,
        active: true
      }
    ],
    "mat-210_les-mat1": [
      {
        courseId: "mat-210",
        lessonId: "les-mat1",
        questionId: "q-mat-1",
        questionNo: 1,
        questionText: "Which of the following operations on an augmented matrix does NOT preserve its solution set?",
        choices: [
          "Interchanging two rows",
          "Multiplying a row by a non-zero scalar",
          "Adding a non-zero constant to every entry of a row",
          "Adding a multiple of one row to another row"
        ],
        correctChoiceIndex: 2,
        points: 10,
        active: true
      }
    ]
  },
  sessions: {},
  participants: {},
  submissions: {},
  leaderboards: {},
  currentUserUid: "teacher-1"
};

// Load database from localStorage or seed
function loadDatabase(): MockDatabase {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DB));
    return JSON.parse(JSON.stringify(INITIAL_DB));
  }
  try {
    const parsed = JSON.parse(raw);
    // Backward compatibility for newly added collections
    if (!parsed.sessions) parsed.sessions = {};
    if (!parsed.participants) parsed.participants = {};
    if (!parsed.submissions) parsed.submissions = {};
    if (!parsed.leaderboards) parsed.leaderboards = {};
    if (!parsed.currentUserUid) parsed.currentUserUid = "teacher-1";
    return parsed;
  } catch (e) {
    console.error("Failed to parse stored DB, resetting to defaults", e);
    return JSON.parse(JSON.stringify(INITIAL_DB));
  }
}

let dbState = loadDatabase();

function saveDatabase() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dbState));
  notifyListeners();
}

// PUBLIC DATABASE LOGIC
export function initFirestoreListeners(userUid: string) {
  if (!isFirebaseConfigured || !db) return;

  console.log("Initializing dynamic Firestore real-time listeners for user:", userUid);

  // Profile listener
  onSnapshot(doc(db, "users", userUid), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      dbState.users[userUid] = {
        uid: userUid,
        displayName: data.displayName || "AU Academic",
        email: data.email || "",
        role: data.role,
        studentId: data.studentId,
        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now()
      };
      saveDatabase();
    }
  });

  // Dynamic courses and subcollections tree listener
  onSnapshot(collection(db, "courses"), (snapshot) => {
    snapshot.docs.forEach((courseDoc) => {
      const cData = courseDoc.data();
      const courseId = courseDoc.id;
      dbState.courses[courseId] = {
        courseId,
        courseCode: cData.courseCode,
        courseName: cData.courseName,
        ownerUid: cData.ownerUid,
        createdAt: cData.createdAt?.toMillis ? cData.createdAt.toMillis() : Date.now()
      };

      // Sections subcollection listener
      onSnapshot(collection(db, "courses", courseId, "sections"), (secSnap) => {
        dbState.sections[courseId] = [];
        secSnap.docs.forEach((secDoc) => {
          const sData = secDoc.data();
          const sectionId = secDoc.id;
          dbState.sections[courseId] = dbState.sections[courseId].filter(s => s.sectionId !== sectionId);
          dbState.sections[courseId].push({
            courseId,
            sectionId,
            sectionName: sData.sectionName,
            term: sData.term || "Fall 2026",
            active: sData.active ?? true
          });

          // Enrollments subcollection listener
          onSnapshot(collection(db, "courses", courseId, "sections", sectionId, "enrollments"), (enrSnap) => {
            const key = `${courseId}_${sectionId}`;
            dbState.enrollments[key] = [];
            enrSnap.docs.forEach((enrDoc) => {
              const eData = enrDoc.data();
              dbState.enrollments[key].push({
                courseId,
                sectionId,
                studentUidOrEmail: eData.studentUidOrEmail,
                studentId: eData.studentId,
                fullName: eData.fullName,
                email: eData.email,
                status: eData.status || "active"
              });
            });
            saveDatabase();
          });
        });
        saveDatabase();
      });
    });
    saveDatabase();
  });

  // Real-time root sessions collection listener for multiplayer synchronization
  onSnapshot(collection(db, "sessions"), (snapshot) => {
    snapshot.docs.forEach((sessDoc) => {
      const sData = sessDoc.data();
      const sessionId = sessDoc.id;
      const existing = dbState.sessions[sessionId];

      dbState.sessions[sessionId] = {
        sessionId,
        courseId: sData.courseId,
        sectionId: sData.sectionId,
        lessonId: sData.lessonId,
        teacherUid: sData.teacherUid,
        status: sData.status,
        startedAt: sData.startedAt?.toMillis ? sData.startedAt.toMillis() : (sData.startedAt || Date.now()),
        closedAt: sData.closedAt?.toMillis ? sData.closedAt.toMillis() : (sData.closedAt || undefined),
        joinCodeHash: sData.joinCodeHash || simpleHash(sData.joinCodeStatic || ""),
        joinCode: sData.joinCodeStatic || sData.joinCode || "",
        totalQuestions: sData.totalQuestions || 0,
        maxScore: sData.maxScore || 0,
        sessionSecret: sData.sessionSecret || "",
        expiresAt: sData.expiresAt?.toMillis ? sData.expiresAt.toMillis() : sData.expiresAt,
        questionSnapshot: existing?.questionSnapshot || [] // preserve local copy
      };

      // Register real-time subcollection listeners (participants, submissions, leaderboard) for live play room
      setupSessionSubcollectionListeners(sessionId);
    });
    saveDatabase();
  });
}

export function getCurrentUser(): UserDoc {
  const uid = dbState.currentUserUid;
  return dbState.users[uid] || dbState.users["teacher-1"];
}

export function switchUser(uid: string) {
  if (dbState.users[uid]) {
    dbState.currentUserUid = uid;
    saveDatabase();
  }
}

export function getAllUsers(): UserDoc[] {
  return Object.values(dbState.users);
}

export function createNewUser(uid: string, displayName: string, email: string, role: "teacher" | "student", studentId?: string) {
  dbState.users[uid] = {
    uid,
    displayName,
    email,
    role,
    studentId,
    createdAt: Date.now()
  };
  saveDatabase();
}

// Courses
export function getCourses(): CourseDoc[] {
  return Object.values(dbState.courses);
}

export function addCourse(courseCode: string, courseName: string, teacherUid: string): CourseDoc {
  const courseId = "course_" + Math.random().toString(36).substring(2, 9);
  const newCourse: CourseDoc = {
    courseId,
    courseCode,
    courseName,
    ownerUid: teacherUid,
    createdAt: Date.now()
  };
  dbState.courses[courseId] = newCourse;
  dbState.sections[courseId] = [];
  dbState.lessons[courseId] = [];
  saveDatabase();

  if (isFirebaseConfigured && db) {
    setDoc(doc(db, "courses", courseId), {
      courseCode,
      courseName,
      ownerUid: teacherUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).catch(err => console.error("Firestore Course creation failed:", err));
  }

  return newCourse;
}

// Sections
export function getSections(courseId: string): SectionDoc[] {
  return dbState.sections[courseId] || [];
}

export function addSection(courseId: string, sectionName: string, term: string): SectionDoc {
  if (!dbState.sections[courseId]) {
    dbState.sections[courseId] = [];
  }
  const sectionId = "sec_" + Math.random().toString(36).substring(2, 9);
  const newSection: SectionDoc = {
    courseId,
    sectionId,
    sectionName,
    term,
    active: true
  };
  dbState.sections[courseId].push(newSection);
  dbState.enrollments[`${courseId}_${sectionId}`] = [];
  saveDatabase();

  if (isFirebaseConfigured && db) {
    setDoc(doc(db, "courses", courseId, "sections", sectionId), {
      sectionName,
      term,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).catch(err => console.error("Firestore Section creation failed:", err));
  }

  return newSection;
}

// Enrollments
export function getEnrollments(courseId: string, sectionId: string): EnrollmentDoc[] {
  return dbState.enrollments[`${courseId}_${sectionId}`] || [];
}

export function addEnrollment(courseId: string, sectionId: string, studentId: string, fullName: string, email: string): EnrollmentDoc {
  const key = `${courseId}_${sectionId}`;
  if (!dbState.enrollments[key]) {
    dbState.enrollments[key] = [];
  }
  // Check if there is a matching user for studentUidOrEmail
  const existingUser = Object.values(dbState.users).find((u) => u.email.toLowerCase() === email.toLowerCase());
  const studentUidOrEmail = existingUser ? existingUser.uid : email;

  const newEnrollment: EnrollmentDoc = {
    courseId,
    sectionId,
    studentUidOrEmail,
    studentId,
    fullName,
    email,
    status: "active"
  };
  dbState.enrollments[key].push(newEnrollment);
  saveDatabase();

  if (isFirebaseConfigured && db) {
    setDoc(doc(db, "courses", courseId, "sections", sectionId, "enrollments", studentId), {
      studentUidOrEmail,
      studentId,
      fullName,
      email: email.toLowerCase(),
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).catch(err => console.error("Firestore Enrollment creation failed:", err));
  }

  return newEnrollment;
}

export async function batchAddEnrollments(
  courseId: string,
  sectionId: string,
  records: Array<{ studentId: string; fullName: string; email: string; no: number }>,
  teacherUid: string
) {
  const key = `${courseId}_${sectionId}`;
  if (!dbState.enrollments[key]) {
    dbState.enrollments[key] = [];
  }

  records.forEach((rec) => {
    const existingUser = Object.values(dbState.users).find((u) => u.email.toLowerCase() === rec.email.toLowerCase());
    const studentUidOrEmail = existingUser ? existingUser.uid : rec.email.toLowerCase();

    dbState.enrollments[key] = dbState.enrollments[key].filter(
      e => e.studentId !== rec.studentId && e.email.toLowerCase() !== rec.email.toLowerCase()
    );

    dbState.enrollments[key].push({
      courseId,
      sectionId,
      studentUidOrEmail,
      studentId: rec.studentId,
      fullName: rec.fullName,
      email: rec.email.toLowerCase(),
      status: "active"
    });
  });
  saveDatabase();

  if (isFirebaseConfigured && db) {
    const batch = writeBatch(db);
    records.forEach((rec) => {
      const existingUser = Object.values(dbState.users).find((u) => u.email.toLowerCase() === rec.email.toLowerCase());
      const studentUidOrEmail = existingUser ? existingUser.uid : rec.email.toLowerCase();

      const enrollmentDocRef = doc(db, "courses", courseId, "sections", sectionId, "enrollments", rec.studentId);
      batch.set(enrollmentDocRef, {
        studentUidOrEmail,
        studentId: rec.studentId,
        fullName: rec.fullName,
        email: rec.email.toLowerCase(),
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        importedByUid: teacherUid
      });
    });
    await batch.commit();
  }
}


// Lessons
export function getLessons(courseId: string): LessonDoc[] {
  return dbState.lessons[courseId] || [];
}

export async function fetchLessons(courseId: string): Promise<LessonDoc[]> {
  if (isFirebaseConfigured && db) {
    try {
      const lessonsRef = collection(db, "courses", courseId, "lessons");
      const snap = await getDocs(lessonsRef);
      const fetched: LessonDoc[] = [];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const lesson: LessonDoc = {
          courseId,
          lessonId: docSnap.id,
          lessonNo: Number(data.lessonNo) || 1,
          title: data.lessonTitle || data.title || "",
          lessonTitle: data.lessonTitle || data.title || "",
          description: data.description || "",
          active: data.active ?? true,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
          questionCount: data.questionCount ?? 0,
        };
        fetched.push(lesson);
      });
      // Sort client-side
      fetched.sort((a, b) => a.lessonNo - b.lessonNo);
      dbState.lessons[courseId] = fetched;
      saveDatabase();
      return fetched;
    } catch (e) {
      console.error("Error fetching lessons from Firestore:", e);
    }
  }
  return dbState.lessons[courseId] || [];
}

export function addLesson(courseId: string, title: string, lessonNo: number): LessonDoc {
  if (!dbState.lessons[courseId]) {
    dbState.lessons[courseId] = [];
  }
  const lessonId = "les_" + Math.random().toString(36).substring(2, 9);
  const newLesson: LessonDoc = {
    courseId,
    lessonId,
    lessonNo,
    title,
    lessonTitle: title,
    description: "",
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    questionCount: 0
  };
  dbState.lessons[courseId].push(newLesson);
  dbState.lessons[courseId].sort((a, b) => a.lessonNo - b.lessonNo);
  dbState.questions[`${courseId}_${lessonId}`] = [];
  saveDatabase();

  if (isFirebaseConfigured && db) {
    setDoc(doc(db, "courses", courseId, "lessons", lessonId), {
      lessonId,
      courseId,
      lessonNo,
      lessonTitle: title,
      title, // consistency
      description: "",
      active: true,
      questionCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).catch(err => console.error("Firestore Lesson creation failed:", err));
  }

  return newLesson;
}

export async function createLessonInFirestore(
  courseId: string,
  lessonNo: number,
  lessonTitle: string,
  description: string,
  active: boolean
): Promise<LessonDoc> {
  const lessonId = "les_" + Math.random().toString(36).substring(2, 9);
  const newLesson: LessonDoc = {
    courseId,
    lessonId,
    lessonNo,
    title: lessonTitle,
    lessonTitle,
    description,
    active,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    questionCount: 0
  };

  if (!dbState.lessons[courseId]) {
    dbState.lessons[courseId] = [];
  }
  dbState.lessons[courseId] = dbState.lessons[courseId].filter(l => l.lessonId !== lessonId);
  dbState.lessons[courseId].push(newLesson);
  dbState.lessons[courseId].sort((a, b) => a.lessonNo - b.lessonNo);
  dbState.questions[`${courseId}_${lessonId}`] = [];
  saveDatabase();

  if (isFirebaseConfigured && db) {
    try {
      const lessonRef = doc(db, "courses", courseId, "lessons", lessonId);
      await setDoc(lessonRef, {
        lessonId,
        courseId,
        lessonNo,
        lessonTitle,
        title: lessonTitle,
        description,
        active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        questionCount: 0
      });
    } catch (err) {
      console.error("Firestore create lesson failed:", err);
      throw err;
    }
  }

  return newLesson;
}

export async function updateLessonInFirestore(
  courseId: string,
  lessonId: string,
  updates: Partial<LessonDoc>
): Promise<void> {
  if (!dbState.lessons[courseId]) return;
  dbState.lessons[courseId] = dbState.lessons[courseId].map((l) => {
    if (l.lessonId === lessonId) {
      const merged = { ...l, ...updates, updatedAt: Date.now() };
      if (updates.lessonTitle) merged.title = updates.lessonTitle;
      return merged;
    }
    return l;
  });
  dbState.lessons[courseId].sort((a, b) => a.lessonNo - b.lessonNo);
  saveDatabase();

  if (isFirebaseConfigured && db) {
    try {
      const lessonRef = doc(db, "courses", courseId, "lessons", lessonId);
      const fsUpdates: any = {
        updatedAt: serverTimestamp()
      };
      if (updates.lessonNo !== undefined) fsUpdates.lessonNo = updates.lessonNo;
      if (updates.lessonTitle !== undefined) {
        fsUpdates.lessonTitle = updates.lessonTitle;
        fsUpdates.title = updates.lessonTitle;
      }
      if (updates.description !== undefined) fsUpdates.description = updates.description;
      if (updates.active !== undefined) fsUpdates.active = updates.active;
      if (updates.questionCount !== undefined) fsUpdates.questionCount = updates.questionCount;

      await updateDoc(lessonRef, fsUpdates);
    } catch (err) {
      console.error("Firestore update lesson failed:", err);
      throw err;
    }
  }
}

// Questions
export function getQuestions(courseId: string, lessonId: string): QuestionDoc[] {
  return dbState.questions[`${courseId}_${lessonId}`] || [];
}

export async function fetchQuestions(courseId: string, lessonId: string): Promise<QuestionDoc[]> {
  const key = `${courseId}_${lessonId}`;
  if (isFirebaseConfigured && db) {
    try {
      const questionsRef = collection(db, "courses", courseId, "lessons", lessonId, "questions");
      const snap = await getDocs(questionsRef);
      const fetched: QuestionDoc[] = [];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const question: QuestionDoc = {
          courseId,
          lessonId,
          questionId: docSnap.id,
          questionNo: Number(data.questionNo) || 1,
          questionText: data.questionText || "",
          choices: Array.isArray(data.choices) ? data.choices : ["", "", "", ""],
          correctChoiceIndex: Number(data.correctChoiceIndex) ?? 0,
          points: Number(data.points) ?? 1,
          explanation: data.explanation || "",
          active: data.active ?? true,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : Date.now(),
          updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
        };
        fetched.push(question);
      });
      fetched.sort((a, b) => a.questionNo - b.questionNo);
      dbState.questions[key] = fetched;
      saveDatabase();
      return fetched;
    } catch (e) {
      console.error("Error fetching questions from Firestore:", e);
    }
  }
  return dbState.questions[key] || [];
}

export function addQuestion(
  courseId: string,
  lessonId: string,
  questionText: string,
  choices: string[],
  correctChoiceIndex: number,
  points: number
): QuestionDoc {
  const key = `${courseId}_${lessonId}`;
  if (!dbState.questions[key]) {
    dbState.questions[key] = [];
  }
  const questionId = "q_" + Math.random().toString(36).substring(2, 9);
  const nextNo = dbState.questions[key].length + 1;
  const newQuestion: QuestionDoc = {
    courseId,
    lessonId,
    questionId,
    questionNo: nextNo,
    questionText,
    choices,
    correctChoiceIndex,
    points,
    explanation: "",
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  dbState.questions[key].push(newQuestion);
  dbState.questions[key].sort((a, b) => a.questionNo - b.questionNo);

  const activeQuestions = dbState.questions[key].filter(q => q.active);
  const questionCount = activeQuestions.length;

  if (dbState.lessons[courseId]) {
    dbState.lessons[courseId] = dbState.lessons[courseId].map(l =>
      l.lessonId === lessonId ? { ...l, questionCount } : l
    );
  }
  saveDatabase();

  if (isFirebaseConfigured && db) {
    setDoc(doc(db, "courses", courseId, "lessons", lessonId, "questions", questionId), {
      questionId,
      courseId,
      lessonId,
      questionNo: nextNo,
      questionText,
      choices,
      correctChoiceIndex,
      points,
      explanation: "",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).catch(err => console.error("Firestore Question creation failed:", err));

    updateDoc(doc(db, "courses", courseId, "lessons", lessonId), {
      questionCount,
      updatedAt: serverTimestamp()
    }).catch(err => console.error("Firestore lesson update failed:", err));
  }

  return newQuestion;
}

export async function createQuestionInFirestore(
  courseId: string,
  lessonId: string,
  questionNo: number,
  questionText: string,
  choices: string[],
  correctChoiceIndex: number,
  points: number,
  explanation: string,
  active: boolean
): Promise<QuestionDoc> {
  const key = `${courseId}_${lessonId}`;
  const questionId = "q_" + Math.random().toString(36).substring(2, 9);
  
  const newQuestion: QuestionDoc = {
    courseId,
    lessonId,
    questionId,
    questionNo,
    questionText,
    choices,
    correctChoiceIndex,
    points,
    explanation,
    active,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  if (!dbState.questions[key]) {
    dbState.questions[key] = [];
  }
  dbState.questions[key] = dbState.questions[key].filter(q => q.questionId !== questionId);
  dbState.questions[key].push(newQuestion);
  dbState.questions[key].sort((a, b) => a.questionNo - b.questionNo);
  
  const activeQuestions = dbState.questions[key].filter(q => q.active);
  const questionCount = activeQuestions.length;

  if (dbState.lessons[courseId]) {
    dbState.lessons[courseId] = dbState.lessons[courseId].map(l => 
      l.lessonId === lessonId ? { ...l, questionCount } : l
    );
  }
  saveDatabase();

  if (isFirebaseConfigured && db) {
    try {
      const qRef = doc(db, "courses", courseId, "lessons", lessonId, "questions", questionId);
      await setDoc(qRef, {
        questionId,
        courseId,
        lessonId,
        questionNo,
        questionText,
        choices,
        correctChoiceIndex,
        points,
        explanation,
        active,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      const lessonRef = doc(db, "courses", courseId, "lessons", lessonId);
      await updateDoc(lessonRef, {
        questionCount,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Firestore create question failed:", err);
      throw err;
    }
  }

  return newQuestion;
}

export async function updateQuestionInFirestore(
  courseId: string,
  lessonId: string,
  questionId: string,
  updates: Partial<QuestionDoc>
): Promise<void> {
  const key = `${courseId}_${lessonId}`;
  if (!dbState.questions[key]) return;

  dbState.questions[key] = dbState.questions[key].map(q => {
    if (q.questionId === questionId) {
      return { ...q, ...updates, updatedAt: Date.now() };
    }
    return q;
  });
  dbState.questions[key].sort((a, b) => a.questionNo - b.questionNo);

  const activeQuestions = dbState.questions[key].filter(q => q.active);
  const questionCount = activeQuestions.length;

  if (dbState.lessons[courseId]) {
    dbState.lessons[courseId] = dbState.lessons[courseId].map(l =>
      l.lessonId === lessonId ? { ...l, questionCount } : l
    );
  }
  saveDatabase();

  if (isFirebaseConfigured && db) {
    try {
      const qRef = doc(db, "courses", courseId, "lessons", lessonId, "questions", questionId);
      const fsUpdates: any = {
        updatedAt: serverTimestamp()
      };
      if (updates.questionNo !== undefined) fsUpdates.questionNo = updates.questionNo;
      if (updates.questionText !== undefined) fsUpdates.questionText = updates.questionText;
      if (updates.choices !== undefined) fsUpdates.choices = updates.choices;
      if (updates.correctChoiceIndex !== undefined) fsUpdates.correctChoiceIndex = updates.correctChoiceIndex;
      if (updates.points !== undefined) fsUpdates.points = updates.points;
      if (updates.explanation !== undefined) fsUpdates.explanation = updates.explanation;
      if (updates.active !== undefined) fsUpdates.active = updates.active;

      await updateDoc(qRef, fsUpdates);

      const lessonRef = doc(db, "courses", courseId, "lessons", lessonId);
      await updateDoc(lessonRef, {
        questionCount,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Firestore update question failed:", err);
      throw err;
    }
  }
}

// Sessions
export function getSession(sessionId: string): SessionDoc | undefined {
  return dbState.sessions[sessionId];
}

export function getSessions(): SessionDoc[] {
  return Object.values(dbState.sessions);
}

// Session Helper: Deterministic dynamic rotatable code generator
export function getTimeWindowIndex(intervalSeconds = 10): number {
  return Math.floor(Date.now() / (intervalSeconds * 1000));
}

export function generateDynamicCode(sessionId: string, sessionSecret: string, windowIndex: number): string {
  const raw = `${sessionId}:${sessionSecret}:${windowIndex}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  const numeric = Math.abs(hash);
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ"; 
  let code = "";
  let val = numeric;
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(val % chars.length);
    val = Math.floor(val / chars.length);
  }
  return code;
}

const activeSubcollectionListeners = new Set<string>();

function setupSessionSubcollectionListeners(sessionId: string) {
  if (!isFirebaseConfigured || !db) return;
  if (activeSubcollectionListeners.has(sessionId)) return;
  activeSubcollectionListeners.add(sessionId);

  // 1. Listen to participants subcollection
  onSnapshot(collection(db, "sessions", sessionId, "participants"), (snap) => {
    dbState.participants[sessionId] = [];
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      dbState.participants[sessionId].push({
        sessionId,
        studentUid: docSnap.id,
        email: data.email || "",
        studentId: data.studentId || "N/A",
        fullName: data.fullName || "AU Student",
        joinedAt: data.joinedAt?.toMillis ? data.joinedAt.toMillis() : (data.joinedAt || Date.now()),
        status: data.status || "joined"
      });
    });
    saveDatabase();
  });

  // 2. Listen to submissions subcollection
  onSnapshot(collection(db, "sessions", sessionId, "submissions"), (snap) => {
    dbState.submissions[sessionId] = [];
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      dbState.submissions[sessionId].push({
        submissionId: docSnap.id,
        sessionId,
        studentUid: docSnap.id,
        studentEmail: data.studentEmail || "",
        studentDisplayName: data.studentDisplayName || "",
        studentId: data.studentId || "N/A",
        fullName: data.fullName || "AU Student",
        answers: data.answers || [],
        answeredCount: data.answeredCount || 0,
        score: data.score || 0,
        maxScore: data.maxScore || 0,
        correctCount: data.correctCount || 0,
        durationMs: data.durationMs || 0,
        startedAt: data.startedAt?.toMillis ? data.startedAt.toMillis() : (data.startedAt || Date.now()),
        submittedAt: data.submittedAt?.toMillis ? data.submittedAt.toMillis() : (data.submittedAt || null),
        status: data.status || "submitted",
        createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now()),
        updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (data.updatedAt || Date.now())
      });
    });
    saveDatabase();
  });

  // 3. Listen to leaderboard subcollection
  onSnapshot(collection(db, "sessions", sessionId, "leaderboard"), (snap) => {
    dbState.leaderboards[sessionId] = [];
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      dbState.leaderboards[sessionId].push({
        sessionId,
        studentUid: docSnap.id,
        displayName: data.displayName || "Anonymous",
        studentIdMasked: data.studentIdMasked || "64****",
        score: data.score || 0,
        submittedAt: data.submittedAt?.toMillis ? data.submittedAt.toMillis() : (data.submittedAt || Date.now()),
        durationMs: data.durationMs || 0
      });
    });
    dbState.leaderboards[sessionId].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.durationMs - b.durationMs;
    });
    saveDatabase();
  });

  // 4. Lazy sync questionSnapshot from Firestore if empty
  getDocs(collection(db, "sessions", sessionId, "questionSnapshot")).then((snap) => {
    if (!snap.empty) {
      const qSnap: QuestionSnapshot[] = [];
      snap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        qSnap.push({
          questionId: docSnap.id,
          questionText: data.questionText || "",
          choices: data.choices || [],
          points: data.points || 10
        });
      });
      if (dbState.sessions[sessionId]) {
        dbState.sessions[sessionId].questionSnapshot = qSnap;
        saveDatabase();
      }
    }
  }).catch(err => console.error("Error lazy loading questionSnapshot: ", err));
}

// Firestore launcher helper
async function launchSessionInFirestore(session: SessionDoc, courseId: string, lessonId: string) {
  try {
    const batch = writeBatch(db);
    const sessionRef = doc(db, "sessions", session.sessionId);
    
    batch.set(sessionRef, {
      courseId: session.courseId,
      sectionId: session.sectionId,
      lessonId: session.lessonId,
      teacherUid: session.teacherUid,
      status: session.status,
      startedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 95 * 60 * 1000), // 95 minutes default bounds
      sessionSecret: session.sessionSecret || "",
      joinCodeStatic: session.joinCode,
      totalQuestions: session.totalQuestions,
      maxScore: session.maxScore
    });

    const fullQuestions = getQuestions(courseId, lessonId).filter((q) => q.active);

    fullQuestions.forEach((q) => {
      // 1. Snapshot document (WITHOUT correctChoiceIndex and WITHOUT explanation)
      const qSnapRef = doc(db, "sessions", session.sessionId, "questionSnapshot", q.questionId);
      batch.set(qSnapRef, {
        questionId: q.questionId,
        questionNo: q.questionNo,
        questionText: q.questionText,
        choices: q.choices,
        points: q.points
      });

      // 2. Private answer key document
      const qKeyRef = doc(db, "sessions", session.sessionId, "privateAnswerKey", q.questionId);
      batch.set(qKeyRef, {
        questionId: q.questionId,
        correctChoiceIndex: q.correctChoiceIndex,
        explanation: q.explanation || ""
      });
    });

    await batch.commit();
    console.log("Firestore Session Launch fully batched & committed:", session.sessionId);
  } catch (err) {
    console.error("Firestore batch launch session failed: ", err);
  }
}

export function createSession(courseId: string, sectionId: string, lessonId: string, teacherUid: string): SessionDoc {
  const sessionId = "sess_" + Math.random().toString(36).substring(2, 9);
  
  // Create snapshot of current active questions in the lesson
  const questionsList = getQuestions(courseId, lessonId).filter((q) => q.active);
  
  // STATUTORY STRICT RULE bounds: Must have EXACTLY 10 active questions on launch
  if (questionsList.length !== 10) {
    throw new Error(`Validation Error: Selected lesson must have exactly 10 active questions to launch. (Currently has ${questionsList.length} active questions)`);
  }

  const questionSnapshot: QuestionSnapshot[] = questionsList.map((q) => ({
    questionId: q.questionId,
    questionText: q.questionText,
    choices: q.choices,
    correctChoiceIndex: q.correctChoiceIndex, // available client-offline
    points: q.points
  }));

  const totalQuestions = questionSnapshot.length;
  const maxScore = questionSnapshot.reduce((prev, curr) => prev + curr.points, 0);

  const joinCode = generateJoinCode();
  const joinCodeHash = simpleHash(joinCode);
  const sessionSecret = "sec_" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
  const expiresAt = Date.now() + 95 * 60 * 1000;

  const newSession: SessionDoc = {
    sessionId,
    courseId,
    sectionId,
    lessonId,
    teacherUid,
    status: "draft",
    startedAt: Date.now(),
    joinCodeHash,
    questionSnapshot,
    totalQuestions,
    maxScore,
    joinCode,
    sessionSecret,
    expiresAt
  };

  dbState.sessions[sessionId] = newSession;
  dbState.participants[sessionId] = [];
  dbState.submissions[sessionId] = [];
  dbState.leaderboards[sessionId] = [];
  
  saveDatabase();

  if (isFirebaseConfigured && db) {
    launchSessionInFirestore(newSession, courseId, lessonId);
  }

  return newSession;
}

export function updateSessionStatus(sessionId: string, status: "draft" | "open" | "closed") {
  const session = dbState.sessions[sessionId];
  if (session) {
    session.status = status;
    if (status === "closed") {
      session.closedAt = Date.now();
    }
    saveDatabase();

    if (isFirebaseConfigured && db) {
      const updates: any = { status };
      if (status === "closed") {
        updates.closedAt = serverTimestamp();
      }
      updateDoc(doc(db, "sessions", sessionId), updates)
        .catch(err => console.error("Firestore updateSessionStatus failed:", err));
    }
  }
}

// Students Interactions with Sessions
export function findSessionByJoinCode(joinCode: string): SessionDoc | undefined {
  const cleanedCode = joinCode.trim().toUpperCase();
  const candidates = Object.values(dbState.sessions);
  const w = getTimeWindowIndex();

  return candidates.find((s) => {
    if (s.joinCode === cleanedCode || s.joinCodeHash === simpleHash(cleanedCode)) {
      return true;
    }
    // Check 10-second rotating dynamic token
    if (s.status === "open" && s.sessionSecret) {
      const dynamicCurrent = generateDynamicCode(s.sessionId, s.sessionSecret, w);
      const dynamicPrev = generateDynamicCode(s.sessionId, s.sessionSecret, w - 1);
      if (cleanedCode === dynamicCurrent || cleanedCode === dynamicPrev) {
        return true;
      }
    }
    return false;
  });
}

export function joinActiveSession(sessionId: string, studentUid: string): ParticipantDoc {
  const user = dbState.users[studentUid];
  if (!user) {
    throw new Error(`User ID ${studentUid} not found.`);
  }

  if (!dbState.participants[sessionId]) {
    dbState.participants[sessionId] = [];
  }

  // Check if already in participants
  const existing = dbState.participants[sessionId].find((p) => p.studentUid === studentUid);
  if (existing) {
    return existing;
  }

  const participant: ParticipantDoc = {
    sessionId,
    studentUid,
    email: user.email,
    studentId: user.studentId || "N/A",
    fullName: user.displayName,
    joinedAt: Date.now(),
    status: "joined"
  };

  dbState.participants[sessionId].push(participant);
  saveDatabase();

  if (isFirebaseConfigured && db) {
    setDoc(doc(db, "sessions", sessionId, "participants", studentUid), {
      email: user.email,
      studentId: user.studentId || "N/A",
      fullName: user.displayName,
      joinedAt: serverTimestamp(),
      status: "joined"
    }).catch(err => console.error("Firestore participant join failed:", err));
  }

  return participant;
}

export function getParticipants(sessionId: string): ParticipantDoc[] {
  return dbState.participants[sessionId] || [];
}

export function submitQuizAnswers(
  sessionId: string,
  studentUid: string,
  answers: number[], // list of chosen indices
  durationMs: number
): { submission: SubmissionDoc; leaderboardEntry: LeaderboardDoc } {
  const session = dbState.sessions[sessionId];
  if (!session) {
    throw new Error("Active Class Session not found.");
  }
  const user = dbState.users[studentUid];
  if (!user) {
    throw new Error("Student profile not found.");
  }

  // Calculate score & correctCount
  let score = 0;
  let correctCount = 0;
  session.questionSnapshot.forEach((q, idx) => {
    const studentAnswer = answers[idx];
    if (studentAnswer !== undefined && studentAnswer === q.correctChoiceIndex) {
      score += q.points;
      correctCount++;
    }
  });

  const submittedAt = Date.now();

  // 1. Create or replace submission
  if (!dbState.submissions[sessionId]) {
    dbState.submissions[sessionId] = [];
  }
  const existingSubIdx = dbState.submissions[sessionId].findIndex((s) => s.studentUid === studentUid);
  const structuredAnswers: AnswerItem[] = session.questionSnapshot.map((q, idx) => {
    return {
      questionId: q.questionId,
      questionNo: idx + 1,
      selectedChoiceIndex: answers[idx] !== undefined ? answers[idx] : -1,
      answeredAt: Date.now()
    };
  });

  const submission: SubmissionDoc = {
    submissionId: studentUid,
    sessionId,
    studentUid,
    studentEmail: user.email,
    studentDisplayName: user.displayName,
    studentId: user.studentId || "N/A",
    fullName: user.displayName,
    answers: structuredAnswers,
    answeredCount: structuredAnswers.length,
    score,
    maxScore: session.maxScore || 100,
    correctCount,
    durationMs,
    startedAt: Date.now() - durationMs,
    submittedAt,
    status: "submitted",
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  if (existingSubIdx >= 0) {
    dbState.submissions[sessionId][existingSubIdx] = submission;
  } else {
    dbState.submissions[sessionId].push(submission);
  }

  // 2. Update participant status to 'submitted'
  if (dbState.participants[sessionId]) {
    const part = dbState.participants[sessionId].find((p) => p.studentUid === studentUid);
    if (part) {
      part.status = "submitted";
    }
  }

  // 3. Create or replace leaderboard record
  if (!dbState.leaderboards[sessionId]) {
    dbState.leaderboards[sessionId] = [];
  }
  const existingLeadIdx = dbState.leaderboards[sessionId].findIndex((l) => l.studentUid === studentUid);
  
  const leaderboardEntry: LeaderboardDoc = {
    sessionId,
    studentUid,
    displayName: user.displayName,
    studentIdMasked: maskStudentId(user.studentId || "64000000"),
    score,
    submittedAt,
    durationMs
  };

  if (existingLeadIdx >= 0) {
    dbState.leaderboards[sessionId][existingLeadIdx] = leaderboardEntry;
  } else {
    dbState.leaderboards[sessionId].push(leaderboardEntry);
  }

  // Sort Leaderboard: score DESC, then durationMs ASC (faster answer is better!)
  dbState.leaderboards[sessionId].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.durationMs - b.durationMs;
  });

  saveDatabase();

  // Async dynamic Firestore writes (correct grading using secure private keys)
  if (isFirebaseConfigured && db) {
    (async () => {
      try {
        const answerKeyDocs = await getDocs(collection(db, "sessions", sessionId, "privateAnswerKey"));
        const keys: Record<string, number> = {};
        answerKeyDocs.docs.forEach((docSnap) => {
          keys[docSnap.id] = docSnap.data().correctChoiceIndex;
        });

        let firestoreScore = 0;
        let firestoreCorrectCount = 0;
        session.questionSnapshot.forEach((q, idx) => {
          const studentAnswer = answers[idx];
          const correctIdx = keys[q.questionId];
          if (studentAnswer !== undefined && studentAnswer === correctIdx) {
            firestoreScore += q.points;
            firestoreCorrectCount++;
          }
        });

        // Write submission
        await setDoc(doc(db, "sessions", sessionId, "submissions", studentUid), {
          answers,
          score: firestoreScore,
          correctCount: firestoreCorrectCount,
          durationMs,
          submittedAt: serverTimestamp()
        });

        // Write leaderboard
        await setDoc(doc(db, "sessions", sessionId, "leaderboard", studentUid), {
          displayName: user.displayName,
          studentIdMasked: maskStudentId(user.studentId || "64000000"),
          score: firestoreScore,
          durationMs,
          submittedAt: serverTimestamp()
        });

        // Update participant status
        await updateDoc(doc(db, "sessions", sessionId, "participants", studentUid), {
          status: "submitted"
        });

        console.log("Firestore submission synchronization fully succeeded!");
      } catch (err) {
        console.error("Firestore submission write error: ", err);
      }
    })();
  }

  return { submission, leaderboardEntry };
}

export function getSubmissions(sessionId: string): SubmissionDoc[] {
  return dbState.submissions[sessionId] || [];
}

export function getLeaderboard(sessionId: string): LeaderboardDoc[] {
  return dbState.leaderboards[sessionId] || [];
}

// Student Workspace submission & draft management
export function getOrCreateInProgressSubmission(sessionId: string, studentUid: string): SubmissionDoc {
  const session = dbState.sessions[sessionId];
  if (!session) {
    throw new Error("Active Class Session not found.");
  }
  const user = dbState.users[studentUid];
  if (!user) {
    throw new Error("Student profile not found.");
  }

  if (!dbState.submissions[sessionId]) {
    dbState.submissions[sessionId] = [];
  }

  let sub = dbState.submissions[sessionId].find((s) => s.studentUid === studentUid);
  
  if (!sub) {
    sub = {
      submissionId: studentUid,
      sessionId,
      studentUid,
      studentEmail: user.email,
      studentDisplayName: user.displayName,
      studentId: user.studentId || "N/A",
      fullName: user.displayName,
      answers: [],
      answeredCount: 0,
      score: 0,
      maxScore: session.maxScore || 100,
      correctCount: 0,
      durationMs: 0,
      startedAt: Date.now(),
      status: "in_progress",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    dbState.submissions[sessionId].push(sub);
    saveDatabase();
  }

  // Update lastSeenAt for participant
  if (dbState.participants[sessionId]) {
    const part = dbState.participants[sessionId].find((p) => p.studentUid === studentUid);
    if (part) {
      part.lastSeenAt = Date.now();
    }
  }
  saveDatabase();

  // Firestore sync if enabled
  if (isFirebaseConfigured && db) {
    const subRef = doc(db, "sessions", sessionId, "submissions", studentUid);
    const partRef = doc(db, "sessions", sessionId, "participants", studentUid);
    
    // Attempt lazy creation check
    getDocs(collection(db, "sessions", sessionId, "submissions")).then((snap) => {
      const exists = snap.docs.some(d => d.id === studentUid);
      if (!exists) {
        setDoc(subRef, {
          submissionId: studentUid,
          sessionId,
          studentUid,
          studentEmail: user.email,
          studentDisplayName: user.displayName,
          studentId: user.studentId || "N/A",
          fullName: user.displayName,
          answers: [],
          answeredCount: 0,
          score: 0,
          maxScore: session.maxScore || 100,
          correctCount: 0,
          durationMs: 0,
          startedAt: serverTimestamp(),
          status: "in_progress",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }).catch(err => console.error("Firestore create draft failed:", err));
      }
    });

    updateDoc(partRef, {
      lastSeenAt: serverTimestamp()
    }).catch(err => console.error("Firestore participant lastSeenAt failed:", err));
  }

  return sub;
}

export function saveDraftAnswers(
  sessionId: string,
  studentUid: string,
  answers: AnswerItem[]
): void {
  const session = dbState.sessions[sessionId];
  if (!session) return;

  if (!dbState.submissions[sessionId]) {
    dbState.submissions[sessionId] = [];
  }

  const sub = dbState.submissions[sessionId].find((s) => s.studentUid === studentUid);
  if (sub) {
    if (sub.status !== "in_progress") {
      // Do not allow update if already submitted/scored
      return;
    }
    sub.answers = answers;
    sub.answeredCount = answers.length;
    sub.updatedAt = Date.now();
    saveDatabase();
  }

  if (isFirebaseConfigured && db) {
    const subRef = doc(db, "sessions", sessionId, "submissions", studentUid);
    updateDoc(subRef, {
      answers,
      answeredCount: answers.length,
      updatedAt: serverTimestamp()
    }).catch(err => console.error("Firestore draft update failed:", err));
  }
}

export function submitStructuredQuizAnswers(
  sessionId: string,
  studentUid: string,
  answers: AnswerItem[],
  durationMs: number
): { submission: SubmissionDoc } {
  const session = dbState.sessions[sessionId];
  if (!session) {
    throw new Error("Active Class Session not found.");
  }
  const user = dbState.users[studentUid];
  if (!user) {
    throw new Error("Student profile not found.");
  }

  if (!dbState.submissions[sessionId]) {
    dbState.submissions[sessionId] = [];
  }

  // Calculate score & correctCount
  let score = 0;
  let correctCount = 0;
  
  // Score if we have the correct keys locally (offline/simulation sandbox)
  session.questionSnapshot.forEach((q) => {
    const answerObj = answers.find(a => a.questionId === q.questionId);
    if (answerObj && q.correctChoiceIndex !== undefined && answerObj.selectedChoiceIndex === q.correctChoiceIndex) {
      score += q.points;
      correctCount++;
    }
  });

  const submittedAt = Date.now();
  const existingSubIdx = dbState.submissions[sessionId].findIndex((s) => s.studentUid === studentUid);
  
  // For offline/simulated DB, we score it fully.
  // For online, if we don't have local correct indexes, let it be scored_pending initially.
  const isOnlineAndHidden = isFirebaseConfigured && !session.questionSnapshot.every(q => q.correctChoiceIndex !== undefined);
  const finalStatus = isOnlineAndHidden ? "scored_pending" : "scored";

  const submission: SubmissionDoc = {
    submissionId: studentUid,
    sessionId,
    studentUid,
    studentEmail: user.email,
    studentDisplayName: user.displayName,
    studentId: user.studentId || "N/A",
    fullName: user.displayName,
    answers,
    answeredCount: answers.length,
    score: score,
    maxScore: session.maxScore || 100,
    correctCount: correctCount,
    durationMs,
    startedAt: (existingSubIdx >= 0 && dbState.submissions[sessionId][existingSubIdx]?.startedAt) || Date.now(),
    submittedAt,
    status: finalStatus,
    createdAt: (existingSubIdx >= 0 && dbState.submissions[sessionId][existingSubIdx]?.createdAt) || Date.now(),
    updatedAt: Date.now()
  };

  if (existingSubIdx >= 0) {
    dbState.submissions[sessionId][existingSubIdx] = submission;
  } else {
    dbState.submissions[sessionId].push(submission);
  }

  // Update participant status to 'submitted'
  if (dbState.participants[sessionId]) {
    const part = dbState.participants[sessionId].find((p) => p.studentUid === studentUid);
    if (part) {
      part.status = "submitted";
      part.submittedAt = submittedAt;
      part.lastSeenAt = submittedAt;
    }
  }

  // Register leaderboard
  if (!dbState.leaderboards[sessionId]) {
    dbState.leaderboards[sessionId] = [];
  }
  const existingLeadIdx = dbState.leaderboards[sessionId].findIndex((l) => l.studentUid === studentUid);
  const leaderboardEntry: LeaderboardDoc = {
    sessionId,
    studentUid,
    displayName: user.displayName,
    studentIdMasked: maskStudentId(user.studentId || "64000000"),
    score: score,
    submittedAt,
    durationMs
  };

  if (existingLeadIdx >= 0) {
    dbState.leaderboards[sessionId][existingLeadIdx] = leaderboardEntry;
  } else {
    dbState.leaderboards[sessionId].push(leaderboardEntry);
  }

  dbState.leaderboards[sessionId].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.durationMs - b.durationMs;
  });

  saveDatabase();

  // Async Firestore writes
  if (isFirebaseConfigured && db) {
    (async () => {
      try {
        let firestoreScore = 0;
        let firestoreCorrectCount = 0;
        let canScoreOnClient = false;
        let finalStatusToSubmit: "submitted" | "scored_pending" | "scored" = "scored_pending";

        try {
          const answerKeyDocs = await getDocs(collection(db, "sessions", sessionId, "privateAnswerKey"));
          const keys: Record<string, number> = {};
          answerKeyDocs.docs.forEach((docSnap) => {
            keys[docSnap.id] = docSnap.data().correctChoiceIndex;
          });

          session.questionSnapshot.forEach((q) => {
            const studentAns = answers.find(a => a.questionId === q.questionId);
            const correctIdx = keys[q.questionId];
            if (studentAns && correctIdx !== undefined && studentAns.selectedChoiceIndex === correctIdx) {
              firestoreScore += q.points;
              firestoreCorrectCount++;
            }
          });
          canScoreOnClient = true;
          finalStatusToSubmit = "scored";
        } catch (authErr) {
          // Expected: permissions block student from reading answer key!
          finalStatusToSubmit = "scored_pending";
        }

        // Write submission
        await setDoc(doc(db, "sessions", sessionId, "submissions", studentUid), {
          submissionId: studentUid,
          sessionId,
          studentUid,
          studentEmail: user.email,
          studentDisplayName: user.displayName,
          studentId: user.studentId || "N/A",
          fullName: user.displayName,
          answers,
          answeredCount: answers.length,
          score: firestoreScore,
          maxScore: session.maxScore || 100,
          correctCount: firestoreCorrectCount,
          durationMs,
          startedAt: submission.startedAt ? new Date(submission.startedAt) : serverTimestamp(),
          submittedAt: serverTimestamp(),
          status: finalStatusToSubmit,
          createdAt: submission.createdAt ? new Date(submission.createdAt) : serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Write leaderboard
        if (canScoreOnClient) {
          await setDoc(doc(db, "sessions", sessionId, "leaderboard", studentUid), {
            displayName: user.displayName,
            studentIdMasked: maskStudentId(user.studentId || "64000000"),
            score: firestoreScore,
            durationMs,
            submittedAt: serverTimestamp()
          });
        } else {
          await setDoc(doc(db, "sessions", sessionId, "leaderboard", studentUid), {
            displayName: user.displayName,
            studentIdMasked: maskStudentId(user.studentId || "64000000"),
            score: 0,
            durationMs,
            submittedAt: serverTimestamp(),
            pending: true
          });
        }

        // Update participant
        await updateDoc(doc(db, "sessions", sessionId, "participants", studentUid), {
          status: "submitted",
          lastSeenAt: serverTimestamp(),
          submittedAt: serverTimestamp()
        });

        console.log("Firestore submissionSynced! Type:", finalStatusToSubmit);
      } catch (err) {
        console.error("Firestore submission synced error:", err);
      }
    })();
  }

  return { submission };
}

/**
 * Teacher-side Scoring Finalization
 * compares submission answers against private keys, calculates scores, updates status to 'scored',
 * generates/updates Top 5 leaderboard, and writes back updates to Firestore (if configured)
 */
export async function finalizeSessionScores(sessionId: string): Promise<void> {
  const session = dbState.sessions[sessionId];
  if (!session) {
    throw new Error(`Classroom session "${sessionId}" was not found.`);
  }

  // 1. Recover the secure answer keys
  const keys: Record<string, number> = {};

  if (isFirebaseConfigured && db) {
    try {
      const keyDocs = await getDocs(collection(db, "sessions", sessionId, "privateAnswerKey"));
      keyDocs.docs.forEach((d) => {
        const data = d.data();
        if (data.questionId && data.correctChoiceIndex !== undefined) {
          keys[data.questionId] = data.correctChoiceIndex;
        }
      });
    } catch (err) {
      console.error("Firestore privateAnswerKey read failed. Using local snapshot fallback:", err);
    }
  }

  // Fallback to local snaps or local question bank
  session.questionSnapshot.forEach((q) => {
    if (keys[q.questionId] === undefined && q.correctChoiceIndex !== undefined) {
      keys[q.questionId] = q.correctChoiceIndex;
    }
  });

  // Calculate evaluations for all student submissions
  const submissionsList = dbState.submissions[sessionId] || [];
  const updatedSubmissions = submissionsList.map((sub) => {
    // Treat any in_progress, submitted or scored_pending
    let score = 0;
    let correctCount = 0;

    sub.answers.forEach((ans) => {
      const correctIdx = keys[ans.questionId];
      if (correctIdx !== undefined && ans.selectedChoiceIndex === correctIdx) {
        const qPoints = session.questionSnapshot.find(q => q.questionId === ans.questionId)?.points ?? 10;
        score += qPoints;
        correctCount++;
      }
    });

    return {
      ...sub,
      score,
      correctCount,
      status: "scored" as const,
      updatedAt: Date.now()
    };
  });

  dbState.submissions[sessionId] = updatedSubmissions;

  // Build the sorted leaderboard applying key tie-breakers:
  // Sort by score (DESC), then submittedAt (ASC), then durationMs (ASC)
  const sortedSubmissions = [...updatedSubmissions].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const aTime = a.submittedAt || Date.now();
    const bTime = b.submittedAt || Date.now();
    if (aTime !== bTime) {
      return aTime - bTime; // Earlier submission wins tie
    }
    return a.durationMs - b.durationMs; // Faster response wins tie
  });

  // Construct Top 5 leaderboard entries
  const leaderboardEntries: LeaderboardDoc[] = sortedSubmissions.map((sub) => ({
    sessionId,
    studentUid: sub.studentUid,
    displayName: sub.studentDisplayName || sub.fullName || "AU Student",
    studentIdMasked: maskStudentId(sub.studentId || "64000000"),
    score: sub.score,
    submittedAt: sub.submittedAt || Date.now(),
    durationMs: sub.durationMs
  }));

  dbState.leaderboards[sessionId] = leaderboardEntries;

  // Sync session state itself
  session.status = "closed";
  session.closedAt = Date.now();

  saveDatabase();

  // Push updates to Firestore
  if (isFirebaseConfigured && db) {
    try {
      const batch = writeBatch(db);

      // A. Write graded submissions
      updatedSubmissions.forEach((sub) => {
        const subRef = doc(db, "sessions", sessionId, "submissions", sub.studentUid);
        batch.set(subRef, {
          submissionId: sub.studentUid,
          sessionId,
          studentUid: sub.studentUid,
          studentEmail: sub.studentEmail,
          studentDisplayName: sub.studentDisplayName,
          studentId: sub.studentId,
          fullName: sub.fullName,
          answers: sub.answers,
          answeredCount: sub.answeredCount,
          score: sub.score,
          maxScore: sub.maxScore,
          correctCount: sub.correctCount,
          durationMs: sub.durationMs,
          status: "scored",
          submittedAt: sub.submittedAt ? new Date(sub.submittedAt) : serverTimestamp(),
          startedAt: sub.startedAt ? new Date(sub.startedAt) : serverTimestamp(),
          createdAt: sub.createdAt ? new Date(sub.createdAt) : serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      // B. Write Leaderboard documents
      leaderboardEntries.forEach((entry) => {
        const leadRef = doc(db, "sessions", sessionId, "leaderboard", entry.studentUid);
        batch.set(leadRef, {
          displayName: entry.displayName,
          studentIdMasked: entry.studentIdMasked,
          score: entry.score,
          durationMs: entry.durationMs,
          submittedAt: new Date(entry.submittedAt)
        });
      });

      // C. Update session closed status
      const sessionRef = doc(db, "sessions", sessionId);
      batch.update(sessionRef, {
        status: "closed",
        closedAt: serverTimestamp()
      });

      await batch.commit();
      console.log("Firestore scoring finalization commits succeeded securely.");
    } catch (fsErr) {
      console.error("Firestore batch writes failed on finalization:", fsErr);
    }
  }

  notifyListeners();
}

// Reset/Truncate DB function (for utility)
export function resetLocalDatabase() {
  localStorage.removeItem(STORAGE_KEY);
  dbState = loadDatabase();
  saveDatabase();
}
