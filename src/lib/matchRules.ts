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
