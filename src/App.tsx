import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import GroupsPage from './pages/GroupsPage';
import CoursesPage from './pages/CoursesPage';
import StudentProfileWithAnalytics from './pages/StudentProfileWithAnalytics';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import { useAuthStore } from './store/authStore';
import AuthPage from './pages/AuthPage';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import StudentsPage from './pages/StudentsPage';
import AdminSuitePage from './pages/AdminSuitePage';
import AdminAdvancedPage from './pages/AdminAdvancedPage';
import ExamQuestionsPage from './pages/ExamQuestionsPage';

function ProtectedPlatform({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuthStore();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#07090f] text-slate-400 font-medium" dir="rtl">جاري التحميل...</div>;
  if (!user || !profile) return <Navigate to="/auth" replace />;
  if (profile.status === 'pending') return <div className="min-h-screen flex flex-col items-center justify-center bg-[#07090f] p-4" dir="rtl"><div className="bg-[#11151d] p-8 rounded-3xl text-center max-w-md w-full border border-yellow-500/10"><div className="w-16 h-16 bg-yellow-500/10 text-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">⏳</div><h2 className="text-xl font-bold text-white mb-2">حسابك قيد المراجعة</h2><p className="text-slate-500 mb-6 leading-relaxed">تم استلام طلب التسجيل الخاص بك بنجاح. يرجى الانتظار حتى يتم تفعيل الحساب.</p><button onClick={signOut} className="text-red-400 font-medium hover:underline" type="button">تسجيل الخروج</button></div></div>;
  if (profile.status === 'suspended' || profile.status === 'rejected') return <div className="min-h-screen flex flex-col items-center justify-center bg-[#07090f] p-4" dir="rtl"><div className="bg-[#11151d] p-8 rounded-3xl text-center max-w-md w-full border border-red-500/10"><div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">🚫</div><h2 className="text-xl font-bold text-white mb-2">حساب غير متاح</h2><p className="text-slate-500 mb-6 leading-relaxed">لا يمكنك الوصول إلى المنصة حاليًا، يرجى مراجعة الإدارة.</p><button onClick={signOut} className="text-red-400 font-medium hover:underline" type="button">تسجيل الخروج</button></div></div>;
  return <>{children}</>;
}
function AdminOnly({ children }: { children: React.ReactNode }) { const { profile } = useAuthStore(); return profile?.role === 'admin' ? <>{children}</> : <Navigate to="/" replace />; }
export default function App() { const { initialize, profile } = useAuthStore(); useEffect(() => { void initialize(); }, [initialize]); return <BrowserRouter><Routes>
  <Route path="/auth" element={<AuthPage />} />
  <Route path="/admin/students" element={<ProtectedPlatform><AdminOnly><StudentsPage /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/students/:studentId" element={<ProtectedPlatform><AdminOnly><StudentProfileWithAnalytics /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/groups" element={<ProtectedPlatform><AdminOnly><GroupsPage /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/courses" element={<ProtectedPlatform><AdminOnly><CoursesPage /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/analytics" element={<ProtectedPlatform><AdminOnly><AdminAnalyticsPage /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/lessons" element={<ProtectedPlatform><AdminOnly><AdminAdvancedPage mode="lessons" /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/assignments" element={<ProtectedPlatform><AdminOnly><AdminAdvancedPage mode="assignments" /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/exams" element={<ProtectedPlatform><AdminOnly><AdminSuitePage mode="exams" /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/exams/:examId/questions" element={<ProtectedPlatform><AdminOnly><ExamQuestionsPage /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/grades" element={<ProtectedPlatform><AdminOnly><AdminSuitePage mode="grades" /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/attendance" element={<ProtectedPlatform><AdminOnly><AdminAdvancedPage mode="attendance" /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/activation-codes" element={<ProtectedPlatform><AdminOnly><AdminSuitePage mode="activation-codes" /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/staff" element={<ProtectedPlatform><AdminOnly><AdminAdvancedPage mode="staff" /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/notifications" element={<ProtectedPlatform><AdminOnly><AdminAdvancedPage mode="notifications" /></AdminOnly></ProtectedPlatform>} />
  <Route path="/admin/settings" element={<ProtectedPlatform><AdminOnly><AdminSuitePage mode="settings" /></AdminOnly></ProtectedPlatform>} />
  <Route path="/" element={<ProtectedPlatform>{profile?.role === 'admin' ? <AdminDashboard /> : <StudentDashboard />}</ProtectedPlatform>} />
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes></BrowserRouter>; }
