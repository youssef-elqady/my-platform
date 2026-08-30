import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(
  data: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function normalizeText(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizePhone(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, "");
}

function generateStudentCode(): string {
  const number = Math.floor(
    1000 + Math.random() * 9000,
  );

  return `AMR-${number}`;
}

Deno.serve(async (req: Request) => {
  // =========================
  // CORS
  // =========================

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // =========================
  // METHOD
  // =========================

  if (req.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  // =========================
  // SUPABASE CLIENT
  // =========================

  const supabaseUrl =
    Deno.env.get("SUPABASE_URL");

  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Missing Supabase environment variables",
    );

    return jsonResponse(
      {
        success: false,
        error:
          "إعدادات Supabase غير مكتملة على الخادم.",
      },
      500,
    );
  }

  const supabaseAdmin = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  let createdAuthUserId: string | null = null;

  try {
    // =========================
    // READ BODY
    // =========================

    const body = await req.json();

    const fullName = normalizeText(
      body.full_name,
    );

    const phone = normalizePhone(
      body.phone,
    );

    const parentPhone = normalizePhone(
      body.parent_phone,
    );

    const email = normalizeText(
      body.email,
    ).toLowerCase();

    const gradeId = normalizeText(
      body.grade,
    );

    const password =
      typeof body.password === "string"
        ? body.password
        : "";

    // =========================
    // VALIDATION
    // =========================

    if (!fullName) {
      return jsonResponse(
        {
          success: false,
          error: "يرجى إدخال اسم الطالب.",
        },
        400,
      );
    }

    if (!phone) {
      return jsonResponse(
        {
          success: false,
          error:
            "يرجى إدخال رقم موبايل الطالب.",
        },
        400,
      );
    }

    if (!parentPhone) {
      return jsonResponse(
        {
          success: false,
          error:
            "يرجى إدخال رقم موبايل ولي الأمر.",
        },
        400,
      );
    }

    if (!gradeId) {
      return jsonResponse(
        {
          success: false,
          error:
            "يرجى اختيار الصف الدراسي.",
        },
        400,
      );
    }

    if (password.length < 6) {
      return jsonResponse(
        {
          success: false,
          error:
            "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
        },
        400,
      );
    }

    // =========================
    // CHECK GRADE
    // =========================

    const {
      data: grade,
      error: gradeError,
    } = await supabaseAdmin
      .from("grades")
      .select("id, name, is_active")
      .eq("id", gradeId)
      .eq("is_active", true)
      .maybeSingle();

    if (gradeError) {
      console.error(
        "Grade lookup error:",
        gradeError,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "حدث خطأ أثناء التحقق من الصف الدراسي.",
        },
        500,
      );
    }

    if (!grade) {
      return jsonResponse(
        {
          success: false,
          error:
            "الصف الدراسي غير موجود أو غير متاح حاليًا.",
        },
        400,
      );
    }

    // =========================
    // CHECK PHONE
    // =========================

    const {
      data: existingPhone,
      error: phoneError,
    } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    if (phoneError) {
      console.error(
        "Phone lookup error:",
        phoneError,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "حدث خطأ أثناء التحقق من رقم الهاتف.",
        },
        500,
      );
    }

    if (existingPhone) {
      return jsonResponse(
        {
          success: false,
          error:
            "رقم الهاتف مسجل بالفعل. حاول تسجيل الدخول.",
        },
        409,
      );
    }

    // =========================
    // FIND GROUP
    // =========================

    const {
      data: group,
      error: groupError,
    } = await supabaseAdmin
      .from("groups")
      .select(
        "id, name, grade_id, is_active",
      )
      .eq("grade_id", gradeId)
      .eq("is_active", true)
      .order("created_at", {
        ascending: true,
      })
      .limit(1)
      .maybeSingle();

    if (groupError) {
      console.error(
        "Group lookup error:",
        groupError,
      );

      return jsonResponse(
        {
          success: false,
          error:
            "حدث خطأ أثناء البحث عن مجموعة الصف.",
        },
        500,
      );
    }

    if (!group) {
      return jsonResponse(
        {
          success: false,
          error:
            "لا توجد مجموعة متاحة لهذا الصف حاليًا. راجع الإدارة.",
        },
        400,
      );
    }

    // =========================
    // GENERATE UNIQUE STUDENT CODE
    // =========================

    let studentCode = "";

    for (
      let attempt = 0;
      attempt < 20;
      attempt++
    ) {
      const candidate =
        generateStudentCode();

      const {
        data: existingCode,
        error: codeError,
      } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq(
          "student_code",
          candidate,
        )
        .maybeSingle();

      if (codeError) {
        console.error(
          "Student code lookup error:",
          codeError,
        );

        return jsonResponse(
          {
            success: false,
            error:
              "حدث خطأ أثناء إنشاء كود الطالب.",
          },
          500,
        );
      }

      if (!existingCode) {
        studentCode = candidate;
        break;
      }
    }

    if (!studentCode) {
      return jsonResponse(
        {
          success: false,
          error:
            "تعذر إنشاء كود طالب فريد. حاول مرة أخرى.",
        },
        500,
      );
    }

    // =========================
    // CREATE AUTH USER
    // =========================

    const internalEmail =
      `student-${crypto.randomUUID()}@students.local`;

    const {
      data: authData,
      error: authError,
    } =
      await supabaseAdmin.auth.admin.createUser(
        {
          email: internalEmail,
          password,
          email_confirm: true,

          user_metadata: {
            full_name: fullName,
            phone,
            student_code: studentCode,
          },
        },
      );

    if (
      authError ||
      !authData?.user
    ) {
      console.error(
        "Auth creation error:",
        authError,
      );

      return jsonResponse(
        {
          success: false,
          error:
            authError?.message ||
            "تعذر إنشاء حساب الدخول.",
        },
        400,
      );
    }

    createdAuthUserId =
      authData.user.id;

    // =========================
    // CREATE / UPDATE USER PROFILE
    // =========================
    //
    // الـ Trigger ممكن يكون أنشأ users
    // بالفعل بعد إنشاء Auth user.
    //
    // لذلك نستخدم upsert بدل insert.
    // =========================

    const {
      error: profileError,
    } = await supabaseAdmin
      .from("users")
      .upsert(
        {
          id: createdAuthUserId,
          role: "student",
          full_name: fullName,
          phone,
          student_code: studentCode,
          status: "pending",
          is_active: true,
        },
        {
          onConflict: "id",
        },
      );

    if (profileError) {
      console.error(
        "Profile creation error:",
        profileError,
      );

      await supabaseAdmin.auth.admin.deleteUser(
        createdAuthUserId,
      );

      createdAuthUserId = null;

      return jsonResponse(
        {
          success: false,
          error:
            "تم إنشاء حساب الدخول لكن حدثت مشكلة أثناء حفظ بيانات الطالب.",
        },
        500,
      );
    }

    // =========================
    // CREATE STUDENT RECORD
    // =========================

    const {
      data: existingStudent,
      error: existingStudentError,
    } = await supabaseAdmin
      .from("students")
      .select("user_id")
      .eq(
        "user_id",
        createdAuthUserId,
      )
      .maybeSingle();

    if (existingStudentError) {
      console.error(
        "Student lookup error:",
        existingStudentError,
      );

      await supabaseAdmin
        .from("users")
        .delete()
        .eq(
          "id",
          createdAuthUserId,
        );

      await supabaseAdmin.auth.admin.deleteUser(
        createdAuthUserId,
      );

      createdAuthUserId = null;

      return jsonResponse(
        {
          success: false,
          error:
            "حدث خطأ أثناء التحقق من بيانات الطالب.",
        },
        500,
      );
    }

if (!existingStudent) {
  const {
    error: studentError,
  } = await supabaseAdmin
    .from("students")
    .insert({
      user_id:
        createdAuthUserId,

      group_id:
        group.id,

      parent_phone:
        parentPhone,

      joined_at:
        new Date().toISOString(),

      approved_at: null,
      approved_by: null,
      suspended_at: null,
      suspended_by: null,
    });


      if (studentError) {
        console.error(
          "Student creation error:",
          studentError,
        );

        await supabaseAdmin
          .from("users")
          .delete()
          .eq(
            "id",
            createdAuthUserId,
          );

        await supabaseAdmin.auth.admin.deleteUser(
          createdAuthUserId,
        );

        createdAuthUserId = null;

        return jsonResponse(
          {
            success: false,
            error:
              "تم إنشاء الحساب لكن حدثت مشكلة أثناء ربط الطالب بالمجموعة.",
          },
          500,
        );
      }
    }

    // =========================
    // SUCCESS
    // =========================

    return jsonResponse(
      {
        success: true,

        student_code:
          studentCode,

        user_id:
          createdAuthUserId,

        student: {
          full_name:
            fullName,

          phone,

          email:
            email || null,

          parent_phone:
            parentPhone,

          grade_id:
            grade.id,

          grade_name:
            grade.name,

          group_id:
            group.id,

          group_name:
            group.name,
        },

        message:
          "تم إنشاء الحساب بنجاح، والحساب الآن قيد المراجعة.",
      },
      200,
    );
  } catch (error) {
    console.error(
      "Register student error:",
      error,
    );

    // =========================
    // CLEANUP
    // =========================

    if (createdAuthUserId) {
      try {
        await supabaseAdmin
          .from("users")
          .delete()
          .eq(
            "id",
            createdAuthUserId,
          );

        await supabaseAdmin.auth.admin.deleteUser(
          createdAuthUserId,
        );
      } catch (cleanupError) {
        console.error(
          "Cleanup error:",
          cleanupError,
        );
      }
    }

    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "حدث خطأ غير متوقع أثناء إنشاء الحساب.",
      },
      500,
    );
  }
});