/**
 * Launches $UMANITY on Meteora's Dynamic Bonding Curve, on the cluster in
 * NEXT_PUBLIC_SOLANA_NETWORK, signed by the authority keypair.
 *
 *   npx tsx scripts/launch-umanity.ts plan [settings]      # prints everything, sends nothing
 *   npx tsx scripts/launch-umanity.ts metadata              # writes public/token/umanity.json
 *   npx tsx scripts/launch-umanity.ts launch --yes [settings]
 *
 * Settings (defaults in brackets): --name [Umanity] --symbol [UMANITY]
 *   --initial-mcap [15000] --migration-mcap [250000] (USDC)
 *   --fee-bps [100] --launch-fee-bps [2500] --launch-fee-secs [60]
 *   --uri [https://umanity.vercel.app/token/umanity.json]
 *   --first-buy [0] (USDC the creator buys in the launch transaction)
 *
 * The DBC config's fee claimer is the Umanity program's `fees` address, so
 * only the program's permissionless `sweep_meteora_fees` can claim trading
 * fees, and it splits every claim 50/50 between drops and ops. The config
 * and mint keypairs are kept in ~/.config/solana (a pre-ground vanity mint
 * there is used as is), so a rerun reuses them instead of launching twice.
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()
import fs from 'fs'
import os from 'os'
import path from 'path'
import { BN } from '@coral-xyz/anchor'
import { Keypair, PublicKey, sendAndConfirmTransaction } from '@solana/web3.js'
import { DynamicBondingCurveClient, deriveDbcPoolAddress } from '@meteora-ag/dynamic-bonding-curve-sdk'
import { getAuthorityKeypair } from '../lib/solana/server-signer'
import { getConnection } from '../lib/solana/chain'
import { SOLANA_CLUSTER } from '../lib/solana/constants'
import { FEES, USDC, fetchConfig } from '../lib/umanity/program'
import { UMANITY_SUPPLY, umanityCurve } from '../lib/token/curve'

const KEYS = process.env.UMANITY_KEYS_DIR || path.join(os.homedir(), '.config/solana')
const SITE = 'https://umanity.vercel.app'

function flag(name: string, fallback: string) {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

function settings() {
  return {
    name: flag('name', 'Umanity'),
    symbol: flag('symbol', 'UMANITY'),
    initialMarketCap: Number(flag('initial-mcap', '15000')),
    migrationMarketCap: Number(flag('migration-mcap', '250000')),
    feeBps: Number(flag('fee-bps', '100')),
    launchFeeBps: Number(flag('launch-fee-bps', '2500')),
    launchFeeSecs: Number(flag('launch-fee-secs', '60')),
    uri: flag('uri', `${SITE}/token/umanity.json`),
    firstBuyUsdc: Number(flag('first-buy', '0')),
  }
}

function keypair(file: string) {
  const p = path.join(KEYS, file)
  if (fs.existsSync(p)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, 'utf8'))))
  const k = Keypair.generate()
  fs.writeFileSync(p, JSON.stringify(Array.from(k.secretKey)), { mode: 0o600 })
  return k
}

const files = () => ({ config: `umanity-dbc-config-${SOLANA_CLUSTER}.json`, mint: `umanity-mint-${SOLANA_CLUSTER}.json` })

function describe(s: ReturnType<typeof settings>, curve: ReturnType<typeof umanityCurve>) {
  const threshold = Number(curve.migrationQuoteThreshold.toString()) / 1e6
  console.log(`$${s.symbol} (${s.name}) on ${SOLANA_CLUSTER}`)
  console.log(`  supply            ${UMANITY_SUPPLY.toLocaleString()} (fixed; no presale, no team tokens, no vesting)`)
  console.log(`  quote             USDC ${USDC.toBase58()}`)
  console.log(`  start             $${s.initialMarketCap.toLocaleString()} market cap ($${(s.initialMarketCap / UMANITY_SUPPLY).toFixed(8)} a token)`)
  console.log(`  graduates at      $${s.migrationMarketCap.toLocaleString()} market cap, after about $${threshold.toLocaleString()} USDC has gone into the curve`)
  console.log(`  then              Meteora DAMM v2 pool, 1% fee, all liquidity locked for good to the program's fees address`)
  console.log(`  trading fee       ${s.feeBps / 100}% in USDC${s.launchFeeBps > s.feeBps ? `, starting at ${s.launchFeeBps / 100}% and falling to ${s.feeBps / 100}% over ${s.launchFeeSecs}s (anti-sniping)` : ''}`)
  console.log(`  fee claimer       ${FEES.toBase58()} (program PDA: 50% drops / 50% ops, after Meteora's protocol share)`)
  console.log(`  creator fee       0%; metadata ${s.uri}`)
  console.log(`  first buy         ${s.firstBuyUsdc ? `$${s.firstBuyUsdc} USDC by the creator, in the launch transaction` : 'none'}`)
}

async function main() {
  const cmd = process.argv[2]
  const s = settings()
  const curve = umanityCurve({ initialMarketCap: s.initialMarketCap, migrationMarketCap: s.migrationMarketCap, feeBps: s.feeBps, launchFeeBps: s.launchFeeBps, launchFeeSecs: s.launchFeeSecs })

  if (cmd === 'metadata') {
    const meta = {
      name: s.name,
      symbol: s.symbol,
      description: 'The token of Umanity, the app where your crypto feeds people, on camera. Trading fees go to the Umanity program, which sends half to drops (filmed deliveries) and half to running Umanity. No team tokens. Not an investment; no returns are promised.',
      image: `${SITE}/logo.png`,
      external_url: SITE,
      extensions: { website: SITE, twitter: 'https://x.com/umanity_xyz' },
    }
    fs.mkdirSync('public/token', { recursive: true })
    fs.writeFileSync('public/token/umanity.json', JSON.stringify(meta, null, 2) + '\n')
    console.log('wrote public/token/umanity.json')
    return
  }

  if (cmd === 'plan') {
    describe(s, curve)
    const f = files()
    for (const [what, file] of Object.entries(f)) {
      const p = path.join(KEYS, file)
      console.log(`  ${what.padEnd(17)} ${fs.existsSync(p) ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, 'utf8')))).publicKey.toBase58() : `(new keypair at ${p})`}`)
    }
    return
  }

  if (cmd !== 'launch') throw new Error('usage: launch-umanity.ts plan | metadata | launch --yes')
  if (!process.argv.includes('--yes')) throw new Error('Launching is public and permanent. Rerun with --yes once the plan is approved.')
  const conn = getConnection()
  const payer = getAuthorityKeypair()
  if (!payer) throw new Error('No authority keypair')
  if (!(await fetchConfig(conn))) throw new Error('Set up the Umanity program on this cluster first, so its fees address can claim from day one')

  describe(s, curve)
  const client = new DynamicBondingCurveClient(conn, 'confirmed')
  const f = files()
  const config = keypair(f.config)
  const mint = keypair(f.mint)
  const pool = deriveDbcPoolAddress(USDC, mint.publicKey, config.publicKey)

  if (!(await conn.getAccountInfo(config.publicKey))) {
    const tx = await client.partner.createConfig({ config: config.publicKey, feeClaimer: FEES, leftoverReceiver: FEES, payer: payer.publicKey, quoteMint: USDC, ...curve })
    const sig = await sendAndConfirmTransaction(conn, tx, [payer, config], { commitment: 'confirmed' })
    console.log(`config  ${config.publicKey.toBase58()}  ${sig}`)
  } else console.log(`config  ${config.publicKey.toBase58()} (exists)`)

  if (!(await conn.getAccountInfo(pool))) {
    const tx = await client.creator.createPoolWithFirstBuy({
      createPoolParam: { baseMint: mint.publicKey, config: config.publicKey, name: s.name, symbol: s.symbol, uri: s.uri, payer: payer.publicKey, poolCreator: payer.publicKey },
      firstBuyParam: s.firstBuyUsdc > 0 ? { buyer: payer.publicKey, buyAmount: new BN(Math.round(s.firstBuyUsdc * 1e6)), minimumAmountOut: new BN(1), referralTokenAccount: null } : undefined,
    })
    const sig = await sendAndConfirmTransaction(conn, tx, [payer, mint], { commitment: 'confirmed' })
    console.log(`pool    ${pool.toBase58()}  ${sig}`)
  } else console.log(`pool    ${pool.toBase58()} (exists)`)

  console.log('\nAdd to the app environment:')
  console.log(`NEXT_PUBLIC_UMANITY_MINT=${mint.publicKey.toBase58()}`)
  console.log(`UMANITY_DBC_POOL=${pool.toBase58()}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
