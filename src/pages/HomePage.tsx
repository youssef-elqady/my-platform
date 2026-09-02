import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, ClipboardCheck, GraduationCap, LogIn, PlayCircle, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const features = [
  { icon: PlayCircle, title: 'شرح منظم', text: 'دروس وفيديوهات مرتبة حسب الصف والكورس.' },
  { icon: ClipboardCheck, title: 'واجبات واختبارات', text: 'تدريب مستمر وقياس حقيقي لمستواك.' },
  { icon: GraduationCap, title: 'متابعة مستواك', text: 'نتائج ودرجات وحضور في مكان واحد.' },
  { icon: ShieldCheck, title: 'بيئة آمنة', text: 'حسابات وصلاحيات مصممة لحماية بيانات الطلاب.' },
];

export default function HomePage() {
  const { user, profile } = useAuthStore();
  const dashboardHref = user ? '/dashboard' : '/auth';
  const dashboardText = user ? 'الدخول إلى لوحة التحكم' : 'تسجيل الدخول';

  return (
    <main dir="rtl" className="min-h-screen overflow-x-hidden bg-[#07090f] text-white">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full bg-amber-500/10 blur-[130px]" />
        <div className="absolute -bottom-40 -left-40 h-[460px] w-[460px] rounded-full bg-blue-500/10 blur-[140px]" />
      </div>

      <header className="relative z-10 border-b border-white/[0.06] bg-[#07090f]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-600 text-xl font-black text-black shadow-lg shadow-amber-500/20">أ</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black sm:text-base">منصة أ. أحمد محمد رمضان</p>
              <p className="text-[11px] text-slate-500">منصة الكيمياء التعليمية</p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {user && profile ? <span className="hidden text-xs text-slate-400 sm:block">مرحبًا، {profile.full_name}</span> : null}
            <Link to={dashboardHref} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-black transition hover:bg-amber-300 sm:px-4 sm:text-sm">
              <LogIn className="h-4 w-4" />
              {dashboardText}
            </Link>
          </div>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:pb-24 lg:pt-24">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/15 bg-amber-400/[0.07] px-3 py-1.5 text-xs font-bold text-amber-300">
            <Sparkles className="h-4 w-4" />
            تعلم الكيمياء بشكل أذكى
          </div>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.2] tracking-tight sm:text-5xl lg:text-6xl">
            منصة كيمياء أستاذ أحمد محمد رمضان
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
            مكان واحد لشرح الكيمياء، الدروس، الواجبات، الاختبارات، الدرجات والحضور — بتجربة بسيطة وسريعة ومناسبة للموبايل.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link to={dashboardHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 text-sm font-black text-black transition hover:-translate-y-0.5 hover:bg-amber-300">
              {user ? 'فتح حسابي' : 'ابدأ من هنا'}
              <LogIn className="h-4 w-4" />
            </Link>
            {!user && <Link to="/auth?mode=register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-6 text-sm font-bold text-white transition hover:bg-white/[0.07]">إنشاء حساب طالب</Link>}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute inset-4 rounded-[2rem] bg-amber-400/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-5 shadow-2xl shadow-black/30">
            <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/[0.07] bg-gradient-to-br from-amber-500/20 via-slate-900 to-blue-500/10">
              <div className="text-center">
                <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 border-amber-300/30 bg-black/25 text-6xl font-black text-amber-300 shadow-2xl shadow-amber-500/10">أ</div>
                <p className="mt-5 text-xl font-black">أ. أحمد محمد رمضان</p>
                <p className="mt-1 text-sm text-slate-400">مدرس الكيمياء</p>
                <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-black/20 px-4 py-2 text-xs text-slate-300">
                  <BookOpen className="h-4 w-4 text-amber-300" />
                  أولى • ثانية • ثالثة ثانوي
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs leading-6 text-slate-500">الصورة الشخصية الفعلية للمدرس يمكن وضعها هنا مباشرة بمجرد إضافتها للمشروع.</p>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/[0.06] bg-white/[0.02]">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <p className="text-sm font-bold text-amber-300">كل ما تحتاجه في مكان واحد</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">تجربة تعليمية متكاملة</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl border border-white/[0.07] bg-black/10 p-5 transition hover:-translate-y-1 hover:bg-white/[0.04]">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300"><Icon className="h-5 w-5" /></div>
                <h3 className="mt-4 font-black">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5"><Users className="h-5 w-5 text-amber-300" /><p className="mt-3 font-black">طلابك في نظام واحد</p><p className="mt-1 text-xs leading-6 text-slate-500">إدارة الطلاب والمجموعات والصلاحيات بسهولة.</p></div>
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5"><BookOpen className="h-5 w-5 text-amber-300" /><p className="mt-3 font-black">محتوى منظم</p><p className="mt-1 text-xs leading-6 text-slate-500">كورس ← فصل ← درس، مع الواجبات والاختبارات.</p></div>
          <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5"><CheckCircle2 className="h-5 w-5 text-amber-300" /><p className="mt-3 font-black">متابعة مستمرة</p><p className="mt-1 text-xs leading-6 text-slate-500">درجات وحضور وإشعارات ومؤشرات أداء.</p></div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06] px-4 py-7 text-center text-xs text-slate-600">
        © {new Date().getFullYear()} منصة كيمياء أستاذ أحمد محمد رمضان — جميع الحقوق محفوظة
      </footer>
    </main>
  );
}
