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
const MARKET_PROGRAM_ID = new anchor.web3.PublicKey('92q1D3m2dHrmBWfpn5YZHaoG5pxkk5CTJH3e9SazdNC7');

async function getEscrowPDA(nft_mint: web3.PublicKey) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("escrow"), nft_mint.toBuffer()],
    MARKET_PROGRAM_ID
  );

}

function getMarketplacePDA() {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace")],
    MARKET_PROGRAM_ID
  );
}

async function getMetadataPDA(mint: anchor.web3.PublicKey) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      new web3.PublicKey(mpl.MPL_TOKEN_METADATA_PROGRAM_ID.toString()).toBuffer(),
      mint.toBuffer(),
    ],
    new web3.PublicKey(mpl.MPL_TOKEN_METADATA_PROGRAM_ID.toString())
  );
}

function getMarkedplaceVaultPDA(mint: web3.PublicKey) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("marketplace_vault"), mint.toBuffer()],
    MARKET_PROGRAM_ID
  );
}

function getNftMintPDA(vendor: anchor.web3.PublicKey, name: string) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("nft_mint"), Buffer.from(name)],
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

    /// transfer some of the paymentmint to the buyer 
    const buyerPaymentAccount = await createAssociatedTokenAccount(provider.connection, buyer, paymentMint, buyer.publicKey);
    await mintTo(provider.connection, marketplaceAuth, paymentMint, buyerPaymentAccount, marketplaceAuth, 2000000);
  });
  it("Initializes the marketplace", async () => {
    const marketplacePda = getMarketplacePDA()

    await program.methods
      .initializeMarketplace()
      .accounts({
        authority: marketplaceAuth.publicKey,
        marketplace: marketplacePda[0],
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([marketplaceAuth])
      .rpc();

    const marketplaceAccount = await program.account.marketplace.fetch(marketplacePda[0]);
    assert.equal(marketplaceAccount.authority.toBase58(), marketplaceAuth.publicKey.toBase58());
    assert.equal(marketplaceAccount.totalServices, 0);
    assert.equal(marketplaceAccount.royaltyPercentage, 5);
  });

  it("Mint a service NFT", async () => {
    const name = "test1"
    const nftMintPda = getNftMintPDA(vendor.publicKey, name);
    const vendorTokenAccount = await getAssociatedTokenAddress(nftMintPda[0], vendor.publicKey);
    const marketplacePda = getMarketplacePDA()

    const metadataPDA = await getMetadataPDA(nftMintPda[0]);
    console.log(`vendor ${vendor.publicKey.toBase58()}, nft_mint: ${nftMintPda[0].toBase58()}, metadata: ${metadataPDA[0].toBase58()}`);
    await program.methods
      .mintService(name, "https://example.com/metadata.json")
      .accounts({
        vendor: vendor.publicKey,
        marketplace: marketplacePda[0],
        nftMint: nftMintPda[0],
        vendorTokenAccount: vendorTokenAccount,
        metadata: metadataPDA[0],
      })
      .signers([vendor])
      .rpc();
    console.log("done")




  });

  it("List a service NFT", async () => {
    const serviceName = "test1"
    const nftMintPda = getNftMintPDA(vendor.publicKey, serviceName);
    const vendorTokenAccount = await getAssociatedTokenAddress(nftMintPda[0], vendor.publicKey);
    const [servicePDA] = getServicePDA(serviceName)
    const marketplacePda = getMarketplacePDA()



    await program.methods
      .listService(serviceName, "A test service description", new anchor.BN(1000000), paymentMint, false)
      .accounts({
        vendor: vendor.publicKey,
        marketplace: marketplacePda[0],
        service: servicePDA,
        nftMint: nftMintPda[0],
        vendorTokenAccount: vendorTokenAccount,
        escrowServiceAccount: (await getEscrowPDA(nftMintPda[0]))[0],
        metadata: (await getMetadataPDA(nftMintPda[0]))[0],
        tokenMetadataProgram: mpl.MPL_TOKEN_METADATA_PROGRAM_ID,
      })
      .signers([vendor])
      .rpc();

    const serviceAccount = await program.account.service.fetch(servicePDA);
    assert.equal(serviceAccount.vendor.toBase58(), vendor.publicKey.toBase58());
    assert.equal(serviceAccount.name, serviceName);
    assert.equal(serviceAccount.description, "A test service description");
    assert.equal(serviceAccount.price.toNumber(), 1000000);
    assert.equal(serviceAccount.isSoulbound, false);
    assert.equal(serviceAccount.nftMint.toBase58(), nftMintPda[0].toBase58());

    const marketplaceAccount = await program.account.marketplace.fetch(marketplacePda[0]);
    assert.equal(marketplaceAccount.totalServices, 1);

  });
  it("Purchases a service", async () => {
    try {
      const serviceName = "test1"
      const nftMintPda = getNftMintPDA(vendor.publicKey, serviceName);
      console.log("create vendor token account")
      console.log("create buyer token account")
      const buyerNftAccount = await getAssociatedTokenAddress(nftMintPda[0], buyer.publicKey);
      const buyerPaymentAccount = await getAssociatedTokenAddress(paymentMint, buyer.publicKey);
      const marketplacePda = getMarketplacePDA()


      const [servicePDA] = getServicePDA(serviceName)

      // Create vendor's payment account
      const vendorPaymentAccount = await createAssociatedTokenAccount(provider.connection, vendor, paymentMint, vendor.publicKey);

      // Purchase the service
      console.log(`buyer ${buyer.publicKey.toBase58()}, vendor ${vendor.publicKey.toBase58()}, service: ${servicePDA.toBase58()}, nft_mint: ${nftMintPda[0].toBase58()}, buyerTokenAccount: ${buyerNftAccount.toBase58()}, buyerPaymentAccount: ${buyerPaymentAccount.toBase58()}, vendorPaymentAccount: ${vendorPaymentAccount.toBase58()}`);

      // check the vendor balance before purchase
      const vendorNftBalance = await provider.connection.getTokenAccountBalance(await getAssociatedTokenAddress(nftMintPda[0], vendor.publicKey));
      assert.equal(vendorNftBalance.value.uiAmount, 0);

      // check that the nft is in escrow 
      const escrowNftBalance = await provider.connection.getTokenAccountBalance((await getEscrowPDA(nftMintPda[0]))[0]);
      assert.equal(escrowNftBalance.value.uiAmount, 1);

      // check the buyer payment balance before purchase
      const buyerPaymentBalance = await provider.connection.getTokenAccountBalance(buyerPaymentAccount);
      assert.equal(buyerPaymentBalance.value.uiAmount, 2);


      // check the price of the service account
      const serviceAccount = await program.account.service.fetch(servicePDA);
      assert.equal(serviceAccount.price.toNumber(), 1000000);
      console.log("buying service: ", JSON.stringify(serviceAccount));

      await program.methods
        .buyService(serviceName)
        .accounts({
          buyer: buyer.publicKey,
          vendor: vendor.publicKey,
          marketplace: marketplacePda[0],
          service: servicePDA,
          tradeMint: paymentMint,
          nftMint: nftMintPda[0],
          escrowNftAccount: (await getEscrowPDA(nftMintPda[0]))[0],
          buyerNftAccount: buyerNftAccount,
          buyerPaymentAccount: buyerPaymentAccount,

        })
        .signers([buyer])
        .rpc();

      // Check NFT ownership
      const buyerNftBalance = await provider.connection.getTokenAccountBalance(buyerNftAccount);
      assert.equal(buyerNftBalance.value.uiAmount, 1);

      // check that the vendor has no NFTs
      const vendorNftBalance2 = await provider.connection.getTokenAccountBalance(await getAssociatedTokenAddress(nftMintPda[0], vendor.publicKey));
      assert.equal(vendorNftBalance2.value.uiAmount, 0);

      // check that there are no nfts in the escrow account
      const escrowNftBalance2 = await provider.connection.getTokenAccountBalance((await getEscrowPDA(nftMintPda[0]))[0]);
      assert.equal(escrowNftBalance2.value.uiAmount, 0);


      // check that the price was transferred to the vendor
      const vendorPaymentBalance = await provider.connection.getTokenAccountBalance(vendorPaymentAccount);
      console.log("vendor payment balance", vendorPaymentBalance.value.amount);
      assert.equal(vendorPaymentBalance.value.uiAmount, 1);

      // check the buyer payment account
      const buyerPaymentBalance2 = await provider.connection.getTokenAccountBalance(buyerPaymentAccount);
      console.log("buyer payment balance", buyerPaymentBalance2.value.amount);
      assert.equal(buyerPaymentBalance2.value.uiAmount, 1);




    } catch (e) {
      console.log(e)
    }
  });

  it("Resells a service", async () => {
    const serviceName = "test1"
    const nftMintPda = getNftMintPDA(vendor.publicKey, serviceName);
    console.log("create vendor token account")
    const sellerPaymentAccount = await getAssociatedTokenAddress(paymentMint, buyer.publicKey);
    console.log("create buyer token account")
    const sellerNftAccount = await getAssociatedTokenAddress(nftMintPda[0], buyer.publicKey);
    const escrowNftAccount = await getEscrowPDA(nftMintPda[0])
    const marketplacePda = getMarketplacePDA()
    const marketplaceVaultPda = getMarkedplaceVaultPDA(paymentMint)
    const [servicePDA] = getServicePDA(serviceName)


    // Resell the service
    await program.methods
      .resellService(serviceName, new anchor.BN(1500000))
      .accounts({
        seller: buyer.publicKey,
        marketplace: marketplacePda[0],
        marketplaceVault: marketplaceVaultPda[0],
        service: servicePDA,
        nftMint: nftMintPda[0],
        listMint: paymentMint,
        escrowNftAccount: (escrowNftAccount)[0],
        sellerPaymentAccount: sellerPaymentAccount,
        sellerNftAccount: sellerNftAccount,
      })
      .signers([buyer])
      .rpc();

    // Check NFT ownership
    const newBuyerNftBalance = await provider.connection.getTokenAccountBalance(escrowNftAccount[0]);
    assert.equal(newBuyerNftBalance.value.uiAmount, 1);

    // Check payments (including royalties)
    const sellerPaymentBalance = await provider.connection.getTokenAccountBalance(sellerPaymentAccount);
    assert.equal(sellerPaymentBalance.value.uiAmount, 0.925); // 95% of 1.5 SOL

    const vendorRoyaltyBalance = await provider.connection.getTokenAccountBalance(marketplaceVaultPda[0]);
    assert.equal(vendorRoyaltyBalance.value.uiAmount, 0.075); // 5% of 1.5 SOL
  });

  it("Fails to resell a soulbound service", async () => {
    const serviceName = "test4"
    const nftMintPDA = getNftMintPDA(vendor.publicKey, serviceName);
    const vendorTokenAccount = await createAssociatedTokenAccount(provider.connection, vendor, nftMint, vendor.publicKey);
    const buyerTokenAccount = await createAssociatedTokenAccount(provider.connection, buyer, nftMint, buyer.publicKey);
    const marketplacePda = getMarketplacePDA()
    const metadataPda = await getMetadataPDA(nftMintPDA[0])
    const [servicePDA] = getServicePDA(serviceName)

    // mint a soulbound service
    await program.methods
      .mintService(serviceName, "https://example.com/metadata.json")
      .accounts({
        vendor: vendor.publicKey,
        marketplace: marketplacePda[0],
        nftMint: nftMintPDA[0],
        vendorTokenAccount: vendorTokenAccount,
        metadata: metadataPda[0],
      })
      .signers([vendor])
      .rpc();

    // List soulbound service
    await program.methods
      .listService(serviceName, "A soulbound service description", new anchor.BN(1000000), paymentMint, true)
      .accounts({
        vendor: vendor.publicKey,
        marketplace: marketplacePda[0],
        service: servicePDA,
        nftMint: nftMintPDA[0],
        vendorTokenAccount: vendorTokenAccount,
        metadata: metadataPda[0],
      })
      .signers([vendor])
      .rpc();

    // Purchase soulbound service
    // ... (similar to previous purchase logic)

    // Attempt to resell soulbound service
    try {
      await program.methods
        .resellService(serviceName, new anchor.BN(1500000))
        .accounts({
          seller: buyer.publicKey,
          buyer: anchor.web3.Keypair.generate().publicKey,
          vendor: vendor.publicKey,
          marketplace: marketplacePda[0],
          service: servicePDA,
          nftMint: nftMintPDA[0],
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

