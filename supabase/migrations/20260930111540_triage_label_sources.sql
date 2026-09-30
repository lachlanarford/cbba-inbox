-- Who last set department and priority.
-- Null means triage may fill the field. channel, staff, ai, and legacy are left alone.

alter table public.conversations
  add column if not exists department_source text,
  add column if not exists priority_source text;

alter table public.conversations
  add constraint conversations_department_source_check
  check (
    department_source is null
    or department_source in ('channel', 'staff', 'ai', 'legacy')
  );

alter table public.conversations
  add constraint conversations_priority_source_check
  check (
    priority_source is null
    or priority_source in ('channel', 'staff', 'ai', 'legacy')
  );

-- Existing departments were set by a mailbox, a form, or a person. Do not relabel them.
update public.conversations
set department_source = 'legacy'
where department is not null
  and department_source is null;

-- Existing priorities were accepted in the live inbox. Only new rows stay open for triage.
update public.conversations
set priority_source = 'legacy'
where priority_source is null;
