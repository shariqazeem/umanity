//! Umanity donations program (v2).
//!
//! Escrowed cause vaults, milestone-governed releases, PDA donation records
//! (no extra signers, so Blinks and cross-chain "execute on arrival" work),
//! staked Impact Dares, and on-chain AI Impact Oracle attestations.
//!
//! v2 changes vs v1:
//!  * `donate`: DonationRecord is a PDA ([b"donation", pool, donor, nonce]) —
//!    no throwaway keypair signer required.
//!  * vault debits now use CPI transfers signed by the vault PDA (v1 debited a
//!    system-owned PDA directly, which the runtime rejects).
//!  * staked dares: create / boost / settle (pot always ends in the cause vault).
//!  * `attest_milestone`: oracle writes an attestation hash + confidence on-chain.
//!  * `one_tap_donate` is 0.01 SOL as the UI always said.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("9JBsHFy9rQhjcPiKkFzqxpUV9HZyZ1ZmE4AWXc1Kiys1");

/// Protocol treasury (receives the 1.5% dare settlement fee).
pub const PROTOCOL_TREASURY: Pubkey = pubkey!("BAScBKuDXCqdHxcoqdaDrUyJtFVtjBM5wS8tLd6tsgpy");
pub const DARE_FEE_BPS: u64 = 150;
pub const ONE_TAP_LAMPORTS: u64 = 10_000_000; // 0.01 SOL
pub const MIN_DARE_DURATION: i64 = 60 * 10; // 10 minutes
pub const MAX_DARE_DURATION: i64 = 60 * 60 * 24 * 30; // 30 days

#[program]
pub mod umanity_donations {
    use super::*;

    // ------------------------------------------------------------------
    // Pools
    // ------------------------------------------------------------------

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        name: String,
        description: String,
        emoji: String,
        pool_type: u8,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.authority = ctx.accounts.authority.key();
        pool.name = name;
        pool.description = description;
        pool.emoji = emoji;
        pool.pool_type = pool_type;
        pool.total_donated = 0;
        pool.donor_count = 0;
        pool.is_active = true;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    /// v1-compatible: one-tap 0.01 SOL with a keypair-signed record.
    pub fn one_tap_donate(ctx: Context<OneTapDonate>) -> Result<()> {
        let amount = ONE_TAP_LAMPORTS;
        transfer_in(&ctx.accounts.donor, &ctx.accounts.pool_vault, &ctx.accounts.system_program, amount)?;
        let pool = &mut ctx.accounts.pool;
        require!(pool.is_active, ErrorCode::PoolInactive);
        pool.total_donated = pool.total_donated.checked_add(amount).unwrap();
        pool.donor_count = pool.donor_count.checked_add(1).unwrap();
        fill_record(&mut ctx.accounts.donation_record, ctx.accounts.donor.key(), pool.key(), amount, 0)?;
        emit!(DonationMade { donor: ctx.accounts.donor.key(), pool: pool.key(), amount, donation_type: 0 });
        Ok(())
    }

    /// v1-compatible: custom amount with a keypair-signed record.
    pub fn donate_to_pool(ctx: Context<DonateToPool>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        transfer_in(&ctx.accounts.donor, &ctx.accounts.pool_vault, &ctx.accounts.system_program, amount)?;
        let pool = &mut ctx.accounts.pool;
        require!(pool.is_active, ErrorCode::PoolInactive);
        pool.total_donated = pool.total_donated.checked_add(amount).unwrap();
        pool.donor_count = pool.donor_count.checked_add(1).unwrap();
        fill_record(&mut ctx.accounts.donation_record, ctx.accounts.donor.key(), pool.key(), amount, 1)?;
        emit!(DonationMade { donor: ctx.accounts.donor.key(), pool: pool.key(), amount, donation_type: 1 });
        Ok(())
    }

