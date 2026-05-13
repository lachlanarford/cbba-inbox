// WhatsApp via Twilio -- credentials required before activation

export interface WhatsAppConfig {
  accountSid: string
  authToken: string
  whatsappNumber: string
}

export async function sendMessage(
  to: string,
  body: string,
  config: WhatsAppConfig
): Promise<void> {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`
  const params = new URLSearchParams({
    From: `whatsapp:${config.whatsappNumber}`,
    To: `whatsapp:${to}`,
    Body: body,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Twilio error ${res.status}: ${text}`)
  }
}

export function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  // Twilio signature validation using HMAC-SHA1
  // https://www.twilio.com/docs/usage/webhooks/webhooks-security
  const crypto = require('crypto') as typeof import('crypto')
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((str, key) => str + key + params[key], url)
  const expected = crypto.createHmac('sha1', authToken).update(sortedParams).digest('base64')
  return expected === signature
}
