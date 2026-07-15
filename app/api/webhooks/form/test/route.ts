import { NextResponse } from 'next/server'

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({
    endpoint: 'POST /api/webhooks/form',
    auth: 'Header: X-Form-Secret: <FORM_WEBHOOK_SECRET>',
    example_payload: {
      full_name: 'Jane Smith',
      email: 'jane@example.com',
      phone: '0412 000 000',
      subject: 'Question about Reps registration',
      message: 'Hi, I would like to register my son for the Reps program. Can you help?',
      department: 'Reps',
    },
    required_fields: ['full_name', 'email', 'subject', 'message'],
    optional_fields: ['phone', 'department'],
    department_values: ['Reps', 'Comps', 'LTP', 'Other', 'Referees'],
  })
}
