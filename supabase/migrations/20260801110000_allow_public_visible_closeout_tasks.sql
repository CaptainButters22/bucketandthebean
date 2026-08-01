drop policy if exists "anon_no_closeout_tasks" on public.closeout_tasks;

create policy "public_read_visible_closeout_tasks"
on public.closeout_tasks
for select
to anon
using (is_visible = true);
