use anchor_lang::prelude::*;

use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::Metadata;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use mpl_token_metadata::instructions::{
    CreateMetadataAccountV3Cpi, CreateMetadataAccountV3CpiAccounts,
    CreateMetadataAccountV3InstructionArgs, CreateV1CpiBuilder,
};
use mpl_token_metadata::types::DataV2;

#[derive(Accounts)]
#[instruction(name: String, uri: String)]
pub struct MintService<'info> {
    #[account(mut)]
    pub vendor: Signer<'info>,

    #[account(
        init,
        seeds = [b"nft_mint".as_ref(),name.as_bytes()],
        bump,
        payer = vendor,
        mint::decimals = 0,
        mint::authority = vendor,
        mint::freeze_authority = vendor,
    )]
    pub nft_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = vendor,
        associated_token::mint = nft_mint,
        associated_token::authority = vendor,
    )]
    pub vendor_token_account: Account<'info, TokenAccount>,
    /// CHECK: This is not dangerous because we don't read or write from this account
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// CHECK:
    pub token_metadata_program: Program<'info, Metadata>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle(ctx: Context<MintService>, name: String, uri: String) -> Result<()> {
    msg!("Minting NFT");
    token::mint_to(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.nft_mint.to_account_info(),
                to: ctx.accounts.vendor_token_account.to_account_info(),
                authority: ctx.accounts.vendor.to_account_info(),
            },
        ),
        1,
    )?;

    msg!("Creating metadata account");

    let create_metadata_account_res = CreateMetadataAccountV3Cpi::new(
        &ctx.accounts.token_metadata_program,
        CreateMetadataAccountV3CpiAccounts {
            metadata: &ctx.accounts.metadata.to_account_info(),
            mint: &ctx.accounts.nft_mint.to_account_info(),
            mint_authority: &ctx.accounts.vendor.to_account_info(),
            payer: &ctx.accounts.vendor.to_account_info(),
            update_authority: (&ctx.accounts.vendor.to_account_info(), true),
            system_program: &ctx.accounts.system_program.to_account_info(),
            rent: Some(&ctx.accounts.rent.to_account_info()),
        },
        CreateMetadataAccountV3InstructionArgs {
            data: DataV2 {
                name: name.clone(),
                symbol: "".to_string(),
                uri: uri.clone(),
                seller_fee_basis_points: 5,
                creators: None,
                collection: None,
                uses: None,
            },
            is_mutable: true,
            collection_details: None,
        },
    )
    .invoke();
    match create_metadata_account_res {
        Ok(_) => {}
        Err(e) => {
            msg!("Error creating metadata account");
            return Err(e.into());
        }
    }
    Ok(())
}
