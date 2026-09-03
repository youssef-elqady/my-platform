import React,{useEffect,useState} from 'react';
import {BookOpen,CalendarCheck,CheckCircle2,ClipboardCheck,GraduationCap,Target,Bell,PlayCircle,ExternalLink,FileText} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {useAuthStore} from '../store/authStore';

type Row=Record<string,any>; type Section='lessons'|'assignments'|'exams'|'grades'|'attendance'|'notifications';

function youtubeId(value:string){
  const raw=value.trim(); if(!raw)return '';
  if(/^[A-Za-z0-9_-]{11}$/.test(raw))return raw;
  try{
    const u=new URL(raw);
    if(!/(^|\.)youtube(?:-nocookie)?\.com$/.test(u.hostname) && !u.hostname.endsWith('youtu.be'))return '';
    if(u.hostname.endsWith('youtu.be'))return u.pathname.split('/').filter(Boolean)[0]||'';
    const query=u.searchParams.get('v'); if(query)return query;
    const parts=u.pathname.split('/').filter(Boolean);
    const marker=parts.findIndex(p=>p==='embed'||p==='shorts'||p==='live');
    return marker>=0?parts[marker+1]||'':parts.at(-1)||'';
  }catch{return ''}
}

export default function StudentSectionPage({section}:{section:Section}){
  const {profile}=useAuthStore(); const id=profile?.id||'';
  const [rows,setRows]=useState<Row[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  useEffect(()=>{let live=true;(async()=>{
    setLoading(true);setError('');let result:any;
    if(section==='lessons')result=await supabase.from('lessons').select('id,title,description,content,video_provider,video_asset_id,pdf_storage_path,display_order').eq('status','published').order('display_order').limit(200);
    if(section==='assignments')result=await supabase.from('assignment_submissions').select('id,assignment_id,status,submitted_at,score,created_at').eq('student_id',id).order('created_at',{ascending:false});
    if(section==='exams')result=await supabase.from('exams').select('id,title,max_score,starts_at,ends_at,result_mode,pass_percentage').order('starts_at',{ascending:false}).limit(100);
    if(section==='grades')result=await supabase.from('exam_attempts').select('id,exam_id,attempt_number,status,score,submitted_at,created_at').eq('student_id',id).order('created_at',{ascending:false}).limit(100);
    if(section==='attendance')result=await supabase.from('attendance').select('id,session_id,status,marked_at').eq('student_id',id).order('marked_at',{ascending:false}).limit(100);
    if(section==='notifications')result=await supabase.from('notifications').select('id,title,message,type,created_at,is_read,is_consumed').eq('recipient_id',id).order('created_at',{ascending:false}).limit(100);
    if(live){if(result?.error)setError('تعذر تحميل البيانات.');setRows(result?.data||[]);setLoading(false)}
  })();return()=>{live=false}},[id,section]);
  const titles={lessons:['الشرح والمحتوى','الدروس المنشورة والفيديوهات المتاحة لك'],assignments:['تصحيح الواجبات','متابعة ما تم تسليمه والدرجات'],exams:['الامتحانات','الاختبارات المتاحة ونتائج المحاولات'],grades:['درجاتي','سجل نتائجك وتحسن مستواك'],attendance:['سجل الحضور','الحضور المسجل لك بواسطة الإدارة أو المساعدين'],notifications:['الإشعارات','كل جديد يخص حسابك']} as const;
  const [title,sub]=titles[section];
  return <main dir="rtl" className="min-h-screen bg-[#07090f] px-3 py-4 text-white sm:px-6 lg:px-8"><div className="mx-auto max-w-[1200px]">
    <header className="mb-5 rounded-[1.5rem] border border-white/[.07] bg-[#0d1118] p-4 sm:mb-7 sm:rounded-[2rem] sm:p-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-400/10 text-violet-300"><Icon section={section}/></span><div className="min-w-0"><p className="text-[11px] font-black text-violet-300">مساحة الطالب</p><h1 className="mt-1 text-xl font-black sm:text-2xl">{title}</h1><p className="mt-1 text-xs leading-5 text-slate-500">{sub}</p></div></div></header>
    {loading?<div className="rounded-3xl border border-white/[.07] bg-[#0d1118] p-10 text-center text-slate-500">جاري تحميل البيانات...</div>:error?<div className="rounded-3xl border border-red-400/10 bg-[#0d1118] p-8 text-center text-red-300">{error}</div>:rows.length===0?<div className="rounded-3xl border border-dashed border-white/[.08] bg-[#0d1118] p-10 text-center text-slate-500">لا توجد بيانات حتى الآن.</div>:<div className="grid gap-3">{rows.map((r,i)=><RowView key={r.id||i} row={r} section={section}/>)}</div>}
  </div></main>
}
function Icon({section}:{section:Section}){const C={lessons:BookOpen,assignments:ClipboardCheck,exams:GraduationCap,grades:Target,attendance:CalendarCheck,notifications:Bell}[section];return <C size={22}/>}
function RowView({row,section}:{row:Row;section:Section}){
  if(section==='lessons'){
    const id=youtubeId(String(row.video_asset_id||''));
    return <article className="overflow-hidden rounded-3xl border border-white/[.07] bg-[#0d1118] p-4 sm:p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><h3 className="break-words font-black">{row.title}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-400">{row.description||row.content||'درس متاح للمذاكرة.'}</p></div><BookOpen className="shrink-0 text-violet-300" size={20}/></div>{id&&<div className="mt-4 overflow-hidden rounded-2xl border border-white/[.06] bg-black"><div className="aspect-video w-full"><iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&playsinline=1`} title={row.title||'فيديو الشرح'} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/></div></div>}{row.video_asset_id&&!id&&<div className="mt-3 rounded-xl bg-amber-400/5 p-3 text-xs font-bold leading-6 text-amber-300">رابط الفيديو غير صالح. استخدم YouTube Video ID المكون من 11 حرفًا أو رابط YouTube كامل.</div>}{row.pdf_storage_path&&<div className="mt-3 rounded-xl bg-white/[.03] p-3 text-xs font-bold text-slate-300"><FileText className="ml-2 inline" size={15}/>ملف PDF متاح مع الدرس</div>}{id&&<a href={`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs font-black text-violet-300"><PlayCircle size={15}/>فتح الفيديو في YouTube<ExternalLink size={13}/></a>}</article>
  }
  if(section==='assignments')return <article className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/[.07] bg-[#0d1118] p-5"><div><b>واجب #{String(row.assignment_id).slice(0,8)}</b><p className="mt-2 text-xs text-slate-500">{row.submitted_at?new Date(row.submitted_at).toLocaleDateString('ar-EG'):'لم يُسلّم بعد'}</p></div><span className="rounded-full bg-emerald-400/10 px-3 py-2 text-xs font-black text-emerald-300">{row.score!=null?`الدرجة ${row.score}`:row.status}</span></article>;
  if(section==='exams')return <article className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/[.07] bg-[#0d1118] p-5"><div><b>{row.title}</b><p className="mt-2 text-xs text-slate-500">{row.starts_at?new Date(row.starts_at).toLocaleString('ar-EG'):''}</p></div><span className="rounded-full bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-300">من {row.max_score}</span></article>;
  if(section==='grades')return <article className="flex items-center justify-between rounded-3xl border border-white/[.07] bg-[#0d1118] p-5"><div><b>محاولة امتحان</b><p className="mt-2 text-xs text-slate-500">{row.submitted_at?new Date(row.submitted_at).toLocaleDateString('ar-EG'):row.status}</p></div><strong className="text-2xl">{row.score??'—'}</strong></article>;
  if(section==='attendance')return <article className="flex items-center justify-between rounded-3xl border border-white/[.07] bg-[#0d1118] p-5"><div><b>جلسة حضور</b><p className="mt-2 text-xs text-slate-500">{row.marked_at?new Date(row.marked_at).toLocaleDateString('ar-EG'):''}</p></div><span className="font-black text-emerald-300">{row.status}</span></article>;
  return <article className="rounded-3xl border border-white/[.07] bg-[#0d1118] p-5"><b>{row.title}</b><p className="mt-2 text-sm leading-7 text-slate-400">{row.message}</p><p className="mt-2 text-xs text-slate-600">{new Date(row.created_at).toLocaleString('ar-EG')}</p></article>
}
