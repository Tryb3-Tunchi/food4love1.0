// No imports on purpose: unit-tested with `node --test`.

export type ExistingPairAction = 'already_matched' | 'blocked' | 'reopen'

// A match id is fixed per pair of people, so when both like each other and a
// row for them already exists, its status decides what must happen:
//   matched -> nothing to create, it is a real match
//   blocked -> a moderator separated them on purpose: do NOT announce a match
//   expired / pending / anything else -> make it an active match again
export function actionForExistingPair(status: string): ExistingPairAction {
  if (status === 'matched') return 'already_matched'
  if (status === 'blocked') return 'blocked'
  return 'reopen'
}

export type AdminCreateAction = 'insert' | 'already_matched' | 'reopen'

// The database allows one match row per pair of people. When an administrator
// creates a match on purpose (audited), an older row for that pair is reused:
//   no row            -> create one
//   matched           -> nothing to do, say so clearly
//   expired/pending/blocked -> make it active again (an explicit admin decision,
//                      unlike the swipe flow, which never overrides a block)
export function adminCreateAction(
  existingStatus: string | null | undefined,
): AdminCreateAction {
  if (!existingStatus) return 'insert'
  if (existingStatus === 'matched') return 'already_matched'
  return 'reopen'
}
