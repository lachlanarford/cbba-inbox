export function feedbackRequestEmail({
  contactName,
  subject,
  feedbackBaseUrl,
}: {
  contactName: string | null
  subject: string | null
  feedbackBaseUrl: string
}): { subject: string; html: string } {
  const name = contactName ?? 'there'
  const topicLine = subject ? `regarding <strong>${subject}</strong>` : 'regarding your recent enquiry'

  const stars = [1, 2, 3, 4, 5]
    .map(
      (n) => `
      <a href="${feedbackBaseUrl}?rating=${n}" style="
        display: inline-block;
        width: 48px;
        height: 48px;
        line-height: 48px;
        text-align: center;
        font-size: 28px;
        text-decoration: none;
        border-radius: 8px;
        background-color: #f5f5f5;
        margin: 0 4px;
        color: #604484;
      ">&#9733;</a>`
    )
    .join('')

  return {
    subject: 'How did we go? Share your feedback',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Share your feedback</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#604484;padding:28px 36px;text-align:center;">
              <span style="color:#FBB33F;font-size:22px;font-weight:700;letter-spacing:-0.5px;">CBBA Storm Basketball</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 24px;color:#21222C;">
              <p style="margin:0 0 16px;font-size:16px;">Hi ${name},</p>
              <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
                Thanks for getting in touch with us ${topicLine}. We hope we were able to help!
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#444;">
                How would you rate your experience with our support team?
              </p>
              <!-- Star rating -->
              <div style="text-align:center;margin:28px 0;">
                <p style="margin:0 0 16px;font-size:13px;color:#888;">Click a star to leave your rating</p>
                <div style="display:inline-block;">
                  <span style="font-size:12px;color:#888;display:block;margin-bottom:8px;">Poor</span>
                  ${stars}
                  <span style="font-size:12px;color:#888;display:block;margin-top:8px;">Excellent</span>
                </div>
              </div>
              <p style="margin:24px 0 0;font-size:13px;color:#999;text-align:center;line-height:1.5;">
                This feedback helps us improve our service. It takes less than 30 seconds.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8f8f8;padding:20px 36px;border-top:1px solid #eee;text-align:center;">
              <p style="margin:0;font-size:12px;color:#aaa;">
                City of Blacktown Basketball Association &mdash; Western Sydney
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#aaa;">
                <a href="mailto:info@blacktownbasketball.com" style="color:#604484;">info@blacktownbasketball.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  }
}
