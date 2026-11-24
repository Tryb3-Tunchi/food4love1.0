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

export function referralRewardEmail(input: {
  name?: string | null
  appUrl: string
}) {
  const subject = 'Your ₦1,000 Food4Love referral credit is here ❤️'
  const firstName =
    (input.name ?? '').trim().split(/\s+/)[0]?.slice(0, 40) || ''
  const greeting = firstName ? `Hi ${firstName},` : 'Hello,'
  const walletUrl = `${input.appUrl.replace(/\/+$/, '')}/profile`
  const text = [
    greeting,
    '',
    'A new member confirmed their email after joining with your Food4Love referral link.',
    '₦1,000 has been added to your Food4Love wallet as your full signup referral reward.',
    '',
    `View your wallet: ${walletUrl}`,
    '',
    'Thank you for bringing someone new to Food4Love!',
    '',
    'With love,',
    'The Food4Love Team ❤️',
    '',
    'You received this transactional email because a referral reward was added to your account.',
  ].join('\n')
  const html = emailLayout({
    title: 'Your Food4Love referral credit is here',
    preheader: '₦1,000 has been added to your Food4Love wallet.',
    heading: `Your ₦1,000 credit is here <span style="color:${RED};">&#10084;&#65039;</span>`,
    bodyHtml: [
      p(escapeEmailHtml(greeting)),
      p(
        'A new member confirmed their email after joining with your Food4Love referral link.',
      ),
      `<p style="margin:0 0 16px 0;font-size:22px;line-height:1.4;font-weight:bold;color:${GREEN};font-family:${FONT};">₦1,000 added to your wallet</p>`,
      p('This is your full signup referral reward.'),
      brandButton(walletUrl, 'View your wallet'),
      p(
        'Thank you for bringing someone new to Food4Love!<br><strong style="color:' +
          GREEN +
          ';">The Food4Love Team</strong> <span style="color:' +
          RED +
          ';">&#10084;&#65039;</span>',
      ),
    ].join(''),
    footerHtml:
      'You received this transactional email because a referral reward was added to your Food4Love account.',
  })
  return { subject, text, html }
}

// ---------------------------------------------------------------- shared small helpers
const oneLine = (value: string, max: number) =>
  value
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, max)

const firstNameOf = (value?: string | null) =>
  oneLine(value ?? '', 80).split(/\s+/)[0] ?? ''

