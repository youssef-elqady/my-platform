import React, { useEffect, useMemo, useState } from 'react';
import { Activity, Bell, BookOpen, CalendarCheck, ChevronLeft, ClipboardList, GraduationCap, LogOut, ShieldCheck, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { hasStaffPermission, type StaffPermission } from '../lib/permissions';

type Staff = { display_name: string; permissions: Record<string, boolean>; is_active: boolean };
const navItems: readonly [StaffPermission, string, string, typeof Users][] = [
  ['students.read', 'الطلاب', '/admin/students', Users],
  ['attendance.manage', 'الحضور', '/admin/attendance', CalendarCheck],
  ['content.read', 'الدروس والمحتوى', '/admin/lessons', BookOpen],
  ['assignments.read', 'الواجبات', '/admin/assignments', ClipboardList],
  ['notifications.read', 'الإشعارات', '/admin/notifications', Bell],
  ['analytics.read', 'التحليلات', '/admin/analytics', Activity],
];

export default function AssistantDashboard() {
  const { profile, signOut } = useAuthStore();
  const navigate = useNavigate();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [stats, setStats] = useState({ students: 0, pending: 0, sessions: 0, notifications: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error: e } = await supabase.rpc('get_my_staff_context');
        if (e) throw e;
        if (!data?.is_staff || !data.is_active) {
          navigate('/dashboard', { replace: true });
          return;
        }
        if (alive) setStaff({ display_name: data.display_name || 'المساعد', permissions: data.permissions || {}, is_active: data.is_active });
        const results = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'student').eq('is_active', false),
          supabase.from('sessions').select('id', { count: 'exact', head: true }),
          profile?.id ? supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', profile.id).eq('is_read', false) : Promise.resolve({ count: 0 } as any),
        ]);
        if (alive) setStats({ students: results[0].count || 0, pending: results[1].count || 0, sessions: results[2].count || 0, notifications: results[3].count || 0 });
      } catch (e) {
        if (alive) setError(e instanceof Error ? 'تعذر تحميل لوحة المساعد.' : 'تعذر تحميل لوحة المساعد.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [navigate, profile?.id]);

  const allowed = useMemo(() => staff?.permissions || {}, [staff]);
  if (loading) return <div dir="rtl" className="min-h-screen bg-[#07090f] text-slate-400 grid place-items-center">جاري تجهيز لوحة المساعد...</div>;
  if (error) return <div dir="rtl" className="min-h-screen bg-[#07090f] text-red-300 grid place-items-center p-6">{error}</div>;

  return <main dir="rtl" className="min-h-screen bg-[#07090f] text-white"><div className="mx-auto max-w-[1450px] px-4 py-6 sm:px-6 lg:px-8">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-white/[0.07] bg-[#0d1118] p-5 sm:p-7"><div><p className="text-xs font-black text-sky-400">بوابة المساعد</p><h1 className="mt-2 text-3xl font-black">أهلًا {staff?.display_name || 'بك'} 👋</h1><p className="mt-2 text-sm text-slate-500">صلاحياتك محددة من المدرس وتظهر هنا بوضوح.</p></div><div className="flex items-center gap-2"><button onClick={()=>navigate('/dashboard')} className="rounded-2xl bg-white/[0.05] px-4 py-3 text-sm font-black">الرئيسية</button><button onClick={()=>void signOut()} className="rounded-2xl border border-red-400/10 px-4 py-3 text-sm font-black text-red-300"><LogOut size={16} className="inline"/> خروج</button></div></header>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['طلاب المنصة',stats.students,Users],['بحاجة لمتابعة',stats.pending,GraduationCap],['الجلسات',stats.sessions,CalendarCheck],['إشعارات غير مقروءة',stats.notifications,Bell]].map(([t,v,I])=><div key={String(t)} className="rounded-3xl border border-white/[0.07] bg-[#0d1118] p-5"><I className="text-sky-400" size={20}/><p className="mt-4 text-sm text-slate-500">{t}</p><b className="mt-1 block text-3xl">{Number(v).toLocaleString('ar-EG')}</b></div>)}</section>
    <section className="mt-6 rounded-3xl border border-white/[0.07] bg-[#0d1118] p-5 sm:p-7"><div className="flex items-center gap-3"><ShieldCheck className="text-emerald-400"/><div><h2 className="font-black">صلاحياتك الحالية</h2><p className="text-xs text-slate-500">لا تظهر أي وظيفة غير مسموحة لك.</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{navItems.map(([key,label,path,Icon])=>hasStaffPermission(allowed,key)?<button key={key} onClick={()=>navigate(path)} className="group flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-right transition hover:-translate-y-0.5 hover:bg-white/[0.05]"><span className="flex items-center gap-3"><Icon size={19} className="text-sky-400"/><span><b className="block">{label}</b><small className="text-xs text-emerald-400">مسموح</small></span></span><ChevronLeft size={17} className="text-slate-600 group-hover:text-white"/></button>:<div key={key} className="flex items-center gap-3 rounded-2xl border border-white/[0.04] bg-black/10 p-4 opacity-45"><ShieldCheck size={19}/><span><b className="block">{label}</b><small className="text-xs">غير مسموح</small></span></div>)}</div></section>
    <div className="mt-6 rounded-3xl border border-amber-400/10 bg-amber-400/[0.04] p-5 text-sm leading-7 text-slate-400"><b className="text-amber-300">مهم:</b> الواجهة ليست حدًا أمنيًا. الحماية الحقيقية من قاعدة البيانات والصلاحيات، لذلك فتح رابط مباشر لا يمنح المساعد صلاحية إضافية.</div>
  </div></main>;
}
