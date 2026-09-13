alter table public.calendar_events
add column if not exists monthly_mode text not null default 'date',
add column if not exists recurrence_end_type text not null default 'never',
add column if not exists recurrence_end_count integer,
add column if not exists recurrence_end_date date;

alter table public.calendar_events
drop constraint if exists calendar_events_monthly_mode_check,
drop constraint if exists calendar_events_recurrence_end_type_check,
drop constraint if exists calendar_events_recurrence_end_count_check,
drop constraint if exists calendar_events_recurrence_end_date_check,
drop constraint if exists calendar_events_recurrence_end_fields_check;

alter table public.calendar_events
add constraint calendar_events_monthly_mode_check
check (monthly_mode in ('date', 'weekday')),
add constraint calendar_events_recurrence_end_type_check
check (recurrence_end_type in ('never', 'count', 'date')),
add constraint calendar_events_recurrence_end_count_check
check (recurrence_end_count is null or recurrence_end_count between 1 and 1000),
add constraint calendar_events_recurrence_end_date_check
check (recurrence_end_date is null or recurrence_end_date >= event_date),
add constraint calendar_events_recurrence_end_fields_check
check (
  (recurrence = 'once' and recurrence_end_type = 'never' and recurrence_end_count is null and recurrence_end_date is null)
  or
  (
    recurrence <> 'once'
    and (
      (recurrence_end_type = 'never' and recurrence_end_count is null and recurrence_end_date is null)
      or (recurrence_end_type = 'count' and recurrence_end_count is not null and recurrence_end_date is null)
      or (recurrence_end_type = 'date' and recurrence_end_count is null and recurrence_end_date is not null)
    )
  )
);
