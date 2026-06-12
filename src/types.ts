/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "teacher" | "student";

export interface UserDoc {
  uid: string;
  role: UserRole;
  email: string;
  displayName: string;
  studentId?: string;
  createdAt: number;
}

export interface CourseDoc {
  courseId: string;
  courseCode: string;
  courseName: string;
  ownerUid: string;
  createdAt: number;
}

export interface SectionDoc {
  courseId: string;
  sectionId: string;
  sectionName: string;
  term: string;
  active: boolean;
}

export interface EnrollmentDoc {
  courseId: string;
  sectionId: string;
  studentUidOrEmail: string; // Document ID
  studentId: string;
  fullName: string;
  email: string;
  status: "active" | "inactive";
}

export interface LessonDoc {
  courseId: string;
  lessonId: string;
  lessonNo: number;
  title: string; // compatibility with existing fields
  lessonTitle: string;
  description?: string;
  active: boolean;
  createdAt?: number;
  updatedAt?: number;
  questionCount?: number;
}

export interface QuestionDoc {
  courseId: string;
  lessonId: string;
  questionId: string;
  questionNo: number; // 1 to 10
  questionText: string;
  choices: string[];
  correctChoiceIndex: number;
  points: number;
  explanation?: string;
  active: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface QuestionSnapshot {
  questionId: string;
  questionText: string;
  choices: string[];
  correctChoiceIndex?: number; // Optional on client student snapshot
  points: number;
  explanation?: string;
}

export interface SessionDoc {
  sessionId: string;
  courseId: string;
  sectionId: string;
  lessonId: string;
  teacherUid: string;
  status: "draft" | "open" | "closed";
  startedAt: number;
  closedAt?: number;
  joinCodeHash: string; // Representing joinCode or sessionSecret
  questionSnapshot: QuestionSnapshot[];
  totalQuestions: number;
  maxScore: number;
  joinCode: string; // Cleartext join code for UI
  sessionSecret?: string; // Random secret key for dynamic qr codes securely
  expiresAt?: number; // Reasonable timestamp expiration default bounds
}

export interface ParticipantDoc {
  sessionId: string;
  studentUid: string;
  email: string;
  studentId: string;
  fullName: string;
  joinedAt: number;
  status: "joined" | "submitted";
  lastSeenAt?: number;
  submittedAt?: number;
}

export interface AnswerItem {
  questionId: string;
  questionNo: number;
  selectedChoiceIndex: number; // 0, 1, 2, or 3
  answeredAt: number;
}

export interface SubmissionDoc {
  submissionId: string;
  sessionId: string;
  studentUid: string;
  studentEmail: string;
  studentDisplayName: string;
  studentId: string;
  fullName: string;
  answers: AnswerItem[];
  answeredCount: number;
  score: number;
  maxScore: number;
  correctCount: number;
  durationMs: number;
  startedAt: number;
  submittedAt?: number | null;
  status: "in_progress" | "submitted" | "scored_pending" | "scored";
  createdAt: number;
  updatedAt: number;
}

export interface LeaderboardDoc {
  sessionId: string;
  studentUid: string;
  displayName: string;
  studentIdMasked: string; // e.g. "64****89"
  score: number;
  submittedAt: number;
  durationMs: number;
}
