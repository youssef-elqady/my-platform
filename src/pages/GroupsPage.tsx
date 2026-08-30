import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  supabase,
} from '../lib/supabase';

import {
  Trash2,
} from 'lucide-react';

/* =========================================================
   TYPES
========================================================= */

type UserStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'rejected';

interface Grade {
  id: string;
  name: string;
}

interface Student {
  id: string;
  full_name: string;
  phone: string | null;
  student_code: string | null;
  status: UserStatus;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

interface Group {
  id: string;
  grade_id: string;
  name: string;
  description: string | null;
  location: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  grade: Grade | null;
  member_count: number;
}

interface GroupMember {
  id: string;
  group_id: string;
  student_id: string;
  created_at: string;
  student: Student;
}

/* =========================================================
   HELPERS
========================================================= */

function formatDate(date: string) {
  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

function getInitial(name: string) {
  return name?.trim()?.charAt(0) || 'ط';
}

/* =========================================================
   STATUS BADGE
========================================================= */

function GroupStatusBadge({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
        active
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
          : 'border-slate-500/20 bg-slate-500/10 text-slate-400'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active
            ? 'bg-emerald-400'
            : 'bg-slate-500'
        }`}
      />

      {active ? 'نشطة' : 'معطلة'}
    </span>
  );
}

/* =========================================================
   TOAST
========================================================= */

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 z-[300] w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
      <div
        className={`flex items-center gap-3 rounded-2xl border px-5 py-4 shadow-2xl backdrop-blur-xl ${
          type === 'success'
            ? 'border-emerald-500/20 bg-[#11151d]/95'
            : 'border-red-500/20 bg-[#11151d]/95'
        }`}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg ${
            type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          }`}
        >
          {type === 'success' ? '✓' : '!'}
        </div>

        <p className="flex-1 text-sm font-bold text-white">
          {message}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 transition hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function GroupsPage() {
  const navigate = useNavigate();

  /* =======================================================
     GROUPS
  ======================================================= */

  const [groups, setGroups] =
    useState<Group[]>([]);

  const [grades, setGrades] =
    useState<Grade[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  /* =======================================================
     FILTERS
  ======================================================= */

  const [search, setSearch] =
    useState('');

  const [gradeFilter, setGradeFilter] =
    useState('all');

  const [activeFilter, setActiveFilter] =
    useState<'all' | 'active' | 'inactive'>(
      'all'
    );

  /* =======================================================
     CREATE / EDIT
  ======================================================= */

  const [showCreateModal, setShowCreateModal] =
    useState(false);

  const [editingGroup, setEditingGroup] =
    useState<Group | null>(null);

  const [savingGroup, setSavingGroup] =
    useState(false);

  const [formName, setFormName] =
    useState('');

  const [formGradeId, setFormGradeId] =
    useState('');

  const [formLocation, setFormLocation] =
    useState('');

  const [formDescription, setFormDescription] =
    useState('');

  /* =======================================================
     VIEW
  ======================================================= */

  const [selectedGroup, setSelectedGroup] =
    useState<Group | null>(null);

  /* =======================================================
     MEMBERS
  ======================================================= */

  const [membersGroup, setMembersGroup] =
    useState<Group | null>(null);

  const [groupMembers, setGroupMembers] =
    useState<GroupMember[]>([]);

  const [membersLoading, setMembersLoading] =
    useState(false);

  const [memberSearch, setMemberSearch] =
    useState('');

  const [availableStudents, setAvailableStudents] =
    useState<Student[]>([]);

  const [studentsLoading, setStudentsLoading] =
    useState(false);

  const [addingStudentId, setAddingStudentId] =
    useState<string | null>(null);

  const [removingStudentId, setRemovingStudentId] =
    useState<string | null>(null);

    const [studentToRemove, setStudentToRemove] =
  useState<GroupMember | null>(null);

  /* =======================================================
     STUDENT QUICK CARD
  ======================================================= */

  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);

  /* =======================================================
     TOAST
  ======================================================= */

  const [toast, setToast] =
    useState<{
      message: string;
      type: 'success' | 'error';
    } | null>(null);

  /* =======================================================
     SHOW TOAST
  ======================================================= */

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

  /* =======================================================
     LOAD GRADES
  ======================================================= */

  const loadGrades = useCallback(
    async () => {
      const {
        data,
        error,
      } = await supabase
        .from('grades')
        .select(`
          id,
          name
        `)
        .order('name');

      if (error) {
        console.error(
          'Grades load error:',
          error
        );

        showToast(
          'تعذر تحميل الصفوف الدراسية',
          'error'
        );

        return;
      }

      setGrades(
        (data || []) as Grade[]
      );
    },
    [showToast]
  );

  /* =======================================================
     LOAD GROUPS
  ======================================================= */

  const loadGroups = useCallback(
    async (
      silent = false
    ) => {
      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const {
          data,
          error,
        } = await supabase
          .from('groups')
          .select(`
            id,
            grade_id,
            name,
            description,
            location,
            is_active,
            created_at,
            updated_at,
            grade:grades!groups_grade_id_fkey (
              id,
              name
            )
          `)
          .order(
            'created_at',
            {
              ascending: false,
            }
          );

        if (error) {
          throw error;
        }

        const rawGroups =
          data || [];

        /*
          Supabase قد يعيد العلاقة كـ Array
          لذلك نحولها إلى Grade واحد.
        */

        const baseGroups =
          rawGroups.map(
            (item: any) => ({
              id: item.id,
              grade_id: item.grade_id,
              name: item.name,
              description:
                item.description ??
                null,
              location:
                item.location ??
                null,
              is_active:
                Boolean(
                  item.is_active
                ),
              created_at:
                item.created_at,
              updated_at:
                item.updated_at,
              grade:
                Array.isArray(
                  item.grade
                )
                  ? item.grade[0] ??
                    null
                  : item.grade ??
                    null,
              member_count: 0,
            })
          );

        /*
          تحميل عدد الطلاب لكل مجموعة.
          نستخدم group_members مباشرة
          لتجنب مشاكل الـ joins.
        */

        const {
          data: memberRows,
          error: memberError,
        } = await supabase
          .from('group_members')
          .select(`
            id,
            group_id
          `);

        if (memberError) {
          console.error(
            'Member count error:',
            memberError
          );
        }

        const counts: Record<
          string,
          number
        > = {};

        (
          memberRows || []
        ).forEach(
          (member: {
            group_id: string;
          }) => {
            counts[
              member.group_id
            ] =
              (counts[
                member.group_id
              ] || 0) + 1;
          }
        );

        const finalGroups: Group[] =
          baseGroups.map(
            (
              group: Group
            ) => ({
              ...group,
              member_count:
                counts[
                  group.id
                ] || 0,
            })
          );

        setGroups(
          finalGroups
        );
      } catch (error) {
        console.error(
          'Groups load error:',
          error
        );

        showToast(
          'تعذر تحميل المجموعات',
          'error'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {
    loadGrades();
    loadGroups();
  }, [
    loadGrades,
    loadGroups,
  ]);

  /* =======================================================
     FILTERED GROUPS
  ======================================================= */

  const filteredGroups =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return groups.filter(
        (group) => {
          const matchesSearch =
            !query ||
            group.name
              .toLowerCase()
              .includes(query) ||
            (
              group.location ||
              ''
            )
              .toLowerCase()
              .includes(query);

          const matchesGrade =
            gradeFilter ===
              'all' ||
            group.grade_id ===
              gradeFilter;

          const matchesStatus =
            activeFilter ===
              'all' ||
            (
              activeFilter ===
              'active'
                ? group.is_active
                : !group.is_active
            );

          return (
            matchesSearch &&
            matchesGrade &&
            matchesStatus
          );
        }
      );
    }, [
      groups,
      search,
      gradeFilter,
      activeFilter,
    ]);

  /* =======================================================
     STATS
  ======================================================= */

  const stats = useMemo(
    () => ({
      total: groups.length,

      active:
        groups.filter(
          (group) =>
            group.is_active
        ).length,

      inactive:
        groups.filter(
          (group) =>
            !group.is_active
        ).length,

      students:
        groups.reduce(
          (
            total,
            group
          ) =>
            total +
            group.member_count,
          0
        ),
    }),
    [groups]
  );

  /* =======================================================
     RESET FORM
  ======================================================= */

  const resetForm = () => {
    setFormName('');
    setFormGradeId('');
    setFormLocation('');
    setFormDescription('');
  };

  /* =======================================================
     OPEN CREATE
  ======================================================= */

  const openCreate = () => {
    resetForm();
    setEditingGroup(null);
    setShowCreateModal(true);
  };

  /* =======================================================
     OPEN EDIT
  ======================================================= */

  const openEdit = (
    group: Group
  ) => {
    setEditingGroup(group);

    setFormName(
      group.name
    );

    setFormGradeId(
      group.grade_id
    );

    setFormLocation(
      group.location ||
        ''
    );

    setFormDescription(
      group.description ||
        ''
    );

    setShowCreateModal(true);
  };

  /* =======================================================
     SAVE GROUP
  ======================================================= */

  const saveGroup =
    async () => {
      if (
        !formName.trim()
      ) {
        showToast(
          'اسم المجموعة مطلوب',
          'error'
        );

        return;
      }

      if (
        !formGradeId
      ) {
        showToast(
          'اختر الصف الدراسي',
          'error'
        );

        return;
      }

      try {
        setSavingGroup(
          true
        );

        const payload = {
          name:
            formName.trim(),

          grade_id:
            formGradeId,

          location:
            formLocation.trim() ||
            null,

          description:
            formDescription.trim() ||
            null,
        };

        if (
          editingGroup
        ) {
          const {
            data,
            error,
          } = await supabase
            .from('groups')
            .update(payload)
            .eq(
              'id',
              editingGroup.id
            )
            .select(`
              id,
              grade_id,
              name,
              description,
              location,
              is_active,
              created_at,
              updated_at,
              grade:grades!groups_grade_id_fkey (
                id,
                name
              )
            `)
            .single();

          if (error) {
            throw error;
          }

          const updatedGroup: Group = {
            id: data.id,
            grade_id:
              data.grade_id,
            name: data.name,
            description:
              data.description ??
              null,
            location:
              data.location ??
              null,
            is_active:
              Boolean(
                data.is_active
              ),
            created_at:
              data.created_at,
            updated_at:
              data.updated_at,
            grade:
              Array.isArray(
                data.grade
              )
                ? data.grade[0] ??
                  null
                : data.grade ??
                  null,
            member_count:
              editingGroup.member_count,
          };

          setGroups(
            (
              current
            ) =>
              current.map(
                (
                  group
                ) =>
                  group.id ===
                  updatedGroup.id
                    ? updatedGroup
                    : group
              )
          );

          setSelectedGroup(
            (
              current
            ) =>
              current?.id ===
              updatedGroup.id
                ? updatedGroup
                : current
          );

          showToast(
            'تم تعديل المجموعة بنجاح ✓'
          );
        } else {
          const {
            data,
            error,
          } = await supabase
            .from('groups')
            .insert(
              payload
            )
            .select(`
              id,
              grade_id,
              name,
              description,
              location,
              is_active,
              created_at,
              updated_at,
              grade:grades!groups_grade_id_fkey (
                id,
                name
              )
            `)
            .single();

          if (error) {
            throw error;
          }

          const newGroup: Group = {
            id: data.id,
            grade_id:
              data.grade_id,
            name: data.name,
            description:
              data.description ??
              null,
            location:
              data.location ??
              null,
            is_active:
              Boolean(
                data.is_active
              ),
            created_at:
              data.created_at,
            updated_at:
              data.updated_at,
            grade:
              Array.isArray(
                data.grade
              )
                ? data.grade[0] ??
                  null
                : data.grade ??
                  null,
            member_count: 0,
          };

          setGroups(
            (
              current
            ) => [
              newGroup,
              ...current,
            ]
          );

          showToast(
            'تم إنشاء المجموعة بنجاح ✓'
          );
        }

        setShowCreateModal(
          false
        );

        setEditingGroup(
          null
        );

        resetForm();
      } catch (error) {
        console.error(
          'Save group error:',
          error
        );

        showToast(
          editingGroup
            ? 'تعذر تعديل المجموعة'
            : 'تعذر إنشاء المجموعة',
          'error'
        );
      } finally {
        setSavingGroup(
          false
        );
      }
    };

  /* =======================================================
     TOGGLE ACTIVE
  ======================================================= */

  const toggleGroup =
    async (
      group: Group
    ) => {
      const nextStatus =
        !group.is_active;

      try {
        const {
          error,
        } = await supabase
          .from('groups')
          .update({
            is_active:
              nextStatus,
          })
          .eq(
            'id',
            group.id
          );

        if (error) {
          throw error;
        }

        setGroups(
          (
            current
          ) =>
            current.map(
              (
                item
              ) =>
                item.id ===
                group.id
                  ? {
                      ...item,
                      is_active:
                        nextStatus,
                    }
                  : item
            )
        );

        if (
          selectedGroup?.id ===
          group.id
        ) {
          setSelectedGroup(
            {
              ...selectedGroup,
              is_active:
                nextStatus,
            }
          );
        }

        showToast(
          nextStatus
            ? 'تم تفعيل المجموعة ✓'
            : 'تم تعطيل المجموعة'
        );
      } catch (error) {
        console.error(
          'Toggle group error:',
          error
        );

        showToast(
          'تعذر تغيير حالة المجموعة',
          'error'
        );
      }
    };


  /* =======================================================
     LOAD GROUP MEMBERS
  ======================================================= */

  const loadGroupMembers = useCallback(
    async (groupId: string) => {
      try {
        setMembersLoading(true);

        const {
          data: memberRows,
          error: membersError,
        } = await supabase
          .from('group_members')
          .select(`
            id,
            group_id,
            student_id,
            created_at
          `)
          .eq('group_id', groupId)
          .order('created_at', {
            ascending: false,
          });

        if (membersError) {
          throw membersError;
        }

        if (!memberRows || memberRows.length === 0) {
          setGroupMembers([]);
          return;
        }

        const studentIds = memberRows
          .map((member) => member.student_id)
          .filter(Boolean);

        if (studentIds.length === 0) {
          setGroupMembers([]);
          return;
        }

        const {
          data: studentsData,
          error: studentsError,
        } = await supabase
          .from('users')
          .select(`
            id,
            full_name,
            phone,
            student_code,
            status,
            role,
            avatar_url,
            created_at,
            is_active
          `)
          .in('id', studentIds);

        if (studentsError) {
          throw studentsError;
        }

        const students =
          (studentsData || []) as Student[];

        const members: GroupMember[] =
          memberRows
            .map((member) => {
              const student =
                students.find(
                  (item) =>
                    item.id ===
                    member.student_id
                );

              if (!student) {
                return null;
              }

              return {
                id: member.id,
                group_id: member.group_id,
                student_id:
                  member.student_id,
                created_at:
                  member.created_at,
                student,
              };
            })
            .filter(
              (
                member
              ): member is GroupMember =>
                member !== null
            );

        setGroupMembers(members);
      } catch (error) {
        console.error(
          'Group members load error:',
          error
        );

        showToast(
          'تعذر تحميل طلاب المجموعة',
          'error'
        );

        setGroupMembers([]);
      } finally {
        setMembersLoading(false);
      }
    },
    [showToast]
  );


  /* =======================================================
     LOAD AVAILABLE STUDENTS
  ======================================================= */

  const loadAvailableStudents =
    useCallback(
      async (
        groupId: string
      ) => {
        try {
          setStudentsLoading(
            true
          );

          const {
            data,
            error,
          } = await supabase
            .from('users')
            .select(`
              id,
              full_name,
              phone,
              student_code,
              status,
              role,
              avatar_url,
              created_at,
              is_active
            `)
            .eq(
              'role',
              'student'
            )
            .eq(
              'status',
              'active'
            )
            .order(
              'full_name'
            );

          if (error) {
            throw error;
          }

          const allStudents =
            (data ||
              []) as Student[];

          const {
            data: memberRows,
            error: memberError,
          } = await supabase
            .from('group_members')
            .select(
              'student_id'
            )
            .eq(
              'group_id',
              groupId
            );

          if (
            memberError
          ) {
            throw memberError;
          }

          const memberIds =
            new Set(
              (
                memberRows ||
                []
              ).map(
                (
                  item
                ) =>
                  item.student_id
              )
            );

          setAvailableStudents(
            allStudents.filter(
              (
                student
              ) =>
                !memberIds.has(
                  student.id
                )
            )
          );
        } catch (error) {
          console.error(
            'Available students error:',
            error
          );

          showToast(
            'تعذر تحميل الطلاب المتاحين',
            'error'
          );

          setAvailableStudents(
            []
          );
        } finally {
          setStudentsLoading(
            false
          );
        }
      },
      [showToast]
    );

  /* =======================================================
     OPEN MEMBERS
  ======================================================= */

  const openMembers =
    async (
      group: Group
    ) => {
      setMembersGroup(
        group
      );

      setMemberSearch('');

      setGroupMembers(
        []
      );

      await Promise.all(
        [
          loadGroupMembers(
            group.id
          ),
          loadAvailableStudents(
            group.id
          ),
        ]
      );
    };

  /* =======================================================
     ADD STUDENT
  ======================================================= */

  const addStudent =
    async (
      student: Student
    ) => {
      if (
        !membersGroup
      ) {
        return;
      }

      try {
        setAddingStudentId(
          student.id
        );

        const {
          error,
        } = await supabase
          .from('group_members')
          .insert({
            group_id:
              membersGroup.id,

            student_id:
              student.id,
          });

        if (error) {
          if (
            error.code ===
            '23505'
          ) {
            showToast(
              'الطالب موجود بالفعل في المجموعة',
              'error'
            );
          } else {
            throw error;
          }

          return;
        }

        showToast(
          'تمت إضافة الطالب للمجموعة ✓'
        );

        await loadGroupMembers(
          membersGroup.id
        );

        await loadAvailableStudents(
          membersGroup.id
        );

        setGroups(
          (
            current
          ) =>
            current.map(
              (
                group
              ) =>
                group.id ===
                membersGroup.id
                  ? {
                      ...group,
                      member_count:
                        group.member_count +
                        1,
                    }
                  : group
            )
        );
      } catch (error) {
        console.error(
          'Add student error:',
          error
        );

        showToast(
          'تعذر إضافة الطالب',
          'error'
        );
      } finally {
        setAddingStudentId(
          null
        );
      }
    };

  /* =======================================================
     REMOVE STUDENT
  ======================================================= */

  const removeStudent = async (member: GroupMember) => {
  if (!membersGroup) return;

  try {
    setRemovingStudentId(member.student_id);

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', member.id)
      .eq('group_id', membersGroup.id);

    if (error) {
      console.error('Remove student database error:', error);
      throw error;
    }

    // إزالة الطالب من قائمة أعضاء المجموعة
    setGroupMembers((current) =>
      current.filter((item) => item.id !== member.id)
    );

    // إرجاع الطالب لقائمة الطلاب المتاحين
    setAvailableStudents((current) => {
      const alreadyExists = current.some(
        (student) => student.id === member.student_id
      );

      if (alreadyExists) {
        return current;
      }

      return [...current, member.student].sort((a, b) =>
        a.full_name.localeCompare(b.full_name, 'ar')
      );
    });

    // تحديث عدد الطلاب في المجموعة
    setGroups((current) =>
      current.map((group) =>
        group.id === membersGroup.id
          ? {
              ...group,
              member_count: Math.max(
                0,
                group.member_count - 1
              ),
            }
          : group
      )
    );

    // إغلاق نافذة التأكيد
    setStudentToRemove(null);

    showToast('تمت إزالة الطالب من المجموعة');
  } catch (error) {
    console.error('Remove student error:', error);

    showToast(
      'تعذر إزالة الطالب. تأكد من صلاحيات قاعدة البيانات.',
      'error'
    );
  } finally {
    setRemovingStudentId(null);
  }
};
  /* =======================================================
     FILTER AVAILABLE STUDENTS
  ======================================================= */

  const filteredAvailableStudents =
    useMemo(() => {
      const query =
        memberSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return availableStudents;
      }

      return availableStudents.filter(
        (
          student
        ) =>
          student.full_name
            .toLowerCase()
            .includes(query) ||
          (
            student.phone ||
            ''
          ).includes(query) ||
          (
            student.student_code ||
            ''
          )
            .toLowerCase()
            .includes(query)
      );
    }, [
      availableStudents,
      memberSearch,
    ]);

  /* =======================================================
     RENDER ACTIONS
  ======================================================= */

  const renderActions = (
    group: Group
  ) => {
    return (
      <div className="flex flex-wrap gap-2">

        <button
          type="button"
          onClick={() =>
            setSelectedGroup(
              group
            )
          }
          className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
        >
          👁️ عرض
        </button>

        <button
          type="button"
          onClick={() =>
            openMembers(
              group
            )
          }
          className="rounded-xl border border-blue-500/10 bg-blue-500/5 px-3 py-2 text-xs font-bold text-blue-400 transition hover:bg-blue-500/10"
        >
          👥 الطلاب
        </button>

        <button
          type="button"
          onClick={() =>
            openEdit(
              group
            )
          }
          className="rounded-xl border border-amber-500/10 bg-amber-500/5 px-3 py-2 text-xs font-bold text-amber-400 transition hover:bg-amber-500/10"
        >
          ✏️ تعديل
        </button>

        <button
          type="button"
          onClick={() =>
            toggleGroup(
              group
            )
          }
          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
            group.is_active
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
          }`}
        >
          {group.is_active
            ? '⏸️ تعطيل'
            : '✓ تفعيل'}
        </button>
      </div>
    );
  };

  /* =======================================================
     PAGE
  ======================================================= */

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#07090f] text-white"
    >

      {/* ===================================================
          BACKGROUND
      =================================================== */}

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[450px] w-[450px] rounded-full bg-amber-500/10 blur-[140px]" />

        <div className="absolute -bottom-40 -left-40 h-[450px] w-[450px] rounded-full bg-blue-500/10 blur-[140px]" />

        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize:
              '45px 45px',
          }}
        />
      </div>

      <main className="relative mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <header className="mb-8 flex flex-col gap-5 rounded-3xl border border-white/[0.06] bg-white/[0.025] p-6 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">

          <div>

            <div className="mb-3 flex items-center gap-2">

              <span className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400">
                إدارة المنصة
              </span>

              <span className="h-1 w-1 rounded-full bg-slate-700" />

              <span className="text-xs text-slate-600">
                المجموعات
              </span>

            </div>

            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              إدارة المجموعات
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              إدارة مجموعات السنتر والأونلاين وتنظيم الطلاب المنتسبين لكل مجموعة.
            </p>

          </div>

          <div className="flex flex-wrap gap-3">

            <button
              type="button"
              onClick={() =>
                loadGroups(
                  true
                )
              }
              disabled={
                refreshing
              }
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.04] px-5 text-sm font-bold transition hover:bg-white/[0.08] disabled:opacity-50"
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

            <button
              type="button"
              onClick={
                openCreate
              }
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-5 text-sm font-black text-slate-950 transition hover:bg-amber-400"
            >
              <span className="text-lg">
                +
              </span>

              مجموعة جديدة
            </button>

          </div>

        </header>

        {/* =================================================
            STATS
        ================================================= */}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5 transition hover:-translate-y-1 hover:bg-white/[0.04]">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-500">
                  إجمالي المجموعات
                </p>

                <p className="mt-2 text-3xl font-black">
                  {stats.total.toLocaleString(
                    'ar-EG'
                  )}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-xl">
                👥
              </div>

            </div>

          </div>

          <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.03] p-5 transition hover:-translate-y-1">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-500">
                  المجموعات النشطة
                </p>

                <p className="mt-2 text-3xl font-black text-emerald-400">
                  {stats.active.toLocaleString(
                    'ar-EG'
                  )}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-xl">
                ✓
              </div>

            </div>

          </div>

          <div className="rounded-2xl border border-slate-500/10 bg-slate-500/[0.03] p-5 transition hover:-translate-y-1">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-500">
                  المجموعات المعطلة
                </p>

                <p className="mt-2 text-3xl font-black text-slate-300">
                  {stats.inactive.toLocaleString(
                    'ar-EG'
                  )}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-xl">
                ⏸️
              </div>

            </div>

          </div>

          <div className="rounded-2xl border border-amber-500/10 bg-amber-500/[0.03] p-5 transition hover:-translate-y-1">

            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-500">
                  إجمالي الطلاب بالمجموعات
                </p>

                <p className="mt-2 text-3xl font-black text-amber-400">
                  {stats.students.toLocaleString(
                    'ar-EG'
                  )}
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-xl">
                🎓
              </div>

            </div>

          </div>

        </section>

        {/* =================================================
            MAIN TABLE
        ================================================= */}

        <section className="overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.025]">

          {/* TOOLBAR */}

          <div className="flex flex-col gap-5 border-b border-white/[0.06] p-5 xl:flex-row xl:items-center xl:justify-between">

            <div>
              <h2 className="text-xl font-black">
                جميع المجموعات
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                عرض{' '}
                {filteredGroups.length.toLocaleString(
                  'ar-EG'
                )}{' '}
                من أصل{' '}
                {groups.length.toLocaleString(
                  'ar-EG'
                )}{' '}
                مجموعة
              </p>
            </div>

            <div className="flex flex-col gap-3 md:flex-row">

              <div className="relative">

                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600">
                  🔎
                </span>

                <input
                  value={
                    search
                  }
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="ابحث باسم المجموعة أو المكان..."
                  className="w-full rounded-xl border border-white/[0.07] bg-black/20 py-3 pr-10 pl-4 text-sm outline-none transition placeholder:text-slate-600 focus:border-amber-500/40 md:w-80"
                />

              </div>

              <select
                value={
                  gradeFilter
                }
                onChange={(
                  event
                ) =>
                  setGradeFilter(
                    event.target.value
                  )
                }
                className="rounded-xl border border-white/[0.07] bg-[#11151d] px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-500/40"
              >

                <option value="all">
                  كل الصفوف
                </option>

                {grades.map(
                  (
                    grade
                  ) => (
                    <option
                      key={
                        grade.id
                      }
                      value={
                        grade.id
                      }
                    >
                      {grade.name}
                    </option>
                  )
                )}

              </select>

              <select
                value={
                  activeFilter
                }
                onChange={(
                  event
                ) =>
                  setActiveFilter(
                    event.target
                      .value as
                      | 'all'
                      | 'active'
                      | 'inactive'
                  )
                }
                className="rounded-xl border border-white/[0.07] bg-[#11151d] px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-500/40"
              >

                <option value="all">
                  كل الحالات
                </option>

                <option value="active">
                  نشطة
                </option>

                <option value="inactive">
                  معطلة
                </option>

              </select>

            </div>

          </div>

          {/* LOADING */}

          {loading ? (
            <div className="p-24 text-center">

              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-amber-400" />

              <p className="text-sm text-slate-500">
                جاري تحميل المجموعات...
              </p>

            </div>
          ) : filteredGroups.length ===
            0 ? (
            <div className="p-24 text-center">

              <div className="mb-5 text-6xl">
                👥
              </div>

              <h3 className="text-xl font-black">
                لا توجد مجموعات
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                لم يتم العثور على مجموعات مطابقة للبحث أو الفلاتر الحالية.
              </p>

              <button
                type="button"
                onClick={
                  openCreate
                }
                className="mt-6 rounded-xl bg-amber-500 px-6 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400"
              >
                + إنشاء أول مجموعة
              </button>

            </div>
          ) : (
            <div className="overflow-x-auto">

              <table className="w-full min-w-[1050px] text-right">

                <thead>

                  <tr className="border-b border-white/[0.05] text-xs text-slate-600">

                    <th className="px-6 py-4 font-bold">
                      المجموعة
                    </th>

                    <th className="px-6 py-4 font-bold">
                      الصف
                    </th>

                    <th className="px-6 py-4 font-bold">
                      المكان
                    </th>

                    <th className="px-6 py-4 font-bold">
                      الطلاب
                    </th>

                    <th className="px-6 py-4 font-bold">
                      الحالة
                    </th>

                    <th className="px-6 py-4 font-bold">
                      تاريخ الإنشاء
                    </th>

                    <th className="px-6 py-4 font-bold">
                      الإجراءات
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {filteredGroups.map(
                    (
                      group
                    ) => (

                      <tr
                        key={
                          group.id
                        }
                        className="border-b border-white/[0.04] transition hover:bg-white/[0.025]"
                      >

                        <td className="px-6 py-5">

                          <div className="flex items-center gap-3">

                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-blue-500/20 text-lg font-black text-amber-400">
                              👥
                            </div>

                            <div>

                              <p className="font-black">
                                {
                                  group.name
                                }
                              </p>

                              {group.description && (
                                <p className="mt-1 max-w-xs truncate text-[11px] text-slate-600">
                                  {
                                    group.description
                                  }
                                </p>
                              )}

                            </div>

                          </div>

                        </td>

                        <td className="px-6 py-5">

                          <span className="rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-400">
                            {
                              group.grade
                                ?.name ||
                              'غير محدد'
                            }
                          </span>

                        </td>

                        <td className="px-6 py-5 text-sm text-slate-400">

                          {group.location ||
                            'غير محدد'}

                        </td>

                        <td className="px-6 py-5">

                          <button
                            type="button"
                            onClick={() =>
                              openMembers(
                                group
                              )
                            }
                            className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-sm font-black text-amber-400 transition hover:bg-amber-500/20"
                          >
                            {group.member_count.toLocaleString(
                              'ar-EG'
                            )}{' '}
                            طالب
                          </button>

                        </td>

                        <td className="px-6 py-5">

                          <GroupStatusBadge
                            active={
                              group.is_active
                            }
                          />

                        </td>

                        <td className="px-6 py-5 text-xs text-slate-500">

                          {formatDate(
                            group.created_at
                          )}

                        </td>

                        <td className="px-6 py-5">

                          {renderActions(
                            group
                          )}

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </section>

        {/* =================================================
            FOOTER
        ================================================= */}

        <footer className="mt-8 flex flex-col gap-2 border-t border-white/[0.05] pt-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">

          <p>
            منصة كيمياء أستاذ أحمد محمد رمضان
          </p>

          <p>
            نظام إدارة المجموعات
          </p>

        </footer>

      </main>

      {/* ===================================================
          CREATE / EDIT MODAL
      =================================================== */}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onClick={() => {
            if (
              !savingGroup
            ) {
              setShowCreateModal(
                false
              );
            }
          }}
        >

          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/[0.08] bg-[#11151d] p-6 shadow-2xl"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="mb-7 flex items-start justify-between">

              <div>

                <p className="text-xs font-bold text-amber-400">
                  {editingGroup
                    ? 'تعديل المجموعة'
                    : 'مجموعة جديدة'}
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {editingGroup
                    ? 'تعديل بيانات المجموعة'
                    : 'إنشاء مجموعة جديدة'}
                </h2>

              </div>

              <button
                type="button"
                disabled={
                  savingGroup
                }
                onClick={() =>
                  setShowCreateModal(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
              >
                ×
              </button>

            </div>

            <div className="space-y-5">

              <div>

                <label className="mb-2 block text-sm font-bold text-slate-300">
                  اسم المجموعة *
                </label>

                <input
                  value={
                    formName
                  }
                  onChange={(
                    event
                  ) =>
                    setFormName(
                      event.target.value
                    )
                  }
                  placeholder="مثال: مجموعة الأحد والثلاثاء"
                  className="w-full rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-500/50"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold text-slate-300">
                  الصف الدراسي *
                </label>

                <select
                  value={
                    formGradeId
                  }
                  onChange={(
                    event
                  ) =>
                    setFormGradeId(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-white/[0.07] bg-[#0b0e15] px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-500/50"
                >

                  <option value="">
                    اختر الصف الدراسي
                  </option>

                  {grades.map(
                    (
                      grade
                    ) => (
                      <option
                        key={
                          grade.id
                        }
                        value={
                          grade.id
                        }
                      >
                        {
                          grade.name
                        }
                      </option>
                    )
                  )}

                </select>

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold text-slate-300">
                  المكان
                </label>

                <input
                  value={
                    formLocation
                  }
                  onChange={(
                    event
                  ) =>
                    setFormLocation(
                      event.target.value
                    )
                  }
                  placeholder="مثال: سنتر أحمد رمضان / أونلاين"
                  className="w-full rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-500/50"
                />

              </div>

              <div>

                <label className="mb-2 block text-sm font-bold text-slate-300">
                  وصف المجموعة
                </label>

                <textarea
                  value={
                    formDescription
                  }
                  onChange={(
                    event
                  ) =>
                    setFormDescription(
                      event.target.value
                    )
                  }
                  rows={4}
                  placeholder="أضف وصفًا مختصرًا للمجموعة..."
                  className="w-full resize-none rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-500/50"
                />

              </div>

            </div>

            <div className="mt-7 flex gap-3">

              <button
                type="button"
                disabled={
                  savingGroup
                }
                onClick={
                  saveGroup
                }
                className="flex flex-1 items-center justify-center rounded-xl bg-amber-500 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
              >
                {savingGroup
                  ? 'جاري الحفظ...'
                  : editingGroup
                  ? 'حفظ التعديلات'
                  : 'إنشاء المجموعة'}
              </button>

              <button
                type="button"
                disabled={
                  savingGroup
                }
                onClick={() =>
                  setShowCreateModal(
                    false
                  )
                }
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-6 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08]"
              >
                إلغاء
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ===================================================
          VIEW GROUP MODAL
      =================================================== */}

      {selectedGroup && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onClick={() =>
            setSelectedGroup(
              null
            )
          }
        >

          <div
            className="w-full max-w-2xl rounded-3xl border border-white/[0.08] bg-[#11151d] p-6 shadow-2xl"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="mb-6 flex items-start justify-between">

              <div>

                <p className="text-xs font-bold text-amber-400">
                  تفاصيل المجموعة
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {
                    selectedGroup.name
                  }
                </h2>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedGroup(
                    null
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
              >
                ×
              </button>

            </div>

            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">

              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-blue-500/20 text-2xl">
                👥
              </div>

              <div className="flex-1">

                <h3 className="text-xl font-black">
                  {
                    selectedGroup.name
                  }
                </h3>

                <div className="mt-2 flex flex-wrap items-center gap-2">

                  <span className="rounded-lg bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-400">
                    {
                      selectedGroup
                        .grade
                        ?.name ||
                      'غير محدد'
                    }
                  </span>

                  <GroupStatusBadge
                    active={
                      selectedGroup.is_active
                    }
                  />

                </div>

              </div>

            </div>

            <div className="grid gap-3 sm:grid-cols-2">

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">

                <p className="text-xs text-slate-600">
                  المكان
                </p>

                <p className="mt-2 font-bold text-slate-200">
                  {
                    selectedGroup.location ||
                    'غير محدد'
                  }
                </p>

              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">

                <p className="text-xs text-slate-600">
                  عدد الطلاب
                </p>

                <p className="mt-2 font-black text-amber-400">
                  {selectedGroup.member_count.toLocaleString(
                    'ar-EG'
                  )}{' '}
                  طالب
                </p>

              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">

                <p className="text-xs text-slate-600">
                  تاريخ الإنشاء
                </p>

                <p className="mt-2 font-bold text-slate-200">
                  {formatDate(
                    selectedGroup.created_at
                  )}
                </p>

              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">

                <p className="text-xs text-slate-600">
                  آخر تحديث
                </p>

                <p className="mt-2 font-bold text-slate-200">
                  {formatDate(
                    selectedGroup.updated_at
                  )}
                </p>

              </div>

            </div>

            {selectedGroup.description && (
              <div className="mt-3 rounded-2xl border border-white/[0.06] bg-black/10 p-4">

                <p className="text-xs text-slate-600">
                  الوصف
                </p>

                <p className="mt-2 text-sm leading-7 text-slate-300">
                  {
                    selectedGroup.description
                  }
                </p>

              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">

              <button
                type="button"
                onClick={() => {
                  setSelectedGroup(
                    null
                  );

                  openMembers(
                    selectedGroup
                  );
                }}
                className="flex-1 rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400"
              >
                👥 إدارة الطلاب
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedGroup(
                    null
                  );

                  openEdit(
                    selectedGroup
                  );
                }}
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/[0.08]"
              >
                ✏️ تعديل
              </button>

            </div>

          </div>

        </div>
      )}

      {/* ===================================================
          MEMBERS MODAL
      =================================================== */}

      {membersGroup && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onClick={() =>
            setMembersGroup(
              null
            )
          }
        >

          <div
            className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/[0.08] bg-[#11151d] shadow-2xl"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="flex items-start justify-between border-b border-white/[0.06] p-6">

              <div>

                <p className="text-xs font-bold text-blue-400">
                  إدارة الطلاب
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  {
                    membersGroup.name
                  }
                </h2>

                <p className="mt-2 text-sm text-slate-500">
                  {
                    membersGroup
                      .grade
                      ?.name ||
                    'غير محدد'
                  }{' '}
                  •{' '}
                  {
                    membersGroup
                      .location ||
                    'بدون مكان محدد'
                  }
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setMembersGroup(
                    null
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
              >
                ×
              </button>

            </div>

            <div className="grid max-h-[calc(92vh-110px)] overflow-y-auto lg:grid-cols-2">

              {/* =========================================
                  CURRENT MEMBERS
              ========================================= */}

              <div className="border-b border-white/[0.06] p-5 lg:border-b-0 lg:border-l">

                <div className="mb-5 flex items-center justify-between">

                  <div>

                    <h3 className="font-black">
                      الطلاب الحاليون
                    </h3>

                    <p className="mt-1 text-xs text-slate-600">
                      {
                        groupMembers.length.toLocaleString(
                          'ar-EG'
                        )}{' '}
                      طالب
                    </p>

                  </div>

                  <span className="rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-black text-amber-400">
                    {
                      groupMembers.length.toLocaleString(
                        'ar-EG'
                      )}
                  </span>

                </div>

                {membersLoading ? (
                  <div className="py-16 text-center">

                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" />

                    <p className="text-xs text-slate-600">
                      جاري تحميل الطلاب...
                    </p>

                  </div>
                ) : groupMembers.length ===
                  0 ? (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 text-center">

                    <div className="mb-3 text-4xl">
                      🎓
                    </div>

                    <p className="font-bold text-slate-300">
                      لا يوجد طلاب
                    </p>

                    <p className="mt-2 text-xs text-slate-600">
                      ابدأ بإضافة الطلاب من القائمة المجاورة.
                    </p>

                  </div>
                ) : (
                  <div className="space-y-2">

                    {groupMembers.map(
                      (
                        member
                      ) => (

                        <div
                          key={
                            member.id
                          }
                          className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition hover:bg-white/[0.04]"
                        >

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStudent(
                                member.student
                              )
                            }
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-blue-500/20 font-black text-amber-400"
                          >
                            {getInitial(
                              member
                                .student
                                .full_name
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStudent(
                                member.student
                              )
                            }
                            className="min-w-0 flex-1 text-right"
                          >

                            <p className="truncate text-sm font-black text-white">
                              {
                                member
                                  .student
                                  .full_name
                              }
                            </p>

                            <p className="mt-1 truncate font-mono text-[10px] text-amber-400">
                              {
                                member
                                  .student
                                  .student_code ||
                                'بدون كود'
                              }
                            </p>

                          </button>

                          <button
                            type="button"
                            disabled={
                              removingStudentId ===
                              member.student_id
                            }
                           onClick={() => setStudentToRemove(member)
                            }
                            className="shrink-0 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
                          >
                            {removingStudentId ===
                            member.student_id
                              ? '...'
                              : 'إزالة'}
                          </button>

                        </div>

                      )
                    )}

                  </div>
                )}

              </div>

              {/* =========================================
                  AVAILABLE STUDENTS
              ========================================= */}

              <div className="p-5">

                <div className="mb-5">

                  <h3 className="font-black">
                    إضافة طلاب
                  </h3>

                  <p className="mt-1 text-xs text-slate-600">
                    الطلاب النشطون غير الموجودين في المجموعة
                  </p>

                </div>

                <div className="relative mb-4">

                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600">
                    🔎
                  </span>

                  <input
                    value={
                      memberSearch
                    }
                    onChange={(
                      event
                    ) =>
                      setMemberSearch(
                        event.target.value
                      )
                    }
                    placeholder="ابحث بالاسم أو الكود أو الهاتف..."
                    className="w-full rounded-xl border border-white/[0.07] bg-black/20 py-3 pr-10 pl-4 text-sm outline-none placeholder:text-slate-600 focus:border-blue-500/40"
                  />

                </div>

                {studentsLoading ? (
                  <div className="py-16 text-center">

                    <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-blue-400" />

                    <p className="text-xs text-slate-600">
                      جاري تحميل الطلاب...
                    </p>

                  </div>
                ) : filteredAvailableStudents.length ===
                  0 ? (
                  <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 text-center">

                    <div className="mb-3 text-4xl">
                      🔎
                    </div>

                    <p className="font-bold text-slate-300">
                      لا يوجد طلاب متاحون
                    </p>

                    <p className="mt-2 text-xs text-slate-600">
                      جرّب تغيير البحث أو تأكد من وجود طلاب نشطين.
                    </p>

                  </div>
                ) : (
                  <div className="space-y-2">

                    {filteredAvailableStudents.map(
                      (
                        student
                      ) => (

                        <div
                          key={
                            student.id
                          }
                          className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3 transition hover:bg-white/[0.04]"
                        >

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStudent(
                                student
                              )
                            }
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-emerald-500/20 font-black text-blue-400"
                          >
                            {getInitial(
                              student.full_name
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStudent(
                                student
                              )
                            }
                            className="min-w-0 flex-1 text-right"
                          >

                            <p className="truncate text-sm font-black">
                              {
                                student.full_name
                              }
                            </p>

                            <p className="mt-1 truncate text-[10px] text-slate-600">
                              {
                                student.student_code ||
                                student.phone ||
                                'بدون بيانات'
                              }
                            </p>

                          </button>

                          <button
                            type="button"
                            disabled={
                              addingStudentId ===
                              student.id
                            }
                            onClick={() =>
                              addStudent(
                                student
                              )
                            }
                            className="shrink-0 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-400 transition hover:bg-emerald-500/20 disabled:opacity-40"
                          >
                            {addingStudentId ===
                            student.id
                              ? 'جاري...'
                              : '+ إضافة'}
                          </button>

                        </div>

                      )
                    )}

                  </div>
                )}

              </div>

            </div>

          </div>

        </div>
      )}

      {/* ===================================================
          STUDENT QUICK CARD
      =================================================== */}

      {selectedStudent && (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
          onClick={() =>
            setSelectedStudent(
              null
            )
          }
        >

          <div
            className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-[#11151d] p-6 shadow-2xl"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >

            <div className="mb-6 flex items-start justify-between">

              <div>

                <p className="text-xs font-bold text-amber-400">
                  بطاقة الطالب
                </p>

                <h2 className="mt-1 text-2xl font-black">
                  بيانات الطالب
                </h2>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedStudent(
                    null
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-white"
              >
                ×
              </button>

            </div>

            <div className="mb-6 flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">

              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-blue-500/20 text-2xl font-black text-amber-400">
                {getInitial(
                  selectedStudent.full_name
                )}
              </div>

              <div>

                <h3 className="text-lg font-black">
                  {
                    selectedStudent.full_name
                  }
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  طالب نشط
                </p>

              </div>

            </div>

            <div className="space-y-3">

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">

                <p className="text-xs text-slate-600">
                  كود الطالب
                </p>

                <p className="mt-2 font-mono font-black text-amber-400">
                  {
                    selectedStudent.student_code ||
                    'غير متوفر'
                  }
                </p>

              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">

                <p className="text-xs text-slate-600">
                  رقم الهاتف
                </p>

                <p className="mt-2 font-bold text-slate-200">
                  {
                    selectedStudent.phone ||
                    'غير متوفر'
                  }
                </p>

              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-black/10 p-4">

                <p className="text-xs text-slate-600">
                  الحالة
                </p>

                <p className="mt-2 font-bold text-emerald-400">
                  {selectedStudent.is_active
                    ? 'نشط'
                    : 'غير نشط'}
                </p>

              </div>

            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedStudent(
                  null
                );

                setMembersGroup(
                  null
                );

                navigate(`/admin/students/${selectedStudent.id}`);
              }}
              className="mt-6 w-full rounded-xl bg-blue-500 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-400"
            >
              👨‍🎓 فتح صفحة الطلاب
            </button>

          </div>

        </div>
      )}

      {/* ===================================================
          TOAST
      =================================================== */}

      {toast && (
        <Toast
          message={
            toast.message
          }
          type={
            toast.type
          }
          onClose={() =>
            setToast(
              null
            )
          }
        />
      )}

            )

      {studentToRemove && (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
    dir="rtl"
  >
    <div className="w-full max-w-md rounded-3xl bg-slate-900 p-6 shadow-2xl">

      <div className="mb-5 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-3xl">
          ⚠️
        </div>

        <h2 className="text-xl font-black text-white">
          إزالة الطالب
        </h2>

        <p className="mt-3 text-sm text-slate-400">
          هل أنت متأكد من إزالة
        </p>

        <p className="mt-1 font-black text-white">
          {studentToRemove.student.full_name}
        </p>

        <p className="mt-3 text-xs text-slate-500">
          سيتم إزالته من هذه المجموعة فقط ولن يتم حذف حسابه.
        </p>
      </div>

      <div className="flex gap-3">

        <button
          type="button"
          onClick={() => setStudentToRemove(null)}
          className="flex-1 rounded-xl bg-white/5 px-4 py-3 font-bold text-slate-300 hover:bg-white/10"
        >
          إلغاء
        </button>

        <button
          type="button"
          onClick={() => {
            removeStudent(studentToRemove);
          }}
          disabled={
            removingStudentId === studentToRemove.student_id
          }
          className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {removingStudentId === studentToRemove.student_id
            ? 'جاري الإزالة...'
            : 'نعم، إزالة'}
        </button>

      </div>
    </div>
  </div>
)}
    </div>
  );
}
