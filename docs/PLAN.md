# Umanity: the plan

Written 9 Nov 2026, the day Umanity went live on Solana mainnet. It decides everything once, so that nothing
has to be invented or reversed after launch: who runs drops, how the money reaches them, what gets filmed,
what $UMANITY is for, and the rules that never change.

**Umanity in one line:** crypto that feeds people, on camera. Every dollar waits in a pot for one real
delivery, pays out only when the delivery is filmed and checked, and goes back to its giver by code if not.

---

## 1. The rules that never change

These are promises to every giver, trader and runner. They are in the program or will be, and the app must
never contradict them.

1. **Gifts go 100% to drops.** Umanity takes nothing from a gift.
2. **Every fee is split 50/50 by the program**: half to drops, half to running Umanity. That covers swap
   fees, $UMANITY trading fees, and any fee added later.
3. **A pot pays only its drop's payee, only after filmed proof and a review window.** Otherwise refunds open,
   and each refund can only go back to the wallet that gave.
4. **The drops fund can only pay into pots.** Fee money never pays a person directly.
5. **$UMANITY has a fixed supply, no team allocation and no promise of returns.** The team never pays
   holders, never buys back tokens to lift the price, and never pays for fake volume.
6. **Every dollar is public.** If a dollar moves, it shows on Money with its transaction.

---

## 2. The flywheel

```
   people give ─────────────────────────────100%──────────────┐
   (one tap · any chain · AI agents)                          ▼
                                                         drop pots ──► runner buys, delivers, films
   people trade $UMANITY or swap in Umanity                   ▲                 │
        │ fees                                                │                 ▼
        ▼                                            drops fund ◄── proof checked (AI + council), pot pays out
   the program ──50%──► drops fund ──────────────────────────┘                 │
        └─────50%──► ops (filming, runner support, the app)                   ▼
                                                                  the film goes out on X
   runners bond $UMANITY to run a drop  ◄──────────────────────── more people see it, give and trade
   holders lock $UMANITY to choose which drop the fund fills next
```

**Why it turns:** every delivery is a film, and every film brings people. People give, which fills pots, and
trade, which makes fees, and half of every fee fills more pots. More pots means more deliveries and more
films. $UMANITY is in the loop three times: its trading fees feed drops, runners put it up as their promise,
and holders use it to steer where fee money goes.

**What's live today (9 Nov):**
- Gifts three ways.
- Swap and $UMANITY fees split by the program, and the keeper pouring the drops fund into Umanity's own drops
  first. The first $13.49 of fees is already in Drop #1.
- **Community drops**: anyone can propose one at /start. The team reviews it, and the runner is paid only
  after proof.

Holder votes and two-step payouts come next (section 8).

---

## 3. What $UMANITY is for

Three jobs, all real, none of them a payout:

| Job | How it works | Status |
| --- | --- | --- |
| **Fees feed drops** | Its pool's 1% trading fee can only be claimed by the program, which sends half to the drops fund. | Live |
| **Run a drop** | A runner puts up a bond in $UMANITY, worth 20% of the drop's goal, when the drop opens. A delivered drop returns the bond. A drop that's vetoed or abandoned loses it, and the slashed bond goes to the drops fund. | Next |
| **Steer the fund** (chosen first) | Umanity's own drops are filled first. Beyond them, holders vote with $UMANITY on which community drop the drops fund fills next. A vote is weighted by the amount held. It starts as signed messages read by the keeper, and moves on-chain later. | Next |

Bonds and votes give the token a reason to be bought and held that comes from using Umanity: more drops
means more bonds. It is never a share of revenue.

**Not doing:** paying holders, buying back or burning tokens, staking rewards, or promising a price. Each of
those turns a utility token into something people will treat as an investment, and fee money belongs to
drops anyway.

---

## 4. Who creates drops

**Umanity's own drops come first.** The team runs them and films them, so they lead everywhere: the Give
button, the Home hero, and the drops fund's fee pours. Open **umanity.gives/admin** with a team wallet and fill
in the place, story, shopping list, goal, cap, date and payee. The server writes the drop on Solana, with its
description fingerprinted, and opens the pot.

**Community drops are live (9 Nov).** Anyone signed in can propose one at **umanity.gives/start**.
1. The proposal stays off-chain until the team approves it in /admin.
2. The server then opens it with the runner's wallet as payee.
3. The runner sends proof from /start, and the team checks it and posts it on-chain.
4. Community drops have their own section and badge.
5. Fees work exactly as for Umanity's drops: gifts 100% to the pot, fees split 50/50.

**Next: runners, anywhere.** A runner is a person or group that can buy and hand over goods where they live,
such as a shelter in Nairobi, a community kitchen in Karachi, or a volunteer in Gaza or Lagos. Most people
will only give; runners are the supply side, and they are how Umanity goes global.

1. **Apply:** profile, place, X or Instagram, and a short video of where they work.
2. **Propose a drop:** shopping list with local prices, who it helps, place and date. An AI check compares
   the prices with the local norm and flags anything missing.
