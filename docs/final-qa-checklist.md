# AU Classroom Quiz Game Platform — Final QA Checklist

This checklist contains all official manual verification and security validation cases required to guarantee zero-defect deployment of ClassPulse in high-traffic classroom environments.

---

## 1. Authentication & Role Gatekeeping

- [ ] **@au.edu Email Sign-In Restriction**
  - **Procedure:** Sign in using an external Google account (`external.user@gmail.com`).
  - **Expected Result:** Sign-in is rejected, the user is signed out, and a clear error message is displayed: `"Only @au.edu accounts are allowed."`
- [ ] **AU-Certified Email Sign-In Approval**
  - **Procedure:** Sign in with an account ending in `@au.edu`.
  - **Expected Result:** Allowed to sign in. First-time registerers are routed to the role assignment onboarding screen.
- [ ] **Single-Time Role Onboarding Setup**
  - **Procedure:** Register as a `"teacher"` or `"student"` on the `/role-setup` screen.
  - **Expected Result:** Role is saved in the Firestore `users/{uid}` collection. Casually attempting to access the onboarding screen again blocks changes and keeps the initial selection.
- [ ] **Role Modification Prevention**
  - **Procedure:** Attempt to modify the registered state (e.g., via browser inspection or deep profile post) from student to teacher.
  - **Expected Result:** Blocked by the `users/{userId}` update rule: `(existing().role == incoming().role)`, which keeps the role immutable once set.

---

## 2. Teacher-Instructor Operations

- [ ] **Course and Section Setup**
  - **Procedure:** Navigate to "Manage Courses", create computer science course (e.g., `BG3401`), and add Section `B1` and Section `B2`.
  - **Expected Result:** Records write instantly to `/courses` and `/courses/{courseId}/sections`.
- [ ] **Roster Importing via CSV**
  - **Procedure:** Upload a comma-separated text file listing student emails (`student1@au.edu`), full names, and student IDs.
  - **Expected Result:** Student enrollments show up instantly and write to `courses/{courseId}/sections/{sectionId}/enrollments/{studentId}` as active.
- [ ] **Lesson Planning & Question Authoring**
  - **Procedure:** Under "Manage Lessons", create lesson `Lesson 1: Introduction to Firebase` and enter exactly 10 multiple-choice questions.
  - **Expected Result:** Writes successfully to `/courses/{courseId}/lessons/{lessonId}/questions` with answers.
- [ ] **Live Quiz Session Ignition**
  - **Procedure:** Start the Session for Lesson 1 on Section B1.
  - **Expected Result:** Session launches, a dynamic Join Code is created, and the correct questions are published without correct answers to `sessions/{sessionId}/questionSnapshot`. Correct answers are secured under `sessions/{sessionId}/privateAnswerKey`.
- [ ] **Review Panel and Score Finalization**
  - **Procedure:** After students have submitted, click "Close Session" and "Finalize Scores" in the instructor console.
  - **Expected Result:** The teacher pulls correct keys, auto-grades all submissions, writes results back to `/submissions/{uid}` with Status `"scored"`, publishes the final top scores onto the `/leaderboard` collection, and changes the session state to `"closed"`.

---

## 3. Student-Learner Quiz Game Play

- [ ] **Join Live Quiz Room**
  - **Procedure:** Sign in as a student and enter the active rotating Join Code.
  - **Expected Result:** Student is admitted to the lobby and registered as a Participant subdocument.
- [ ] **Class Enrollment Guard Check**
  - **Procedure:** Attempt to join Section B1 with student account `student_b2@au.edu` who is enrolled in Section B2.
  - **Expected Result:** System verifies enrollment list and blocks access: `"Access Blocked: Your student email is not registered in list of enrollments for this course. Contact your instructor."`
- [ ] **Classroom Gameplay Live Response**
  - **Procedure:** Step through the 10 questions of the quiz and submit.
  - **Expected Result:** Quiz progress auto-saves. Clicking submit locks active responses, writes responses to `/submissions/{studentUid}` with `score = 0` and `status = "scored_pending"`, and prevents re-submissions.

---

## 4. Security Audit & Isolation Tests

- [ ] **Correct Answer Leak Prevention**
  - **Procedure:** Inspect student-facing browser network logs during quiz play.
  - **Expected Result:** Only `questionSnapshot` is retrieved. Correct answer indexes are completely absent.
- [ ] **Submissions Isolation Check**
  - **Procedure:** Attempt to fetch another active student's raw submissions as a student user.
  - **Expected Result:** Firestore immediately terminates the read with a `PERMISSION_DENIED` exception.
- [ ] **Scores Write Block**
  - **Procedure:** Directly execute a client update to alter the student's submission grade score to `100` before/during submission.
  - **Expected Result:** Rejected by the Fortress rules: `incoming().score == existing().score` for student updates.

---

## 5. Production Build & Deployment

- [ ] **Vite Client Production Compilation**
  - **Expected Result:** Run `npm run build`. Compiles into the `dist/` folder with complete CSS styling in one unified bundle.
- [ ] **Netlify Redirect Test**
  - **Procedure:** Load a sub-route on Netlify web-app (e.g., `https://example.netlify.app/student/join`) and refresh the web browser.
  - **Expected Result:** Netlify correctly uses `/public/_redirects` to route all endpoints into `index.html` with no `404 Not Found` messages.
