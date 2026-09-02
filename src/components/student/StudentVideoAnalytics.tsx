import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Brain, Clock3, Eye, Gauge, RotateCcw, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Props { studentId: string; }
interface WatchLog { lesson_id: string; watched_seconds: number; duration_seconds: number; completion_rate: number; speed_rate: number; tab_switches_count: number; is_muted_count: number; play_count: number; pause_count: number; completed: boolean; last_watched_at: string; }
interface Lesson { id: string; title: string; }
interface Heat { lesson_id: string; segment_second: number; watch_count: number; }
interface EventRow { lesson_id: string; event_type: string; video_timestamp: number; metadata: Record<string, unknown>; created_at: string; }
interface Correlation { question_id: string; exam_title: string; question_text: string; lesson_id: string; lesson_title: string | null; video_start_second: number | null; video_end_second: number | null; was_wrong: boolean; watched_anchor: boolean; }
interface Behavior { watch_seconds: number; average_speed: number; tab_switches: number; muted_count: number; completed_count: number; video_count: number; average_completion_rate: number; replay_actions: number; }

const formatDuration = (seconds: number): string => {
  const value = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  return hours > 0 ? `${hours}س ${minutes}د` : `${minutes}د`;
};
const ar = (value: number): string => Number(value || 0).toLocaleString('ar-EG');

