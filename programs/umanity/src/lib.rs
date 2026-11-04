//! Umanity (v3): drops.
//!
//! A drop is one real delivery with a date. Its pot holds USDC, and money
//! leaves a pot only two ways:
//!  * `unlock`: the whole pot goes to the drop's payee, fixed when the drop
//!    was created. It needs the release authority's signature, proof posted
//!    on-chain, a finished review window, and the drop's dates not missed.
//!  * refunds: once a drop is cancelled or misses its dates, anyone can send
//!    each backer exactly what they gave (`refund`), and whatever came from
//!    the drops fund goes back to it (`return_to_fund`).
//!
//! Fees: every dollar that lands in the fee inbox is split by `split_fees`,
//! half to the drops fund and half to ops. The split is a constant, not a
//! setting. The drops fund can only pay into pots (`fund_drop`).
//! `sweep_meteora_fees` claims $UMANITY trading fees from Meteora's bonding
//! curve straight into the inbox and splits them in the same instruction;
//! anyone can call it.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

declare_id!("UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3");

/// Meteora Dynamic Bonding Curve (same address on mainnet and devnet).
pub const METEORA_DBC: Pubkey = pubkey!("dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN");
pub const METEORA_DBC_POOL_AUTHORITY: Pubkey = pubkey!("FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM");
/// Anchor discriminator of DBC `claim_trading_fee(max_amount_a, max_amount_b)`.
const DBC_CLAIM_TRADING_FEE: [u8; 8] = [8, 236, 89, 49, 152, 125, 177, 81];

/// Ops' share of every fee. Drops get the rest, including any rounding.
pub const OPS_SHARE_BPS: u64 = 5_000;
/// After a drop's date, a proven drop can still be unlocked for this long.
pub const UNLOCK_GRACE_SECS: i64 = 7 * 24 * 60 * 60;
pub const MAX_DROP_SECS: i64 = 120 * 24 * 60 * 60;
pub const MAX_REVIEW_SECS: i64 = 7 * 24 * 60 * 60;

pub const OPEN: u8 = 0;
pub const PROVEN: u8 = 1;
pub const UNLOCKED: u8 = 2;
pub const CANCELLED: u8 = 3;

#[program]
pub mod umanity {
    use super::*;

    // ------------------------------------------------------------------
    // Setup
    // ------------------------------------------------------------------

    /// One-time setup, signed by the program's upgrade authority so nobody
    /// can claim a fresh deployment first.
    pub fn init_config(
        ctx: Context<InitConfig>,
        release_authority: Pubkey,
        ops: Pubkey,
        max_pot: u64,
        review_secs: i64,
    ) -> Result<()> {
        require!(max_pot > 0, UmanityError::InvalidParams);
        require!((0..=MAX_REVIEW_SECS).contains(&review_secs), UmanityError::InvalidParams);
        let c = &mut ctx.accounts.config;
        c.admin = ctx.accounts.admin.key();
        c.release_authority = release_authority;
        c.release_locked = false;
        c.ops = ops;
        c.usdc_mint = ctx.accounts.usdc_mint.key();
        c.max_pot = max_pot;
        c.review_secs = review_secs;
        c.bump = ctx.bumps.config;
        c.fees_bump = ctx.bumps.fees;
        emit_config(c);
        Ok(())
    }

    pub fn set_admin(ctx: Context<AdminOnly>, admin: Pubkey) -> Result<()> {
        let c = &mut ctx.accounts.config;
        c.admin = admin;
        emit_config(c);
        Ok(())
    }

    pub fn set_params(ctx: Context<AdminOnly>, ops: Pubkey, max_pot: u64, review_secs: i64) -> Result<()> {
        require!(max_pot > 0, UmanityError::InvalidParams);
        require!((0..=MAX_REVIEW_SECS).contains(&review_secs), UmanityError::InvalidParams);
        let c = &mut ctx.accounts.config;
        c.ops = ops;
        c.max_pot = max_pot;
        c.review_secs = review_secs;
        emit_config(c);
        Ok(())
    }

    /// Hands unlock rights to a new key (later: an address NEAR's Chain
    /// Signatures controls). Refused once `lock_release_authority` ran.
    pub fn set_release_authority(ctx: Context<AdminOnly>, release_authority: Pubkey) -> Result<()> {
        let c = &mut ctx.accounts.config;
        require!(!c.release_locked, UmanityError::ReleaseLocked);
        c.release_authority = release_authority;
        emit_config(c);
        Ok(())
    }

