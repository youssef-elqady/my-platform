import React from 'react';
import { BarChart3, BookOpen, ChevronRight, ClipboardList, FileText, GraduationCap, Home, LayoutDashboard, Users, UserCog, Bell, Settings, CalendarCheck, KeyRound } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const items = [
  ['/admin','لوحة الإدارة',LayoutDashboard], ['/admin/students','الطلاب',Users], ['/admin/groups','المجموعات',UserCog], ['/admin/courses','الكورسات',BookOpen], ['/admin/lessons','الدروس',FileText], ['/admin/assignments','الواجبات',ClipboardList], ['/admin/exams','الامتحانات',GraduationCap], ['/admin/grades','الدرجات',BarChart3], ['/admin/attendance','الحضور',CalendarCheck], ['/admin/activation-codes','أكواد التفعيل',KeyRound], ['/admin/staff','المساعدون',UserCog], ['/admin/notifications','الإشعارات',Bell], ['/admin/settings','الإعدادات',Settings]
] as const;

export default function AdminWorkspace({ children }: { children: React.ReactNode }) {
  const location=useLocation(); const navigate=useNavigate();
  return <div dir="rtl" className="min-h-screen bg-[#07090f] text-white"><header className="sticky top-0 z-[80] border-b border-white/[0.07] bg-[#07090f]/95 backdrop-blur-xl"><div className="mx-auto flex max-w-[1700px] items-center gap-3 overflow-x-auto px-4 py-3 sm:px-6"><button onClick={()=>navigate('/admin')} className="flex shrink-0 items-center gap-2 rounded-2xl bg-amber-400 px-4 py-2.5 text-sm font-black text-black"><span>أ</span><span className="hidden sm:inline">لوحة المدرس</span></button>{items.map(([path,label,Icon])=>{const active=location.pathname===path || (path!=='/admin'&&location.pathname.startsWith(path));return <button key={path} onClick={()=>navigate(path)} className={`flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-black transition ${active?'bg-sky-400/15 text-sky-300':'text-slate-500 hover:bg-white/[0.05] hover:text-white'}`}><Icon size={16}/>{label}</button>})}<button onClick={()=>navigate('/')} className="mr-auto flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2.5 text-xs font-black text-slate-500 hover:text-white"><Home size={16}/> الموقع</button></div></header><div className="mx-auto max-w-[1700px] px-3 py-4 sm:px-6"><button onClick={()=>navigate(-1)} className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-300"><ChevronRight size={15}/> رجوع</button>{children}</div></div>;
}