    /// v2: donation with a PDA record. `nonce` is any unique u64 per (pool, donor)
    /// (clients use a timestamp). No extra signer, so this instruction can be
    /// executed by Blinks, by an Aurora Intents Connect intermediary, or by any
    /// program via CPI.
    pub fn donate(ctx: Context<Donate>, amount: u64, _nonce: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        transfer_in(&ctx.accounts.donor, &ctx.accounts.pool_vault, &ctx.accounts.system_program, amount)?;
        let pool = &mut ctx.accounts.pool;
        require!(pool.is_active, ErrorCode::PoolInactive);
        pool.total_donated = pool.total_donated.checked_add(amount).unwrap();
        pool.donor_count = pool.donor_count.checked_add(1).unwrap();
        fill_record(&mut ctx.accounts.donation_record, ctx.accounts.donor.key(), pool.key(), amount, 3)?;
        if let Some(campaign) = ctx.accounts.campaign.as_mut() {
            if campaign.pool == pool.key() && campaign.is_active {
                campaign.total_raised = campaign.total_raised.checked_add(amount).unwrap();
                campaign.donor_count = campaign.donor_count.checked_add(1).unwrap();
            }
        }
        emit!(DonationMade { donor: ctx.accounts.donor.key(), pool: pool.key(), amount, donation_type: 3 });
        Ok(())
    }

