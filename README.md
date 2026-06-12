# Interactive Classroom Live Session & Quizzing (ClassPulse)

ClassPulse is an elegant, real-time classroom gamification and online assessment portal designed specifically for Assumption University (AU). Teachers can organize courses, manage section-level rosters, import student profiles via standard CSV files, host interactive quiz lessons, and grade submissions.

The platform is designed to be fully compatible with the **Firebase Spark Plan ($0/month Free Tier)** and is optimized for static deploy on **Netlify**.

---

## Key Features

1. **Academic Guardrails & @au.edu Verification**
   - Active email checking restricts profile creation and sign-in exclusively to verified campus accounts ending with `@au.edu`.
   - Distinct role pathways separate instructors (`teacher` role) from learners (`student` role).

2. **Live Classroom Gamification**
   - Teachers can host interactive quiz sessions with dynamically rotating numeric join keys configured in-memory to prevent remote cheating with zero DB overhead.
   - Live lobby lists update participants' connection status dynamically.

3. **Secure Two-Step Scoring Finalization**
   - Correct answers and question explanation nodes reside in the highly locked `privateAnswerKey` subcollection, invisible to student accounts.
   - On session closure, teachers execute a secure batch-grading transactions block, writing structured scores, masked student IDs, and top-5 standings onto the official leaderboard.

4. **Spreadsheet Exports**
   - Instructors can instantly dump section reports and quiz results into standard Microsoft Excel/Google Sheets compliant **CSV spreadsheet files** with correct delimiters and text wrapping.

---

## Firebase Configuration & Staging

Follow these instructions to link your custom Firebase Spark Plan project to the production compilation:

1. **Install Firebase CLI Tools**
   Ensure you have configured a Firebase Project in the Google Cloud Console.

2. **Configure Environment Parameters**
   Copy the `.env.example` file and create a `.env` file at the root containing your Vite Firebase parameters:
   ```env
   VITE_FIREBASE_API_KEY="AIzaSy..."
   VITE_FIREBASE_AUTH_DOMAIN="your-app.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="your-app"
   VITE_FIREBASE_STORAGE_BUCKET="your-app.appspot.com"
   VITE_FIREBASE_MESSAGING_SENDER_ID="12345678"
   VITE_FIREBASE_APP_ID="1:12345678:web:abcd123"
   ```

3. **Deploy Security Rules**
   To audit rules or sync changes, use standard Firebase rules deployment:
   ```bash
   firebase deploy --only firestore:rules
   ```

---

## CSV Spreadsheet Formatting

When importing student rosters inside section enrollment planners, format your `.csv` file as follows:

```csv
studentId,fullName,email
6420101,John Doe,john.doe@au.edu
6420202,Jane Vance,jane.vance@au.edu
```

---

## Spark Plan Boundaries & Optimization

* **Passive Calculations:** In-flight scores default to `scored_pending` under student IDs. This avoids having students read high-security keys, keeping database reads at the bare minimum.
* **Closed-loop Live Feeds:** The 10-second rotating Join Codes are calculated using pure JavaScript epoch mathematics rather than scheduled database writes, saving thousands of write units daily.
* **Manual Composite Indexes:** For specific sorted indexes, refer directly to `docs/firestore-indexes.md`.
