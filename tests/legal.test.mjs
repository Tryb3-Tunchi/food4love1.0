// Run with: npm test   (Node's built-in test runner; no extra dependencies)
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  LEGAL,
  LEGAL_DOCUMENTS,
  findLegalDocument,
  legalVisibility,
  splitPlaceholders,
} from '../src/lib/legal/documents.ts'
import { MINIMUM_AGE } from '../src/lib/ageGate.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const allText = (doc) =>
  [
    doc.title,
    doc.summary,
    ...doc.sections.flatMap((s) => [s.heading, ...s.body]),
  ].join('\n')
const everything = LEGAL_DOCUMENTS.map(allText).join('\n')

test('all ten required documents are covered by nine pages plus the refunds page', () => {
  const slugs = LEGAL_DOCUMENTS.map((d) => d.slug).sort()
  assert.deepEqual(slugs, [
    'community-guidelines',
    'content-policy',
    'cookies',
    'copyright',
    'email-consent',
    'privacy',
    'refunds',
    'safety',
    'terms',
  ])
  // every document has a real page route that renders it
  for (const slug of slugs) {
    const file = join(root, 'src/app/(legal)', slug, 'page.tsx')
    assert.ok(existsSync(file), `${slug} has a page`)
    assert.match(readFileSync(file, 'utf8'), new RegExp(`'${slug}'|"${slug}"`))
  }
  assert.ok(existsSync(join(root, 'src/app/(legal)/legal/page.tsx')))
})

test('every document has unique sections and states what the owner must decide', () => {
  for (const doc of LEGAL_DOCUMENTS) {
    assert.ok(doc.title && doc.summary, doc.slug)
    assert.ok(doc.sections.length >= 4, `${doc.slug} has content`)
    const ids = doc.sections.map((s) => s.id)
    assert.equal(
      new Set(ids).size,
      ids.length,
      `${doc.slug} section ids are unique`,
    )
    assert.ok(doc.decisions.length >= 1, `${doc.slug} lists owner decisions`)
    for (const s of doc.sections)
      assert.ok(s.body.length >= 1 && s.heading, `${doc.slug}/${s.id}`)
  }
  assert.equal(findLegalDocument('nope'), null)
})

