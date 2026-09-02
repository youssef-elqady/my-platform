
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Eye,
  Filter,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserRoundX,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '../lib/supabase';

type UserStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'rejected';

type StatusFilter = 'all' | UserStatus;

interface Student {
  id: string;
  full_name: string;
  phone: string;
  student_code: string | null;
  status: UserStatus;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface Grade {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  grade_id: string;
}

interface GroupMember {
  student_id: string;
  group_id: string;
}

interface StudentView {
  student: Student;
  group: Group | null;
  grade: Grade | null;
}

const statusConfig: Record<
  UserStatus,
  {
    label: string;
    icon: React.ReactNode;
    className: string;
    dotClassName: string;
  }
> = {
  active: {
    label: 'نشط',
    icon: <Check size={13} strokeWidth={3} />,
    className:
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
    dotClassName: 'bg-emerald-400',
  },
  pending: {
    label: 'بانتظار الموافقة',
    icon: <AlertCircle size={13} strokeWidth={2.5} />,
    className:
      'border-amber-500/20 bg-amber-500/10 text-amber-400',
    dotClassName: 'bg-amber-400',
  },
  suspended: {
    label: 'موقوف',
    icon: <UserRoundX size={13} strokeWidth={2.5} />,
    className:
      'border-red-500/20 bg-red-500/10 text-red-400',
    dotClassName: 'bg-red-400',
  },
  rejected: {
    label: 'مرفوض',
    icon: <X size={13} strokeWidth={3} />,
    className:
      'border-slate-500/20 bg-slate-500/10 text-slate-400',
    dotClassName: 'bg-slate-400',
  },
};

function formatDate(date: string): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'غير معروف';
  }

  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsedDate);
}

function getInitials(name: string): string {
  const normalized = name.trim();

  if (!normalized) {
    return 'ط';
  }

  const words = normalized.split(/\s+/).filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 1);
  }

  return `${words[0].slice(0, 1)}${words[1].slice(0, 1)}`;
}

function normalizeSearchValue(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('ar-EG')
    .replace(/\s+/g, ' ');
}

