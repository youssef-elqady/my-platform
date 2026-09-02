import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  FlaskConical,
  GraduationCap,
  LogIn,
  Menu,
  Moon,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Users,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const features = [
  { icon: PlayCircle, title: 'شرح واضح ومنظم', text: 'محتوى مرتب يساعدك تمشي في المنهج خطوة بخطوة من غير تشتت.' },
  { icon: ClipboardCheck, title: 'تدريب واختبارات', text: 'حل أسئلة وقيّم مستواك باستمرار، واعرف أين تحتاج إلى مزيد من التدريب.' },
  { icon: Target, title: 'تركيز على الفهم', text: 'نحوّل القاعدة والمعلومة إلى فهم وتطبيق، بدل الاعتماد على الحفظ وحده.' },
  { icon: ShieldCheck, title: 'متابعة منظمة', text: 'بيئة تعليمية تجمع المحتوى والتدريب والدرجات والمتابعة في مكان واحد.' },
];

const benefits = [
  'تفهم الفكرة قبل أن تبدأ في حفظها.',
  'تتدرّب على أنماط مختلفة من الأسئلة.',
  'تكتشف أخطاءك وتعرف كيف تتجنب تكرارها.',
  'تراجع الدروس في الوقت الذي يناسبك.',
  'تتابع مستواك بصورة أوضح مع الوقت.',
  'تبني ثقة حقيقية في قدرتك على حل السؤال.',
];

