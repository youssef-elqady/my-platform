
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

type UserStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'rejected';

type FilterStatus = 'all' | UserStatus;

interface DashboardUser {
  id: string;
  role: 'admin' | 'student';
  full_name: string;
  phone: string | null;
  student_code: string | null;
  status: UserStatus;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface DashboardStats {
  totalUsers: number;
  totalStudents: number;
  activeStudents: number;
  pendingStudents: number;
  suspendedStudents: number;
  rejectedStudents: number;
  totalCourses: number;
  totalLessons: number;
  totalExams: number;
  totalEvents: number;
  totalSessions: number;
  totalVideoWatch: number;
}

const statusConfig: Record<
  UserStatus,
  {
    label: string;
    className: string;
    icon: string;
  }
> = {
  active: {
    label: 'نشط',
    className:
      'border-emerald-400/20 bg-emerald-400/10 text-emerald-400',
    icon: '✓',
  },
  pending: {
    label: 'قيد المراجعة',
    className:
      'border-amber-400/20 bg-amber-400/10 text-amber-400',
    icon: '◷',
  },
  suspended: {
    label: 'موقوف',
    className:
      'border-red-400/20 bg-red-400/10 text-red-400',
    icon: '!',
  },
  rejected: {
    label: 'مرفوض',
    className:
      'border-slate-400/20 bg-slate-400/10 text-slate-400',
    icon: '×',
  },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function StatCard({
  title,
  value,
  description,
  icon,
  accent,
  onClick,
}: {
  title: string;
  value: number;
  description: string;
  icon: string;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.035] p-5 text-right transition duration-300 hover:-translate-y-1 hover:border-white/[0.14] hover:bg-white/[0.055]"
    >
      <div
        className={`absolute -left-10 -top-10 h-32 w-32 rounded-full blur-3xl opacity-20 ${accent}`}
      />

      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-black/20 text-xl transition duration-300 group-hover:scale-110">
            {icon}
          </div>

          <span className="text-xs text-slate-600">
            تفاصيل
          </span>
        </div>

        <p className="mt-5 text-sm font-medium text-slate-400">
          {title}
        </p>

        <p className="mt-2 text-3xl font-black tracking-tight text-white">
          {value.toLocaleString('ar-EG')}
        </p>

        <p className="mt-2 text-xs text-slate-500">
          {description}
        </p>
      </div>
    </button>
  );
}

function StatusBadge({
  status,
}: {
  status: UserStatus;
}) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold ${config.className}`}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}

function MiniMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
      <div className="flex items-center justify-between">
        <span className="text-lg">{icon}</span>
        <span className="text-xs text-slate-600">
          {label}
        </span>
      </div>

      <p className="mt-3 text-2xl font-black text-white">
        {value.toLocaleString('ar-EG')}
      </p>
    </div>
  );
}

export default function AdminDashboard() {
  const { profile, signOut } = useAuthStore();

  const [users, setUsers] = useState<DashboardUser[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalStudents: 0,
    activeStudents: 0,
    pendingStudents: 0,
    suspendedStudents: 0,
    rejectedStudents: 0,
    totalCourses: 0,
    totalLessons: 0,
    totalExams: 0,
    totalEvents: 0,
    totalSessions: 0,
    totalVideoWatch: 0,
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<FilterStatus>('all');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const [darkMode, setDarkMode] = useState(true);

  const showMessage = useCallback((text: string) => {
    setMessage(text);

    window.setTimeout(() => {
      setMessage(null);
    }, 3500);
  }, []);

  const countTable = useCallback(
    async (table: string) => {
      const { count, error } = await supabase
        .from(table)
        .select('*', {
          count: 'exact',
          head: true,
        });

      if (error) {
        console.warn(
          `Could not count ${table}:`,
          error.message
        );
        return 0;
      }

      return count || 0;
    },
    []
  );

  const loadDashboard = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const [
          usersResult,
          coursesCount,
          lessonsCount,
          examsCount,
          eventsCount,
          sessionsCount,
          videoWatchCount,
        ] = await Promise.all([
          supabase
            .from('users')
            .select(
              `
                id,
                role,
                full_name,
                phone,
                student_code,
                status,
                avatar_url,
                is_active,
                created_at
              `
            )
            .order('created_at', {
              ascending: false,
            }),

          countTable('courses'),
          countTable('lessons'),
          countTable('exams'),
          countTable('analytics_events'),
          countTable('analytics_sessions'),
          countTable('analytics_video_watch'),
        ]);

        if (usersResult.error) {
          throw usersResult.error;
        }

        const allUsers =
          (usersResult.data || []) as DashboardUser[];

        const studentUsers = allUsers.filter(
          (user) => user.role === 'student'
        );

        setUsers(studentUsers);

        setStats({
          totalUsers: allUsers.length,
          totalStudents: studentUsers.length,

          activeStudents: studentUsers.filter(
            (user) => user.status === 'active'
          ).length,

          pendingStudents: studentUsers.filter(
            (user) => user.status === 'pending'
          ).length,

          suspendedStudents: studentUsers.filter(
            (user) => user.status === 'suspended'
          ).length,

          rejectedStudents: studentUsers.filter(
            (user) => user.status === 'rejected'
          ).length,

          totalCourses: coursesCount,
          totalLessons: lessonsCount,
          totalExams: examsCount,
          totalEvents: eventsCount,
          totalSessions: sessionsCount,
          totalVideoWatch: videoWatchCount,
        });
      } catch (error) {
        console.error(
          'Admin dashboard load error:',
          error
        );

        showMessage(
          'حدث خطأ أثناء تحميل بيانات لوحة التحكم'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [countTable, showMessage]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users
      .filter((user) => {
        const matchesStatus =
          statusFilter === 'all' ||
          user.status === statusFilter;

        if (!matchesStatus) {
          return false;
        }

        if (!query) {
          return true;
        }

        return (
          user.full_name
            .toLowerCase()
            .includes(query) ||
          (user.phone || '')
            .toLowerCase()
            .includes(query) ||
          (user.student_code || '')
            .toLowerCase()
            .includes(query)
        );
      })
      .slice(0, 10);
  }, [users, search, statusFilter]);

  const pendingUsers = useMemo(
    () =>
      users.filter(
        (user) => user.status === 'pending'
      ),
    [users]
  );

  const updateStatus = async (
    userId: string,
    status: UserStatus
  ) => {
    try {
      setUpdatingId(userId);

      const { error } = await supabase
        .from('users')
        .update({
          status,
          is_active: status === 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) {
        throw error;
      }

      const messages: Record<
        UserStatus,
        string
      > = {
        active: 'تم تفعيل حساب الطالب بنجاح',
        suspended: 'تم إيقاف حساب الطالب',
        rejected: 'تم رفض طلب الطالب',
        pending: 'تم وضع الحساب قيد المراجعة',
      };

      showMessage(messages[status]);

      await loadDashboard(true);
    } catch (error) {
      console.error(
        'Status update error:',
        error
      );

      showMessage(
        'تعذر تحديث حالة الطالب'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const navigate = (path: string) => {
    window.location.href = path;
  };

  const quickActions = [
    {
      icon: '👨‍🎓',
      title: 'إدارة الطلاب',
      description: 'عرض وقبول وإدارة الطلاب',
      path: '/admin/students',
    },
    {
      icon: '📚',
      title: 'الكورسات',
      description: 'إدارة الكورسات والمحتوى',
      path: '/admin/courses',
    },
    {
      icon: '🎥',
      title: 'الدروس',
      description: 'إدارة الدروس والفيديوهات',
      path: '/admin/lessons',
    },
    {
      icon: '📝',
      title: 'الامتحانات',
      description: 'إنشاء وإدارة الاختبارات',
      path: '/admin/exams',
    },
    {
      icon: '📍',
      title: 'الحضور',
      description: 'متابعة حضور الطلاب',
      path: '/admin/attendance',
    },
  ];

  return (
    <div
      dir="rtl"
      className={
        darkMode
          ? 'min-h-screen bg-[#07090f] text-white'
          : 'min-h-screen bg-slate-100 text-slate-900'
      }
    >
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[500px] w-[500px] rounded-full bg-amber-500/[0.07] blur-[140px]" />

        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-500/[0.07] blur-[140px]" />

        {darkMode && (
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
              backgroundSize: '45px 45px',
            }}
          />
        )}
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-[1700px]">
        {/* Sidebar */}
        <aside
          className={`hidden w-72 shrink-0 border-l p-5 lg:block ${
            darkMode
              ? 'border-white/[0.06] bg-black/10'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="sticky top-5">
            {/* Brand */}
            <div className="mb-8 flex items-center gap-3 px-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-xl font-black text-black shadow-lg shadow-amber-500/20">
                أ
              </div>

              <div>
                <h2 className="font-black">
                  منصة أ. أحمد
                </h2>

                <p className="text-xs text-slate-500">
                  نظام إدارة التعليم
                </p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-1">
              <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                الرئيسية
              </p>

              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl bg-amber-500/10 px-4 py-3 text-right text-sm font-bold text-amber-400"
              >
                <span>▦</span>
                لوحة التحكم
              </button>

              {[
                ['👨‍🎓', 'الطلاب', '/admin/students'],
                ['👥', 'المجموعات', '/admin/groups'],
                ['📚', 'الكورسات', '/admin/courses'],
                ['🎥', 'الدروس', '/admin/lessons'],
                ['📝', 'الواجبات', '/admin/assignments'],
                ['📋', 'الامتحانات', '/admin/exams'],
                ['📊', 'الدرجات', '/admin/grades'],
                ['📍', 'الحضور', '/admin/attendance'],
              ].map(([icon, label, path]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    navigate(path)
                  }
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    darkMode
                      ? 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="w-5 text-center">
                    {icon}
                  </span>

                  {label}
                </button>
              ))}

