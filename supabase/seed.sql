-- Seed data for Phase 2 development
-- Run this after applying migrations.
-- UUIDs are fixed so re-running is idempotent with ON CONFLICT DO NOTHING.

-- ============================================================
-- CONTACTS
-- ============================================================
insert into public.contacts (id, full_name, email, phone, channel, created_at, updated_at) values
  ('c1000001-0000-4000-a000-000000000001', 'John Smith',    'john.smith@example.com',  '0412 345 678', 'gmail',     now() - interval '30 days', now()),
  ('c1000001-0000-4000-a000-000000000002', 'Sarah Johnson', 'sarah.j@gmail.com',        '0423 456 789', 'whatsapp',  now() - interval '14 days', now()),
  ('c1000001-0000-4000-a000-000000000003', 'Michael Chen',  'mchen88@hotmail.com',      null,           'facebook',  now() - interval '7 days',  now())
on conflict (id) do nothing;

-- ============================================================
-- CONVERSATIONS
-- ============================================================
insert into public.conversations (id, contact_id, channel, status, department, priority, subject, is_read, created_at, updated_at, last_message_at) values
  (
    'd1000001-0000-4000-a000-000000000001',
    'c1000001-0000-4000-a000-000000000001',
    'gmail', 'open', 'Reps', 'high',
    'Registration inquiry for 2025 season',
    false,
    now() - interval '2 days',
    now() - interval '1 hour',
    now() - interval '1 hour'
  ),
  (
    'd1000001-0000-4000-a000-000000000002',
    'c1000001-0000-4000-a000-000000000002',
    'whatsapp', 'in_progress', 'Comps', 'medium',
    'Questions about the Autumn competition',
    true,
    now() - interval '5 days',
    now() - interval '3 hours',
    now() - interval '3 hours'
  ),
  (
    'd1000001-0000-4000-a000-000000000003',
    'c1000001-0000-4000-a000-000000000003',
    'facebook', 'waiting', 'LTP', 'low',
    'Junior program availability',
    true,
    now() - interval '7 days',
    now() - interval '1 day',
    now() - interval '1 day'
  ),
  (
    'd1000001-0000-4000-a000-000000000004',
    'c1000001-0000-4000-a000-000000000001',
    'gmail', 'closed', 'Reps', 'low',
    'Payment receipt request',
    true,
    now() - interval '20 days',
    now() - interval '18 days',
    now() - interval '18 days'
  ),
  (
    'd1000001-0000-4000-a000-000000000005',
    'c1000001-0000-4000-a000-000000000002',
    'whatsapp', 'open', 'Other', 'urgent',
    'Urgent: Uniform sizing issue for whole team',
    false,
    now() - interval '30 minutes',
    now() - interval '10 minutes',
    now() - interval '10 minutes'
  )
on conflict (id) do nothing;

-- ============================================================
-- MESSAGES
-- ============================================================
insert into public.messages (id, conversation_id, sender_type, sender_id, content, is_internal_note, created_at) values
  -- Conversation 1: Registration inquiry
  (
    'e1000001-0000-4000-a000-000000000001',
    'd1000001-0000-4000-a000-000000000001',
    'contact', null,
    'Hi, I am interested in registering my son for the 2025 basketball season. Can you tell me what the process is and what the fees are?',
    false,
    now() - interval '2 days'
  ),
  (
    'e1000001-0000-4000-a000-000000000002',
    'd1000001-0000-4000-a000-000000000001',
    'staff', null,
    'Hi John, thanks for reaching out! Registration for the 2025 season opens on 1 February. Fees for the junior division are $180 per player, which includes a uniform. I will send you the full details shortly.',
    false,
    now() - interval '1 day' - interval '22 hours'
  ),
  (
    'e1000001-0000-4000-a000-000000000003',
    'd1000001-0000-4000-a000-000000000001',
    'contact', null,
    'Great, thanks! How old does he need to be? He turns 10 in March.',
    false,
    now() - interval '1 hour'
  ),

  -- Conversation 2: Competition questions
  (
    'e1000001-0000-4000-a000-000000000004',
    'd1000001-0000-4000-a000-000000000002',
    'contact', null,
    'Hey, quick question - are there still spots available in the Autumn competition for a mixed team of 14-16 year olds?',
    false,
    now() - interval '5 days'
  ),
  (
    'e1000001-0000-4000-a000-000000000005',
    'd1000001-0000-4000-a000-000000000002',
    'staff', null,
    'Hi Sarah! Yes, we still have a few spots in the 14-16 mixed division. How many players are in your team?',
    false,
    now() - interval '4 days' - interval '20 hours'
  ),
  (
    'e1000001-0000-4000-a000-000000000006',
    'd1000001-0000-4000-a000-000000000002',
    'staff', null,
    'Following up here - just checking if you had a chance to confirm team numbers?',
    true,
    now() - interval '3 hours'
  ),

  -- Conversation 3: Junior program
  (
    'e1000001-0000-4000-a000-000000000007',
    'd1000001-0000-4000-a000-000000000003',
    'contact', null,
    'Hello, I saw your post about the LTP junior program. My daughter is 7 and has never played before. Is this suitable for complete beginners?',
    false,
    now() - interval '7 days'
  ),
  (
    'e1000001-0000-4000-a000-000000000008',
    'd1000001-0000-4000-a000-000000000003',
    'staff', null,
    'Hi Michael! Absolutely - the LTP (Learn to Play) program is designed specifically for beginners aged 5-10. No experience needed at all. Sessions run on Saturday mornings.',
    false,
    now() - interval '6 days' - interval '18 hours'
  ),
  (
    'e1000001-0000-4000-a000-000000000009',
    'd1000001-0000-4000-a000-000000000003',
    'contact', null,
    'That sounds perfect! What are the dates for the next intake? I have sent you an enquiry form via the website too.',
    false,
    now() - interval '1 day'
  ),

  -- Conversation 4: Closed payment inquiry
  (
    'e1000001-0000-4000-a000-000000000010',
    'd1000001-0000-4000-a000-000000000004',
    'contact', null,
    'Can I get a receipt for the registration payment I made last week? I need it for my employer reimbursement.',
    false,
    now() - interval '20 days'
  ),
  (
    'e1000001-0000-4000-a000-000000000011',
    'd1000001-0000-4000-a000-000000000004',
    'staff', null,
    'Hi John! I have just emailed your receipt to john.smith@example.com. Please check your spam folder if it does not arrive within a few minutes.',
    false,
    now() - interval '18 days'
  ),

  -- Conversation 5: Urgent uniform issue
  (
    'e1000001-0000-4000-a000-000000000012',
    'd1000001-0000-4000-a000-000000000005',
    'contact', null,
    'URGENT - we just received our team uniforms and half of them are the wrong size. We have a game this Saturday. Please help!',
    false,
    now() - interval '30 minutes'
  )
on conflict (id) do nothing;

-- Mark conversation 4 as closed
update public.conversations
set closed_at = now() - interval '18 days'
where id = 'd1000001-0000-4000-a000-000000000004';
