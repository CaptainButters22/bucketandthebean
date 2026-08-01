// Supabase Edge Function: closeout-report
// Accepts closeout submissions, verifies password server-side, forwards to Formspree.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsOrigins = new Set([
  "https://bucketandthebean.com",
  "https://www.bucketandthebean.com",
]);

function jsonResponse(body: unknown, status = 200, corsOrigin?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(corsOrigin
        ? {
            "Access-Control-Allow-Origin": corsOrigin,
            "Vary": "Origin",
          }
        : {}),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") ?? "";
  const corsOrigin = corsOrigins.has(origin) ? origin : undefined;

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        ...(corsOrigin
          ? {
              "Access-Control-Allow-Origin": corsOrigin,
              "Vary": "Origin",
            }
          : {}),
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, corsOrigin);
  }

  // Never log sensitive fields.
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400, corsOrigin);
  }

  const password: unknown = payload?.password;
  const report_type: unknown = payload?.report_type;
  const barista_name: unknown = payload?.barista_name;
  const what_wasnt_done: unknown = payload?.what_wasnt_done;

  if (
    typeof password !== "string" ||
    password.length === 0 ||
    (typeof report_type !== "string" ||
      !["opening", "closing"].includes(report_type)) ||
    typeof barista_name !== "string" ||
    typeof what_wasnt_done !== "string"
  ) {
    return jsonResponse({ error: "Missing or invalid fields" }, 400, corsOrigin);
  }

  // Closing-only optional fields.
  const inventory: unknown = payload?.inventory;
  const cash_drawer_difference: unknown = payload?.cash_drawer_difference;
  const notes: unknown = payload?.notes;

  if (report_type === "closing") {
    if (
      typeof inventory !== "string" ||
      typeof cash_drawer_difference !== "string" ||
      typeof notes !== "string"
    ) {
      return jsonResponse({ error: "Missing or invalid closing fields" }, 400, corsOrigin);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Required Supabase credentials are unavailable.");
    return jsonResponse({ error: "Password verification is unavailable" }, 500, corsOrigin);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Verify password using the SECURITY DEFINER function.
  let ok = false;
  try {
    const { data, error } = await supabaseAdmin.rpc("verify_closeout_password", {
      p_password: password,
    });

    if (error) {
      ok = false;
    } else {
      ok = data === true;
    }
  } catch {
    ok = false;
  }

  if (!ok) {
    // Always use 401 for verification failure.
    return jsonResponse({ error: "Unauthorized" }, 401, corsOrigin);
  }

  // Forward to Formspree endpoint.
  const formspreeUrl =
    report_type === "opening"
      ? "https://formspree.io/f/xzdnopeq"
      : "https://formspree.io/f/xykrogev";

  const form = new URLSearchParams();
  form.set("report_type", report_type);
  form.set("barista_name", barista_name);
  form.set("what_wasnt_done", what_wasnt_done);

  if (report_type === "closing") {
    form.set("inventory", inventory);
    form.set("cash_drawer_difference", cash_drawer_difference);
    form.set("notes", notes);
  }

  const ffRes = await fetch(formspreeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  // Do not leak sensitive fields.
  if (!ffRes.ok) {
    return jsonResponse({ error: "Form submission failed" }, 502, corsOrigin);
  }

  return jsonResponse({ ok: true }, 200, corsOrigin);
});
