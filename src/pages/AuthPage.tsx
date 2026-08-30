
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function AuthPage() {
  const [activeTab, setActiveTab] = useState<
    'login' | 'register' | 'parent'
  >('login');

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showPassword, setShowPassword] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  // =========================
  // LOGIN
  // =========================

  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // =========================
  // REGISTER
  // =========================

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regParentPhone, setRegParentPhone] = useState('');
  const [regGrade, setRegGrade] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // =========================
  // UI STATE
  // =========================

  const [generatedCode, setGeneratedCode] = useState<string | null>(null);

  const [msg, setMsg] = useState<{
    text: string;
    type: 'error' | 'success' | 'warning';
  } | null>(null);

  const [loading, setLoading] = useState(false);

  // =========================
  // THEME
  // =========================

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // =========================
  // REGISTER
  // =========================

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    setMsg(null);
    setGeneratedCode(null);

    if (!regName.trim()) {
      setMsg({
        text: 'يرجى إدخال الاسم بالكامل.',
        type: 'error',
      });
      return;
    }

    if (!regPhone.trim()) {
      setMsg({
        text: 'يرجى إدخال رقم موبايل الطالب.',
        type: 'error',
      });
      return;
    }

    if (!regParentPhone.trim()) {
      setMsg({
        text: 'يرجى إدخال رقم موبايل ولي الأمر.',
        type: 'error',
      });
      return;
    }

    if (!regGrade) {
      setMsg({
        text: 'يرجى اختيار الصف الدراسي.',
        type: 'error',
      });
      return;
    }

    if (regPassword.length < 6) {
      setMsg({
        text: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.',
        type: 'error',
      });
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setMsg({
        text: 'تأكيد كلمة المرور غير مطابق.',
        type: 'error',
      });
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke(
        'register-student',
        {
          body: {
            full_name: regName.trim(),
            phone: regPhone.trim(),
            email: regEmail.trim() || null,
            parent_phone: regParentPhone.trim(),
            grade: regGrade,
            password: regPassword,
          },
        }
      );

      console.log('REGISTER DATA:', data);
      console.log('REGISTER ERROR:', error);

      if (error) {
        console.error('Register function error:', error);
        throw new Error(
          error.message || 'حدث خطأ أثناء إنشاء الحساب.'
        );
      }

      if (!data) {
        throw new Error('لم تصل استجابة من الخادم.');
      }

      if (!data.success) {
        throw new Error(
          data.error || 'تعذر إنشاء الحساب.'
        );
      }

      const studentCode = data.student_code;

      if (!studentCode) {
        throw new Error(
          'تم إنشاء الحساب ولكن لم يصل كود الطالب.'
        );
      }

      setGeneratedCode(studentCode);

      setMsg({
        text:
          'تم إنشاء حسابك بنجاح! الحساب الآن قيد المراجعة. 🎉',
        type: 'success',
      });

      localStorage.setItem('studentCode', studentCode);
      localStorage.setItem('studentName', regName.trim());

      setRegPassword('');
      setRegConfirmPassword('');
    } catch (error) {
      console.error('Registration error:', error);

      setMsg({
        text:
          error instanceof Error
            ? error.message
            : 'حدث خطأ أثناء إنشاء الحساب.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // READ EDGE FUNCTION ERROR
  // =========================

  const getEdgeFunctionError = async (
    error: unknown
  ): Promise<string> => {
    if (!(error instanceof Error)) {
      return 'حدث خطأ أثناء الاتصال بالخادم.';
    }

    const supabaseError = error as Error & {
      context?: Response;
    };

    console.error('EDGE ERROR OBJECT:', supabaseError);
    console.error('EDGE ERROR MESSAGE:', supabaseError.message);

    if (supabaseError.context) {
      try {
        const responseText =
          await supabaseError.context.text();

        console.error(
          'EDGE FUNCTION RESPONSE:',
          responseText
        );

        if (responseText) {
          try {
            const parsed = JSON.parse(responseText);

            if (parsed?.error) {
              return parsed.error;
            }

            if (parsed?.message) {
              return parsed.message;
            }
          } catch {
            return responseText;
          }
        }
      } catch (readError) {
        console.error(
          'Could not read Edge Function response:',
          readError
        );
      }
    }

    return supabaseError.message;
  };

  // =========================
  // LOGIN
  // =========================

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;

    setMsg(null);

    const loginIdValue = loginId.trim();
    const password = loginPassword;

    if (!loginIdValue || !password) {
      setMsg({
        text:
          'يرجى إدخال كود الطالب أو رقم الهاتف وكلمة المرور.',
        type: 'error',
      });
      return;
    }

    try {
      setLoading(true);

      console.log('LOGIN REQUEST:', {
        login_id: loginIdValue,
      });

      // ==============================
      // CALL LOGIN EDGE FUNCTION
      // ==============================

      const { data, error } =
        await supabase.functions.invoke(
          'login-student',
          {
            body: {
              login_id: loginIdValue,
              password,
            },
          }
        );

      console.log('LOGIN DATA:', data);
      console.log('LOGIN ERROR:', error);

      // ==============================
      // EDGE FUNCTION ERROR
      // ==============================

      if (error) {
        const realError =
          await getEdgeFunctionError(error);

        throw new Error(realError);
      }

      // ==============================
      // EMPTY RESPONSE
      // ==============================

      if (!data) {
        throw new Error(
          'لم تصل استجابة من الخادم.'
        );
      }

      console.log(
        'LOGIN RESPONSE FROM SERVER:',
        data
      );

      // ==============================
      // SERVER ERROR
      // ==============================

      if (!data.success) {
        throw new Error(
          data.error ||
            'كود الطالب أو كلمة المرور غير صحيحة.'
        );
      }

      // ==============================
      // CHECK TOKENS
      // ==============================

      if (
        !data.access_token ||
        !data.refresh_token
      ) {
        console.error(
          'Missing session tokens:',
          data
        );

        throw new Error(
          'تم تسجيل الدخول ولكن لم يتم إنشاء جلسة صالحة.'
        );
      }

      // ==============================
      // SAVE SUPABASE SESSION
      // ==============================

      const {
        error: sessionError,
      } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionError) {
        console.error(
          'Set session error:',
          sessionError
        );

        throw new Error(
          'تعذر حفظ جلسة تسجيل الدخول.'
        );
      }

      // ==============================
      // LOAD PROFILE
      // ==============================

      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from('users')
        .select(`
          id,
          role,
          full_name,
          phone,
          student_code,
          status,
          avatar_url,
          is_active,
          created_at,
          updated_at
        `)
        .eq('id', data.user.id)
        .maybeSingle();

      if (profileError) {
        console.error(
          'Profile error:',
          profileError
        );

        await supabase.auth.signOut();

        throw new Error(
          'تعذر تحميل بيانات الحساب.'
        );
      }

      if (!profile) {
        await supabase.auth.signOut();

        throw new Error(
          'لا توجد بيانات لهذا الحساب في المنصة.'
        );
      }

      console.log(
        'LOGGED USER PROFILE:',
        profile
      );

      // ==============================
      // ACCOUNT STATUS
      // ==============================

      if (profile.status === 'pending') {
        await supabase.auth.signOut();

        setMsg({
          text:
            'حسابك قيد المراجعة. انتظر تفعيل الحساب من الإدارة.',
          type: 'warning',
        });

        return;
      }

      if (
        profile.status === 'suspended' ||
        profile.status === 'rejected'
      ) {
        await supabase.auth.signOut();

        setMsg({
          text:
            'هذا الحساب غير متاح حاليًا. يرجى مراجعة الإدارة.',
          type: 'error',
        });

        return;
      }

      if (!profile.is_active) {
        await supabase.auth.signOut();

        setMsg({
          text:
            'الحساب غير نشط حاليًا.',
          type: 'error',
        });

        return;
      }

      // ==============================
      // SUCCESS
      // ==============================

      setMsg({
        text:
          profile.role === 'admin'
            ? 'أهلاً بك يا مدير المنصة! يتم فتح لوحة التحكم...'
            : 'أهلاً بك! يتم تحويلك للمنصة...',
        type: 'success',
      });

      // ==============================
      // REDIRECT
      // ==============================

      setTimeout(() => {
        window.location.href = '/';
      }, 500);
    } catch (error) {
      console.error('Login error:', error);

      setMsg({
        text:
          error instanceof Error
            ? error.message
            : 'كود الطالب أو كلمة المرور غير صحيحة.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // PASSWORD RECOVERY
  // =========================

  
const handleRecovery = () => {
  const supportPhone = '201095240716';

  const studentCode = loginId.trim();

  const message = studentCode
    ? `السلام عليكم، أريد المساعدة في استعادة حسابي في منصة أ. أحمد.

كود الطالب: ${studentCode}

أرجو مساعدتي في إعادة تعيين كلمة المرور.`
    : `السلام عليكم، أريد المساعدة في استعادة حسابي في منصة أ. أحمد.

لم أتمكن من الدخول إلى حسابي وأحتاج إلى إعادة تعيين كلمة المرور.

شكرًا لكم.`;

  const whatsappUrl =
    `https://wa.me/${supportPhone}?text=${encodeURIComponent(message)}`;

  window.open(
    whatsappUrl,
    '_blank',
    'noopener,noreferrer'
  );
};

  // =========================
  // UI
  // =========================

  return (
    <div className="auth-shell">

      <div className="ambient-glow glow-1"></div>
      <div className="ambient-glow glow-2"></div>

      {/* INTRO */}

      <div className="auth-intro">

        <div className="brand-mark">
          🧪
        </div>

        <h1>
          أهلاً بك في منصة أ. أحمد
        </h1>

        <p>
          مكان واحد للمحاضرات والواجبات
          والاختبارات ومتابعة مستواك
          خطوة بخطوة.
        </p>

        <div className="auth-benefits">

          <div>
            📚 محتوى مرتب حسب مرحلتك
          </div>

          <div>
            📊 نتائج ومتابعة مستمرة
          </div>

          <div>
            🏆 ترتيب وإنجازات للطلاب
          </div>

          <div>
            🔔 تنبيهات للمواعيد والنتائج
          </div>

        </div>

      </div>

      {/* CARD */}

      <div className="auth-card">

        <button
          className="theme-toggle-btn"
          onClick={toggleTheme}
          type="button"
        >
          {theme === 'dark'
            ? '☀️'
            : '🌙'}
        </button>

        <h2>
          بوابة الدخول الذكية
        </h2>

        <p className="subtitle">
          اختر صفتك وسجل بياناتك
          للوصول للمنصة
        </p>

        {/* MESSAGE */}

        {msg && (
          <div
            style={{
              padding: '0.8rem',
              borderRadius: '10px',
              marginBottom: '1rem',
              textAlign: 'center',
              fontSize: '0.88rem',
              fontWeight: 'bold',

              backgroundColor:
                msg.type === 'error'
                  ? 'rgba(239,68,68,0.15)'
                  : msg.type === 'warning'
                  ? 'rgba(234,179,8,0.15)'
                  : 'rgba(34,197,94,0.15)',

              color:
                msg.type === 'error'
                  ? '#EF4444'
                  : msg.type === 'warning'
                  ? '#CA8A04'
                  : '#22C55E',

              border:
                msg.type === 'error'
                  ? '1px solid rgba(239,68,68,0.3)'
                  : msg.type === 'warning'
                  ? '1px solid rgba(234,179,8,0.3)'
                  : '1px solid rgba(34,197,94,0.3)',
            }}
          >
            {msg.text}
          </div>
        )}

        {/* TABS */}

        <div className="tabs">

          <button
            type="button"
            className={`tab-btn ${
              activeTab === 'login'
                ? 'active'
                : ''
            }`}
            onClick={() => {
              setActiveTab('login');
              setMsg(null);
            }}
          >
            لدي حساب
          </button>

          <button
            type="button"
            className={`tab-btn ${
              activeTab === 'register'
                ? 'active'
                : ''
            }`}
            onClick={() => {
              setActiveTab('register');
              setMsg(null);
            }}
          >
            حساب جديد
          </button>

          <button
            type="button"
            className={`tab-btn ${
              activeTab === 'parent'
                ? 'active'
                : ''
            }`}
            onClick={() => {
              setActiveTab('parent');
              setMsg(null);
            }}
          >
            ولي أمر
          </button>

        </div>

        {/* LOGIN */}

        {activeTab === 'login' && (

          <form onSubmit={handleLogin}>

            <div className="form-group">

              <label>
                كود الطالب أو رقم الهاتف
              </label>

              <input
                type="text"
                className="form-control"
                placeholder="AMR-7079 أو 01xxxxxxxxx"
                required
                dir="ltr"
                style={{
                  textAlign: 'left',
                }}
                value={loginId}
                onChange={(e) =>
                  setLoginId(e.target.value)
                }
              />

              <div className="hint-text">
                يمكنك تسجيل الدخول باستخدام
                كود الطالب أو رقم الهاتف.
              </div>

            </div>

            <div className="form-group">

              <label>
                كلمة المرور
              </label>

              <div className="password-wrap">

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  className="form-control"
                  placeholder="••••••••"
                  required
                  dir="ltr"
                  style={{
                    textAlign: 'left',
                  }}
                  value={loginPassword}
                  onChange={(e) =>
                    setLoginPassword(
                      e.target.value
                    )
                  }
                />

                <button
                  type="button"
                  className="pass-toggle"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                >
                  {showPassword
                    ? '🙈'
                    : '👁️'}
                </button>

              </div>

            </div>

            <button
              type="submit"
              className="btn"
              disabled={loading}
            >
              {loading
                ? 'جاري تسجيل الدخول...'
                : 'تسجيل الدخول'}
            </button>

            <button
              type="button"
              className="forgot-link-btn"
              onClick={() =>
                setShowRecoveryModal(true)
              }
            >
              نسيت كلمة المرور؟
            </button>

          </form>

        )}

        {/* REGISTER */}

        {activeTab === 'register' && (

          <form onSubmit={handleRegister}>

            <div className="form-group">

              <label>
                الاسم الرباعي
              </label>

              <input
                type="text"
                className="form-control"
                placeholder="أدخل اسمك بالكامل"
                required
                value={regName}
                onChange={(e) =>
                  setRegName(e.target.value)
                }
              />

            </div>

            <div className="form-group">

              <label>
                رقم موبايل الطالب
              </label>

              <input
                type="tel"
                className="form-control"
                placeholder="01xxxxxxxxx"
                required
                dir="ltr"
                style={{
                  textAlign: 'left',
                }}
                value={regPhone}
                onChange={(e) =>
                  setRegPhone(e.target.value)
                }
              />

            </div>

            <div className="form-group">

              <label>
                البريد الإلكتروني
                <span
                  style={{
                    fontWeight: 'normal',
                    opacity: 0.65,
                    marginRight: '6px',
                  }}
                >
                  (اختياري)
                </span>
              </label>

              <input
                type="email"
                className="form-control"
                placeholder="name@example.com"
                dir="ltr"
                style={{
                  textAlign: 'left',
                }}
                value={regEmail}
                onChange={(e) =>
                  setRegEmail(e.target.value)
                }
              />

              <div className="hint-text">
                يمكنك ترك هذا الحقل فارغًا.
              </div>

            </div>

            <div className="form-group">

              <label>
                رقم موبايل ولي الأمر
              </label>

              <input
                type="tel"
                className="form-control"
                placeholder="01xxxxxxxxx"
                required
                dir="ltr"
                style={{
                  textAlign: 'left',
                }}
                value={regParentPhone}
                onChange={(e) =>
                  setRegParentPhone(
                    e.target.value
                  )
                }
              />

            </div>

            <div className="form-group">

              <label>
                الصف الدراسي
              </label>

              <select
                className="form-control"
                required
                value={regGrade}
                onChange={(e) =>
                  setRegGrade(e.target.value)
                }
              >

                <option
                  value=""
                  disabled
                >
                  اختر الصف الدراسي
                </option>

                <option value="ecc27c0c-60e2-4124-ba0e-8fcd3d74149b">
                  الصف الأول الثانوي
                </option>

                <option value="197d63d4-01fc-4962-a73a-825283ac1201">
                  الصف الثاني الثانوي
                </option>

                <option value="dffa2ed0-4048-447d-b11c-a306cf3746d8">
                  الصف الثالث الثانوي
                </option>

              </select>

            </div>

            <div className="form-group">

              <label>
                كلمة المرور
              </label>

              <div className="password-wrap">

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  className="form-control"
                  placeholder="6 أحرف على الأقل"
                  required
                  minLength={6}
                  dir="ltr"
                  style={{
                    textAlign: 'left',
                  }}
                  value={regPassword}
                  onChange={(e) =>
                    setRegPassword(
                      e.target.value
                    )
                  }
                />

                <button
                  type="button"
                  className="pass-toggle"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                >
                  {showPassword
                    ? '🙈'
                    : '👁️'}
                </button>

              </div>

            </div>

            <div className="form-group">

              <label>
                تأكيد كلمة المرور
              </label>

              <input
                type="password"
                className="form-control"
                placeholder="أعد كتابة كلمة المرور"
                required
                minLength={6}
                dir="ltr"
                style={{
                  textAlign: 'left',
                }}
                value={regConfirmPassword}
                onChange={(e) =>
                  setRegConfirmPassword(
                    e.target.value
                  )
                }
              />

            </div>

            <button
              type="submit"
              className="btn"
              disabled={loading}
            >
              {loading
                ? 'جاري إنشاء الحساب...'
                : 'إنشاء حساب جديد'}
            </button>

            {generatedCode && (

              <div className="code-display">

                <div
                  style={{
                    fontSize: '0.8rem',
                    color:
                      'var(--clr-text-muted)',
                  }}
                >
                  🎉 كود الطالب الخاص بك:
                </div>

                <div className="code">
                  {generatedCode}
                </div>

                <div
                  className="hint-text"
                  style={{
                    marginBottom: '0.6rem',
                  }}
                >
                  احتفظ بهذا الكود.
                  ستستخدمه لتسجيل الدخول
                  لاحقًا.
                </div>

                <button
                  type="button"
                  className="copy-btn"
                  onClick={() =>
                    navigator.clipboard.writeText(
                      generatedCode
                    )
                  }
                >
                  📋 نسخ الكود
                </button>

              </div>

            )}

          </form>

        )}

        {/* PARENT */}

        {activeTab === 'parent' && (

          <form
            onSubmit={(e) => {
              e.preventDefault();

              setMsg({
                text:
                  'قسم ولي الأمر سيتم تفعيله بعد الانتهاء من نظام الطلاب.',
                type: 'warning',
              });
            }}
          >

            <div className="form-group">

              <label>
                رقم موبايل ولي الأمر
              </label>

              <input
                type="tel"
                className="form-control"
                placeholder="01xxxxxxxxx"
                required
                dir="ltr"
                style={{
                  textAlign: 'left',
                }}
              />

            </div>

            <div className="form-group">

              <label>
                رقم هاتف الطالب
              </label>

              <input
                type="tel"
                className="form-control"
                placeholder="01xxxxxxxxx"
                required
                dir="ltr"
                style={{
                  textAlign: 'left',
                }}
              />

            </div>

            <button
              type="submit"
              className="btn"
            >
              عرض تقرير المستوى الشامل
            </button>

          </form>

        )}

      </div>

{/* RECOVERY MODAL */}

{showRecoveryModal && (

  <div className="recovery-modal">

    <div className="recovery-card">

      <button
        className="recovery-close"
        onClick={() =>
          setShowRecoveryModal(false)
        }
        type="button"
      >
        ×
      </button>

      <h3
        style={{
          marginBottom: '0.5rem',
        }}
      >
        🔐 استعادة الوصول
      </h3>

      <p
        style={{
          fontSize: '0.85rem',
          color: 'var(--clr-text-muted)',
          marginBottom: '1rem',
          lineHeight: 1.8,
        }}
      >
        لا تحتاج إلى البريد الإلكتروني لاستعادة
        حسابك حاليًا.
        <br />
        تواصل مع فريق الدعم عبر واتساب،
        وسيتم التحقق من بياناتك ومساعدتك
        في إعادة تعيين كلمة المرور.
      </p>

      <div
        style={{
          background:
            'rgba(34,197,94,0.10)',
          border:
            '1px solid rgba(34,197,94,0.25)',
          borderRadius: '10px',
          padding: '0.8rem',
          marginBottom: '1rem',
          textAlign: 'center',
          fontSize: '0.85rem',
        }}
      >
        💬 دعم منصة أ. أحمد
        <br />
        <strong dir="ltr">
          01095240716
        </strong>
      </div>

      <button
        className="btn"
        type="button"
        onClick={handleRecovery}
      >
        💬 التواصل مع الدعم عبر واتساب
      </button>

    </div>

  </div>

)}


    </div>
  );
}

export default AuthPage;