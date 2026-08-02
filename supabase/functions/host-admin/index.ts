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

const inventoryDefaults = [
  ['Whole milk', 'standard'], ['Lactaid 1%', 'standard'], ['Oat', 'standard'], ['Almond', 'standard'],
  ['Cold brew beans', 'standard'], ['Teas', 'standard'], ['Espresso', 'standard'], ['Decaf espresso', 'standard'],
  ['Light Pour Over', 'standard'], ['Dark Pour Over', 'standard'], ['Decaf Pour Over', 'standard'],
  ['Vanilla Chai', 'standard'], ['Black Scottie Chai', 'standard'], ['Light Cream', 'standard'],
  ['Heavy Cream', 'standard'], ['Cold Brew Concentrate', 'standard'], ['Baked Goods', 'standard'],
  ['Vanilla', 'flavor'], ['Lavender', 'flavor'], ['Caramel', 'flavor'], ['Simple Syrup', 'flavor'],
  ['Honey Cinnamon', 'flavor'], ['Maple', 'flavor'], ['Chocolate', 'flavor'], ['Autocrat', 'flavor']
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

function validEventDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validOptionalTime(value: unknown): value is string {
  return typeof value === 'string' && (value === '' || /^\d{2}:\d{2}$/.test(value));
}

function validRecurrence(value: unknown): value is 'once' | 'weekly' | 'monthly' {
  return value === 'once' || value === 'weekly' || value === 'monthly';
}

function validSchedule(value: unknown): value is string {
  return ['always', 'monday', 'every_other_day', 'every_other_wednesday'].includes(String(value));
}

function validReportType(value: unknown): value is 'opening' | 'closing' {
  return value === 'opening' || value === 'closing';
}

function validInventoryCategory(value: unknown): value is 'standard' | 'flavor' {
  return value === 'standard' || value === 'flavor';
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

  async function listEvents() {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('id,title,event_date,start_time,end_time,description,recurrence,image_url')
      .order('event_date')
      .order('created_at');
    if (error) throw error;
    return data ?? [];
  }

  async function uploadEventImage(value: unknown) {
    if (typeof value !== 'string') throw new Error('Invalid event image.');
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) throw new Error('Event images must be JPG, PNG, or WebP files.');

    const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
    if (bytes.byteLength > 3 * 1024 * 1024) throw new Error('Event images must be 3 MB or smaller.');

    const extension = match[1] === 'image/jpeg' ? 'jpg' : match[1].slice('image/'.length);
    const path = `events/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('event-images').upload(path, bytes, {
      contentType: match[1],
      upsert: false
    });
    if (error) throw error;
    return supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl;
  }

  async function deleteEventImage(imageUrl: unknown) {
    if (typeof imageUrl !== 'string' || !imageUrl) return;
    const marker = '/storage/v1/object/public/event-images/';
    const index = imageUrl.indexOf(marker);
    if (index === -1) return;
    const path = decodeURIComponent(imageUrl.slice(index + marker.length).split('?')[0]);
    const { error } = await supabase.storage.from('event-images').remove([path]);
    if (error) throw error;
  }

  async function listInventoryItems() {
    const { data: existing, error } = await supabase
      .from('inventory_items')
      .select('id,label,category,sort_order')
      .eq('is_visible', true)
      .order('sort_order');
    if (error) throw error;
    if (existing && existing.length > 0) return existing;

    const { error: seedError } = await supabase.from('inventory_items').insert(
      inventoryDefaults.map(([label, category], index) => ({
        id: crypto.randomUUID(),
        label,
        category,
        sort_order: index + 1,
        is_visible: true
      }))
    );
    if (seedError) throw seedError;
    const { data: seeded, error: seededError } = await supabase
      .from('inventory_items')
      .select('id,label,category,sort_order')
      .eq('is_visible', true)
      .order('sort_order');
    if (seededError) throw seededError;
    return seeded ?? [];
  }

  try {
    if (body.action === 'load') {
      if (!validMonth(body.month)) return json(request, { error: 'Invalid month' }, 400);
      const month = `${body.month}-01`;
      const [{ data: artist, error: artistError }, tasks, events, inventoryItems] = await Promise.all([
        supabase.from('artist_highlights').select('artist_name,contact_info').eq('month', month).maybeSingle(),
        taskGroups(),
        listEvents(),
        listInventoryItems()
      ]);
      if (artistError) throw artistError;
      return json(request, { artist, tasks, events, inventory_items: inventoryItems });
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

    if (body.action === 'add_inventory_item') {
      if (typeof body.label !== 'string' || !body.label.trim() || !validInventoryCategory(body.category)) {
        return json(request, { error: 'An inventory item and valid category are required.' }, 400);
      }
      const inventoryItems = await listInventoryItems();
      const maxOrder = inventoryItems.reduce((max, item) => Math.max(max, item.sort_order), 0);
      const { error } = await supabase.from('inventory_items').insert({
        id: crypto.randomUUID(),
        label: body.label.trim(),
        category: body.category,
        sort_order: maxOrder + 1,
        is_visible: true
      });
      if (error) throw error;
      return json(request, { inventory_items: await listInventoryItems() });
    }

    if (body.action === 'remove_inventory_item') {
      if (typeof body.item_id !== 'string') return json(request, { error: 'Invalid inventory item' }, 400);
      const { error } = await supabase.from('inventory_items').delete().eq('id', body.item_id);
      if (error) throw error;
      return json(request, { inventory_items: await listInventoryItems() });
    }

    if (body.action === 'add_event') {
      if (!validEventDate(body.event_date) || typeof body.title !== 'string' || !body.title.trim()) {
        return json(request, { error: 'An event title and valid date are required.' }, 400);
      }
      const recurrence = body.recurrence ?? 'once';
      if (!validRecurrence(recurrence)) {
        return json(request, { error: 'Invalid event frequency.' }, 400);
      }
      if (!validOptionalTime(body.start_time) || !validOptionalTime(body.end_time) || typeof body.description !== 'string') {
        return json(request, { error: 'Invalid event details.' }, 400);
      }
      const imageUrl = body.image === undefined ? null : await uploadEventImage(body.image);
      const { error } = await supabase.from('calendar_events').insert({
        id: crypto.randomUUID(),
        title: body.title.trim(),
        event_date: body.event_date,
        recurrence,
        start_time: body.start_time || null,
        end_time: body.end_time || null,
        description: body.description.trim(),
        image_url: imageUrl,
        is_published: true
      });
      if (error) {
        await deleteEventImage(imageUrl);
        throw error;
      }
      return json(request, { events: await listEvents() });
    }

    if (body.action === 'update_event') {
      if (typeof body.event_id !== 'string' || !validEventDate(body.event_date) || typeof body.title !== 'string' || !body.title.trim()) {
        return json(request, { error: 'An event title, valid date, and event ID are required.' }, 400);
      }
      if (!validRecurrence(body.recurrence) || !validOptionalTime(body.start_time) || !validOptionalTime(body.end_time) || typeof body.description !== 'string') {
        return json(request, { error: 'Invalid event details.' }, 400);
      }
      const { data: existing, error: existingError } = await supabase
        .from('calendar_events')
        .select('image_url')
        .eq('id', body.event_id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) return json(request, { error: 'Event not found.' }, 404);

      let replacementImageUrl: string | null | undefined;
      if (body.image !== undefined) {
        replacementImageUrl = await uploadEventImage(body.image);
      } else if (body.remove_image === true) {
        replacementImageUrl = null;
      }

      const eventUpdate = {
        title: body.title.trim(),
        event_date: body.event_date,
        recurrence: body.recurrence,
        start_time: body.start_time || null,
        end_time: body.end_time || null,
        description: body.description.trim(),
        ...(replacementImageUrl === undefined ? {} : { image_url: replacementImageUrl })
      };
      const { error } = await supabase
        .from('calendar_events')
        .update(eventUpdate)
        .eq('id', body.event_id);
      if (error) {
        if (replacementImageUrl) await deleteEventImage(replacementImageUrl);
        throw error;
      }
      if (replacementImageUrl !== undefined) await deleteEventImage(existing.image_url);
      return json(request, { events: await listEvents() });
    }

    if (body.action === 'remove_event') {
      if (typeof body.event_id !== 'string') return json(request, { error: 'Invalid event' }, 400);
      const { data: existing, error: existingError } = await supabase
        .from('calendar_events')
        .select('image_url')
        .eq('id', body.event_id)
        .maybeSingle();
      if (existingError) throw existingError;
      if (!existing) return json(request, { error: 'Event not found.' }, 404);
      await deleteEventImage(existing.image_url);
      const { error } = await supabase.from('calendar_events').delete().eq('id', body.event_id);
      if (error) throw error;
      return json(request, { events: await listEvents() });
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