function StatusBadge({
  status,
}: {
  status: UserStatus;
}) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold ${config.className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dotClassName}`}
      />
      {config.icon}
      {config.label}
    </span>
  );
}

function StatCard({
  title,
  value,
  description,
  icon,
  iconClassName,
  onClick,
  active,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  iconClassName: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative min-w-0 overflow-hidden rounded-2xl border p-5 text-right transition-all duration-300 ${
        active
          ? 'border-blue-500/30 bg-blue-500/[0.08] shadow-lg shadow-blue-950/20'
          : 'border-white/[0.06] bg-[#11151d] hover:-translate-y-1 hover:border-white/[0.1] hover:bg-[#141923] hover:shadow-xl'
      }`}
    >
      <div className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full bg-white/[0.025] blur-3xl transition-transform duration-500 group-hover:scale-150" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-black tracking-tight text-white">
            {value.toLocaleString('ar-EG')}
          </p>

          <p className="mt-2 truncate text-xs text-slate-600">
            {description}
          </p>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110 ${iconClassName}`}
        >
          {icon}
        </div>
      </div>
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  children,
  icon,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  icon: React.ReactNode;
  ariaLabel: string;
}) {
  return (
    <div className="relative min-w-[170px] flex-1">
      <div className="pointer-events-none absolute right-3 top-1/2 z-10 -translate-y-1/2 text-slate-500">
        {icon}
      </div>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={ariaLabel}
        className="h-11 w-full appearance-none rounded-xl border border-white/[0.07] bg-[#0c1017] px-10 pl-9 text-sm font-medium text-slate-200 outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
      >
        {children}
      </select>

      <ChevronDown
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
      />
    </div>
  );
}

function EmptyState({
  hasFilters,
  onReset,
}: {
  hasFilters: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/[0.06] bg-white/[0.025] text-slate-600">
        {hasFilters ? (
          <Search size={34} strokeWidth={1.5} />
        ) : (
          <Users size={34} strokeWidth={1.5} />
        )}
      </div>

      <h3 className="mt-5 text-lg font-black text-white">
        {hasFilters
          ? 'لا توجد نتائج مطابقة'
          : 'لا يوجد طلاب حتى الآن'}
      </h3>

      <p className="mt-2 max-w-md text-sm leading-7 text-slate-500">
        {hasFilters
          ? 'جرّب تغيير كلمة البحث أو إزالة بعض الفلاتر للوصول إلى النتائج المطلوبة.'
          : 'عند تسجيل طلاب جدد وظهورهم في قاعدة البيانات سيظهرون هنا تلقائيًا.'}
      </p>

      {hasFilters && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm font-bold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
        >
          <X size={16} />
          مسح الفلاتر
        </button>
      )}
    </div>
  );
}

export default function StudentsPage() {
  const navigate = useNavigate();

  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>(
    []
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>('all');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [updatingId, setUpdatingId] = useState<string | null>(
    null
  );

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = useCallback(
    (
      message: string,
      type: 'success' | 'error' = 'success'
    ) => {
      setToast({
        message,
        type,
      });

      window.setTimeout(() => {
        setToast(null);
      }, 3500);
    },
    []
  );

  const loadStudents = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [
          studentsResult,
          gradesResult,
          groupsResult,
          membersResult,
        ] = await Promise.all([
          supabase
            .from('users')
            .select(
              `
                id,
                full_name,
                phone,
                student_code,
                status,
                avatar_url,
                is_active,
                created_at
              `
            )
            .eq('role', 'student')
            .order('created_at', {
              ascending: false,
            }),

          supabase
            .from('grades')
            .select('id, name')
            .order('name', {
              ascending: true,
            }),

          supabase
            .from('groups')
            .select('id, name, grade_id')
            .order('name', {
              ascending: true,
            }),

          supabase
            .from('group_members')
            .select('student_id, group_id'),
        ]);

        if (studentsResult.error) {
          throw studentsResult.error;
        }

        if (gradesResult.error) {
          throw gradesResult.error;
        }

        if (groupsResult.error) {
          throw groupsResult.error;
        }

        if (membersResult.error) {
          throw membersResult.error;
        }

        setStudents(
          (studentsResult.data ?? []) as Student[]
        );

        setGrades(
          (gradesResult.data ?? []) as Grade[]
        );

        setGroups(
          (groupsResult.data ?? []) as Group[]
        );

        setGroupMembers(
          (membersResult.data ?? []) as GroupMember[]
        );
      } catch (error) {
        console.error(
          'Students page load error:',
          error
        );

        showToast(
          'حدث خطأ أثناء تحميل بيانات الطلاب',
          'error'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    setPage(1);
  }, [
    search,
    gradeFilter,
    groupFilter,
    statusFilter,
    pageSize,
  ]);

  const stats = useMemo(() => {
    return {
      total: students.length,

      active: students.filter(
        (student) => student.status === 'active'
      ).length,

      pending: students.filter(
        (student) => student.status === 'pending'
      ).length,

      suspended: students.filter(
        (student) => student.status === 'suspended'
      ).length,
    };
  }, [students]);

  const groupById = useMemo(() => {
    return new Map(
      groups.map((group) => [
        group.id,
        group,
      ])
    );
  }, [groups]);

  const gradeById = useMemo(() => {
    return new Map(
      grades.map((grade) => [
        grade.id,
        grade,
      ])
    );
  }, [grades]);

  const groupMemberByStudentId = useMemo(() => {
    const map = new Map<string, GroupMember>();

    for (const member of groupMembers) {
      if (!map.has(member.student_id)) {
        map.set(
          member.student_id,
          member
        );
      }
    }

    return map;
  }, [groupMembers]);

  const studentViews = useMemo<StudentView[]>(() => {
    return students.map((student) => {
      const membership =
        groupMemberByStudentId.get(student.id);

      const group = membership
        ? groupById.get(membership.group_id) ?? null
        : null;

      const grade = group
        ? gradeById.get(group.grade_id) ?? null
        : null;

      return {
        student,
        group,
        grade,
      };
    });
  }, [
    students,
    groupMemberByStudentId,
    groupById,
    gradeById,
  ]);

  const availableGroups = useMemo(() => {
    if (gradeFilter === 'all') {
      return groups;
    }

    return groups.filter(
      (group) =>
        group.grade_id === gradeFilter
    );
  }, [groups, gradeFilter]);

  useEffect(() => {
    if (
      groupFilter !== 'all' &&
      !availableGroups.some(
        (group) => group.id === groupFilter
      )
    ) {
      setGroupFilter('all');
    }
  }, [availableGroups, groupFilter]);

  const filteredStudents = useMemo(() => {
    const query =
      normalizeSearchValue(search);

    return studentViews.filter(
      ({
        student,
        group,
        grade,
      }) => {
        const searchableText = [
          student.full_name,
          student.phone,
          student.student_code ?? '',
        ]
          .join(' ')
          .toLocaleLowerCase('ar-EG');

        const matchesSearch =
          !query ||
          searchableText.includes(query);

        const matchesGrade =
          gradeFilter === 'all' ||
          grade?.id === gradeFilter;

        const matchesGroup =
          groupFilter === 'all' ||
          group?.id === groupFilter;

        const matchesStatus =
          statusFilter === 'all' ||
          student.status === statusFilter;

        return (
          matchesSearch &&
          matchesGrade &&
          matchesGroup &&
          matchesStatus
        );
      }
    );
  }, [
    studentViews,
    search,
    gradeFilter,
    groupFilter,
    statusFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredStudents.length /
        pageSize
    )
  );

  const safePage = Math.min(
    page,
    totalPages
  );

  const paginatedStudents = useMemo(() => {
    const start =
      (safePage - 1) * pageSize;

    return filteredStudents.slice(
      start,
      start + pageSize
    );
  }, [
    filteredStudents,
    safePage,
    pageSize,
  ]);

  const hasFilters =
    search.trim().length > 0 ||
    gradeFilter !== 'all' ||
    groupFilter !== 'all' ||
    statusFilter !== 'all';

  const visibleRange = useMemo(() => {
    if (filteredStudents.length === 0) {
      return {
        from: 0,
        to: 0,
      };
    }

    return {
      from:
        (safePage - 1) * pageSize + 1,
      to: Math.min(
        safePage * pageSize,
        filteredStudents.length
      ),
    };
  }, [
    filteredStudents.length,
    safePage,
    pageSize,
  ]);

  const resetFilters = () => {
    setSearch('');
    setGradeFilter('all');
    setGroupFilter('all');
    setStatusFilter('all');
    setPage(1);
  };

  const handleStatusChange = async (
    student: Student,
    nextStatus: UserStatus
  ) => {
    if (updatingId) {
      return;
    }

    try {
      setUpdatingId(student.id);

      const nextIsActive =
        nextStatus === 'active';

      const { error } = await supabase
        .from('users')
        .update({
          status: nextStatus,
          is_active: nextIsActive,
        })
        .eq('id', student.id);

      if (error) {
        throw error;
      }

      setStudents((current) =>
        current.map((item) =>
          item.id === student.id
            ? {
                ...item,
                status: nextStatus,
                is_active: nextIsActive,
              }
            : item
        )
      );

      if (nextStatus === 'active') {
        showToast(
          `تم تفعيل حساب ${student.full_name} بنجاح ✓`
        );
      } else if (
        nextStatus === 'suspended'
      ) {
        showToast(
          `تم إيقاف حساب ${student.full_name} بنجاح`
        );
      } else {
        showToast(
          'تم تحديث حالة الطالب بنجاح ✓'
        );
      }
    } catch (error) {
      console.error(
        'Student status update error:',
        error
      );

      showToast(
        'تعذر تغيير حالة حساب الطالب',
        'error'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const openProfile = (studentId: string) => {
    navigate(
      `/admin/students/${studentId}`
    );
  };

  const renderStatusAction = (
    student: Student
  ) => {
    const isUpdating =
      updatingId === student.id;

    if (student.status === 'pending') {
      return (
        <button
          type="button"
          disabled={isUpdating}
          onClick={() =>
            void handleStatusChange(
              student,
              'active'
            )
          }
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-400 transition hover:border-emerald-500/30 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUpdating ? (
            <Loader2
              size={14}
              className="animate-spin"
            />
          ) : (
            <UserCheck size={14} />
          )}
          تفعيل
        </button>
      );
    }

    if (student.status === 'active') {
      return (
        <button
          type="button"
          disabled={isUpdating}
          onClick={() =>
            void handleStatusChange(
              student,
              'suspended'
            )
          }
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 text-xs font-bold text-red-400 transition hover:border-red-500/30 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUpdating ? (
            <Loader2
              size={14}
              className="animate-spin"
            />
          ) : (
            <UserRoundX size={14} />
          )}
          إيقاف
        </button>
      );
    }

    if (
      student.status === 'suspended' ||
      student.status === 'rejected'
    ) {
      return (
        <button
          type="button"
          disabled={isUpdating}
          onClick={() =>
            void handleStatusChange(
              student,
              'active'
            )
          }
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-400 transition hover:border-emerald-500/30 hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUpdating ? (
            <Loader2
              size={14}
              className="animate-spin"
            />
          ) : (
            <Zap size={14} />
          )}
          تفعيل
        </button>
      );
    }

    return null;
  };

  return (
    <div
      dir="rtl"
      className="min-h-full bg-[#07090f] text-white"
    >
      <div className="mx-auto w-full max-w-[1800px] space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/10 bg-blue-500/[0.06] px-3 py-1.5 text-xs font-bold text-blue-400">
              <Users size={14} />
              إدارة الطلاب
            </div>

            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              الطلاب
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">
              إدارة ومتابعة جميع الطلاب المسجلين في
              منصة كيمياء أستاذ أحمد محمد رمضان.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadStudents(true)
            }
            disabled={refreshing}
            className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-white/[0.07] bg-[#11151d] px-4 text-sm font-bold text-slate-300 transition hover:border-white/[0.12] hover:bg-[#151a23] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 xl:self-auto"
          >
            <RefreshCw
              size={16}
              className={
                refreshing
                  ? 'animate-spin'
                  : ''
              }
            />
            تحديث البيانات
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="إجمالي الطلاب"
            value={stats.total}
            description="جميع الحسابات المسجلة"
            icon={<Users size={23} />}
            iconClassName="border-blue-500/10 bg-blue-500/10 text-blue-400"
            active={statusFilter === 'all'}
            onClick={() => {
              setStatusFilter('all');
              setPage(1);
            }}
          />

          <StatCard
            title="الطلاب النشطون"
            value={stats.active}
            description="حسابات يمكنها استخدام المنصة"
            icon={<ShieldCheck size={23} />}
            iconClassName="border-emerald-500/10 bg-emerald-500/10 text-emerald-400"
            active={statusFilter === 'active'}
            onClick={() => {
              setStatusFilter('active');
              setPage(1);
            }}
          />

          <StatCard
            title="بانتظار الموافقة"
            value={stats.pending}
            description="طلاب يحتاجون مراجعة الإدارة"
            icon={<AlertCircle size={23} />}
            iconClassName="border-amber-500/10 bg-amber-500/10 text-amber-400"
            active={statusFilter === 'pending'}
            onClick={() => {
              setStatusFilter('pending');
              setPage(1);
            }}
          />

          <StatCard
            title="الموقوفون"
            value={stats.suspended}
            description="حسابات تم تعطيلها"
            icon={<UserRoundX size={23} />}
            iconClassName="border-red-500/10 bg-red-500/10 text-red-400"
            active={statusFilter === 'suspended'}
            onClick={() => {
              setStatusFilter('suspended');
              setPage(1);
            }}
          />
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#11151d]">
          <div className="border-b border-white/[0.06] p-4 sm:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-600"
                />

                <input
                  type="text"
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="ابحث باسم الطالب أو الموبايل أو كود الطالب..."
                  className="h-12 w-full rounded-xl border border-white/[0.07] bg-[#0c1017] px-12 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/10"
                />

                {search && (
                  <button
                    type="button"
                    onClick={() =>
                      setSearch('')
                    }
                    className="absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.05] hover:text-white"
                    aria-label="مسح البحث"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                <Filter size={17} />
                <span className="hidden text-xs font-bold sm:inline">
                  الفلاتر
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 lg:flex-row">
              <FilterSelect
                value={gradeFilter}
                onChange={setGradeFilter}
                icon={
                  <GraduationCap
                    size={17}
                  />
                }
                ariaLabel="فلترة الصف الدراسي"
              >
                <option value="all">
                  كل الصفوف الدراسية
                </option>

                {grades.map((grade) => (
                  <option
                    key={grade.id}
                    value={grade.id}
                  >
                    {grade.name}
                  </option>
                ))}
              </FilterSelect>

              <FilterSelect
                value={groupFilter}
                onChange={setGroupFilter}
                icon={
                  <Users size={17} />
                }
                ariaLabel="فلترة المجموعة"
              >
                <option value="all">
                  كل المجموعات
                </option>

                {availableGroups.map(
                  (group) => (
                    <option
                      key={group.id}
                      value={group.id}
                    >
                      {group.name}
                    </option>
                  )
                )}
              </FilterSelect>

              <FilterSelect
                value={statusFilter}
                onChange={(value) =>
                  setStatusFilter(
                    value as StatusFilter
                  )
                }
                icon={
                  <Activity size={17} />
                }
                ariaLabel="فلترة حالة الحساب"
              >
                <option value="all">
                  كل الحالات
                </option>
                <option value="active">
                  نشط
                </option>
                <option value="pending">
                  بانتظار الموافقة
                </option>
                <option value="suspended">
                  موقوف
                </option>
                <option value="rejected">
                  مرفوض
                </option>
              </FilterSelect>

              {hasFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 text-sm font-bold text-slate-400 transition hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-white"
                >
                  <X size={16} />
                  مسح
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[430px] flex-col items-center justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-500/10 bg-blue-500/[0.06]">
                <Loader2
                  size={25}
                  className="animate-spin text-blue-400"
                />
              </div>

              <p className="mt-4 text-sm font-bold text-slate-400">
                جاري تحميل بيانات الطلاب...
              </p>

              <p className="mt-1 text-xs text-slate-600">
                يتم جلب الطلاب والمجموعات والصفوف الدراسية
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <EmptyState
              hasFilters={hasFilters}
              onReset={resetFilters}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[1050px] border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.05] bg-white/[0.015] text-right">
                      <th className="px-5 py-4 text-xs font-bold text-slate-600">
                        الطالب
                      </th>

                      <th className="px-5 py-4 text-xs font-bold text-slate-600">
                        كود الطالب
                      </th>

                      <th className="px-5 py-4 text-xs font-bold text-slate-600">
                        الموبايل
                      </th>

                      <th className="px-5 py-4 text-xs font-bold text-slate-600">
                        الصف / المجموعة
                      </th>

                      <th className="px-5 py-4 text-xs font-bold text-slate-600">
                        الحالة
                      </th>

                      <th className="px-5 py-4 text-xs font-bold text-slate-600">
                        تاريخ التسجيل
                      </th>

                      <th className="px-5 py-4 text-xs font-bold text-slate-600">
                        الإجراءات
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedStudents.map(
                      ({
                        student,
                        group,
                        grade,
                      }) => {
                        const initials =
                          getInitials(
                            student.full_name
                          );

                        return (
                          <tr
                            key={student.id}
                            className="group border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                          >
                            <td className="px-5 py-4">
                              <button
                                type="button"
                                onClick={() =>
                                  openProfile(
                                    student.id
                                  )
                                }
                                className="flex items-center gap-3 text-right"
                              >
                                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-500/10 bg-blue-500/[0.08] text-sm font-black text-blue-400">
                                  {student.avatar_url ? (
                                    <img
                                      src={
                                        student.avatar_url
                                      }
                                      alt={
                                        student.full_name
                                      }
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    initials
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p className="max-w-[230px] truncate text-sm font-bold text-white transition-colors group-hover:text-blue-300">
                                    {
                                      student.full_name
                                    }
                                  </p>

                                  <p className="mt-1 text-xs text-slate-600">
                                    طالب
                                  </p>
                                </div>
                              </button>
                            </td>

                            <td className="px-5 py-4">
                              <span className="rounded-lg border border-blue-500/10 bg-blue-500/[0.05] px-2.5 py-1.5 font-mono text-xs font-bold text-blue-400">
                                {student.student_code ??
                                  'غير مُحدد'}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <div className="space-y-1">
                                <p
                                  dir="ltr"
                                  className="w-fit text-sm font-semibold text-slate-300"
                                >
                                  {student.phone ||
                                    'غير مُحدد'}
                                </p>

                                <p className="text-[11px] text-slate-600">
                                  رقم الطالب
                                </p>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <div className="space-y-1">
                                <p className="text-sm font-bold text-slate-300">
                                  {grade?.name ??
                                    'غير محدد'}
                                </p>

                                <p className="text-xs text-slate-600">
                                  {group?.name ??
                                    'بدون مجموعة'}
                                </p>
                              </div>
                            </td>

                            <td className="px-5 py-4">
                              <StatusBadge
                                status={
                                  student.status
                                }
                              />
                            </td>

                            <td className="px-5 py-4">
                              <span className="whitespace-nowrap text-xs font-medium text-slate-500">
                                {formatDate(
                                  student.created_at
                                )}
                              </span>
                            </td>

                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openProfile(
                                      student.id
                                    )
                                  }
                                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-blue-500/15 bg-blue-500/[0.06] px-3 text-xs font-bold text-blue-400 transition hover:border-blue-500/30 hover:bg-blue-500/10"
                                >
                                  <Eye
                                    size={15}
                                  />
                                  البروفايل
                                </button>

                                {renderStatusAction(
                                  student
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-white/[0.04] lg:hidden">
                {paginatedStudents.map(
                  ({
                    student,
                    group,
                    grade,
                  }) => {
                    const initials =
                      getInitials(
                        student.full_name
                      );

                    return (
                      <div
                        key={student.id}
                        className="p-4 transition hover:bg-white/[0.02]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-500/10 bg-blue-500/[0.08] text-sm font-black text-blue-400">
                            {student.avatar_url ? (
                              <img
                                src={
                                  student.avatar_url
                                }
                                alt={
                                  student.full_name
                                }
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              initials
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openProfile(
                                    student.id
                                  )
                                }
                                className="min-w-0 text-right"
                              >
                                <p className="truncate text-sm font-black text-white">
                                  {
                                    student.full_name
                                  }
                                </p>

                                <p className="mt-1 font-mono text-[11px] text-blue-400">
                                  {student.student_code ??
                                    'بدون كود'}
                                </p>
                              </button>

                              <StatusBadge
                                status={
                                  student.status
                                }
                              />
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                <p className="text-[10px] font-bold text-slate-600">
                                  الموبايل
                                </p>

                                <p
                                  dir="ltr"
                                  className="mt-1 text-xs font-semibold text-slate-300"
                                >
                                  {student.phone ||
                                    'غير محدد'}
                                </p>
                              </div>

                              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                <p className="text-[10px] font-bold text-slate-600">
                                  الصف
                                </p>

                                <p className="mt-1 truncate text-xs font-semibold text-slate-300">
                                  {grade?.name ??
                                    'غير محدد'}
                                </p>
                              </div>

                              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                <p className="text-[10px] font-bold text-slate-600">
                                  المجموعة
                                </p>

                                <p className="mt-1 truncate text-xs font-semibold text-slate-300">
                                  {group?.name ??
                                    'بدون مجموعة'}
                                </p>
                              </div>

                              <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                <p className="text-[10px] font-bold text-slate-600">
                                  التسجيل
                                </p>

                                <p className="mt-1 text-xs font-semibold text-slate-300">
                                  {formatDate(
                                    student.created_at
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="mt-3 flex gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  openProfile(
                                    student.id
                                  )
                                }
                                className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-blue-500/15 bg-blue-500/[0.06] text-xs font-bold text-blue-400 transition hover:bg-blue-500/10"
                              >
                                <Eye
                                  size={15}
                                />
                                عرض البروفايل
                              </button>

                              <div className="shrink-0">
                                {renderStatusAction(
                                  student
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              <div className="flex flex-col gap-4 border-t border-white/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs font-medium text-slate-600">
                    عرض{' '}
                    <span className="font-bold text-slate-400">
                      {visibleRange.from.toLocaleString(
                        'ar-EG'
                      )}
                    </span>{' '}
                    إلى{' '}
                    <span className="font-bold text-slate-400">
                      {visibleRange.to.toLocaleString(
                        'ar-EG'
                      )}
                    </span>{' '}
                    من أصل{' '}
                    <span className="font-bold text-slate-400">
                      {filteredStudents.length.toLocaleString(
                        'ar-EG'
                      )}
                    </span>
                  </p>

                  <div className="h-4 w-px bg-white/[0.08]" />

                  <select
                    value={pageSize}
                    onChange={(event) =>
                      setPageSize(
                        Number(
                          event.target.value
                        )
                      )
                    }
                    className="rounded-lg border border-white/[0.06] bg-[#0c1017] px-2 py-1.5 text-xs font-bold text-slate-400 outline-none"
                    aria-label="عدد الطلاب في الصفحة"
                  >
                    <option value={10}>
                      10 / صفحة
                    </option>
                    <option value={20}>
                      20 / صفحة
                    </option>
                    <option value={50}>
                      50 / صفحة
                    </option>
                    <option value={100}>
                      100 / صفحة
                    </option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                      )
                    }
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-xs font-bold text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight
                      size={15}
                    />
                    السابق
                  </button>

                  <div className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-blue-500/15 bg-blue-500/[0.06] px-3 text-xs font-black text-blue-400">
                    {safePage.toLocaleString(
                      'ar-EG'
                    )}
                    <span className="mx-1 text-slate-700">
                      /
                    </span>
                    {totalPages.toLocaleString(
                      'ar-EG'
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={
                      safePage >=
                      totalPages
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.min(
                            totalPages,
                            current + 1
                          )
                      )
                    }
                    className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 text-xs font-bold text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    التالي
                    <ChevronLeft
                      size={15}
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {!loading && students.length > 0 && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-[#11151d]/60 px-4 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/[0.07] text-blue-400">
              <CircleUserRound size={18} />
            </div>

            <p className="text-xs leading-6 text-slate-600">
              البيانات المعروضة من قاعدة Supabase
              مباشرة، وتغيير حالة الحساب يتم حفظه
              فورًا في جدول{' '}
              <span className="font-mono text-slate-500">
                users
              </span>
              .
            </p>
          </div>
        )}
      </div>

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 sm:left-auto sm:right-5 sm:w-auto sm:max-w-sm sm:translate-x-0"
          role="status"
          aria-live="polite"
        >
          <div
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-xl ${
              toast.type === 'success'
                ? 'border-emerald-500/20 bg-[#0d1714]/95'
                : 'border-red-500/20 bg-[#180f12]/95'
            }`}
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                toast.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {toast.type ===
              'success' ? (
                <Check
                  size={18}
                  strokeWidth={3}
                />
              ) : (
                <AlertCircle
                  size={18}
                />
              )}
            </div>

            <p className="flex-1 text-sm font-bold text-slate-200">
              {toast.message}
            </p>

            <button
              type="button"
              onClick={() =>
                setToast(null)
              }
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white/[0.05] hover:text-white"
              aria-label="إغلاق"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}