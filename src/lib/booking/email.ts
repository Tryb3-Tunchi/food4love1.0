// No imports on purpose: unit-tested with `node --test`.
//
// Booking emails are SERVICE messages about something the person is already part of.
// They never contain the service address, allergies, dietary needs, phone numbers or
// prices: only what happened and a link to open the booking inside the app.

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] as string,
  )
}

export function bookingEmailContent(input: {
  title: string
  body: string
  url: string
}): { subject: string; html: string; text: string } {
  const subject = `Food4Love: ${input.title}`
  const safeUrl = escapeHtml(input.url)
  const html =
    `<main style="font-family:Arial,sans-serif;max-width:560px;margin:24px auto;color:#2f211b;line-height:1.6">` +
    `<h1 style="font-size:20px">${escapeHtml(input.title)}</h1>` +
    `<p>${escapeHtml(input.body)}</p>` +
    `<p><a href="${safeUrl}" style="display:inline-block;padding:10px 18px;background:#176044;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Open the booking</a></p>` +
    `<p style="font-size:12px;color:#6e5a52">You get this because you are part of this booking on Food4Love. You can change notification choices in Settings.</p>` +
    `</main>`
  const text = `${input.title}\n\n${input.body}\n\nOpen the booking: ${input.url}\n\nYou get this because you are part of this booking on Food4Love.`
  return { subject, html, text }
}

// Booking pages live under the app; an email must only ever link to our own site.
export function bookingUrl(
  appUrl: string | undefined,
  bookingId: string,
): string | null {
  if (!appUrl || !/^https?:\/\//.test(appUrl)) return null
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null
  return `${appUrl.replace(/\/+$/, '')}/bookings/${bookingId}`
}
