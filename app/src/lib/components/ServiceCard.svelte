<script lang="ts">
    import { TokenAccountOneTimeAuthMintMismatchError } from "@metaplex-foundation/mpl-token-metadata";
    import type BN from "bn.js";

    export let account: {
        name: string;
        description: string;
        price: BN;
        mint: string;
        isSoulbound: boolean;
    };
</script>

<div class="card">
    <h3>{`Title: ${account.name}`}</h3>
    <p>{account.description}</p>
    <p>Price: {account.price} {account.mint}</p>
    <p>Soulbound: {account.isSoulbound ? "Yes" : "No"}</p>
</div>

<style>
    .card {
        border: 1px solid #ccc;
        padding: 1rem;
        margin-bottom: 1rem;
    }
</style>
