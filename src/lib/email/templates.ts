export type WaitlistAudience = 'food_lover' | 'cook'

export function escapeEmailHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })
}

export function waitlistSignupEmail(audience: WaitlistAudience) {
  const audienceLabel = audience === 'cook' ? 'home cook' : 'food lover'
  const subject = 'You’re on the Food4Love waitlist'
  const text = `Thanks for joining Food4Love as a ${audienceLabel}. Your place on the waitlist is saved. You will receive launch emails only if you chose to opt in to updates. We’ll be in touch when Food4Love is ready.`
  const html = `<main style="font-family:Arial,sans-serif;max-width:560px;margin:32px auto;padding:28px;color:#2f211b;line-height:1.7"><p style="color:#176044;font-size:13px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase">Food4Love</p><h1 style="font-size:25px;line-height:1.3">You’re on the list.</h1><p>Thanks for joining Food4Love as a ${audienceLabel}. Your place on the waitlist is saved.</p><p>You will receive launch emails only if you chose to opt in to updates. We’ll be in touch when Food4Love is ready.</p><p style="color:#81736c;font-size:12px">This is a confirmation of your waitlist signup, not a marketing subscription.</p></main>`
  return { subject, text, html }
}

export function adminAnnouncementEmail(input: {
  subject: string
  message: string
  name: string
  unsubscribeUrl: string
}) {
  const safeName = escapeEmailHtml(input.name || 'there')
  const safeMessage = escapeEmailHtml(input.message).replace(/\n/g, '<br>')
  const safeSubject = escapeEmailHtml(input.subject)
  const safeUnsubscribeUrl = escapeEmailHtml(input.unsubscribeUrl)
  return {
    subject: input.subject,
    text: `${input.subject}\n\nHello ${input.name || 'there'},\n\n${input.message}\n\nYou receive Food4Love email updates because you opted in. Unsubscribe: ${input.unsubscribeUrl}`,
    html: `<main style="font-family:Arial,sans-serif;max-width:600px;margin:32px auto;color:#2f211b;line-height:1.65"><p style="color:#176044;font-size:13px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase">Food4Love</p><h1 style="font-size:24px">${safeSubject}</h1><p>Hello ${safeName},</p><p>${safeMessage}</p><hr style="border:0;border-top:1px solid #e9d6c5;margin:32px 0"><p style="font-size:12px;color:#6e5a52">You receive Food4Love email updates because you opted in. <a href="${safeUnsubscribeUrl}">Unsubscribe</a></p></main>`,
  }
}
