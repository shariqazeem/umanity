# Umanity: the polish plan

Written 8 Nov 2026, the day the founder asked for a mainnet-only, finished product. The reference every screen is built and checked against, so the whole app feels like one product.

## What was asked
1. "complete the build, make sure everything u implement is in its best state, focus on each detail"
2. "we are only aiming for mainnet, no demo/mock, or devnet"
3. "make sure everything aligns with each other"
4. "i would love the built in wallet tho as u said for mainnet"
5. "without changing the design/look of umanity"
6. "apply the /polish skill too to make ui/ux exceptional"

## What stays
- **The look the founder loves**, restored from umanity-social: Inter; the #f5f5f7 page; white cards with a hairline border; near-black #1d1d1f text and buttons; grey #86868b secondary text; emerald (#10b981 / #059669) as the one accent; 12–24 px radii; pills; soft skeletons.
- **The structure:** five places, Home · Trade · Give · Money · Me. On phones a header, the live ticker and a bottom bar with the black circle in the middle; on desktop the left nav, the centre column and the right rail.
- **The black circle**, the give button. It is Umanity's signature.
- **The landing line** "Crypto giving ~~on trust.~~ On camera." and its two buttons.
- **Home:** the next drop with its circle, the live ticker, and the feed with its filters (For you, Deliveries, Gifts, Money) and its cards (gift, proof, unlocked, missed date, fee split, post).
- **The drop page:** pot meter, four steps with transactions, the shopping list, proof checked against its hash, backers, the rules, and the on-chain table.
- **Money** (every dollar traced), **Trade** (Jupiter swaps, the fee to drops, the $UMANITY card), **Me** (the Living Guardian card, the orb, drops backed, receipts, posts), **For agents** (the x402 console, MCP), the **team console**.
- **Flows:** the give sheet with presets in real units, any-chain gifts with Aurora, x402 gifts, sponsored fees (nobody needs SOL), refunds by code.
- **Honesty:** "not a registered charity", no tax or profit claims, real numbers or none.

## First look (8 Nov, live site, phone 390×844 and desktop 1440×900)
- **Phone, first ten seconds:** sees a faded headline appearing, understands "crypto giving, on camera", can tap Open the app, and stops at a four-line paragraph. No drop is on the first screen.
- **Home on a phone:** the next drop leads, with five lines of text around its meter and the big circle. Then a feed whose first card asks to sign in, though the header already has Sign in.
- **Desktop:** the same parts in three columns. The right rail repeats the Money numbers. Every edge lines up, and nothing feels like a different app.
- **What felt wrong:**
  - **Every page fades in from nothing**, on every tap, and stays half-faded in a background tab.
  - **Devnet everywhere:** the "Devnet" pill, "Live on Solana Devnet", the faucet, a demo drop.
  - **v2.1 words survive:** Me promises votes and certificates; neither exists.
  - **Explaining instead of working:** the landing describes a drop in cards ("01 Fill, 02 Pot…") instead of showing the real one.
  - **Give repeats Home** with the same card.
  - **Emoji bullets** on the drop page's rules look generated.
  - **The wallet keeps its key in plain browser storage.** Fine for devnet, not for real money.

## The hero and the north star
- **Hero:** a real delivery's pot, filling toward a filmed handover, with the black circle to fill it and the delivery video once it's done.
- **North star:** "Open Umanity and you see the next real delivery filling: what it buys, where it goes, how close it is. One tap on the black circle puts your dollars in its pot, in your name, held by the program until the delivery is filmed. Within ten seconds you understand your money only moves on camera, and you want to fill the pot."
- **Next-generation ideas:**
  1. **Your gift is a ticket that follows itself.** After giving you hold a ticket that moves Filling → Filmed → Delivered, with the video, or → Refunded. It lives in Me and in the feed.
  2. **Proof is the content.** When a drop is delivered, its video leads its page and the feed.
  3. **Face ID to give.** The built-in wallet unlocks with a passkey, so giving feels like Apple Pay and the key never sits in plain text.

## Causes
- **Faded pages:** `AppShell` wraps every page in `.entrance-reveal` (opacity 0 → 1, fill `both`), so content is invisible until the animation runs; it re-runs on each navigation and pauses in background tabs. The feed staggers from opacity 0 too → no page-level fade; motion only on transform, with the final state as the default.
- **Devnet labels and demo:** the app runs on devnet → mainnet config, and devnet-only UI that never shows on mainnet.
- **v2.1 promises in Me:** leftover strings in `ProfileView` and the Guardian perks → rewritten to what v3 does.
- **Plain-text wallet:** `lib/client/wallet.ts` stores the secret key as JSON → an encrypted vault (passkey PRF, or a passcode), unlocked only when something must be signed, kept in memory for the session.

