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
    import ServiceCard from "$lib/components/ServiceCard.svelte";

    let services = [];

    async function fetchServices() {
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

        services = await Promise.all(
            Array.from(
                { length: marketplaceAccount.totalServices },
                async (_, i) => {
                    const [servicePDA] = getServicePDA(`service_${i}`);
                    return program.account.service.fetch(servicePDA);
                },
            ),
        );
    }

    async function purchaseService(service) {
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
        const buyerNftAccount = await getAssociatedTokenAddress(
            nftMintPDA,
            $walletStore.publicKey,
        );

        try {
            await program.methods
                .buyService(service.name)
                .accounts({
                    buyer: $walletStore.publicKey,
                    vendor: service.vendor,
                    marketplace: marketplacePDA,
                    service: getServicePDA(service.name)[0],
                    tradeMint: service.tradeMint,
                    nftMint: nftMintPDA,
                    escrowNftAccount: (await getEscrowPDA(nftMintPDA))[0],
                    buyerNftAccount: buyerNftAccount,
                    buyerPaymentAccount: await getAssociatedTokenAddress(
                        service.tradeMint,
                        $walletStore.publicKey,
                    ),
                })
                .rpc();

            alert("Service purchased successfully!");
            await fetchServices();
        } catch (error) {
            console.error("Error purchasing service:", error);
        }
    }

    $: if ($walletStore.publicKey) {
        fetchServices();
    }
</script>

<h2>Purchase Service</h2>
{#each services as service}
    <ServiceCard {...service} />
    <button on:click={() => purchaseService(service)}>Purchase</button>
{/each}
