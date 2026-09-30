-- Raw triage probabilities, so inbox filters can change without another model call.
alter table public.conversations
  add column if not exists triage_scores jsonb;

-- Theme of a feedback comment. Null means the judgment was too uncertain to store.
alter table public.feedback_requests
  add column if not exists theme text,
  add column if not exists theme_confidence double precision;

alter table public.feedback_requests
  add constraint feedback_requests_theme_check
  check (
    theme is null
    or theme in (
      'response_time',
      'wrong_information',
      'staff_helpfulness',
      'unresolved',
      'other'
    )
  );

-- Suggested priority sits beside the priority the reporter chose.
alter table public.bug_reports
  add column if not exists suggested_priority text;

alter table public.bug_reports
  add constraint bug_reports_suggested_priority_check
  check (
    suggested_priority is null
    or suggested_priority in ('low', 'medium', 'high')
  );