    /// One-way: after this, not even the admin can change who unlocks pots.
    pub fn lock_release_authority(ctx: Context<AdminOnly>) -> Result<()> {
        let c = &mut ctx.accounts.config;
        c.release_locked = true;
        emit_config(c);
        Ok(())
    }

    // ------------------------------------------------------------------
    // Drops
    // ------------------------------------------------------------------

    /// `meta_hash` is the sha256 of the drop's public description (place,
    /// shopping list, prices), so the page can prove it was never edited.
    pub fn create_drop(
        ctx: Context<CreateDrop>,
        goal: u64,
        cap: u64,
        deadline: i64,
        payee: Pubkey,
        meta_hash: [u8; 32],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let config = &mut ctx.accounts.config;
        require!(goal > 0 && goal <= cap && cap <= config.max_pot, UmanityError::InvalidParams);
        require!(deadline > now && deadline <= now + MAX_DROP_SECS, UmanityError::InvalidParams);
        require!(payee != Pubkey::default(), UmanityError::InvalidParams);

        let drop = &mut ctx.accounts.drop;
        drop.id = config.drop_count;
        drop.payee = payee;
        drop.goal = goal;
        drop.cap = cap;
        drop.deadline = deadline;
        drop.created_at = now;
        drop.meta_hash = meta_hash;
        drop.state = OPEN;
        drop.bump = ctx.bumps.drop;
        config.drop_count = config.drop_count.checked_add(1).ok_or(UmanityError::MathOverflow)?;

        emit!(DropCreated { drop: drop.key(), id: drop.id, goal, cap, deadline, payee, meta_hash });
        Ok(())
    }

    /// Gives `amount` USDC from the giver's account. `backer` is who gets a
    /// refund if the drop doesn't happen: usually the giver, or the real
    /// person behind a relayed gift (an agent paying over x402, a gift that
    /// arrived from another chain). `payer` covers the record's rent, so a
    /// sponsor can pay it for people with no SOL.
    pub fn give(ctx: Context<Give>, amount: u64, backer: Pubkey, gift_ref: [u8; 16]) -> Result<()> {
        require!(amount > 0, UmanityError::InvalidAmount);
        require!(backer != Pubkey::default(), UmanityError::InvalidParams);
        let now = Clock::get()?.unix_timestamp;
        let drop = &mut ctx.accounts.drop;
        require!(drop.state == OPEN && now < drop.deadline, UmanityError::DropClosed);
        let pot_after = ctx.accounts.pot.amount.checked_add(amount).ok_or(UmanityError::MathOverflow)?;
        require!(pot_after <= drop.cap, UmanityError::PotFull);

        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.source.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.pot.to_account_info(),
                    authority: ctx.accounts.giver.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.usdc_mint.decimals,
        )?;

