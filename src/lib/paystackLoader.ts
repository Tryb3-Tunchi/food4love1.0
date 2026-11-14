// Loads Paystack's checkout script only when someone is about to pay, so visitors
// who never reach a payment (for example on the public waitlist) make no request to
// Paystack and share nothing with it.
const SCRIPT_SRC = 'https://js.paystack.co/v1/inline.js'

type PaystackGlobal = {
  setup: (options: Record<string, unknown>) => { openIframe: () => void }
}

export function loadPaystack(): Promise<PaystackGlobal | null> {
  if (typeof window === 'undefined') return Promise.resolve(null)
  const existing = (window as unknown as { PaystackPop?: PaystackGlobal })
    .PaystackPop
  if (existing) return Promise.resolve(existing)

  return new Promise((resolve) => {
    const finish = () =>
      resolve(
        (window as unknown as { PaystackPop?: PaystackGlobal }).PaystackPop ??
          null,
      )
    const present = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    )
    if (present) {
      present.addEventListener('load', finish, { once: true })
      present.addEventListener('error', () => resolve(null), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = finish
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}
