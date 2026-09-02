export const STAFF_PERMISSIONS = [
  ['students.read', 'قراءة الطلاب'],
  ['attendance.manage', 'إدارة الحضور'],
  ['content.read', 'قراءة الدروس والمحتوى'],
  ['lessons.manage', 'إدارة الدروس'],
  ['assignments.read', 'قراءة الواجبات'],
  ['assignments.manage', 'إدارة الواجبات'],
  ['exams.manage', 'إدارة الامتحانات'],
  ['exams.questions', 'إدارة أسئلة الامتحانات'],
  ['notifications.read', 'قراءة الإشعارات'],
  ['notifications.manage', 'إدارة الإشعارات'],
  ['analytics.read', 'قراءة التحليلات'],
  ['audit.read', 'قراءة سجل الرقابة'],
] as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[number][0];

/** Compatibility aliases for older assistant accounts. */
export function hasStaffPermission(
  permissions: Record<string, boolean> | null | undefined,
  permission: StaffPermission,
) {
  const p = permissions ?? {};
  if (p[permission]) return true;
  if (permission === 'content.read' && p['lessons.manage']) return true;
  if (permission === 'assignments.read' && p['assignments.manage']) return true;
  if (permission === 'notifications.read' && p['notifications.manage']) return true;
  return false;
}
