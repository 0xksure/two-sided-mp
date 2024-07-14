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

use crate::marketplace::{self, Marketplace};
use crate::service::Service;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct BuyService<'info> {
    /// buyer of the service and
    /// also the payer of the tx
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: 
    #[account(
        mut,
    )]
    pub vendor: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"marketplace".as_ref()],
        bump=marketplace.bump,
    )]
    pub marketplace: Box<Account<'info, Marketplace>>,

    /// The internal service account for the nft
    #[account(
        mut,
        seeds = [b"service".as_ref(),name.as_bytes()],
        bump = service.bump,
    )]
    pub service: Box<Account<'info, Service>>,

    #[account(mut)]
    pub nft_mint: Account<'info, Mint>,

    /// spl or token 22
    #[account(mut)]
    pub trade_mint: Account<'info, Mint>,

    /// This is the escrow account that holds the service
    /// NFT
    #[account(
        mut,
        constraint = escrow_nft_account.mint == nft_mint.key(),
    
    )]
    pub escrow_nft_account: Box<Account<'info, TokenAccount>>,

    /// This is the buyer nft token account that will hold
    /// the NFT after the purchase
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = nft_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_nft_account: Box<Account<'info, TokenAccount>>,

    /// account that holds the same mint as the trade_mint
    /// assumed to be initialized
    #[account(mut)]
    pub buyer_payment_account: Box<Account<'info, TokenAccount>>,

    /// seller payment account. This is the account where the
    /// seller receives the payment. The mint should be the s
    /// same as the trade_mint
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = trade_mint,
        associated_token::authority = vendor,
    )]
    pub vendor_payment_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handle(ctx: Context<BuyService>, name: String) -> Result<()> {
    let service = &mut ctx.accounts.service;
    let buyer = &ctx.accounts.buyer;
    msg!("Service price: {}", service.price);
    service.vendor = buyer.key();

    // Transfer payment
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.buyer_payment_account.to_account_info(),
                to: ctx.accounts.vendor_payment_account.to_account_info(),
                authority: ctx.accounts.buyer.to_account_info(),
            },
        ),
        service.price,
    )?;

    // // Transfer NFT
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.escrow_nft_account.to_account_info(),
                to: ctx.accounts.buyer_nft_account.to_account_info(),
                authority: ctx.accounts.marketplace.to_account_info(),
            },
            &[&ctx.accounts.marketplace.as_mut().clone().signing_seeds()],        ),
        1,
    )?;

    Ok(())
}
