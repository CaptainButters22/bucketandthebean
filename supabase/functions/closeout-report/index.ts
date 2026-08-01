// Supabase Edge Function: closeout-report
// Accepts report submissions, checks the shared anti-spam passcode, and forwards to Formspree.

const REPORT_PASSCODE = "BucketIsCool";

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

  if (password !== REPORT_PASSCODE) {
    return jsonResponse({ error: "Unauthorized" }, 401, corsOrigin);
  }

  // Optional report fields.
  const inventory: unknown = payload?.inventory;
  const cash_drawer_difference: unknown = payload?.cash_drawer_difference;
  const notes: unknown = payload?.notes;

  if (
    typeof notes !== "string" ||
    (report_type === "closing" &&
      (typeof inventory !== "string" || typeof cash_drawer_difference !== "string"))
  ) {
    return jsonResponse({ error: "Missing or invalid report fields" }, 400, corsOrigin);
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
  }
  form.set("notes", notes);

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