        let record = &mut ctx.accounts.backer_record;
        if record.backer == Pubkey::default() {
            record.drop = drop.key();
            record.backer = backer;
            record.rent_payer = ctx.accounts.payer.key();
            record.bump = ctx.bumps.backer_record;
        }
        add_gift(drop, record, amount)?;
        emit!(Gave { drop: drop.key(), backer, giver: ctx.accounts.giver.key(), amount, pot_after, gift_ref });
        Ok(())
    }

    /// Opens an empty backer record so a later `give_all` needs no rent.
    pub fn open_backer(ctx: Context<OpenBacker>, backer: Pubkey) -> Result<()> {
        require!(backer != Pubkey::default(), UmanityError::InvalidParams);
        let drop = &ctx.accounts.drop;
        require!(drop.state == OPEN && Clock::get()?.unix_timestamp < drop.deadline, UmanityError::DropClosed);
        let record = &mut ctx.accounts.backer_record;
        record.drop = drop.key();
        record.backer = backer;
        record.rent_payer = ctx.accounts.payer.key();
        record.bump = ctx.bumps.backer_record;
        Ok(())
    }

    /// Gives everything in the source account above `keep`, up to what the
    /// pot has room for. Built for execute-on-arrival flows (Aurora Intents
    /// Connect): the intermediary that received a cross-chain payout calls it
    /// without knowing the exact amount. The backer record must already be
    /// open (`open_backer`), so the intermediary needs no SOL.
    pub fn give_all(ctx: Context<GiveAll>, keep: u64, gift_ref: [u8; 16]) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let drop = &mut ctx.accounts.drop;
        require!(drop.state == OPEN && now < drop.deadline, UmanityError::DropClosed);
        let available = ctx.accounts.source.amount.checked_sub(keep).ok_or(UmanityError::InvalidAmount)?;
        let room = drop.cap.saturating_sub(ctx.accounts.pot.amount);
        let amount = available.min(room);
        require!(amount > 0, UmanityError::InvalidAmount);

        token::transfer_checked(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.source.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.pot.to_account_info(),
                    authority: ctx.accounts.giver.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.usdc_mint.decimals,
        )?;

        let record = &mut ctx.accounts.backer_record;
        add_gift(drop, record, amount)?;
        let pot_after = ctx.accounts.pot.amount.checked_add(amount).ok_or(UmanityError::MathOverflow)?;
        emit!(Gave { drop: drop.key(), backer: record.backer, giver: ctx.accounts.giver.key(), amount, pot_after, gift_ref });
        Ok(())
    }

    /// Moves money the drops fund holds into a pot.
    pub fn fund_drop(ctx: Context<FundDrop>, amount: u64) -> Result<()> {
        require!(amount > 0, UmanityError::InvalidAmount);
        let now = Clock::get()?.unix_timestamp;
        let drop = &mut ctx.accounts.drop;
        require!(drop.state == OPEN && now < drop.deadline, UmanityError::DropClosed);
        let pot_after = ctx.accounts.pot.amount.checked_add(amount).ok_or(UmanityError::MathOverflow)?;
        require!(pot_after <= drop.cap, UmanityError::PotFull);

        let config = &mut ctx.accounts.config;
        let seeds: &[&[u8]] = &[b"config", &[config.bump]];
        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                TransferChecked {
                    from: ctx.accounts.drops_fund.to_account_info(),
                    mint: ctx.accounts.usdc_mint.to_account_info(),
                    to: ctx.accounts.pot.to_account_info(),
                    authority: config.to_account_info(),
                },
                &[seeds],
            ),
            amount,
            ctx.accounts.usdc_mint.decimals,
        )?;

        drop.from_fund = drop.from_fund.checked_add(amount).ok_or(UmanityError::MathOverflow)?;
        config.fund_out = config.fund_out.checked_add(amount).ok_or(UmanityError::MathOverflow)?;
        emit!(FundedDrop { drop: drop.key(), amount, pot_after });
        Ok(())
    }

    /// The field team posts the hash of the proof bundle (video, photos,
    /// receipts). Gifts close and the review window starts. Posting again
    /// replaces the hash and restarts the window.
    pub fn post_proof(ctx: Context<AdminDrop>, proof_hash: [u8; 32]) -> Result<()> {
        require!(proof_hash != [0u8; 32], UmanityError::InvalidParams);
        let now = Clock::get()?.unix_timestamp;
        let drop = &mut ctx.accounts.drop;
        require!(drop.state == OPEN || drop.state == PROVEN, UmanityError::AlreadyFinal);
        require!(now <= drop.deadline, UmanityError::DeadlinePassed);
        drop.state = PROVEN;
        drop.proof_hash = proof_hash;
        drop.proof_at = now;
        emit!(ProofPosted { drop: drop.key(), proof_hash, review_ends: now + ctx.accounts.config.review_secs });
        Ok(())
    }

    /// Pays the whole pot to the drop's payee. `proof_hash` names the proof
    /// this unlock was approved for; if the proof has been replaced since,
    /// the unlock fails, so an approval can never pay out on other proof.
    pub fn unlock(ctx: Context<Unlock>, proof_hash: [u8; 32]) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let drop = &mut ctx.accounts.drop;
        require!(drop.state == PROVEN, UmanityError::NotProven);
        require!(drop.proof_hash == proof_hash, UmanityError::ProofChanged);
        require!(now >= drop.proof_at + ctx.accounts.config.review_secs, UmanityError::InReview);
        require!(now <= drop.deadline + UNLOCK_GRACE_SECS, UmanityError::UnlockWindowClosed);
        let amount = ctx.accounts.pot.amount;
        require!(amount > 0, UmanityError::InvalidAmount);

        pay_from_pot(drop, &ctx.accounts.pot, &ctx.accounts.payee_usdc.to_account_info(), &ctx.accounts.usdc_mint, &ctx.accounts.token_program, amount)?;

        drop.state = UNLOCKED;
        drop.unlocked = amount;
        drop.unlocked_at = now;
        emit!(Unlocked { drop: drop.key(), payee: drop.payee, amount, proof_hash: drop.proof_hash });
        Ok(())
    }

    /// Calls a drop off. Its money can then only go back to backers and the fund.
    pub fn cancel_drop(ctx: Context<AdminDrop>) -> Result<()> {
        let drop = &mut ctx.accounts.drop;
        require!(drop.state == OPEN || drop.state == PROVEN, UmanityError::AlreadyFinal);
        drop.state = CANCELLED;
        drop.cancelled_at = Clock::get()?.unix_timestamp;
        emit!(DropCancelled { drop: drop.key() });
        Ok(())
    }

    /// Sends a backer everything they gave, once refunds are open. Anyone can
    /// call it, and the money can only go to the backer, so Umanity can send
    /// every refund without anyone having to ask.
    pub fn refund(ctx: Context<Refund>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let drop = &mut ctx.accounts.drop;
        require!(refunds_open(drop, now), UmanityError::RefundsNotOpen);
        let amount = ctx.accounts.backer_record.amount;
        require!(amount > 0, UmanityError::NothingToRefund);

        pay_from_pot(drop, &ctx.accounts.pot, &ctx.accounts.backer_usdc.to_account_info(), &ctx.accounts.usdc_mint, &ctx.accounts.token_program, amount)?;

        drop.refunded = drop.refunded.checked_add(amount).ok_or(UmanityError::MathOverflow)?;
        emit!(Refunded { drop: drop.key(), backer: ctx.accounts.backer.key(), amount });
        Ok(())
    }

    /// Once refunds are open, returns everything in the pot that isn't owed
    /// to a backer (fund money, plain transfers) to the drops fund.
    pub fn return_to_fund(ctx: Context<ReturnToFund>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let drop = &mut ctx.accounts.drop;
        require!(refunds_open(drop, now), UmanityError::RefundsNotOpen);
        let owed = drop.given.checked_sub(drop.refunded).ok_or(UmanityError::MathOverflow)?;
        let spare = ctx.accounts.pot.amount.saturating_sub(owed);
        require!(spare > 0, UmanityError::NothingToReturn);

        pay_from_pot(drop, &ctx.accounts.pot, &ctx.accounts.drops_fund.to_account_info(), &ctx.accounts.usdc_mint, &ctx.accounts.token_program, spare)?;

        drop.returned = drop.returned.checked_add(spare).ok_or(UmanityError::MathOverflow)?;
        let config = &mut ctx.accounts.config;
        config.fund_back = config.fund_back.checked_add(spare).ok_or(UmanityError::MathOverflow)?;
        emit!(ReturnedToFund { drop: drop.key(), amount: spare });
        Ok(())
    }

    /// After an unlock nobody can be owed a refund, so the record's rent goes
    /// back to whoever paid it. Anyone can call it.
    pub fn close_backer(ctx: Context<CloseBacker>) -> Result<()> {
        let drop = &ctx.accounts.drop;
        let record = &ctx.accounts.backer_record;
        let done = drop.state == UNLOCKED
            || (record.amount == 0 && refunds_open(drop, Clock::get()?.unix_timestamp));
        require!(done, UmanityError::DropNotFinished);
        Ok(())
    }

    // ------------------------------------------------------------------
    // Fees
    // ------------------------------------------------------------------

    /// Splits whatever USDC is in the fee inbox: half to the drops fund,
    /// half to ops. Anyone can call it.
    pub fn split_fees(ctx: Context<SplitFees>) -> Result<()> {
        let a = ctx.accounts;
        split_inbox(&mut a.config, &a.fees, &mut a.fee_inbox, &a.drops_fund, &a.ops_usdc, &a.usdc_mint, &a.token_program)
    }

    /// Claims $UMANITY trading fees from Meteora into the fee inbox, then
    /// splits them. Our `fees` address is the pool config's fee claimer, so
    /// this program is the only thing that can claim them. Anyone can call it.
    pub fn sweep_meteora_fees(ctx: Context<SweepMeteoraFees>, max_base: u64, max_quote: u64) -> Result<()> {
        let a = ctx.accounts;
        let mut data = Vec::with_capacity(24);
        data.extend_from_slice(&DBC_CLAIM_TRADING_FEE);
        data.extend_from_slice(&max_base.to_le_bytes());
        data.extend_from_slice(&max_quote.to_le_bytes());
        let ix = Instruction {
            program_id: METEORA_DBC,
            accounts: vec![
                AccountMeta::new_readonly(a.dbc_pool_authority.key(), false),
                AccountMeta::new_readonly(a.dbc_config.key(), false),
                AccountMeta::new(a.dbc_pool.key(), false),
                AccountMeta::new(a.fees_base.key(), false),
                AccountMeta::new(a.fee_inbox.key(), false),
                AccountMeta::new(a.base_vault.key(), false),
                AccountMeta::new(a.quote_vault.key(), false),
                AccountMeta::new_readonly(a.base_mint.key(), false),
                AccountMeta::new_readonly(a.usdc_mint.key(), false),
                AccountMeta::new_readonly(a.fees.key(), true),
                AccountMeta::new_readonly(a.token_program.key(), false),
                AccountMeta::new_readonly(a.token_program.key(), false),
                AccountMeta::new_readonly(a.dbc_event_authority.key(), false),
                AccountMeta::new_readonly(a.dbc_program.key(), false),
            ],
            data,
        };
        let before = a.fee_inbox.amount;
        let seeds: &[&[u8]] = &[b"fees", &[a.config.fees_bump]];
        invoke_signed(
            &ix,
            &[
                a.dbc_pool_authority.to_account_info(),
                a.dbc_config.to_account_info(),
                a.dbc_pool.to_account_info(),
                a.fees_base.to_account_info(),
                a.fee_inbox.to_account_info(),
                a.base_vault.to_account_info(),
                a.quote_vault.to_account_info(),
                a.base_mint.to_account_info(),
                a.usdc_mint.to_account_info(),
                a.fees.to_account_info(),
                a.token_program.to_account_info(),
                a.dbc_event_authority.to_account_info(),
                a.dbc_program.to_account_info(),
            ],
            &[seeds],
        )?;
        a.fee_inbox.reload()?;
        let claimed = a.fee_inbox.amount.saturating_sub(before);
        emit!(MeteoraFeesClaimed { pool: a.dbc_pool.key(), quote: claimed });
        split_inbox(&mut a.config, &a.fees, &mut a.fee_inbox, &a.drops_fund, &a.ops_usdc, &a.usdc_mint, &a.token_program)
    }
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

