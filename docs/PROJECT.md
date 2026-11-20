# Rehlet Alketab (رحلة الكتاب) — Full Project Specification

> **Status:** APPROVED & IMPLEMENTED  
> **Target Audience:** Sunday-school class (~100 students + 1 Teacher/Admin)  
> **Platform:** Mobile-first Arabic RTL Web App (React + Vite + Supabase + Gemini AI)  
> **Timezone:** `Africa/Cairo` (UTC+2 standard / UTC+3 daylight saving)

---

## 1. System Overview & Objectives

**Rehlet Alketab (رحلة الكتاب — The Book Journey)** is a daily Bible-reading and interactive quiz platform designed for a closed Sunday-school community. Its primary goal is encouraging daily personal scripture reading through a friendly, engaging, gamified loop tailored specifically for Egyptian students and their teachers.

### Key Constraints & Design Principles:
1. **Zero Distraction & Simplicity:** Clean, mobile-first, native-feeling Arabic RTL experience. Students do not need email addresses, phone numbers, or third-party OAuth.
2. **Strict Fairness & Integrity:** Correct answers, model answers, and grading criteria are never sent to the browser before submission. A student can only take each quiz once.
3. **Teacher Control:** The administrator can create quizzes manually or with AI assistance, review student assignments, override any grade, unlock past missed quizzes, and toggle leaderboard visibility.
4. **Resilient AI Pipeline:** AI generation is reserved strictly for the admin. Essay answers are batched and graded against the teacher's model answer with a strict 8-second timeout; failures seamlessly fall back to `pending` manual review without blocking the student's submission.
5. **Completely Free-Tier Compatible:** Operates within Supabase and Cloudflare Pages free tiers with strict query optimization and server-role security.

---

## 2. User Roles & Core Workflows

### 2.1 The Student
- **Onboarding:** Receives a normalized username from the teacher. On first visit, the student sets their own password.
- **Daily Loop:**
  1. Opens the home tab (**النهارده**).
  2. Reads the daily assigned chapter.
  3. Takes the day's quiz (MCQ, True/False, Fill-in-the-blank, and/or Short Essay).
  4. Submits and receives instant star rewards, celebratory animations, level progress, and question-by-question review.
- **My Record Tab (سجلي):** Reviews past completed quizzes, scores, and stars earned.
- **Leaderboard Tab (الترتيب):** When enabled by the teacher, displays a friendly leaderboard showing rank, stars, and streaks.
- **Student-Authored Quizzes:** If assigned to write questions for a chapter, the student drafts questions without access to AI. Once submitted, the assignment locks for teacher review.

### 2.2 The Admin / Teacher
- **Student Management:** Bulk adds students (comma/tab-separated list), renames students, resets lost passwords, or deletes accounts.
- **Quiz Authoring:**
  - Creates daily quizzes with custom dates and optional opening times.
  - Can generate questions automatically using Gemini AI from book/chapter prompts or pasted text.
  - Controls essay grading mode per question (`ai` or `manual`).
- **Review & Grading:**
  - Views real-time quiz results, scores, and non-takers.
  - Grades pending essays or overrides any AI verdict with custom feedback.
  - Batch re-grades pending essays when Gemini quota refreshes.
  - Exports complete quiz results to CSV for record-keeping and parent communication.
- **Unlocks:** Grants individual students permission to take past missed quizzes.
- **Settings:** Configures Gemini API key (stored securely in `app_secrets`), model selection, and daily published quiz limits.

---

## 3. Scoring, Levels, and Streaks

### 3.1 Star Scoring
- **Base Score:** Each correct answer earns **1 Star**.
- **Perfect Score Bonus:** Achieving 100% on a quiz awards a bonus of **+2 Stars** (`PERFECT_BONUS`).
- **Zero Questions:** Quizzes with 0 questions award 0 stars with no bonus.
- **Pending Essays:** Essays awaiting review do not count towards stars until resolved by AI or teacher.

### 3.2 Levels Hierarchy
Student levels reflect spiritual growth through agricultural metaphors:
| Level Name (Arabic) | Minimum Stars Required | Icon / Meaning |
|---|---|---|
| **بذرة (Seed)** | 0 | Starting point |
| **نبتة (Sprout)** | 10 | Early growth |
| **غصن (Branch)** | 25 | Active learner |
| **شجرة (Tree)** | 50 | Dedicated reader |
| **كرمة (Vine)** | 100 | Mature reader |

The server computes exact progress (0.0 to 1.0) and stars remaining to next level.

### 3.3 Streak Rules
- A streak is the count of consecutive **published quizzes** (not calendar days) that the student either completed or authored.
- Today's untaken quiz **does not** break an ongoing streak.
- An earlier missed, non-unlocked quiz **breaks** the streak.
- Quizzes authored by the student count towards their streak (`done = true`).
- Future quizzes are ignored in streak calculation.

---

## 4. Question Types & Constraints

1. **Multiple Choice (`mcq`):**
   - Question prompt (up to 500 chars).
   - 2 to 6 unique options.
   - Exactly one correct option index (`answer`).
2. **True / False (`tf`):**
   - Statement prompt.
   - Options automatically normalized and locked to `['صح', 'خطأ']`.
   - Correct index (0 for صح, 1 for خطأ).
3. **Fill-in-the-Blank (`fill`):**
   - Prompt with placeholder indicator.
   - 2 to 6 options with exactly one correct option.
