import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle2, ClipboardCheck, GraduationCap, LogIn, Moon, PlayCircle, ShieldCheck, Sparkles, Sun, Brain, FlaskConical, ArrowLeft, Menu, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const features = [
  { icon: PlayCircle, title: 'شرح منظم', text: 'دروس وفيديوهات مرتبة حسب الصف والكورس.' },
  { icon: ClipboardCheck, title: 'واجبات واختبارات', text: 'تدريب مستمر يساعدك تعرف مستواك وتطور أخطاءك.' },
  { icon: GraduationCap, title: 'متابعة مستواك', text: 'درجات وحضور ومتابعة تعليمية في مكان واحد.' },
  { icon: ShieldCheck, title: 'بيئة تعليمية آمنة', text: 'منصة مصممة لتكون سهلة للطالب وولي الأمر.' },
];

const tracks = [
  ['الطب وعلوم الحياة', 'مسار مناسب للطلاب المهتمين بالطب والعلوم الحيوية، مع تركيز أكبر على الأحياء والكيمياء.'],
  ['الهندسة وعلوم الحاسب', 'مسار يجمع بين الرياضيات والفيزياء، مع ارتباط واضح بالتكنولوجيا وعلوم الحاسب.'],
  ['الأعمال', 'مسار يهتم بالاقتصاد والرياضيات ومجالات الإدارة والمحاسبة.'],
  ['الآداب والفنون', 'مسار يركز على العلوم الإنسانية واللغات والجغرافيا والإحصاء.'],
];