## Screens
| Screen | Its one job | Hero in 10 s? | Words that go | Works instead | Noise | Phone vs desktop |
| --- | --- | --- | --- | --- | --- | --- |
| Landing | Make a stranger want to fill a drop | No drop on screen | The 4-line paragraph | The live next drop, with its meter and circle | Explainer cards → folded | Same order; desktop puts the drop beside the line |
| Home | Fill the next drop, see what happened | Yes, the circle | Two of the five lines around the meter | The meter and units say it | Feed's sign-in card when the header has it | Same; rail on desktop |
| Drop page | Prove where this money goes | Partly | Rule paragraphs | Rules as pills that open | Emoji bullets | Same |
| Give sheet | Give in one decision | Yes | — | Units preview | — | Sheet on both |
| Give tab | Pick where to give | Repeats Home | Repeated card | Every open drop, next one first | — | Grid on desktop |
| Trade | Swap, see the fee feed drops | Fee line | Phantom comparison | Live "your fee → drops" | — | Same |
| Money | Trace every dollar | Yes | — | — | — | Same |
| Me | My gifts and what they became | No | "votes", "certificates" | Gift tickets | — | Same |
| Agents | Let an agent give | Yes, the console | — | — | — | Same |
| Wallet sheet | Balance, address, backup | — | — | Face ID unlock for backup | — | Sheet |

## Passes

### P1. The first ten seconds
- No page-level fade: pages arrive rendered. Feed and lists keep a light rise (transform only), so nothing is ever invisible.
- The landing leads with the live next drop (real data: title, meter, units, the circle) under the line and two buttons. The paragraph goes. The explainer cards fold into one row of pills that open.
- The Home next-drop card keeps title, meter and circle, plus one line of what it buys. The disclaimer moves into the meter's line.
- The feed's sign-in card goes when the header already says Sign in; guests see the feed.
- **Checked:** phone and desktop screenshots, signed out, in a fresh tab and a background tab.
- **Done when:** a phone screenshot taken one second after load shows the drop, its meter and the circle at full opacity.

### P2. Face ID to give: the built-in wallet for mainnet
- Create → "Protect it with Face ID" (passkey with the PRF extension), or a passcode of 8+ characters where passkeys can't. No plain-text key is stored, ever.
- The key is decrypted only to sign: the first action in a session asks for Face ID, then the wallet stays unlocked in memory until idle for 15 minutes or the page reloads.
- Existing plain-text wallets are protected on their next action, and the plain copy is deleted.
- Backup reveals the key only after Face ID or the passcode.
- **Checked:** create, give, reload, give again (one prompt), backup, import, forget; passkey cancelled; wrong passcode.
- **Done when:** localStorage holds only ciphertext and the address, and every signing path works.

### P3. The core flow: give, then hold your ticket
- The give sheet stays one decision. After giving, the done screen becomes the gift ticket: drop, amount in units, state, transaction.
- Me shows your tickets, newest first, each moving with its drop's state.
- **Done when:** a gift appears as a ticket in Me that changes when its drop changes.

### P4. Every other screen
- **Drop page:** rules become five pills (In the pot · Pays on proof · Refund by date · 100% to the drop · Not a charity) that open their sentence; no emoji bullets.
- **Give tab:** every open drop, the next one first; delivered drops below with their video.
- **Me:** v3 words only; the Guardian perks are only real ones.
- **Trade:** one line of copy; the fee line says what your swap sends to drops.
- **Done when:** no screen describes something it could show, and no v2.1 word remains.

### P5. Mainnet alignment
- Every label, link and copy line reads right on mainnet: no "Devnet" pill, no faucet, no demo drop, explorer links without a cluster parameter.
- Config checked for mainnet: RPC, USDC mint, x402 facilitator, Jupiter, Aurora.
- **Done when:** the app built with the mainnet config shows no devnet word anywhere.

### P6. States and details
- Loading skeletons shaped like content; empty states that invite the first action; errors that say what to do.
- Craft checklist: tabular figures, 44 px targets, visible focus, Escape closes sheets, reduced motion respected, zero console errors.
- **Done when:** every screen passes the checklist on phone and desktop.

## Order
| Pass | Target |
| --- | --- |
| P1 First ten seconds | 8 Nov |
| P2 Face ID wallet | 8 Nov |
| P3 Gift tickets | 9 Nov |
| P4 Other screens | 9 Nov |
| P5 Mainnet alignment | 9 Nov |
| P6 States and details | 10 Nov |

**Status:** plan written; P1 starts now.