              <div className="my-5 h-px bg-white/[0.05]" />

              <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">
                الإدارة
              </p>

              {[
                ['🎟️', 'أكواد التفعيل', '/admin/activation-codes'],
                ['👨‍💼', 'المساعدون', '/admin/staff'],
                ['🔔', 'الإشعارات', '/admin/notifications'],
                ['⚙️', 'الإعدادات', '/admin/settings'],
              ].map(([icon, label, path]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    navigate(path)
                  }
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                    darkMode
                      ? 'text-slate-400 hover:bg-white/[0.04] hover:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="w-5 text-center">
                    {icon}
                  </span>

                  {label}
                </button>
              ))}
            </nav>

            {/* Admin profile */}
            <div
              className={`mt-8 rounded-2xl border p-4 ${
                darkMode
                  ? 'border-white/[0.06] bg-white/[0.025]'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-black text-white">
                  {profile?.full_name?.charAt(0) ||
                    'أ'}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {profile?.full_name ||
                      'مدير المنصة'}
                  </p>

                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

                    <span className="text-[11px] text-slate-500">
                      حساب المدير
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <header
            className={`mb-8 flex flex-col gap-4 rounded-3xl border p-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between ${
              darkMode
                ? 'border-white/[0.06] bg-white/[0.025]'
                : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-xl">
                👋
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  لوحة الإدارة الرئيسية
                </p>

                <h1 className="text-lg font-black sm:text-xl">
                  أهلاً بك يا{' '}
                  {profile?.full_name ||
                    'مدير المنصة'}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden items-center gap-2 rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-3 py-2 sm:flex">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

                <span className="text-xs font-bold text-emerald-400">
                  النظام يعمل
                </span>
              </div>

              <button
                type="button"
                onClick={() =>
                  setDarkMode(
                    (current) => !current
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] transition hover:bg-white/[0.07]"
                title="تغيير الوضع"
              >
                {darkMode ? '☀️' : '🌙'}
              </button>

              <button
                type="button"
                onClick={() =>
                  loadDashboard(true)
                }
                disabled={refreshing}
                className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 text-sm font-bold transition hover:bg-white/[0.07] disabled:opacity-50"
              >
                <span
                  className={
                    refreshing
                      ? 'animate-spin'
                      : ''
                  }
                >
                  ↻
                </span>

                <span className="hidden sm:inline">
                  تحديث
                </span>
              </button>

              <button
                type="button"
                onClick={signOut}
                className="flex h-10 items-center gap-2 rounded-xl border border-red-500/10 bg-red-500/5 px-3 text-sm font-bold text-red-400 transition hover:bg-red-500/10"
              >
                خروج
              </button>
            </div>
          </header>

          {/* Hero */}
          <section className="mb-8">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 text-sm font-bold text-amber-400">
                  مركز التحكم
                </p>

                <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
                  نظرة عامة على المنصة
                </h2>

                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  تابع الطلاب والمحتوى والامتحانات
                  والنشاطات المهمة من مكان واحد.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  navigate('/admin/students')
                }
                className="rounded-xl bg-gradient-to-l from-amber-500 to-orange-500 px-5 py-3 text-sm font-black text-black shadow-lg shadow-amber-500/10 transition hover:-translate-y-0.5"
              >
                + إدارة الطلاب
              </button>
            </div>
          </section>

          {/* Main stats */}
          <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="إجمالي الطلاب"
              value={stats.totalStudents}
              description="حسابات الطلاب"
              icon="👨‍🎓"
              accent="bg-blue-500"
              onClick={() =>
                navigate('/admin/students')
              }
            />

            <StatCard
              title="الطلاب النشطون"
              value={stats.activeStudents}
              description="لديهم وصول للمنصة"
              icon="✓"
              accent="bg-emerald-500"
            />

            <StatCard
              title="طلبات معلقة"
              value={stats.pendingStudents}
              description="تحتاج قرار الإدارة"
              icon="◷"
              accent="bg-amber-500"
              onClick={() =>
                setStatusFilter('pending')
              }
            />

            <StatCard
              title="حسابات موقوفة"
              value={stats.suspendedStudents}
              description="الوصول موقوف"
              icon="!"
              accent="bg-red-500"
            />
          </section>

          {/* Content stats */}
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MiniMetric
              label="الكورسات"
              value={stats.totalCourses}
              icon="📚"
            />

            <MiniMetric
              label="الدروس"
              value={stats.totalLessons}
              icon="🎥"
            />

            <MiniMetric
              label="الامتحانات"
              value={stats.totalExams}
              icon="📝"
            />

            <MiniMetric
              label="أحداث التحليلات"
              value={stats.totalEvents}
              icon="📈"
            />
          </section>

          {/* Pending + quick actions */}
          <section className="mb-8 grid gap-5 xl:grid-cols-3">
            {/* Pending */}
            <div className="relative overflow-hidden rounded-3xl border border-amber-500/10 bg-gradient-to-br from-amber-500/[0.08] to-transparent p-6 xl:col-span-2">
              <div className="absolute -left-20 -top-20 h-52 w-52 rounded-full bg-amber-500/10 blur-3xl" />

              <div className="relative">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                        🚨
                      </span>

                      <span className="text-xs font-bold text-amber-400">
                        يحتاج انتباهك
                      </span>
                    </div>

                    <h3 className="text-xl font-black">
                      طلبات التسجيل
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      الطلاب الذين ينتظرون قرار الإدارة.
                    </p>
                  </div>

                  <div className="text-4xl font-black text-amber-400">
                    {pendingUsers.length.toLocaleString(
                      'ar-EG'
                    )}
                  </div>
                </div>

                {pendingUsers.length === 0 ? (
                  <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.04] p-5">
                    <p className="font-bold text-emerald-400">
                      ✓ كل شيء ممتاز
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      لا توجد طلبات تسجيل معلقة
                      حاليًا.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingUsers
                      .slice(0, 4)
                      .map((user) => (
                        <div
                          key={user.id}
                          className="flex flex-col gap-3 rounded-2xl border border-white/[0.06] bg-black/10 p-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10 font-black text-amber-400">
                              {user.full_name.charAt(
                                0
                              )}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold">
                                {user.full_name}
                              </p>

                              <p className="text-xs text-slate-500">
                                {user.student_code ||
                                  'بدون كود'}
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={
                                updatingId ===
                                user.id
                              }
                              onClick={() =>
                                updateStatus(
                                  user.id,
                                  'active'
                                )
                              }
                              className="rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
                            >
                              قبول
                            </button>

                            <button
                              type="button"
                              disabled={
                                updatingId ===
                                user.id
                              }
                              onClick={() =>
                                updateStatus(
                                  user.id,
                                  'rejected'
                                )
                              }
                              className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                            >
                              رفض
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Quick actions */}
            <div className="rounded-3xl border border-white/[0.06] bg-white/[0.025] p-6">
              <h3 className="text-lg font-black">
                إجراءات سريعة
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                الوصول السريع للأقسام المهمة.
              </p>

              <div className="mt-5 space-y-2">
                {quickActions.map(
                  (action) => (
                    <button
                      key={action.title}
                      type="button"
                      onClick={() =>
                        navigate(action.path)
                      }
                      className="group flex w-full items-center gap-3 rounded-2xl border border-white/[0.05] bg-black/10 p-3 text-right transition hover:border-amber-500/20 hover:bg-amber-500/[0.04]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-lg">
                        {action.icon}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold">
                          {action.title}
                        </span>

                        <span className="mt-0.5 block truncate text-[11px] text-slate-600">
                          {action.description}
                        </span>
                      </span>

                      <span className="text-slate-600 transition group-hover:-translate-x-1">
                        ←
                      </span>
                    </button>
                  )
                )}
              </div>
            </div>
          </section>

          {/* Analytics overview */}
          <section className="mb-8 rounded-3xl border border-white/[0.06] bg-white/[0.025] p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    📊
                  </span>

                  <h3 className="text-lg font-black">
                    نشاط المنصة
                  </h3>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  مؤشرات سريعة من نظام التحليلات.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniMetric
                label="الجلسات"
                value={stats.totalSessions}
                icon="🖥️"
              />

              <MiniMetric
                label="مشاهدات الفيديو"
                value={stats.totalVideoWatch}
                icon="▶️"
              />

              <MiniMetric
                label="أحداث"
                value={stats.totalEvents}
                icon="⚡"
              />

              <MiniMetric
                label="المرفوضون"
                value={stats.rejectedStudents}
                icon="×"
              />
            </div>
          </section>

          {/* Students */}
          <section className="overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.025]">
            <div className="border-b border-white/[0.06] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      👨‍🎓
                    </span>

                    <h3 className="text-lg font-black">
                      الطلاب
                    </h3>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">
                    أحدث الطلاب والحسابات المسجلة.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  {/* Search */}
                  <div className="relative">
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600">
                      ⌕
                    </span>

                    <input
                      value={search}
                      onChange={(event) =>
                        setSearch(
                          event.target.value
                        )
                      }
                      placeholder="ابحث باسم الطالب..."
                      className="w-full rounded-xl border border-white/[0.07] bg-black/10 py-2.5 pr-9 pl-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-amber-500/40 sm:w-64"
                    />
                  </div>

                  {/* Status filter */}
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(
                        event.target
                          .value as FilterStatus
                      )
                    }
                    className="rounded-xl border border-white/[0.07] bg-[#10141d] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-amber-500/40"
                  >
                    <option value="all">
                      كل الحالات
                    </option>
                    <option value="pending">
                      قيد المراجعة
                    </option>
                    <option value="active">
                      نشط
                    </option>
                    <option value="suspended">
                      موقوف
                    </option>
                    <option value="rejected">
                      مرفوض
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-amber-400" />

                <p className="text-sm text-slate-500">
                  جاري تحميل بيانات الطلاب...
                </p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-14 text-center">
                <div className="mb-3 text-4xl">
                  🔎
                </div>

                <p className="font-bold">
                  لا توجد نتائج
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  جرّب تغيير البحث أو فلتر الحالة.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-right">
                  <thead>
                    <tr className="border-b border-white/[0.05] text-xs text-slate-600">
                      <th className="px-5 py-4 font-bold">
                        الطالب
                      </th>

                      <th className="px-5 py-4 font-bold">
                        الكود
                      </th>

                      <th className="px-5 py-4 font-bold">
                        الهاتف
                      </th>

                      <th className="px-5 py-4 font-bold">
                        الحالة
                      </th>

                      <th className="px-5 py-4 font-bold">
                        التسجيل
                      </th>

                      <th className="px-5 py-4 font-bold">
                        إجراء
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.map(
                      (user) => (
                        <tr
                          key={user.id}
                          className="border-b border-white/[0.04] transition hover:bg-white/[0.025]"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.07] bg-gradient-to-br from-slate-700 to-slate-900 font-black">
                                {user.full_name.charAt(
                                  0
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate font-bold">
                                  {user.full_name}
                                </p>

                                <p className="mt-0.5 text-[11px] text-slate-600">
                                  طالب
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 font-mono text-xs text-amber-400">
                            {user.student_code ||
                              '—'}
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-400">
                            {user.phone || '—'}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              status={
                                user.status
                              }
                            />
                          </td>

                          <td className="px-5 py-4 text-xs text-slate-500">
                            {formatDate(
                              user.created_at
                            )}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex gap-1">
                              {user.status ===
                                'pending' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={
                                      updatingId ===
                                      user.id
                                    }
                                    onClick={() =>
                                      updateStatus(
                                        user.id,
                                        'active'
                                      )
                                    }
                                    className="rounded-lg px-2.5 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-40"
                                  >
                                    قبول
                                  </button>

                                  <button
                                    type="button"
                                    disabled={
                                      updatingId ===
                                      user.id
                                    }
                                    onClick={() =>
                                      updateStatus(
                                        user.id,
                                        'rejected'
                                      )
                                    }
                                    className="rounded-lg px-2.5 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
                                  >
                                    رفض
                                  </button>
                                </>
                              )}

                              {user.status ===
                                'active' && (
                                <button
                                  type="button"
                                  disabled={
                                    updatingId ===
                                    user.id
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      user.id,
                                      'suspended'
                                    )
                                  }
                                  className="rounded-lg px-2.5 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
                                >
                                  إيقاف
                                </button>
                              )}

                              {(user.status ===
                                'suspended' ||
                                user.status ===
                                  'rejected') && (
                                <button
                                  type="button"
                                  disabled={
                                    updatingId ===
                                    user.id
                                  }
                                  onClick={() =>
                                    updateStatus(
                                      user.id,
                                      'active'
                                    )
                                  }
                                  className="rounded-lg px-2.5 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-40"
                                >
                                  تفعيل
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-white/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-600">
                عرض{' '}
                {filteredUsers.length.toLocaleString(
                  'ar-EG'
                )}{' '}
                من{' '}
                {users.length.toLocaleString(
                  'ar-EG'
                )}{' '}
                طالب
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate('/admin/students')
                }
                className="text-xs font-bold text-amber-400 transition hover:text-amber-300"
              >
                عرض كل الطلاب ←
              </button>
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-8 flex flex-col gap-2 border-t border-white/[0.05] pt-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
              منصة كيمياء أستاذ أحمد محمد رمضان
            </p>

            <p>
              لوحة الإدارة • نظام آمن ومتكامل
            </p>
          </footer>
        </main>
      </div>

      {/* Toast */}
      {message && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#11151d]/95 px-5 py-3 text-sm font-bold text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              ✓
            </span>

            {message}
          </div>
        </div>
      )}
    </div>
  );
}