test('missing business facts are placeholders, and no contact details were invented', () => {
  for (const value of [
    LEGAL.company,
    LEGAL.address,
    LEGAL.legalEmail,
    LEGAL.privacyEmail,
    LEGAL.safetyEmail,
    LEGAL.jurisdiction,
  ]) {
    assert.match(value, /^\[.*TO BE CONFIRMED/, value)
  }
  assert.ok(!/@/.test(everything), 'no email address appears in the documents')
  assert.ok(!/https?:\/\//.test(everything), 'no invented links')
  assert.ok(
    !/\+?\d{3}[\s-]?\d{3}[\s-]?\d{4}/.test(everything),
    'no invented phone numbers',
  )
  const parts = splitPlaceholders('A [B] c [D]')
  assert.deepEqual(
    parts.map((p) => p.placeholder),
    [false, true, false, true],
  )
})

test('the documents make none of the promises the business cannot support', () => {
  const banned = [
    /we guarantee/i,
    /guaranteed (refund|quality|delivery)/i,
    /(?<!not )(every|all) (cook|cooks|chef|chefs) (is|are) (verified|vetted|trained|insured|certified)/i,
    /fully insured/i,
    /\bwe deliver\b/i,
    /our (delivery|riders|couriers|drivers)/i,
    /instant(ly)? (booking|confirmation)/i,
    /legally compliant|fully compliant/i,
  ]
  for (const re of banned) assert.ok(!re.test(everything), String(re))
  const terms = allText(findLegalDocument('terms'))
  assert.match(terms, /do not operate a delivery fleet/i)
  assert.match(terms, /do not guarantee the quality/i)
  assert.match(terms, /Not every cook is verified/i)
  assert.match(
    allText(findLegalDocument('safety')),
    /does not mean we have inspected a kitchen/i,
  )
})

test('pre-launch is stated accurately: the waitlist does not create an account', () => {
  for (const slug of ['terms', 'privacy', 'email-consent']) {
    assert.match(
      allText(findLegalDocument(slug)),
      /waitlist[\s\S]{0,60}does not create/i,
      slug,
    )
  }
})

test('the minimum age in the documents matches the one the app enforces', () => {
  assert.equal(LEGAL.minimumAge, MINIMUM_AGE)
  assert.match(
    allText(findLegalDocument('terms')),
    new RegExp(`at least ${MINIMUM_AGE} years`),
  )
  assert.match(
    allText(findLegalDocument('privacy')),
    new RegExp(`aged ${MINIMUM_AGE}`),
  )
})

test('subscriptions are described as not offered, and refunds are not promised', () => {
  const refunds = allText(findLegalDocument('refunds'))
  assert.match(refunds, /does not currently offer subscriptions/i)
  assert.match(refunds, /not always guaranteed/i)
})

test('the privacy policy names the real processors and the real data', () => {
  const privacy = allText(findLegalDocument('privacy'))
  for (const name of [
    'Supabase',
    'Vercel',
    'Resend',
    'Paystack',
    'OpenStreetMap',
    'Nigeria Data Protection',
  ]) {
    assert.ok(privacy.includes(name), name)
  }
  for (const phrase of [
    'identity document',
    'face',
    'approximate area',
    'does not create an account',
  ]) {
    assert.match(privacy, new RegExp(phrase, 'i'), phrase)
  }
  const cookies = allText(findLegalDocument('cookies'))
  assert.match(cookies, /Global Privacy Control/)
  assert.match(cookies, /does not use advertising cookies/i)
  const email = allText(findLegalDocument('email-consent'))
  assert.match(email, /never ticked for you/i)
  assert.match(email, /does not turn marketing back on/i)
})

test('drafts are held on the live site until the owner publishes them', () => {
  assert.equal(legalVisibility({ VERCEL_ENV: 'production' }), 'held')
  assert.equal(
    legalVisibility({
      VERCEL_ENV: 'production',
      LEGAL_PAGES_PUBLISHED: 'false',
    }),
    'held',
  )
  assert.equal(
    legalVisibility({
      VERCEL_ENV: 'production',
      LEGAL_PAGES_PUBLISHED: 'true',
    }),
    'published',
  )
  assert.equal(legalVisibility({ VERCEL_ENV: 'preview' }), 'draft')
  assert.equal(legalVisibility({}), 'draft')
  const env = readFileSync(join(root, '.env.example'), 'utf8')
  assert.match(env, /LEGAL_PAGES_PUBLISHED=false/)
})

test('legal pages are reachable from the places people agree or decide', () => {
  const read = (p) => readFileSync(join(root, p), 'utf8')
  assert.match(
    read('src/components/landing/WaitlistLanding.tsx'),
    /LegalFooter/,
  )
  assert.match(
    read('src/components/landing/WaitlistLanding.tsx'),
    /href="\/privacy"/,
  )
  assert.match(
    read('src/components/analytics/AnalyticsProvider.tsx'),
    /href="\/cookies"/,
  )
  assert.match(read('src/app/(app)/settings/page.tsx'), /LegalFooter/)
  assert.match(read('src/components/account/AgeGate.tsx'), /href="\/terms"/)
  const footer = read('src/components/legal/LegalFooter.tsx')
  for (const [, href] of footer.matchAll(/\['(\/[a-z-]+)',/g)) {
    assert.ok(
      LEGAL_DOCUMENTS.some((d) => `/${d.slug}` === href),
      href,
    )
  }
  // drafts must never be indexed by search engines
  assert.match(
    read('src/components/legal/LegalDocumentView.tsx'),
    /index: false/,
  )
})

import {
  documentHasPlaceholders,
  effectiveLegalVisibility,
} from '../src/lib/legal/documents.ts'

test('a document with an unresolved placeholder can never be published', () => {
  for (const doc of LEGAL_DOCUMENTS) {
    assert.equal(
      effectiveLegalVisibility(
        { VERCEL_ENV: 'production', LEGAL_PAGES_PUBLISHED: 'true' },
        doc,
      ),
      'held',
      `${doc.slug} stays held even with the publish switch on`,
    )
  }
  const finished = {
    slug: 'x',
    title: 'X',
    summary: 'Y',
    decisions: [],
    sections: [{ id: 'a', heading: 'A', body: ['All facts filled in.'] }],
  }
  // the set as a whole still has placeholders today
  assert.ok(LEGAL_DOCUMENTS.some(documentHasPlaceholders))
  assert.equal(documentHasPlaceholders(finished), false)
  assert.equal(
    effectiveLegalVisibility(
      { VERCEL_ENV: 'production', LEGAL_PAGES_PUBLISHED: 'true' },
      finished,
      [finished],
    ),
    'published',
  )
  // one complete document is not enough while another in the set is unfinished
  assert.equal(
    effectiveLegalVisibility(
      {
        VERCEL_ENV: 'production',
        LEGAL_PAGES_PUBLISHED: 'true',
      },
      finished,
    ),
    'held',
  )
  assert.equal(
    effectiveLegalVisibility({ VERCEL_ENV: 'production' }, finished),
    'held',
  )
  assert.equal(
    effectiveLegalVisibility({ VERCEL_ENV: 'preview' }, finished),
    'draft',
  )
})
