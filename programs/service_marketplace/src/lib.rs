pub mod instructions;
pub mod state;
pub mod utils;

pub use instructions::*;
pub use state::*;

use anchor_lang::prelude::*;

declare_id!("92q1D3m2dHrmBWfpn5YZHaoG5pxkk5CTJH3e9SazdNC7");

/*
Using Anchor, create a 2-sided marketplace model for services.
Vendors should be able to list services, with service agreements represented by metadata in NFTs.
Consumers should be able to purchase service NFTs.
The marketplace should support soulbound and non-soulbound NFTs and collect royalties on resales.

* Develop a 2-sided marketplace using Anchor.

* Allow vendors to list services as NFTs.

* Enable consumers to purchase service NFTs.

* Support soulbound and non-soulbound NFTs, with royalty collection for resales.
*/

#[program]
pub mod service_marketplace {

    use super::*;

    pub fn initialize_marketplace(ctx: Context<InitializeMarketplace>) -> Result<()> {
        instructions::initialize_marketplace::handle(ctx)
    }

    pub fn mint_service(ctx: Context<MintService>, name: String, uri: String) -> Result<()> {
        instructions::mint_service::handle(ctx, name, uri)
    }

    /// list service places the service NFT in an
    /// escrow account and creates a metadata account
    pub fn list_service(
        ctx: Context<ListService>,
        name: String,
        description: String,
        price: u64,
        payment_mint: Pubkey,
        is_soulbound: bool,
    ) -> Result<()> {
        instructions::list_service::handle(
            ctx,
            name,
            description,
            price,
            payment_mint,
            is_soulbound,
        )
    }

    /// purchase a service allows anyone to buy the
    /// service NFT and transfer the payment to the vendor
    pub fn buy_service(ctx: Context<BuyService>, name: String) -> Result<()> {
        instructions::buy_service::handle(ctx, name)
    }

    pub fn resell_service(ctx: Context<ResellService>, name: String, new_price: u64) -> Result<()> {
        instructions::resell_service::handle(ctx, name, new_price)
    }
}
