/**
 * Calls the team's admin API (app/api/admin/drops) on a deployed Umanity, signed
 * by an admin key: the signature over `umanity-admin:<unix seconds>` that
 * lib/admin-auth.ts checks against ADMIN_WALLETS.
 *
 *   UMANITY_URL=https://umanity-mainnet.vercel.app ADMIN_KEYPAIR=~/.config/umanity/mainnet/server.json \
 *     npx tsx scripts/admin.ts '{"action":"create","meta":{...},"goalUsd":100,"capUsd":150,"deadline":"…","payee":"…"}'
 *   npx tsx scripts/admin.ts @drop.json      # the body from a file
 */
import fs from 'fs'
import os from 'os'
import bs58 from 'bs58'
import nacl from 'tweetnacl'
import { Keypair } from '@solana/web3.js'
import { ADMIN_MESSAGE_PREFIX } from '@/lib/contracts'

const url = (process.env.UMANITY_URL || 'http://localhost:3000').replace(/\/$/, '')
const keyPath = (process.env.ADMIN_KEYPAIR || '~/.config/umanity/mainnet/server.json').replace(/^~/, os.homedir())
const arg = process.argv[2]
if (!arg) throw new Error('Pass the JSON body, or @file.json')
const body = arg.startsWith('@') ? fs.readFileSync(arg.slice(1), 'utf8') : arg
JSON.parse(body) // fail here, not on the server, if it isn't JSON

const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(keyPath, 'utf8'))))
const message = `${ADMIN_MESSAGE_PREFIX}${Math.floor(Date.now() / 1000)}`
const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), admin.secretKey))

async function main() {
  const res = await fetch(`${url}/api/admin/drops`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-umanity-address': admin.publicKey.toBase58(), 'x-umanity-message': message, 'x-umanity-signature': signature },
    body,
  })
  console.log(res.status, JSON.stringify(await res.json().catch(() => null), null, 2))
  if (!res.ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
