// Stands in for src/lib/supabase/server.ts (the cookie-bound client of the browser making the
// request). A test sets globalThis.__f4lCurrentUser to act as that signed-in member, or null
// for a signed-out visitor.
export async function createClient() {
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
