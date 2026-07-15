-- Add Referees as a valid conversation department
alter table public.conversations drop constraint if exists conversations_department_check;
alter table public.conversations add constraint conversations_department_check
  check (department is null or department in ('Reps', 'Comps', 'LTP', 'Other', 'Referees'));
