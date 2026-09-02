
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import { supabase } from '../lib/supabase';

/* =========================================================
   TYPES
========================================================= */

type StudentStatus =
  | 'pending'
  | 'active'
  | 'suspended'
  | 'rejected';

interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: 'admin' | 'student';
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface StudentProfile {
  id: string;
  status: StudentStatus;
  created_at: string;
  updated_at: string;
  student_code: string | null;
  is_active: boolean;
}


interface Grade {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  is_active: boolean;
  grade_id: string;
  grade: Grade | null;
}

interface AnalyticsSession {
  id: string;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
  duration_seconds: number;
  is_online: boolean;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
}

interface AnalyticsEvent {
  id: number;
  event_type: string;
  page_path: string | null;
  content_id: string | null;
  content_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface VideoWatch {
  id: number;
  video_id: string;
  watched_seconds: number;
  video_duration_seconds: number;
  watch_percentage: number | null;
  play_count: number;
  pause_count: number;
  completed: boolean;
  first_started_at: string | null;
  last_watched_at: string;
}


interface ExamAttempt {
  id: string;
  exam_id: string;
  attempt_number: number;
  started_at: string | null;
  submitted_at: string | null;
  status: string;
  score: number | null;
  created_at: string;
}

interface Exam {
  id: string;
  title: string;
  max_score: number;
  starts_at: string | null;
  ends_at: string | null;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: string;
  marked_at: string;
  manually_modified: boolean;
}

interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  submission_number: number;
  status: string;
  submitted_at: string | null;
  score: number | null;
  created_at: string;
}

interface Assignment {
  id: string;
  title: string;
  max_score: number;
  deadline: string | null;
}

