
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '../lib/supabase';

type UserStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'rejected';

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

const statusConfig: Record<
  UserStatus,
  {
    label: string;
    icon: string;
    className: string;
  }
> = {
  active: {
    label: 'نشط',
    icon: '✓',
    className:
      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  pending: {
    label: 'قيد المراجعة',
    icon: '◷',
    className:
      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  suspended: {
    label: 'موقوف',
    icon: '!',
    className:
      'bg-red-500/10 text-red-400 border-red-500/20',
  },
  rejected: {
    label: 'مرفوض',
    icon: '×',
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

function StatusBadge({
  status,
}: {
  status: UserStatus;
}) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${config.className}`}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
  className,
  onClick,
}: {
  title: string;
  value: number;
  icon: string;
  description: string;
  className: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border p-5 text-right transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${className}`}
    >
      <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-white/5 blur-3xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-black text-white">
            {value.toLocaleString('ar-EG')}
          </p>

          <p className="mt-2 text-xs text-slate-600">
            {description}
          </p>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] text-xl transition-transform group-hover:scale-110">
          {icon}
        </div>
      </div>
    </button>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<'all' | UserStatus>('all');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);

  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);

  const [editingStudent, setEditingStudent] =
    useState<Student | null>(null);

  const [deleteStudent, setDeleteStudent] =
    useState<Student | null>(null);

  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [savingEdit, setSavingEdit] = useState(false);
  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  const [bulkLoading, setBulkLoading] =
    useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  const [messageType, setMessageType] =
    useState<'success' | 'error'>('success');

  const showMessage = useCallback(
    (
      text: string,
      type: 'success' | 'error' = 'success'
    ) => {
      setMessage(text);
      setMessageType(type);

      window.setTimeout(() => {
        setMessage(null);
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
          .order('created_at', {
            ascending: false,
          });

        if (error) {
          throw error;
        }

        setStudents((data || []) as Student[]);
        setSelectedIds([]);
      } catch (error) {
        console.error(
          'Students load error:',
          error
        );

        showMessage(
          'حدث خطأ أثناء تحميل الطلاب',
          'error'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showMessage]
  );

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  const stats = useMemo(
    () => ({
      total: students.length,

      active: students.filter(
        (student) =>
          student.status === 'active'
      ).length,

      pending: students.filter(
        (student) =>
          student.status === 'pending'
      ).length,

      suspended: students.filter(
        (student) =>
          student.status === 'suspended'
      ).length,

      rejected: students.filter(
        (student) =>
          student.status === 'rejected'
      ).length,
    }),
    [students]
  );

  const filteredStudents = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !query ||
        student.full_name
          .toLowerCase()
          .includes(query) ||
        student.phone
          .toLowerCase()
          .includes(query) ||
        (student.student_code || '')
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === 'all' ||
        student.status === statusFilter;

      return (
        matchesSearch &&
        matchesStatus
      );
    });
  }, [
    students,
    search,
    statusFilter,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredStudents.length / pageSize
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

  const currentPageIds = useMemo(
    () =>
      paginatedStudents.map(
        (student) => student.id
      ),
    [paginatedStudents]
  );

  const allCurrentPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((id) =>
      selectedIds.includes(id)
    );

  const toggleStudentSelection = (
    id: string
  ) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id
          )
        : [...current, id]
    );
  };

  const toggleCurrentPage = () => {
    if (allCurrentPageSelected) {
      setSelectedIds((current) =>
        current.filter(
          (id) =>
            !currentPageIds.includes(id)
        )
      );
    } else {
      setSelectedIds((current) => [
        ...new Set([
          ...current,
          ...currentPageIds,
        ]),
      ]);
    }
  };

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
          is_active:
            status === 'active',
        })
        .eq('id', studentId);

      if (error) {
        throw error;
      }

      setStudents((current) =>
        current.map((student) =>
          student.id === studentId
            ? {
                ...student,
                status,
                is_active:
                  status === 'active',
              }
            : student
        )
      );

      if (
        selectedStudent?.id ===
        studentId
      ) {
        setSelectedStudent({
          ...selectedStudent,
          status,
          is_active:
            status === 'active',
        });
      }

      const messages: Record<
        UserStatus,
        string
      > = {
        active:
          'تم تفعيل حساب الطالب بنجاح ✓',
        suspended:
          'تم إيقاف حساب الطالب بنجاح',
        rejected:
          'تم رفض حساب الطالب',
        pending:
          'تم تغيير حالة الطالب',
      };

      showMessage(messages[status]);
    } catch (error) {
      console.error(
        'Status update error:',
        error
      );

      showMessage(
        'تعذر تحديث حالة الطالب',
        'error'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const bulkUpdateStatus = async (
    status: UserStatus
  ) => {
    if (selectedIds.length === 0) {
      showMessage(
        'حدد طالبًا واحدًا على الأقل',
        'error'
      );
      return;
    }

    try {
      setBulkLoading(true);

      const { error } = await supabase
        .from('users')
        .update({
          status,
          is_active:
            status === 'active',
        })
        .in('id', selectedIds);

      if (error) {
        throw error;
      }

      setStudents((current) =>
        current.map((student) =>
          selectedIds.includes(student.id)
            ? {
                ...student,
                status,
                is_active:
                  status === 'active',
              }
            : student
        )
      );

      setSelectedIds([]);

      showMessage(
        `تم تحديث ${selectedIds.length.toLocaleString(
          'ar-EG'
        )} طالب بنجاح ✓`
      );
    } catch (error) {
      console.error(
        'Bulk update error:',
        error
      );

      showMessage(
        'تعذر تنفيذ الإجراء الجماعي',
        'error'
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editingStudent) {
      return;
    }

    const name = editName.trim();
    const phone = editPhone.trim();

    if (!name) {
      showMessage(
        'اسم الطالب مطلوب',
        'error'
      );
      return;
    }

    try {
      setSavingEdit(true);

      const { error } = await supabase
        .from('users')
        .update({
          full_name: name,
          phone,
        })
        .eq(
          'id',
          editingStudent.id
        );

      if (error) {
        throw error;
      }

      setStudents((current) =>
        current.map((student) =>
          student.id ===
          editingStudent.id
            ? {
                ...student,
                full_name: name,
                phone,
              }
            : student
        )
      );

      if (
        selectedStudent?.id ===
        editingStudent.id
      ) {
        setSelectedStudent({
          ...selectedStudent,
          full_name: name,
          phone,
        });
      }

      setEditingStudent(null);

      showMessage(
        'تم تعديل بيانات الطالب بنجاح ✓'
      );
    } catch (error) {
      console.error(
        'Edit student error:',
        error
      );

      showMessage(
        'تعذر تعديل بيانات الطالب',
        'error'
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteStudent) {
      return;
    }

    try {
      setUpdatingId(
        deleteStudent.id
      );

      const { error } = await supabase
        .from('users')
        .delete()
        .eq(
          'id',
          deleteStudent.id
        );

      if (error) {
        throw error;
      }

      setStudents((current) =>
        current.filter(
          (student) =>
            student.id !==
            deleteStudent.id
        )
      );

      setSelectedIds((current) =>
        current.filter(
          (id) =>
            id !== deleteStudent.id
        )
      );

      setDeleteStudent(null);

      showMessage(
        'تم حذف الطالب بنجاح'
      );
    } catch (error) {
      console.error(
        'Delete student error:',
        error
      );

      showMessage(
        'تعذر حذف الطالب. تأكد من صلاحيات قاعدة البيانات.',
        'error'
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const openEdit = (
    student: Student
  ) => {
    setEditingStudent(student);
    setEditName(student.full_name);
    setEditPhone(student.phone);
  };

  const exportCSV = () => {
    if (filteredStudents.length === 0) {
      showMessage(
        'لا توجد بيانات لتصديرها',
        'error'
      );
      return;
    }

    const headers = [
      'الاسم',
      'كود الطالب',
      'الهاتف',
      'الحالة',
      'تاريخ التسجيل',
    ];

    const rows =
      filteredStudents.map(
        (student) => [
          student.full_name,
          student.student_code || '',
          student.phone || '',
          statusConfig[
            student.status
          ].label,
          formatDate(
            student.created_at
          ),
        ]
      );

    const csv = [
      headers,
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) =>
            `"${String(value).replace(
              /"/g,
              '""'
            )}"`
          )
          .join(',')
      )
      .join('\n');

    const blob = new Blob(
      ['\uFEFF' + csv],
      {
        type: 'text/csv;charset=utf-8;',
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement('a');

    link.href = url;
    link.download =
      'students.csv';

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showMessage(
      'تم تجهيز ملف الطلاب للتصدير ✓'
    );
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPage(1);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#07090f] text-white"
    >
      {/* BACKGROUND */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-amber-500/10 blur-[130px]" />

        <div className="absolute -bottom-40 -left-40 h-[420px] w-[420px] rounded-full bg-blue-500/10 blur-[130px]" />

        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '45px 45px',
          }}
        />
      </div>

      <main className="relative mx-auto max-w-[1650px] p-4 sm:p-6 lg:p-8">

        {/* HEADER */}

        <header className="mb-7 rounded-3xl border border-white/[0.06] bg-white/[0.025] p-6 backdrop-blur-xl">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">

            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-lg bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400">
                  إدارة المنصة
                </span>

                <span className="text-slate-700">
                  /
                </span>

                <span className="text-xs text-slate-500">
                  الطلاب
                </span>
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                إدارة الطلاب
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                تحكم كامل في حسابات الطلاب
                وحالاتهم وبياناتهم.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                onClick={exportCSV}
                className="flex h-11 items-center gap-2 rounded-xl border border-emerald-500/10 bg-emerald-500/5 px-4 text-sm font-bold text-emerald-400 transition hover:bg-emerald-500/10"
              >
                ⇩ تصدير CSV
              </button>

              <button
                type="button"
                onClick={() =>
                  loadStudents(true)
                }
                disabled={refreshing}
                className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-5 text-sm font-bold transition hover:bg-white/[0.08] disabled:opacity-50"
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

                تحديث
              </button>
            </div>
          </div>
        </header>

        {/* STATS */}

        <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <StatCard
            title="إجمالي الطلاب"
            value={stats.total}
            icon="👨‍🎓"
            description="كل حسابات الطلاب"
            className="border-blue-500/10 bg-blue-500/[0.03]"
            onClick={() => {
              setStatusFilter('all');
              setPage(1);
            }}
          />

          <StatCard
            title="نشطون"
            value={stats.active}
            icon="✓"
            description="لديهم وصول للمنصة"
            className="border-emerald-500/10 bg-emerald-500/[0.03]"
            onClick={() => {
              setStatusFilter('active');
              setPage(1);
            }}
          />

          <StatCard
            title="قيد المراجعة"
            value={stats.pending}
            icon="◷"
            description="تحتاج قرار الإدارة"
            className="border-amber-500/10 bg-amber-500/[0.03]"
            onClick={() => {
              setStatusFilter('pending');
              setPage(1);
            }}
          />

          <StatCard
            title="موقوفون"
            value={stats.suspended}
            icon="!"
            description="تم إيقاف الوصول"
            className="border-red-500/10 bg-red-500/[0.03]"
            onClick={() => {
              setStatusFilter(
                'suspended'
              );
              setPage(1);
            }}
          />

          <StatCard
            title="مرفوضون"
            value={stats.rejected}
            icon="×"
            description="طلبات مرفوضة"
            className="border-slate-500/10 bg-slate-500/[0.03]"
            onClick={() => {
              setStatusFilter(
                'rejected'
              );
              setPage(1);
            }}
          />
        </section>

        {/* BULK ACTION BAR */}

        {selectedIds.length > 0 && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-black text-amber-300">
                تم تحديد{' '}
                {selectedIds.length.toLocaleString(
                  'ar-EG'
                )}{' '}
                طالب
              </p>

              <p className="mt-1 text-xs text-slate-500">
                اختر الإجراء الذي تريد تنفيذه
                على الطلاب المحددين.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                disabled={bulkLoading}
                onClick={() =>
                  bulkUpdateStatus(
                    'active'
                  )
                }
                className="rounded-xl bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-50"
              >
                ✓ تفعيل الكل
              </button>

              <button
                type="button"
                disabled={bulkLoading}
                onClick={() =>
                  bulkUpdateStatus(
                    'suspended'
                  )
                }
                className="rounded-xl bg-red-500/10 px-4 py-2.5 text-xs font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                ⏸ إيقاف الكل
              </button>

              <button
                type="button"
                onClick={() =>
                  setSelectedIds([])
                }
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-white/[0.08]"
              >
                إلغاء التحديد
              </button>
            </div>
          </div>
        )}

        {/* TABLE */}

        <section className="overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.025]">

          {/* TOOLBAR */}

          <div className="border-b border-white/[0.06] p-5">

            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              <div>
                <h2 className="text-xl font-black">
                  جميع الطلاب
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  عرض{' '}
                  {filteredStudents.length.toLocaleString(
                    'ar-EG'
                  )}{' '}
                  من أصل{' '}
                  {students.length.toLocaleString(
                    'ar-EG'
                  )}{' '}
                  طالب
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">

                <div className="relative">
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600">
                    ⌕
                  </span>

                  <input
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="ابحث بالاسم أو الهاتف أو الكود..."
                    className="w-full rounded-xl border border-white/[0.07] bg-black/20 py-3 pr-9 pl-4 text-sm outline-none transition placeholder:text-slate-600 focus:border-amber-500/40 md:w-80"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as
                        | 'all'
                        | UserStatus
                    )
                  }
                  className="rounded-xl border border-white/[0.07] bg-[#11151d] px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-500/40"
                >
                  <option value="all">
                    كل الحالات
                  </option>

                  <option value="active">
                    نشط
                  </option>

                  <option value="pending">
                    قيد المراجعة
                  </option>

                  <option value="suspended">
                    موقوف
                  </option>

                  <option value="rejected">
                    مرفوض
                  </option>
                </select>

                {(search ||
                  statusFilter !==
                    'all') && (
                  <button
                    type="button"
                    onClick={
                      clearFilters
                    }
                    className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-xs font-bold text-slate-400 transition hover:bg-white/[0.08]"
                  >
                    مسح الفلاتر
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* LOADING */}

          {loading ? (
            <div className="p-20 text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-amber-400" />

              <p className="text-sm text-slate-500">
                جاري تحميل الطلاب...
              </p>
            </div>
          ) : paginatedStudents.length ===
            0 ? (
            <div className="p-20 text-center">
              <div className="mb-4 text-5xl">
                🔎
              </div>

              <h3 className="font-black">
                لا توجد نتائج
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                جرّب تغيير البحث أو فلتر
                الحالة.
              </p>

              <button
                type="button"
                onClick={
                  clearFilters
                }
                className="mt-5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-black text-black"
              >
                عرض كل الطلاب
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">

                <table className="w-full min-w-[1200px] text-right">

                  <thead>
                    <tr className="border-b border-white/[0.05] text-xs text-slate-600">

                      <th className="w-12 px-5 py-4">
                        <input
                          type="checkbox"
                          checked={
                            allCurrentPageSelected
                          }
                          onChange={
                            toggleCurrentPage
                          }
                          className="h-4 w-4 accent-amber-500"
                        />
                      </th>

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
                        الإجراءات
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedStudents.map(
                      (student) => {
                        const isSelected =
                          selectedIds.includes(
                            student.id
                          );

                        const isUpdating =
                          updatingId ===
                          student.id;

                        return (
                          <tr
                            key={
                              student.id
                            }
                            className={`border-b border-white/[0.04] transition ${
                              isSelected
                                ? 'bg-amber-500/[0.035]'
                                : 'hover:bg-white/[0.025]'
                            }`}
                          >
                            <td className="px-5 py-5">
                              <input
                                type="checkbox"
                                checked={
                                  isSelected
                                }
                                onChange={() =>
                                  toggleStudentSelection(
                                    student.id
                                  )
                                }
                                className="h-4 w-4 accent-amber-500"
                              />
                            </td>

                            <td className="px-5 py-5">
                              <div className="flex items-center gap-3">
                                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.07] bg-gradient-to-br from-amber-500/20 to-blue-500/20 font-black text-amber-400">
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
                                    student.full_name.charAt(
                                      0
                                    )
                                  )}

                                  <span
                                    className={`absolute bottom-0 left-0 h-2.5 w-2.5 rounded-full border-2 border-[#11151d] ${
                                      student.is_active
                                        ? 'bg-emerald-400'
                                        : 'bg-red-400'
                                    }`}
                                  />
                                </div>

                                <div className="min-w-0">
                                  <p className="truncate font-bold">
                                    {
                                      student.full_name
                                    }
                                  </p>

                                  <p className="mt-1 text-[11px] text-slate-600">
                                    ID:{' '}
                                    {student.id.slice(
                                      0,
                                      8
                                    )}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-5 font-mono text-xs text-amber-400">
                              {student.student_code ||
                                '—'}
                            </td>

                            <td className="px-5 py-5 text-sm text-slate-400">
                              {student.phone ||
                                '—'}
                            </td>

                            <td className="px-5 py-5">
                              <StatusBadge
                                status={
                                  student.status
                                }
                              />
                            </td>

                            <td className="px-5 py-5 text-xs text-slate-500">
                              {formatDate(
                                student.created_at
                              )}
                            </td>

                            <td className="px-5 py-5">
                              <div className="flex flex-wrap gap-1.5">

                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedStudent(
                                      student
                                    )
                                  }
                                  className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08]"
                                >
                                  👁 عرض
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    openEdit(
                                      student
                                    )
                                  }
                                  className="rounded-lg bg-blue-500/10 px-2.5 py-2 text-xs font-bold text-blue-400 transition hover:bg-blue-500/20"
                                >
                                  ✏️ تعديل
                                </button>

                                {student.status ===
                                  'pending' && (
                                  <>
                                    <button
                                      type="button"
                                      disabled={
                                        isUpdating
                                      }
                                      onClick={() =>
                                        updateStatus(
                                          student.id,
                                          'active'
                                        )
                                      }
                                      className="rounded-lg bg-emerald-500/10 px-2.5 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-40"
                                    >
                                      قبول
                                    </button>

                                    <button
                                      type="button"
                                      disabled={
                                        isUpdating
                                      }
                                      onClick={() =>
                                        updateStatus(
                                          student.id,
                                          'rejected'
                                        )
                                      }
                                      className="rounded-lg bg-red-500/10 px-2.5 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
                                    >
                                      رفض
                                    </button>
                                  </>
                                )}

                                {student.status ===
                                  'active' && (
                                  <button
                                    type="button"
                                    disabled={
                                      isUpdating
                                    }
                                    onClick={() =>
                                      updateStatus(
                                        student.id,
                                        'suspended'
                                      )
                                    }
                                    className="rounded-lg bg-red-500/10 px-2.5 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
                                  >
                                    إيقاف
                                  </button>
                                )}

                                {(student.status ===
                                  'suspended' ||
                                  student.status ===
                                    'rejected') && (
                                  <button
                                    type="button"
                                    disabled={
                                      isUpdating
                                    }
                                    onClick={() =>
                                      updateStatus(
                                        student.id,
                                        'active'
                                      )
                                    }
                                    className="rounded-lg bg-emerald-500/10 px-2.5 py-2 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-40"
                                  >
                                    تفعيل
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteStudent(
                                      student
                                    )
                                  }
                                  className="rounded-lg bg-red-500/5 px-2.5 py-2 text-xs font-bold text-red-500 transition hover:bg-red-500/10"
                                >
                                  🗑
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}

              <div className="flex flex-col gap-4 border-t border-white/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between">

                <div className="text-xs text-slate-600">
                  صفحة{' '}
                  <span className="font-bold text-slate-300">
                    {safePage}
                  </span>{' '}
                  من{' '}
                  <span className="font-bold text-slate-300">
                    {totalPages}
                  </span>
                </div>

                <div className="flex items-center gap-2">

                  <select
                    value={pageSize}
                    onChange={(e) =>
                      setPageSize(
                        Number(
                          e.target.value
                        )
                      )
                    }
                    className="rounded-lg border border-white/[0.07] bg-[#11151d] px-3 py-2 text-xs text-white outline-none"
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
                  </select>

                  <button
                    type="button"
                    disabled={
                      safePage <= 1
                    }
                    onClick={() =>
                      setPage(
                        (current) =>
                          Math.max(
                            1,
                            current - 1
                          )
                      )
                    }
                    className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-xs font-bold text-slate-300 disabled:opacity-30"
                  >
                    السابق
                  </button>

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
                    className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-4 py-2 text-xs font-bold text-slate-300 disabled:opacity-30"
                  >
                    التالي
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* FOOTER */}

        <footer className="mt-7 flex flex-col gap-2 border-t border-white/[0.05] pt-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            منصة كيمياء أستاذ أحمد محمد رمضان
          </p>

          <p>
            نظام إدارة الطلاب • الإصدار المتقدم
          </p>
        </footer>
      </main>

      {/* VIEW MODAL */}

      {selectedStudent && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onClick={() =>
            setSelectedStudent(null)
          }
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/[0.08] bg-[#11151d] p-6 shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-amber-400">
                  ملف الطالب
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  تفاصيل الحساب
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedStudent(null)
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mb-5 flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-amber-500/20 to-blue-500/20 text-2xl font-black text-amber-400">
                {selectedStudent.avatar_url ? (
                  <img
                    src={
                      selectedStudent.avatar_url
                    }
                    alt={
                      selectedStudent.full_name
                    }
                    className="h-full w-full object-cover"
                  />
                ) : (
                  selectedStudent.full_name.charAt(
                    0
                  )
                )}
              </div>

              <div>
                <h3 className="text-xl font-black">
                  {
                    selectedStudent.full_name
                  }
                </h3>

                <div className="mt-2">
                  <StatusBadge
                    status={
                      selectedStudent.status
                    }
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
                <p className="text-xs text-slate-600">
                  كود الطالب
                </p>

                <p className="mt-2 font-mono font-bold text-amber-400">
                  {selectedStudent.student_code ||
                    '—'}
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
                <p className="text-xs text-slate-600">
                  رقم الهاتف
                </p>

                <p className="mt-2 font-bold text-slate-200">
                  {selectedStudent.phone ||
                    '—'}
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
                <p className="text-xs text-slate-600">
                  تاريخ التسجيل
                </p>

                <p className="mt-2 font-bold text-slate-200">
                  {formatDate(
                    selectedStudent.created_at
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">
                <p className="text-xs text-slate-600">
                  حالة الوصول
                </p>

                <p
                  className={`mt-2 font-bold ${
                    selectedStudent.is_active
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {selectedStudent.is_active
                    ? 'مسموح بالدخول'
                    : 'غير مسموح'}
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4 sm:col-span-2">
                <p className="text-xs text-slate-600">
                  معرف الحساب
                </p>

                <p className="mt-2 break-all font-mono text-xs text-slate-400">
                  {selectedStudent.id}
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">

              <button
                type="button"
                onClick={() => {
                  openEdit(
                    selectedStudent
                  );
                  setSelectedStudent(
                    null
                  );
                }}
                className="rounded-xl bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-400 hover:bg-blue-500/20"
              >
                ✏️ تعديل
              </button>

              {selectedStudent.status ===
                'active' && (
                <button
                  type="button"
                  onClick={() =>
                    updateStatus(
                      selectedStudent.id,
                      'suspended'
                    )
                  }
                  className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/20"
                >
                  ⏸ إيقاف الحساب
                </button>
              )}

              {(selectedStudent.status ===
                'suspended' ||
                selectedStudent.status ===
                  'rejected') && (
                <button
                  type="button"
                  onClick={() =>
                    updateStatus(
                      selectedStudent.id,
                      'active'
                    )
                  }
                  className="rounded-xl bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-400 hover:bg-emerald-500/20"
                >
                  ✓ تفعيل الحساب
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}

      {editingStudent && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onClick={() =>
            !savingEdit &&
            setEditingStudent(null)
          }
        >
          <div
            className="w-full max-w-lg rounded-3xl border border-white/[0.08] bg-[#11151d] p-6 shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-blue-400">
                  تعديل البيانات
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  تعديل الطالب
                </h2>
              </div>

              <button
                type="button"
                disabled={savingEdit}
                onClick={() =>
                  setEditingStudent(
                    null
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]"
              >
                ×
              </button>
            </div>

            <div className="space-y-5">

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-300">
                  اسم الطالب
                </label>

                <input
                  value={editName}
                  onChange={(e) =>
                    setEditName(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50"
                  placeholder="اسم الطالب"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-300">
                  رقم الهاتف
                </label>

                <input
                  value={editPhone}
                  onChange={(e) =>
                    setEditPhone(
                      e.target.value
                    )
                  }
                  className="w-full rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-blue-500/50"
                  placeholder="رقم الهاتف"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-slate-300">
                  كود الطالب
                </label>

                <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 font-mono text-sm text-amber-400">
                  {editingStudent.student_code ||
                    '—'}
                </div>

                <p className="mt-2 text-xs text-slate-600">
                  كود الطالب لا يتم تغييره من
                  هنا.
                </p>
              </div>
            </div>

            <div className="mt-7 flex gap-3">

              <button
                type="button"
                disabled={savingEdit}
                onClick={saveEdit}
                className="flex flex-1 items-center justify-center rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white hover:bg-blue-400 disabled:opacity-50"
              >
                {savingEdit
                  ? 'جاري الحفظ...'
                  : 'حفظ التعديلات'}
              </button>

              <button
                type="button"
                disabled={savingEdit}
                onClick={() =>
                  setEditingStudent(
                    null
                  )
                }
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}

      {deleteStudent && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() =>
            !updatingId &&
            setDeleteStudent(null)
          }
        >
          <div
            className="w-full max-w-md rounded-3xl border border-red-500/10 bg-[#11151d] p-6 shadow-2xl"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-2xl">
              🗑
            </div>

            <h2 className="text-xl font-black">
              حذف الطالب؟
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              هل أنت متأكد من حذف حساب
              <span className="font-bold text-white">
                {' '}
                {deleteStudent.full_name}{' '}
              </span>
              ؟ هذا الإجراء لا يمكن التراجع
              عنه.
            </p>

            <div className="mt-6 flex gap-3">

              <button
                type="button"
                disabled={
                  updatingId ===
                  deleteStudent.id
                }
                onClick={
                  confirmDelete
                }
                className="flex-1 rounded-xl bg-red-500 px-5 py-3 text-sm font-black text-white hover:bg-red-400 disabled:opacity-50"
              >
                {updatingId ===
                deleteStudent.id
                  ? 'جاري الحذف...'
                  : 'نعم، حذف الطالب'}
              </button>

              <button
                type="button"
                disabled={
                  updatingId ===
                  deleteStudent.id
                }
                onClick={() =>
                  setDeleteStudent(
                    null
                  )
                }
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-sm font-bold text-slate-300 hover:bg-white/[0.08]"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}

      {message && (
        <div className="fixed bottom-6 left-1/2 z-[200] w-full max-w-md -translate-x-1/2 px-4">
          <div
            className={`flex items-center gap-3 rounded-2xl border bg-[#11151d]/95 px-5 py-3 text-sm font-bold text-white shadow-2xl backdrop-blur-xl ${
              messageType ===
              'success'
                ? 'border-emerald-500/20'
                : 'border-red-500/20'
            }`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                messageType ===
                'success'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {messageType ===
              'success'
                ? '✓'
                : '!'}
            </span>

            {message}
          </div>
        </div>
      )}
    </div>
  );
}