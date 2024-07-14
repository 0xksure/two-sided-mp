<script lang="ts">
    import { walletStore } from "@svelte-on-solana/wallet-adapter-core";
    import { getProgram } from "$lib/program";
    import { PUBLIC_RPC_URL } from "$env/static/public";

    import {
        getMarketplacePDA,
        getNftMintPDA,
        getServicePDA,
        getMarkedplaceVaultPDA,
        getEscrowPDA,
    } from "$lib/utils";
    import { web3, AnchorProvider } from "@coral-xyz/anchor";
    import { getAssociatedTokenAddress } from "@solana/spl-token";
    import ServiceCard from "$lib/components/ServiceCard.svelte";
    import { BN } from "bn.js";

    let ownedServices = [];
    let signature = null;
    let newPrice = 0;

    async function fetchOwnedServices() {
        if (!$walletStore.publicKey) return;
        if (!PUBLIC_RPC_URL) throw new Error("RPC_URL not set");

        const provider = new AnchorProvider(
            new web3.Connection(PUBLIC_RPC_URL),
            $walletStore as any,
            {},
        );
        const program = getProgram(provider);

        const [marketplacePDA] = getMarketplacePDA();
        const marketplaceAccount =
            await program.account.marketplace.fetch(marketplacePDA);

        ownedServices = (await program.account.service.all()).filter(
            (service) => service.account.vendor.equals($walletStore.publicKey),
        );
    }

    async function resellService(service) {
        if (!$walletStore.publicKey) return;
        if (!PUBLIC_RPC_URL) throw new Error("RPC_URL not set");

        const provider = new AnchorProvider(
            new web3.Connection(PUBLIC_RPC_URL),
            $walletStore as any,
            {},
        );
        const program = getProgram(provider);

        const [marketplacePDA] = getMarketplacePDA();
        const [nftMintPDA] = getNftMintPDA(service.vendor, service.name);
        const sellerNftAccount = await getAssociatedTokenAddress(
            nftMintPDA,
            $walletStore.publicKey,
        );
        const [marketplaceVaultPDA] = getMarkedplaceVaultPDA(service.tradeMint);
        const [escrowNftAccount] = await getEscrowPDA(nftMintPDA);
        const sellerPaymentAccount = await getAssociatedTokenAddress(
            service.tradeMint,
            $walletStore.publicKey,
        );

        try {
            const resellServiceIx = await program.methods
                .resellService(
                    service.name,
                    new BN(newPrice * web3.LAMPORTS_PER_SOL),
                )
                .accounts({
                    seller: $walletStore.publicKey,
                    marketplace: marketplacePDA,
                    marketplaceVault: marketplaceVaultPDA,
                    service: getServicePDA(service.name)[0],
                    nftMint: nftMintPDA,
                    listMint: service.tradeMint,
                    escrowNftAccount: escrowNftAccount,
                    sellerPaymentAccount: sellerPaymentAccount,
                    sellerNftAccount: sellerNftAccount,
                })
                .instruction();

            const ixs = [resellServiceIx];
            const txMessage = await new web3.TransactionMessage({
                instructions: ixs,
                recentBlockhash: (
                    await program.provider.connection.getLatestBlockhash()
                ).blockhash,
                payerKey: $walletStore.publicKey,
            }).compileToV0Message();

            const vtx = new web3.VersionedTransaction(txMessage);
            const signedTx = await $walletStore.signTransaction(vtx);
            signature = await provider.connection.sendTransaction(signedTx);
            await provider.connection.confirmTransaction({
                signature,
                ...(await provider.connection.getLatestBlockhash()),
            });
            console.log("signature: ", signature);
            alert("Service listed for resale successfully!");
            await fetchOwnedServices();
        } catch (error) {
            console.error("Error reselling service:", error);
            if (error.message.includes("Soulbound NFTs cannot be resold")) {
                alert("This service is soulbound and cannot be resold.");
            } else {
                alert("Error reselling service. Check console for details.");
            }
        }
    }

    $: if ($walletStore.publicKey) {
        fetchOwnedServices();
    }
</script>

<h2>Resell Service</h2>
{#if ownedServices.length === 0}
    <p>You don't own any services to resell.</p>
{:else}
    {#each ownedServices as service}
        <ServiceCard {...service} />
        <input
            type="number"
            bind:value={newPrice}
            placeholder="New price in SOL"
        />
        <button on:click={() => resellService(service)}>Resell</button>
    {/each}
{/if}
