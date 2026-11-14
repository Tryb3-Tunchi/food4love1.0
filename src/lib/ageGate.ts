// No imports on purpose: unit-tested with `node --test`.
//
// Adult confirmation. Food4Love connects strangers who message each other, match and
// may arrange to meet, so the social features are for adults only.
//
// OWNER / LEGAL DECISION REQUIRED: MINIMUM_AGE is a proposed default (18, the age of
// majority in Nigeria and the usual threshold for services where strangers meet). It is
// not legal advice. Counsel should confirm it, and whether a stronger check than a
// self-declaration is needed (for example date of birth). Date of birth and ID documents
// are deliberately NOT collected here: that would be extra personal data for little gain.
export const MINIMUM_AGE = 18

// 'confirmed'     the member declared they are an adult (age_confirmed_at is set)
// 'required'      the database knows the field and it is empty: the member must confirm
// 'not_enforced'  this database does not have the field yet (the migration is not
//                 applied), so nothing can be enforced; the application keeps working
export type AgeGate = 'confirmed' | 'required' | 'not_enforced'

export function ageGate(ageConfirmedAt: string | null | undefined): AgeGate {
  if (ageConfirmedAt === undefined) return 'not_enforced'
  if (ageConfirmedAt === null) return 'required'
  return Number.isNaN(Date.parse(ageConfirmedAt)) ? 'required' : 'confirmed'
}

export function mayUseSocialFeatures(state: AgeGate): boolean {
  return state !== 'required'
}

export const AGE_REQUIRED_CODE = 'age_confirmation_required'
export const AGE_REQUIRED_MESSAGE = `Confirm that you are ${MINIMUM_AGE} or older to continue.`
