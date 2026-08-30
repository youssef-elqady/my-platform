import { withSupabase } from "npm:@supabase/server@^1";

function jsonResponse(
  data: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function normalizeText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

interface UserRow {
  id: string;
  role: string;
  status: string | null;
  is_active: boolean;
  student_code?: string | null;
  phone?: string | null;
}

export default {
  fetch: withSupabase(
    { auth: "publishable" },
    async (req, ctx) => {
      try {
        // =========================
        // METHOD
        // =========================

        if (req.method !== "POST") {
          return jsonResponse(
            {
              success: false,
              error: "Method not allowed",
            },
            405
          );
        }

        // =========================
        // BODY
        // =========================

        const body = await req.json();

        const loginId = normalizeText(
          body?.login_id
        );

        const password =
          typeof body?.password === "string"
            ? body.password
            : "";

        if (!loginId) {
          return jsonResponse(
            {
              success: false,
              error:
                "يرجى إدخال كود الطالب أو رقم الهاتف أو البريد الإلكتروني.",
            },
            400
          );
        }

        if (!password) {
          return jsonResponse(
            {
              success: false,
              error:
                "يرجى إدخال كلمة المرور.",
            },
            400
          );
        }

        // =========================
        // FIND USER
        // =========================

        let user: UserRow | null = null;

        // -------------------------
        // 1. STUDENT CODE
        // -------------------------

        if (
          loginId
            .toUpperCase()
            .startsWith("AMR-")
        ) {
          const {
            data,
            error,
          } = await ctx.supabaseAdmin
            .from("users")
            .select(
              "id, role, status, is_active, student_code, phone"
            )
            .eq(
              "student_code",
              loginId.toUpperCase()
            )
            .maybeSingle();

          if (error) {
            console.error(
              "Student code lookup error:",
              error
            );

            return jsonResponse(
              {
                success: false,
                error:
                  "حدث خطأ أثناء البحث عن كود الطالب.",
                details: error.message,
              },
              500
            );
          }

          user = data as UserRow | null;
        }

        // -------------------------
        // 2. PHONE
        // -------------------------

        else if (
          /^01\d{9}$/.test(loginId)
        ) {
          const {
            data,
            error,
          } = await ctx.supabaseAdmin
            .from("users")
            .select(
              "id, role, status, is_active, student_code, phone"
            )
            .eq("phone", loginId)
            .maybeSingle();

          if (error) {
            console.error(
              "Phone lookup error:",
              error
            );

            return jsonResponse(
              {
                success: false,
                error:
                  "حدث خطأ أثناء البحث برقم الهاتف.",
                details: error.message,
              },
              500
            );
          }

          user = data as UserRow | null;
        }

        // -------------------------
        // 3. EMAIL
        // -------------------------

        else if (
          loginId.includes("@")
        ) {
          const {
            data,
            error,
          } = await ctx.supabaseAdmin.auth.admin.listUsers();

          if (error) {
            console.error(
              "Auth users lookup error:",
              error
            );

            return jsonResponse(
              {
                success: false,
                error:
                  "حدث خطأ أثناء البحث عن البريد الإلكتروني.",
                details: error.message,
              },
              500
            );
          }

          const authUser =
            data.users.find(
              (u) =>
                u.email?.toLowerCase() ===
                loginId.toLowerCase()
            );

          if (authUser) {
            const {
              data: profile,
              error: profileError,
            } = await ctx.supabaseAdmin
              .from("users")
              .select(
                "id, role, status, is_active, student_code, phone"
              )
              .eq("id", authUser.id)
              .maybeSingle();

            if (profileError) {
              console.error(
                "Profile lookup error:",
                profileError
              );

              return jsonResponse(
                {
                  success: false,
                  error:
                    "تعذر تحميل بيانات الحساب.",
                  details:
                    profileError.message,
                },
                500
              );
            }

            user =
              profile as UserRow | null;
          }
        }

        // =========================
        // USER NOT FOUND
        // =========================

        if (!user) {
          return jsonResponse(
            {
              success: false,
              error:
                "بيانات تسجيل الدخول غير صحيحة.",
            },
            401
          );
        }

        // =========================
        // ACCOUNT STATUS
        // =========================

        if (
          user.status === "pending"
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "حسابك قيد المراجعة. انتظر تفعيل الحساب من الإدارة.",
            },
            403
          );
        }

        if (
          user.status === "suspended" ||
          user.status === "rejected"
        ) {
          return jsonResponse(
            {
              success: false,
              error:
                "هذا الحساب غير متاح حاليًا. يرجى مراجعة الإدارة.",
            },
            403
          );
        }

        if (!user.is_active) {
          return jsonResponse(
            {
              success: false,
              error:
                "الحساب غير نشط حاليًا.",
            },
            403
          );
        }

        // =========================
        // GET AUTH USER
        // =========================

        const {
          data: authUserData,
          error: authUserError,
        } =
          await ctx.supabaseAdmin.auth.admin.getUserById(
            user.id
          );

        if (
          authUserError ||
          !authUserData?.user
        ) {
          console.error(
            "Auth user lookup error:",
            authUserError
          );

          return jsonResponse(
            {
              success: false,
              error:
                "تعذر العثور على حساب الدخول.",
              details:
                authUserError?.message ??
                "Auth user not found",
            },
            500
          );
        }

        const email =
          authUserData.user.email;

        if (!email) {
          return jsonResponse(
            {
              success: false,
              error:
                "حساب الدخول لا يحتوي على بريد إلكتروني.",
            },
            500
          );
        }

        // =========================
        // SIGN IN
        // =========================

        const {
          data: loginData,
          error: loginError,
        } =
          await ctx.supabase.auth.signInWithPassword(
            {
              email,
              password,
            }
          );

        if (
          loginError ||
          !loginData.session ||
          !loginData.user
        ) {
          console.error(
            "Supabase signIn error:",
            loginError
          );

          return jsonResponse(
            {
              success: false,
              error:
                "كلمة المرور غير صحيحة.",
              details:
                loginError?.message ??
                "No valid session returned",
            },
            401
          );
        }

        // =========================
        // SUCCESS
        // =========================

        return jsonResponse(
          {
            success: true,

            access_token:
              loginData.session
                .access_token,

            refresh_token:
              loginData.session
                .refresh_token,

            user: loginData.user,

            message:
              "تم تسجيل الدخول بنجاح.",
          },
          200
        );
      } catch (error) {
        console.error(
          "LOGIN FUNCTION CRASH:",
          error
        );

        return jsonResponse(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "حدث خطأ غير متوقع داخل خادم تسجيل الدخول.",
          },
          500
        );
      }
    }
  ),
};