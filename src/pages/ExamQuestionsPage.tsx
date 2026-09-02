import React, { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Edit3, Plus, Save, Trash2, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Row = Record<string, any>;

const inputClass =
  'w-full rounded-2xl border border-white/[0.08] bg-[#11151d] px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-sky-500/40';

export default function ExamQuestionsPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Row | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [text, setText] = useState('');
  const [type, setType] = useState('multiple_choice');
  const [points, setPoints] = useState('1');
  const [answer, setAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [choices, setChoices] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!examId) return;

    const [examResult, questionsResult] = await Promise.all([
      supabase.from('exams').select('id,title,max_score').eq('id', examId).maybeSingle(),
      supabase.from('exam_questions').select('*').eq('exam_id', examId).order('display_order'),
    ]);

    if (examResult.error) setError(examResult.error.message);
    if (questionsResult.error) setError(questionsResult.error.message);

    setExam(examResult.data ?? null);
    setRows(questionsResult.data ?? []);
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setEditing(null);
    setText('');
    setType('multiple_choice');
    setPoints('1');
    setAnswer('');
    setExplanation('');
    setChoices('');
    setError('');
  };

  const save = async () => {
    setError('');

    if (!examId || text.trim().length < 2 || Number(points) <= 0) {
      setError('أكمل نص السؤال والدرجة بشكل صحيح');
      return;
    }

    const payload = {
      exam_id: examId,
      question_text: text.trim(),
      question_type: type,
      points: Number(points),
      correct_answer: answer.trim() || null,
      explanation: explanation.trim() || null,
      display_order: editing?.display_order ?? rows.length + 1,
    };

    const result = editing
      ? await supabase.from('exam_questions').update(payload).eq('id', editing.id)
      : await supabase.from('exam_questions').insert(payload);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setOpen(false);
    reset();
    await load();
  };

  const edit = (question: Row) => {
    setEditing(question);
    setText(question.question_text ?? '');
    setType(question.question_type ?? 'multiple_choice');
    setPoints(String(question.points ?? 1));
    setAnswer(question.correct_answer ?? '');
    setExplanation(question.explanation ?? '');
    setChoices('');
    setError('');
    setOpen(true);
  };

  const remove = async (id: string) => {
    if (!confirm('حذف السؤال؟')) return;

    const { error: removeError } = await supabase.from('exam_questions').delete().eq('id', id);

    if (removeError) {
      setError(removeError.message);
      return;
    }

    await load();
  };

  return (
    <div className="min-h-screen bg-[#07090f] text-white" dir="rtl">
      <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
        <button
          type="button"
          onClick={() => navigate('/admin/exams')}
          className="mb-5 inline-flex items-center gap-2 text-sm font-black text-slate-500 hover:text-white"
        >
          <ArrowRight size={17} />
          العودة للامتحانات
        </button>

        <header className="mb-7">
          <p className="text-sm font-black text-sky-400">إدارة أسئلة الامتحان</p>
          <h1 className="mt-2 text-3xl font-black">{exam?.title ?? 'الامتحان'}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {rows.length} سؤال • الدرجة القصوى {exam?.max_score ?? '—'}
          </p>
        </header>

        <div className="mb-5 flex justify-end">
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-slate-950"
          >
            <Plus size={17} />
            إضافة سؤال
          </button>
        </div>

        {error && (
          <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/5 p-3 text-sm font-bold text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-3">
          {rows.map((question, index) => (
            <div
              key={question.id}
              className="rounded-3xl border border-white/[0.06] bg-[#0d1118] p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-black text-sky-400">
                    <span>سؤال {index + 1}</span>
                    <span>•</span>
                    <span>{question.question_type}</span>
                    <span>• {question.points} درجة</span>
                  </div>
                  <p className="font-bold leading-7">{question.question_text}</p>
                  {question.correct_answer && (
                    <p className="mt-2 text-xs text-emerald-400">
                      الإجابة الصحيحة: {question.correct_answer}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => edit(question)}
                    className="rounded-xl bg-white/[0.04] p-3 text-slate-400 hover:text-white"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(question.id)}
                    className="rounded-xl bg-red-500/5 p-3 text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {open && (
          <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/75 p-4">
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/[0.08] bg-[#0d1118] p-6">
              <div className="mb-5 flex justify-between">
                <h2 className="font-black">{editing ? 'تعديل السؤال' : 'إضافة سؤال'}</h2>
                <button type="button" onClick={() => setOpen(false)}>
                  <X />
                </button>
              </div>

              <div className="grid gap-4">
                <label className="text-xs font-black text-slate-400">
                  نص السؤال
                  <textarea
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={5}
                    className={`${inputClass} mt-2`}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-black text-slate-400">
                    نوع السؤال
                    <select
                      value={type}
                      onChange={(event) => setType(event.target.value)}
                      className={`${inputClass} mt-2 [color-scheme:dark]`}
                    >
                      <option value="multiple_choice" className="bg-[#11151d] text-white">
                        اختيار من متعدد
                      </option>
                      <option value="true_false" className="bg-[#11151d] text-white">
                        صح / خطأ
                      </option>
                      <option value="short_answer" className="bg-[#11151d] text-white">
                        إجابة قصيرة
                      </option>
                    </select>
                  </label>

                  <label className="text-xs font-black text-slate-400">
                    الدرجة
                    <input
                      type="number"
                      min="1"
                      value={points}
                      onChange={(event) => setPoints(event.target.value)}
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                </div>

                <label className="text-xs font-black text-slate-400">
                  الاختيارات
                  <textarea
                    value={choices}
                    onChange={(event) => setChoices(event.target.value)}
                    placeholder={'اختيار 1\nاختيار 2\nاختيار 3'}
                    rows={3}
                    className={`${inputClass} mt-2`}
                  />
                  <span className="mt-1 block text-[11px] text-slate-600">
                    تُعرض حاليًا في النموذج فقط؛ حفظ الاختيارات في جدول مستقل سيتم ربطه بقاعدة الأسئلة.
                  </span>
                </label>

                <label className="text-xs font-black text-slate-400">
                  الإجابة الصحيحة
                  <input
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    className={`${inputClass} mt-2`}
                  />
                </label>

                <label className="text-xs font-black text-slate-400">
                  التفسير
                  <textarea
                    value={explanation}
                    onChange={(event) => setExplanation(event.target.value)}
                    rows={3}
                    className={`${inputClass} mt-2`}
                  />
                </label>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm font-black"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-slate-950"
                  >
                    <Save size={16} />
                    حفظ السؤال
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
