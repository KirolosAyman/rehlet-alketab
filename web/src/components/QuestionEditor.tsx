// Question cards editor, shared by the student writer (no grading toggle) and the admin quiz editor.
import { useId } from 'react';
import { ar } from '../i18n/ar';
import { n } from '../lib/format';
import { BLANK, changeType, emptyQuestion, MAX_QUESTIONS } from '../lib/questions';
import type { Grading, Question, QType } from '../lib/types';
import { Button } from './Button';
import { ConfirmButton } from './ConfirmButton';
import { Card } from './Card';
import { Select, TextArea } from './Field';

const TYPES: QType[] = ['mcq', 'tf', 'fill', 'essay'];

export function QuestionEditor({ value, onChange, allowGrading, disabled }: {
  value: Question[]; onChange: (v: Question[]) => void; allowGrading: boolean; disabled?: boolean;
}) {
  const set = (i: number, q: Question) => onChange(value.map((x, k) => (k === i ? q : x)));
  const remove = (i: number) => onChange(value.filter((_, k) => k !== i));
  return (
    <div className="flex flex-col gap-3">
      {value.length === 0 && <p className="text-muted">{ar.editor.empty}</p>}
      {value.map((q, i) => (
        <QuestionCard key={i} index={i} q={q} onChange={(nq) => set(i, nq)} onRemove={() => remove(i)} allowGrading={allowGrading} disabled={disabled} />
      ))}
      {!disabled && (
        <Button variant="secondary" block disabled={value.length >= MAX_QUESTIONS} onClick={() => onChange([...value, emptyQuestion(value.at(-1)?.type ?? 'mcq')])}>
          {ar.editor.newQuestion}
        </Button>
      )}
      {value.length >= MAX_QUESTIONS && <p className="text-sm text-muted">{ar.editor.tooMany}</p>}
    </div>
  );
}

function QuestionCard({ q, index, onChange, onRemove, allowGrading, disabled }: {
  q: Question; index: number; onChange: (q: Question) => void; onRemove: () => void; allowGrading: boolean; disabled?: boolean;
}) {
  const radio = useId();
  const choice = q.type === 'mcq' || q.type === 'fill';
  const setOption = (k: number, text: string) => onChange({ ...q, options: q.options.map((o, j) => (j === k ? text : o)) });
  const removeOption = (k: number) =>
    onChange({ ...q, options: q.options.filter((_, j) => j !== k), answer: q.answer === k ? 0 : q.answer > k ? q.answer - 1 : q.answer });

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{ar.editor.number(index + 1)}</h3>
        {!disabled && <ConfirmButton label={ar.editor.remove} warning="" confirmLabel={ar.editor.removeConfirm} onConfirm={onRemove} />}
      </div>
      <fieldset disabled={disabled} className="flex flex-col gap-3">
        <Select label={ar.editor.type} value={q.type} onChange={(e) => onChange(changeType(q, e.target.value as QType))}>
          {TYPES.map((t) => <option key={t} value={t}>{ar.qtypes[t]}</option>)}
        </Select>
        <TextArea
          label={ar.editor.text} value={q.q} maxLength={1000} className="font-scripture"
          hint={q.type === 'fill' ? ar.editor.fillHint : undefined}
          onChange={(e) => onChange({ ...q, q: e.target.value })}
        />
        {q.type === 'fill' && !q.q.includes('___') && (
          <Button small variant="ghost" onClick={() => onChange({ ...q, q: `${q.q.trim()} ${BLANK}`.trim() })}>{ar.editor.insertBlank}</Button>
        )}

        {q.type === 'tf' && (
          <div role="radiogroup" aria-label={ar.editor.correct} className="flex gap-3">
            {q.options.map((o, k) => (
              <label key={k} className="option-row">
                <input type="radio" name={radio} checked={q.answer === k} onChange={() => onChange({ ...q, answer: k })} />
                {o}
              </label>
            ))}
          </div>
        )}

        {choice && (
          <div className="flex flex-col gap-2">
            {q.options.map((o, k) => (
              <div key={k} className="flex items-center gap-2">
                <input type="radio" name={radio} aria-label={`${ar.editor.correct} — ${ar.editor.option(k + 1)}`} checked={q.answer === k} onChange={() => onChange({ ...q, answer: k })} className="h-5 w-5 shrink-0" />
                <input aria-label={ar.editor.option(k + 1)} placeholder={ar.editor.option(k + 1)} value={o} maxLength={300} onChange={(e) => setOption(k, e.target.value)} className="input flex-1" />
                {q.options.length > 2 && (
                  <button type="button" aria-label={ar.editor.removeOption} className="icon-btn" onClick={() => removeOption(k)}>✕</button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{ar.editor.correct}: {n(q.answer + 1)}</span>
              {q.options.length < 4 && <Button small variant="ghost" onClick={() => onChange({ ...q, options: [...q.options, ''] })}>{ar.editor.addOption}</Button>}
            </div>
          </div>
        )}

        {q.type === 'essay' && (
          <>
            <TextArea label={ar.editor.model} hint={ar.editor.modelHint} value={q.model ?? ''} maxLength={1500} onChange={(e) => onChange({ ...q, model: e.target.value })} />
            {allowGrading && (
              <div role="radiogroup" aria-label={ar.editor.grading} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="font-semibold">{ar.editor.grading}:</span>
                {(['ai', 'manual'] as Grading[]).map((g) => (
                  <label key={g} className="option-row">
                    <input type="radio" name={radio + '-g'} checked={(q.grading ?? 'ai') === g} onChange={() => onChange({ ...q, grading: g })} />
                    {g === 'ai' ? ar.editor.gradingAi : ar.editor.gradingManual}
                  </label>
                ))}
              </div>
            )}
          </>
        )}
      </fieldset>
    </Card>
  );
}
