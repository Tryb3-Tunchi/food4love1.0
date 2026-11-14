import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  LEGAL,
  LEGAL_DOCUMENTS,
  findLegalDocument,
  documentHasPlaceholders,
  effectiveLegalVisibility,
  legalVisibility,
  splitPlaceholders,
  type LegalSection,
} from '@/lib/legal/documents'

function env() {
  return {
    LEGAL_PAGES_PUBLISHED: process.env.LEGAL_PAGES_PUBLISHED,
    VERCEL_ENV: process.env.VERCEL_ENV,
  }
}

function visibility() {
  return legalVisibility(env())
}

export function legalMetadata(slug: string): Metadata {
  const doc = findLegalDocument(slug)
  if (!doc) return {}
  const published = effectiveLegalVisibility(env(), doc) === 'published'
  return {
    title: published ? doc.title : `${doc.title} (draft)`,
    description: doc.summary,
    // Drafts and the holding page must never be indexed by search engines.
    robots: published ? undefined : { index: false, follow: false },
  }
}

function Text({ value }: { value: string }) {
  return (
    <>
      {splitPlaceholders(value).map((part, i) =>
        part.placeholder ? (
          <mark
            key={i}
            className="rounded px-1"
            style={{ background: '#fff3b0', color: '#3d2f00' }}
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )
}

function Section({ section }: { section: LegalSection }) {
  const items: React.ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (bullets.length) {
      items.push(
        <ul key={`ul-${items.length}`} className="ml-5 list-disc space-y-1">
          {bullets.map((b, i) => (
            <li key={i}>
              <Text value={b} />
            </li>
          ))}
        </ul>,
      )
      bullets = []
    }
  }
  for (const line of section.body) {
    if (line.startsWith('- ')) bullets.push(line.slice(2))
    else {
      flush()
      items.push(
        <p key={`p-${items.length}`}>
          <Text value={line} />
        </p>,
      )
    }
  }
  flush()
  return (
    <section id={section.id} className="scroll-mt-20">
      <h2
        className="font-heading text-xl font-bold"
        style={{ color: 'var(--text-1)' }}
      >
        {section.heading}
      </h2>
      <div
        className="mt-2 space-y-3 text-sm leading-7"
        style={{ color: 'var(--text-2)' }}
      >
        {items}
      </div>
    </section>
  )
}

export function LegalHeld() {
  return (
    <div className="py-16 text-center">
      <h1
        className="font-heading text-2xl font-bold"
        style={{ color: 'var(--text-1)' }}
      >
        This page is being prepared
      </h1>
      <p
        className="mx-auto mt-3 max-w-md text-sm leading-7"
        style={{ color: 'var(--text-2)' }}
      >
        Food4Love is not open to the public yet, and our legal information is
        being finalised. Joining the waitlist does not create an account. Please
        check back soon.
      </p>
      <Link
        href="/waitlist"
        className="mt-6 inline-block text-sm font-semibold underline"
      >
        Back to the waitlist
      </Link>
    </div>
  )
}

export function LegalPage({
  slug,
  children,
}: {
  slug: string
  children?: React.ReactNode
}) {
  const doc = findLegalDocument(slug)
  if (!doc) notFound()
  const mode = effectiveLegalVisibility(env(), doc)
  if (mode === 'held') return <LegalHeld />

  return (
    <article>
      {mode === 'draft' && (
        <div
          role="note"
          className="mb-6 rounded-2xl border p-4 text-sm leading-6"
          style={{
            background: '#fff8dc',
            borderColor: '#e6c200',
            color: '#3d2f00',
          }}
        >
          <p className="font-bold">
            DRAFT FOR LEGAL REVIEW. Not approved, not legal advice.
          </p>
          <p className="mt-1">
            Highlighted [BRACKETS] are facts only the owner can confirm.
            Decisions needed before this can be published:
          </p>
          <ul className="ml-5 mt-2 list-disc">
            {doc.decisions.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}
      <h1
        className="font-heading text-3xl font-bold"
        style={{ color: 'var(--text-1)' }}
      >
        {doc.title}
      </h1>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-3)' }}>
        {doc.summary}
        {mode === 'draft' ? ` Version ${LEGAL.version}, ${LEGAL.updated}.` : ''}
      </p>
      <div className="mt-8 space-y-8">
        {doc.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}
        {children}
      </div>
    </article>
  )
}

export function LegalIndex() {
  const mode = visibility()
  if (
    mode === 'held' ||
    (mode === 'published' && LEGAL_DOCUMENTS.some(documentHasPlaceholders))
  )
    return <LegalHeld />
  return (
    <div>
      <h1
        className="font-heading text-3xl font-bold"
        style={{ color: 'var(--text-1)' }}
      >
        Legal information
      </h1>
      <ul className="mt-6 space-y-3">
        {LEGAL_DOCUMENTS.map((d) => (
          <li key={d.slug}>
            <Link href={`/${d.slug}`} className="font-semibold underline">
              {d.title}
            </Link>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              {d.summary}
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}
