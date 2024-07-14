<script lang="ts">
    import { walletStore } from "@svelte-on-solana/wallet-adapter-core";
    import { getProgram } from "$lib/program";
    import {
        getMarketplacePDA,
        getNftMintPDA,
        getServicePDA,
    } from "$lib/utils";
    import { web3, AnchorProvider } from "@coral-xyz/anchor";
    import { getAssociatedTokenAddress } from "@solana/spl-token";

    let serviceName = "";
    let serviceDescription = "";
    let servicePrice = 0;
    let isSoulbound = false;

    async function mintAndListService() {
        if (!$walletStore.publicKey) return;
        if (!process.env.RPC_URL) throw new Error("RPC_URL not set");
        const provider = new AnchorProvider(
            new web3.Connection(process.env.RPC_URL),
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
            await program.methods
                .mintService(serviceName, "https://example.com/metadata.json")
                .accounts({
                    vendor: $walletStore.publicKey,
                    marketplace: marketplacePDA,
                    nftMint: nftMintPDA,
                    vendorTokenAccount: vendorTokenAccount,
                    metadata: await getMetadataPDA(nftMintPDA),
                })
                .rpc();

            // List service
            await program.methods
                .listService(
                    serviceName,
                    serviceDescription,
                    new web3.BN(servicePrice * web3.LAMPORTS_PER_SOL),
                    paymentMint,
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
                    tokenMetadataProgram: mpl.MPL_TOKEN_METADATA_PROGRAM_ID,
                })
                .rpc();

            alert("Service minted and listed successfully!");
        } catch (error) {
            console.error("Error minting and listing service:", error);
        }
    }
</script>

<h2>Mint and List Service</h2>
<form on:submit|preventDefault={mintAndListService}>
    <input bind:value={serviceName} placeholder="Service Name" required />
    <input
        bind:value={serviceDescription}
        placeholder="Service Description"
        required
    />
    <input
        type="number"
        bind:value={servicePrice}
        placeholder="Price in SOL"
        required
    />
    <label>
        <input type="checkbox" bind:checked={isSoulbound} />
        Soulbound
    </label>
    <button type="submit">Mint and List Service</button>
</form>
