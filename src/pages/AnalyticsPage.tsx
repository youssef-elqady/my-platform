import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Activity, Clock3, Monitor, Smartphone, Tablet, Users, Video, RefreshCw } from 'lucide-react';

interface Summary {
  online_now: number;
  sessions_today: number;
  unique_students_today: number;
  events_today: number;
  video_views_today: number;
  total_watch_seconds_today: number;
  active_students_last_7_days: number;
  active_students_last_30_days: number;
}

interface ActiveStudent {
  user_id: string;
  full_name: string;
  student_code: string | null;
  sessions_count: number;
  total_duration_seconds: number;
  events_count: number;
  video_watch_seconds: number;
}

interface DailyRow {
  activity_date: string;
  unique_students: number;
  sessions_count: number;
  events_count: number;
  video_views: number;
  watch_seconds: number;
}

interface OnlineStudent {
  user_id: string;
  full_name: string;
  student_code: string | null;
  session_id: string;
  started_at: string;
  last_seen_at: string;
  duration_seconds: number;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
}

interface DeviceRow { device_type: string | null; count: number }

const arNumber = (n: number) => Number(n || 0).toLocaleString('ar-EG');
const minutes = (seconds: number) => `${Math.round((seconds || 0) / 60).toLocaleString('ar-EG')} د`;

