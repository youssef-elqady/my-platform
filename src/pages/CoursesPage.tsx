import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  Edit3,
  Eye,
  Filter,
  Hash,
  Layers3,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Grade = {
  id: string;
  name: string;
};

type Course = {
  id: string;
  grade_id: string;
  title: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  grade: Grade | null;
  chapter_count: number;
};

type ToastState = {
  message: string;
  type: 'success' | 'error';
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير معروف';
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-1/2 z-[600] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#11151d]/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {toast.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
        </div>
        <p className="flex-1 text-sm font-bold text-white">{toast.message}</p>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white"><X size={17} /></button>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" dir="rtl">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/[0.08] bg-[#0d1118] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0d1118]/95 px-5 py-4 backdrop-blur-xl sm:px-7">
          <h2 className="text-lg font-black text-white">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-white/[0.05] hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-5 sm:p-7">{children}</div>
      </div>
    </div>
  );
}

export default function CoursesPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortOrder, setSortOrder] = useState<'display' | 'newest' | 'oldest' | 'title'>('display');

  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formGradeId, setFormGradeId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formOrder, setFormOrder] = useState('1');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Course | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadGrades = useCallback(async () => {
    const { data, error } = await supabase
      .from('grades')
      .select('id, name')
      .eq('is_active', true)
      .order('display_order', { ascending: true });
    if (error) {
      console.error('Courses grades load error:', error);
      showToast('تعذر تحميل الصفوف الدراسية', 'error');
      return;
    }
    setGrades((data ?? []) as Grade[]);
  }, [showToast]);

  const loadCourses = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);

      const [{ data: courseRows, error: courseError }, { data: chapterRows, error: chapterError }] = await Promise.all([
        supabase
          .from('courses')
          .select(`id, grade_id, title, description, display_order, is_active, created_at, updated_at, grade:grades!courses_grade_id_fkey(id, name)`)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false }),
        supabase
          .from('chapters')
          .select('id, course_id'),
      ]);

      if (courseError) throw courseError;
      if (chapterError) throw chapterError;

      const counts = new Map<string, number>();
      for (const row of chapterRows ?? []) counts.set(row.course_id, (counts.get(row.course_id) ?? 0) + 1);

      const normalized: Course[] = (courseRows ?? []).map((row: any) => ({
        id: row.id,
        grade_id: row.grade_id,
        title: row.title,
        description: row.description ?? null,
        display_order: Number(row.display_order ?? 1),
        is_active: Boolean(row.is_active),
        created_at: row.created_at,
        updated_at: row.updated_at,
        grade: Array.isArray(row.grade) ? row.grade[0] ?? null : row.grade ?? null,
        chapter_count: counts.get(row.id) ?? 0,
      }));
      setCourses(normalized);
    } catch (error) {
      console.error('Courses load error:', error);
      showToast('تعذر تحميل الكورسات', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    void Promise.all([loadGrades(), loadCourses()]);
  }, [loadGrades, loadCourses]);

  const filteredCourses = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ar-EG');
    const result = courses.filter((course) => {
      const matchesSearch = !query || course.title.toLocaleLowerCase('ar-EG').includes(query) || (course.description ?? '').toLocaleLowerCase('ar-EG').includes(query) || (course.grade?.name ?? '').toLocaleLowerCase('ar-EG').includes(query);
      const matchesGrade = gradeFilter === 'all' || course.grade_id === gradeFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? course.is_active : !course.is_active);
      return matchesSearch && matchesGrade && matchesStatus;
    });

    return result.sort((a, b) => {
      if (sortOrder === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortOrder === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortOrder === 'title') return a.title.localeCompare(b.title, 'ar');
      return a.display_order - b.display_order || a.title.localeCompare(b.title, 'ar');
    });
  }, [courses, search, gradeFilter, statusFilter, sortOrder]);

  const stats = useMemo(() => ({
    total: courses.length,
    active: courses.filter((course) => course.is_active).length,
    inactive: courses.filter((course) => !course.is_active).length,
    chapters: courses.reduce((sum, course) => sum + course.chapter_count, 0),
  }), [courses]);

  const resetForm = () => {
    setFormTitle('');
    setFormGradeId('');
    setFormDescription('');
    setFormOrder('1');
  };

  const openCreate = () => {
    resetForm();
    setEditingCourse(null);
    setFormOrder(String(Math.max(1, courses.length + 1)));
    setFormOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    setFormTitle(course.title);
    setFormGradeId(course.grade_id);
    setFormDescription(course.description ?? '');
    setFormOrder(String(course.display_order));
    setOpenMenuId(null);
    setFormOpen(true);
  };

  const saveCourse = async () => {
    const title = formTitle.trim();
    const displayOrder = Number(formOrder);
    if (title.length < 2 || title.length > 150) {
      showToast('اسم الكورس يجب أن يكون بين حرفين و150 حرفًا', 'error');
      return;
    }
    if (!formGradeId) {
      showToast('اختر الصف الدراسي', 'error');
      return;
    }
    if (!Number.isInteger(displayOrder) || displayOrder < 1) {
      showToast('ترتيب الكورس يجب أن يكون رقمًا صحيحًا أكبر من صفر', 'error');
      return;
    }

    try {
      setSaving(true);
      const result = editingCourse
        ? await supabase.rpc('update_course', {
            p_course_id: editingCourse.id,
            p_grade_id: formGradeId,
            p_title: title,
            p_description: formDescription.trim() || null,
            p_display_order: displayOrder,
          })
        : await supabase.rpc('create_course', {
            p_grade_id: formGradeId,
            p_title: title,
            p_description: formDescription.trim() || null,
            p_display_order: displayOrder,
          });

      if (result.error) throw result.error;
      showToast(editingCourse ? 'تم تعديل الكورس بنجاح' : 'تم إنشاء الكورس بنجاح');
      setFormOpen(false);
      setEditingCourse(null);
      resetForm();
      await loadCourses(true);
    } catch (error: any) {
      console.error('Save course error:', error);
      const message = String(error?.message ?? '');
      if (message.toLowerCase().includes('already exists') || message.includes('courses_grade_title_ci_unique_idx')) {
        showToast('يوجد بالفعل كورس بنفس الاسم في هذا الصف', 'error');
      } else {
        showToast(editingCourse ? 'تعذر تعديل الكورس' : 'تعذر إنشاء الكورس', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleCourse = async (course: Course) => {
    try {
      setBusyCourseId(course.id);
      setOpenMenuId(null);
      const { error } = await supabase.rpc('set_course_active', {
        p_course_id: course.id,
        p_is_active: !course.is_active,
      });
      if (error) throw error;
      setCourses((current) => current.map((item) => item.id === course.id ? { ...item, is_active: !course.is_active, updated_at: new Date().toISOString() } : item));
      showToast(course.is_active ? 'تم تعطيل الكورس' : 'تم تفعيل الكورس');
    } catch (error) {
      console.error('Toggle course error:', error);
      showToast('تعذر تغيير حالة الكورس', 'error');
    } finally {
      setBusyCourseId(null);
    }
  };

  const deleteCourse = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const { error } = await supabase.rpc('delete_course', { p_course_id: deleteTarget.id });
      if (error) throw error;
      setCourses((current) => current.filter((course) => course.id !== deleteTarget.id));
      showToast('تم حذف الكورس نهائيًا');
      setDeleteTarget(null);
    } catch (error: any) {
      console.error('Delete course error:', error);
      const message = String(error?.message ?? '');
      if (message.toLowerCase().includes('has chapters') || message.toLowerCase().includes('deactivate it')) {
        showToast('لا يمكن حذف كورس يحتوي على فصول. عطّله بدلًا من حذفه.', 'error');
      } else {
        showToast('تعذر حذف الكورس', 'error');
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090f] text-white" dir="rtl" onClick={() => setOpenMenuId(null)}>
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold text-sky-400">
              <BookOpen size={17} />
              <span>لوحة التحكم / الكورسات</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">إدارة الكورسات</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-500">إدارة كورسات المنصة وربطها بالصفوف الدراسية وترتيبها وتفعيلها أو تعطيلها، مع متابعة عدد الفصول المرتبطة بكل كورس.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate('/admin/groups')} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.06]">المجموعات</button>
            <button type="button" onClick={() => void loadCourses(true)} disabled={refreshing} className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.06] disabled:opacity-50"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> تحديث</button>
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-sky-500/10 hover:bg-sky-400"><Plus size={18} /> إضافة كورس</button>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ['إجمالي الكورسات', stats.total, BookOpen, 'كل الكورسات'],
            ['الكورسات النشطة', stats.active, ToggleRight, 'متاحة للطلاب حسب الصلاحيات'],
            ['الكورسات المعطلة', stats.inactive, ToggleLeft, 'غير متاحة حاليًا'],
            ['إجمالي الفصول', stats.chapters, Layers3, 'الفصول المرتبطة بالكورسات'],
          ].map(([label, value, Icon, description]) => (
            <div key={String(label)} className="rounded-3xl border border-white/[0.07] bg-white/[0.035] p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.05] text-sky-400"><Icon size={20} /></div><span className="text-xs font-bold text-slate-600">{String(description)}</span></div>
              <p className="mt-4 text-2xl font-black">{Number(value).toLocaleString('ar-EG')}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{String(label)}</p>
            </div>
          ))}
        </section>

        <section className="mb-6 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px_180px]">
            <label className="relative block">
              <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث باسم الكورس أو الوصف أو الصف..." className="w-full rounded-2xl border border-white/[0.07] bg-black/20 py-3.5 pl-4 pr-11 text-sm text-white outline-none placeholder:text-slate-700 focus:border-sky-500/40" />
            </label>
            <div className="relative"><Filter size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" /><select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} className="w-full appearance-none rounded-2xl border border-white/[0.07] bg-black/20 py-3.5 pl-10 pr-11 text-sm font-bold text-slate-300 outline-none"><option value="all">كل الصفوف</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" /></div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')} className="rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3.5 text-sm font-bold text-slate-300 outline-none"><option value="all">كل الحالات</option><option value="active">نشطة فقط</option><option value="inactive">معطلة فقط</option></select>
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)} className="rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3.5 text-sm font-bold text-slate-300 outline-none"><option value="display">الترتيب الدراسي</option><option value="newest">الأحدث</option><option value="oldest">الأقدم</option><option value="title">الاسم أبجديًا</option></select>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-600"><span>نتائج العرض: {filteredCourses.length.toLocaleString('ar-EG')}</span><span>يتم حفظ التغييرات من خلال وظائف قاعدة بيانات مؤمنة</span></div>
        </section>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><div className="h-56 animate-pulse rounded-3xl border border-white/[0.05] bg-white/[0.025]" /><div className="h-56 animate-pulse rounded-3xl border border-white/[0.05] bg-white/[0.025]" /><div className="hidden h-56 animate-pulse rounded-3xl border border-white/[0.05] bg-white/[0.025] xl:block" /></div>
        ) : filteredCourses.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-white/[0.09] bg-white/[0.02] px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-sky-500/10 text-sky-400"><BookOpen size={28} /></div>
            <h2 className="mt-5 text-xl font-black">لا توجد كورسات مطابقة</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-600">ابدأ بإنشاء أول كورس أو غيّر الفلاتر الحالية.</p>
            <button type="button" onClick={openCreate} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-sky-500 px-5 py-3 text-sm font-black text-slate-950"><Plus size={17} /> إضافة كورس</button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((course) => (
              <article key={course.id} className="group relative overflow-hidden rounded-[2rem] border border-white/[0.07] bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:border-white/[0.12]">
                <div className="absolute -left-12 -top-12 h-36 w-36 rounded-full bg-sky-500/10 blur-3xl" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-black/20 text-sky-400"><BookOpen size={21} /></div>
                      <div><p className="text-xs font-black text-sky-400">{course.grade?.name ?? 'بدون صف'}</p><p className="mt-1 text-xs text-slate-600">ترتيب #{course.display_order}</p></div>
                    </div>
                    <div className="relative" onClick={(event) => event.stopPropagation()}>
                      <button type="button" onClick={() => setOpenMenuId((current) => current === course.id ? null : course.id)} className="rounded-xl p-2 text-slate-500 hover:bg-white/[0.05] hover:text-white"><MoreVertical size={18} /></button>
                      {openMenuId === course.id && <div className="absolute left-0 top-11 z-30 w-48 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#11151d] p-1.5 shadow-2xl">
                        <button type="button" onClick={() => openEdit(course)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-bold text-slate-300 hover:bg-white/[0.05] hover:text-white"><Edit3 size={16} /> تعديل الكورس</button>
                        <button type="button" onClick={() => void toggleCourse(course)} disabled={busyCourseId === course.id} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-bold text-slate-300 hover:bg-white/[0.05] hover:text-white disabled:opacity-50">{course.is_active ? <ToggleLeft size={16} /> : <ToggleRight size={16} />}{course.is_active ? 'تعطيل الكورس' : 'تفعيل الكورس'}</button>
                        <button type="button" onClick={() => { setDeleteTarget(course); setOpenMenuId(null); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-bold text-red-400 hover:bg-red-500/10"><Trash2 size={16} /> حذف نهائي</button>
                      </div>}
                    </div>
                  </div>

                  <h2 className="mt-5 line-clamp-2 text-xl font-black leading-8 text-white">{course.title}</h2>
                  <p className="mt-2 min-h-12 line-clamp-2 text-sm leading-6 text-slate-500">{course.description || 'لا يوجد وصف لهذا الكورس حتى الآن.'}</p>

                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-white/[0.06] bg-black/15 p-3"><div className="flex items-center gap-2 text-xs font-bold text-slate-600"><Layers3 size={14} /> الفصول</div><p className="mt-1 text-lg font-black text-white">{course.chapter_count.toLocaleString('ar-EG')}</p></div>
                    <div className="rounded-2xl border border-white/[0.06] bg-black/15 p-3"><div className="flex items-center gap-2 text-xs font-bold text-slate-600"><Hash size={14} /> آخر تحديث</div><p className="mt-1 truncate text-sm font-black text-white">{formatDate(course.updated_at)}</p></div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
                    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black ${course.is_active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-slate-500/20 bg-slate-500/10 text-slate-400'}`}><span className={`h-1.5 w-1.5 rounded-full ${course.is_active ? 'bg-emerald-400' : 'bg-slate-500'}`} />{course.is_active ? 'نشط' : 'معطل'}</span>
                    <button type="button" onClick={() => showToast('إدارة الدروس ستتصل بهذه الصفحة في مرحلة Lessons القادمة')} className="inline-flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2 text-xs font-black text-slate-400 hover:bg-white/[0.05] hover:text-white"><Eye size={15} /> محتوى الكورس</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {formOpen && <Modal title={editingCourse ? 'تعديل الكورس' : 'إضافة كورس جديد'} onClose={() => !saving && setFormOpen(false)}>
        <div className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">اسم الكورس *</span><input autoFocus value={formTitle} onChange={(event) => setFormTitle(event.target.value)} maxLength={150} placeholder="مثال: الباب الأول - العناصر الانتقالية" className="w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-700 focus:border-sky-500/40" /></label>
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">الصف الدراسي *</span><select value={formGradeId} onChange={(event) => setFormGradeId(event.target.value)} className="w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3.5 text-sm font-bold text-slate-300 outline-none"><option value="">اختر الصف</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label>
          </div>
          <label className="block"><span className="mb-2 block text-sm font-bold text-slate-300">الوصف</span><textarea value={formDescription} onChange={(event) => setFormDescription(event.target.value)} rows={4} placeholder="وصف مختصر يساعد الطالب على معرفة محتوى الكورس..." className="w-full resize-none rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3.5 text-sm leading-7 text-white outline-none placeholder:text-slate-700 focus:border-sky-500/40" /></label>
          <label className="block sm:max-w-xs"><span className="mb-2 block text-sm font-bold text-slate-300">ترتيب الكورس *</span><input type="number" min={1} step={1} value={formOrder} onChange={(event) => setFormOrder(event.target.value)} className="w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3.5 text-sm font-bold text-white outline-none focus:border-sky-500/40" /><span className="mt-2 block text-xs leading-5 text-slate-600">يحدد ترتيب ظهور الكورس للطلاب داخل الصف.</span></label>
          <div className="flex flex-col-reverse gap-2 border-t border-white/[0.06] pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="rounded-2xl border border-white/[0.08] px-5 py-3 text-sm font-bold text-slate-400 hover:bg-white/[0.05]">إلغاء</button><button type="button" onClick={() => void saveCourse()} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-6 py-3 text-sm font-black text-slate-950 disabled:opacity-50">{saving ? <RefreshCw size={17} className="animate-spin" /> : <Check size={17} />}{saving ? 'جارٍ الحفظ...' : editingCourse ? 'حفظ التعديلات' : 'إنشاء الكورس'}</button></div>
        </div>
      </Modal>}

      {deleteTarget && <Modal title="تأكيد حذف الكورس" onClose={() => !deleting && setDeleteTarget(null)}>
        <div className="text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-red-500/10 text-red-400"><Trash2 size={28} /></div><h3 className="mt-5 text-xl font-black">هل تريد حذف «{deleteTarget.title}»؟</h3><p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-500">الحذف النهائي مسموح فقط إذا لم توجد فصول مرتبطة بالكورس. إذا كان الكورس يحتوي على محتوى، سيمنع النظام الحذف لحماية البيانات ويمكنك تعطيله بدلًا من ذلك.</p><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center"><button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} className="rounded-2xl border border-white/[0.08] px-6 py-3 text-sm font-bold text-slate-400">إلغاء</button><button type="button" onClick={() => void deleteCourse()} disabled={deleting} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-6 py-3 text-sm font-black text-white disabled:opacity-50">{deleting ? <RefreshCw size={17} className="animate-spin" /> : <Trash2 size={17} />}{deleting ? 'جارٍ الحذف...' : 'حذف نهائي'}</button></div></div>
      </Modal>}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