    /// Admin withdrawal (kept for emergencies; governance path is release_milestone_funds).
    pub fn withdraw_from_pool(ctx: Context<WithdrawFromPool>, amount: u64, _recipient: Pubkey) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let pool_key = ctx.accounts.pool.key();
        let seeds: &[&[u8]] = &[b"vault", pool_key.as_ref(), &[ctx.bumps.pool_vault]];
        transfer_out(&ctx.accounts.pool_vault, &ctx.accounts.recipient, &ctx.accounts.system_program, amount, seeds)?;
        emit!(PoolWithdrawal { pool: pool_key, recipient: ctx.accounts.recipient.key(), amount });
        Ok(())
    }

    // ------------------------------------------------------------------
    // Campaigns & milestones (escrow overlay)
    // ------------------------------------------------------------------

    pub fn create_campaign(
        ctx: Context<CreateCampaign>,
        recipient: Pubkey,
        target_amount: u64,
        deadline: i64,
        milestone_descriptions: Vec<String>,
        milestone_percentages: Vec<u8>,
    ) -> Result<()> {
        let milestone_count = milestone_descriptions.len() as u8;
        require!(milestone_count > 0 && milestone_count <= 5, ErrorCode::InvalidMilestoneCount);
        require!(milestone_descriptions.len() == milestone_percentages.len(), ErrorCode::InvalidMilestoneCount);
        let total_pct: u16 = milestone_percentages.iter().map(|p| *p as u16).sum();
        require!(total_pct == 100, ErrorCode::InvalidPercentages);

        let campaign = &mut ctx.accounts.campaign;
        campaign.pool = ctx.accounts.pool.key();
        campaign.authority = ctx.accounts.authority.key();
        campaign.recipient = recipient;
        campaign.target_amount = target_amount;
        // Start from what the pool already holds so existing donors count.
        campaign.total_raised = ctx.accounts.pool.total_donated;
        campaign.donor_count = ctx.accounts.pool.donor_count;
        campaign.milestone_count = milestone_count;
        campaign.milestones_completed = 0;
        campaign.deadline = deadline;
        campaign.is_active = true;
        campaign.bump = ctx.bumps.campaign;

        emit!(CampaignCreated { campaign: campaign.key(), pool: ctx.accounts.pool.key(), target_amount, milestone_count });
        Ok(())
    }

    pub fn init_milestone(ctx: Context<InitMilestone>, index: u8, description: String, percentage: u8) -> Result<()> {
        require!(description.len() <= 100, ErrorCode::DescriptionTooLong);
        let milestone = &mut ctx.accounts.milestone;
        milestone.campaign = ctx.accounts.campaign.key();
        milestone.index = index;
        milestone.description = description;
        milestone.percentage = percentage;
        milestone.status = 0;
        milestone.approved_at = 0;
        milestone.released_at = 0;
        milestone.amount_released = 0;
        milestone.attestation_hash = [0u8; 32];
        milestone.attestation_confidence = 0;
        milestone.attested_at = 0;
        milestone.bump = ctx.bumps.milestone;
        Ok(())
    }

    /// AI Impact Oracle writes its verdict on-chain (hash of the signed audit JSON).
    pub fn attest_milestone(ctx: Context<AttestMilestone>, attestation_hash: [u8; 32], confidence: u8) -> Result<()> {
        require!(confidence <= 100, ErrorCode::InvalidConfidence);
        let milestone = &mut ctx.accounts.milestone;
        milestone.attestation_hash = attestation_hash;
        milestone.attestation_confidence = confidence;
        milestone.attested_at = Clock::get()?.unix_timestamp;
        emit!(MilestoneAttested { campaign: ctx.accounts.campaign.key(), milestone_index: milestone.index, attestation_hash, confidence });
        Ok(())
    }

    pub fn approve_milestone(ctx: Context<ApproveMilestone>) -> Result<()> {
        let milestone = &mut ctx.accounts.milestone;
        require!(milestone.status == 0, ErrorCode::MilestoneNotPending);
        milestone.status = 1;
        milestone.approved_at = Clock::get()?.unix_timestamp;
        emit!(MilestoneApproved { campaign: ctx.accounts.campaign.key(), milestone_index: milestone.index });
        Ok(())
    }

    pub fn release_milestone_funds(ctx: Context<ReleaseMilestoneFunds>) -> Result<()> {
        let milestone = &mut ctx.accounts.milestone;
        let campaign = &mut ctx.accounts.campaign;
        require!(milestone.status == 1, ErrorCode::MilestoneNotApproved);

        let release_amount = (milestone.percentage as u64)
            .checked_mul(campaign.total_raised)
            .unwrap()
            .checked_div(100)
            .unwrap();
        require!(ctx.accounts.pool_vault.lamports() >= release_amount, ErrorCode::InsufficientFunds);

        let pool_key = ctx.accounts.pool.key();
        let seeds: &[&[u8]] = &[b"vault", pool_key.as_ref(), &[ctx.bumps.pool_vault]];
        transfer_out(&ctx.accounts.pool_vault, &ctx.accounts.recipient, &ctx.accounts.system_program, release_amount, seeds)?;

        milestone.status = 2;
        milestone.released_at = Clock::get()?.unix_timestamp;
        milestone.amount_released = release_amount;
        campaign.milestones_completed = campaign.milestones_completed.checked_add(1).unwrap();

        emit!(MilestoneReleased { campaign: campaign.key(), milestone_index: milestone.index, amount: release_amount, recipient: campaign.recipient });
        Ok(())
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let campaign = &ctx.accounts.campaign;
        let donation_record = &ctx.accounts.donation_record;
        let clock = Clock::get()?;
        require!(clock.unix_timestamp > campaign.deadline, ErrorCode::DeadlineNotReached);
        require!(campaign.milestones_completed < campaign.milestone_count, ErrorCode::AllMilestonesComplete);

        let released_pct = (campaign.milestones_completed as u64) * 100 / (campaign.milestone_count as u64);
        let unreleased_pct = 100 - released_pct;
        let refund_amount = donation_record.amount.checked_mul(unreleased_pct).unwrap().checked_div(100).unwrap();
        require!(ctx.accounts.pool_vault.lamports() >= refund_amount, ErrorCode::InsufficientFunds);

        let pool_key = ctx.accounts.pool.key();
        let seeds: &[&[u8]] = &[b"vault", pool_key.as_ref(), &[ctx.bumps.pool_vault]];
        transfer_out(&ctx.accounts.pool_vault, &ctx.accounts.donor.to_account_info(), &ctx.accounts.system_program, refund_amount, seeds)?;

        emit!(RefundClaimed { campaign: campaign.key(), donor: ctx.accounts.donor.key(), amount: refund_amount });
        Ok(())
    }

    // ------------------------------------------------------------------
    // Staked Impact Dares
    // ------------------------------------------------------------------

    /// Lock `stake` lamports into a dare vault challenging `target_handle` to act
    /// for `pool` before `deadline`. The pot always ends up in the cause vault
    /// (settled as "completed" by the oracle, or "expired" by anyone after the
    /// deadline). 1.5% goes to the protocol treasury at settlement.
    pub fn create_dare(
        ctx: Context<CreateDare>,
        _nonce: u64,
        target_handle: String,
        text: String,
        stake: u64,
        duration_secs: i64,
        target_wallet: Option<Pubkey>,
    ) -> Result<()> {
        require!(stake > 0, ErrorCode::InvalidAmount);
        require!(target_handle.len() <= 32, ErrorCode::HandleTooLong);
        require!(text.len() <= 200, ErrorCode::DescriptionTooLong);
        require!(duration_secs >= MIN_DARE_DURATION && duration_secs <= MAX_DARE_DURATION, ErrorCode::InvalidDuration);
        require!(ctx.accounts.pool.is_active, ErrorCode::PoolInactive);

        transfer_in(&ctx.accounts.creator, &ctx.accounts.dare_vault, &ctx.accounts.system_program, stake)?;

        let now = Clock::get()?.unix_timestamp;
        let dare = &mut ctx.accounts.dare;
        dare.creator = ctx.accounts.creator.key();
        dare.pool = ctx.accounts.pool.key();
        dare.target_wallet = target_wallet;
        dare.target_handle = target_handle;
        dare.text = text;
        dare.stake = stake;
        dare.pot = stake;
        dare.backer_count = 1;
        dare.deadline = now + duration_secs;
        dare.status = 0;
        dare.created_at = now;
        dare.bump = ctx.bumps.dare;
        dare.vault_bump = ctx.bumps.dare_vault;

        emit!(DareCreated { dare: dare.key(), creator: dare.creator, pool: dare.pool, stake, deadline: dare.deadline });
        Ok(())
    }

    pub fn boost_dare(ctx: Context<BoostDare>, amount: u64) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        let dare = &mut ctx.accounts.dare;
        require!(dare.status == 0, ErrorCode::DareNotOpen);
        require!(Clock::get()?.unix_timestamp < dare.deadline, ErrorCode::DareExpired);
        transfer_in(&ctx.accounts.backer, &ctx.accounts.dare_vault, &ctx.accounts.system_program, amount)?;
        dare.pot = dare.pot.checked_add(amount).unwrap();
        dare.backer_count = dare.backer_count.checked_add(1).unwrap();
        emit!(DareBoosted { dare: dare.key(), backer: ctx.accounts.backer.key(), amount, pot: dare.pot });
        Ok(())
    }

    /// Settle a dare. `completed = true` requires the pool authority (oracle)
    /// signature; `completed = false` is permissionless after the deadline.
    /// Either way the pot (minus the 1.5% fee) moves into the cause vault.
    pub fn settle_dare(ctx: Context<SettleDare>, completed: bool) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let dare = &mut ctx.accounts.dare;
        require!(dare.status == 0, ErrorCode::DareNotOpen);
        if completed {
            require!(ctx.accounts.settler.key() == ctx.accounts.pool.authority, ErrorCode::Unauthorized);
        } else {
            require!(now >= dare.deadline || ctx.accounts.settler.key() == ctx.accounts.pool.authority, ErrorCode::DeadlineNotReached);
        }

        let pot = dare.pot;
        let fee = pot.checked_mul(DARE_FEE_BPS).unwrap().checked_div(10_000).unwrap();
        let to_cause = pot.checked_sub(fee).unwrap();

        let dare_key = dare.key();
        let seeds: &[&[u8]] = &[b"dare_vault", dare_key.as_ref(), &[dare.vault_bump]];
        if fee > 0 {
            transfer_out(&ctx.accounts.dare_vault, &ctx.accounts.treasury, &ctx.accounts.system_program, fee, seeds)?;
        }
        transfer_out(&ctx.accounts.dare_vault, &ctx.accounts.pool_vault, &ctx.accounts.system_program, to_cause, seeds)?;

        let pool = &mut ctx.accounts.pool;
        pool.total_donated = pool.total_donated.checked_add(to_cause).unwrap();
        pool.donor_count = pool.donor_count.checked_add(dare.backer_count as u64).unwrap();

        dare.status = if completed { 1 } else { 2 };
        dare.settled_at = now;
        emit!(DareSettled { dare: dare_key, pool: pool.key(), completed, to_cause, fee });
        Ok(())
    }
}

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

