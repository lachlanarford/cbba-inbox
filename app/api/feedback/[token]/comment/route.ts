import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET(
  _request: Request,
  { params }: { params: { token: string } }
) {
  // Skip comment - redirect to thank you page
  return NextResponse.redirect(
    new URL(`/api/feedback/${params.token}?done=1`, process.env.NEXT_PUBLIC_APP_URL ?? '')
  )
}

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  const supabase = createServiceClient()

  let comment = ''
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await request.text()
    const form = new URLSearchParams(text)
    comment = form.get('comment') ?? ''
  } else {
    try {
      const body = await request.json() as { comment?: string }
      comment = body.comment ?? ''
    } catch {
      // ignore
    }
  }

  const { data: row } = await supabase
    .from('feedback_requests')
    .select('rating')
    .eq('token', params.token)
    .single()

  if (!row || !row.rating) {
    return NextResponse.json({ error: 'Rating required before comment' }, { status: 400 })
  }

  if (comment.trim()) {
    await supabase
      .from('feedback_requests')
      .update({ comment: comment.trim() })
      .eq('token', params.token)
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  return NextResponse.redirect(new URL(`/api/feedback/${params.token}`, appUrl))
}