fn emit_config(c: &Config) {
    emit!(ConfigSet {
        admin: c.admin,
        release_authority: c.release_authority,
        release_locked: c.release_locked,
        ops: c.ops,
        max_pot: c.max_pot,
        review_secs: c.review_secs,
    });
}

fn add_gift(drop: &mut Drop, record: &mut Backer, amount: u64) -> Result<()> {
    if record.amount == 0 {
        drop.backers = drop.backers.checked_add(1).ok_or(UmanityError::MathOverflow)?;
    }
    record.amount = record.amount.checked_add(amount).ok_or(UmanityError::MathOverflow)?;
    record.gifts = record.gifts.checked_add(1).ok_or(UmanityError::MathOverflow)?;
    drop.given = drop.given.checked_add(amount).ok_or(UmanityError::MathOverflow)?;
    drop.gifts = drop.gifts.checked_add(1).ok_or(UmanityError::MathOverflow)?;
    Ok(())
}

/// Refunds open when a drop is cancelled, missed its date without proof, or
/// was proven but not unlocked within the grace period after its date.
pub fn refunds_open(drop: &Drop, now: i64) -> bool {
    match drop.state {
        CANCELLED => true,
        OPEN => now > drop.deadline,
        PROVEN => now > drop.deadline + UNLOCK_GRACE_SECS,
        _ => false,
    }
}

