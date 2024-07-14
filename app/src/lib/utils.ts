import { web3 } from '@coral-xyz/anchor';
import { MARKET_PROGRAM_ID } from './program';
import * as mpl from "@metaplex-foundation/mpl-token-metadata";

export function getNftMintPDA(vendor: web3.PublicKey, name: string) {
    return web3.PublicKey.findProgramAddressSync(
        [Buffer.from("nft_mint"), Buffer.from(name)],
        MARKET_PROGRAM_ID
    );
}

export function getServicePDA(name: string) {
    return web3.PublicKey.findProgramAddressSync(
        [Buffer.from("service"), Buffer.from(name)],
        MARKET_PROGRAM_ID
    );
}
export function getEscrowPDA(nft_mint: web3.PublicKey) {
    return web3.PublicKey.findProgramAddressSync(
        [Buffer.from("escrow"), nft_mint.toBuffer()],
        MARKET_PROGRAM_ID
    );

}

export function getMarketplacePDA() {
    return web3.PublicKey.findProgramAddressSync(
        [Buffer.from("marketplace")],
        MARKET_PROGRAM_ID
    );
}

export function getMetadataPDA(mint: anchor.web3.PublicKey) {
    return web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from("metadata"),
            new web3.PublicKey(mpl.MPL_TOKEN_METADATA_PROGRAM_ID.toString()).toBuffer(),
            mint.toBuffer(),
        ],
        new web3.PublicKey(mpl.MPL_TOKEN_METADATA_PROGRAM_ID.toString())
    );
}

export function getMarkedplaceVaultPDA(mint: web3.PublicKey) {
    return web3.PublicKey.findProgramAddressSync(
        [Buffer.from("marketplace_vault"), mint.toBuffer()],
        MARKET_PROGRAM_ID
    );
}



// Add other utility functions as needed