const brandButton = (href: string, label: string) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px 0;"><tr><td align="center" style="background-color:${GREEN};border-radius:10px;"><a href="${escapeEmailHtml(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:bold;color:${CREAM};text-decoration:none;">${escapeEmailHtml(label)}</a></td></tr></table>`

const signOff = () =>
  p(
    `With love,<br><strong style="color:${GREEN};">The Food4Love Team</strong> <span style="color:${RED};">&#10084;&#65039;</span>`,
  )

// A customer asked to be told when a cook is verified, and now the cook is. Only built
// after the server has re-checked that the cook is STILL verified and the customer
// consented (see lib/notifications/interestRules.ts).
export function interestVerifiedEmail(input: {
  customerName?: string | null
  cookName: string
  profileUrl: string
}) {
  const cookName = oneLine(input.cookName, 60) || 'Your cook'
  const first = firstNameOf(input.customerName)
  const greeting = first ? `Hi ${first},` : 'Hello,'
  // subject lines are headers: no line breaks can get in via a name
  const subject = `Good news! ${cookName} is now verified on Food4Love ❤️`
  const buttonLabel = `View ${cookName}'s profile`

  const text = [
    greeting,
    '',
    'Good news! ❤️',
    '',
    `${cookName} has completed Food4Love verification and is now eligible to receive booking requests.`,
    '',
    'You asked us to let you know, so here it is. You can visit their profile and make a booking.',
    '',
    `${buttonLabel}: ${input.profileUrl}`,
    '',
    'Nothing has been booked or charged. This is only a heads-up.',
    '',
    'With love,',
    'The Food4Love Team ❤️',
    '',
    '---',
    `You received this email because you asked to be notified when ${cookName} became verified. We send it once.`,
  ].join('\n')

  const html = emailLayout({
    title: `${cookName} is now verified on Food4Love`,
    preheader: `${cookName} can now receive booking requests.`,
    heading: `Good news! <span style="color:${RED};">&#10084;&#65039;</span>`,
    bodyHtml: [
      p(escapeEmailHtml(greeting)),
      p(
        `<strong>${escapeEmailHtml(cookName)}</strong> has completed Food4Love verification and is now eligible to receive booking requests.`,
      ),
      p(
        'You asked us to let you know, so here it is. You can visit their profile and make a booking.',
      ),
      brandButton(input.profileUrl, buttonLabel),
      p('Nothing has been booked or charged. This is only a heads-up.'),
      signOff(),
    ].join(''),
    footerHtml: `You received this email because you asked to be notified when ${escapeEmailHtml(cookName)} became verified. We send it once.`,
  })

  return { subject, text, html }
}

// The early-tester invitation. The wording is the product owner's; only the name, the
// link, the expiry and an optional admin note are filled in. The link carries a secret,
// so it appears only in this one message and is never logged.
export function testerInvitationEmail(input: {
  fullName: string
  acceptUrl: string
  expiresAt: string
  personalMessage?: string | null
}) {
  const subject = "You're invited! Get early access to Food4Love ❤️"
  const first = firstNameOf(input.fullName) || 'there'
  const expiry = new Date(input.expiresAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const note = oneLine(input.personalMessage ?? '', 500)

  const steps = [
    'Click the button below to accept your invitation.',
    'Set up your password securely.',
    'Complete your profile.',
    'Explore Food4Love.',
    'Share your feedback and help us improve.',
  ]

  const text = [
    `Hello ${first},`,
    '',
    "You've been personally invited to join Food4Love as an early tester!",
    '',
    'Food4Love is bringing people together through food, meaningful connections and shared experiences.',
    '',
    "We're getting ready for something special, and we'd love you to be among the people who experience it early and help us make it even better.",
    ...(note ? ['', `A note from the team: ${note}`] : []),
    '',
    "Here's how to get started:",
    ...steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    `Accept your invitation: ${input.acceptUrl}`,
    '',
    `This invitation expires on ${expiry}.`,
    'Your invitation is intended for you and should not be shared.',
    '',
    "We're excited to have you with us!",
    '',
    'With love,',
    'The Food4Love Team ❤️',
    '',
    'Bringing people together, one meal at a time.',
    '',
    '---',
    "You received this email because a Food4Love administrator invited this address to test Food4Love. If you weren't expecting it, you can ignore this message.",
  ].join('\n')

  const html = emailLayout({
    title: "You're invited to Food4Love",
    preheader: "You've been invited to get early access to Food4Love.",
    heading: `You&rsquo;re invited! <span style="color:${RED};">&#10084;&#65039;</span>`,
    bodyHtml: [
      p(`Hello ${escapeEmailHtml(first)},`),
      p(
        'You&rsquo;ve been personally invited to join Food4Love as an early tester!',
      ),
      p(
        'Food4Love is bringing people together through food, meaningful connections and shared experiences.',
      ),
      p(
        'We&rsquo;re getting ready for something special, and we&rsquo;d love you to be among the people who experience it early and help us make it even better.',
      ),
      note
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;"><tr><td style="border-left:4px solid ${YELLOW};padding:4px 0 4px 14px;font-family:${FONT};font-size:15px;line-height:1.6;color:${TEXT};"><strong style="color:${GREEN};">A note from the team</strong><br>${escapeEmailHtml(note)}</td></tr></table>`
        : '',
      `<p style="margin:0 0 8px 0;font-size:16px;line-height:1.65;font-weight:bold;color:${GREEN};font-family:${FONT};">Here&rsquo;s how to get started:</p>`,
      `<ol style="margin:0 0 20px 0;padding-left:22px;font-family:${FONT};font-size:16px;line-height:1.7;color:${TEXT};">${steps.map((step) => `<li>${escapeEmailHtml(step)}</li>`).join('')}</ol>`,
      brandButton(input.acceptUrl, 'Accept Your Invitation'),
      p(
        `This invitation expires on ${escapeEmailHtml(expiry)}. Your invitation is intended for you and should not be shared.`,
      ),
      p('We&rsquo;re excited to have you with us!'),
      signOff(),
      `<p style="margin:0 0 16px 0;font-size:14px;line-height:1.5;font-style:italic;color:${MUTED};font-family:${FONT};">Bringing people together, one meal at a time.</p>`,
    ].join(''),
    footerHtml:
      'You received this email because a Food4Love administrator invited this address to test Food4Love. If you weren&rsquo;t expecting it, you can ignore this message.',
  })

  return { subject, text, html }
}

// "Reset your password". Deliberately says nothing about the account (no name, no hint that the
// address is registered). The link carries a one-time Supabase recovery token in its FRAGMENT, so it
// is not logged by servers and is not consumed by mail scanners that merely fetch the link.
export function passwordRecoveryEmail(input: { resetUrl: string }) {
  const subject = 'Reset your Food4Love password'
  const text = [
    'Hello,',
    '',
    'We received a request to reset the password for the Food4Love account that uses this email address.',
    '',
    `Choose a new password: ${input.resetUrl}`,
    '',
    'The link works once and stops working after a short time (usually within an hour). If it has expired, you can ask for a new one on the sign-in page.',
    '',
    "If you didn't ask for this, you can ignore this email: your password will not change and nobody can use this message to get into your account without the link.",
    "Please don't forward this email, because anyone with the link can set a new password.",
    '',
    'With love,',
    'The Food4Love Team ❤️',
    '',
    '---',
    'You received this email because a password reset was requested for this address on Food4Love.',
  ].join('\n')

  const html = emailLayout({
    title: 'Reset your Food4Love password',
    preheader: 'Use the link inside to choose a new password.',
    heading: 'Reset your password',
    bodyHtml: [
      p('Hello,'),
      p(
        'We received a request to reset the password for the Food4Love account that uses this email address.',
      ),
      brandButton(input.resetUrl, 'Choose a New Password'),
      p(
        'The link works once and stops working after a short time (usually within an hour). If it has expired, you can ask for a new one on the sign-in page.',
      ),
      p(
        'If you didn&rsquo;t ask for this, you can ignore this email: your password will not change and nobody can use this message to get into your account without the link. Please don&rsquo;t forward it, because anyone with the link can set a new password.',
      ),
      signOff(),
    ].join(''),
    footerHtml:
      'You received this email because a password reset was requested for this address on Food4Love.',
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

export function supportAlertEmail(input: { appUrl: string }) {
  const inboxUrl = `${input.appUrl.replace(/\/$/, '')}/admin/live`
  return {
    subject: 'A new Food4Love support message needs attention',
    text: `A new message arrived in Food4Love Support. Open the admin inbox to review and reply: ${inboxUrl}`,
    html: `<main style="font-family:Arial,sans-serif;max-width:600px;margin:32px auto;color:#2f211b;line-height:1.65"><p style="color:#176044;font-size:13px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase">Food4Love Support</p><h1 style="font-size:22px">A new support message needs attention</h1><p>Open the secure admin inbox to review the conversation and reply.</p><p><a href="${escapeEmailHtml(inboxUrl)}" style="display:inline-block;border-radius:8px;background:#176044;color:#fff;padding:12px 18px;text-decoration:none;font-weight:bold">Open support inbox</a></p><p style="font-size:12px;color:#6e5a52">Message content and visitor contact details are not included in this alert.</p></main>`,
  }
}

export function adminCampaignEmail(input: {
  subject: string
  previewText: string
  heading: string
  message: string
  name: string
  accountType: string
  email?: string
  unsubscribeUrl: string
  ctaLabel?: string | null
  ctaUrl?: string | null
  testMode?: boolean
}) {
  const valueFor = (value: string) =>
    value
      .replace(/\{\{\s*first_name\s*\}\}/gi, input.name || 'there')
      .replace(/\{\{\s*account_type\s*\}\}/gi, input.accountType)
      .replace(/\{\{\s*email\s*\}\}/gi, input.email ?? '')
  const safeName = escapeEmailHtml(input.name || 'there')
  const safeHeading = escapeEmailHtml(valueFor(input.heading))
  const safeMessage = escapeEmailHtml(valueFor(input.message)).replace(
    /\n/g,
    '<br>',
  )
  const safeSubject = escapeEmailHtml(input.subject)
  const safePreview = escapeEmailHtml(valueFor(input.previewText))
  const safeUnsubscribe = escapeEmailHtml(input.unsubscribeUrl)
  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<p style="margin:24px 0"><a href="${escapeEmailHtml(input.ctaUrl)}" style="display:inline-block;border-radius:8px;background:#176044;color:#fff;padding:12px 18px;text-decoration:none;font-weight:bold">${escapeEmailHtml(input.ctaLabel)}</a></p>`
      : ''
  return {
    subject: input.subject,
    text: `${input.subject}\n\nHello ${input.name || 'there'},\n\n${valueFor(input.message)}${input.ctaLabel && input.ctaUrl ? `\n\n${input.ctaLabel}: ${input.ctaUrl}` : ''}${input.testMode ? '\n\nThis is a test preview sent only to the administrator.' : `\n\nYou receive Food4Love email updates because you opted in. Unsubscribe: ${input.unsubscribeUrl}`}`,
    html: `<main style="font-family:Arial,sans-serif;max-width:600px;margin:32px auto;color:#2f211b;line-height:1.65"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${safePreview}</div><p style="color:#176044;font-size:13px;font-weight:bold;letter-spacing:.08em;text-transform:uppercase">Food4Love</p><h1 style="font-size:24px">${safeHeading || safeSubject}</h1><p>Hello ${safeName},</p><p>${safeMessage}</p>${cta}<hr style="border:0;border-top:1px solid #e9d6c5;margin:32px 0"><p style="font-size:12px;color:#6e5a52">${input.testMode ? 'This is a test preview sent only to the administrator.' : `You receive Food4Love email updates because you opted in. <a href="${safeUnsubscribe}">Unsubscribe</a>`}</p></main>`,
  }
}