fn pay_from_pot<'info>(
    drop: &Account<'info, Drop>,
    pot: &Account<'info, TokenAccount>,
    to: &AccountInfo<'info>,
    mint: &Account<'info, Mint>,
    token_program: &Program<'info, Token>,
    amount: u64,
) -> Result<()> {
    let id = drop.id.to_le_bytes();
    let seeds: &[&[u8]] = &[b"drop", &id, &[drop.bump]];
    token::transfer_checked(
        CpiContext::new_with_signer(
            token_program.to_account_info(),
            TransferChecked {
                from: pot.to_account_info(),
                mint: mint.to_account_info(),
                to: to.clone(),
                authority: drop.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        mint.decimals,
    )
}

fn split_inbox<'info>(
    config: &mut Account<'info, Config>,
    fees: &UncheckedAccount<'info>,
    inbox: &mut Account<'info, TokenAccount>,
    drops_fund: &Account<'info, TokenAccount>,
    ops_usdc: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    let total = inbox.amount;
    require!(total > 0, UmanityError::NothingToSplit);
    let to_ops = ((total as u128) * (OPS_SHARE_BPS as u128) / 10_000) as u64;
    let to_drops = total - to_ops;
    let seeds: &[&[u8]] = &[b"fees", &[config.fees_bump]];
    for (to, amount) in [(drops_fund.to_account_info(), to_drops), (ops_usdc.to_account_info(), to_ops)] {
        if amount == 0 {
            continue;
        }
        token::transfer_checked(
            CpiContext::new_with_signer(
                token_program.to_account_info(),
                TransferChecked { from: inbox.to_account_info(), mint: mint.to_account_info(), to, authority: fees.to_account_info() },
                &[seeds],
            ),
            amount,
            mint.decimals,
        )?;
    }
    inbox.reload()?;
    config.fees_split = config.fees_split.checked_add(total).ok_or(UmanityError::MathOverflow)?;
    config.fund_in = config.fund_in.checked_add(to_drops).ok_or(UmanityError::MathOverflow)?;
    config.ops_out = config.ops_out.checked_add(to_ops).ok_or(UmanityError::MathOverflow)?;
    emit!(FeesSplit { total, to_drops, to_ops });
    Ok(())
}

// ----------------------------------------------------------------------
// Contexts
// ----------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    /// CHECK: PDA with no data. It owns the fee inbox and signs Meteora fee claims.
    #[account(seeds = [b"fees"], bump)]
    pub fees: UncheckedAccount<'info>,
    #[account(init, payer = admin, associated_token::mint = usdc_mint, associated_token::authority = fees)]
    pub fee_inbox: Account<'info, TokenAccount>,
    #[account(init, payer = admin, associated_token::mint = usdc_mint, associated_token::authority = config)]
    pub drops_fund: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()) @ UmanityError::Unauthorized)]
    pub program: Program<'info, crate::program::Umanity>,
    #[account(constraint = program_data.upgrade_authority_address == Some(admin.key()) @ UmanityError::Unauthorized)]
    pub program_data: Account<'info, ProgramData>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin @ UmanityError::Unauthorized)]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateDrop<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin @ UmanityError::Unauthorized, has_one = usdc_mint)]
    pub config: Account<'info, Config>,
    #[account(init, payer = admin, space = 8 + Drop::INIT_SPACE, seeds = [b"drop".as_ref(), config.drop_count.to_le_bytes().as_ref()], bump)]
    pub drop: Account<'info, Drop>,
    #[account(init, payer = admin, associated_token::mint = usdc_mint, associated_token::authority = drop)]
    pub pot: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, backer: Pubkey)]
