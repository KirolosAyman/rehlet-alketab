// Client-side mirrors of the API response shapes.
export type QType = 'mcq' | 'tf' | 'fill' | 'essay';
export type Grading = 'ai' | 'manual';
export type QuizState = 'done' | 'open' | 'missed' | 'author';
export type Answer = number | string | null;

export interface Question { type: QType; q: string; options: string[]; answer: number; model?: string; grading?: Grading }
export interface PublicQuestion { type: QType; q: string; options: string[] }
export interface Score { correct: number; total: number; stars: number }

export interface Stats {
  stars: number; streak: number; done: number;
  level: string; levelIndex: number; nextLevel: string | null; nextLevelAt: number | null; starsLeft: number; progress: number;
}
export interface QuizMeta { id: string; date: string; book: string; chapter: string; opensAt: string | null }
export interface HomeQuiz extends QuizMeta { state: QuizState; result: Score | null }
export interface MyAssignment { id: string; book: string; chapter: string; day: string; status: 'open' | 'submitted'; questions: Question[]; submittedAt: string | null }
export interface BoardRow { rank: number; name: string; stars: number; streak: number; me: boolean }
export interface OpenBookMeta { id: string; name: string; testament: 'old' | 'new'; chapters: number }
export interface Home { me: { name: string }; today: string; stats: Stats; quizzes: HomeQuiz[]; assignments: MyAssignment[]; board: BoardRow[] | null; openBooks?: OpenBookMeta[] }

export interface ReviewItem {
  type: QType; q: string; options: string[]; answer: number; model: string | null; yours: Answer;
  correct: boolean | null; essay: { status: 'ok' | 'no' | 'pending'; note: string } | null;
}
export interface DoneView { state: 'done'; quiz: QuizMeta; result: Score & { perfect: boolean }; review: ReviewItem[] }
export interface OpenView { state: 'open'; quiz: QuizMeta; questions: PublicQuestion[] }

// ---- admin ----
export interface EssayVerdict { i: number; status: 'ok' | 'no' | 'pending'; note: string; by: 'ai' | 'admin' | null }
export interface AdminStudent {
  id: string; username: string; name: string; activated: boolean; locked: boolean;
  stars: number; streak: number; done: number; level: string; today: { correct: number; total: number } | null;
}
export interface AdminQuizRow {
  id: string; date: string; opensAt: string | null; book: string; chapter: string; status: 'draft' | 'published';
  author: string | null; questionCount: number; attempts: number; avg: number | null; unlocked: number; pendingEssays: number;
}
export interface AdminAssignment {
  id: string; studentId: string; student: string; book: string; chapter: string; day: string;
  status: 'open' | 'submitted'; questionCount: number; quizId: string | null; submittedAt: string | null;
}
export interface Dashboard {
  today: string;
  counts: { students: number; finishedToday: number; waitingAssignments: number; pendingEssays: number };
  students: AdminStudent[]; quizzes: AdminQuizRow[]; assignments: AdminAssignment[];
  leaderboardPublic: boolean; maxPerDay: number;
}
export interface AdminQuiz {
  quiz: { id: string; quiz_date: string; book: string; chapter: string; opens_at: string | null; status: 'draft' | 'published'; author_id: string | null; author: string | null; questions: Question[] };
  attempts: { id: string; studentId: string; student: string; correct: number; total: number; stars: number; createdAt: string; answers: Answer[]; essay: EssayVerdict[]; snapshot: Question[] }[];
  notTaken: { id: string; name: string }[];
  students: { id: string; name: string }[];
  unlocked: string[];
}
export interface AiSettings { model: string; defaultModel: string; hasKey: boolean; keyHint: string | null; keySource: 'settings' | 'env' | 'none'; maxPerDay: number }

export interface Book {
  id: string;
  testament: 'old' | 'new';
  name: string;
  chapters: number;
  sortOrder: number;
  boardOpen: boolean;
  quizCount?: number;
}

export interface AdminBookResultStudent {
  id: string;
  name: string;
  username: string;
  chaptersDone: number;
  totalChapters: number;
  stars: number;
  pct: number;
  correct: number;
  totalQuestions: number;
  scorePct: number;
}

export interface AdminBookResults {
  book: Book;
  quizzes: { id: string; chapter: string; quiz_date: string; status: 'draft' | 'published' }[];
  students: AdminBookResultStudent[];
}
