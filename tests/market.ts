import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ServiceMarketplace } from "../target/types/service_marketplace";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { assert } from "chai";
import * as web3 from "@solana/web3.js";

import * as mpl from "@metaplex-foundation/mpl-token-metadata";
import { publicDecrypt } from "crypto";
import { publicKey } from "@metaplex-foundation/umi";
const MARKET_PROGRAM_ID = new anchor.web3.PublicKey('EYk41B1oPd5hcTNcx7u2oGykSHHaEq4Uo9i2oYmZvDXb');

async function getMetadataPDA(mint: anchor.web3.PublicKey): Promise<anchor.web3.PublicKey> {
  const [metadataPDA] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      new web3.PublicKey(mpl.MPL_TOKEN_METADATA_PROGRAM_ID.toString()).toBuffer(),
      mint.toBuffer(),
    ],
    new web3.PublicKey(mpl.MPL_TOKEN_METADATA_PROGRAM_ID.toString())
  );
  return metadataPDA;
}

function getNftMintPDA(vendor: anchor.web3.PublicKey, name: string) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("nft_mint"), vendor.toBuffer(), Buffer.from(name)],
    MARKET_PROGRAM_ID
  );
}

function getServicePDA(name: string) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("service"), Buffer.from(name)],
    MARKET_PROGRAM_ID
  );
}

