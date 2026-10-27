use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("DBzVAJHgiyVWZMdj1Q2vHUfL1wW4nVag3AqJ5FKmxtau");

#[program]
pub mod umanity_tips {
    use super::*;

    // Register user profile
    pub fn register_user(
        ctx: Context<RegisterUser>,
        username: String,
        display_name: String,
    ) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.owner = ctx.accounts.owner.key();
        user_profile.username = username;
        user_profile.display_name = display_name;
        user_profile.total_received = 0;
        user_profile.total_sent = 0;
        user_profile.tip_count_received = 0;
        user_profile.tip_count_sent = 0;
        user_profile.is_active = true;
        user_profile.bump = ctx.bumps.user_profile;

        emit!(UserRegistered {
            user: ctx.accounts.owner.key(),
            username: user_profile.username.clone(),
        });

        Ok(())
    }

    // Send tip to user
    pub fn send_tip(
        ctx: Context<SendTip>,
        amount: u64,
        message: String,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        require!(message.len() <= 280, ErrorCode::MessageTooLong);

        // Transfer SOL from sender to recipient
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.sender.to_account_info(),
                to: ctx.accounts.recipient.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, amount)?;

        // Update sender stats
        let sender_profile = &mut ctx.accounts.sender_profile;
        sender_profile.total_sent = sender_profile.total_sent.checked_add(amount).unwrap();
        sender_profile.tip_count_sent = sender_profile.tip_count_sent.checked_add(1).unwrap();

        // Update recipient stats
        let recipient_profile = &mut ctx.accounts.recipient_profile;
        recipient_profile.total_received = recipient_profile.total_received.checked_add(amount).unwrap();
        recipient_profile.tip_count_received = recipient_profile.tip_count_received.checked_add(1).unwrap();

        // Record tip
        let tip_record = &mut ctx.accounts.tip_record;
        tip_record.sender = ctx.accounts.sender.key();
        tip_record.recipient = ctx.accounts.recipient.key();
        tip_record.amount = amount;
        tip_record.message = message.clone();
        tip_record.timestamp = Clock::get()?.unix_timestamp;

        emit!(TipSent {
            sender: ctx.accounts.sender.key(),
            recipient: ctx.accounts.recipient.key(),
            amount,
            message,
        });

        Ok(())
    }

    // Update user profile
    pub fn update_profile(
        ctx: Context<UpdateProfile>,
        display_name: Option<String>,
        bio: Option<String>,
    ) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;

        if let Some(name) = display_name {
            require!(name.len() <= 50, ErrorCode::NameTooLong);
            user_profile.display_name = name;
        }

        if let Some(bio_text) = bio {
            require!(bio_text.len() <= 280, ErrorCode::BioTooLong);
            user_profile.bio = bio_text;
        }

        Ok(())
    }

    // Toggle active status
    pub fn toggle_active(ctx: Context<ToggleActive>) -> Result<()> {
        let user_profile = &mut ctx.accounts.user_profile;
        user_profile.is_active = !user_profile.is_active;
        Ok(())
    }
}

// Contexts
#[derive(Accounts)]
#[instruction(username: String)]
pub struct RegisterUser<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + UserProfile::INIT_SPACE,
        seeds = [b"user", owner.key().as_ref()],
        bump
    )]
    pub user_profile: Account<'info, UserProfile>,

    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, message: String)]
pub struct SendTip<'info> {
    #[account(
        mut,
        seeds = [b"user", sender.key().as_ref()],
        bump = sender_profile.bump
    )]
    pub sender_profile: Account<'info, UserProfile>,

    #[account(
        mut,
        seeds = [b"user", recipient.key().as_ref()],
        bump = recipient_profile.bump
    )]
    pub recipient_profile: Account<'info, UserProfile>,

    #[account(
        init,
        payer = sender,
        space = 8 + TipRecord::INIT_SPACE
    )]
    pub tip_record: Account<'info, TipRecord>,

    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: Recipient account
    #[account(mut)]
    pub recipient: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateProfile<'info> {
    #[account(
        mut,
        seeds = [b"user", owner.key().as_ref()],
        bump = user_profile.bump,
        has_one = owner
    )]
    pub user_profile: Account<'info, UserProfile>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct ToggleActive<'info> {
    #[account(
        mut,
        seeds = [b"user", owner.key().as_ref()],
        bump = user_profile.bump,
        has_one = owner
    )]
    pub user_profile: Account<'info, UserProfile>,

    pub owner: Signer<'info>,
}

// Accounts
#[account]
#[derive(InitSpace)]
pub struct UserProfile {
    pub owner: Pubkey,
    #[max_len(30)]
    pub username: String,
    #[max_len(50)]
    pub display_name: String,
    #[max_len(280)]
    pub bio: String,
    pub total_received: u64,
    pub total_sent: u64,
    pub tip_count_received: u64,
    pub tip_count_sent: u64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TipRecord {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    #[max_len(280)]
    pub message: String,
    pub timestamp: i64,
}

// Events
#[event]
pub struct UserRegistered {
    pub user: Pubkey,
    pub username: String,
}

#[event]
pub struct TipSent {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub message: String,
}

// Errors
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Message too long (max 280 characters)")]
    MessageTooLong,
    #[msg("Name too long (max 50 characters)")]
    NameTooLong,
    #[msg("Bio too long (max 280 characters)")]
    BioTooLong,
}