fn transfer_in<'info>(from: &Signer<'info>, to: &AccountInfo<'info>, system_program: &Program<'info, System>, amount: u64) -> Result<()> {
    let cpi = CpiContext::new(system_program.to_account_info(), system_program::Transfer { from: from.to_account_info(), to: to.clone() });
    system_program::transfer(cpi, amount)
}

fn transfer_out<'info>(from: &AccountInfo<'info>, to: &AccountInfo<'info>, system_program: &Program<'info, System>, amount: u64, seeds: &[&[u8]]) -> Result<()> {
    let signer: &[&[&[u8]]] = &[seeds];
    let cpi = CpiContext::new_with_signer(system_program.to_account_info(), system_program::Transfer { from: from.clone(), to: to.clone() }, signer);
    system_program::transfer(cpi, amount)
}

fn fill_record(record: &mut Account<DonationRecord>, donor: Pubkey, pool: Pubkey, amount: u64, donation_type: u8) -> Result<()> {
    record.donor = donor;
    record.pool = pool;
    record.amount = amount;
    record.timestamp = Clock::get()?.unix_timestamp;
    record.donation_type = donation_type;
    Ok(())
}

// ----------------------------------------------------------------------
// Contexts
// ----------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(name: String)]
pub struct InitializePool<'info> {
    #[account(init, payer = authority, space = 8 + Pool::INIT_SPACE, seeds = [b"pool", name.as_bytes()], bump)]
    pub pool: Account<'info, Pool>,
    /// CHECK: system-owned vault PDA; only ever moved via CPI signed with its seeds
    #[account(seeds = [b"vault", pool.key().as_ref()], bump)]
    pub pool_vault: AccountInfo<'info>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OneTapDonate<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    /// CHECK: vault PDA
    #[account(mut, seeds = [b"vault", pool.key().as_ref()], bump)]
    pub pool_vault: AccountInfo<'info>,
    #[account(init, payer = donor, space = 8 + DonationRecord::INIT_SPACE)]
    pub donation_record: Account<'info, DonationRecord>,
    #[account(mut)]
    pub donor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DonateToPool<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    /// CHECK: vault PDA
    #[account(mut, seeds = [b"vault", pool.key().as_ref()], bump)]
    pub pool_vault: AccountInfo<'info>,
    #[account(init, payer = donor, space = 8 + DonationRecord::INIT_SPACE)]
    pub donation_record: Account<'info, DonationRecord>,
    #[account(mut)]
    pub donor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, nonce: u64)]