4. **Short Essay (`essay`):**
   - Reflective or recall question prompt.
   - Mandatory teacher model answer (used by AI or teacher for grading).
   - Grading mode: `ai` (default) or `manual`.
   - Student answer limit: 3,000 characters.

**Integrity Guarantee:** The `toPublic()` filter strips `answer`, `model`, and `grading` properties before transmitting quiz payloads to students.

---

## 5. Security & Architectural Model

```
┌─────────────────────────────────┐
│ Browser (React + Vite SPA)      │
│ Storage: opaque session token   │
│ Client never connects to DB     │
└───────────────┬─────────────────┘
                │ HTTPS POST { action, token, ...payload }
                ▼
┌─────────────────────────────────┐
│ Supabase Edge Function (/api)   │
│ Single entry point, CORS, Rate  │
│ Limits, Validation, Router      │
└───────┬─────────────────┬───────┘
        │ Service-Role    │ Header API Key
        ▼                 ▼
┌───────────────┐ ┌───────────────┐
│ Supabase DB   │ │ Google Gemini │
│ Forced RLS,   │ │ 2.5 Flash     │
│ 0 Policies    │ └───────────────┘
└───────────────┘
```

1. **Zero Client DB Access:** PostgreSQL RLS is enabled and forced on all 9 tables. Privileges for `anon` and `authenticated` roles are completely revoked. All queries execute through the Edge Function service-role.
2. **Cryptographic Standards:**
   - Passwords hashed with PBKDF2-SHA256 (100,000 iterations, random salt, versioned hash format).
   - Sessions store only the SHA-256 hash of random tokens.
   - Admin authentication uses constant-time string comparison (`safeStringEqual`) and IP-based lockout.
3. **Input Validation:** Enforced in code using strict length, type, and normalization filters. 200 KB request body limit.
4. **Rate Limiting:** Atomic fixed-window rate limiter on `check_username`, `login`, `set_password`, `admin_login`, and `admin_generate`.

---

## 6. Database Schema Summary

The database comprises 9 core tables:
1. `students`: Account records (`id`, `username`, `username_norm`, `display_name`, `pass_hash`, `failed_attempts`, `locked_until`, timestamps).
2. `sessions`: Active tokens (`token_hash`, `student_id`, `is_admin`, `expires_at`, `created_at`).
3. `quizzes`: Quiz headers and questions JSONB (`quiz_date`, `opens_at`, `book`, `chapter`, `questions`, `status`, `author_id`).
4. `quiz_unlocks`: Overrides granting access to missed quizzes (`quiz_id`, `student_id`, `created_at`).
5. `attempts`: Completed quizzes (`student_id`, `quiz_id`, `answers`, `questions_snapshot`, `essay`, `score`, `stars`, timestamps).
6. `assignments`: Writing tasks assigned to students (`student_id`, `book`, `chapter`, `day`, `questions`, `status`, `quiz_id`).
7. `settings`: Application configuration (`key`, `value` jsonb).
8. `app_secrets`: Sensitive write-only secrets (`name`, `secret`).
9. `rate_limits`: Request throttling windows (`key`, `window_start`, `count`).

---

## 7. Complete API Reference

All requests are HTTP POST to `/api` with payload `{ action, token?, ...params }`.

### Public Endpoints:
- `check_username`: Validates username existence and status (`needs_login`, `needs_setup`, or `not_found`).
- `set_password`: First-login password creation (atomic check ensuring `pass_hash` was NULL).
- `login`: Student authentication with wrong-password lockout.
- `admin_login`: Teacher login with IP-based throttling and lockout.
- `logout`: Destroys the calling session.

### Student Endpoints (Requires Student Token):
- `home`: Returns today's status, stats, active assignments, unlocked quizzes, and leaderboard.
- `get_quiz`: Retrieves quiz questions (sanitized) or finished submission review.
- `submit`: Validates answers, triggers batched AI grading for eligible essays, saves attempt snapshot, and awards stars.
- `assign_save`: Drafts or submits student-authored questions.

### Admin Endpoints (Requires Admin Token):
- `admin_dashboard`: Aggregates students, quizzes, assignments, and pending tasks.
- `admin_students_add`: Bulk adds students.
- `admin_student_update`: Updates username or display name.
- `admin_student_reset`: Clears student password and kills all active sessions.
- `admin_student_delete`: Deletes student and cascades all records.
- `admin_quiz_get`: Loads complete quiz, attempts list, and non-takers.
- `admin_quiz_save`: Saves/updates draft or published quiz, enforcing daily published limits.
- `admin_quiz_delete`: Deletes quiz and cascades attempts/unlocks.
- `admin_quiz_unlocks_set`: Grants past-quiz access with ID existence validation.
- `admin_assign_create` / `admin_assign_delete` / `admin_assign_reopen`: Manages student writing assignments.
- `admin_assign_to_quiz`: Converts submitted student questions into a draft quiz.
- `admin_attempt_set`: Overrides an essay verdict (`ok` / `no`) and recomputes stars from snapshot.
- `admin_regrade_pending`: Batches and re-runs AI grading for pending essays in a quiz.
- `admin_generate`: Prompts Gemini to generate questions from chapter text or topic.
- `admin_set_leaderboard`: Toggles leaderboard visibility for students.
- `admin_settings_set`: Configures daily quiz limit.
- `admin_ai_settings_get` / `admin_ai_settings_set` / `admin_ai_test`: Manages Gemini API key, model selection, and connectivity.
