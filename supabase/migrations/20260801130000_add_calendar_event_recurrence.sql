alter table public.calendar_events
add column if not exists recurrence text not null default 'once';

alter table public.calendar_events
drop constraint if exists calendar_events_recurrence_check;

alter table public.calendar_events
add constraint calendar_events_recurrence_check
check (recurrence in ('once', 'weekly', 'monthly'));
