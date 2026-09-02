import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BookOpen, CalendarDays, Check, ChevronLeft, ClipboardCheck, Clock3, Copy, Edit3, GraduationCap, KeyRound, Plus, Save, Settings, Shield, Trash2, UserCog, Users, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Mode = 'lessons' | 'assignments' | 'exams' | 'grades' | 'attendance' | 'activation-codes' | 'staff' | 'notifications' | 'settings';
type Row = Record<string, any>;

type StatItem = { label: string; value: string };

const META: Record<Mode, { title: string; icon: React.ReactNode; description: string }> = {
  lessons: { title: 'إدارة الدروس', icon: <BookOpen size={20} />, description: 'إدارة الدروس والفيديوهات والملفات وترتيب المحتوى.' },
  assignments: { title: 'إدارة الواجبات', icon: <ClipboardCheck size={20} />, description: 'إنشاء الواجبات وربطها بالصف والمجموعة ومتابعة المواعيد.' },
  exams: { title: 'إدارة الامتحانات', icon: <GraduationCap size={20} />, description: 'إنشاء الامتحانات وإدارتها وربط الأسئلة بها.' },
  grades: { title: 'الدرجات', icon: <GraduationCap size={20} />, description: 'متابعة محاولات الطلاب ونتائج الامتحانات.' },
  attendance: { title: 'الحضور', icon: <CalendarDays size={20} />, description: 'متابعة جلسات الحضور وحالة كل طالب.' },
  'activation-codes': { title: 'أكواد التفعيل', icon: <KeyRound size={20} />, description: 'إنشاء وإلغاء أكواد التفعيل ومتابعة استخدامها.' },
  staff: { title: 'المساعدون والصلاحيات', icon: <UserCog size={20} />, description: 'إدارة المساعدين والصلاحيات الوظيفية.' },
  notifications: { title: 'الإشعارات', icon: <Bell size={20} />, description: 'إرسال الإشعارات ومراجعة سجلها.' },
  settings: { title: 'إعدادات المنصة', icon: <Settings size={20} />, description: 'إعداد بيانات المنصة والتسجيل ووضع الصيانة.' },
};

const inputClass = 'w-full rounded-2xl border border-white/[0.08] bg-[#11151d] px-4 py-3.5 text-sm font-bold text-white outline-none placeholder:text-slate-700 focus:border-sky-500/40';
const cardClass = 'rounded-3xl border border-white/[0.06] bg-[#0d1118]';