/* =========================================================
   HELPERS
========================================================= */

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return 'غير متوفر';
  }

  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(
  value: string | null | undefined
) {
  if (!value) {
    return 'غير متوفر';
  }

  return new Intl.DateTimeFormat('ar-EG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatDuration(
  seconds: number
) {
  const safeSeconds = Math.max(
    0,
    Number(seconds || 0)
  );

  const hours = Math.floor(
    safeSeconds / 3600
  );

  const minutes = Math.floor(
    (safeSeconds % 3600) / 60
  );

  if (hours > 0) {
    return `${hours}س ${minutes}د`;
  }

  return `${minutes}د`;
}

function getInitial(
  name: string
) {
  return (
    name
      ?.trim()
      ?.charAt(0)
      ?.toUpperCase() || 'ط'
  );
}

function getStatusConfig(
  status: StudentStatus
) {
  switch (status) {
    case 'active':
      return {
        label: 'نشط',
        className:
          'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
      };

    case 'pending':
      return {
        label: 'قيد المراجعة',
        className:
          'border-amber-500/20 bg-amber-500/10 text-amber-400',
      };

    case 'suspended':
      return {
        label: 'موقوف',
        className:
          'border-red-500/20 bg-red-500/10 text-red-400',
      };

    case 'rejected':
      return {
        label: 'مرفوض',
        className:
          'border-slate-500/20 bg-slate-500/10 text-slate-400',
      };
  }
}

function getEventLabel(
  eventType: string
) {
  const labels: Record<
    string,
    string
  > = {
    session_started:
      'بدأ جلسة دخول',
    session_ended:
      'أنهى جلسة',
    lesson_opened:
      'فتح درسًا',
    lesson_started:
      'بدأ مشاهدة درس',
    lesson_completed:
      'أكمل درسًا',
    video_started:
      'بدأ فيديو',
    video_completed:
      'أكمل فيديو',
    video_paused:
      'أوقف فيديو',
    exam_started:
      'بدأ امتحانًا',
    exam_submitted:
      'سلّم امتحانًا',
    homework_submitted:
      'سلّم واجبًا',
    login:
      'سجّل الدخول',
    logout:
      'سجّل الخروج',
  };

  return (
    labels[eventType] ||
    eventType
  );
}


/* =========================================================
   SMALL COMPONENTS
========================================================= */

function StatCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: string;
  description: string;
  icon: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.025] p-5">
      <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-slate-500">
              {title}
            </p>

            <p className="mt-2 text-2xl font-black text-white">
              {value}
            </p>
          </div>

          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.05] text-xl">
            {icon}
          </div>
        </div>

        <p className="mt-3 text-[11px] font-medium text-slate-600">
          {description}
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-white/[0.06] bg-[#0d1118]">
      <div className="border-b border-white/[0.06] px-5 py-5 sm:px-6">
        <h2 className="font-black text-white">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-xs text-slate-600">
            {description}
          </p>
        )}
      </div>

      <div className="p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function StudentProfilePage() {
  const navigate =
    useNavigate();

  const {
    studentId,
  } = useParams<{
    studentId: string;
  }>();

  const [
    profile,
    setProfile,
  ] = useState<Profile | null>(
    null
  );

  const [
    studentProfile,
    setStudentProfile,
  ] =
    useState<StudentProfile | null>(
      null
    );

  const [
    group,
    setGroup,
  ] = useState<Group | null>(
    null
  );

  const [
    sessions,
    setSessions,
  ] = useState<
    AnalyticsSession[]
  >([]);

  const [
    events,
    setEvents,
  ] = useState<
    AnalyticsEvent[]
  >([]);

  const [
    videoWatches,
    setVideoWatches,
  ] = useState<
    VideoWatch[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);


  const [
    examAttempts,
    setExamAttempts,
  ] = useState<ExamAttempt[]>([]);

  const [
    exams,
    setExams,
  ] = useState<Exam[]>([]);

  const [
    attendanceRecords,
    setAttendanceRecords,
  ] = useState<AttendanceRecord[]>([]);

  const [
    assignmentSubmissions,
    setAssignmentSubmissions,
  ] = useState<AssignmentSubmission[]>([]);

  const [
    assignments,
    setAssignments,
  ] = useState<Assignment[]>([]);



  /* =======================================================
     LOAD PROFILE
  ======================================================= */

    const loadStudent = useCallback(
    async (silent = false) => {
      if (!studentId) {
        setError('معرّف الطالب غير موجود');
        setLoading(false);
        return;
      }

      try {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError(null);

        /* =================================================
           1. PROFILE
        ================================================= */

        const { data: profileData, error: profileError } =
          await supabase
            .from('users')
            .select(`
              id,
              full_name,
              phone,
              role,
              avatar_url,
              is_active,
              status,
              student_code,
              created_at,
              updated_at
            `)
            .eq('id', studentId)
            .maybeSingle();

        if (profileError) throw profileError;

        if (!profileData) {
          throw new Error('الطالب غير موجود');
        }

        setProfile(profileData as Profile);

        /* =================================================
           2. STUDENT PROFILE
        ================================================= */

        setStudentProfile({
          id: profileData.id,
          status: profileData.status as StudentStatus,
          created_at: profileData.created_at,
          updated_at: profileData.updated_at,
          student_code: profileData.student_code,
          is_active: profileData.is_active,
        });

        /* =================================================
           3. ACTIVE GROUP
        ================================================= */

        const { data: memberData, error: memberError } =
          await supabase
            .from('group_members')
            .select(`
              id,
              group_id,
              starts_at,
              ends_at
            `)
            .eq('student_id', studentId)
            .is('ends_at', null)
            .order('starts_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (memberError) throw memberError;

        if (memberData?.group_id) {
          const { data: groupData, error: groupError } =
            await supabase
              .from('groups')
              .select(`
                id,
                name,
                location,
                description,
                is_active,
                grade_id
              `)
              .eq('id', memberData.group_id)
              .maybeSingle();

          if (groupError) throw groupError;

          if (groupData) {
            const { data: gradeData, error: gradeError } =
              await supabase
                .from('grades')
                .select(`
                  id,
                  name
                `)
                .eq('id', groupData.grade_id)
                .maybeSingle();

            if (gradeError) throw gradeError;

            setGroup({
              ...groupData,
              grade: gradeData as Grade | null,
            } as Group);
          } else {
            setGroup(null);
          }
        } else {
          setGroup(null);
        }

        /* =================================================
           4. ANALYTICS SESSIONS
        ================================================= */

        const { data: sessionData, error: sessionError } =
          await supabase
            .from('analytics_sessions')
            .select(`
              id,
              started_at,
              last_seen_at,
              ended_at,
              duration_seconds,
              is_online,
              device_type,
              browser,
              operating_system
            `)
            .eq('user_id', studentId)
            .order('started_at', {
              ascending: false,
            })
            .limit(100);

        if (sessionError) throw sessionError;

        setSessions(
          (sessionData || []) as AnalyticsSession[]
        );

        /* =================================================
           5. ANALYTICS EVENTS
        ================================================= */

        const { data: eventData, error: eventError } =
          await supabase
            .from('analytics_events')
            .select(`
              id,
              event_type,
              page_path,
              content_id,
              content_type,
              metadata,
              created_at
            `)
            .eq('user_id', studentId)
            .order('created_at', {
              ascending: false,
            })
            .limit(100);

        if (eventError) throw eventError;

        setEvents(
          (eventData || []) as AnalyticsEvent[]
        );

        /* =================================================
           6. VIDEO WATCH
        ================================================= */

        const { data: watchData, error: watchError } =
          await supabase
            .from('analytics_video_watch')
            .select(`
              id,
              video_id,
              watched_seconds,
              video_duration_seconds,
              watch_percentage,
              play_count,
              pause_count,
              completed,
              first_started_at,
              last_watched_at
            `)
            .eq('user_id', studentId)
            .order('last_watched_at', {
              ascending: false,
            })
            .limit(100);

        if (watchError) throw watchError;

        const watches =
          (watchData || []) as VideoWatch[];

        setVideoWatches(watches);

        /* =================================================
           8. EXAM ATTEMPTS
        ================================================= */

        const {
          data: attemptData,
          error: attemptError,
        } = await supabase
          .from('exam_attempts')
          .select(`
            id,
            exam_id,
            attempt_number,
            started_at,
            submitted_at,
            status,
            score,
            created_at
          `)
          .eq('student_id', studentId)
          .order('created_at', {
            ascending: false,
          })
          .limit(100);

        if (attemptError) throw attemptError;

        const attempts =
          (attemptData || []) as ExamAttempt[];

        setExamAttempts(attempts);

        /* =================================================
           9. EXAMS
        ================================================= */

        const examIds = attempts
          .map((attempt) => attempt.exam_id)
          .filter(Boolean);

        if (examIds.length > 0) {
          const {
            data: examData,
            error: examError,
          } = await supabase
            .from('exams')
            .select(`
              id,
              title,
              max_score,
              starts_at,
              ends_at
            `)
            .in('id', examIds);

          if (examError) throw examError;

          setExams(
            (examData || []) as Exam[]
          );
        } else {
          setExams([]);
        }

        /* =================================================
           10. ATTENDANCE
        ================================================= */

        const {
          data: attendanceData,
          error: attendanceError,
        } = await supabase
          .from('attendance')
          .select(`
            id,
            session_id,
            student_id,
            status,
            marked_at,
            manually_modified
          `)
          .eq('student_id', studentId)
          .order('marked_at', {
            ascending: false,
          })
          .limit(100);

        if (attendanceError) throw attendanceError;

        setAttendanceRecords(
          (attendanceData || []) as AttendanceRecord[]
        );

        /* =================================================
           11. ASSIGNMENT SUBMISSIONS
        ================================================= */

        const {
          data: submissionData,
          error: submissionError,
        } = await supabase
          .from('assignment_submissions')
          .select(`
            id,
            assignment_id,
            submission_number,
            status,
            submitted_at,
            score,
            created_at
          `)
          .eq('student_id', studentId)
          .order('created_at', {
            ascending: false,
          })
          .limit(100);

        if (submissionError) throw submissionError;

        const submissions =
          (submissionData || []) as AssignmentSubmission[];

        setAssignmentSubmissions(submissions);

        /* =================================================
           12. ASSIGNMENTS
        ================================================= */

        const assignmentIds = submissions
          .map(
            (submission) =>
              submission.assignment_id
          )
          .filter(Boolean);

        if (assignmentIds.length > 0) {
          const {
            data: assignmentData,
            error: assignmentError,
          } = await supabase
            .from('assignments')
            .select(`
              id,
              title,
              max_score,
              deadline
            `)
            .in('id', assignmentIds);

          if (assignmentError) throw assignmentError;

          setAssignments(
            (assignmentData || []) as Assignment[]
          );
        } else {
          setAssignments([]);
        }
      } catch (loadError) {
        console.error(
          'Student profile error:',
          loadError
        );

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'تعذر تحميل بيانات الطالب'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [studentId]
  );

  useEffect(() => {
    void loadStudent();
  }, [loadStudent]);

  /* =======================================================
     DERIVED DATA
  ======================================================= */


    /* =======================================================
     STUDENT ANALYTICS ENGINE
  ======================================================= */

  const analytics = useMemo(() => {
    /* -------------------------
       EXAMS
    ------------------------- */

    const submittedAttempts =
      examAttempts.filter(
        (attempt) =>
          attempt.status === 'submitted' ||
          attempt.submitted_at
      );

    const scoredAttempts =
      submittedAttempts.filter(
        (attempt) =>
          attempt.score !== null &&
          Number.isFinite(
            Number(attempt.score)
          )
      );

    const examMap = new Map<string, Exam>(
      exams.map((exam) => [exam.id, exam])
    );

    const getScorePercentage = (attempt: ExamAttempt) => {
      const score = Number(attempt.score);
      const exam = examMap.get(attempt.exam_id);

      if (!Number.isFinite(score)) {
        return 0;
      }

      if (exam && Number(exam.max_score) > 0) {
        return Math.min(100, Math.max(0, (score / Number(exam.max_score)) * 100));
      }

      return score;
    };

    const examScores =
      scoredAttempts
        .map((attempt) => {
          const score = Number(attempt.score);
          const exam = examMap.get(attempt.exam_id);

          if (!Number.isFinite(score)) {
            return null;
          }

          if (exam && Number(exam.max_score) > 0) {
            return Math.min(100, Math.max(0, (score / Number(exam.max_score)) * 100));
          }

          return score;
        })
        .filter((score): score is number => score !== null);

    const averageExamScore =
      examScores.length > 0
        ? examScores.reduce(
            (sum, score) =>
              sum + score,
            0
          ) / examScores.length
        : 0;

    const bestExamScore =
      examScores.length > 0
        ? Math.max(...examScores)
        : 0;

    const lowestExamScore =
      examScores.length > 0
        ? Math.min(...examScores)
        : 0;

    /* -------------------------
       EXAM TREND
    ------------------------- */

    const chronologicalAttempts =
      [...scoredAttempts].sort(
        (a, b) =>
          new Date(
            a.submitted_at ||
              a.created_at
          ).getTime() -
          new Date(
            b.submitted_at ||
              b.created_at
          ).getTime()
      );

    let performanceTrend = 0;

    if (
      chronologicalAttempts.length >=
      2
    ) {
      const half =
        Math.floor(
          chronologicalAttempts.length /
            2
        );

      const firstHalf =
        chronologicalAttempts.slice(
          0,
          half
        );

      const secondHalf =
        chronologicalAttempts.slice(
          half
        );

      const firstAverage =
        firstHalf.reduce(
          (sum, item) =>
            sum +
            getScorePercentage(item),
          0
        ) /
        Math.max(
          1,
          firstHalf.length
        );

      const secondAverage =
        secondHalf.reduce(
          (sum, item) =>
            sum +
            getScorePercentage(item),
          0
        ) /
        Math.max(
          1,
          secondHalf.length
        );

      performanceTrend =
        secondAverage -
        firstAverage;
    }

    /* -------------------------
       ATTENDANCE
    ------------------------- */

    const attendanceTotal =
      attendanceRecords.length;

    const attendancePresent =
      attendanceRecords.filter(
        (record) =>
          record.status ===
            'present' ||
          record.status ===
            'late'
      ).length;

    const attendanceAbsent =
      attendanceRecords.filter(
        (record) =>
          record.status ===
            'absent'
      ).length;

    const attendanceRate =
      attendanceTotal > 0
        ? (attendancePresent /
            attendanceTotal) *
          100
        : 0;

    /* -------------------------
       CONSECUTIVE ABSENCE
    ------------------------- */

    const chronologicalAttendance =
      [...attendanceRecords].sort(
        (a, b) =>
          new Date(
            b.marked_at
          ).getTime() -
          new Date(
            a.marked_at
          ).getTime()
      );

    let consecutiveAbsences = 0;

    for (
      const record of
        chronologicalAttendance
    ) {
      if (
        record.status ===
        'absent'
      ) {
        consecutiveAbsences++;
      } else {
        break;
      }
    }

    /* -------------------------
       VIDEO
    ------------------------- */

    const watchSeconds =
      videoWatches.reduce(
        (sum, item) =>
          sum +
          Number(
            item.watched_seconds ||
              0
          ),
        0
      );

    const totalVideoDuration =
      videoWatches.reduce(
        (sum, item) =>
          sum +
          Number(
            item.video_duration_seconds ||
              0
          ),
        0
      );

    const averageWatchPercentage =
      videoWatches.length > 0
        ? videoWatches.reduce(
            (sum, item) =>
              sum +
              Number(
                item.watch_percentage ||
                  0
              ),
            0
          ) /
          videoWatches.length
        : 0;

    const completedVideoCount =
      videoWatches.filter(
        (item) =>
          item.completed
      ).length;

    const totalPlayCount =
      videoWatches.reduce(
        (sum, item) =>
          sum +
          Number(
            item.play_count ||
              0
          ),
        0
      );

    const totalPauseCount =
      videoWatches.reduce(
        (sum, item) =>
          sum +
          Number(
            item.pause_count ||
              0
          ),
        0
      );

    /* -------------------------
       PLATFORM ACTIVITY
    ------------------------- */

    const sessionSeconds =
      sessions.reduce(
        (sum, session) =>
          sum +
          Number(
            session.duration_seconds ||
              0
          ),
        0
      );

    const loginEvents =
      events.filter(
        (event) =>
          event.event_type ===
          'login'
      ).length;

    const examEvents =
      events.filter(
        (event) =>
          event.event_type ===
            'exam_started' ||
          event.event_type ===
            'exam_submitted'
      ).length;

    const videoEvents =
      events.filter(
        (event) =>
          event.event_type ===
            'video_started' ||
          event.event_type ===
            'video_completed'
      ).length;

    /* -------------------------
       ASSIGNMENTS
    ------------------------- */

    const gradedAssignments =
      assignmentSubmissions.filter(
        (submission) =>
          submission.score !==
          null
      );

    const assignmentAverage =
      gradedAssignments.length >
      0
        ? gradedAssignments.reduce(
            (sum, submission) =>
              sum +
              Number(
                submission.score ||
                  0
              ),
            0
          ) /
          gradedAssignments.length
        : 0;

    /* -------------------------
       RISK SCORE
       0 = safe
       100 = high risk
    ------------------------- */

    let riskScore = 0;

    const riskReasons: string[] =
      [];

    if (
      consecutiveAbsences >=
      2
    ) {
      riskScore += 30;

      riskReasons.push(
        `غياب ${consecutiveAbsences} حصص متتالية`
      );
    } else if (
      attendanceRate < 70 &&
      attendanceTotal >= 3
    ) {
      riskScore += 20;

      riskReasons.push(
        'نسبة الحضور منخفضة'
      );
    }

    if (
      averageExamScore > 0 &&
      averageExamScore < 50
    ) {
      riskScore += 25;

      riskReasons.push(
        'متوسط درجات الامتحانات منخفض'
      );
    }

    if (
      performanceTrend <=
      -15
    ) {
      riskScore += 20;

      riskReasons.push(
        'يوجد تراجع واضح في مستوى الدرجات'
      );
    }

    if (
      videoWatches.length > 0 &&
      averageWatchPercentage < 40
    ) {
      riskScore += 15;

      riskReasons.push(
        'معدل إكمال الفيديوهات منخفض'
      );
    }

    if (
      sessions.length > 0 &&
      sessionSeconds < 900
    ) {
      riskScore += 10;

      riskReasons.push(
        'النشاط على المنصة منخفض'
      );
    }

    riskScore = Math.min(
      100,
      riskScore
    );

    let riskLevel =
      'منخفض';

    if (
      riskScore >= 70
    ) {
      riskLevel =
        'مرتفع جدًا';
    } else if (
      riskScore >= 45
    ) {
      riskLevel =
        'مرتفع';
    } else if (
      riskScore >= 25
    ) {
      riskLevel =
        'متوسط';
    }

    return {
      submittedAttempts:
        submittedAttempts.length,

      averageExamScore,

      bestExamScore,

      lowestExamScore,

      performanceTrend,

      attendanceTotal,

      attendancePresent,

      attendanceAbsent,

      attendanceRate,

      consecutiveAbsences,

      watchSeconds,

      totalVideoDuration,

      averageWatchPercentage,

      completedVideoCount,

      totalPlayCount,

      totalPauseCount,

      sessionSeconds,

      loginEvents,

      examEvents,

      videoEvents,

      assignmentAverage,

      gradedAssignments:
        gradedAssignments.length,

      riskScore,

      riskLevel,

      riskReasons,
    };
  }, [
    examAttempts,
    attendanceRecords,
    videoWatches,
    sessions,
    events,
    assignmentSubmissions,
    exams,
  ]);

  const statusConfig =
    getStatusConfig(
      studentProfile?.status ||
        (profile?.is_active
          ? 'active'
          : 'suspended')
    );

  const totalWatchSeconds =
    useMemo(
      () =>
        videoWatches.reduce(
          (
            total,
            item
          ) =>
            total +
            Number(
              item.watched_seconds ||
                0
            ),
          0
        ),
      [videoWatches]
    );

  const completedVideos =
    useMemo(
      () =>
        videoWatches.filter(
          (item) =>
            item.completed
        ).length,
      [videoWatches]
    );

  const totalSessions =
    sessions.length;

  const totalEvents =
    events.length;

  const onlineNow =
    sessions.some(
      (session) =>
        session.is_online &&
        new Date(
          session.last_seen_at
        ).getTime() >
          Date.now() -
            2 * 60 * 1000
    );

  const latestSessions =
    sessions.slice(0, 8);

  const latestEvents =
    events.slice(0, 12);

  const latestVideos =
    videoWatches.slice(
      0,
      10
    );

  /* =======================================================
     LOADING
  ======================================================= */

  if (loading) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#070a0f] text-white"
      >
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8 h-5 w-32 animate-pulse rounded bg-white/[0.05]" />

          <div className="rounded-3xl border border-white/[0.06] bg-[#0d1118] p-8">
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 animate-pulse rounded-2xl bg-white/[0.05]" />

              <div className="flex-1 space-y-3">
                <div className="h-6 w-48 animate-pulse rounded bg-white/[0.05]" />

                <div className="h-4 w-72 animate-pulse rounded bg-white/[0.05]" />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              1,
              2,
              3,
              4,
            ].map(
              (item) => (
                <div
                  key={item}
                  className="h-32 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.025]"
                />
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     ERROR
  ======================================================= */

  if (
    error ||
    !profile
  ) {
    return (
      <div
        dir="rtl"
        className="min-h-screen bg-[#070a0f] text-white"
      >
        <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-5">
          <div className="w-full rounded-3xl border border-red-500/10 bg-[#0d1118] p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-3xl">
              !
            </div>

            <h1 className="mt-5 text-xl font-black">
              تعذر فتح ملف الطالب
            </h1>

            <p className="mt-3 text-sm leading-7 text-slate-500">
              {error ||
                'الطالب غير موجود أو تم حذفه.'}
            </p>

            <button
              type="button"
              onClick={() =>
                navigate(
                  '/admin/students'
                )
              }
              className="mt-6 rounded-xl bg-blue-500 px-6 py-3 text-sm font-black text-white transition hover:bg-blue-400"
            >
              العودة إلى الطلاب
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =======================================================
     MAIN UI
  ======================================================= */

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#070a0f] text-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() =>
              navigate(
                '/admin/students'
              )
            }
            className="flex w-fit items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
          >
            <span>
              →
            </span>

            العودة إلى الطلاب
          </button>

          <button
            type="button"
            onClick={() =>
              loadStudent(true)
            }
            disabled={refreshing}
            className="flex w-fit items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-4 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
          >
            <span>
              {refreshing
                ? '...'
                : '↻'}
            </span>

            تحديث البيانات
          </button>
        </div>

        {/* =================================================
            PROFILE HERO
        ================================================= */}

        <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-[#101722] to-[#0b0f16] p-5 sm:p-7">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-center gap-4 sm:gap-6">

              {profile.avatar_url ? (
                <img
                  src={
                    profile.avatar_url
                  }
                  alt={
                    profile.full_name
                  }
                  className="h-20 w-20 rounded-2xl object-cover ring-1 ring-white/10 sm:h-24 sm:w-24"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-amber-500/20 text-3xl font-black text-blue-300 ring-1 ring-white/10 sm:h-24 sm:w-24">
                  {getInitial(
                    profile.full_name
                  )}
                </div>
              )}

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-black sm:text-2xl">
                    {profile.full_name}
                  </h1>

                  <span
                    className={`rounded-full border px-3 py-1 text-[11px] font-black ${statusConfig.className}`}
                  >
                    {statusConfig.label}
                  </span>

                  {onlineNow && (
                    <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      متصل الآن
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                  <span>
                    كود الطالب:
                    <strong className="mr-1 font-mono text-amber-400">
                      {studentProfile?.student_code ||
                        'بدون كود'}
                    </strong>
                  </span>

                  <span>
                    الهاتف:
                    <strong className="mr-1 text-slate-300">
                      {profile.phone ||
                        'غير مسجل'}
                    </strong>
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-600">
                  انضم إلى المنصة في{' '}
                  {formatDate(
                    profile.created_at
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    '/admin/students'
                  )
                }
                className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-xs font-black text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
              >
                إدارة الطالب
              </button>

              <button
                type="button"
                onClick={() =>
                  window.print()
                }
                className="rounded-xl bg-blue-500 px-4 py-3 text-xs font-black text-white transition hover:bg-blue-400"
              >
                🖨️ طباعة التقرير
              </button>
            </div>
          </div>
        </div>

        {/* =================================================
            KPI CARDS
        ================================================= */}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            title="وقت المشاهدة"
            value={formatDuration(
              totalWatchSeconds
            )}
            description="إجمالي الوقت المسجل في التحليلات"
            icon="🎥"
          />

          <StatCard
            title="الفيديوهات المكتملة"
            value={completedVideos.toLocaleString(
              'ar-EG'
            )}
            description={`من أصل ${videoWatches.length.toLocaleString(
              'ar-EG'
            )} فيديو مسجل`}
            icon="✓"
          />

          <StatCard
            title="جلسات الدخول"
            value={totalSessions.toLocaleString(
              'ar-EG'
            )}
            description="آخر 100 جلسة مسجلة"
            icon="💻"
          />

          <StatCard
            title="النشاطات"
            value={totalEvents.toLocaleString(
              'ar-EG'
            )}
            description="آخر الأحداث المسجلة للطالب"
            icon="⚡"
          />

        </div>

        {/* =================================================
            PERSONAL + GROUP
        ================================================= */}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          <Section
            title="البيانات الشخصية"
            description="البيانات الأساسية المسجلة للطالب"
          >
            <div className="grid gap-4 sm:grid-cols-2">

              <div className="rounded-2xl bg-white/[0.025] p-4">
                <p className="text-[11px] font-bold text-slate-600">
                  الاسم الكامل
                </p>

                <p className="mt-2 text-sm font-black text-white">
                  {profile.full_name}
                </p>
              </div>

              <div className="rounded-2xl bg-white/[0.025] p-4">
                <p className="text-[11px] font-bold text-slate-600">
                  كود الطالب
                </p>

                <p className="mt-2 font-mono text-sm font-black text-amber-400">
                  {studentProfile?.student_code ||
                    'بدون كود'}
                </p>
              </div>

              <div className="rounded-2xl bg-white/[0.025] p-4">
                <p className="text-[11px] font-bold text-slate-600">
                  رقم الطالب
                </p>

                <p className="mt-2 text-sm font-black text-white">
                  {profile.phone ||
                    'غير مسجل'}
                </p>
              </div>

              <div className="rounded-2xl bg-white/[0.025] p-4">
                <p className="text-[11px] font-bold text-slate-600">
                  رقم ولي الأمر
                </p>

                <p className="mt-2 text-sm font-black text-white">
                  {'غير متوفر في بيانات الحساب الحالية'}
                </p>
              </div>

              <div className="rounded-2xl bg-white/[0.025] p-4">
                <p className="text-[11px] font-bold text-slate-600">
                  تاريخ التسجيل
                </p>

                <p className="mt-2 text-sm font-black text-white">
                  {formatDate(
                    profile.created_at
                  )}
                </p>
              </div>

              <div className="rounded-2xl bg-white/[0.025] p-4">
                <p className="text-[11px] font-bold text-slate-600">
                  آخر تحديث للملف
                </p>

                <p className="mt-2 text-sm font-black text-white">
                  {formatDate(
                    profile.updated_at
                  )}
                </p>
              </div>

            </div>
          </Section>

          <Section
            title="المجموعة الحالية"
            description="المجموعة المرتبط بها الطالب حاليًا"
          >
            {group ? (
              <div className="rounded-2xl border border-blue-500/10 bg-blue-500/[0.04] p-5">

                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-black text-white">
                      {group.name}
                    </p>

                    <p className="mt-2 text-xs text-blue-300">
                      {group.grade?.name ||
                        'الصف غير محدد'}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-black ${
                      group.is_active
                        ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                        : 'border-slate-500/20 bg-slate-500/10 text-slate-500'
                    }`}
                  >
                    {group.is_active
                      ? 'نشطة'
                      : 'معطلة'}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">

                  <div className="rounded-xl bg-black/20 p-3">
                    <p className="text-[10px] text-slate-600">
                      المكان
                    </p>

                    <p className="mt-1 text-xs font-bold text-slate-300">
                      {group.location ||
                        'غير محدد'}
                    </p>
                  </div>

                  <div className="rounded-xl bg-black/20 p-3">
                    <p className="text-[10px] text-slate-600">
                      الصف الدراسي
                    </p>

                    <p className="mt-1 text-xs font-bold text-slate-300">
                      {group.grade?.name ||
                        'غير محدد'}
                    </p>
                  </div>

                </div>

                {group.description && (
                  <p className="mt-4 text-xs leading-6 text-slate-500">
                    {group.description}
                  </p>
                )}

              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/[0.08] p-10 text-center">
                <div className="text-4xl">
                  👥
                </div>

                <p className="mt-3 font-black text-slate-300">
                  الطالب غير مرتبط بمجموعة
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  يمكن ربط الطالب بمجموعة من صفحة إدارة الطلاب أو المجموعات.
                </p>
              </div>
            )}
          </Section>

        </div>

        {/* =================================================
            VIDEO ACTIVITY
        ================================================= */}

        <div className="mt-6">
          <Section
            title="سجل مشاهدة الفيديوهات"
            description="آخر نشاطات مشاهدة الفيديو المسجلة للطالب"
          >
            {latestVideos.length ===
            0 ? (
              <div className="py-12 text-center">
                <div className="text-4xl">
                  🎥
                </div>

                <p className="mt-3 font-black text-slate-300">
                  لا توجد مشاهدات مسجلة
                </p>

                <p className="mt-2 text-xs text-slate-600">
                  ستظهر هنا بيانات المشاهدة بمجرد بدء الطالب في استخدام المحتوى.
                </p>
              </div>
            ) : (
              <div className="space-y-3">

                {latestVideos.map(
                  (
                    video
                  ) => {
                    const percentage =
                      Math.min(
                        100,
                        Math.max(
                          0,
                          Number(
                            video.watch_percentage ||
                              0
                          )
                        )
                      );

                    return (
                      <div
                        key={
                          video.id
                        }
                        className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-white">
                              {`فيديو #${video.video_id.slice(0, 8)}`}
                            </p>

                            <p className="mt-1 text-[11px] text-slate-600">
                              آخر مشاهدة:{' '}
                              {formatDateTime(
                                video.last_watched_at
                              )}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-4 text-[11px]">
                            <span className="text-slate-500">
                              ⏱️{' '}
                              {formatDuration(
                                video.watched_seconds
                              )}
                            </span>

                            <span className="text-slate-500">
                              ▶️{' '}
                              {video.play_count.toLocaleString(
                                'ar-EG'
                              )}
                            </span>

                            <span
                              className={
                                video.completed
                                  ? 'font-black text-emerald-400'
                                  : 'font-black text-amber-400'
                              }
                            >
                              {video.completed
                                ? 'مكتمل'
                                : `${percentage.toLocaleString(
                                    'ar-EG'
                                  )}%`}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  }
                )}

              </div>
            )}
          </Section>
        </div>

        {/* =================================================
            DEVICES / SESSIONS
        ================================================= */}

        <div className="mt-6">
          <Section
            title="سجل الأجهزة والجلسات"
            description="الأجهزة والمتصفحات التي ظهرت في جلسات الطالب المسجلة"
          >
            {latestSessions.length ===
            0 ? (
              <div className="py-12 text-center">
                <div className="text-4xl">
                  💻
                </div>

                <p className="mt-3 font-black text-slate-300">
                  لا توجد جلسات مسجلة
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-right">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] text-slate-600">
                      <th className="px-3 py-3 font-black">
                        الجهاز
                      </th>

                      <th className="px-3 py-3 font-black">
                        المتصفح
                      </th>

                      <th className="px-3 py-3 font-black">
                        النظام
                      </th>

                      <th className="px-3 py-3 font-black">
                        بداية الجلسة
                      </th>

                      <th className="px-3 py-3 font-black">
                        المدة
                      </th>

                      <th className="px-3 py-3 font-black">
                        الحالة
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {latestSessions.map(
                      (
                        session
                      ) => (
                        <tr
                          key={
                            session.id
                          }
                          className="border-b border-white/[0.04] last:border-0"
                        >
                          <td className="px-3 py-4 text-xs font-bold text-slate-300">
                            {session.device_type ||
                              'غير معروف'}
                          </td>

                          <td className="px-3 py-4 text-xs text-slate-500">
                            {session.browser ||
                              'غير معروف'}
                          </td>

                          <td className="px-3 py-4 text-xs text-slate-500">
                            {session.operating_system ||
                              'غير معروف'}
                          </td>

                          <td className="px-3 py-4 text-xs text-slate-500">
                            {formatDateTime(
                              session.started_at
                            )}
                          </td>

                          <td className="px-3 py-4 text-xs font-bold text-slate-300">
                            {formatDuration(
                              session.duration_seconds
                            )}
                          </td>

                          <td className="px-3 py-4">
                            {session.is_online ? (
                              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-400">
                                متصل
                              </span>
                            ) : (
                              <span className="rounded-full border border-white/[0.06] bg-white/[0.03] px-2.5 py-1 text-[10px] font-black text-slate-600">
                                منتهية
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        {/* =================================================
            ACTIVITY FEED
        ================================================= */}

        <div className="mt-6">
          <Section
            title="آخر نشاط للطالب"
            description="التفاعلات والأحداث التي سجلتها المنصة"
          >
            {latestEvents.length ===
            0 ? (
              <div className="py-12 text-center">
                <div className="text-4xl">
                  ⚡
                </div>

                <p className="mt-3 font-black text-slate-300">
                  لا يوجد نشاط مسجل
                </p>
              </div>
            ) : (
              <div className="relative space-y-0">

                {latestEvents.map(
                  (
                    event,
                    index
                  ) => (
                    <div
                      key={
                        event.id
                      }
                      className="relative flex gap-4 pb-5 last:pb-0"
                    >
                      {index <
                        latestEvents.length -
                          1 && (
                        <div className="absolute right-[15px] top-8 h-full w-px bg-white/[0.06]" />
                      )}

                      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10 text-xs text-blue-400">
                        •
                      </div>

                      <div className="min-w-0 flex-1 rounded-2xl bg-white/[0.02] p-3">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-xs font-black text-white">
                            {getEventLabel(
                              event.event_type
                            )}
                          </p>

                          <span className="text-[10px] text-slate-600">
                            {formatDateTime(
                              event.created_at
                            )}
                          </span>
                        </div>

                        {event.page_path && (
                          <p className="mt-1 truncate font-mono text-[10px] text-slate-600">
                            {event.page_path}
                          </p>
                        )}

                        {event.content_type && (
                          <span className="mt-2 inline-block rounded-lg bg-white/[0.04] px-2 py-1 text-[9px] font-bold text-slate-500">
                            {event.content_type}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                )}

              </div>
            )}
          </Section>
        </div>

        {/* =================================================
            ACCOUNT INFORMATION
        ================================================= */}

        <div className="mt-6">
          <Section
            title="حالة الحساب"
            description="معلومات اعتماد وحالة حساب الطالب"
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

              <div className="rounded-2xl bg-white/[0.025] p-4">
                <p className="text-[10px] font-bold text-slate-600">
                  حالة الحساب
                </p>

                <p className="mt-2 text-sm font-black text-white">
                  {statusConfig.label}
                </p>
              </div>

              <div className="rounded-2xl bg-white/[0.025] p-4">
                <p className="text-[10px] font-bold text-slate-600">
                  الحساب مفعل
                </p>

                <p
                  className={`mt-2 text-sm font-black ${
                    profile.is_active
                      ? 'text-emerald-400'
                      : 'text-red-400'
                  }`}
                >
                  {profile.is_active
                    ? 'نعم'
                    : 'لا'}
                </p>
              </div>


            </div>

          </Section>
        </div>

        {/* =================================================
            FOOTER
        ================================================= */}

        <div className="py-8 text-center">
          <p className="text-[10px] font-bold text-slate-700">
            Student Profile • منصة كيمياء أستاذ أحمد محمد رمضان
          </p>
        </div>

      </div>
    </div>
  );
}