pub struct Donate<'info> {
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    /// CHECK: vault PDA
    #[account(mut, seeds = [b"vault", pool.key().as_ref()], bump)]
    pub pool_vault: AccountInfo<'info>,
    #[account(
        init,
        payer = donor,
        space = 8 + DonationRecord::INIT_SPACE,
        seeds = [b"donation", pool.key().as_ref(), donor.key().as_ref(), &nonce.to_le_bytes()],
        bump
    )]
    pub donation_record: Account<'info, DonationRecord>,
    /// Optional campaign overlay for the pool; when present its raised total is updated.
    #[account(mut, seeds = [b"campaign", pool.key().as_ref()], bump = campaign.bump)]
    pub campaign: Option<Account<'info, Campaign>>,
    #[account(mut)]
    pub donor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawFromPool<'info> {
    #[account(mut, has_one = authority)]
    pub pool: Account<'info, Pool>,
    /// CHECK: vault PDA
    #[account(mut, seeds = [b"vault", pool.key().as_ref()], bump)]
    pub pool_vault: AccountInfo<'info>,
    /// CHECK: any recipient chosen by the authority
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateCampaign<'info> {
    #[account(init, payer = authority, space = 8 + Campaign::INIT_SPACE, seeds = [b"campaign", pool.key().as_ref()], bump)]
    pub campaign: Account<'info, Campaign>,
    #[account(has_one = authority)]
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(index: u8)]
pub struct InitMilestone<'info> {
    #[account(init, payer = authority, space = 8 + Milestone::INIT_SPACE, seeds = [b"milestone", campaign.key().as_ref(), &[index]], bump)]
    pub milestone: Account<'info, Milestone>,
    #[account(has_one = authority)]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AttestMilestone<'info> {
    #[account(mut, constraint = milestone.campaign == campaign.key())]
    pub milestone: Account<'info, Milestone>,
    #[account(has_one = authority)]
    pub campaign: Account<'info, Campaign>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ApproveMilestone<'info> {
    #[account(mut)]
    pub milestone: Account<'info, Milestone>,
    #[account(has_one = authority, constraint = milestone.campaign == campaign.key())]
    pub campaign: Account<'info, Campaign>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ReleaseMilestoneFunds<'info> {
    #[account(mut)]
    pub milestone: Account<'info, Milestone>,
    #[account(mut, has_one = authority, constraint = milestone.campaign == campaign.key(), constraint = campaign.pool == pool.key())]
    pub campaign: Account<'info, Campaign>,
    pub pool: Account<'info, Pool>,
    /// CHECK: vault PDA
    #[account(mut, seeds = [b"vault", pool.key().as_ref()], bump)]
    pub pool_vault: AccountInfo<'info>,
    /// CHECK: must equal campaign.recipient
    #[account(mut, constraint = recipient.key() == campaign.recipient)]
    pub recipient: AccountInfo<'info>,
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(constraint = campaign.pool == pool.key())]
    pub campaign: Account<'info, Campaign>,
    pub pool: Account<'info, Pool>,
    #[account(constraint = donation_record.donor == donor.key(), constraint = donation_record.pool == campaign.pool)]
    pub donation_record: Account<'info, DonationRecord>,
    /// CHECK: vault PDA
    #[account(mut, seeds = [b"vault", pool.key().as_ref()], bump)]
    pub pool_vault: AccountInfo<'info>,
    #[account(mut)]
    pub donor: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nonce: u64)]
