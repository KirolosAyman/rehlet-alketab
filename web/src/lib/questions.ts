import type { Question, QType } from './types';

export const TF_OPTIONS = ['صح', 'خطأ'];
export const BLANK = '______';
export const MAX_QUESTIONS = 30;

export function emptyQuestion(type: QType = 'mcq'): Question {
  if (type === 'tf') return { type, q: '', options: [...TF_OPTIONS], answer: 0 };
  if (type === 'essay') return { type, q: '', options: [], answer: 0, model: '', grading: 'ai' };
  return { type, q: type === 'fill' ? BLANK : '', options: ['', '', ''], answer: 0 };
}

/** Switch type while keeping what still makes sense. */
export function changeType(q: Question, type: QType): Question {
  if (type === q.type) return q;
  if (type === 'tf') return { type, q: q.q, options: [...TF_OPTIONS], answer: 0 };
  if (type === 'essay') return { type, q: q.q, options: [], answer: 0, model: q.model ?? '', grading: q.grading ?? 'ai' };
  const keep = q.type === 'mcq' || q.type === 'fill' ? q.options : ['', '', ''];
  return { type, q: q.q, options: keep, answer: Math.min(q.answer, keep.length - 1) };
}
