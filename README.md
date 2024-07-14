# A simple 2 sided marketplace for tokenized services

Devnet deployment: `92q1D3m2dHrmBWfpn5YZHaoG5pxkk5CTJH3e9SazdNC7`

The program assumes
- Rust version 1.79.0
- Solana CLI 1.18.12
- Anchor 0.30.1


## Assumptions

I assume that by soulbound NFTs it is meant that the mint is freezed and the the freeze authority is sat to 0 or in the case of the token22 program the immutable owner is set to true. I simply make the check 

## Functionality
The program has the following functionality
- Initialize marketplace: initialization of the program and set global program state. 
- Mint service: Allows anyone to mint a service. It uses the metaplex metadata program. 
- List service: List the service and transfer the service NFT to to program escrow account.
- Buy service: Allows anyone to purchase a service for a fixed price. The service NFT is then tranferred to the new buyer. 
- Resell service: Allows the holder of the service NFT to resell the service by placing the NFT in an escrow. If the NFT is soulbound this would fail. Royalties according to the values set in the marketplace account. 

The marketplace is immutable. 

## Tests

All the tests can be found under tests/ and can be invoked by using `anchor test`.

## Demo

There is also a very simple demo application under app/. It is built using yarn and sveltekit. You can run the application and interact with the devnet deployment by running `yarn run dev` in you terminal in app/. 

## Improvements
There are many improvements that I did not find time to complete. These are

- Allow the price to be dynamic and let users bid on the price
- Make sure that token22 program is supported  