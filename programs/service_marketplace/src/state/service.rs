use anchor_lang::prelude::*;

#[account]
pub struct Service {
    /// The vendor that listed the service.
    pub vendor: Pubkey,

    pub name: String,
    pub description: String,
    pub price: u64,
    pub mint: Pubkey,

    /// Can the service be resold hardcoded in the
    /// marketplace program
    pub is_soulbound: bool,
    pub nft_mint: Pubkey,
    pub bump: u8,
    pub escrow_bump: u8,
}