function Shell({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  const navigate = useNavigate();
  const meta = META[mode];
  const links: Array<[Mode, string]> = [
    ['lessons', 'الدروس'],
    ['assignments', 'الواجبات'],
    ['exams', 'الامتحانات'],
    ['grades', 'الدرجات'],
    ['attendance', 'الحضور'],
    ['activation-codes', 'أكواد التفعيل'],
    ['staff', 'المساعدون'],
    ['notifications', 'الإشعارات'],
    ['settings', 'الإعدادات'],
  ];
  return (
    <div className="min-h-screen bg-[#07090f] text-white" dir="rtl">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <nav className={`${cardClass} mb-6 flex gap-2 overflow-x-auto p-2`}>
          {links.map(([key, label]) => (
            <button key={key} type="button" onClick={() => navigate(`/admin/${key}`)} className={`whitespace-nowrap rounded-2xl px-3 py-2 text-xs font-black ${key === mode ? 'bg-sky-500/15 text-sky-300' : 'text-slate-500 hover:bg-white/[0.04] hover:text-white'}`}>
              {label}
            </button>
          ))}
        </nav>
        <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-sky-400">{meta.icon}<span>لوحة التحكم / {meta.title}</span></div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{meta.title}</h1>
            <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-500">{meta.description}</p>
          </div>
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 self-start rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-300 hover:text-white"><ChevronLeft size={17} /> الرئيسية</button>
        </header>
        {children}
      </div>
    </div>
  );
}

function Stats({ items }: { items: StatItem[] }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className={`${cardClass} p-4`}>
          <p className="text-xs font-bold text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-black text-white">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function Notice({ message, error = false }: { message: string; error?: boolean }) {
  return <div className={`mb-5 rounded-2xl border px-4 py-3 text-sm font-bold ${error ? 'border-red-500/20 bg-red-500/5 text-red-300' : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'}`}>{message}</div>;
}

function Input({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string }) {
  return <label className="block"><span className="mb-2 block text-xs font-black text-slate-400">{label}</span><input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} type={type} placeholder={placeholder} /></label>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-xs font-black text-slate-400">{label}</span><textarea className={`${inputClass} min-h-28 resize-y`} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-black text-slate-400">{label}</span><select className={`${inputClass} [color-scheme:dark]`} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select></label>;
}

function Button({ children, onClick, secondary = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; secondary?: boolean; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition disabled:opacity-40 ${secondary ? 'border border-white/[0.08] bg-white/[0.035] text-slate-300 hover:text-white' : 'bg-sky-500 text-slate-950 hover:bg-sky-400'}`}>{children}</button>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/[0.08] bg-[#0d1118] shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0d1118]/95 px-5 py-4"><h2 className="font-black">{title}</h2><button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:text-white"><X size={19} /></button></div><div className="p-5 sm:p-7">{children}</div></div></div>;
}

function Empty({ text }: { text: string }) { return <div className={`${cardClass} py-16 text-center text-sm font-bold text-slate-600`}>{text}</div>; }

export default function AdminSuitePage({ mode }: { mode: Mode }) {
  const page = mode === 'lessons' ? <Lessons /> : mode === 'assignments' ? <Assignments /> : mode === 'exams' ? <Exams /> : mode === 'grades' ? <Grades /> : mode === 'attendance' ? <Attendance /> : mode === 'activation-codes' ? <ActivationCodes /> : mode === 'staff' ? <Staff /> : mode === 'notifications' ? <Notifications /> : <SettingsPage />;
  return <Shell mode={mode}>{page}</Shell>;
}

function Lessons() {
  const [courses, setCourses] = useState<Row[]>([]);
  const [chapters, setChapters] = useState<Row[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [course, setCourse] = useState('');
  const [chapter, setChapter] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [video, setVideo] = useState('');
  const [pdf, setPdf] = useState('');
  const [order, setOrder] = useState('1');
  const [status, setStatus] = useState('draft');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [courseResult, chapterResult, lessonResult] = await Promise.all([
      supabase.from('courses').select('id,title').order('display_order'),
      supabase.from('chapters').select('id,course_id,title,display_order').order('display_order'),
      supabase.from('lessons').select('id,chapter_id,title,description,content,video_provider,video_asset_id,pdf_storage_path,status,display_order,published_at,updated_at').order('display_order'),
    ]);
    setCourses(courseResult.data ?? []);
    setChapters(chapterResult.data ?? []);
    setRows(lessonResult.data ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => rows.filter((row) => {
    const matchesChapter = !chapter || row.chapter_id === chapter;
    const matchesSearch = !search || String(row.title ?? '').toLowerCase().includes(search.toLowerCase());
    return matchesChapter && matchesSearch;
  }), [rows, chapter, search]);

  const reset = () => { setEditing(null); setTitle(''); setDescription(''); setContent(''); setVideo(''); setPdf(''); setOrder('1'); setStatus('draft'); setChapter(''); };

  const save = async () => {
    setError('');
    if (!chapter || title.trim().length < 2) { setError('اختر الفصل واكتب اسم الدرس بشكل صحيح'); return; }
    const payload = { chapter_id: chapter, title: title.trim(), description: description.trim() || null, content: content.trim() || null, video_provider: video.trim() ? 'youtube' : null, video_asset_id: video.trim() || null, pdf_storage_path: pdf.trim() || null, status, display_order: Number(order) || 1, published_at: status === 'published' ? new Date().toISOString() : null };
    const result = editing ? await supabase.from('lessons').update(payload).eq('id', editing.id) : await supabase.from('lessons').insert(payload);
    if (result.error) { setError(result.error.message); return; }
    setOpen(false); reset(); await load();
  };

  const edit = (row: Row) => { setEditing(row); setChapter(row.chapter_id ?? ''); setTitle(row.title ?? ''); setDescription(row.description ?? ''); setContent(row.content ?? ''); setVideo(row.video_asset_id ?? ''); setPdf(row.pdf_storage_path ?? ''); setOrder(String(row.display_order ?? 1)); setStatus(row.status ?? 'draft'); setOpen(true); };

  const remove = async (row: Row) => { if (!window.confirm(`حذف الدرس «${row.title}»؟`)) return; const result = await supabase.from('lessons').delete().eq('id', row.id); if (result.error) setError(result.error.message); else await load(); };

  const visibleChapters = chapters.filter((item) => !course || item.course_id === course);
  const stats: StatItem[] = [
    { label: 'الكورسات', value: String(courses.length) },
    { label: 'الفصول', value: String(chapters.length) },
    { label: 'الدروس', value: String(rows.length) },
    { label: 'المنشور', value: String(rows.filter((row) => row.status === 'published').length) },
  ];

  return <>
    <Stats items={stats} />
    {error && <Notice message={error} error />}
    <div className="mb-5 grid gap-3 lg:grid-cols-3"><Input label="بحث" value={search} onChange={setSearch} placeholder="ابحث باسم الدرس" /><Select label="الكورس" value={course} onChange={(value) => { setCourse(value); setChapter(''); }}><option value="">كل الكورسات</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select><Select label="الفصل" value={chapter} onChange={setChapter}><option value="">كل الفصول</option>{visibleChapters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select></div>
    <div className="mb-5 flex justify-end"><Button onClick={() => { reset(); setOpen(true); }}><Plus size={17} /> إضافة درس</Button></div>
    <div className="grid gap-3">{filtered.length === 0 ? <Empty text="لا توجد دروس" /> : filtered.map((row) => <div key={row.id} className={`${cardClass} p-4`}><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black">{row.title}</h3><p className="mt-1 text-xs text-slate-500">{row.description || 'بدون وصف'} • {row.status}</p></div><div className="flex gap-2"><Button secondary onClick={() => edit(row)}><Edit3 size={15} /> تعديل</Button><Button secondary onClick={() => void remove(row)}><Trash2 size={15} /> حذف</Button></div></div></div>)}</div>
    {open && <Modal title={editing ? 'تعديل الدرس' : 'إضافة درس'} onClose={() => { setOpen(false); reset(); }}><div className="grid gap-4"><Select label="الفصل" value={chapter} onChange={setChapter}><option value="">اختر الفصل</option>{chapters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select><Input label="اسم الدرس" value={title} onChange={setTitle} /><Textarea label="الوصف" value={description} onChange={setDescription} /><Textarea label="المحتوى" value={content} onChange={setContent} /><Input label="YouTube Video ID" value={video} onChange={setVideo} /><Input label="مسار PDF" value={pdf} onChange={setPdf} /><div className="grid gap-4 sm:grid-cols-2"><Input label="الترتيب" value={order} onChange={setOrder} type="number" /><Select label="الحالة" value={status} onChange={setStatus}><option value="draft">مسودة</option><option value="published">منشور</option><option value="archived">مؤرشف</option></Select></div><div className="flex justify-end gap-2"><Button secondary onClick={() => { setOpen(false); reset(); }}>إلغاء</Button><Button onClick={() => void save()}><Save size={16} /> حفظ</Button></div></div></Modal>}
  </>;
}

function Assignments() {
  const [rows, setRows] = useState<Row[]>([]);
  const [grades, setGrades] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [grade, setGrade] = useState('');
  const [group, setGroup] = useState('');
  const [score, setScore] = useState('100');
  const [deadline, setDeadline] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [a, g, gr] = await Promise.all([
      supabase.from('assignments').select('*').order('deadline', { ascending: true }),
      supabase.from('grades').select('id,name').eq('is_active', true).order('display_order'),
      supabase.from('groups').select('id,name,grade_id').eq('is_active', true).order('name'),
    ]);
    setRows(a.data ?? []); setGrades(g.data ?? []); setGroups(gr.data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const reset = () => { setEditing(null); setTitle(''); setDescription(''); setGrade(''); setGroup(''); setScore('100'); setDeadline(''); };
  const save = async () => {
    setError('');
    if (title.trim().length < 2 || !grade || Number(score) <= 0) { setError('أكمل بيانات الواجب'); return; }
    const payload = { title: title.trim(), description: description.trim() || null, grade_id: grade, group_id: group || null, max_score: Number(score), deadline: deadline || null };
    const result = editing ? await supabase.from('assignments').update(payload).eq('id', editing.id) : await supabase.from('assignments').insert(payload);
    if (result.error) { setError(result.error.message); return; }
    setOpen(false); reset(); await load();
  };
  const edit = (row: Row) => { setEditing(row); setTitle(row.title ?? ''); setDescription(row.description ?? ''); setGrade(row.grade_id ?? ''); setGroup(row.group_id ?? ''); setScore(String(row.max_score ?? 100)); setDeadline(row.deadline ? String(row.deadline).slice(0, 16) : ''); setOpen(true); };
  return <>
    <Stats items={[{ label: 'الواجبات', value: String(rows.length) }, { label: 'الدرجات', value: String(rows.reduce((sum, row) => sum + Number(row.max_score || 0), 0)) }, { label: 'بمواعيد', value: String(rows.filter((row) => row.deadline).length) }, { label: 'التسليمات', value: 'مرتبطة بالطلاب' }]} />
    {error && <Notice message={error} error />}
    <div className="mb-5 flex justify-end"><Button onClick={() => { reset(); setOpen(true); }}><Plus size={17} /> واجب جديد</Button></div>
    <div className="grid gap-3">{rows.length === 0 ? <Empty text="لا توجد واجبات" /> : rows.map((row) => <div key={row.id} className={`${cardClass} p-4`}><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black">{row.title}</h3><p className="mt-1 text-xs text-slate-500">{row.max_score} درجة • {row.deadline ? new Date(row.deadline).toLocaleString('ar-EG') : 'بدون موعد'}</p></div><Button secondary onClick={() => edit(row)}><Edit3 size={15} /> تعديل</Button></div></div>)}</div>
    {open && <Modal title={editing ? 'تعديل الواجب' : 'إنشاء واجب'} onClose={() => { setOpen(false); reset(); }}><div className="grid gap-4"><Input label="العنوان" value={title} onChange={setTitle} /><Textarea label="الوصف" value={description} onChange={setDescription} /><div className="grid gap-4 sm:grid-cols-2"><Select label="الصف" value={grade} onChange={(value) => { setGrade(value); setGroup(''); }}><option value="">اختر الصف</option>{grades.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Select label="المجموعة" value={group} onChange={setGroup}><option value="">كل المجموعات</option>{groups.filter((item) => item.grade_id === grade).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div><div className="grid gap-4 sm:grid-cols-2"><Input label="الدرجة" value={score} onChange={setScore} type="number" /><Input label="الموعد النهائي" value={deadline} onChange={setDeadline} type="datetime-local" /></div><div className="flex justify-end gap-2"><Button secondary onClick={() => { setOpen(false); reset(); }}>إلغاء</Button><Button onClick={() => void save()}><Save size={16} /> حفظ</Button></div></div></Modal>}
  </>;
}

function Exams() {
  const [rows, setRows] = useState<Row[]>([]);
  const [grades, setGrades] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [grade, setGrade] = useState('');
  const [group, setGroup] = useState('');
  const [duration, setDuration] = useState('60');
  const [maxScore, setMaxScore] = useState('100');
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const [e, g, gr] = await Promise.all([
      supabase.from('exams').select('*').order('starts_at', { ascending: false }),
      supabase.from('grades').select('id,name').eq('is_active', true).order('display_order'),
      supabase.from('groups').select('id,name,grade_id').eq('is_active', true),
    ]);
    setRows(e.data ?? []); setGrades(g.data ?? []); setGroups(gr.data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const reset = () => { setEditing(null); setTitle(''); setDescription(''); setGrade(''); setGroup(''); setDuration('60'); setMaxScore('100'); setStarts(''); setEnds(''); };
  const save = async () => {
    setError('');
    if (title.trim().length < 2 || !grade || Number(duration) < 1 || Number(maxScore) <= 0) { setError('أكمل بيانات الامتحان'); return; }
    const payload = { title: title.trim(), description: description.trim() || null, grade_id: grade, group_id: group || null, duration_minutes: Number(duration), max_score: Number(maxScore), starts_at: starts || null, ends_at: ends || null };
    const result = editing ? await supabase.from('exams').update(payload).eq('id', editing.id) : await supabase.from('exams').insert(payload);
    if (result.error) { setError(result.error.message); return; }
    setOpen(false); reset(); await load();
  };
  const edit = (row: Row) => { setEditing(row); setTitle(row.title ?? ''); setDescription(row.description ?? ''); setGrade(row.grade_id ?? ''); setGroup(row.group_id ?? ''); setDuration(String(row.duration_minutes ?? 60)); setMaxScore(String(row.max_score ?? 100)); setStarts(row.starts_at ? String(row.starts_at).slice(0, 16) : ''); setEnds(row.ends_at ? String(row.ends_at).slice(0, 16) : ''); setOpen(true); };
  return <>
    <Stats items={[{ label: 'الامتحانات', value: String(rows.length) }, { label: 'المنشور', value: String(rows.filter((row) => row.is_published).length) }, { label: 'المحاولات', value: 'من قاعدة البيانات' }, { label: 'الأسئلة', value: 'مرتبطة بالامتحان' }]} />
    {error && <Notice message={error} error />}
    <div className="mb-5 flex justify-end"><Button onClick={() => { reset(); setOpen(true); }}><Plus size={17} /> امتحان جديد</Button></div>
    <div className="grid gap-3">{rows.length === 0 ? <Empty text="لا توجد امتحانات" /> : rows.map((row) => <div key={row.id} className={`${cardClass} p-4`}><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-black">{row.title}</h3><p className="mt-1 text-xs text-slate-500">{row.duration_minutes} دقيقة • {row.max_score} درجة • {row.is_published ? 'منشور' : 'غير منشور'}</p></div><div className="flex gap-2"><Button secondary onClick={() => edit(row)}><Edit3 size={15} /> تعديل</Button><Button secondary onClick={() => navigate(`/admin/exams/${row.id}/questions`)}><ClipboardCheck size={15} /> الأسئلة</Button></div></div></div>)}</div>
    {open && <Modal title={editing ? 'تعديل الامتحان' : 'إنشاء امتحان'} onClose={() => { setOpen(false); reset(); }}><div className="grid gap-4"><Input label="العنوان" value={title} onChange={setTitle} /><Textarea label="الوصف" value={description} onChange={setDescription} /><div className="grid gap-4 sm:grid-cols-2"><Select label="الصف" value={grade} onChange={(value) => { setGrade(value); setGroup(''); }}><option value="">اختر الصف</option>{grades.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select><Select label="المجموعة" value={group} onChange={setGroup}><option value="">كل المجموعات</option>{groups.filter((item) => item.grade_id === grade).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></div><div className="grid gap-4 sm:grid-cols-3"><Input label="المدة بالدقائق" value={duration} onChange={setDuration} type="number" /><Input label="الدرجة النهائية" value={maxScore} onChange={setMaxScore} type="number" /><Input label="البداية" value={starts} onChange={setStarts} type="datetime-local" /></div><Input label="النهاية" value={ends} onChange={setEnds} type="datetime-local" /><div className="flex justify-end gap-2"><Button secondary onClick={() => { setOpen(false); reset(); }}>إلغاء</Button><Button onClick={() => void save()}><Save size={16} /> حفظ</Button></div></div></Modal>}
  </>;
}

function Grades() {
  const [attempts, setAttempts] = useState<Row[]>([]);
  const [students, setStudents] = useState<Row[]>([]);
  const [exams, setExams] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { void (async () => { const [a, p, e] = await Promise.all([supabase.from('exam_attempts').select('id,exam_id,student_id,attempt_number,started_at,submitted_at,status,score').order('started_at', { ascending: false }), supabase.from('profiles').select('id,full_name,phone').eq('role', 'student'), supabase.from('exams').select('id,title,max_score')]); setAttempts(a.data ?? []); setStudents(p.data ?? []); setExams(e.data ?? []); setLoading(false); })(); }, []);
  const completed = attempts.filter((row) => row.status === 'submitted' && row.score != null);
  const average = completed.length ? completed.reduce((sum, row) => sum + Number(row.score), 0) / completed.length : 0;
  const studentName = (id: string) => students.find((item) => item.id === id)?.full_name ?? id;
  const examTitle = (id: string) => exams.find((item) => item.id === id)?.title ?? '—';
  return <>
    <Stats items={[{ label: 'المحاولات', value: String(attempts.length) }, { label: 'المسلّمة', value: String(completed.length) }, { label: 'المتوسط', value: average.toFixed(1) }, { label: 'طلاب لهم نتائج', value: String(new Set(completed.map((row) => row.student_id)).size) }]} />
    <div className="mb-5"><Input label="بحث" value={search} onChange={setSearch} placeholder="اسم الطالب أو الامتحان" /></div>
    {loading ? <Empty text="جاري تحميل النتائج..." /> : attempts.length === 0 ? <Empty text="لا توجد نتائج بعد" /> : <div className={`${cardClass} overflow-x-auto`}><table className="w-full min-w-[700px] text-right text-sm"><thead className="border-b border-white/[0.06] text-xs text-slate-500"><tr><th className="p-4">الطالب</th><th className="p-4">الامتحان</th><th className="p-4">المحاولة</th><th className="p-4">الدرجة</th><th className="p-4">الحالة</th></tr></thead><tbody>{attempts.filter((row) => { const text = `${studentName(row.student_id)} ${examTitle(row.exam_id)}`.toLowerCase(); return !search || text.includes(search.toLowerCase()); }).map((row) => { const exam = exams.find((item) => item.id === row.exam_id); return <tr key={row.id} className="border-b border-white/[0.04]"><td className="p-4 font-bold">{studentName(row.student_id)}</td><td className="p-4 text-slate-400">{examTitle(row.exam_id)}</td><td className="p-4">{row.attempt_number}</td><td className="p-4 font-black text-sky-300">{row.score ?? '—'} / {exam?.max_score ?? '—'}</td><td className="p-4 text-slate-400">{row.status}</td></tr>; })}</tbody></table></div>}
  </>;
}

function Attendance() {
  const [sessions, setSessions] = useState<Row[]>([]);
  const [groups, setGroups] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [students, setStudents] = useState<Row[]>([]);
  const [records, setRecords] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => { const [s, g] = await Promise.all([supabase.from('sessions').select('*').order('session_date', { ascending: false }), supabase.from('groups').select('id,name').order('name')]); setSessions(s.data ?? []); setGroups(g.data ?? []); }, []);
  useEffect(() => { void load(); }, [load]);
  const openSession = async (session: Row) => { setSelected(session); setError(''); const members = await supabase.from('group_members').select('student_id').eq('group_id', session.group_id).is('ends_at', null); if (members.error) { setError(members.error.message); return; } const ids = (members.data ?? []).map((item) => item.student_id); if (!ids.length) { setStudents([]); setRecords([]); return; } const [p, a] = await Promise.all([supabase.from('profiles').select('id,full_name,phone').in('id', ids), supabase.from('attendance').select('*').eq('session_id', session.id)]); if (p.error) setError(p.error.message); setStudents(p.data ?? []); setRecords(a.data ?? []); };
  const getStatus = (id: string) => records.find((row) => row.student_id === id)?.status ?? 'absent';
  const mark = async (studentId: string, status: string) => { if (!selected) return; const result = await supabase.rpc('mark_attendance', { p_session_id: selected.id, p_student_id: studentId, p_status: status }); if (result.error) setError(result.error.message); else setRecords((current) => { const exists = current.some((row) => row.student_id === studentId); return exists ? current.map((row) => row.student_id === studentId ? { ...row, status } : row) : [...current, { student_id: studentId, status }]; }); };
  return <>
    <Stats items={[{ label: 'الجلسات', value: String(sessions.length) }, { label: 'المجموعات', value: String(groups.length) }, { label: 'الجلسة المحددة', value: selected ? '1' : '0' }, { label: 'السجلات', value: String(records.length) }]} />
    {error && <Notice message={error} error />}
    {sessions.length === 0 ? <Empty text="لا توجد جلسات" /> : <div className="grid gap-3 lg:grid-cols-2">{sessions.map((session) => <button key={session.id} type="button" onClick={() => void openSession(session)} className={`text-right ${cardClass} p-4 ${selected?.id === session.id ? 'border-sky-500/30' : ''}`}><div className="flex items-center justify-between"><div><h3 className="font-black">{groups.find((group) => group.id === session.group_id)?.name ?? 'مجموعة'}</h3><p className="mt-1 text-xs text-slate-500">{session.session_date} • {session.start_time ?? ''}</p></div><Clock3 size={19} className="text-sky-400" /></div></button>)}</div>}
    {selected && <div className={`${cardClass} mt-6 p-5`}><div className="mb-5 flex items-center justify-between"><h2 className="font-black">طلاب الجلسة</h2><Button secondary onClick={() => setSelected(null)}>إغلاق</Button></div><div className="grid gap-2">{students.length === 0 ? <Empty text="لا يوجد طلاب في المجموعة" /> : students.map((student) => <div key={student.id} className="flex flex-col gap-3 rounded-2xl bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">{student.full_name}</p><p className="text-xs text-slate-600">{student.phone ?? '—'}</p></div><div className="flex gap-2">{['present', 'late', 'absent', 'excused'].map((status) => <button key={status} type="button" onClick={() => void mark(student.id, status)} className={`rounded-xl px-3 py-2 text-xs font-black ${getStatus(student.id) === status ? 'bg-sky-500 text-slate-950' : 'bg-white/[0.04] text-slate-500'}`}>{status === 'present' ? 'حاضر' : status === 'late' ? 'متأخر' : status === 'absent' ? 'غائب' : 'معذور'}</button>)}</div></div>)}</div></div>}
  </>;
}

function ActivationCodes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [uses, setUses] = useState('1');
  const [expires, setExpires] = useState('');
  const [newCode, setNewCode] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => { const result = await supabase.from('activation_codes').select('*').order('created_at', { ascending: false }); if (result.error) setError(result.error.message); else setRows(result.data ?? []); }, []);
  useEffect(() => { void load(); }, [load]);
  const generate = async () => { setError(''); const result = await supabase.rpc('create_activation_code', { p_max_uses: Number(uses), p_expires_at: expires || null }); if (result.error) setError(result.error.message); else { setNewCode(String(result.data)); await load(); } };
  const revoke = async (id: string) => { const result = await supabase.rpc('revoke_activation_code', { p_code_id: id }); if (result.error) setError(result.error.message); else await load(); };
  return <>
    <Stats items={[{ label: 'إجمالي الأكواد', value: String(rows.length) }, { label: 'نشطة', value: String(rows.filter((row) => row.is_active).length) }, { label: 'مستخدمة', value: String(rows.filter((row) => Number(row.used_count) > 0).length) }, { label: 'منتهية', value: String(rows.filter((row) => row.expires_at && new Date(row.expires_at) < new Date()).length) }]} />
    <div className={`${cardClass} mb-6 p-5`}><h2 className="mb-4 font-black">إنشاء كود تفعيل</h2><div className="grid gap-4 sm:grid-cols-2"><Input label="عدد الاستخدامات" value={uses} onChange={setUses} type="number" /><Input label="تاريخ الانتهاء" value={expires} onChange={setExpires} type="datetime-local" /></div><div className="mt-4 flex justify-end"><Button onClick={() => void generate()}><KeyRound size={16} /> توليد</Button></div>{newCode && <div className="mt-4 flex items-center justify-between rounded-2xl bg-emerald-500/5 p-4"><span className="font-mono text-xl font-black tracking-widest">{newCode}</span><Button secondary onClick={() => void navigator.clipboard?.writeText(newCode)}><Copy size={15} /> نسخ</Button></div>}</div>
    {error && <Notice message={error} error />}
    {rows.length === 0 ? <Empty text="لا توجد أكواد" /> : <div className="grid gap-3">{rows.map((row) => <div key={row.id} className={`${cardClass} flex items-center justify-between p-4`}><div><p className="font-mono font-black tracking-widest">{row.code}</p><p className="mt-1 text-xs text-slate-500">{row.used_count}/{row.max_uses}</p></div>{row.is_active ? <Button secondary onClick={() => void revoke(row.id)}>إلغاء</Button> : <span className="text-xs font-black text-slate-600">ملغى</span>}</div>)}</div>}
  </>;
}

function Staff() {
  const permissionsList = ['students', 'groups', 'courses', 'lessons', 'assignments', 'exams', 'grades', 'attendance', 'notifications'];
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [selected, setSelected] = useState('');
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => { const [s, p] = await Promise.all([supabase.from('staff_members').select('*').order('created_at', { ascending: false }), supabase.from('profiles').select('id,full_name,phone,role,is_active').order('full_name')]); setRows(s.data ?? []); setProfiles((p.data ?? []).filter((item) => item.role === 'student' || item.role === 'admin')); }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => { if (!selected || name.trim().length < 2) { setError('اختر مستخدمًا واكتب الاسم'); return; } const result = await supabase.from('staff_members').upsert({ user_id: selected, display_name: name.trim(), permissions: Object.fromEntries(permissionsList.map((permission) => [permission, permissions.includes(permission)])), is_active: true }); if (result.error) setError(result.error.message); else { setError(''); setSelected(''); setName(''); setPermissions([]); await load(); } };
  return <>
    <Stats items={[{ label: 'المساعدون', value: String(rows.length) }, { label: 'النشطون', value: String(rows.filter((row) => row.is_active).length) }, { label: 'الصلاحيات', value: String(permissionsList.length) }, { label: 'الأمان', value: 'RLS + DB' }]} />
    <div className={`${cardClass} mb-6 p-5`}><h2 className="mb-4 font-black">إضافة / تحديث مساعد</h2><div className="grid gap-4"><Select label="المستخدم" value={selected} onChange={setSelected}><option value="">اختر حسابًا</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name} — {profile.phone ?? 'بدون هاتف'}</option>)}</Select><Input label="اسم العرض" value={name} onChange={setName} /><div><p className="mb-3 text-xs font-black text-slate-400">الصلاحيات</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{permissionsList.map((permission) => <button key={permission} type="button" onClick={() => setPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission])} className={`rounded-xl px-3 py-2 text-xs font-black ${permissions.includes(permission) ? 'bg-sky-500 text-slate-950' : 'bg-white/[0.04] text-slate-500'}`}>{permission}</button>)}</div></div><div className="flex justify-end"><Button onClick={() => void save()}><Shield size={16} /> حفظ الصلاحيات</Button></div></div></div>
    {error && <Notice message={error} error />}
    {rows.length === 0 ? <Empty text="لا يوجد مساعدين" /> : <div className="grid gap-3">{rows.map((row) => { const activePermissions = Object.entries(row.permissions ?? {}).filter((entry) => Boolean(entry[1])).map((entry) => entry[0]); return <div key={row.user_id} className={`${cardClass} p-4`}><div className="flex items-center justify-between"><div><p className="font-black">{row.display_name}</p><p className="mt-1 text-xs text-slate-500">{activePermissions.join(' • ') || 'بدون صلاحيات'}</p></div><span className="text-xs font-black text-emerald-400">{row.is_active ? 'نشط' : 'متوقف'}</span></div></div>; })}</div>}
  </>;
}

function Notifications() {
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [recipient, setRecipient] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [error, setError] = useState('');
  const load = useCallback(async () => { const [n, p] = await Promise.all([supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100), supabase.from('profiles').select('id,full_name,phone').eq('role', 'student').order('full_name')]); setRows(n.data ?? []); setProfiles(p.data ?? []); }, []);
  useEffect(() => { void load(); }, [load]);
  const send = async () => { if (!title.trim() || !message.trim()) { setError('اكتب عنوان ورسالة'); return; } const result = await supabase.from('notifications').insert({ recipient_id: recipient || null, title: title.trim(), message: message.trim(), type }); if (result.error) setError(result.error.message); else { setError(''); setTitle(''); setMessage(''); setRecipient(''); await load(); } };
  return <>
    <Stats items={[{ label: 'الإشعارات', value: String(rows.length) }, { label: 'غير مقروء', value: String(rows.filter((row) => !row.is_read).length) }, { label: 'فردية', value: String(rows.filter((row) => row.recipient_id).length) }, { label: 'عامة', value: String(rows.filter((row) => !row.recipient_id).length) }]} />
    <div className={`${cardClass} mb-6 p-5`}><h2 className="mb-4 font-black">إرسال إشعار</h2><div className="grid gap-4"><Select label="المستلم" value={recipient} onChange={setRecipient}><option value="">كل الطلاب</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}</Select><div className="grid gap-4 sm:grid-cols-2"><Input label="العنوان" value={title} onChange={setTitle} /><Select label="النوع" value={type} onChange={setType}><option value="info">معلومة</option><option value="success">نجاح</option><option value="warning">تنبيه</option></Select></div><Textarea label="الرسالة" value={message} onChange={setMessage} /><div className="flex justify-end"><Button onClick={() => void send()}><Bell size={16} /> إرسال</Button></div></div></div>
    {error && <Notice message={error} error />}
    {rows.length === 0 ? <Empty text="لا توجد إشعارات" /> : <div className="grid gap-3">{rows.map((row) => <div key={row.id} className={`${cardClass} p-4`}><p className="font-black">{row.title}</p><p className="mt-1 text-sm text-slate-400">{row.message}</p><p className="mt-2 text-[11px] text-slate-600">{row.created_at ? new Date(row.created_at).toLocaleString('ar-EG') : ''}</p></div>)}</div>}
  </>;
}

function SettingsPage() {
  const [form, setForm] = useState<Row>({ platform_name: '', teacher_name: '', support_phone: '', support_email: '', logo_url: '', welcome_message: '', maintenance_mode: false, allow_registration: true });
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => { void (async () => { const result = await supabase.from('platform_settings').select('*').eq('id', true).maybeSingle(); if (result.error) setError(result.error.message); else if (result.data) setForm(result.data); })(); }, []);
  const update = (key: string, value: any) => setForm((current: Row) => ({ ...current, [key]: value }));
  const save = async () => { const result = await supabase.from('platform_settings').upsert({ ...form, id: true }); if (result.error) setError(result.error.message); else { setError(''); setSaved(true); window.setTimeout(() => setSaved(false), 2500); } };
  return <div className="max-w-3xl"><div className={`${cardClass} p-5 sm:p-7`}><div className="grid gap-5"><Input label="اسم المنصة" value={form.platform_name ?? ''} onChange={(value) => update('platform_name', value)} /><Input label="اسم المدرس" value={form.teacher_name ?? ''} onChange={(value) => update('teacher_name', value)} /><div className="grid gap-5 sm:grid-cols-2"><Input label="هاتف الدعم" value={form.support_phone ?? ''} onChange={(value) => update('support_phone', value)} /><Input label="بريد الدعم" value={form.support_email ?? ''} onChange={(value) => update('support_email', value)} /></div><Input label="رابط الشعار" value={form.logo_url ?? ''} onChange={(value) => update('logo_url', value)} /><Textarea label="رسالة الترحيب" value={form.welcome_message ?? ''} onChange={(value) => update('welcome_message', value)} /><div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={() => update('allow_registration', !form.allow_registration)} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-right"><b className="block text-sm">السماح بالتسجيل</b><span className="text-xs text-slate-500">{form.allow_registration ? 'مفعل' : 'متوقف'}</span></button><button type="button" onClick={() => update('maintenance_mode', !form.maintenance_mode)} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 text-right"><b className="block text-sm">وضع الصيانة</b><span className="text-xs text-slate-500">{form.maintenance_mode ? 'مفعل' : 'متوقف'}</span></button></div><div className="flex justify-end"><Button onClick={() => void save()}><Save size={16} /> حفظ الإعدادات</Button></div>{saved && <Notice message="تم حفظ الإعدادات بنجاح" />}{error && <Notice message={error} error />}</div></div></div>;
}
