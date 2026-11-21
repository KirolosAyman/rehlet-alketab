// Row shapes as selected by handlers (no generated types → explicit interfaces).
import type { Question } from './questions.ts';
import type { Answer, EssayVerdict } from './scoring.ts';

export interface StudentRow {
  id: string;
  username: string;
  display_name: string;
  pass_hash?: string | null;
  failed_attempts?: number;
  locked_until?: string | null;
  created_at?: string;
}

export interface QuizFull {
  id: string;
  quiz_date: string;
  book: string;
  book_id?: string | null;
  chapter: string;
  opens_at: string | null;
  status: 'draft' | 'published';
  author_id: string | null;
  questions: Question[];
  created_at: string;
}

export interface AttemptFull {
  id: string;
  student_id: string;
  quiz_id: string;
  answers: Answer[];
  questions_snapshot: Question[];
  essay: EssayVerdict[];
  correct: number;
  total: number;
  stars: number;
  created_at: string;
}

export interface AssignmentRow {
  id: string;
  student_id: string;
  book: string;
  book_id?: string | null;
  chapter: string;
  day: string;
  status: 'open' | 'submitted';
  questions: Question[];
  quiz_id: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface BookRow {
  id: string;
  testament: 'old' | 'new';
  name: string;
  name_norm: string;
  chapters: number;
  sort_order: number;
  board_open: boolean;
  created_at?: string;
}