pub struct Give<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = usdc_mint)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"drop", &drop.id.to_le_bytes()], bump = drop.bump)]
    pub drop: Account<'info, Drop>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = drop)]
    pub pot: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + Backer::INIT_SPACE,
        seeds = [b"backer", drop.key().as_ref(), backer.as_ref()],
        bump
    )]
    pub backer_record: Account<'info, Backer>,
    #[account(mut, token::mint = usdc_mint, token::authority = giver)]
    pub source: Account<'info, TokenAccount>,
    pub giver: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(backer: Pubkey)]
pub struct OpenBacker<'info> {
    #[account(seeds = [b"drop", &drop.id.to_le_bytes()], bump = drop.bump)]
    pub drop: Account<'info, Drop>,
    #[account(
        init,
        payer = payer,
        space = 8 + Backer::INIT_SPACE,
        seeds = [b"backer", drop.key().as_ref(), backer.as_ref()],
        bump
    )]
    pub backer_record: Account<'info, Backer>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GiveAll<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = usdc_mint)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"drop", &drop.id.to_le_bytes()], bump = drop.bump)]
    pub drop: Account<'info, Drop>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = drop)]
    pub pot: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"backer", drop.key().as_ref(), backer_record.backer.as_ref()], bump = backer_record.bump)]
    pub backer_record: Account<'info, Backer>,
    #[account(mut, token::mint = usdc_mint, token::authority = giver)]
    pub source: Account<'info, TokenAccount>,
    pub giver: Signer<'info>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct FundDrop<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin @ UmanityError::Unauthorized, has_one = usdc_mint)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"drop", &drop.id.to_le_bytes()], bump = drop.bump)]
    pub drop: Account<'info, Drop>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = drop)]
    pub pot: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = config)]
    pub drops_fund: Account<'info, TokenAccount>,
    pub admin: Signer<'info>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct AdminDrop<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin @ UmanityError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"drop", &drop.id.to_le_bytes()], bump = drop.bump)]
    pub drop: Account<'info, Drop>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct Unlock<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = release_authority @ UmanityError::Unauthorized, has_one = usdc_mint)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"drop", &drop.id.to_le_bytes()], bump = drop.bump)]
    pub drop: Account<'info, Drop>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = drop)]
    pub pot: Account<'info, TokenAccount>,
    /// CHECK: must be the payee fixed at creation
    #[account(address = drop.payee @ UmanityError::WrongPayee)]
    pub payee: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = payee)]
    pub payee_usdc: Account<'info, TokenAccount>,
    pub release_authority: Signer<'info>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = usdc_mint)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"drop", &drop.id.to_le_bytes()], bump = drop.bump)]
    pub drop: Account<'info, Drop>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = drop)]
    pub pot: Account<'info, TokenAccount>,
    #[account(
        mut,
        close = rent_payer,
        seeds = [b"backer", drop.key().as_ref(), backer.key().as_ref()],
        bump = backer_record.bump,
        has_one = rent_payer
    )]
    pub backer_record: Account<'info, Backer>,
    /// CHECK: the backer the record names (seeds above); refunds can only go to them
    pub backer: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = backer)]
    pub backer_usdc: Account<'info, TokenAccount>,
    /// CHECK: receives the record's rent; must be who paid it (has_one above)
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ReturnToFund<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = usdc_mint)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"drop", &drop.id.to_le_bytes()], bump = drop.bump)]
    pub drop: Account<'info, Drop>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = drop)]
    pub pot: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = config)]
    pub drops_fund: Account<'info, TokenAccount>,
    pub usdc_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CloseBacker<'info> {
    #[account(seeds = [b"drop", &drop.id.to_le_bytes()], bump = drop.bump)]
    pub drop: Account<'info, Drop>,
    #[account(
        mut,
        close = rent_payer,
        seeds = [b"backer", drop.key().as_ref(), backer_record.backer.as_ref()],
        bump = backer_record.bump,
        has_one = rent_payer
    )]
    pub backer_record: Account<'info, Backer>,
    /// CHECK: must be who paid the rent (has_one above)
    #[account(mut)]
    pub rent_payer: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SplitFees<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = usdc_mint, has_one = ops)]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: fee PDA, signs transfers out of the inbox
    #[account(seeds = [b"fees"], bump = config.fees_bump)]
    pub fees: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = fees)]
    pub fee_inbox: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = config)]
    pub drops_fund: Box<Account<'info, TokenAccount>>,
    /// CHECK: config.ops (has_one above)
    pub ops: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = ops)]
    pub ops_usdc: Box<Account<'info, TokenAccount>>,
    pub usdc_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SweepMeteoraFees<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = usdc_mint, has_one = ops)]
    pub config: Box<Account<'info, Config>>,
    /// CHECK: fee PDA, the Meteora config's fee claimer
    #[account(seeds = [b"fees"], bump = config.fees_bump)]
    pub fees: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = fees)]
    pub fee_inbox: Box<Account<'info, TokenAccount>>,
    /// Receives any base-token fees (none when the pool collects fees in USDC).
    #[account(mut, associated_token::mint = base_mint, associated_token::authority = fees)]
    pub fees_base: Box<Account<'info, TokenAccount>>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = config)]
    pub drops_fund: Box<Account<'info, TokenAccount>>,
    /// CHECK: config.ops (has_one above)
    pub ops: UncheckedAccount<'info>,
    #[account(mut, associated_token::mint = usdc_mint, associated_token::authority = ops)]
    pub ops_usdc: Box<Account<'info, TokenAccount>>,
    /// CHECK: Meteora checks it is the pool's config and that `fees` is its fee claimer
    pub dbc_config: UncheckedAccount<'info>,
    /// CHECK: Meteora checks the pool
    #[account(mut)]
    pub dbc_pool: UncheckedAccount<'info>,
    /// CHECK: Meteora checks the vaults belong to the pool
    #[account(mut)]
    pub base_vault: UncheckedAccount<'info>,
    /// CHECK: Meteora checks the vaults belong to the pool
    #[account(mut)]
    pub quote_vault: UncheckedAccount<'info>,
    pub base_mint: Box<Account<'info, Mint>>,
    /// CHECK: fixed address
    #[account(address = METEORA_DBC_POOL_AUTHORITY)]
    pub dbc_pool_authority: UncheckedAccount<'info>,
    /// CHECK: Meteora's event authority PDA
    #[account(seeds = [b"__event_authority"], bump, seeds::program = METEORA_DBC)]
    pub dbc_event_authority: UncheckedAccount<'info>,
    /// CHECK: fixed address
    #[account(address = METEORA_DBC)]
    pub dbc_program: UncheckedAccount<'info>,
    pub usdc_mint: Box<Account<'info, Mint>>,
    pub token_program: Program<'info, Token>,
}