pub struct CreateDare<'info> {
    #[account(init, payer = creator, space = 8 + Dare::INIT_SPACE, seeds = [b"dare", creator.key().as_ref(), &nonce.to_le_bytes()], bump)]
    pub dare: Account<'info, Dare>,
    /// CHECK: system-owned dare vault PDA
    #[account(mut, seeds = [b"dare_vault", dare.key().as_ref()], bump)]
    pub dare_vault: AccountInfo<'info>,
    pub pool: Account<'info, Pool>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BoostDare<'info> {
    #[account(mut)]
    pub dare: Account<'info, Dare>,
    /// CHECK: dare vault PDA
    #[account(mut, seeds = [b"dare_vault", dare.key().as_ref()], bump = dare.vault_bump)]
    pub dare_vault: AccountInfo<'info>,
    #[account(mut)]
    pub backer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleDare<'info> {
    #[account(mut, constraint = dare.pool == pool.key())]
    pub dare: Account<'info, Dare>,
    /// CHECK: dare vault PDA
    #[account(mut, seeds = [b"dare_vault", dare.key().as_ref()], bump = dare.vault_bump)]
    pub dare_vault: AccountInfo<'info>,
    #[account(mut)]
    pub pool: Account<'info, Pool>,
    /// CHECK: cause vault PDA
    #[account(mut, seeds = [b"vault", pool.key().as_ref()], bump)]
    pub pool_vault: AccountInfo<'info>,
    /// CHECK: protocol treasury, fixed
    #[account(mut, address = PROTOCOL_TREASURY)]
    pub treasury: AccountInfo<'info>,
    pub settler: Signer<'info>,
    pub system_program: Program<'info, System>,
}

