use std::mem::size_of;

use anchor_lang::prelude::*;

use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::Metadata;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use mpl_token_metadata::instructions::{
    CreateMetadataAccountV3Cpi, CreateMetadataAccountV3CpiAccounts,
    CreateMetadataAccountV3InstructionArgs, CreateV1CpiBuilder, TransferV1CpiBuilder,
};
use mpl_token_metadata::types::DataV2;

use crate::marketplace::Marketplace;
use crate::service::Service;
use crate::utils::ErrorCode;

/// Relist the service for sale
#[derive(Accounts)]
#[instruction(name: String)]
pub struct ResellService<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        mut,
        seeds = [b"marketplace".as_ref()],
        bump=marketplace.bump,
    )]
    pub marketplace: Box<Account<'info, Marketplace>>,


    /// Marketplace vault is the same as a 
    /// treasury holding the royalties
    #[account(
        init_if_needed,
        payer = seller,
        seeds = [
            b"marketplace_vault".as_ref(),
            list_mint.key().as_ref(),
        ],
        bump,
        token::mint = list_mint,
        token::authority = marketplace,
    )]
    pub marketplace_vault: Box<Account<'info, TokenAccount>>,


    #[account( 
        mut,  
        seeds = [b"service".as_ref(),name.as_bytes()],
        bump = service.bump,
    )]
    pub service: Box<Account<'info, Service>>,

    #[account(mut)]
    pub nft_mint: Box<Account<'info, Mint>>,

    #[account(mut)]
    pub list_mint: Box<Account<'info, Mint>>,

    #[account(
        mut,
        seeds = [
            b"escrow".as_ref(),
            nft_mint.key().as_ref(),
        ],
        bump=service.escrow_bump,
        token::mint = nft_mint,
        token::authority = marketplace,
    )]
    pub escrow_nft_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = list_mint,
        associated_token::authority = seller,
    )]
    pub seller_payment_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = seller,
    )]
    pub seller_nft_account: Box<Account<'info, TokenAccount>>,
 

    pub token_program: Program<'info, Token>, 
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle(ctx: Context<ResellService>,name: String, new_price: u64) -> Result<()> {
    let service = &mut ctx.accounts.service;
    let marketplace = &ctx.accounts.marketplace;
    let nft_mint = &ctx.accounts.nft_mint;
    let seller_nft_account = &ctx.accounts.seller_nft_account;

    // Check if the token is soulbound by checking if the 
    // token account is frozen and the freeze authority is none
    if (seller_nft_account.is_frozen() && nft_mint.freeze_authority.is_none()) {
        return Err(ErrorCode::SoulboundNotResellable.into());
    }
  
    require!(!service.is_soulbound, ErrorCode::SoulboundNotResellable);

    // Calculate royalty
    let royalty_amount = (new_price as u128 * marketplace.royalty_percentage as u128 / 100) as u64;
    let seller_amount = new_price.checked_sub(royalty_amount).unwrap();
    service.price = seller_amount;
    

    // // Transfer royalty to original vendor
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.seller_payment_account.to_account_info(),
                to: ctx.accounts.marketplace_vault.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        royalty_amount,
    )?;

    // Transfer NFT
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.seller_nft_account.to_account_info(),
                to: ctx.accounts.escrow_nft_account.to_account_info(),
                authority: ctx.accounts.seller.to_account_info(),
            },
        ),
        1,
    )?;


    Ok(())
}