// ----------------------------------------------------------------------
// Accounts
// ----------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub release_authority: Pubkey,
    pub release_locked: bool,
    pub ops: Pubkey,
    pub usdc_mint: Pubkey,
    /// Most a single pot can hold (USDC base units).
    pub max_pot: u64,
    /// Seconds between posting proof and the earliest unlock.
    pub review_secs: i64,
    pub drop_count: u64,
    /// Lifetime totals, so the Money page can check them against the chain.
    pub fees_split: u64,
    pub fund_in: u64,
    pub fund_out: u64,
    pub fund_back: u64,
    pub ops_out: u64,
    pub bump: u8,
    pub fees_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Drop {
    pub id: u64,
    pub payee: Pubkey,
    pub goal: u64,
    pub cap: u64,
    pub deadline: i64,
    pub created_at: i64,
    pub meta_hash: [u8; 32],
    /// 0 open, 1 proven, 2 unlocked, 3 cancelled
    pub state: u8,
    /// Recorded gifts (refundable to their backers).
    pub given: u64,
    pub from_fund: u64,
    pub refunded: u64,
    pub returned: u64,
    pub backers: u32,
    pub gifts: u32,
    pub proof_hash: [u8; 32],
    pub proof_at: i64,
    pub unlocked: u64,
    pub unlocked_at: i64,
    pub cancelled_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Backer {
    pub drop: Pubkey,
    pub backer: Pubkey,
    pub amount: u64,
    pub gifts: u32,
    pub rent_payer: Pubkey,
    pub bump: u8,
}

// ----------------------------------------------------------------------
// Events
// ----------------------------------------------------------------------

#[event]
pub struct ConfigSet {
    pub admin: Pubkey,
    pub release_authority: Pubkey,
    pub release_locked: bool,
    pub ops: Pubkey,
    pub max_pot: u64,
    pub review_secs: i64,
}

#[event]
pub struct DropCreated {
    pub drop: Pubkey,
    pub id: u64,
    pub goal: u64,
    pub cap: u64,
    pub deadline: i64,
    pub payee: Pubkey,
    pub meta_hash: [u8; 32],
}

#[event]
pub struct Gave {
    pub drop: Pubkey,
    pub backer: Pubkey,
    pub giver: Pubkey,
    pub amount: u64,
    pub pot_after: u64,
    pub gift_ref: [u8; 16],
}

#[event]
pub struct FundedDrop {
    pub drop: Pubkey,
    pub amount: u64,
    pub pot_after: u64,
}

#[event]
pub struct ProofPosted {
    pub drop: Pubkey,
    pub proof_hash: [u8; 32],
    pub review_ends: i64,
}

#[event]
pub struct Unlocked {
    pub drop: Pubkey,
    pub payee: Pubkey,
    pub amount: u64,
    pub proof_hash: [u8; 32],
}

#[event]
pub struct DropCancelled {
    pub drop: Pubkey,
}

#[event]
pub struct Refunded {
    pub drop: Pubkey,
    pub backer: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ReturnedToFund {
    pub drop: Pubkey,
    pub amount: u64,
}

#[event]
pub struct FeesSplit {
    pub total: u64,
    pub to_drops: u64,
    pub to_ops: u64,
}

#[event]
pub struct MeteoraFeesClaimed {
    pub pool: Pubkey,
    pub quote: u64,
}

// ----------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------

#[error_code]
pub enum UmanityError {
    #[msg("Not allowed")]
    Unauthorized,
    #[msg("Invalid parameters")]
    InvalidParams,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("This drop is no longer taking gifts")]
    DropClosed,
    #[msg("This pot is full")]
    PotFull,
    #[msg("No proof has been posted")]
    NotProven,
    #[msg("The review window is still open")]
    InReview,
    #[msg("The unlock window has closed")]
    UnlockWindowClosed,
    #[msg("Refunds are not open for this drop")]
    RefundsNotOpen,
    #[msg("Nothing to refund")]
    NothingToRefund,
    #[msg("Nothing to return")]
    NothingToReturn,
    #[msg("The fee inbox is empty")]
    NothingToSplit,
    #[msg("The release authority is locked")]
    ReleaseLocked,
    #[msg("The drop's date has passed")]
    DeadlinePassed,
    #[msg("This drop is already unlocked or cancelled")]
    AlreadyFinal,
    #[msg("Not the drop's payee")]
    WrongPayee,
    #[msg("The drop is not finished")]
    DropNotFinished,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("The drop's proof has changed since this unlock was approved")]
    ProofChanged,
}
