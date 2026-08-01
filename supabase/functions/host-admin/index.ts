import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://bucketandthebean.com',
  'https://www.bucketandthebean.com'
]);

const openingTasks = [
  ['Set up outdoor chairs', 'always'],
  ['Clock in and count cash in drawer', 'always'],
  ['Turn on kettles (200 F)', 'always'],
  ['Prep steam wands, portafilter, filters', 'always'],
  ['Lights, open curtains, OPEN sign', 'always'],
  ['Turn on music and screens', 'always'],
  ['Check thermostat', 'always'],
  ['Set out pastries', 'always'],
  ['Bring out syrups from fridge', 'always'],
  ['Put away clean and dry dishes', 'always'],
  ['Restock cups and lids', 'always'],
  ['Restock sugar, Splenda, stir sticks', 'always'],
  ['Restock coffee, tea, chai', 'always'],
  ['Restock TP and paper towels', 'always'],
  ['Sweep, vacuum, and wipe counters', 'always'],
  ['Check mailbox', 'always'],
  ['Drain cold brew', 'always'],
  ['Water plant (about 12oz water)', 'monday'],
  ['Check thermostat before closing', 'always']
];

const closingTasks = [
  ['Replace trash bags', 'always'],
  ['Wash dishes and drain sink', 'always'],
  ['Prep cold brew', 'always'],
  ['Fill kettles', 'always'],
  ['Tighten blue chair legs', 'every_other_wednesday'],
  ['Throw away receipts', 'always'],
  ['Split tips', 'always'],
  ['Take out trash', 'always'],
  ['Pastries in containers', 'always'],
  ['Close syrup bottles and refrigerate', 'always'],
  ['Portafilters in Cafiza (10g in Instapot bowl)', 'always'],
  ['Steam wand in Rinza (30mL in pitcher)', 'always'],
  ['Soak filters in Cafiza', 'every_other_day'],
  ['Back flush espresso and clean grinders', 'every_other_wednesday'],
  ['Close out cash drawer', 'always'],
  ['Clock out in POS', 'always'],
  ['Turn off screens and speaker', 'always'],
  ['Bring chairs inside', 'always'],
  ['Inventory milk, tea, coffee, pastries', 'always']
];

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://bucketandthebean.com',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' }
  });
}

function validMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function validSchedule(value: unknown): value is string {
  return ['always', 'monday', 'every_other_day', 'every_other_wednesday'].includes(String(value));
}