function initialTheme(): 'dark' | 'light' {
  const saved = localStorage.getItem('platform-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function HomePage() {
  const { user } = useAuthStore();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => initialTheme());
  const [menuOpen, setMenuOpen] = useState(false);
  const light = theme === 'light';
  const dashboardHref = user ? '/dashboard' : '/auth';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('platform-theme', theme);
  }, [theme]);

  return (
    <main dir="rtl" className={`min-h-screen overflow-x-hidden ${light ? 'bg-slate-50 text-slate-900' : 'bg-[#07090f] text-white'}`}>
      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl ${light ? 'border-slate-200 bg-white/90' : 'border-white/[0.06] bg-[#07090f]/85'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-600 text-xl font-black text-black shadow-lg shadow-amber-500/20">أ</div><div className="min-w-0"><p className="truncate text-sm font-black sm:text-base">منصة أ. أحمد محمد رمضان</p><p className="text-[11px] text-slate-500">منصة الكيمياء التعليمية</p></div></Link>
          <nav className="hidden items-center gap-6 md:flex"><a href="#about" className="text-sm font-bold opacity-70 hover:opacity-100">عن المنصة</a><a href="#baccalaureate" className="text-sm font-bold opacity-70 hover:opacity-100">البكالوريا المصرية</a><a href="#features" className="text-sm font-bold opacity-70 hover:opacity-100">مميزات المنصة</a></nav>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setTheme(light ? 'dark' : 'light')} aria-label="تغيير الوضع" title={light ? 'الوضع الليلي' : 'الوضع النهاري'} className={`flex h-10 w-10 items-center justify-center rounded-xl border ${light ? 'border-slate-200 bg-slate-100 text-slate-700' : 'border-white/10 bg-white/[0.04] text-amber-300'}`}>{light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}</button><Link to={dashboardHref} className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-black sm:px-4 sm:text-sm"><LogIn className="h-4 w-4" />{user ? 'لوحتي' : 'تسجيل الدخول'}</Link><button type="button" onClick={() => setMenuOpen(v => !v)} className={`flex h-10 w-10 items-center justify-center rounded-xl border md:hidden ${light ? 'border-slate-200' : 'border-white/10'}`}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button></div>
        </div>
        {menuOpen && <div className={`border-t px-4 py-3 md:hidden ${light ? 'border-slate-200 bg-white' : 'border-white/[0.06] bg-[#0b0f16]'}`}><div className="grid gap-1"><a onClick={() => setMenuOpen(false)} href="#about" className="rounded-xl px-3 py-3 text-sm font-bold">عن المنصة</a><a onClick={() => setMenuOpen(false)} href="#baccalaureate" className="rounded-xl px-3 py-3 text-sm font-bold">البكالوريا المصرية</a><a onClick={() => setMenuOpen(false)} href="#features" className="rounded-xl px-3 py-3 text-sm font-bold">مميزات المنصة</a></div></div>}
      </header>

      <section className="relative overflow-hidden"><div className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-amber-500/10 blur-[130px]" /><div className="pointer-events-none absolute -bottom-40 -left-40 h-[460px] w-[460px] rounded-full bg-blue-500/10 blur-[140px]" /><div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:px-8 lg:pb-24 lg:pt-24">
        <div><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-3 py-1.5 text-xs font-bold text-amber-500"><Sparkles className="h-4 w-4" />تعلم الكيمياء بشكل أذكى</div><h1 className="max-w-3xl text-4xl font-black leading-[1.2] sm:text-5xl lg:text-6xl">الكيمياء أسهل لما تكون <span className="text-amber-400">منظمة</span>.</h1><p className={`mt-5 max-w-2xl text-base leading-8 sm:text-lg ${light ? 'text-slate-600' : 'text-slate-400'}`}>منصة كيمياء أستاذ أحمد محمد رمضان تساعدك تذاكر، تتدرب، تختبر نفسك وتتابع مستواك — من مكان واحد وبطريقة مناسبة للموبايل.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link to={dashboardHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-6 text-sm font-black text-black hover:bg-amber-300">{user ? 'فتح حسابي' : 'ابدأ التعلم'}<ArrowLeft className="h-4 w-4" /></Link>{!user && <Link to="/auth?mode=register" className={`inline-flex min-h-12 items-center justify-center rounded-2xl border px-6 text-sm font-bold ${light ? 'border-slate-300 bg-white' : 'border-white/10 bg-white/[0.04]'}`}>إنشاء حساب طالب</Link>}</div></div>
        <div className="relative mx-auto w-full max-w-md"><div className="absolute inset-4 rounded-[2rem] bg-amber-400/10 blur-3xl" /><div className={`relative overflow-hidden rounded-[2rem] border p-5 shadow-2xl ${light ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.03]'}`}><div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-amber-500/20 via-slate-900 to-blue-500/10"><div className="text-center"><div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 border-amber-300/30 bg-black/25 text-6xl font-black text-amber-300">أ</div><p className="mt-5 text-xl font-black text-white">أ. أحمد محمد رمضان</p><p className="mt-1 text-sm text-slate-400">مدرس الكيمياء</p><div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-black/20 px-4 py-2 text-xs text-slate-300"><FlaskConical className="h-4 w-4 text-amber-300" />أولى • ثانية • ثالثة ثانوي</div></div></div></div></div>
      </div></section>

      <section id="about" className={`border-y ${light ? 'border-slate-200 bg-white' : 'border-white/[0.06] bg-white/[0.02]'}`}><div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:px-8"><div><p className="text-sm font-bold text-amber-500">عن أستاذ أحمد</p><h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">تعلم الكيمياء بفهم، مش بالحفظ فقط.</h2></div><div className={`space-y-4 text-sm leading-8 sm:text-base ${light ? 'text-slate-600' : 'text-slate-400'}`}><p>المنصة مخصصة لطلاب المرحلة الثانوية لبناء فهم قوي للمفاهيم الكيميائية وتحويل الفهم إلى تدريب وحل أسئلة ومراجعة مستمرة.</p><p>الفكرة ليست مجرد مشاهدة فيديو؛ بل رحلة تعليمية تبدأ من الدرس، ثم التدريب، ثم الاختبار، ثم تحسين المستوى.</p><p className="font-bold text-amber-500">هدفنا: طالب فاهم الكيمياء وقادر يحل، وليس طالب حافظ الإجابة فقط.</p></div></div></section>

      <section id="features" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="mb-9 text-center"><p className="text-sm font-bold text-amber-500">كل ما تحتاجه</p><h2 className="mt-2 text-3xl font-black">تجربة تعليمية متكاملة</h2></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{features.map(({ icon: Icon, title, text }) => <div key={title} className={`rounded-3xl border p-5 transition hover:-translate-y-1 ${light ? 'border-slate-200 bg-white shadow-sm' : 'border-white/[0.07] bg-white/[0.025]'}`}><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-500"><Icon className="h-5 w-5" /></div><h3 className="mt-4 font-black">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-500">{text}</p></div>)}</div></section>

      <section id="baccalaureate" className={`border-y ${light ? 'border-slate-200 bg-slate-100' : 'border-white/[0.06] bg-[#0b0f17]'}`}><div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="grid gap-10 lg:grid-cols-[.85fr_1.15fr]"><div><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-black text-blue-500"><Brain className="h-4 w-4" />نظام الثانوية يتغير</div><h2 className="text-3xl font-black leading-tight sm:text-4xl">البكالوريا المصرية<br />والثانوية الحديثة</h2><p className={`mt-5 text-sm leading-8 ${light ? 'text-slate-600' : 'text-slate-400'}`}>من العام الدراسي 2025/2026 بدأت تعديلات جديدة على الدراسة والتقييم في المرحلة الثانوية. ويستمر تطوير المنظومة مع التركيز على تقليل ضغط الامتحان، وتوجيه الطالب نحو مسار يناسب ميوله ومستقبله.</p></div><div className="grid gap-4 sm:grid-cols-2">{tracks.map(([title, text], i) => <div key={title} className={`rounded-3xl border p-5 ${light ? 'border-slate-200 bg-white' : 'border-white/[0.07] bg-white/[0.025]'}`}><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-sm font-black text-blue-500">0{i + 1}</div><h3 className="font-black">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-500">{text}</p></div>)}</div></div><div className={`mt-8 rounded-3xl border p-5 sm:p-6 ${light ? 'border-slate-200 bg-white' : 'border-white/[0.07] bg-white/[0.025]'}`}><h3 className="flex items-center gap-2 font-black"><FlaskConical className="h-5 w-5 text-amber-500" />ماذا يعني هذا لطالب الكيمياء؟</h3><div className={`mt-4 grid gap-4 text-sm leading-7 sm:grid-cols-3 ${light ? 'text-slate-600' : 'text-slate-400'}`}><p><b className="text-amber-500">فهم أعمق:</b> الكيمياء مادة محورية في المسارات العلمية، لذلك الفهم والتدريب أهم من حفظ الإجابات.</p><p><b className="text-amber-500">تدريب مستمر:</b> حل أسئلة متنوعة ومراجعة الأخطاء أصبحا أهم من الاعتماد على امتحان واحد.</p><p><b className="text-amber-500">اختيار المسار:</b> النظام الجديد يعطي الطالب مساحة أكبر لتوجيه دراسته نحو المجال الذي يناسب ميوله وطموحه.</p></div></div></div></section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className={`rounded-[2rem] p-7 text-center sm:p-10 ${light ? 'bg-slate-900 text-white' : 'border border-amber-400/10 bg-gradient-to-br from-amber-400/[0.08] to-blue-500/[0.05]'}`}><GraduationCap className="mx-auto h-8 w-8 text-amber-400" /><h2 className="mt-4 text-2xl font-black sm:text-3xl">جاهز تبدأ؟</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-7 opacity-70">ابدأ من الدرس، اتدرب، اختبر نفسك، وخلي مستواك يتكلم عنك.</p><Link to={dashboardHref} className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-7 text-sm font-black text-black hover:bg-amber-300">{user ? 'فتح حسابي' : 'ابدأ الآن'}<ArrowLeft className="h-4 w-4" /></Link></div></section>
      <footer className={`border-t px-4 py-8 text-center text-xs ${light ? 'border-slate-200 text-slate-500' : 'border-white/[0.06] text-slate-600'}`}>© {new Date().getFullYear()} منصة كيمياء أستاذ أحمد محمد رمضان — جميع الحقوق محفوظة</footer>
    </main>
  );
}