3. **Approval:** the team approves runners and their first drop. Once holder votes are live, holders can
   approve experienced runners' drops.
4. **Bond:** 20% of the goal, in $UMANITY.
5. **Fill:** gifts, plus fee pours from the drops fund.
6. **Deliver and film** (section 6), then upload the proof.
7. **Check and pay:** the AI check runs in a sealed machine, then the council's review window, then the pot
   pays the runner's wallet. The bond comes back.
8. **Reputation:** delivered drops build a runner's record. A strong record lowers their bond and raises
   their cap.

**Already possible in the program:** a drop can pay any wallet, so the team can open a drop for a runner
today. What the runner flow adds: an application page, a runner console that can post proof only for the
runner's own drops, and bonds.

---

## 5. Money before the delivery

A pot pays out after the proof. That means a runner has to buy the goods first, with their own money.

- **Phase 1 (now):** Umanity runs the drops and covers the shopping itself. The pot pays it back after the
  proof. This works for small drops, around $150–$1,000.
- **Phase 2: two-step payouts**, in the next program upgrade.
  - **The money:**
    - `unlock_part(proof_hash)` releases up to 50% of what's in the pot on a *purchase proof*: the shop's
      receipt, plus photos of the goods with the drop's number on a card. The proof goes through the same AI
      check and council window.
    - `unlock` releases the rest on the *delivery proof*.
  - **If the delivery never comes:** refunds become pro-rata. Each backer gets back their share of what is
    still in the pot, so a late refunder is never left with nothing. The runner's bond is slashed into the
    pot first, to make backers whole.
  - **Why it isn't rushed:** it changes how the program pays out and refunds real money. It ships after
    tests and a review, with about 2.3 SOL of temporary rent for the upgrade, which comes back when the
    upgrade lands.
- **Never:** paying a runner before any proof at all.

---

## 6. The films

The film is the proof and the marketing at once, so it has a standard.

**Every drop films:**
1. The receipt and the goods at the shop, with the drop's number on a card.
2. The handover, with the place recognisable.
3. One sentence from the runner: what was delivered, where, and how many people it helped.

**Consent:** ask before filming anyone. Never show children's faces, and film hands, goods and places
instead. Never film anyone who says no. This follows UNICEF's norms and Pakistan's PECA s.24.

**Pipeline:**
1. The runner uploads to their console.
2. The files are hashed and the proof bundle's fingerprint goes on Solana.
3. The AI compares photos and receipts with the promise.
4. The council has its window.
5. The pot pays.
6. Umanity posts the film on X with the drop's page and transactions.
7. Givers get a notification: "Your gift was delivered: watch it."

**Automation:** the hashing, the AI check, the council window and the payout are automatic once the NEAR
guard holds the unlock key. A post is drafted automatically from the proof; a person approves it.

---

## 7. Reasons to come back

- **Follow your gift:** a ticket per gift, which turns into "delivered, watch the film".
- **Round-ups:** "round my swaps up to the next dollar". The change goes into the next drop.
- **Every week:** give $X to the next drop each week, through an SPL delegate the giver can revoke anytime.
- **Streaks and Guardian points**, already live, for giving often.
- **$UMANITY**: the live chart, and votes on the next drop.
- **The feed:** every gift, film, payout and fee pour, live.

---

## 8. Order

| When | What |
| --- | --- |
| **Live (9 Nov)** | Umanity's drops first, community drops (/start, reviewed by the team), gifts three ways, fees split by the program and poured into the next drop, $UMANITY trading, Money page, NEAR guard on NEAR mainnet |
| **Weeks 1–2 after the hackathons** | Turn on the NEAR guard and lock the unlock key · runner applications and the proof console · round-ups · auto-drafted film posts · holder votes (off-chain signatures first) |
| **Month 1–2** | Program upgrade: runner bonds in $UMANITY, two-step payouts, weekly gifts · upgrade key to a multisig · runners in three countries |
| **Later** | On-chain holder votes · runner reputation that lowers bonds · partner organisations as runners where fundraising needs registration |

---

## 9. Weak today, and the fix

| Weak spot | Fix |
| --- | --- |
| $UMANITY's only job is fees | Bonds and votes (sections 3, 8) |
| Only the team creates drops, only in Lahore | Runners (section 4) |
| Runners must front the money | Two-step payouts (section 5) |
| Umanity's key signs unlocks and upgrades | NEAR guard on, unlock key locked; upgrade key to a multisig |
| Few users yet | A film for every delivery, the X launch, round-ups, weekly gifts |
| Free RPC tier | Paid Helius before marketing pushes |
| Ops half of fees | Every spend listed on Money with its receipt |
| Fundraising rules in some places | Registered organisations can run drops there |

---

## 10. Not doing

- **Earning yield on gifts.** Givers' money stays a plain USDC pot. Putting it in a lending market adds risk
  to money that isn't ours. The drops fund might earn low-risk yield later, with the yield going to drops,
  and only once that's said publicly first.
- **Paid volume, buybacks, holder payouts.**
- **Fees on gifts**, ever.
