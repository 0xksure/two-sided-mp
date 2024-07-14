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

#[derive(Accounts)]
#[instruction(name: String)]
pub struct ListService<'info> {
    #[account(mut)]
    pub vendor: Signer<'info>,
    #[account(
        mut,
        seeds = [b"marketplace".as_ref()],
        bump=marketplace.bump,
    )]
    pub marketplace: Box<Account<'info, Marketplace>>,

    #[account(
        init,
        seeds = [b"service".as_ref(),name.as_bytes()],
        bump,
        payer = vendor,
        space = 8 + size_of::<Service>(),
    )]
    pub service: Account<'info, Service>,

    #[account(mut)]
    pub nft_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = vendor,
        seeds = [
            b"escrow".as_ref(),
            nft_mint.key().as_ref(),
        ],
        bump,
        token::mint = nft_mint,
        token::authority = marketplace,
    )]
    pub escrow_nft_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = vendor,
    )]
    pub vendor_token_account: Account<'info, TokenAccount>,

    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle(
    ctx: Context<ListService>,
    name: String,
    description: String,
    price: u64,
    payment_mint: Pubkey,
    is_soulbound: bool,
) -> Result<()> {
    //let marketplace = &mut ctx.accounts.marketplace;
    let service = &mut ctx.accounts.service;
    let vendor = &ctx.accounts.vendor;
    let marketplace = &mut ctx.accounts.marketplace;

    // Initialize service data
    service.vendor = vendor.key();
    service.name = name.clone();
    service.description = description.clone();
    service.price = price;
    service.is_soulbound = is_soulbound;
    service.nft_mint = ctx.accounts.nft_mint.key();
    service.mint = payment_mint;
    service.bump = ctx.bumps.service;
    service.escrow_bump = ctx.bumps.escrow_nft_account;

    // transfer nft
    let mint_res = token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.vendor_token_account.to_account_info(),
                to: ctx.accounts.escrow_nft_account.to_account_info(),
                authority: ctx.accounts.vendor.to_account_info(),
            },
        ),
        1,
    );

    match mint_res {
        Ok(_) => {}
        Err(e) => {
            msg!("Error transferring NFT");
            return Err(e.into());
        }
    }

    msg!("Metadata account created");
    marketplace.total_services += 1;

    Ok(())
}
