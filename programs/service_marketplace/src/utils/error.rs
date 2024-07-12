use anchor_lang::prelude::*;
#[error_code]
pub enum ErrorCode {
    #[msg("Soulbound NFTs cannot be resold")]
    SoulboundNotResellable,
}
