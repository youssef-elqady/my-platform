import React, { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, FlaskConical, GraduationCap, HelpCircle, Loader2, LogIn, MessageCircle, ShieldCheck, UserPlus } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

type Tab = 'login' | 'register' | 'parent';
type Message = { text: string; type: 'error' | 'success' | 'warning' } | null;

type Grade = { id: string; name: string };

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile } = useAuthStore();
  const [tab, setTab] = useState<Tab>(searchParams.get('mode') === 'register' ? 'register' : 'login');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradesLoading, setGradesLoading] = useState(true);

  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [grade, setGrade] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [studentCode, setStudentCode] = useState<string | null>(null);

  useEffect(() => {
    if (user && profile && profile.is_active && profile.status === 'active') navigate('/dashboard', { replace: true });
  }, [user, profile, navigate]);

  useEffect(() => {
    let cancelled = false;
    const loadGrades = async () => {
      const { data } = await supabase.from('grades').select('id,name').order('name');
      if (!cancelled) {
        setGrades((data || []) as Grade[]);
        setGradesLoading(false);
      }
    };
    void loadGrades();
    return () => { cancelled = true; };
  }, []);

  const messageClass = useMemo(() => {
    if (!message) return '';
    if (message.type === 'error') return 'border-red-400/20 bg-red-400/10 text-red-300';
    if (message.type === 'warning') return 'border-amber-400/20 bg-amber-400/10 text-amber-300';
    return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300';
  }, [message]);

  const switchTab = (next: Tab) => {
    setTab(next);
    setMessage(null);
    setStudentCode(null);
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setMessage(null);
    const identifier = loginId.trim();
    if (!identifier || !loginPassword) {
      setMessage({ text: 'اكتب كود الطالب أو رقم الهاتف أو البريد الإلكتروني وكلمة المرور.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('login-student', {
        body: { login_id: identifier, password: loginPassword },
      });
      if (error) {
        const context = (error as Error & { context?: Response }).context;
        let serverMessage = error.message;
        if (context) {
          try {
            const body = await context.clone().json();
            serverMessage = body?.error || body?.message || serverMessage;
          } catch { /* keep the default message */ }
        }
        throw new Error(serverMessage);
      }
      if (!data?.success || !data.access_token || !data.refresh_token) throw new Error(data?.error || 'بيانات تسجيل الدخول غير صحيحة.');

      const { error: sessionError } = await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      if (sessionError) throw new Error('تعذر إنشاء جلسة الدخول. حاول مرة أخرى.');

      setMessage({ text: 'تم تسجيل الدخول بنجاح، جاري فتح حسابك...', type: 'success' });
      window.setTimeout(() => navigate('/dashboard', { replace: true }), 250);
    } catch (error) {
      await supabase.auth.signOut();
      setMessage({ text: error instanceof Error ? error.message : 'تعذر تسجيل الدخول.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setMessage(null);
    if (!name.trim() || !phone.trim() || !parentPhone.trim() || !grade || !password) {
      setMessage({ text: 'أكمل البيانات المطلوبة أولًا.', type: 'error' });
      return;
    }
    if (!/^01\d{9}$/.test(phone.trim())) {
      setMessage({ text: 'اكتب رقم الطالب بصيغة مصرية صحيحة مثل 01012345678.', type: 'error' });
      return;
    }
    if (!/^01\d{9}$/.test(parentPhone.trim())) {
      setMessage({ text: 'اكتب رقم ولي الأمر بصيغة مصرية صحيحة مثل 01012345678.', type: 'error' });
      return;
    }
    if (password.length < 6) {
      setMessage({ text: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.', type: 'error' });
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ text: 'تأكيد كلمة المرور غير مطابق.', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('register-student', {
        body: { full_name: name.trim(), phone: phone.trim(), email: email.trim() || null, parent_phone: parentPhone.trim(), grade, password },
      });
      if (error) {
        const context = (error as Error & { context?: Response }).context;
        let serverMessage = error.message;
        if (context) {
          try {
            const body = await context.clone().json();
            serverMessage = body?.error || body?.message || serverMessage;
          } catch { /* keep default */ }
        }
        throw new Error(serverMessage);
      }
      if (!data?.success || !data.student_code) throw new Error(data?.error || 'تعذر إنشاء الحساب.');
      setStudentCode(data.student_code);
      setMessage({ text: 'تم إنشاء الحساب بنجاح. الحساب الآن قيد مراجعة الإدارة.', type: 'success' });
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'حدث خطأ أثناء إنشاء الحساب.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const openRecovery = () => {
    const text = `السلام عليكم، أحتاج المساعدة في استعادة حسابي في منصة أ. أحمد.\n\n${loginId.trim() ? `بيانات الدخول: ${loginId.trim()}` : 'لم أتمكن من تسجيل الدخول.'}`;
    window.open(`https://wa.me/201095240716?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <main dir="rtl" className="auth-page min-h-screen bg-[#07090f] px-4 py-5 text-white sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/[0.08] bg-[#0d1119]/95 shadow-2xl shadow-black/40 lg:grid-cols-[.85fr_1.15fr]">
          <section className="relative hidden overflow-hidden border-l border-white/[0.06] bg-gradient-to-br from-amber-500/[0.12] via-transparent to-blue-500/[0.08] p-10 lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-amber-400/10 blur-[90px]" />
            <div className="relative">
              <Link to="/" className="inline-flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-600 text-black shadow-lg shadow-amber-500/20"><FlaskConical className="h-6 w-6" /></span>
                <span><b className="block">منصة أ. أحمد محمد رمضان</b><small className="text-slate-500">منصة الكيمياء التعليمية</small></span>
              </Link>
              <div className="mt-16">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-amber-300/20 bg-amber-300/10 text-amber-300"><GraduationCap className="h-8 w-8" /></div>
                <h1 className="text-4xl font-black leading-tight">تعلم الكيمياء<br />بشكل أوضح وأذكى.</h1>
                <p className="mt-5 max-w-sm text-sm leading-8 text-slate-400">شرح، واجبات، اختبارات، درجات وحضور — كل شيء منظم حسب الصف والمجموعة.</p>
              </div>
            </div>
            <div className="relative space-y-3 text-sm text-slate-400">
              <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-400" /> حسابات وصلاحيات آمنة</div>
              <div className="flex items-center gap-3"><FlaskConical className="h-5 w-5 text-amber-300" /> أولى وثانية وثالثة ثانوي</div>
            </div>
          </section>

          <section className="p-5 sm:p-8 lg:p-10">
            <div className="mb-7 flex items-center justify-between gap-4">
              <Link to="/" className="flex items-center gap-2 text-sm font-bold text-slate-300 lg:hidden"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 font-black text-black">أ</span> منصة أ. أحمد</Link>
              <Link to="/" className="text-xs font-bold text-slate-500 transition hover:text-white">الصفحة الرئيسية</Link>
            </div>

            <div className="mx-auto w-full max-w-xl">
              <div className="mb-7">
                <p className="text-xs font-bold text-amber-300">بوابة المنصة</p>
                <h2 className="mt-2 text-2xl font-black sm:text-3xl">أهلاً بك 👋</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">سجل دخولك أو أنشئ حساب طالب جديد.</p>
              </div>

              <div className="mb-6 grid grid-cols-3 gap-1 rounded-2xl border border-white/[0.06] bg-black/20 p-1">
                {([['login', 'تسجيل الدخول'], ['register', 'حساب جديد'], ['parent', 'ولي الأمر']] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => switchTab(value)} className={`min-h-11 rounded-xl px-2 text-xs font-black transition sm:text-sm ${tab === value ? 'bg-amber-400 text-black shadow-lg shadow-amber-500/10' : 'text-slate-500 hover:bg-white/[0.04] hover:text-white'}`}>{label}</button>
                ))}
              </div>

              {message && <div role="alert" className={`mb-5 rounded-2xl border px-4 py-3 text-center text-sm font-bold leading-6 ${messageClass}`}>{message.text}</div>}

              {studentCode && (
                <div className="mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-center">
                  <p className="text-xs text-slate-400">كود الطالب — احتفظ به لتسجيل الدخول</p>
                  <p className="mt-1 text-2xl font-black tracking-wider text-amber-300">{studentCode}</p>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(studentCode)} className="mt-2 text-xs font-bold text-slate-400 hover:text-white">نسخ الكود</button>
                </div>
              )}

              {tab === 'login' && (
                <form onSubmit={handleLogin} className="space-y-5">
                  <Field label="كود الطالب / الهاتف / البريد الإلكتروني" required>
                    <input value={loginId} onChange={(e) => setLoginId(e.target.value)} autoComplete="username" inputMode="email" placeholder="AMR-000001 أو 01012345678" className="auth-input" />
                  </Field>
                  <Field label="كلمة المرور" required>
                    <div className="relative"><input type={showLoginPassword ? 'text' : 'password'} value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} autoComplete="current-password" placeholder="••••••••" className="auth-input pl-12" />
                      <button type="button" aria-label={showLoginPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'} onClick={() => setShowLoginPassword((v) => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">{showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
                    </div>
                  </Field>
                  <button disabled={loading} className="auth-primary" type="submit">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}{loading ? 'جاري الدخول...' : 'تسجيل الدخول'}</button>
                  <button type="button" onClick={openRecovery} className="mx-auto flex items-center gap-2 text-xs font-bold text-slate-500 transition hover:text-amber-300"><HelpCircle className="h-4 w-4" /> نسيت كلمة المرور؟ تواصل مع الدعم</button>
                </form>
              )}

              {tab === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="الاسم بالكامل" required><input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="مثال: أحمد محمد" className="auth-input" /></Field>
                    <Field label="رقم هاتف الطالب" required><input value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="tel" autoComplete="tel" placeholder="01012345678" className="auth-input" /></Field>
                    <Field label="رقم ولي الأمر" required><input value={parentPhone} onChange={(e) => setParentPhone(e.target.value.replace(/\D/g, '').slice(0, 11))} inputMode="tel" autoComplete="tel" placeholder="01012345678" className="auth-input" /></Field>
                    <Field label="البريد الإلكتروني (اختياري)"><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" placeholder="example@email.com" className="auth-input" /></Field>
                  </div>
                  <Field label="الصف الدراسي" required>
                    <select value={grade} onChange={(e) => setGrade(e.target.value)} disabled={gradesLoading} className="auth-input appearance-none">
                      <option value="">{gradesLoading ? 'جاري تحميل الصفوف...' : 'اختر الصف الدراسي'}</option>
                      {grades.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="كلمة المرور" required><div className="relative"><input type={showRegisterPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="6 أحرف على الأقل" className="auth-input pl-12" /><button type="button" aria-label="إظهار كلمة المرور" onClick={() => setShowRegisterPassword((v) => !v)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">{showRegisterPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button></div></Field>
                    <Field label="تأكيد كلمة المرور" required><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="أعد كتابة كلمة المرور" className="auth-input" /></Field>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-xs leading-6 text-slate-500">بعد التسجيل، يراجع المدير الطلب ويقوم بتفعيل الحساب قبل السماح بالدخول.</div>
                  <button disabled={loading || gradesLoading} className="auth-primary" type="submit">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}{loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب الطالب'}</button>
                </form>
              )}

              {tab === 'parent' && (
                <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 text-center sm:p-8">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300"><MessageCircle className="h-7 w-7" /></div>
                  <h3 className="mt-4 text-lg font-black">متابعة ولي الأمر</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-500">بوابة ولي الأمر مستقلة وسيتم ربطها ببيانات الطالب لاحقًا. للاستفسار أو المساعدة تواصل مع الإدارة.</p>
                  <button type="button" onClick={openRecovery} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-black text-white transition hover:bg-emerald-400"><MessageCircle className="h-4 w-4" /> تواصل مع الإدارة</button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold text-slate-400">{label}{required && <span className="mr-1 text-amber-300">*</span>}</span>{children}</label>;
}
