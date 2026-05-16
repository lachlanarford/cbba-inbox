import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

const PURPLE = '#604484'
const GOLD = '#FBB33F'

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title} - CBBA Storm Basketball</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;border-radius:14px;max-width:480px;width:100%;padding:36px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .logo{color:${PURPLE};font-size:20px;font-weight:700;margin-bottom:28px}
  .logo span{color:${GOLD}}
  h1{font-size:22px;color:#21222C;margin-bottom:12px}
  p{color:#555;font-size:15px;line-height:1.6;margin-bottom:20px}
  .stars{display:flex;justify-content:center;gap:8px;margin:20px 0}
  .stars a{font-size:40px;text-decoration:none;color:#ddd;transition:color .15s}
  .stars a:hover{color:${GOLD}}
  .badge{display:inline-flex;align-items:center;gap:6px;background:#f3eefb;color:${PURPLE};padding:8px 18px;border-radius:999px;font-size:15px;margin-bottom:20px}
  textarea{width:100%;border:1px solid #ddd;border-radius:8px;padding:12px;font-size:14px;font-family:inherit;resize:vertical;min-height:100px;color:#333}
  textarea:focus{outline:none;border-color:${PURPLE}}
  button{background:${PURPLE};color:#fff;border:none;padding:12px 28px;border-radius:8px;font-size:15px;cursor:pointer;width:100%;margin-top:12px}
  button:hover{opacity:.9}
  .muted{color:#aaa;font-size:13px;margin-top:16px}
</style>
</head>
<body>
<div class="card">
  <div class="logo">CBBA <span>Storm Basketball</span></div>
  ${body}
</div>
</body>
</html>`,
    {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }
  )
}

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  const supabase = createServiceClient()
  const url = new URL(request.url)
  const ratingParam = url.searchParams.get('rating')

  const { data: row } = await supabase
    .from('feedback_requests')
    .select('*')
    .eq('token', params.token)
    .single()

  if (!row) {
    return page(
      'Invalid link',
      `<h1>Link not found</h1><p>This feedback link is invalid or has expired.</p>`
    )
  }

  // If a rating was passed in the URL, save it
  if (ratingParam) {
    const rating = parseInt(ratingParam, 10)
    if (rating >= 1 && rating <= 5) {
      if (!row.rating) {
        await supabase
          .from('feedback_requests')
          .update({ rating, responded_at: new Date().toISOString() })
          .eq('token', params.token)
        row.rating = rating
      }
    }
  }

  // Already submitted rating + comment
  if (row.rating && row.comment) {
    return page(
      'Thank you',
      `<h1>Thank you for your feedback!</h1>
       <p>We have already received your rating and comment. We appreciate you taking the time.</p>
       <p class="muted">CBBA Storm Basketball &mdash; info@blacktownbasketball.com</p>`
    )
  }

  // Has rating, show comment form
  if (row.rating) {
    const stars = '&#9733;'.repeat(row.rating) + '&#9734;'.repeat(5 - row.rating)
    return page(
      'Leave a comment',
      `<h1>Thanks for your rating!</h1>
       <div class="badge">${stars} ${row.rating} / 5</div>
       <p>Would you like to add a comment? (optional)</p>
       <form method="POST" action="/api/feedback/${params.token}/comment">
         <textarea name="comment" placeholder="Tell us more about your experience..."></textarea>
         <button type="submit">Submit feedback</button>
       </form>
       <p class="muted">Or <a href="/api/feedback/${params.token}/comment" style="color:${PURPLE}">skip and finish</a></p>`
    )
  }

  // No rating yet, show rating page
  const starLinks = [1, 2, 3, 4, 5]
    .map((n) => `<a href="/api/feedback/${params.token}?rating=${n}" title="${n} star${n > 1 ? 's' : ''}">&#9733;</a>`)
    .join('')

  return page(
    'Share your feedback',
    `<h1>How did we do?</h1>
     <p>Thanks for contacting CBBA Storm Basketball. Please take a moment to rate your support experience.</p>
     <div class="stars">${starLinks}</div>
     <p class="muted">Click a star to submit your rating</p>`
  )
}
