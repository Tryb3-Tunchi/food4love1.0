// Stands in for src/lib/supabase/server.ts (the cookie-bound client of the browser making the
// request). A test sets globalThis.__f4lCurrentUser to act as that signed-in member, or null
// for a signed-out visitor.
//
// A test can also install globalThis.__f4lFakeSession (see fakeSession in fake-supabase.mjs) to
// exercise routes that sign people in or out, such as password reset.
export async function createClient() {
  if (globalThis.__f4lFakeSession) return globalThis.__f4lFakeSession
  return {
    auth: {
      async getUser() {
        const user = globalThis.__f4lCurrentUser ?? null
        return {
          data: { user },
          error: user ? null : { message: 'no session' },
        }
      },
    },
  }
}