describe("service-marketplace", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ServiceMarketplace as Program<ServiceMarketplace>;

  const marketplaceAuth = anchor.web3.Keypair.generate();
  const vendor = anchor.web3.Keypair.generate();
  const buyer = anchor.web3.Keypair.generate();

  let marketplacePDA: anchor.web3.PublicKey;
  let marketplaceBump: number;

  let paymentMint: anchor.web3.PublicKey;

  before(async () => {
    // Airdrop SOL to accounts and confirm transactions
    async function airdropAndConfirm(pubkey: anchor.web3.PublicKey, amount: number) {
      const sig = await provider.connection.requestAirdrop(pubkey, amount);
      await provider.connection.confirmTransaction(sig);
    }

    await airdropAndConfirm(marketplaceAuth.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await airdropAndConfirm(vendor.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
    await airdropAndConfirm(buyer.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);

    // Create payment mint
    paymentMint = await createMint(
      provider.connection,
      marketplaceAuth,
      marketplaceAuth.publicKey,
      null,
      6
    );
  });
  it.only("Initializes the marketplace", async () => {
    [marketplacePDA, marketplaceBump] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("mpl_marketplace")],
      program.programId
    );

    await program.methods
      .initializeMarketplace()
      .accounts({
        authority: marketplaceAuth.publicKey,
        marketplace: marketplacePDA,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([marketplaceAuth])
      .rpc();

    const marketplaceAccount = await program.account.marketplace.fetch(marketplacePDA);
    assert.equal(marketplaceAccount.authority.toBase58(), marketplaceAuth.publicKey.toBase58());
    assert.equal(marketplaceAccount.totalServices, 0);
    assert.equal(marketplaceAccount.royaltyPercentage, 5);
  });

  it.only("Create a service", async () => {
    const name = "test1"
    const nftMintPda = getNftMintPDA(vendor.publicKey, name);
    const vendorTokenAccount = await getAssociatedTokenAddress(nftMintPda[0], vendor.publicKey);

    const [servicePDA] = getServicePDA(name)

    const metadataPDA = await getMetadataPDA(nftMintPda[0]);
    console.log(`vendor ${vendor.publicKey.toBase58()}, nft_mint: ${nftMintPda[0].toBase58()}, service: ${servicePDA.toBase58()}, metadata: ${metadataPDA.toBase58()}`);
    await program.methods
      .createService(name, "https://example.com/metadata.json")
      .accounts({
        vendor: vendor.publicKey,
        marketplace: marketplacePDA,
        service: servicePDA,
        nftMint: nftMintPda[0],
        vendorTokenAccount: vendorTokenAccount,
        metadata: metadataPDA,
      })
      .signers([vendor])
      .rpc();
    console.log("done")

    const serviceAccount = await program.account.service.fetch(servicePDA);
    assert.equal(serviceAccount.vendor.toBase58(), vendor.publicKey.toBase58());
    assert.equal(serviceAccount.name, name);
    assert.equal(serviceAccount.description, "A test service description");
    assert.equal(serviceAccount.price.toNumber(), 1000000);
    assert.equal(serviceAccount.isSoulbound, false);
    assert.equal(serviceAccount.nftMint.toBase58(), nftMintPda[0].toBase58());



  });

  it("List a service", async () => {
    const serviceName = "test1"
    const nftMint = await createMint(provider.connection, vendor, vendor.publicKey, null, 0);
    const vendorTokenAccount = await createAssociatedTokenAccount(provider.connection, vendor, nftMint, vendor.publicKey);

    const [servicePDA] = getServicePDA(serviceName)
    await program.methods
      .listService(serviceName, "A test service description", new anchor.BN(1000000), paymentMint, false)
      .accounts({
        vendor: vendor.publicKey,
        marketplace: marketplacePDA,
        service: servicePDA,
        nftMint: nftMint,
        vendorTokenAccount: vendorTokenAccount,
        metadata: await getMetadataPDA(nftMint),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenMetadataProgram: mpl.MPL_TOKEN_METADATA_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([vendor])
      .rpc();

    const serviceAccount = await program.account.service.fetch(servicePDA);
    assert.equal(serviceAccount.vendor.toBase58(), vendor.publicKey.toBase58());
    assert.equal(serviceAccount.name, serviceName);
    assert.equal(serviceAccount.description, "A test service description");
    assert.equal(serviceAccount.price.toNumber(), 1000000);
    assert.equal(serviceAccount.isSoulbound, false);
    assert.equal(serviceAccount.nftMint.toBase58(), nftMint.toBase58());

    const marketplaceAccount = await program.account.marketplace.fetch(marketplacePDA);
    assert.equal(marketplaceAccount.totalServices, 1);

  });
  it("Purchases a service", async () => {
    try {
      const serviceName = "test2"
      const nftMintPda = getNftMintPDA(vendor.publicKey, serviceName);
      console.log("create vendor token account")
      const vendorTokenAccount = await getAssociatedTokenAddress(nftMintPda[0], vendor.publicKey);
      console.log("create buyer token account")
      const buyerTokenAccount = await getAssociatedTokenAddress(nftMintPda[0], buyer.publicKey);



      const [servicePDA] = getServicePDA(serviceName)
      const metadataPDA = await getMetadataPDA(nftMintPda[0]);

      // List the service
      console.log(`vendor ${vendor.publicKey.toBase58()}, nft_mint: ${nftMintPda[0].toBase58()}, service: ${servicePDA.toBase58()}, metadata: ${metadataPDA.toBase58()}`);
      await program.methods
        .createService(serviceName, "A test service description", new anchor.BN(1000000), paymentMint, false, "https://example.com/metadata.json")
        .accounts({
          vendor: vendor.publicKey,
          marketplace: marketplacePDA,
          service: servicePDA,
          nftMint: nftMintPda[0],
          vendorTokenAccount: vendorTokenAccount,
          metadata: metadataPDA,
        })
        .signers([vendor])
        .rpc();

      console.log("create buyer payment account")
      // Create and fund buyer's payment account
      const buyerPaymentAccount = await createAssociatedTokenAccount(provider.connection, buyer, paymentMint, buyer.publicKey);
      await mintTo(provider.connection, marketplaceAuth, paymentMint, buyerPaymentAccount, marketplaceAuth, 2000000);

      // Create vendor's payment account
      const vendorPaymentAccount = await createAssociatedTokenAccount(provider.connection, vendor, paymentMint, vendor.publicKey);

      // Purchase the service
      console.log(`buyer ${buyer.publicKey.toBase58()}, vendor ${vendor.publicKey.toBase58()}, service: ${servicePDA.toBase58()}, nft_mint: ${nftMintPda[0].toBase58()}, vendorTokenAccount: ${vendorTokenAccount.toBase58()}, buyerTokenAccount: ${buyerTokenAccount.toBase58()}, buyerPaymentAccount: ${buyerPaymentAccount.toBase58()}, vendorPaymentAccount: ${vendorPaymentAccount.toBase58()}`);
      await program.methods
        .purchaseService()
        .accounts({
          buyer: buyer.publicKey,
          vendor: vendor.publicKey,
          service: servicePDA,
          tradeMint: paymentMint,
          nftMint: nftMintPda[0],
          vendorTokenAccount: vendorTokenAccount,
          buyerTokenAccount: buyerTokenAccount,
          buyerPaymentAccount: buyerPaymentAccount,
          vendorPaymentAccount: vendorPaymentAccount,
        })
        .signers([buyer])
        .rpc();

      // Check NFT ownership
      const buyerNftBalance = await provider.connection.getTokenAccountBalance(buyerTokenAccount);
      assert.equal(buyerNftBalance.value.uiAmount, 1);

      // Check payment
      const vendorPaymentBalance = await provider.connection.getTokenAccountBalance(vendorPaymentAccount);
      assert.equal(vendorPaymentBalance.value.uiAmount, 1);
    } catch (e) {
      console.log(e)
    }
  });

  it("Resells a service", async () => {
    const serviceName = "test3"
    const nftMint = await createMint(provider.connection, vendor, vendor.publicKey, null, 0);
    const vendorTokenAccount = await createAssociatedTokenAccount(provider.connection, vendor, nftMint, vendor.publicKey);
    const buyerTokenAccount = await createAssociatedTokenAccount(provider.connection, buyer, nftMint, buyer.publicKey);
    const newBuyer = anchor.web3.Keypair.generate();
    const newBuyerTokenAccount = await createAssociatedTokenAccount(provider.connection, newBuyer, nftMint, newBuyer.publicKey);

    const [servicePDA] = getServicePDA(serviceName)
    // List and purchase the service (reusing previous test logic)
    // ...

    // Create and fund new buyer's payment account
    const newBuyerPaymentAccount = await createAssociatedTokenAccount(provider.connection, newBuyer, paymentMint, newBuyer.publicKey);
    await mintTo(provider.connection, marketplaceAuth, paymentMint, newBuyerPaymentAccount, marketplaceAuth, 2000000);

    // Resell the service
    await program.methods
      .resellService(new anchor.BN(1500000))
      .accounts({
        seller: buyer.publicKey,
        buyer: newBuyer.publicKey,
        vendor: vendor.publicKey,
        marketplace: marketplacePDA,
        service: servicePDA,
        nftMint: nftMint,
        sellerTokenAccount: buyerTokenAccount,
        buyerTokenAccount: newBuyerTokenAccount,
        buyerPaymentAccount: newBuyerPaymentAccount,
        sellerPaymentAccount: await createAssociatedTokenAccount(provider.connection, buyer, paymentMint, buyer.publicKey),
        vendorPaymentAccount: await createAssociatedTokenAccount(provider.connection, vendor, paymentMint, vendor.publicKey),
      })
      .signers([buyer, newBuyer])
      .rpc();

    // Check NFT ownership
    const newBuyerNftBalance = await provider.connection.getTokenAccountBalance(newBuyerTokenAccount);
    assert.equal(newBuyerNftBalance.value.uiAmount, 1);

    // Check payments (including royalties)
    const sellerPaymentBalance = await provider.connection.getTokenAccountBalance(await createAssociatedTokenAccount(provider.connection, buyer, paymentMint, buyer.publicKey));
    assert.equal(sellerPaymentBalance.value.uiAmount, 1.425); // 95% of 1.5 SOL

    const vendorRoyaltyBalance = await provider.connection.getTokenAccountBalance(await createAssociatedTokenAccount(provider.connection, vendor, paymentMint, vendor.publicKey));
    assert.equal(vendorRoyaltyBalance.value.uiAmount, 0.075); // 5% of 1.5 SOL
  });

  it("Fails to resell a soulbound service", async () => {
    const serviceName = "test4"
    const nftMint = await createMint(provider.connection, vendor, vendor.publicKey, null, 0);
    const vendorTokenAccount = await createAssociatedTokenAccount(provider.connection, vendor, nftMint, vendor.publicKey);
    const buyerTokenAccount = await createAssociatedTokenAccount(provider.connection, buyer, nftMint, buyer.publicKey);

    const [servicePDA] = getServicePDA(serviceName)

    // List soulbound service
    await program.methods
      .listService(serviceName, "A soulbound service description", new anchor.BN(1000000), true, "https://example.com/metadata.json")
      .accounts({
        vendor: vendor.publicKey,
        marketplace: marketplacePDA,
        service: servicePDA,
        nftMint: nftMint,
        vendorTokenAccount: vendorTokenAccount,
        metadata: await getMetadataPDA(nftMint),
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenMetadataProgram: mpl.MPL_TOKEN_METADATA_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([vendor])
      .rpc();

    // Purchase soulbound service
    // ... (similar to previous purchase logic)

    // Attempt to resell soulbound service
    try {
      await program.methods
        .resellService(new anchor.BN(1500000))
        .accounts({
          seller: buyer.publicKey,
          buyer: anchor.web3.Keypair.generate().publicKey,
          vendor: vendor.publicKey,
          marketplace: marketplacePDA,
          service: servicePDA,
          nftMint: nftMint,
          sellerTokenAccount: buyerTokenAccount,
          buyerTokenAccount: await createAssociatedTokenAccount(provider.connection, anchor.web3.Keypair.generate(), nftMint, anchor.web3.Keypair.generate().publicKey),
          buyerPaymentAccount: await createAssociatedTokenAccount(provider.connection, anchor.web3.Keypair.generate(), paymentMint, anchor.web3.Keypair.generate().publicKey),
          sellerPaymentAccount: await createAssociatedTokenAccount(provider.connection, buyer, paymentMint, buyer.publicKey),
          vendorPaymentAccount: await createAssociatedTokenAccount(provider.connection, vendor, paymentMint, vendor.publicKey),
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();
      assert.fail("Expected an error when reselling a soulbound service");
    } catch (error) {
      assert.include(error.message, "Soulbound NFTs cannot be resold");
    }
  });
});