const grades = [
  ['01', 'الصف الأول الثانوي', 'بداية قوية وفهم سليم لأساسيات الكيمياء.'],
  ['02', 'الصف الثاني الثانوي', 'تعمّق أكبر في المفاهيم والتطبيق وحل الأسئلة.'],
  ['03', 'الصف الثالث الثانوي', 'مراجعة وتدريب مكثف والاستعداد الجاد للامتحان.'],
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
  const [teacherImageError, setTeacherImageError] = useState(false);
  const light = theme === 'light';
  const dashboardHref = user ? '/dashboard' : '/auth';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('platform-theme', theme);
  }, [theme]);

  const sectionLink = (id: string) => () => setMenuOpen(false);

  return (
    <main dir="rtl" className={`min-h-screen overflow-x-hidden ${light ? 'bg-[#f7f8fb] text-slate-900' : 'bg-[#06080d] text-white'}`}>
      <header className={`sticky top-0 z-50 border-b backdrop-blur-2xl ${light ? 'border-slate-200/80 bg-white/90' : 'border-white/[0.07] bg-[#06080d]/90'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-200 via-amber-400 to-orange-600 text-xl font-black text-black shadow-lg shadow-amber-500/20">أ</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black sm:text-base">منصة أ. أحمد محمد رمضان</p>
              <p className={`text-[11px] ${light ? 'text-slate-500' : 'text-slate-400'}`}>منصة الكيمياء التعليمية</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <a href="#about" className="text-sm font-bold opacity-70 transition hover:opacity-100">عن المستر</a>
            <a href="#experience" className="text-sm font-bold opacity-70 transition hover:opacity-100">ماذا ستستفيد؟</a>
            <a href="#features" className="text-sm font-bold opacity-70 transition hover:opacity-100">مميزات المنصة</a>
            <a href="#updates" className="text-sm font-bold opacity-70 transition hover:opacity-100">أحدث المستجدات</a>
          </nav>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setTheme(light ? 'dark' : 'light')} aria-label="تغيير الوضع" title={light ? 'الوضع الليلي' : 'الوضع النهاري'} className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${light ? 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200' : 'border-white/10 bg-white/[0.04] text-amber-300 hover:bg-white/[0.08]'}`}>
              {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <Link to={dashboardHref} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-amber-400 px-3 text-xs font-black text-black transition hover:bg-amber-300 sm:px-4 sm:text-sm">
              <LogIn className="h-4 w-4" />{user ? 'لوحتي' : 'تسجيل الدخول'}
            </Link>
            <button type="button" onClick={() => setMenuOpen(v => !v)} aria-label="القائمة" className={`flex h-10 w-10 items-center justify-center rounded-xl border md:hidden ${light ? 'border-slate-200' : 'border-white/10'}`}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className={`border-t px-4 py-3 md:hidden ${light ? 'border-slate-200 bg-white' : 'border-white/[0.06] bg-[#0a0d14]'}`}>
            <div className="grid gap-1">
              <a onClick={sectionLink('about')} href="#about" className="rounded-xl px-3 py-3 text-sm font-bold">عن المستر</a>
              <a onClick={sectionLink('experience')} href="#experience" className="rounded-xl px-3 py-3 text-sm font-bold">ماذا ستستفيد؟</a>
              <a onClick={sectionLink('features')} href="#features" className="rounded-xl px-3 py-3 text-sm font-bold">مميزات المنصة</a>
              <a onClick={sectionLink('updates')} href="#updates" className="rounded-xl px-3 py-3 text-sm font-bold">أحدث المستجدات</a>
            </div>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-amber-500/10 blur-[140px]" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[480px] w-[480px] rounded-full bg-blue-500/10 blur-[140px]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-24 lg:pt-20">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-3 py-1.5 text-xs font-black text-amber-500">
              <Sparkles className="h-4 w-4" />تعلم الكيمياء بفهم وثقة
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.18] tracking-tight sm:text-5xl lg:text-6xl">
              مش هدفنا تحفظ الكيمياء…
              <span className="mt-2 block text-amber-400">هدفنا إنك تفهمها.</span>
            </h1>
            <p className={`mt-6 max-w-2xl text-base leading-8 sm:text-lg ${light ? 'text-slate-600' : 'text-slate-400'}`}>
              مع أستاذ أحمد محمد رمضان، تتعلم الكيمياء خطوة بخطوة، وتحوّل المعلومة إلى فهم وتطبيق وحل أسئلة، في تجربة تعليمية منظمة تناسب طالب المرحلة الثانوية.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to={dashboardHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-400 px-7 text-sm font-black text-black transition hover:-translate-y-0.5 hover:bg-amber-300">
                {user ? 'فتح لوحتي' : 'ابدأ رحلتك التعليمية'}<ArrowLeft className="h-4 w-4" />
              </Link>
              {!user && <Link to="/auth?mode=register" className={`inline-flex min-h-12 items-center justify-center rounded-2xl border px-7 text-sm font-bold transition hover:-translate-y-0.5 ${light ? 'border-slate-300 bg-white hover:bg-slate-50' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'}`}>إنشاء حساب طالب</Link>}
            </div>
            <div className={`mt-8 flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold ${light ? 'text-slate-500' : 'text-slate-500'}`}>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />شرح منظم</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />تدريب مستمر</span>
              <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500" />متابعة للمستوى</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[440px]">
            <div className="absolute inset-8 rounded-[3rem] bg-amber-400/10 blur-3xl" />
            <div className={`relative overflow-hidden rounded-[2.25rem] border p-3 shadow-2xl ${light ? 'border-slate-200 bg-white' : 'border-white/[0.09] bg-white/[0.035]'}`}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.8rem] bg-gradient-to-br from-amber-500/20 via-slate-900 to-blue-600/10">
                {!teacherImageError ? (
                  <img src="/teacher-ahmed.jpg" alt="أستاذ أحمد محمد رمضان" className="h-full w-full object-cover" onError={() => setTeacherImageError(true)} />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-full border-4 border-amber-300/30 bg-black/25 text-7xl font-black text-amber-300 shadow-2xl">أ</div>
                      <p className="mt-6 text-2xl font-black text-white">أ. أحمد محمد رمضان</p>
                      <p className="mt-2 text-sm text-slate-400">مدرس الكيمياء</p>
                    </div>
                  </div>
                )}
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/10 bg-black/55 p-4 backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-white">أ. أحمد محمد رمضان</p>
                      <p className="mt-1 text-xs text-slate-300">مدرس الكيمياء للمرحلة الثانوية</p>
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-black"><FlaskConical className="h-5 w-5" /></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className={`border-y ${light ? 'border-slate-200 bg-white' : 'border-white/[0.06] bg-white/[0.018]'}`}>
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[.78fr_1.22fr] lg:px-8">
          <div>
            <p className="text-sm font-black text-amber-500">عن المستر</p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">مدرس هدفه إن المعلومة توصل للطالب فعلًا.</h2>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-500"><Award className="h-5 w-5" /></div>
              <div><p className="text-sm font-black">تعليم قائم على الفهم والتطبيق</p><p className="mt-1 text-xs text-slate-500">مش مجرد حفظ للإجابة</p></div>
            </div>
          </div>
          <div className={`space-y-5 text-sm leading-8 sm:text-base ${light ? 'text-slate-600' : 'text-slate-400'}`}>
            <p>أستاذ أحمد محمد رمضان يهتم بأن يفهم الطالب الفكرة من أساسها، ويعرف كيف يستخدمها في السؤال، بدل ما يعتمد على حفظ خطوات ثابتة قد لا تنفعه عندما يتغير شكل السؤال.</p>
            <p>الشرح يبدأ من تبسيط المفهوم، ثم ربطه بما سبقه، وبعدها الانتقال إلى التطبيق والتدريب؛ لأن الفهم الحقيقي يظهر عندما يستطيع الطالب أن يفكر ويحل بنفسه.</p>
            <p className="font-bold text-amber-500">الهدف في النهاية ليس أن تعرف الإجابة فقط، ولكن أن تعرف كيف وصلت إليها.</p>
          </div>
        </div>
      </section>

      <section id="experience" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-black text-amber-500">إيه اللي هتستفيده؟</p>
            <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">هتذاكر بشكل أهدى… وتحس بتقدمك بشكل أوضح.</h2>
            <p className={`mt-5 text-sm leading-8 ${light ? 'text-slate-600' : 'text-slate-400'}`}>التعلم الجيد مش بكثرة الساعات، لكن بجودة الفهم والتدريب ومعرفة نقاط الضعف والعمل عليها.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {benefits.map((benefit, index) => (
              <div key={benefit} className={`flex gap-3 rounded-2xl border p-4 ${light ? 'border-slate-200 bg-white' : 'border-white/[0.07] bg-white/[0.025]'}`}>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-xs font-black text-amber-500">{index + 1}</div>
                <p className="text-sm font-bold leading-6">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className={`border-y ${light ? 'border-slate-200 bg-slate-100/80' : 'border-white/[0.06] bg-[#0b0e15]'}`}>
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-9 text-center"><p className="text-sm font-black text-amber-500">التجربة التعليمية</p><h2 className="mt-2 text-3xl font-black">كل اللي تحتاجه في مكان واحد</h2></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, text }) => (
              <div key={title} className={`rounded-3xl border p-5 transition duration-300 hover:-translate-y-1 ${light ? 'border-slate-200 bg-white shadow-sm' : 'border-white/[0.07] bg-white/[0.025]'}`}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-500"><Icon className="h-5 w-5" /></div>
                <h3 className="mt-5 font-black">{title}</h3>
                <p className={`mt-2 text-sm leading-7 ${light ? 'text-slate-500' : 'text-slate-500'}`}>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-9 text-center"><p className="text-sm font-black text-amber-500">طلابنا</p><h2 className="mt-2 text-3xl font-black">رحلتك تبدأ من صفك</h2></div>
        <div className="grid gap-4 md:grid-cols-3">
          {grades.map(([number, title, text]) => (
            <div key={number} className={`group rounded-3xl border p-6 transition duration-300 hover:-translate-y-1 ${light ? 'border-slate-200 bg-white shadow-sm' : 'border-white/[0.07] bg-white/[0.025]'}`}>
              <div className="flex items-center justify-between"><span className="text-4xl font-black text-amber-400/80">{number}</span><GraduationCap className="h-6 w-6 text-amber-500" /></div>
              <h3 className="mt-7 text-lg font-black">{title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-500">{text}</p>
              <div className="mt-5 inline-flex items-center gap-1 text-xs font-black text-amber-500">جاهز تبدأ؟ <ChevronLeft className="h-4 w-4 transition group-hover:-translate-x-1" /></div>
            </div>
          ))}
        </div>
      </section>

      <section id="updates" className={`border-y ${light ? 'border-slate-200 bg-white' : 'border-white/[0.06] bg-white/[0.018]'}`}>
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-black text-blue-500"><Brain className="h-4 w-4" />معاك في كل جديد</div>
              <h2 className="text-3xl font-black leading-tight sm:text-4xl">التعليم بيتطور… وإحنا بنتابع.</h2>
            </div>
            <div className={`rounded-3xl border p-6 ${light ? 'border-slate-200 bg-slate-50' : 'border-white/[0.07] bg-white/[0.025]'}`}>
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500"><Sparkles className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-black">مواكبة أحدث المستجدات التعليمية</h3>
                  <p className={`mt-2 text-sm leading-8 ${light ? 'text-slate-600' : 'text-slate-400'}`}>مع التحديثات المستمرة في نظم الدراسة والمناهج والتقييم، نحرص على أن تظل المنصة مواكبة لكل جديد يهم الطالب وولي الأمر، بحيث تكون دائمًا على اطلاع بما يستجد في رحلتك التعليمية.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] border border-amber-400/20 bg-gradient-to-br from-amber-400/15 via-transparent to-blue-500/10 p-7 text-center sm:p-10">
          <div className="pointer-events-none absolute -left-20 -top-20 h-48 w-48 rounded-full bg-amber-400/10 blur-3xl" />
          <Users className="relative mx-auto h-9 w-9 text-amber-400" />
          <h2 className="relative mt-4 text-3xl font-black">ابدأ من النهارده</h2>
          <p className={`relative mx-auto mt-3 max-w-2xl text-sm leading-7 ${light ? 'text-slate-600' : 'text-slate-400'}`}>خلّي مذاكرة الكيمياء أكثر تنظيمًا، وابدأ تبني فهمك خطوة بخطوة.</p>
          <Link to={dashboardHref} className="relative mt-6 inline-flex min-h-12 items-center gap-2 rounded-2xl bg-amber-400 px-7 text-sm font-black text-black transition hover:bg-amber-300">{user ? 'الذهاب إلى لوحتي' : 'ابدأ التعلم الآن'}<ArrowLeft className="h-4 w-4" /></Link>
        </div>
      </section>

      <footer className={`border-t ${light ? 'border-slate-200 bg-white' : 'border-white/[0.06] bg-[#05070b]'}`}>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div><p className="font-black">منصة أ. أحمد محمد رمضان</p><p className="mt-1 text-xs text-slate-500">تعلم الكيمياء بفهم وثقة.</p></div>
          <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-500"><Link to="/auth" className="hover:text-amber-500">تسجيل الدخول</Link><a href="#about" className="hover:text-amber-500">عن المستر</a><a href="#features" className="hover:text-amber-500">مميزات المنصة</a></div>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} جميع الحقوق محفوظة.</p>
        </div>
      </footer>
    </main>
  );
}
