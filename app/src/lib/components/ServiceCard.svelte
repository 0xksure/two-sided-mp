<script lang="ts">
    export let name: string;
    export let description: string;
    export let price: number;
    export let isSoulbound: boolean;
</script>

<div class="card">
    <h3>{name}</h3>
    <p>{description}</p>
    <p>Price: {price} SOL</p>
    <p>Soulbound: {isSoulbound ? "Yes" : "No"}</p>
</div>

<style>
    .card {
        border: 1px solid #ccc;
        padding: 1rem;
        margin-bottom: 1rem;
    }
</style>
