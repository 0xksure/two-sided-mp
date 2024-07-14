<script lang="ts">
    import { walletStore } from "@svelte-on-solana/wallet-adapter-core";
    import { getProgram } from "$lib/program";
    import {
        getMarketplacePDA,
        getNftMintPDA,
        getServicePDA,
        getMarkedplaceVaultPDA,
        getEscrowPDA,
    } from "$lib/utils";
    import { web3, AnchorProvider, BN } from "@coral-xyz/anchor";
    import { getAssociatedTokenAddress } from "@solana/spl-token";
    import ServiceCard from "$lib/components/ServiceCard.svelte";

    let ownedServices = [];
    let newPrice = 0;

    async function fetchOwnedServices() {
        if (!$walletStore.publicKey) return;
        if (!process.env.RPC_URL) throw new Error("RPC_URL not set");

        const provider = new AnchorProvider(
            new web3.Connection(process.env.RPC_URL),
            $walletStore as any,
            {},
        );
        const program = getProgram(provider);

        const [marketplacePDA] = getMarketplacePDA();
        const marketplaceAccount =
            await program.account.marketplace.fetch(marketplacePDA);

        ownedServices = (
            await Promise.all(
                Array.from(
                    { length: marketplaceAccount.totalServices },
                    async (_, i) => {
                        const [servicePDA] = getServicePDA(`service_${i}`);
                        const service =
                            await program.account.service.fetch(servicePDA);
                        const [nftMintPDA] = getNftMintPDA(
                            service.vendor,
                            service.name,
                        );
                        const buyerNftAccount = await getAssociatedTokenAddress(
                            nftMintPDA,
                            $walletStore.publicKey,
                        );
                        const balance =
                            await provider.connection.getTokenAccountBalance(
                                buyerNftAccount,
                            );
                        return balance.value.uiAmount > 0 ? service : null;
                    },
                ),
            )
        ).filter(Boolean);
    }

    async function resellService(service) {
        if (!$walletStore.publicKey) return;
        if (!process.env.RPC_URL) throw new Error("RPC_URL not set");

        const provider = new AnchorProvider(
            new web3.Connection(process.env.RPC_URL),
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
            await program.methods
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
                .rpc();

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