// ----------------------------------------------------------------------
// Accounts
// ----------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Pool {
    pub authority: Pubkey,
    #[max_len(50)]
    pub name: String,
    #[max_len(200)]
    pub description: String,
    #[max_len(10)]
    pub emoji: String,
    pub pool_type: u8,
    pub total_donated: u64,
    pub donor_count: u64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct DonationRecord {
    pub donor: Pubkey,
    pub pool: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    /// 0 one-tap, 1 custom (keypair record), 2 tip, 3 PDA record (v2)
    pub donation_type: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub pool: Pubkey,
    pub authority: Pubkey,
    pub recipient: Pubkey,
    pub target_amount: u64,
    pub total_raised: u64,
    pub donor_count: u64,
    pub milestone_count: u8,
    pub milestones_completed: u8,
    pub deadline: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Milestone {
    pub campaign: Pubkey,
    pub index: u8,
    #[max_len(100)]
    pub description: String,
    pub percentage: u8,
    /// 0 pending, 1 approved, 2 released, 3 rejected
    pub status: u8,
    pub approved_at: i64,
    pub released_at: i64,
    pub amount_released: u64,
    /// sha256 of the signed AI Impact Oracle audit (zero = not attested)
    pub attestation_hash: [u8; 32],
    pub attestation_confidence: u8,
    pub attested_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Dare {
    pub creator: Pubkey,
    pub pool: Pubkey,
    pub target_wallet: Option<Pubkey>,
    #[max_len(32)]
    pub target_handle: String,
    #[max_len(200)]
    pub text: String,
    pub stake: u64,
    pub pot: u64,
    pub backer_count: u32,
    pub deadline: i64,
    /// 0 open, 1 completed, 2 expired
    pub status: u8,
    pub created_at: i64,
    pub settled_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}

// ----------------------------------------------------------------------
// Events
// ----------------------------------------------------------------------

#[event]
pub struct DonationMade {
    pub donor: Pubkey,
    pub pool: Pubkey,
    pub amount: u64,
    pub donation_type: u8,
}

#[event]
pub struct PoolWithdrawal {
    pub pool: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
}

#[event]
pub struct CampaignCreated {
    pub campaign: Pubkey,
    pub pool: Pubkey,
    pub target_amount: u64,
    pub milestone_count: u8,
}

#[event]
pub struct MilestoneApproved {
    pub campaign: Pubkey,
    pub milestone_index: u8,
}

#[event]
pub struct MilestoneAttested {
    pub campaign: Pubkey,
    pub milestone_index: u8,
    pub attestation_hash: [u8; 32],
    pub confidence: u8,
}

#[event]
pub struct MilestoneReleased {
    pub campaign: Pubkey,
    pub milestone_index: u8,
    pub amount: u64,
    pub recipient: Pubkey,
}

#[event]
pub struct RefundClaimed {
    pub campaign: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
}

#[event]
pub struct DareCreated {
    pub dare: Pubkey,
    pub creator: Pubkey,
    pub pool: Pubkey,
    pub stake: u64,
    pub deadline: i64,
}

#[event]
pub struct DareBoosted {
    pub dare: Pubkey,
    pub backer: Pubkey,
    pub amount: u64,
    pub pot: u64,
}

#[event]
pub struct DareSettled {
    pub dare: Pubkey,
    pub pool: Pubkey,
    pub completed: bool,
    pub to_cause: u64,
    pub fee: u64,
}

// ----------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Invalid milestone count (must be 1-5)")]
    InvalidMilestoneCount,
    #[msg("Milestone percentages must sum to 100")]
    InvalidPercentages,
    #[msg("Milestone is not in pending status")]
    MilestoneNotPending,
    #[msg("Milestone is not approved")]
    MilestoneNotApproved,
    #[msg("Deadline has not been reached")]
    DeadlineNotReached,
    #[msg("All milestones are already complete")]
    AllMilestonesComplete,
    #[msg("Description too long")]
    DescriptionTooLong,
    #[msg("Handle too long (max 32 chars)")]
    HandleTooLong,
    #[msg("Pool is not active")]
    PoolInactive,
    #[msg("Invalid confidence (0-100)")]
    InvalidConfidence,
    #[msg("Invalid dare duration")]
    InvalidDuration,
    #[msg("Dare is not open")]
    DareNotOpen,
    #[msg("Dare has expired")]
    DareExpired,
    #[msg("Unauthorized")]
    Unauthorized,
}
