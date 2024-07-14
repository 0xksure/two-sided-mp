use anchor_lang::prelude::*;

#[account]
pub struct Marketplace {
    /// The authority that can manage the marketplace.
    pub authority: Pubkey,

    /// The total number of services listed in the marketplace.
    pub total_services: u64,

    /// The percentage of the sale that goes to the marketplace.
    pub royalty_percentage: u8,

    pub bump_array: [u8; 1],
    pub bump: u8,
}

impl Marketplace {
    /// Seeds for the marketplace account.
    pub fn signing_seeds(&self) -> [&[u8]; 2] {
        [b"marketplace", self.bump_array.as_ref()]
    }
}