function Metric({ icon, title, value, note }: { icon: React.ReactNode; title: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border border-white/[0.07] bg-white/[0.035] p-5">
      <div className="flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">{icon}</div>
        <span className="text-xs text-slate-500">{title}</span>
      </div>
      <div className="mt-5 text-3xl font-black text-white">{value}</div>
      <div className="mt-2 text-xs text-slate-500">{note}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activeStudents, setActiveStudents] = useState<ActiveStudent[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [online, setOnline] = useState<OnlineStudent[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    try {
      silent ? setRefreshing(true) : setLoading(true);
      setError(null);

      const [summaryResult, activeResult, dailyResult, onlineResult, sessionsResult] = await Promise.all([
        supabase.rpc('get_teacher_analytics_summary'),
        supabase.rpc('get_most_active_students', { p_days: 7, p_limit: 10 }),
        supabase.rpc('get_daily_analytics', { p_days: 14 }),
        supabase.rpc('get_online_students'),
        supabase.from('analytics_sessions').select('device_type').not('device_type', 'is', null),
      ]);

      if (summaryResult.error) throw summaryResult.error;
      if (activeResult.error) throw activeResult.error;
      if (dailyResult.error) throw dailyResult.error;
      if (onlineResult.error) throw onlineResult.error;
      if (sessionsResult.error) throw sessionsResult.error;

      setSummary((summaryResult.data || null) as Summary | null);
      setActiveStudents((activeResult.data || []) as ActiveStudent[]);
      setDaily((dailyResult.data || []) as DailyRow[]);
      setOnline((onlineResult.data || []) as OnlineStudent[]);

      const counts = new Map<string, number>();
      (sessionsResult.data || []).forEach((row: { device_type: string | null }) => {
        if (row.device_type) counts.set(row.device_type, (counts.get(row.device_type) || 0) + 1);
      });
      setDevices(Array.from(counts.entries()).map(([device_type, count]) => ({ device_type, count })).sort((a, b) => b.count - a.count));
    } catch (e) {
      console.error('Analytics page load error:', e);
      setError('تعذر تحميل التحليلات. تأكد من تشغيل migrations الخاصة بالـ Analytics في Supabase.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(true), 30_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const maxDaily = useMemo(() => Math.max(...daily.map((d) => d.unique_students), 1), [daily]);
  const totalDeviceSessions = useMemo(() => devices.reduce((sum, d) => sum + d.count, 0), [devices]);

  return (
    <main dir="rtl" className="min-h-screen bg-[#07090f] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-amber-400">LIVE LEARNING INTELLIGENCE</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">تحليلات المنصة</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">كل الأرقام هنا تُقرأ من قاعدة البيانات الفعلية، بدون أرقام تجريبية.</p>
          </div>
          <button onClick={() => void load(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/[0.08] disabled:opacity-50">
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> تحديث الآن
          </button>
        </header>

        {error && <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">{error}</div>}

        {loading ? (
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.035] p-10 text-center text-slate-400">جاري تحميل التحليلات الحقيقية...</div>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric icon={<Users size={20} />} title="متصل الآن" value={arNumber(summary?.online_now || 0)} note="جلسات نشطة خلال آخر دقيقتين" />
              <Metric icon={<Activity size={20} />} title="طلاب اليوم" value={arNumber(summary?.unique_students_today || 0)} note={`${arNumber(summary?.sessions_today || 0)} جلسة بدأت اليوم`} />
              <Metric icon={<Clock3 size={20} />} title="وقت مشاهدة اليوم" value={minutes(summary?.total_watch_seconds_today || 0)} note={`${arNumber(summary?.video_views_today || 0)} سجل مشاهدة`} />
              <Metric icon={<Video size={20} />} title="نشاط 7 أيام" value={arNumber(summary?.active_students_last_7_days || 0)} note={`${arNumber(summary?.active_students_last_30_days || 0)} طالب خلال 30 يوم`} />
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              <div className="rounded-3xl border border-white/[0.07] bg-white/[0.035] p-5">
                <div className="mb-5 flex items-center justify-between"><div><h2 className="font-black">نشاط آخر 14 يوم</h2><p className="mt-1 text-xs text-slate-500">عدد الطلاب الفريدين الذين ظهر لهم نشاط</p></div><Activity size={18} className="text-amber-300" /></div>
                <div className="flex h-48 items-end gap-1.5 overflow-hidden">
                  {daily.map((row) => {
                    const height = Math.max(4, Math.round((row.unique_students / maxDaily) * 100));
                    return <div key={row.activity_date} className="group flex min-w-0 flex-1 flex-col justify-end gap-2"><div className="relative h-36 flex items-end"><div title={`${row.activity_date}: ${row.unique_students} طالب`} style={{ height: `${height}%` }} className="w-full rounded-t-lg bg-amber-400/70 transition group-hover:bg-amber-300" /></div><span className="truncate text-center text-[9px] text-slate-600">{row.activity_date.slice(5)}</span></div>;
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-white/[0.07] bg-white/[0.035] p-5">
                <h2 className="font-black">الأجهزة المستخدمة</h2>
                <p className="mt-1 text-xs text-slate-500">مبني على جلسات الطلاب المسجلة</p>
                <div className="mt-6 space-y-4">
                  {devices.length === 0 ? <p className="text-sm text-slate-500">لا توجد بيانات أجهزة بعد.</p> : devices.map((row) => {
                    const pct = totalDeviceSessions ? Math.round((row.count / totalDeviceSessions) * 100) : 0;
                    const Icon = row.device_type === 'mobile' ? Smartphone : row.device_type === 'tablet' ? Tablet : Monitor;
                    return <div key={row.device_type}><div className="mb-2 flex items-center justify-between text-sm"><span className="flex items-center gap-2"><Icon size={16} /> {row.device_type}</span><span className="text-slate-400">{arNumber(row.count)} ({pct}%)</span></div><div className="h-2 overflow-hidden rounded-full bg-white/5"><div style={{ width: `${pct}%` }} className="h-full rounded-full bg-amber-400" /></div></div>;
                  })}
                </div>
              </div>
            </section>

            <section className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-white/[0.07] bg-white/[0.035] p-5">
                <div className="mb-5 flex items-center justify-between"><h2 className="font-black">الطلاب الأكثر نشاطًا — 7 أيام</h2><span className="text-xs text-slate-500">حقيقي</span></div>
                <div className="space-y-2">
                  {activeStudents.length === 0 ? <p className="text-sm text-slate-500">لا توجد بيانات نشاط حتى الآن.</p> : activeStudents.map((student, index) => <div key={student.user_id} className="flex items-center gap-3 rounded-2xl bg-black/10 p-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xs font-black text-amber-300">{index + 1}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{student.full_name}</p><p className="text-[11px] text-slate-600">{student.student_code || 'بدون كود'}</p></div><div className="text-left"><p className="text-sm font-black">{minutes(student.video_watch_seconds)}</p><p className="text-[10px] text-slate-600">{arNumber(student.events_count)} حدث</p></div></div>)}
                </div>
              </div>

              <div className="rounded-3xl border border-white/[0.07] bg-white/[0.035] p-5">
                <div className="mb-5 flex items-center justify-between"><div><h2 className="font-black">الطلاب المتصلون الآن</h2><p className="mt-1 text-xs text-slate-500">تتحدث تلقائيًا كل 30 ثانية</p></div><span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> {arNumber(online.length)} متصل</span></div>
                <div className="space-y-2">
                  {online.length === 0 ? <p className="text-sm text-slate-500">لا يوجد طلاب متصلون الآن.</p> : online.map((student) => <div key={student.session_id} className="rounded-2xl bg-black/10 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{student.full_name}</p><p className="mt-1 text-[11px] text-slate-500">{student.device_type || 'unknown'} · {student.browser || 'Other'} · {student.operating_system || 'Other'}</p></div><span className="shrink-0 text-xs font-bold text-emerald-300">مباشر</span></div></div>)}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