function XRay({ duration, heat, events }: { duration: number; heat: Heat[]; events: EventRow[] }): React.ReactElement {
  const safeDuration = Math.max(1, Math.ceil(duration));
  const heatMap = new Map(heat.map((item) => [item.segment_second, item.watch_count]));
  const skipped = new Set<number>();
  events.filter((event) => event.event_type === 'seek_forward').forEach((event) => {
    const from = Number(event.metadata.from_second);
    const to = Number(event.metadata.to_second);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return;
    for (let second = Math.floor(from); second < Math.min(Math.ceil(to), safeDuration); second += 1) skipped.add(second);
  });
  const buckets = Array.from({ length: Math.min(180, safeDuration) }, (_, index) => {
    const second = Math.floor((index / Math.min(180, safeDuration)) * safeDuration);
    const count = heatMap.get(second) ?? 0;
    return { second, count, skipped: skipped.has(second) };
  });
  return (
    <div className="mt-4">
      <div className="flex h-9 overflow-hidden rounded-xl border border-white/[0.06] bg-[#07090f]">
        {buckets.map((bucket) => {
          const className = bucket.skipped ? 'bg-red-500/80' : bucket.count >= 3 ? 'bg-orange-400/90' : bucket.count === 1 ? 'bg-emerald-400/70' : 'bg-slate-700/50';
          return <div key={bucket.second} title={`${bucket.second}ث — ${bucket.count} مشاهدة`} className={`h-full flex-1 ${className}`} />;
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">
        <span>■ أخضر: شوهد</span><span>■ برتقالي: إعادة</span><span>■ أحمر: تم تخطيه</span><span>■ رمادي: غير مسجل</span>
      </div>
    </div>
  );
}

export default function StudentVideoAnalytics({ studentId }: Props): React.ReactElement {
  const [logs, setLogs] = useState<WatchLog[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [heat, setHeat] = useState<Heat[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [correlation, setCorrelation] = useState<Correlation[]>([]);
  const [behavior, setBehavior] = useState<Behavior | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<string>('');

  const load = useCallback(async (): Promise<void> => {
    try {
      setLoading(true); setError(null);
      const [logResult, eventResult, behaviorResult, correlationResult] = await Promise.all([
        supabase.from('video_watch_logs').select('lesson_id, watched_seconds, duration_seconds, completion_rate, speed_rate, tab_switches_count, is_muted_count, play_count, pause_count, completed, last_watched_at').eq('user_id', studentId).order('last_watched_at', { ascending: false }),
        supabase.from('video_events').select('lesson_id, event_type, video_timestamp, metadata, created_at').eq('user_id', studentId).order('created_at', { ascending: false }).limit(5000),
        supabase.rpc('get_student_video_behavior', { p_student_id: studentId }),
        supabase.rpc('get_student_quiz_video_correlation', { p_student_id: studentId }),
      ]);
      if (logResult.error) throw logResult.error;
      if (eventResult.error) throw eventResult.error;
      if (behaviorResult.error) throw behaviorResult.error;
      if (correlationResult.error) throw correlationResult.error;
      const nextLogs = (logResult.data ?? []) as WatchLog[];
      const nextEvents = (eventResult.data ?? []) as EventRow[];
      setLogs(nextLogs); setEvents(nextEvents); setBehavior((behaviorResult.data ?? null) as Behavior | null); setCorrelation((correlationResult.data ?? []) as Correlation[]);
      const ids = Array.from(new Set(nextLogs.map((item) => item.lesson_id).filter(Boolean)));
      if (ids.length) {
        const lessonResult = await supabase.from('lessons').select('id, title').in('id', ids);
        if (lessonResult.error) throw lessonResult.error;
        setLessons((lessonResult.data ?? []) as Lesson[]);
        setSelectedLesson((current) => current || ids[0]);
      } else { setLessons([]); setSelectedLesson(''); }
      if (ids.length) {
        const heatResult = await supabase.from('video_segment_heatmaps').select('lesson_id, segment_second, watch_count').eq('user_id', studentId).in('lesson_id', ids).order('segment_second');
        if (heatResult.error) throw heatResult.error;
        setHeat((heatResult.data ?? []) as Heat[]);
      } else setHeat([]);
    } catch (err) {
      console.error('Student video analytics load error:', err);
      setError(err instanceof Error ? err.message : 'تعذر تحميل تحليلات الفيديو');
    } finally { setLoading(false); }
  }, [studentId]);

  useEffect(() => { void load(); }, [load]);

  const lessonMap = useMemo(() => new Map(lessons.map((lesson) => [lesson.id, lesson.title])), [lessons]);
  const selectedLog = logs.find((log) => log.lesson_id === selectedLesson) ?? null;
  const selectedHeat = heat.filter((item) => item.lesson_id === selectedLesson);
  const selectedEvents = events.filter((item) => item.lesson_id === selectedLesson);
  const effectiveBehavior: Behavior = behavior ?? { watch_seconds: 0, average_speed: 1, tab_switches: 0, muted_count: 0, completed_count: 0, video_count: 0, average_completion_rate: 0, replay_actions: 0 };
  const learningHours = effectiveBehavior.watch_seconds / 3600;
  const preferredTime = useMemo(() => {
    const buckets = events.filter((event) => ['play', 'ended'].includes(event.event_type)).reduce<Record<string, number>>((acc, event) => { const hour = new Date(event.created_at).getHours(); const key = hour >= 5 && hour < 12 ? 'صباحاً' : hour >= 18 || hour < 5 ? 'ليلاً' : 'ظهراً/عصراً'; acc[key] = (acc[key] ?? 0) + 1; return acc; }, {});
    return Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'لا توجد بيانات كافية';
  }, [events]);

  if (loading) return <section dir="rtl" className="mt-6 rounded-3xl border border-white/[0.06] bg-[#0d1118] p-8 text-center text-slate-400">جاري تحميل التحليلات السلوكية الحقيقية...</section>;
  if (error) return <section dir="rtl" className="mt-6 rounded-3xl border border-red-500/10 bg-[#0d1118] p-8 text-center"><p className="font-black text-red-300">تعذر تحميل التحليلات</p><p className="mt-2 text-xs text-slate-500">{error}</p><button type="button" onClick={() => void load()} className="mt-4 rounded-xl bg-blue-500 px-4 py-2 text-xs font-black">إعادة المحاولة</button></section>;

  return (
    <section dir="rtl" className="mt-6 rounded-3xl border border-white/[0.06] bg-[#0d1118] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold tracking-[0.16em] text-amber-400">REAL VIDEO INTELLIGENCE</p><h2 className="mt-2 text-xl font-black text-white">التحليل السلوكي للفيديو</h2><p className="mt-1 text-xs text-slate-500">بيانات حقيقية مسجلة من تفاعل الطالب مع الدروس.</p></div>
        {lessons.length > 0 && <select value={selectedLesson} onChange={(event) => setSelectedLesson(event.target.value)} className="rounded-xl border border-white/10 bg-[#11151d] px-3 py-2 text-xs text-white outline-none">{lessons.map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}</select>}
      </div>

      {lessons.length === 0 ? <div className="py-12 text-center text-slate-500"><Video className="mx-auto" size={30} /><p className="mt-3 text-sm font-bold">لا توجد مشاهدات فيديو مسجلة لهذا الطالب.</p></div> : <>
        <div className="mt-5 rounded-2xl border border-white/[0.06] bg-[#07090f] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-black text-white">{lessonMap.get(selectedLesson) ?? 'الدرس'}</p><p className="mt-1 text-[11px] text-slate-500">Visual X-Ray Timeline</p></div><Eye size={18} className="text-amber-300" /></div><XRay duration={selectedLog?.duration_seconds ?? 0} heat={selectedHeat} events={selectedEvents} /></div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={<Clock3 size={17} />} title="وقت التعلم الفعلي" value={formatDuration(effectiveBehavior.watch_seconds)} note={`${learningHours.toFixed(1)} ساعة`} />
          <Metric icon={<RotateCcw size={17} />} title="الإعادات" value={ar(effectiveBehavior.replay_actions)} note="Play إضافي مسجل" />
          <Metric icon={<AlertTriangle size={17} />} title="خروج من التبويب" value={ar(effectiveBehavior.tab_switches)} note="Tab switches" />
          <Metric icon={<Gauge size={17} />} title="سرعة المشاهدة" value={`${Number(effectiveBehavior.average_speed || 1).toFixed(2)}x`} note={`${Number(effectiveBehavior.average_completion_rate || 0).toFixed(1)}% متوسط إكمال`} />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.06] bg-[#07090f] p-5"><div className="flex items-center gap-2"><Brain size={18} className="text-amber-300" /><h3 className="font-black">النمط السلوكي</h3></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white/[0.03] p-4"><p className="text-[10px] text-slate-600">وقت المذاكرة المفضل</p><p className="mt-2 font-black text-white">{preferredTime}</p></div><div className="rounded-xl bg-white/[0.03] p-4"><p className="text-[10px] text-slate-600">المحتوى المشاهد</p><p className="mt-2 font-black text-white">{ar(effectiveBehavior.video_count)} فيديو</p></div><div className="rounded-xl bg-white/[0.03] p-4"><p className="text-[10px] text-slate-600">الفيديوهات المكتملة</p><p className="mt-2 font-black text-emerald-300">{ar(effectiveBehavior.completed_count)}</p></div><div className="rounded-xl bg-white/[0.03] p-4"><p className="text-[10px] text-slate-600">الكتم</p><p className="mt-2 font-black text-white">{ar(effectiveBehavior.muted_count)} مرة</p></div></div></div>
          <div className="rounded-2xl border border-white/[0.06] bg-[#07090f] p-5"><div className="flex items-center gap-2"><Activity size={18} className="text-blue-300" /><h3 className="font-black">قراءة التركيز</h3></div><div className="mt-5 space-y-3"><div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-4"><span className="text-xs text-slate-500">متوسط إكمال الفيديو</span><strong className="text-white">{Number(effectiveBehavior.average_completion_rate || 0).toFixed(1)}%</strong></div><div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-4"><span className="text-xs text-slate-500">عدد مرات التوقف</span><strong className="text-white">{ar(logs.reduce((sum, item) => sum + item.pause_count, 0))}</strong></div><div className="flex items-center justify-between rounded-xl bg-white/[0.03] p-4"><span className="text-xs text-slate-500">إجمالي الجلسات المرئية</span><strong className="text-white">{ar(logs.length)}</strong></div></div></div>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[0.06] bg-[#07090f] p-5"><div className="mb-4 flex items-center gap-2"><Video size={18} className="text-amber-300" /><h3 className="font-black">الربط التشخيصي: الامتحان ← الفيديو</h3></div>{correlation.length === 0 ? <p className="py-8 text-center text-xs text-slate-500">لا توجد أسئلة خاطئة مرتبطة بنقاط فيديو حتى الآن.</p> : <table className="w-full min-w-[800px] text-right text-xs"><thead><tr className="border-b border-white/[0.06] text-slate-600"><th className="p-3">الامتحان</th><th className="p-3">السؤال</th><th className="p-3">الفيديو</th><th className="p-3">الدقيقة</th><th className="p-3">حالة المشاهدة</th></tr></thead><tbody>{correlation.map((row) => <tr key={`${row.question_id}-${row.exam_title}`} className="border-b border-white/[0.04] last:border-0"><td className="p-3 text-slate-300">{row.exam_title}</td><td className="max-w-[300px] p-3 text-slate-400">{row.question_text}</td><td className="p-3 text-slate-300">{row.lesson_title ?? 'غير محدد'}</td><td className="p-3 text-amber-300">{row.video_start_second != null ? `${Math.floor(row.video_start_second / 60)}:${String(row.video_start_second % 60).padStart(2, '0')}` : '—'}</td><td className="p-3">{row.watched_anchor ? <span className="text-emerald-300">شاهده</span> : <span className="text-red-300">تخطاه/غير مسجل</span>}</td></tr>)}</tbody></table>}</div>
      </>}
    </section>
  );
}

function Metric({ icon, title, value, note }: { icon: React.ReactNode; title: string; value: string; note: string }): React.ReactElement {
  return <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">{icon}</span><span className="text-[10px] text-slate-600">{title}</span></div><p className="mt-3 text-xl font-black text-white">{value}</p><p className="mt-1 text-[10px] text-slate-600">{note}</p></div>;
}
