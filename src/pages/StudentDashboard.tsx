import React from 'react';
import { useAuthStore } from '../store/authStore';

export default function StudentDashboard() {
  const { profile, signOut } = useAuthStore();

  return (
    <div className="min-h-screen bg-slate-50 p-8" dir="rtl">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm p-6 border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">مرحباً، {profile?.full_name}</h1>
        <p className="text-green-600 font-medium mb-6">حسابك مفعل (Active) وأنت متصل بنجاح كطالب.</p>
        <button
          onClick={signOut}
          className="bg-red-50 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-100 transition-colors"
        >
          تسجيل خروج
        </button>
      </div>
    </div>
  );
}