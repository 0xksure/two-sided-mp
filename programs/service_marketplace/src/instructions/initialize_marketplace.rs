use std::mem::size_of;

use anchor_lang::prelude::*;

use crate::state::marketplace::Marketplace;

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        seeds = [b"marketplace".as_ref()],
        bump,
        payer = authority,
        space = 8 + size_of::<Marketplace>()
    )]
    pub marketplace: Account<'info, Marketplace>,
    pub system_program: Program<'info, System>,
}

pub fn handle(ctx: Context<InitializeMarketplace>) -> Result<()> {
    let marketplace = &mut ctx.accounts.marketplace;
    marketplace.authority = ctx.accounts.authority.key();
    marketplace.total_services = 0;
    marketplace.royalty_percentage = 5; // 5% royalty as an example
    marketplace.bump_array = [ctx.bumps.marketplace; 1];
    Ok(())
}
