<script lang="ts">
    import { walletStore } from "@svelte-on-solana/wallet-adapter-core";
    import { getProgram } from "$lib/program";
    import {
        getEscrowPDA,
        getMarketplacePDA,
        getNftMintPDA,
        getServicePDA,
    } from "$lib/utils";
    import { web3, AnchorProvider } from "@coral-xyz/anchor";
    import { getAssociatedTokenAddress, getMint } from "@solana/spl-token";
    import ServiceCard from "$lib/components/ServiceCard.svelte";
    import { PUBLIC_RPC_URL } from "$env/static/public";
    import { BN } from "bn.js";
    import { PublicKey } from "@solana/web3.js";

    let services = [];
    let signature = null;

    async function fetchServices() {
        if (!$walletStore.publicKey) throw new Error("Wallet not connected");
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

        services = await Promise.all(
            (await program.account.service.all()).map(async (service) => {
                const mint = await getMint(
                    program.provider.connection,
                    service.account.mint,
                );
                const price =
                    service.account.price.toNumber() / 10 ** mint.decimals;
                return {
                    ...service,
                    account: {
                        ...service.account,
                        vendor: service.account.vendor.toString(),
                        mint: service.account.mint.toString(),
                        name: service.account.name.toString(),
                        price: price,
                    },
                };
            }),
        );
        console.log("services: ", services);
    }

    async function purchaseService(service) {
        if (!$walletStore.publicKey) return;
        if (!PUBLIC_RPC_URL) throw new Error("RPC_URL not set");

        const provider = new AnchorProvider(
            new web3.Connection(PUBLIC_RPC_URL),
            $walletStore as any,
            {},
        );
        const program = getProgram(provider);

        const [marketplacePDA] = getMarketplacePDA();
        const [nftMintPDA] = getNftMintPDA(
            service.account.vendor,
            service.account.name,
        );
        const buyerNftAccount = await getAssociatedTokenAddress(
            nftMintPDA,
            $walletStore.publicKey,
        );

        try {
            const buyServiceIx = await program.methods
                .buyService(service.account.name)
                .accounts({
                    buyer: $walletStore.publicKey,
                    vendor: service.account.vendor,
                    marketplace: marketplacePDA,
                    service: getServicePDA(service.account.name)[0],
                    tradeMint: service.account.mint,
                    nftMint: nftMintPDA,
                    escrowNftAccount: (await getEscrowPDA(nftMintPDA))[0],
                    buyerNftAccount: buyerNftAccount,
                    buyerPaymentAccount: await getAssociatedTokenAddress(
                        new PublicKey(service.account.mint),
                        $walletStore.publicKey,
                    ),
                })
                .instruction();
            const ixs = [buyServiceIx];
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
            signature = await provider.connection.sendTransaction(signedTx);
            await provider.connection.confirmTransaction({
                signature,
                ...(await provider.connection.getLatestBlockhash()),
            });
            console.log("signature: ", signature);

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
{#if signature}
    <p>Signature: {signature}</p>
{/if}
