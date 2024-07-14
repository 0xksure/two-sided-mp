<script lang="ts">
    import { walletStore } from "@svelte-on-solana/wallet-adapter-core";
    import { getProgram } from "$lib/program";
    import { getMarketplacePDA } from "$lib/utils";
    import { web3, AnchorProvider } from "@coral-xyz/anchor";
    import { PUBLIC_RPC_URL } from "$env/static/public";
    import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

    let initialized = false;
    let signature = null;
    async function initializeMarketplace() {
        console.log("initializeMarketplace: ", $walletStore);
        if (!$walletStore.publicKey) throw new Error("Wallet not connected");

        const provider = new AnchorProvider(
            new web3.Connection(PUBLIC_RPC_URL),
            {
                preflightCommitment: "recent",
                commitment: "confirmed",
            },
        );
        const program = getProgram(provider);

        const [marketplacePDA] = getMarketplacePDA();

        try {
            const instruction = await program.methods
                .initializeMarketplace()
                .accounts({
                    authority: $walletStore.publicKey,
                    marketplace: marketplacePDA,
                })
                .instruction();

            const txMessage = await new web3.TransactionMessage({
                instructions: [instruction],
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

            initialized = true;
        } catch (error) {
            console.error("Error initializing marketplace:", error);
        }
    }
</script>

<h2>Initialize Marketplace</h2>
{#if initialized}
    <p>Marketplace initialized successfully!</p>
{:else}
    <button on:click={initializeMarketplace}>Initialize Marketplace</button>
{/if}
{#if signature}
    <p>Signature: {signature}</p>
{/if}
