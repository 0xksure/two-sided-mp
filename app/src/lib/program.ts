import { web3, Program, AnchorProvider } from '@coral-xyz/anchor';
import type { ServiceMarketplace } from './types/service_marketplace';
import idl from './idl/service_marketplace.json';

export const MARKET_PROGRAM_ID = new web3.PublicKey('92q1D3m2dHrmBWfpn5YZHaoG5pxkk5CTJH3e9SazdNC7');

export function getProgram(provider: AnchorProvider) {
    return new Program<ServiceMarketplace>(idl, provider);
}