use anchor_lang::prelude::*;

#[account]
pub struct Marketplace {
    pub authority: Pubkey,
    pub total_services: u64,
    pub royalty_percentage: u8,
    pub bump_array: [u8; 1],
    pub bump: u8,
}

impl Marketplace {
    pub fn signing_seeds(&self) -> [&[u8]; 2] {
        [b"marketplace", self.bump_array.as_ref()]
    }
}
