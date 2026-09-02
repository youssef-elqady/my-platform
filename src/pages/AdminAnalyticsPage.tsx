import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, RefreshCw, RotateCcw, Users, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Lesson { id: string; title: string; }
interface HeatRow { segment_second: number; watch_count: number; unique_students: number; replay_count: number; skipped_count: number; }
interface PerformanceRow { lesson_id: string; lesson_title: string; completion_rate: number; total_watched_seconds: number; total_replays: number; students_count: number; }
const ar = (value: number): string => Number(value || 0).toLocaleString('ar-EG');
const time = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function AdminAnalyticsPage(): React.ReactElement {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [heatmap, setHeatmap] = useState<HeatRow[]>([]);
  const [performance, setPerformance] = useState<PerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false): Promise<void> => {
    try {
      silent ? setRefreshing(true) : setLoading(true); setError(null);
      const [lessonResult, performanceResult] = await Promise.all([
        supabase.from('lessons').select('id, title').order('display_order', { ascending: true }),
        supabase.rpc('get_video_performance', { p_limit: 100 }),
      ]);
      if (lessonResult.error) throw lessonResult.error;
      if (performanceResult.error) throw performanceResult.error;
      const nextLessons = (lessonResult.data ?? []) as Lesson[];
      setLessons(nextLessons); setPerformance((performanceResult.data ?? []) as PerformanceRow[]);
      if (!selectedLesson && nextLessons.length) setSelectedLesson(nextLessons[0].id);
      if (selectedLesson) {
        const heatResult = await supabase.rpc('get_video_global_heatmap', { p_lesson_id: selectedLesson });
        if (heatResult.error) throw heatResult.error;
        setHeatmap((heatResult.data ?? []) as HeatRow[]);
      } else setHeatmap([]);
    } catch (err) {
      console.error('Admin analytics load error:', err);
      setError(err instanceof Error ? err.message : 'تعذر تحميل تحليلات الفيديو');
    } finally { setLoading(false); setRefreshing(false); }
  }, [selectedLesson]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const timer = window.setInterval(() => void load(true), 30000); return () => window.clearInterval(timer); }, [load]);

  const maxWatch = useMemo(() => Math.max(...heatmap.map((row) => row.watch_count), 1), [heatmap]);
  const hardest = useMemo(() => [...heatmap].sort((a, b) => b.replay_count - a.replay_count).slice(0, 5), [heatmap]);
  const easiest = useMemo(() => [...heatmap].filter((row) => row.unique_students > 0).sort((a, b) => (a.watch_count / Math.max(a.unique_students, 1)) - (b.watch_count / Math.max(b.unique_students, 1))).slice(0, 5), [heatmap]);

  return <main dir="rtl" className="min-h-screen bg-[#07090f] px-4 py-6 text-white sm:px-6 lg:px-10"><div className="mx-auto max-w-[1600px]">
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold tracking-[0.2em] text-amber-400">REAL CLASS INTELLIGENCE</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">تحليلات الفيديو</h1><p className="mt-2 text-sm text-slate-500">بيانات فعلية من مشاهدات الطلاب، بدون أرقام تجريبية.</p></div><button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold disabled:opacity-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> تحديث الآن</button></header>
    {error && <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{error}</div>}
    {loading ? <div className="rounded-3xl border border-white/[0.06] bg-[#11151d] p-12 text-center text-slate-400">جاري تحميل التحليلات الحقيقية...</div> : <>
      <section className="rounded-3xl border border-white/[0.06] bg-[#11151d] p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black">الخريطة الحرارية الجماعية</h2><p className="mt-1 text-xs text-slate-500">كل عمود يمثل ثانية مسجلة من تفاعل الدفعة.</p></div><select value={selectedLesson} onChange={(event) => setSelectedLesson(event.target.value)} className="rounded-xl border border-white/10 bg-[#07090f] px-3 py-2 text-xs text-white outline-none"><option value="">اختر فيديو</option>{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select></div>
      {heatmap.length === 0 ? <div className="py-14 text-center text-slate-500"><Video className="mx-auto" size={32} /><p className="mt-3 text-sm font-bold">لا توجد بيانات مشاهدة لهذا الفيديو بعد.</p></div> : <><div className="mt-6 flex h-48 items-end gap-px overflow-hidden rounded-2xl border border-white/[0.05] bg-[#07090f] p-3">{heatmap.map((row) => { const height = Math.max(3, Math.round((row.watch_count / maxWatch) * 100)); const replay = row.replay_count >= 2; return <div key={row.segment_second} title={`${time(row.segment_second)} — ${ar(row.watch_count)} مشاهدة — ${ar(row.replay_count)} إعادة`} className={`group relative flex-1 ${replay ? 'bg-orange-400/80' : 'bg-blue-500/70'}`} style={{ height: `${height}%` }} />; })}</div><div className="mt-3 flex flex-wrap gap-4 text-[10px] text-slate-500"><span>■ أزرق: مشاهدة</span><span>■ برتقالي: إعادة مرتفعة</span><span>القيمة الأعلى = تركيز/تفاعل أعلى</span></div></>}
      </section>
      <section className="mt-6 grid gap-5 lg:grid-cols-2"><Insight title="أصعب النقاط — أعلى إعادات" icon={<RotateCcw size={18} />} rows={hardest} metric="replay_count" /><Insight title="أسهل النقاط — أقل إعادة" icon={<BarChart3 size={18} />} rows={easiest} metric="watch_count" /></section>
      <section className="mt-6 rounded-3xl border border-white/[0.06] bg-[#11151d] p-5"><div className="flex items-center gap-2"><Users size={18} className="text-amber-300" /><h2 className="font-black">أداء الدروس</h2></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-right text-xs"><thead><tr className="border-b border-white/[0.06] text-slate-600"><th className="p-3">الفيديو</th><th className="p-3">الإكمال</th><th className="p-3">وقت المشاهدة</th><th className="p-3">الإعادات</th><th className="p-3">الطلاب</th></tr></thead><tbody>{performance.length === 0 ? <tr><td colSpan={5} className="p-10 text-center text-slate-500">لا توجد بيانات بعد.</td></tr> : performance.map((row) => <tr key={row.lesson_id} className="border-b border-white/[0.04] last:border-0"><td className="p-3 font-bold text-slate-200">{row.lesson_title}</td><td className="p-3 text-emerald-300">{Number(row.completion_rate || 0).toFixed(1)}%</td><td className="p-3 text-slate-400">{Math.round(Number(row.total_watched_seconds || 0) / 60)} د</td><td className="p-3 text-orange-300">{ar(row.total_replays)}</td><td className="p-3 text-slate-400">{ar(row.students_count)}</td></tr>)}</tbody></table></div></section>
    </>}
  </div></main>;
}

function Insight({ title, icon, rows, metric }: { title: string; icon: React.ReactNode; rows: HeatRow[]; metric: 'replay_count' | 'watch_count' }): React.ReactElement {
  return <div className="rounded-3xl border border-white/[0.06] bg-[#11151d] p-5"><div className="flex items-center gap-2">{icon}<h3 className="font-black">{title}</h3></div><div className="mt-4 space-y-2">{rows.length === 0 ? <p className="text-xs text-slate-500">لا توجد بيانات كافية.</p> : rows.map((row) => <div key={row.segment_second} className="flex items-center justify-between rounded-xl bg-[#07090f] p-3"><span className="text-xs text-slate-400">الدقيقة {time(row.segment_second)}</span><strong className="text-sm text-white">{ar(row[metric])}</strong></div>)}</div></div>;
}
