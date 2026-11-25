// Generates a Web Push VAPID key pair and a dispatch secret for ONE environment (staging OR
// production; never share a pair between them). Uses Node's built-in Web Crypto: no dependency.
//
//   node scripts/generate-vapid-keys.mjs <folder-outside-the-repo> <staging|production>
//
// Writes <folder>/food4love-<env>-push-secrets.env containing:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY  -> the Next.js app of that environment (public)
//   VAPID_KEYS_JSON               -> Edge Function secret (PRIVATE)
//   PUSH_DISPATCH_SECRET          -> Edge Function secret AND Vault secret food4love_push_dispatch_secret
// Only the PUBLIC key is printed. The file is never placed inside the repository.

import { webcrypto } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [outDir, env] = process.argv.slice(2)
if (!outDir || !['staging', 'production'].includes(env)) {
  console.error(
    'usage: node scripts/generate-vapid-keys.mjs <folder-outside-the-repo> <staging|production>',
  )
  process.exit(1)
}
const target = path.resolve(outDir)
if (target === repo || target.startsWith(repo + path.sep)) {
  console.error(
    'Refusing: the secrets file must be written OUTSIDE the repository.',
  )
  process.exit(1)
}
const file = path.join(target, `food4love-${env}-push-secrets.env`)
if (fs.existsSync(file)) {
  console.error(
    `Refusing to overwrite ${file}: a new pair would disconnect every subscribed device.`,
  )
  process.exit(1)
}

const { subtle } = webcrypto
const pair = await subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
)
const publicJwk = await subtle.exportKey('jwk', pair.publicKey)
const privateJwk = await subtle.exportKey('jwk', pair.privateKey)
const publicRaw = Buffer.from(
  await subtle.exportKey('raw', pair.publicKey),
).toString('base64url')
const secret = Buffer.from(
  webcrypto.getRandomValues(new Uint8Array(32)),
).toString('hex')

fs.mkdirSync(target, { recursive: true })
fs.writeFileSync(
  file,
  [
    `# Food4Love ${env} Web Push secrets, generated ${new Date().toISOString()}. NEVER COMMIT.`,
    `NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicRaw}`,
    `VAPID_KEYS_JSON=${JSON.stringify({ publicKey: publicJwk, privateKey: privateJwk })}`,
    `PUSH_DISPATCH_SECRET=${secret}`,
    '',
  ].join('\n'),
  { mode: 0o600, flag: 'wx' },
)
console.log(`Wrote ${file}`)
console.log(`Public key (${env}): ${publicRaw}`)
