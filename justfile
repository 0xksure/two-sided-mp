rpc_url_devnet := env_var('RPC_URL_DEVNET')

# Deploy project to devnet
deploy_devnet:
    @echo "Deploying Bounty to devnet ..."
    anchor deploy --provider.cluster {{rpc_url_devnet}} --provider.wallet ~/.config/solana/id.json
