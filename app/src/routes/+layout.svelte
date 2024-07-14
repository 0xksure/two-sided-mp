<script lang="ts">
    import WalletMultiButton from "$lib/components/WalletMultiButton.svelte";
    import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
    import { WalletProvider } from "@svelte-on-solana/wallet-adapter-ui";
    import { onMount } from "svelte";

    let wallets = [new PhantomWalletAdapter()];
    const localStorageKey = "walletAdapter";

    onMount(async () => {
        const {
            PhantomWalletAdapter,
            SolflareWalletAdapter,
            TorusWalletAdapter,
        } = await import("@solana/wallet-adapter-wallets");

        const walletsMap = [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            new TorusWalletAdapter(),
        ];

        wallets = walletsMap;
    });
</script>

<WalletProvider {localStorageKey} {wallets} autoConnect />
<nav>
    <a href="/">Home</a>
    <a href="/initialize">Initialize Marketplace</a>
    <a href="/mint-and-list">Mint and List Service</a>
    <a href="/purchase">Purchase Service</a>
    <a href="/resell">Resell Service</a>
    <WalletMultiButton />
</nav>

<slot />
