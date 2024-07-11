use std::mem::size_of;

use anchor_lang::prelude::*;

use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::Metadata;
use anchor_spl::token::{self, Mint, Token, TokenAccount};
use mpl_token_metadata::instructions::CreateV1CpiBuilder;

declare_id!("EYk41B1oPd5hcTNcx7u2oGykSHHaEq4Uo9i2oYmZvDXb");

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

    use anchor_lang::solana_program::nonce::state::Data;
    use anchor_spl::token_2022::spl_token_2022::solana_zk_token_sdk::zk_token_proof_instruction::ContextStateInfo;
    use mpl_token_metadata::{
        instructions::{
            CreateMetadataAccountV3, CreateMetadataAccountV3Cpi,
            CreateMetadataAccountV3CpiAccounts, CreateMetadataAccountV3InstructionArgs,
            TransferBuilder, TransferV1CpiBuilder,
        },
        types::DataV2,
    };

    use super::*;

    pub fn initialize_marketplace(ctx: Context<InitializeMarketplace>) -> Result<()> {
        let marketplace = &mut ctx.accounts.marketplace;
        marketplace.authority = ctx.accounts.authority.key();
        marketplace.total_services = 0;
        marketplace.royalty_percentage = 5; // 5% royalty as an example
        Ok(())
    }

    pub fn create_service(ctx: Context<CreateService>, name: String, uri: String) -> Result<()> {
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

    pub fn list_service(
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

        // Initialize service data
        service.vendor = vendor.key();
        service.name = name.clone();
        service.description = description.clone();
        service.price = price;
        service.is_soulbound = is_soulbound;
        service.nft_mint = ctx.accounts.nft_mint.key();
        service.mint = payment_mint;

        let create_res = TransferV1CpiBuilder::new(&ctx.accounts.token_metadata_program)
            .token(&ctx.accounts.vendor_token_account.to_account_info())
            .token_owner(&ctx.accounts.vendor.to_account_info())
            .destination_token(&ctx.accounts.escrow_service_account.to_account_info())
            .destination_owner(&ctx.accounts.marketplace.to_account_info())
            .mint(&ctx.accounts.nft_mint.to_account_info())
            .metadata(&ctx.accounts.metadata.to_account_info())
            .authority(&ctx.accounts.vendor.to_account_info())
            .payer(&ctx.accounts.vendor.to_account_info())
            .system_program(&ctx.accounts.system_program.to_account_info())
            .sysvar_instructions(&ctx.accounts.rent.to_account_info())
            .spl_token_program(&ctx.accounts.token_program.to_account_info())
            .spl_ata_program(&ctx.accounts.associated_token_program.to_account_info())
            .amount(1)
            .invoke();
        match create_res {
            Ok(_) => {}
            Err(e) => {
                msg!("Error creating metadata account");
                return Err(e.into());
            }
        }
        msg!("Metadata account created");

        Ok(())
    }

    pub fn purchase_service(ctx: Context<PurchaseService>) -> Result<()> {
        let service = &ctx.accounts.service;
        msg!("Service price: {}", service.price);

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
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.vendor_token_account.to_account_info(),
                    to: ctx.accounts.buyer_token_account.to_account_info(),
                    authority: ctx.accounts.vendor.to_account_info(),
                },
            ),
            1,
        )?;

        Ok(())
    }

    pub fn resell_service(ctx: Context<ResellService>, new_price: u64) -> Result<()> {
        let service = &mut ctx.accounts.service;
        let marketplace = &ctx.accounts.marketplace;

        require!(!service.is_soulbound, ErrorCode::SoulboundNotResellable);

        // Calculate royalty
        let royalty_amount =
            (new_price as u128 * marketplace.royalty_percentage as u128 / 100) as u64;
        let seller_amount = new_price.checked_sub(royalty_amount).unwrap();

        // Transfer payment from buyer to seller
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.buyer_payment_account.to_account_info(),
                    to: ctx.accounts.seller_payment_account.to_account_info(),
                    authority: ctx.accounts.buyer.to_account_info(),
                },
            ),
            seller_amount,
        )?;

        // // Transfer royalty to original vendor
        // token::transfer(
        //     CpiContext::new(
        //         ctx.accounts.token_program.to_account_info(),
        //         token::Transfer {
        //             from: ctx.accounts.buyer_payment_account.to_account_info(),
        //             to: ctx.accounts.vendor_payment_account.to_account_info(),
        //             authority: ctx.accounts.buyer.to_account_info(),
        //         },
        //     ),
        //     royalty_amount,
        // )?;

        // Transfer NFT
        // token::transfer(
        //     CpiContext::new(
        //         ctx.accounts.token_program.to_account_info(),
        //         token::Transfer {
        //             from: ctx.accounts.seller_token_account.to_account_info(),
        //             to: ctx.accounts.buyer_token_account.to_account_info(),
        //             authority: ctx.accounts.seller.to_account_info(),
        //         },
        //     ),
        //     1,
        // )?;

        // Update service price
        service.price = new_price;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeMarketplace<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        seeds = [b"mpl_marketplace".as_ref()],
        bump,
        payer = authority,
        space = 8 + size_of::<Marketplace>()
    )]
    pub marketplace: Account<'info, Marketplace>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(name: String, uri: String)]
pub struct CreateService<'info> {
    #[account(mut)]
    pub vendor: Signer<'info>,

    #[account(
        init,
        seeds = [b"nft_mint".as_ref(),vendor.key().as_ref(),name.as_bytes()],
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

#[derive(Accounts)]
#[instruction(name: String)]
pub struct ListService<'info> {
    #[account(mut)]
    pub vendor: Signer<'info>,
    #[account(mut)]
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
        init_if_needed,
        payer = vendor,
        associated_token::mint = nft_mint,
        associated_token::authority = marketplace,
    )]
    pub escrow_service_account: Account<'info, TokenAccount>,

    #[account(mut)]
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

#[derive(Accounts)]
pub struct PurchaseService<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK:
    #[account(mut)]
    pub vendor: AccountInfo<'info>,
    #[account(mut)]
    pub service: Box<Account<'info, Service>>,
    #[account(mut)]
    pub nft_mint: Account<'info, Mint>,

    #[account(mut)]
    pub trade_mint: Account<'info, Mint>,
    #[account(mut)]
    pub vendor_token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = nft_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Box<Account<'info, TokenAccount>>,
    #[account(
        init_if_needed,
        payer = buyer,
        associated_token::mint = trade_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_payment_account: Box<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub vendor_payment_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResellService<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    /// CHECK:
    pub vendor: AccountInfo<'info>,
    #[account(mut)]
    pub marketplace: Account<'info, Marketplace>,
    #[account(mut)]
    pub service: Account<'info, Service>,
    #[account(mut)]
    pub nft_mint: Account<'info, Mint>,
    #[account(mut)]
    pub seller_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub buyer_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub buyer_payment_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub seller_payment_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vendor_payment_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Marketplace {
    pub authority: Pubkey,
    pub total_services: u64,
    pub royalty_percentage: u8,
}

#[account]
pub struct Service {
    pub vendor: Pubkey,
    pub name: String,
    pub description: String,
    pub price: u64,
    pub mint: Pubkey,
    pub is_soulbound: bool,
    pub nft_mint: Pubkey,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Soulbound NFTs cannot be resold")]
    SoulboundNotResellable,
}
