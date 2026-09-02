import React, { useState } from 'react';
import { ArrowRight, Download, GraduationCap, MessageCircle, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Report = {
  student: { full_name: string; student_code: string; grade_name: string | null; group_name: string | null };
  summary: { exam_average: number; exams_count: number; assignments_submitted: number; attendance_rate: number; study_minutes: number };
  strengths: string[];
  needs_attention: string[];
  recommendations: string[];
  recent_exams: { title: string; score: number | null; max_score: number; date: string }[];
};

const card = 'rounded-3xl border border-white/[0.08] bg-[#0d1118]';
const input = 'w-full rounded-2xl border border-white/[0.1] bg-[#11151d] px-4 py-3.5 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-amber-400/40';

export default function ParentPortalPage() {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<Report | null>(null);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setLoading(true); setReport(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('parent_get_student_report', { p_parent_phone: phone.trim(), p_student_code: code.trim().toUpperCase() });
      if (rpcError) throw rpcError;
      if (!data?.success) throw new Error(data?.error || 'بيانات التحقق غير صحيحة.');
      setReport(data.report as Report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحقق من البيانات.');
    } finally { setLoading(false); }
  };

  const printReport = () => window.print();
  const whatsapp = () => window.open(`https://wa.me/201095240716?text=${encodeURIComponent(`السلام عليكم أستاذ أحمد، أريد التواصل بخصوص الطالب ${report?.student.full_name || ''}.`)}`, '_blank', 'noopener,noreferrer');

  if (report) return <main dir="rtl" className="min-h-screen bg-[#07090f] px-4 py-6 text-white sm:px-6" id="parent-report"><div className="mx-auto max-w-5xl">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden"><button onClick={() => setReport(null)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white"><ArrowRight size={18}/> تحقق من طالب آخر</button><div className="flex gap-2"><button onClick={printReport} className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.06] px-4 py-3 text-sm font-black"><Download size={17}/> تحميل التقرير PDF</button><button onClick={whatsapp} className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-black"><MessageCircle size={17}/> التواصل مع المدرس</button></div></div>
    <section className={`${card} overflow-hidden p-6 sm:p-8`}><div className="flex flex-wrap items-start justify-between gap-6"><div><p className="text-xs font-black text-amber-300">تقرير ولي الأمر</p><h1 className="mt-2 text-3xl font-black">{report.student.full_name}</h1><p className="mt-2 text-sm text-slate-400">{report.student.grade_name || 'الصف غير محدد'} {report.student.group_name ? `• ${report.student.group_name}` : ''}</p></div><div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-center"><p className="text-xs text-slate-400">كود الطالب</p><b className="text-lg text-emerald-300">{report.student.student_code}</b></div></div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[['متوسط الاختبارات',`${report.summary.exam_average}%`],['الاختبارات',report.summary.exams_count],['الواجبات المسلّمة',report.summary.assignments_submitted],['نسبة الحضور',`${report.summary.attendance_rate}%`],['وقت المذاكرة',`${Math.round(report.summary.study_minutes/60)} س`]].map(([a,b])=><div key={a} className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"><p className="text-xs text-slate-500">{a}</p><p className="mt-2 text-2xl font-black">{b}</p></div>)}</div>
    </section>
    <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className={`${card} p-6`}><h2 className="flex items-center gap-2 font-black"><TrendingUp size={19} className="text-emerald-400"/> نقاط القوة</h2><div className="mt-4 space-y-3">{report.strengths.length ? report.strengths.map(x=><p key={x} className="rounded-2xl bg-emerald-400/5 p-3 text-sm text-slate-300">{x}</p>) : <p className="text-sm text-slate-500">سيظهر التحليل مع تراكم بيانات أكثر.</p>}</div></section><section className={`${card} p-6`}><h2 className="flex items-center gap-2 font-black"><TrendingDown size={19} className="text-amber-400"/> يحتاج إلى اهتمام</h2><div className="mt-4 space-y-3">{report.needs_attention.map(x=><p key={x} className="rounded-2xl bg-amber-400/5 p-3 text-sm text-slate-300">{x}</p>)}</div></section></div>
    <section className={`${card} mt-5 p-6`}><h2 className="font-black">خطة مقترحة لولي الأمر</h2><div className="mt-4 grid gap-3">{report.recommendations.map((x,i)=><div key={x} className="flex gap-3 rounded-2xl bg-white/[0.03] p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-black">{i+1}</span><p className="text-sm leading-7 text-slate-300">{x}</p></div>)}</div></section>
    <section className={`${card} mt-5 p-6`}><h2 className="font-black">آخر الاختبارات</h2><div className="mt-4 space-y-2">{report.recent_exams.map(x=><div key={`${x.title}-${x.date}`} className="flex items-center justify-between rounded-2xl bg-white/[0.03] p-4"><div><b>{x.title}</b><p className="mt-1 text-xs text-slate-500">{new Date(x.date).toLocaleDateString('ar-EG')}</p></div><b className="text-lg">{x.score == null ? 'لم تظهر النتيجة' : `${x.score}/${x.max_score}`}</b></div>)}</div></section>
    <p className="mt-6 text-center text-xs text-slate-600 print:hidden">يمكن اختيار «طباعة» ثم «حفظ كـ PDF» من الهاتف أو الكمبيوتر.</p>
  </div></main>;

  return <main dir="rtl" className="min-h-screen bg-[#07090f] px-4 py-6 text-white"><div className="mx-auto flex min-h-[90vh] max-w-xl items-center"><section className={`${card} w-full p-6 sm:p-9`}><div className="mb-8 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-400 text-black"><GraduationCap size={31}/></div><p className="mt-5 text-xs font-black text-amber-300">بوابة ولي الأمر</p><h1 className="mt-2 text-3xl font-black">تابع مستوى ابنك بأمان</h1><p className="mt-3 text-sm leading-7 text-slate-500">لا يوجد تسجيل دخول لولي الأمر. نتحقق من رقم ولي الأمر وكود الطالب ثم نعرض تقريرًا مخصصًا.</p></div><form onSubmit={verify} className="space-y-5"><label className="block"><span className="mb-2 block text-xs font-black text-slate-400">رقم هاتف ولي الأمر</span><input required inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} className={input} placeholder="01012345678"/></label><label className="block"><span className="mb-2 block text-xs font-black text-slate-400">كود الطالب</span><input required value={code} onChange={e=>setCode(e.target.value)} className={`${input} uppercase`} placeholder="AHD-XXXXXXXX"/></label>{error&&<div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm font-bold text-red-300">{error}</div>}<button disabled={loading} className="w-full rounded-2xl bg-amber-400 px-5 py-4 font-black text-black disabled:opacity-50">{loading?'جاري التحقق...':'عرض تقرير الطالب'}</button></form><div className="mt-6 flex items-center justify-between text-xs text-slate-600"><Link to="/" className="hover:text-slate-300">الصفحة الرئيسية</Link><span className="flex items-center gap-1"><ShieldCheck size={14}/> تحقق من البيانات قبل العرض</span></div></section></div></main>;
}

