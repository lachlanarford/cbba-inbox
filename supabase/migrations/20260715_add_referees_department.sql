-- Add Referees as a valid department on conversations, users, and knowledge_base
alter table public.conversations drop constraint if exists conversations_department_check;
alter table public.conversations add constraint conversations_department_check
  check (department is null or department in ('Reps', 'Comps', 'LTP', 'Other', 'Referees'));

alter table public.users drop constraint if exists users_department_check;
alter table public.users add constraint users_department_check
  check (department is null or department in ('Reps', 'Comps', 'LTP', 'Other', 'Referees'));

alter table public.knowledge_base drop constraint if exists knowledge_base_department_check;
alter table public.knowledge_base add constraint knowledge_base_department_check
  check (department is null or department in ('Reps', 'Comps', 'LTP', 'Other', 'Referees'));
