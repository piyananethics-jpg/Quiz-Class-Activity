# Firestore Composite Indexes Guidance

This document details the composite indexes recommended for production use with the **AU Classroom Quiz Game Platform** on the Firestore Spark Plan.

> **CRITICAL SPARK PLAN NOTE:**
> Create composite indexes *only* when the Firebase console explicitly reports they are required (throwing a build-ready link in your local developer logs). Keep queries as simple and highly scoped as possible to optimize daily reads/writes and prevent quota exhaustion.

---

## Required Composite Indexes

If you execute complex sorted orderings or matching filters, Firestore will require the following composite indexes:

### 1. Sessions Query Filter (Teacher View)
For loading recent sessions initiated by a specific teacher:
*   **Collection ID:** `sessions`
*   **Fields:**
    *   `teacherUid` (Ascending)
    *   `startedAt` (Descending)
*   **Query Scope:** Collection

### 2. Sessions Query Filter (Enrolled / Course Filter)
For filtering sessions by course and section to track historical participation:
*   **Collection ID:** `sessions`
*   **Fields:**
    *   `courseId` (Ascending)
    *   `sectionId` (Ascending)
    *   `startedAt` (Descending)
*   **Query Scope:** Collection

### 3. Submissions Leaderboard & Scoring Ranking
For rendering speed-of-submission and highest score-first standings dynamically on the live room board:
*   **Collection ID:** `leaderboard`
*   **Fields:**
    *   `score` (Descending)
    *   `durationMs` (Ascending)
    *   `submittedAt` (Ascending)
*   **Query Scope:** Collection Group / Subcollection

### 4. Course Lesson Ordering
For retrieving lessons sequenced by lesson number:
*   **Collection ID:** `lessons`
*   **Fields:**
    *   `courseId` (Ascending)
    *   `lessonNo` (Ascending)
*   **Query Scope:** Collection Group / Subcollection

---

## Index Setup Best Practices

1. **Wait for Error Links:** During staging, click the Firebase-provided URL automatically displayed in the browser's developer console when a query fails due to a missing index. It will automatically preconfigure the exact composite index structure for you.
2. **Limit Collection Scans:** Always add high-selectivity filtering (like `teacherUid == request.auth.uid`) before ordering directives.
3. **Avoid Unbounded In-Memory Merges:** By strictly structuring submissions nested under `sessions/{sessionId}/submissions`, lookups are localized—avoiding large cross-session indexes.
