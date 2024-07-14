<script lang="ts">
    import { walletStore } from "@svelte-on-solana/wallet-adapter-core";
    import { getProgram } from "$lib/program";
    import { getMint } from "@solana/spl-token";

    import {
        getEscrowPDA,
        getMarketplacePDA,
        getMetadataPDA,
        getNftMintPDA,
        getServicePDA,
    } from "$lib/utils";
    import { web3, AnchorProvider } from "@coral-xyz/anchor";
    import { getAssociatedTokenAddress } from "@solana/spl-token";
    import { BN } from "bn.js";
    import { MPL_TOKEN_METADATA_PROGRAM_ID } from "@metaplex-foundation/mpl-token-metadata";
    import { PUBLIC_RPC_URL } from "$env/static/public";
    import { PublicKey } from "@solana/web3.js";
    let serviceName = "";
    let serviceDescription = "";
    let servicePrice = 0;
    let isSoulbound = false;
    let paymentMint: string = null;
    let signature = null;

    async function mintAndListService() {
        if (!$walletStore.publicKey) throw new Error("Wallet not connected");
        if (!PUBLIC_RPC_URL) throw new Error("RPC_URL not set");
        paymentMint =
            paymentMint ??
            new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
        const provider = new AnchorProvider(
            new web3.Connection(PUBLIC_RPC_URL),
            $walletStore as any,
            {},
        );
        const program = getProgram(provider);

        const [marketplacePDA] = getMarketplacePDA();
        const [nftMintPDA] = getNftMintPDA($walletStore.publicKey, serviceName);
        const [servicePDA] = getServicePDA(serviceName);

        const vendorTokenAccount = await getAssociatedTokenAddress(
            nftMintPDA,
            $walletStore.publicKey,
        );

        try {
            // Mint service
            const mintServiceInstruction = await program.methods
                .mintService(serviceName, "https://example.com/metadata.json")
                .accounts({
                    vendor: $walletStore.publicKey,
                    marketplace: marketplacePDA,
                    nftMint: nftMintPDA,
                    vendorTokenAccount: vendorTokenAccount,
                    metadata: (await getMetadataPDA(nftMintPDA))[0],
                })
                .instruction();

            // List service
            const mint = await getMint(
                program.provider.connection,
                new PublicKey(paymentMint),
            );
            const listServiceInstruction = await program.methods
                .listService(
                    serviceName,
                    serviceDescription,
                    new BN(servicePrice * 10 ** mint.decimals),
                    new PublicKey(paymentMint),
                    isSoulbound,
                )
                .accounts({
                    vendor: $walletStore.publicKey,
                    marketplace: marketplacePDA,
                    service: servicePDA,
                    nftMint: nftMintPDA,
                    vendorTokenAccount: vendorTokenAccount,
                    escrowServiceAccount: (await getEscrowPDA(nftMintPDA))[0],
                    metadata: (await getMetadataPDA(nftMintPDA))[0],
                    tokenMetadataProgram: MPL_TOKEN_METADATA_PROGRAM_ID,
                })
                .instruction();
            const ixs = [mintServiceInstruction, listServiceInstruction];
            const txMessage = await new web3.TransactionMessage({
                instructions: ixs,
                recentBlockhash: (
                    await program.provider.connection.getLatestBlockhash()
                ).blockhash,
                payerKey: $walletStore.publicKey,
            }).compileToV0Message();

            const vtx = new web3.VersionedTransaction(txMessage);

            // sign
            // sign instruction and create transaction
            const signedTx = await $walletStore.signTransaction(vtx);
            console.log("signedTx: ", signedTx);
            signature = await provider.connection.sendTransaction(signedTx);
            await provider.connection.confirmTransaction({
                signature,
                ...(await provider.connection.getLatestBlockhash()),
            });
            console.log("signature: ", signature);

            alert("Service minted and listed successfully!");
        } catch (error) {
            console.error("Error minting and listing service:", error);
        }
    }
</script>

<h2>Mint and List Service</h2>
<div>
    <input bind:value={serviceName} placeholder="Service Name" required />
    <input
        bind:value={serviceDescription}
        placeholder="Service Description"
        required
    />
    <label class="">
        <input
            type="number"
            bind:value={servicePrice}
            placeholder="Price in USDC"
            required
        />
        <span>USDC</span>
        <label>
            <label>
                <input type="checkbox" bind:checked={isSoulbound} />
                Soulbound
            </label>
            <button on:click={mintAndListService}>Mint and List Service</button>
        </label></label
    >
</div>
{#if signature}
    <p>Signature: {signature}</p>
{/if}
