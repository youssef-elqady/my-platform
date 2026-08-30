
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

type UserStatus = 'pending' | 'active' | 'suspended' | 'rejected';

interface Student {
  id: string;
  full_name: string;
  phone: string | null;
  student_code: string | null;
  status: UserStatus;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

const statusConfig: Record<
  UserStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'قيد المراجعة',
    className:
      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  active: {
    label: 'نشط',
    className:
      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  suspended: {
    label: 'موقوف',
    className:
      'bg-red-500/10 text-red-400 border-red-500/20',
  },
  rejected: {
    label: 'مرفوض',
    className:
      'bg-slate-500/10 text-slate-400 border-slate-500/20',
  },
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

function StatusBadge({ status }: { status: UserStatus }) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${config.className}`}
    >
      {config.label}
    </span>
  );
}

export default function AdminStudents() {
  const { profile } = useAuthStore();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | UserStatus
  >('all');

  const [message, setMessage] = useState<string | null>(null);

  const showMessage = (text: string) => {
    setMessage(text);

    window.setTimeout(() => {
      setMessage(null);
    }, 3000);
  };

  const loadStudents = useCallback(
    async (silent = false) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const { data, error } = await supabase
          .from('users')
          .select(`
            id,
            full_name,
            phone,
            student_code,
            status,
            avatar_url,
            is_active,
            created_at
          `)
          .eq('role', 'student')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setStudents((data || []) as Student[]);
      } catch (error) {
        console.error('Students load error:', error);
        showMessage('حدث خطأ أثناء تحميل الطلاب');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.full_name.toLowerCase().includes(query) ||
        (student.phone || '').includes(query) ||
        (student.student_code || '')
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === 'all' ||
        student.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [students, search, statusFilter]);

  const stats = useMemo(
    () => ({
      total: students.length,
      active: students.filter(
        (s) => s.status === 'active'
      ).length,
      pending: students.filter(
        (s) => s.status === 'pending'
      ).length,
      suspended: students.filter(
        (s) => s.status === 'suspended'
      ).length,
      rejected: students.filter(
        (s) => s.status === 'rejected'
      ).length,
    }),
    [students]
  );

  const updateStatus = async (
    studentId: string,
    status: UserStatus
  ) => {
    try {
      setUpdatingId(studentId);

      const { error } = await supabase
        .from('users')
        .update({
          status,
          is_active: status === 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', studentId);

      if (error) {
        throw error;
      }

      if (status === 'active') {
        showMessage('تم تفعيل الطالب بنجاح');
      } else if (status === 'suspended') {
        showMessage('تم إيقاف الطالب');
      } else if (status === 'rejected') {
        showMessage('تم رفض الطالب');
      } else {
        showMessage('تم تحديث حالة الطالب');
      }

      await loadStudents(true);
    } catch (error) {
      console.error('Status update error:', error);
      showMessage('تعذر تحديث حالة الطالب');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#07090f] text-white"
    >
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-blue-500/10 blur-[120px]" />

        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '45px 45px',
          }}
        />
      </div>

      <div className="relative mx-auto min-h-screen max-w-[1600px] p-4 sm:p-6 lg:p-8">

        {/* Header */}
        <header className="mb-8 flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                window.location.href = '/admin';
              }}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-lg transition hover:bg-white/[0.07]"
            >
              →
            </button>

            <div>
              <p className="text-xs text-amber-400">
                إدارة المنصة
              </p>

              <h1 className="mt-1 text-2xl font-black">
                إدارة الطلاب
              </h1>

              <p className="mt-1 text-xs text-slate-500">
                أهلاً بك يا {profile?.full_name || 'مدير المنصة'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadStudents(true)}
            disabled={refreshing}
            className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 text-sm font-bold transition hover:bg-white/[0.07] disabled:opacity-50"
          >
            <span
              className={refreshing ? 'animate-spin' : ''}
            >
              ↻
            </span>

            تحديث البيانات
          </button>
        </header>

        {/* Title */}
        <section className="mb-7">
          <p className="mb-2 text-sm font-bold text-amber-400">
            الطلاب
          </p>

          <h2 className="text-3xl font-black sm:text-4xl">
            جميع الطلاب
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            إدارة حسابات الطلاب وحالات الاشتراك والوصول للمنصة.
          </p>
        </section>

        {/* Stats */}
        <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

          {[
            ['إجمالي الطلاب', stats.total, '👨‍🎓'],
            ['نشط', stats.active, '✓'],
            ['قيد المراجعة', stats.pending, '◷'],
            ['موقوف', stats.suspended, '!'],
            ['مرفوض', stats.rejected, '×'],
          ].map(([title, value, icon]) => (
            <div
              key={String(title)}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">
                    {title}
                  </p>

                  <p className="mt-3 text-3xl font-black">
                    {Number(value).toLocaleString('ar-EG')}
                  </p>
                </div>

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.04] text-lg">
                  {icon}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Main */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025]">

          {/* Filters */}
          <div className="border-b border-white/[0.06] p-5">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              {/* Search */}
              <div className="relative w-full xl:max-w-md">
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600">
                  ⌕
                </span>

                <input
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                  placeholder="ابحث بالاسم أو الهاتف أو كود الطالب..."
                  className="w-full rounded-xl border border-white/[0.07] bg-black/20 py-3 pr-11 pl-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-500/40"
                />
              </div>

              {/* Status filters */}
              <div className="flex flex-wrap gap-2">

                {[
                  ['all', 'الكل'],
                  ['pending', 'قيد المراجعة'],
                  ['active', 'نشط'],
                  ['suspended', 'موقوف'],
                  ['rejected', 'مرفوض'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setStatusFilter(
                        value as 'all' | UserStatus
                      )
                    }
                    className={`rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                      statusFilter === value
                        ? 'bg-amber-500 text-black'
                        : 'border border-white/[0.07] bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-16 text-center">
              <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-amber-400" />

              <p className="text-sm text-slate-500">
                جاري تحميل الطلاب...
              </p>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-16 text-center">
              <div className="mb-4 text-5xl">
                🔎
              </div>

              <h3 className="font-black">
                لا توجد نتائج
              </h3>

              <p className="mt-2 text-xs text-slate-500">
                جرّب تغيير البحث أو فلتر الحالة.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[950px] text-right">

                <thead>
                  <tr className="border-b border-white/[0.05] text-xs text-slate-600">

                    <th className="px-5 py-4 font-bold">
                      الطالب
                    </th>

                    <th className="px-5 py-4 font-bold">
                      كود الطالب
                    </th>

                    <th className="px-5 py-4 font-bold">
                      الهاتف
                    </th>

                    <th className="px-5 py-4 font-bold">
                      الحالة
                    </th>

                    <th className="px-5 py-4 font-bold">
                      تاريخ التسجيل
                    </th>

                    <th className="px-5 py-4 font-bold">
                      الإجراءات
                    </th>

                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-white/[0.04] transition hover:bg-white/[0.025]"
                    >

                      {/* Student */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">

                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.07] bg-gradient-to-br from-slate-700 to-slate-900 font-black">
                            {student.full_name.charAt(0)}
                          </div>

                          <div className="min-w-0">
                            <p className="font-bold">
                              {student.full_name}
                            </p>

                            <p className="mt-1 text-[10px] text-slate-600">
                              ID: {student.id.slice(0, 8)}
                            </p>
                          </div>

                        </div>
                      </td>

                      {/* Code */}
                      <td className="px-5 py-4">
                        <span className="rounded-lg bg-amber-500/10 px-3 py-1.5 font-mono text-xs font-bold text-amber-400">
                          {student.student_code || '—'}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="px-5 py-4 text-sm text-slate-400">
                        {student.phone || '—'}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        <StatusBadge
                          status={student.status}
                        />
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 text-xs text-slate-500">
                        {formatDate(student.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4">

                        <div className="flex flex-wrap gap-1">

                          {student.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={
                                  updatingId === student.id
                                }
                                onClick={() =>
                                  updateStatus(
                                    student.id,
                                    'active'
                                  )
                                }
                                className="rounded-lg px-3 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-40"
                              >
                                قبول
                              </button>

                              <button
                                type="button"
                                disabled={
                                  updatingId === student.id
                                }
                                onClick={() =>
                                  updateStatus(
                                    student.id,
                                    'rejected'
                                  )
                                }
                                className="rounded-lg px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
                              >
                                رفض
                              </button>
                            </>
                          )}

                          {student.status === 'active' && (
                            <button
                              type="button"
                              disabled={
                                updatingId === student.id
                              }
                              onClick={() =>
                                updateStatus(
                                  student.id,
                                  'suspended'
                                )
                              }
                              className="rounded-lg px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-40"
                            >
                              إيقاف
                            </button>
                          )}

                          {(student.status === 'suspended' ||
                            student.status === 'rejected') && (
                            <button
                              type="button"
                              disabled={
                                updatingId === student.id
                              }
                              onClick={() =>
                                updateStatus(
                                  student.id,
                                  'active'
                                )
                              }
                              className="rounded-lg px-3 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/10 disabled:opacity-40"
                            >
                              تفعيل
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              showMessage(
                                'صفحة تفاصيل الطالب سنضيفها في الخطوة التالية'
                              )
                            }
                            className="rounded-lg px-3 py-2 text-xs font-bold text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                          >
                            تفاصيل
                          </button>

                        </div>

                      </td>

                    </tr>
                  ))}
                </tbody>

              </table>
            </div>
          )}

          {/* Footer count */}
          {!loading && filteredStudents.length > 0 && (
            <div className="border-t border-white/[0.05] px-5 py-4">
              <p className="text-xs text-slate-600">
                عرض {filteredStudents.length.toLocaleString('ar-EG')}
                {' '}من أصل{' '}
                {students.length.toLocaleString('ar-EG')}
                {' '}طالب
              </p>
            </div>
          )}

        </section>

        <footer className="mt-8 border-t border-white/[0.05] pt-5 text-xs text-slate-600">
          منصة كيمياء أستاذ أحمد محمد رمضان
        </footer>

      </div>

      {/* Toast */}
      {message && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#11151d]/95 px-5 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur-xl">
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