function validReportType(value: unknown): value is 'opening' | 'closing' {
  return value === 'opening' || value === 'closing';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);

  const body = await request.json().catch(() => null);
  if (!body || typeof body.password !== 'string' || typeof body.action !== 'string') {
    return json(request, { error: 'Invalid request' }, 400);
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceRoleKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is unavailable.');
    return json(request, { error: 'Password verification is unavailable.' }, 500);
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey);
  const { data: authorized, error: authError } = await supabase.rpc('verify_closeout_password', {
    p_password: body.password
  });

  if (authError) {
    console.error('Password verification failed.', authError);
    return json(request, { error: 'Password verification is unavailable.' }, 500);
  }
  if (!authorized) return json(request, { error: 'Unauthorized' }, 401);

  async function listTasks(reportType: 'opening' | 'closing') {
    const { data: existing, error } = await supabase
      .from('closeout_tasks')
      .select('id,label,schedule_type,sort_order')
      .eq('report_type', reportType)
      .order('sort_order');
    if (error) throw error;
    if (existing && existing.length > 0) return existing;

    const defaults = reportType === 'opening' ? openingTasks : closingTasks;
    const { error: seedError } = await supabase.from('closeout_tasks').insert(
      defaults.map(([label, schedule_type], index) => ({
        id: crypto.randomUUID(),
        report_type: reportType,
        label,
        schedule_type,
        sort_order: index + 1,
        is_visible: true,
        is_custom: false
      }))
    );
    if (seedError) throw seedError;
    const { data: seeded, error: seededError } = await supabase
      .from('closeout_tasks')
      .select('id,label,schedule_type,sort_order')
      .eq('report_type', reportType)
      .order('sort_order');
    if (seededError) throw seededError;
    return seeded;
  }

  async function taskGroups() {
    const [opening, closing] = await Promise.all([listTasks('opening'), listTasks('closing')]);
    return { opening, closing };
  }

  try {
    if (body.action === 'load') {
      if (!validMonth(body.month)) return json(request, { error: 'Invalid month' }, 400);
      const month = `${body.month}-01`;
      const [{ data: artist, error: artistError }, tasks] = await Promise.all([
        supabase.from('artist_highlights').select('artist_name,contact_info').eq('month', month).maybeSingle(),
        taskGroups()
      ]);
      if (artistError) throw artistError;
      return json(request, { artist, tasks });
    }

    if (body.action === 'save_artist_highlight') {
      if (!validMonth(body.month) || typeof body.artist_name !== 'string' || !body.artist_name.trim() || typeof body.contact_info !== 'string' || !body.contact_info.trim()) {
        return json(request, { error: 'Artist name, contact information, and month are required.' }, 400);
      }
      const { error } = await supabase.from('artist_highlights').upsert({
        month: `${body.month}-01`,
        artist_name: body.artist_name.trim(),
        contact_info: body.contact_info.trim(),
        is_published: true
      }, { onConflict: 'month' });
      if (error) throw error;
      return json(request, { ok: true });
    }

    if (body.action === 'add_closing_task') {
      if (typeof body.label !== 'string' || !body.label.trim() || !validSchedule(body.schedule_type)) {
        return json(request, { error: 'A task label and valid schedule are required.' }, 400);
      }
      const tasks = await listTasks('closing');
      const maxOrder = tasks.reduce((max, task) => Math.max(max, task.sort_order), 0);
      const { error } = await supabase.from('closeout_tasks').insert({
        id: crypto.randomUUID(),
        report_type: 'closing',
        label: body.label.trim(),
        schedule_type: body.schedule_type,
        sort_order: maxOrder + 1,
        is_visible: true,
        is_custom: true
      });
      if (error) throw error;
      return json(request, { tasks: await listTasks('closing') });
    }

    if (body.action === 'add_task') {
      if (!validReportType(body.report_type) || typeof body.label !== 'string' || !body.label.trim() || !validSchedule(body.schedule_type)) {
        return json(request, { error: 'A task label and valid schedule are required.' }, 400);
      }
      const tasks = await listTasks(body.report_type);
      const maxOrder = tasks.reduce((max, task) => Math.max(max, task.sort_order), 0);
      const { error } = await supabase.from('closeout_tasks').insert({
        id: crypto.randomUUID(),
        report_type: body.report_type,
        label: body.label.trim(),
        schedule_type: body.schedule_type,
        sort_order: maxOrder + 1,
        is_visible: true,
        is_custom: true
      });
      if (error) throw error;
      return json(request, { tasks: await taskGroups() });
    }

    if (body.action === 'remove_closing_task') {
      if (typeof body.task_id !== 'string') return json(request, { error: 'Invalid task' }, 400);
      const { error } = await supabase
        .from('closeout_tasks')
        .delete()
        .eq('id', body.task_id)
        .eq('report_type', 'closing');
      if (error) throw error;
      return json(request, { tasks: await listTasks('closing') });
    }

    if (body.action === 'remove_task') {
      if (!validReportType(body.report_type) || typeof body.task_id !== 'string') return json(request, { error: 'Invalid task' }, 400);
      const { error } = await supabase
        .from('closeout_tasks')
        .delete()
        .eq('id', body.task_id)
        .eq('report_type', body.report_type);
      if (error) throw error;
      return json(request, { tasks: await taskGroups() });
    }

    return json(request, { error: 'Unknown action' }, 400);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error && typeof error.message === 'string'
        ? error.message
        : 'Unable to complete the request.';
    return json(request, { error: message }, 500);
  }
});
