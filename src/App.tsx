
import GroupsPage from './pages/GroupsPage';
import React, { useEffect } from 'react';
import StudentProfilePage from './pages/StudentProfilePage';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { useAuthStore } from './store/authStore';

import AuthPage from './pages/AuthPage';
import AdminDashboard from './pages/AdminDashboard';
import StudentDashboard from './pages/StudentDashboard';
import StudentsPage from './pages/StudentsPage';

function ProtectedPlatform({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    user,
    profile,
    loading,
    signOut,
  } = useAuthStore();

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 font-medium"
        dir="rtl"
      >
        جاري التحميل...
      </div>
    );
  }

  // =========================
  // NOT LOGGED IN
  // =========================

  if (!user || !profile) {
    return (
      <Navigate
        to="/auth"
        replace
      />
    );
  }

  // =========================
  // PENDING
  // =========================

  if (profile.status === 'pending') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4"
        dir="rtl"
      >
        <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full border border-yellow-100">
          <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            ⏳
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-2">
            حسابك قيد المراجعة
          </h2>

          <p className="text-slate-600 mb-6 leading-relaxed">
            تم استلام طلب التسجيل الخاص بك بنجاح.
            يرجى الانتظار حتى يتم تفعيل الحساب.
          </p>

          <button
            onClick={signOut}
            className="text-red-600 font-medium hover:underline"
            type="button"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  // =========================
  // SUSPENDED / REJECTED
  // =========================

  if (
    profile.status === 'suspended' ||
    profile.status === 'rejected'
  ) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4"
        dir="rtl"
      >
        <div className="bg-white p-8 rounded-xl shadow-sm text-center max-w-md w-full border border-red-100">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            🚫
          </div>

          <h2 className="text-xl font-bold text-slate-800 mb-2">
            حساب غير متاح
          </h2>

          <p className="text-slate-600 mb-6 leading-relaxed">
            لا يمكنك الوصول إلى المنصة حاليًا،
            يرجى مراجعة الإدارة.
          </p>

          <button
            onClick={signOut}
            className="text-red-600 font-medium hover:underline"
            type="button"
          >
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  // =========================
  // PLATFORM
  // =========================

  return <>{children}</>;
}

export default function App() {
  const {
    initialize,
    profile,
  } = useAuthStore();

  // =========================
  // INITIALIZE AUTH
  // =========================

  useEffect(() => {
    initialize();
  }, [initialize]);

  // =========================
  // ROUTES
  // =========================

  return (
    <BrowserRouter>
      <Routes>

        {/* =========================
            AUTH
        ========================= */}

        <Route
          path="/auth"
          element={<AuthPage />}
        />

        {/* =========================
            ADMIN - STUDENTS
        ========================= */}

        <Route
          path="/admin/students"
          element={
            <ProtectedPlatform>
              {profile?.role === 'admin' ? (
                <StudentsPage />
              ) : (
                <Navigate to="/" replace />
              )}
            </ProtectedPlatform>
          }
        />
        
        <Route
  path="/admin/groups"
  element={
    <ProtectedPlatform>
      {profile?.role === 'admin' ? (
        <GroupsPage />
      ) : (
        <Navigate to="/" replace />
      )}
    </ProtectedPlatform>
  }
/>

<Route
  path="/admin/students/:studentId"
  element={<StudentProfilePage />}
/>

        {/* =========================
            HOME / DASHBOARD
        ========================= */}

        <Route
          path="/"
          element={
            <ProtectedPlatform>
              {profile?.role === 'admin' ? (
                <AdminDashboard />
              ) : (
                <StudentDashboard />
              )}
            </ProtectedPlatform>
          }
        />

        {/* =========================
            UNKNOWN ROUTE
        ========================= */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>
    </BrowserRouter>
  );
}
