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

// Brand colours (see globals.css and the official logo).
const GREEN = '#0F3D24'
const CREAM = '#FBF1DC'
const CARD = '#FFFBF3'
const RED = '#EF3E63'
const YELLOW = '#F6B90B'
const TEXT = '#2F211B'
const MUTED = '#6E5A52'
const LOGO_URL = 'https://www.food4love.app/logo4food22.png'
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif"

interface LayoutInput {
  // Plain text for the <title>; the heading below may contain markup.
  title: string
  preheader: string
  heading: string
  bodyHtml: string
  footerHtml: string
}

// Table-based layout with inline styles: this is what Gmail, Outlook and Apple
// Mail all render reliably. The logo is a public HTTPS asset, never a local path.
function emailLayout({
  title,
  preheader,
  heading,
  bodyHtml,
  footerHtml,
}: LayoutInput) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapeEmailHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:${CREAM};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${CREAM};">${escapeEmailHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${CREAM};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:${CARD};border-radius:16px;overflow:hidden;">
    <tr><td align="center" style="background-color:${GREEN};padding:28px 24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background-color:${CREAM};border-radius:12px;padding:12px 20px;">
        <img src="${LOGO_URL}" width="170" alt="Food4Love" style="display:block;border:0;height:auto;max-width:100%;">
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:36px 32px 8px 32px;font-family:${FONT};color:${TEXT};">
      <h1 style="margin:0 0 20px 0;font-size:26px;line-height:1.3;color:${GREEN};font-family:${FONT};">${heading}</h1>
      ${bodyHtml}
    </td></tr>
    <tr><td style="padding:8px 32px 32px 32px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td height="4" style="background-color:${YELLOW};font-size:0;line-height:0;width:60px;">&nbsp;</td>
        <td style="font-size:0;line-height:0;">&nbsp;</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:0 32px 32px 32px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};">
      ${footerHtml}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`
}

const p = (html: string) =>
  `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;color:${TEXT};font-family:${FONT};">${html}</p>`

export function waitlistSignupEmail() {
  const subject = "You're on the Food4Love waitlist! ❤️"

  const text = [
    'Hello!',
    '',
    "We're excited to have you on the Food4Love waitlist!",
    '',
    'Food4Love is building a new way for food lovers to discover home and private chefs, explore delicious food and connect over memorable food experiences.',
    '',
    "Whether you're looking forward to discovering great food or sharing your cooking talent, we're happy to have you with us.",
    '',
    "You're on the list!",
    '',
    "We'll share updates as we get closer to launch, in line with your communication preferences.",
    '',
    'Something delicious is cooking!',
    '',
    'With love,',
    'The Food4Love Team ❤️',
    '',
    '---',
    'You received this email because this address was added to the Food4Love waitlist. Joining the waitlist does not create an account. If this was not you, you can ignore this message.',
  ].join('\n')

  const html = emailLayout({
    title: "You're on the Food4Love waitlist",
    preheader: "We're excited to have you on the Food4Love waitlist!",
    heading: `You&rsquo;re on the list! <span style="color:${RED};">&#10084;&#65039;</span>`,
    bodyHtml: [
      p('Hello!'),
      p('We&rsquo;re excited to have you on the Food4Love waitlist!'),
      p(
        'Food4Love is building a new way for food lovers to discover home and private chefs, explore delicious food and connect over memorable food experiences.',
      ),
      p(
        'Whether you&rsquo;re looking forward to discovering great food or sharing your cooking talent, we&rsquo;re happy to have you with us.',
      ),
      `<p style="margin:0 0 16px 0;font-size:18px;line-height:1.5;font-weight:bold;color:${GREEN};font-family:${FONT};">You&rsquo;re on the list!</p>`,
      p(
        'We&rsquo;ll share updates as we get closer to launch, in line with your communication preferences.',
      ),
      `<p style="margin:0 0 8px 0;font-size:16px;line-height:1.65;font-weight:bold;color:${RED};font-family:${FONT};">Something delicious is cooking!</p>`,
      p(
        'With love,<br><strong style="color:' +
          GREEN +
          ';">The Food4Love Team</strong> <span style="color:' +
          RED +
          ';">&#10084;&#65039;</span>',
      ),
    ].join(''),
    footerHtml:
      'You received this email because this address was added to the Food4Love waitlist. Joining the waitlist does not create an account. If this was not you, you can ignore this message.',
  })

  return { subject, text, html }
}

export function welcomeEmail(input: {
  name?: string | null
  role?: string | null
  appUrl: string
}) {
  const subject = 'Welcome to Food4Love! ❤️'
  const firstName =
    (input.name ?? '').trim().split(/\s+/)[0]?.slice(0, 40) || ''
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,'
  const isCook = input.role === 'cook'
  const loginUrl = `${input.appUrl.replace(/\/+$/, '')}/login`

  const nextStep = isCook
    ? 'Complete your chef profile with your story, your cuisines and your menu, so food lovers can get to know your cooking.'
    : 'Complete your profile so chefs can get to know you, then start exploring chef profiles.'
  const discover =
    'In Food4Love you can browse chef profiles, start conversations and send booking requests as chefs become available.'

  const text = [
    greeting,
    '',
    'Welcome to Food4Love! Your email is confirmed and your account has been created.',
    '',
    'Food4Love is a new way to discover home and private chefs and connect over great food.',
    '',
    nextStep,
    discover,
    '',
    `Open Food4Love: ${loginUrl}`,
    '',
    'With love,',
    'The Food4Love Team ❤️',
    '',
    '---',
    'You received this email because you created a Food4Love account.',
  ].join('\n')

  const button = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;"><tr><td align="center" style="background-color:${GREEN};border-radius:10px;"><a href="${escapeEmailHtml(loginUrl)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:bold;color:${CREAM};text-decoration:none;">Open Food4Love</a></td></tr></table>`

  const html = emailLayout({
    title: 'Welcome to Food4Love',
    preheader: 'Your email is confirmed. Here is how to get started.',
    heading: `Welcome to Food4Love! <span style="color:${RED};">&#10084;&#65039;</span>`,
    bodyHtml: [
      p(escapeEmailHtml(greeting)),
      p(
        'Your email is confirmed and your account has been created. Food4Love is a new way to discover home and private chefs and connect over great food.',
      ),
      p(escapeEmailHtml(nextStep)),
      p(escapeEmailHtml(discover)),
      button,
      p(
        `With love,<br><strong style="color:${GREEN};">The Food4Love Team</strong> <span style="color:${RED};">&#10084;&#65039;</span>`,
      ),
    ].join(''),
    footerHtml:
      'You received this email because you created a Food4Love account.',
  })

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
