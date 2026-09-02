import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Eye,
  GraduationCap,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type UserStatus = 'pending' | 'active' | 'suspended' | 'rejected';

type Grade = {
  id: string;
  name: string;
};

type Student = {
  id: string;
  full_name: string;
  phone: string | null;
  student_code: string | null;
  status: UserStatus;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
};

type Group = {
  id: string;
  grade_id: string;
  name: string;
  description: string | null;
  location: string | null;
  max_students: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  grade: Grade | null;
  member_count: number;
};

type GroupMember = {
  id: string;
  group_id: string;
  student_id: string;
  starts_at: string;
  ends_at: string | null;
  student: Student;
};

type ToastState = {
  message: string;
  type: 'success' | 'error';
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'غير معروف';
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'ط';
  if (words.length === 1) return words[0].slice(0, 1);
  return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`;
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
        active
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
          : 'border-slate-500/20 bg-slate-500/10 text-slate-400'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      {active ? 'نشطة' : 'معطلة'}
    </span>
  );
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  return (
    <div className="fixed bottom-5 left-1/2 z-[500] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#11151d]/95 px-4 py-3 shadow-2xl backdrop-blur-xl">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {toast.type === 'success' ? <Check size={18} /> : <AlertTriangle size={18} />}
        </div>
        <p className="flex-1 text-sm font-bold text-white">{toast.message}</p>
        <button type="button" onClick={onClose} className="text-slate-500 hover:text-white">
          <X size={17} />
        </button>
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const navigate = useNavigate();

  const [groups, setGroups] = useState<Group[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [formOpen, setFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formName, setFormName] = useState('');
  const [formGradeId, setFormGradeId] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCapacity, setFormCapacity] = useState('');
  const [saving, setSaving] = useState(false);

  const [viewGroup, setViewGroup] = useState<Group | null>(null);
  const [membersGroup, setMembersGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [availableStudents, setAvailableStudents] = useState<Student[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);
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
      console.error('Groups grades load error:', error);
      showToast('تعذر تحميل الصفوف الدراسية', 'error');
      return;
    }

    setGrades((data ?? []) as Grade[]);
  }, [showToast]);

  const loadGroups = useCallback(
    async (silent = false) => {
      try {
        if (silent) setRefreshing(true);
        else setLoading(true);

        const [{ data: groupRows, error: groupsError }, { data: memberRows, error: membersError }] =
          await Promise.all([
            supabase
              .from('groups')
              .select(
                `id, grade_id, name, description, location, max_students, is_active, created_at, updated_at, grade:grades!groups_grade_id_fkey(id, name)`
              )
              .order('created_at', { ascending: false }),
            supabase
              .from('group_members')
              .select('id, group_id')
              .is('ends_at', null),
          ]);

        if (groupsError) throw groupsError;
        if (membersError) throw membersError;

        const counts = new Map<string, number>();
        for (const row of memberRows ?? []) {
          counts.set(row.group_id, (counts.get(row.group_id) ?? 0) + 1);
        }

        const normalized: Group[] = (groupRows ?? []).map((row: any) => ({
          id: row.id,
          grade_id: row.grade_id,
          name: row.name,
          description: row.description ?? null,
          location: row.location ?? null,
          max_students: row.max_students ?? null,
          is_active: Boolean(row.is_active),
          created_at: row.created_at,
          updated_at: row.updated_at,
          grade: Array.isArray(row.grade) ? row.grade[0] ?? null : row.grade ?? null,
          member_count: counts.get(row.id) ?? 0,
        }));

        setGroups(normalized);
      } catch (error) {
        console.error('Groups load error:', error);
        showToast('تعذر تحميل المجموعات', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void Promise.all([loadGrades(), loadGroups()]);
  }, [loadGrades, loadGroups]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ar-EG');
    return groups.filter((group) => {
      const matchesSearch =
        !query ||
        group.name.toLocaleLowerCase('ar-EG').includes(query) ||
        (group.location ?? '').toLocaleLowerCase('ar-EG').includes(query) ||
        (group.description ?? '').toLocaleLowerCase('ar-EG').includes(query);
      const matchesGrade = gradeFilter === 'all' || group.grade_id === gradeFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' ? group.is_active : !group.is_active);
      return matchesSearch && matchesGrade && matchesStatus;
    });
  }, [groups, search, gradeFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      total: groups.length,
      active: groups.filter((group) => group.is_active).length,
      inactive: groups.filter((group) => !group.is_active).length,
      students: groups.reduce((sum, group) => sum + group.member_count, 0),
    }),
    [groups]
  );

  const resetForm = () => {
    setFormName('');
    setFormGradeId('');
    setFormLocation('');
    setFormDescription('');
    setFormCapacity('');
  };

  const openCreate = () => {
    resetForm();
    setEditingGroup(null);
    setFormOpen(true);
  };

  const openEdit = (group: Group) => {
    setEditingGroup(group);
    setFormName(group.name);
    setFormGradeId(group.grade_id);
    setFormLocation(group.location ?? '');
    setFormDescription(group.description ?? '');
    setFormCapacity(group.max_students === null ? '' : String(group.max_students));
    setFormOpen(true);
  };

  const saveGroup = async () => {
    const name = formName.trim();
    if (!name) {
      showToast('اسم المجموعة مطلوب', 'error');
      return;
    }
    if (!formGradeId) {
      showToast('اختر الصف الدراسي', 'error');
      return;
    }

    const capacity = formCapacity.trim() ? Number(formCapacity) : null;
    if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1)) {
      showToast('السعة يجب أن تكون رقمًا صحيحًا أكبر من صفر', 'error');
      return;
    }
    if (editingGroup && capacity !== null && capacity < editingGroup.member_count) {
      showToast('السعة الجديدة لا يمكن أن تكون أقل من عدد الطلاب الحاليين', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name,
        grade_id: formGradeId,
        location: formLocation.trim() || null,
        description: formDescription.trim() || null,
        max_students: capacity,
      };

      if (editingGroup) {
        const { data, error } = await supabase
          .from('groups')
          .update(payload)
          .eq('id', editingGroup.id)
          .select(
            `id, grade_id, name, description, location, max_students, is_active, created_at, updated_at, grade:grades!groups_grade_id_fkey(id, name)`
          )
          .single();

        if (error) throw error;

        const updated: Group = {
          id: data.id,
          grade_id: data.grade_id,
          name: data.name,
          description: data.description ?? null,
          location: data.location ?? null,
          max_students: data.max_students ?? null,
          is_active: Boolean(data.is_active),
          created_at: data.created_at,
          updated_at: data.updated_at,
          grade: Array.isArray(data.grade) ? data.grade[0] ?? null : data.grade ?? null,
          member_count: editingGroup.member_count,
        };

        setGroups((current) => current.map((group) => (group.id === updated.id ? updated : group)));
        setViewGroup((current) => (current?.id === updated.id ? updated : current));
        setMembersGroup((current) => (current?.id === updated.id ? updated : current));
        showToast('تم تعديل المجموعة بنجاح');
      } else {
        const { data, error } = await supabase
          .from('groups')
          .insert(payload)
          .select(
            `id, grade_id, name, description, location, max_students, is_active, created_at, updated_at, grade:grades!groups_grade_id_fkey(id, name)`
          )
          .single();

        if (error) throw error;

        const created: Group = {
          id: data.id,
          grade_id: data.grade_id,
          name: data.name,
          description: data.description ?? null,
          location: data.location ?? null,
          max_students: data.max_students ?? null,
          is_active: Boolean(data.is_active),
          created_at: data.created_at,
          updated_at: data.updated_at,
          grade: Array.isArray(data.grade) ? data.grade[0] ?? null : data.grade ?? null,
          member_count: 0,
        };

        setGroups((current) => [created, ...current]);
        showToast('تم إنشاء المجموعة بنجاح');
      }

      setFormOpen(false);
      setEditingGroup(null);
      resetForm();
    } catch (error: any) {
      console.error('Save group error:', error);
      const message = String(error?.message ?? '');
      if (message.includes('groups_grade_name_unique')) {
        showToast('يوجد بالفعل مجموعة بهذا الاسم في نفس الصف', 'error');
      } else {
        showToast(editingGroup ? 'تعذر تعديل المجموعة' : 'تعذر إنشاء المجموعة', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleGroup = async (group: Group) => {
    try {
      const { error } = await supabase
        .from('groups')
        .update({ is_active: !group.is_active })
        .eq('id', group.id);

      if (error) throw error;

      setGroups((current) =>
        current.map((item) =>
          item.id === group.id ? { ...item, is_active: !group.is_active } : item
        )
      );
      setViewGroup((current) =>
        current?.id === group.id ? { ...current, is_active: !group.is_active } : current
      );
      showToast(group.is_active ? 'تم تعطيل المجموعة' : 'تم تفعيل المجموعة');
    } catch (error) {
      console.error('Toggle group error:', error);
      showToast('تعذر تغيير حالة المجموعة', 'error');
    }
  };

  const deleteGroup = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const { error } = await supabase.rpc('delete_group', {
        p_group_id: deleteTarget.id,
      });
      if (error) throw error;
      setGroups((current) => current.filter((group) => group.id !== deleteTarget.id));
      setViewGroup(null);
      setDeleteTarget(null);
      showToast('تم حذف المجموعة نهائيًا');
    } catch (error: any) {
      console.error('Delete group error:', error);
      showToast(String(error?.message ?? 'لا يمكن حذف المجموعة. قم بتعطيلها بدلًا من ذلك.'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const loadMembers = useCallback(
    async (groupId: string) => {
      setMembersLoading(true);
      try {
        const { data: membershipRows, error: membershipError } = await supabase
          .from('group_members')
          .select('id, group_id, student_id, starts_at, ends_at')
          .eq('group_id', groupId)
          .is('ends_at', null)
          .order('starts_at', { ascending: false });

        if (membershipError) throw membershipError;

        const ids = (membershipRows ?? []).map((row) => row.student_id);
        if (!ids.length) {
          setMembers([]);
          return;
        }

        const { data: students, error: studentsError } = await supabase
          .from('users')
          .select('id, full_name, phone, student_code, status, avatar_url, is_active, created_at')
          .in('id', ids);

        if (studentsError) throw studentsError;

        const studentMap = new Map<string, Student>(
          ((students ?? []) as Student[]).map((student) => [student.id, student])
        );

        setMembers(
          (membershipRows ?? [])
            .map((row) => {
              const student = studentMap.get(row.student_id);
              if (!student) return null;
              return { ...row, student } as GroupMember;
            })
            .filter((row): row is GroupMember => row !== null)
        );
      } catch (error) {
        console.error('Load group members error:', error);
        showToast('تعذر تحميل طلاب المجموعة', 'error');
        setMembers([]);
      } finally {
        setMembersLoading(false);
      }
    },
    [showToast]
  );

  const loadAvailableStudents = useCallback(
    async (groupId: string) => {
      setStudentsLoading(true);
      try {
        const [{ data: students, error: studentsError }, { data: activeMemberships, error: membershipsError }] =
          await Promise.all([
            supabase
              .from('users')
              .select('id, full_name, phone, student_code, status, avatar_url, is_active, created_at')
              .eq('role', 'student')
              .eq('status', 'active')
              .eq('is_active', true)
              .order('full_name', { ascending: true }),
            supabase.from('group_members').select('student_id').is('ends_at', null),
          ]);

        if (studentsError) throw studentsError;
        if (membershipsError) throw membershipsError;

        const activeIds = new Set((activeMemberships ?? []).map((row) => row.student_id));
        setAvailableStudents(
          ((students ?? []) as Student[]).filter((student) => !activeIds.has(student.id))
        );
      } catch (error) {
        console.error('Load available students error:', error);
        showToast('تعذر تحميل الطلاب المتاحين', 'error');
        setAvailableStudents([]);
      } finally {
        setStudentsLoading(false);
      }
    },
    [showToast]
  );

  const openMembers = async (group: Group) => {
    setMembersGroup(group);
    setMemberSearch('');
    setMembers([]);
    await Promise.all([loadMembers(group.id), loadAvailableStudents(group.id)]);
  };

  const addStudent = async (student: Student) => {
    if (!membersGroup) return;
    setAddingId(student.id);
    try {
      const { error } = await supabase.rpc('add_student_to_group', {
        p_group_id: membersGroup.id,
        p_student_id: student.id,
      });
      if (error) throw error;

      await Promise.all([loadMembers(membersGroup.id), loadAvailableStudents(membersGroup.id)]);
      setGroups((current) =>
        current.map((group) =>
          group.id === membersGroup.id ? { ...group, member_count: group.member_count + 1 } : group
        )
      );
      setMembersGroup((current) =>
        current ? { ...current, member_count: current.member_count + 1 } : current
      );
      showToast('تمت إضافة الطالب للمجموعة');
    } catch (error: any) {
      console.error('Add student error:', error);
      showToast(String(error?.message ?? 'تعذر إضافة الطالب'), 'error');
    } finally {
      setAddingId(null);
    }
  };

  const removeStudent = async (member: GroupMember) => {
    if (!membersGroup) return;
    setRemovingId(member.student_id);
    try {
      const { error } = await supabase.rpc('remove_student_from_group', {
        p_group_member_id: member.id,
      });
      if (error) throw error;

      await Promise.all([loadMembers(membersGroup.id), loadAvailableStudents(membersGroup.id)]);
      setGroups((current) =>
        current.map((group) =>
          group.id === membersGroup.id
            ? { ...group, member_count: Math.max(0, group.member_count - 1) }
            : group
        )
      );
      setMembersGroup((current) =>
        current ? { ...current, member_count: Math.max(0, current.member_count - 1) } : current
      );
      showToast('تمت إزالة الطالب من المجموعة مع الاحتفاظ بسجل العضوية');
    } catch (error: any) {
      console.error('Remove student error:', error);
      showToast(String(error?.message ?? 'تعذر إزالة الطالب'), 'error');
    } finally {
      setRemovingId(null);
    }
  };

  const filteredAvailableStudents = useMemo(() => {
    const query = memberSearch.trim().toLocaleLowerCase('ar-EG');
    if (!query) return availableStudents;
    return availableStudents.filter((student) =>
      [student.full_name, student.phone ?? '', student.student_code ?? '']
        .join(' ')
        .toLocaleLowerCase('ar-EG')
        .includes(query)
    );
  }, [availableStudents, memberSearch]);

  return (
    <div dir="rtl" className="min-h-screen bg-[#07090f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[450px] w-[450px] rounded-full bg-amber-500/10 blur-[140px]" />
        <div className="absolute -bottom-40 -left-40 h-[450px] w-[450px] rounded-full bg-blue-500/10 blur-[140px]" />
      </div>

      <main className="relative mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
        <header className="mb-7 flex flex-col gap-5 rounded-3xl border border-white/[0.06] bg-white/[0.025] p-6 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs">
              <span className="rounded-lg bg-amber-500/10 px-3 py-1.5 font-bold text-amber-400">إدارة المنصة</span>
              <span className="text-slate-700">/</span>
              <span className="text-slate-500">المجموعات</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">إدارة المجموعات</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
              إنشاء وتنظيم مجموعات الطلاب، ربطها بالصفوف، متابعة السعة، وإدارة العضويات الحالية مع حفظ تاريخ العضوية.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadGroups(true)}
              disabled={refreshing}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-5 text-sm font-bold hover:bg-white/[0.08] disabled:opacity-50"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              تحديث
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-black text-slate-950 hover:bg-amber-400"
            >
              <Plus size={18} />
              مجموعة جديدة
            </button>
          </div>
        </header>

        <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['إجمالي المجموعات', stats.total, 'bg-blue-500/10 text-blue-400', <Users size={21} />],
            ['المجموعات النشطة', stats.active, 'bg-emerald-500/10 text-emerald-400', <Check size={21} />],
            ['المجموعات المعطلة', stats.inactive, 'bg-slate-500/10 text-slate-400', <X size={21} />],
            ['إجمالي الطلاب بالمجموعات', stats.students, 'bg-amber-500/10 text-amber-400', <GraduationCap size={21} />],
          ].map(([title, value, iconClass, icon]) => (
            <div key={String(title)} className="rounded-2xl border border-white/[0.06] bg-[#11151d] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">{String(title)}</p>
                  <p className="mt-2 text-3xl font-black">{Number(value).toLocaleString('ar-EG')}</p>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${String(iconClass)}`}>{icon}</div>
              </div>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.025]">
          <div className="flex flex-col gap-4 border-b border-white/[0.06] p-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-black">جميع المجموعات</h2>
              <p className="mt-1 text-xs text-slate-600">
                عرض {filteredGroups.length.toLocaleString('ar-EG')} من {groups.length.toLocaleString('ar-EG')} مجموعة
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="relative md:min-w-[280px]">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ابحث باسم المجموعة أو المكان..."
                  className="w-full rounded-xl border border-white/[0.07] bg-black/20 py-3 pr-10 pl-4 text-sm outline-none placeholder:text-slate-600 focus:border-amber-500/40"
                />
              </div>
              <select
                value={gradeFilter}
                onChange={(event) => setGradeFilter(event.target.value)}
                className="rounded-xl border border-white/[0.07] bg-[#11151d] px-4 py-3 text-sm font-bold outline-none focus:border-amber-500/40"
              >
                <option value="all">كل الصفوف</option>
                {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                className="rounded-xl border border-white/[0.07] bg-[#11151d] px-4 py-3 text-sm font-bold outline-none focus:border-amber-500/40"
              >
                <option value="all">كل الحالات</option>
                <option value="active">نشطة</option>
                <option value="inactive">معطلة</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-24 text-center">
              <RefreshCw size={34} className="mx-auto mb-4 animate-spin text-amber-400" />
              <p className="text-sm text-slate-500">جاري تحميل المجموعات...</p>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-24 text-center">
              <Users size={52} className="mx-auto mb-5 text-slate-700" />
              <h3 className="text-xl font-black">لا توجد مجموعات</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">لا توجد نتائج مطابقة للفلاتر الحالية.</p>
              <button type="button" onClick={openCreate} className="mt-6 rounded-xl bg-amber-500 px-6 py-3 text-sm font-black text-slate-950 hover:bg-amber-400">
                <Plus size={17} className="mr-1 inline" /> إنشاء مجموعة
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-right">
                <thead>
                  <tr className="border-b border-white/[0.05] text-xs text-slate-600">
                    <th className="px-6 py-4 font-bold">المجموعة</th>
                    <th className="px-6 py-4 font-bold">الصف</th>
                    <th className="px-6 py-4 font-bold">المكان</th>
                    <th className="px-6 py-4 font-bold">الطلاب / السعة</th>
                    <th className="px-6 py-4 font-bold">الحالة</th>
                    <th className="px-6 py-4 font-bold">الإنشاء</th>
                    <th className="px-6 py-4 font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGroups.map((group) => (
                    <tr key={group.id} className="border-b border-white/[0.04] hover:bg-white/[0.025]">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-blue-500/20 text-amber-400">
                            <Users size={19} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-black">{group.name}</p>
                            {group.description && <p className="mt-1 max-w-xs truncate text-[11px] text-slate-600">{group.description}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5"><span className="rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400">{group.grade?.name ?? 'غير محدد'}</span></td>
                      <td className="px-6 py-5 text-sm text-slate-400"><span className="inline-flex items-center gap-1.5"><MapPin size={14} />{group.location ?? 'غير محدد'}</span></td>
                      <td className="px-6 py-5">
                        <button type="button" onClick={() => void openMembers(group)} className="font-black text-amber-400 hover:text-amber-300">
                          {group.member_count.toLocaleString('ar-EG')}
                          <span className="mx-1 text-slate-600">/</span>
                          {group.max_students === null ? '∞' : group.max_students.toLocaleString('ar-EG')}
                        </button>
                      </td>
                      <td className="px-6 py-5"><StatusBadge active={group.is_active} /></td>
                      <td className="px-6 py-5 text-xs text-slate-500">{formatDate(group.created_at)}</td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setViewGroup(group)} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-2.5 text-slate-300 hover:bg-white/[0.08]" title="عرض"><Eye size={16} /></button>
                          <button type="button" onClick={() => void openMembers(group)} className="rounded-xl border border-blue-500/10 bg-blue-500/5 p-2.5 text-blue-400 hover:bg-blue-500/10" title="الطلاب"><Users size={16} /></button>
                          <button type="button" onClick={() => openEdit(group)} className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-2.5 text-amber-400 hover:bg-amber-500/10" title="تعديل"><Pencil size={16} /></button>
                          <button type="button" onClick={() => void toggleGroup(group)} className={`rounded-xl p-2.5 ${group.is_active ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'}`} title={group.is_active ? 'تعطيل' : 'تفعيل'}>{group.is_active ? <X size={16} /> : <Check size={16} />}</button>
                          <button type="button" onClick={() => setDeleteTarget(group)} className="rounded-xl bg-red-500/5 p-2.5 text-red-500/70 hover:bg-red-500/10 hover:text-red-400" title="حذف"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="mt-7 border-t border-white/[0.05] pt-5 text-xs text-slate-600">
          منصة كيمياء أستاذ أحمد محمد رمضان — إدارة المجموعات
        </footer>
      </main>

      {formOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={() => !saving && setFormOpen(false)}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/[0.08] bg-[#11151d] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-7 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-amber-400">{editingGroup ? 'تعديل المجموعة' : 'مجموعة جديدة'}</p>
                <h2 className="mt-1 text-2xl font-black">{editingGroup ? 'تعديل بيانات المجموعة' : 'إنشاء مجموعة جديدة'}</h2>
              </div>
              <button type="button" disabled={saving} onClick={() => setFormOpen(false)} className="rounded-xl bg-white/[0.04] p-2 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-slate-300">اسم المجموعة *</span>
                <input value={formName} onChange={(event) => setFormName(event.target.value)} placeholder="مثال: مجموعة الأحد والثلاثاء" className="w-full rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-amber-500/50" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-slate-300">الصف الدراسي *</span>
                <select value={formGradeId} onChange={(event) => setFormGradeId(event.target.value)} className="w-full rounded-xl border border-white/[0.07] bg-[#0b0e15] px-4 py-3 text-sm font-bold outline-none focus:border-amber-500/50">
                  <option value="">اختر الصف الدراسي</option>
                  {grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-slate-300">السعة القصوى</span>
                <input value={formCapacity} onChange={(event) => setFormCapacity(event.target.value)} inputMode="numeric" placeholder="اتركها فارغة لسعة غير محدودة" className="w-full rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-amber-500/50" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-slate-300">المكان</span>
                <input value={formLocation} onChange={(event) => setFormLocation(event.target.value)} placeholder="مثال: سنتر أحمد رمضان / أونلاين" className="w-full rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-amber-500/50" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-slate-300">الوصف</span>
                <textarea value={formDescription} onChange={(event) => setFormDescription(event.target.value)} rows={4} placeholder="وصف مختصر للمجموعة..." className="w-full resize-none rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-amber-500/50" />
              </label>
            </div>

            <div className="mt-7 flex gap-3">
              <button type="button" disabled={saving} onClick={() => void saveGroup()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 hover:bg-amber-400 disabled:opacity-50">
                {saving && <RefreshCw size={16} className="animate-spin" />}
                {editingGroup ? 'حفظ التعديلات' : 'إنشاء المجموعة'}
              </button>
              <button type="button" disabled={saving} onClick={() => setFormOpen(false)} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-6 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.08]">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {viewGroup && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={() => setViewGroup(null)}>
          <div className="w-full max-w-2xl rounded-3xl border border-white/[0.08] bg-[#11151d] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between">
              <div><p className="text-xs font-bold text-amber-400">تفاصيل المجموعة</p><h2 className="mt-1 text-2xl font-black">{viewGroup.name}</h2></div>
              <button type="button" onClick={() => setViewGroup(null)} className="rounded-xl bg-white/[0.04] p-2 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="mb-5 flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-blue-500/20 text-amber-400"><Users size={28} /></div>
              <div className="flex-1"><h3 className="text-xl font-black">{viewGroup.name}</h3><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-lg bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400">{viewGroup.grade?.name ?? 'غير محدد'}</span><StatusBadge active={viewGroup.is_active} /></div></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"><p className="text-xs text-slate-600">المكان</p><p className="mt-2 font-bold text-slate-200">{viewGroup.location ?? 'غير محدد'}</p></div>
              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"><p className="text-xs text-slate-600">الطلاب / السعة</p><p className="mt-2 font-black text-amber-400">{viewGroup.member_count} / {viewGroup.max_students ?? '∞'}</p></div>
              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"><p className="text-xs text-slate-600">تاريخ الإنشاء</p><p className="mt-2 font-bold text-slate-200">{formatDate(viewGroup.created_at)}</p></div>
              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"><p className="text-xs text-slate-600">آخر تحديث</p><p className="mt-2 font-bold text-slate-200">{formatDate(viewGroup.updated_at)}</p></div>
            </div>
            {viewGroup.description && <div className="mt-3 rounded-2xl border border-white/[0.06] bg-black/10 p-4"><p className="text-xs text-slate-600">الوصف</p><p className="mt-2 text-sm leading-7 text-slate-300">{viewGroup.description}</p></div>}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <button type="button" onClick={() => { setViewGroup(null); void openMembers(viewGroup); }} className="rounded-xl bg-blue-500 px-4 py-3 text-sm font-black hover:bg-blue-400"><Users size={16} className="mr-1 inline" /> الطلاب</button>
              <button type="button" onClick={() => { setViewGroup(null); openEdit(viewGroup); }} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.08]"><Pencil size={16} className="mr-1 inline" /> تعديل</button>
              <button type="button" onClick={() => void toggleGroup(viewGroup)} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.08]">{viewGroup.is_active ? 'تعطيل المجموعة' : 'تفعيل المجموعة'}</button>
            </div>
          </div>
        </div>
      )}

      {membersGroup && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md" onClick={() => setMembersGroup(null)}>
          <div className="max-h-[94vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/[0.08] bg-[#11151d] shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-white/[0.06] p-6">
              <div><p className="text-xs font-bold text-blue-400">إدارة الطلاب</p><h2 className="mt-1 text-2xl font-black">{membersGroup.name}</h2><p className="mt-2 text-sm text-slate-500">{membersGroup.grade?.name ?? 'غير محدد'} • {membersGroup.member_count} طالب {membersGroup.max_students !== null && `من ${membersGroup.max_students}`}</p></div>
              <button type="button" onClick={() => setMembersGroup(null)} className="rounded-xl bg-white/[0.04] p-2 text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="grid max-h-[calc(94vh-100px)] overflow-y-auto lg:grid-cols-2">
              <div className="border-b border-white/[0.06] p-5 lg:border-b-0 lg:border-l">
                <div className="mb-5 flex items-center justify-between"><div><h3 className="font-black">الطلاب الحاليون</h3><p className="mt-1 text-xs text-slate-600">العضويات النشطة فقط</p></div><span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-400">{members.length}</span></div>
                {membersLoading ? <div className="py-16 text-center"><RefreshCw size={28} className="mx-auto mb-3 animate-spin text-blue-400" /><p className="text-xs text-slate-600">جاري التحميل...</p></div> : members.length === 0 ? <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 text-center"><GraduationCap size={38} className="mx-auto mb-3 text-slate-700" /><p className="font-bold text-slate-300">لا يوجد طلاب</p></div> : <div className="space-y-2">{members.map((member) => <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3"><button type="button" onClick={() => setSelectedStudent(member.student)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/10 font-black text-amber-400">{initials(member.student.full_name)}</button><button type="button" onClick={() => setSelectedStudent(member.student)} className="min-w-0 flex-1 text-right"><p className="truncate text-sm font-black">{member.student.full_name}</p><p className="mt-1 truncate text-[10px] text-slate-600">{member.student.student_code ?? member.student.phone ?? 'بدون بيانات'}</p></button><button type="button" disabled={removingId === member.student_id} onClick={() => void removeStudent(member)} className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-40">{removingId === member.student_id ? '...' : <><UserMinus size={14} className="mr-1 inline" /> إزالة</>}</button></div>)}</div>}
              </div>

              <div className="p-5">
                <div className="mb-5"><h3 className="font-black">إضافة طلاب</h3><p className="mt-1 text-xs text-slate-600">الطلاب النشطون غير المرتبطين بأي مجموعة حاليًا</p></div>
                {membersGroup.max_students !== null && membersGroup.member_count >= membersGroup.max_students ? <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.04] p-5 text-center"><AlertTriangle size={30} className="mx-auto mb-3 text-amber-400" /><p className="font-bold text-amber-300">تم الوصول إلى سعة المجموعة</p><p className="mt-2 text-xs text-slate-600">زد السعة من تعديل المجموعة قبل إضافة طلاب جدد.</p></div> : <><div className="relative mb-4"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600" /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="ابحث بالاسم أو الكود أو الهاتف..." className="w-full rounded-xl border border-white/[0.07] bg-black/20 py-3 pr-10 pl-4 text-sm outline-none placeholder:text-slate-600 focus:border-blue-500/40" /></div>{studentsLoading ? <div className="py-16 text-center"><RefreshCw size={28} className="mx-auto mb-3 animate-spin text-blue-400" /><p className="text-xs text-slate-600">جاري التحميل...</p></div> : filteredAvailableStudents.length === 0 ? <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 text-center"><UserPlus size={34} className="mx-auto mb-3 text-slate-700" /><p className="font-bold text-slate-300">لا يوجد طلاب متاحون</p></div> : <div className="space-y-2">{filteredAvailableStudents.map((student) => <div key={student.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3"><button type="button" onClick={() => setSelectedStudent(student)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-500/10 font-black text-blue-400">{initials(student.full_name)}</button><button type="button" onClick={() => setSelectedStudent(student)} className="min-w-0 flex-1 text-right"><p className="truncate text-sm font-black">{student.full_name}</p><p className="mt-1 truncate text-[10px] text-slate-600">{student.student_code ?? student.phone ?? 'بدون بيانات'}</p></button><button type="button" disabled={addingId === student.id} onClick={() => void addStudent(student)} className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40">{addingId === student.id ? '...' : <><UserPlus size={14} className="mr-1 inline" /> إضافة</>}</button></div>)}</div>}</>}
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedStudent && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={() => setSelectedStudent(null)}>
          <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#11151d] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between"><div><p className="text-xs font-bold text-amber-400">بطاقة الطالب</p><h2 className="mt-1 text-2xl font-black">بيانات الطالب</h2></div><button type="button" onClick={() => setSelectedStudent(null)} className="rounded-xl bg-white/[0.04] p-2 text-slate-400 hover:text-white"><X size={18} /></button></div>
            <div className="mb-5 flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4"><div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10 text-xl font-black text-amber-400">{initials(selectedStudent.full_name)}</div><div><h3 className="font-black">{selectedStudent.full_name}</h3><p className="mt-1 text-xs text-slate-500">{selectedStudent.status === 'active' ? 'طالب نشط' : 'غير نشط'}</p></div></div>
            <div className="space-y-3"><div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"><p className="text-xs text-slate-600">كود الطالب</p><p className="mt-2 font-mono font-black text-amber-400">{selectedStudent.student_code ?? 'غير متوفر'}</p></div><div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4"><p className="text-xs text-slate-600">الهاتف</p><p className="mt-2 font-bold">{selectedStudent.phone ?? 'غير متوفر'}</p></div></div>
            <button type="button" onClick={() => { setSelectedStudent(null); setMembersGroup(null); navigate(`/admin/students/${selectedStudent.id}`); }} className="mt-6 w-full rounded-xl bg-blue-500 px-5 py-3 text-sm font-black hover:bg-blue-400">فتح صفحة الطالب</button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="w-full max-w-md rounded-3xl border border-red-500/10 bg-[#11151d] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-400"><Trash2 size={28} /></div>
            <h2 className="text-center text-xl font-black">حذف المجموعة نهائيًا</h2>
            <p className="mt-3 text-center text-sm leading-7 text-slate-500">هل أنت متأكد من حذف <span className="font-black text-white">{deleteTarget.name}</span>؟ لن يسمح النظام بالحذف إذا كانت المجموعة مرتبطة بطلاب أو جداول أو حصص أو محتوى أو اختبارات.</p>
            <div className="mt-6 flex gap-3"><button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="flex-1 rounded-xl bg-white/[0.05] px-4 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.08]">إلغاء</button><button type="button" disabled={deleting} onClick={() => void deleteGroup()} className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-500 disabled:opacity-50">{deleting ? 'جاري الحذف...' : 'نعم، حذف'}</button></div>
          </div>
        </div>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
