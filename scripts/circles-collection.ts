/**
 * Creates the Circles collection ("The Hundred") once per cluster, with a royalty on every resale
 * paid to the giving fund's royalty wallet, and a collection-wide freeze that locks every Circle
 * until the first filmed drop pays out. The server's authority key becomes the collection's
 * update authority (it signs each mint); the treasury pays the rent.
 *
 *   NEXT_PUBLIC_SOLANA_NETWORK=devnet npx tsx scripts/circles-collection.ts --royalty <address> [--owner <address>] [--bps 500]
 *
 * --owner makes another wallet (the founder's) the collection's update authority, so it can claim the
 * collection's marketplace pages; the server then mints as the collection's update delegate.
 *
 * Then set NEXT_PUBLIC_CIRCLES_COLLECTION to the printed address.
 */
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { createCollection, mplCore, ruleSet } from '@metaplex-foundation/mpl-core'
import { createSignerFromKeypair, generateSigner, publicKey, signerIdentity } from '@metaplex-foundation/umi'
import { fromWeb3JsKeypair } from '@metaplex-foundation/umi-web3js-adapters'
import { getAuthorityKeypair, getTreasuryKeypair } from '../lib/solana/server-signer'
import { getConnection } from '../lib/solana/chain'
import { SOLANA_CLUSTER } from '../lib/solana/constants'

const flag = (k: string, d?: string) => {
  const i = process.argv.indexOf(k)
  return i >= 0 ? process.argv[i + 1] : d
}

async function main() {
  const royalty = flag('--royalty')
  const ownerFlag = flag('--owner')
  const bps = Number(flag('--bps', '500'))
  if (!royalty) throw new Error('Pass --royalty <wallet that receives resale royalties>')
  const authority = getAuthorityKeypair()
  const payer = getTreasuryKeypair()
  if (!authority || !payer) throw new Error('No authority or treasury key on this machine')
  const app = process.env.NEXT_PUBLIC_APP_URL || 'https://umanity.gives'
  const umi = createUmi(getConnection().rpcEndpoint).use(mplCore())
  umi.use(signerIdentity(createSignerFromKeypair(umi, fromWeb3JsKeypair(payer))))
  const collection = generateSigner(umi)
  const server = publicKey(authority.publicKey.toBase58())
  const owner = ownerFlag ? publicKey(ownerFlag) : server
  console.log(`cluster ${SOLANA_CLUSTER}, owner ${owner}, server ${server}, payer ${payer.publicKey.toBase58()}, royalty ${bps / 100}% to ${royalty}`)
  await createCollection(umi, {
    collection,
    name: 'The Hundred',
    uri: `${app}/api/circles/collection`,
    updateAuthority: owner,
    plugins: [
      { type: 'Royalties', basisPoints: bps, creators: [{ address: publicKey(royalty), percentage: 100 }], ruleSet: ruleSet('None') },
      // One switch for the whole collection: every Circle is minted locked, and one update thaws them all
      // once the first filmed drop pays out. It can only be added now, when the collection is created.
      { type: 'PermanentFreezeDelegate', frozen: true, authority: { type: 'Address', address: server } },
      // When another wallet owns the collection, the server mints as its update delegate (checked on devnet).
      ...(owner === server ? [] : [{ type: 'UpdateDelegate' as const, additionalDelegates: [], authority: { type: 'Address' as const, address: server } }]),
    ],
  }).sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } })
  console.log(`NEXT_PUBLIC_CIRCLES_COLLECTION=${collection.publicKey}`)
}

main().catch((e) => {
  console.error((e as Error).message)
  process.exit(1)
})
