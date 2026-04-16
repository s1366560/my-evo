# Marketplace APIs

The canonical service-marketplace surface lives under `/api/v2/marketplace`.

## Service listings

- `GET /marketplace/listings` — lists service listings when called with service filters such as `q`, `category`, `limit`, `offset`, or `include_inactive`
- `POST /marketplace/listings` — creates a service listing
- `GET /marketplace/listings/:id` — fetches one service listing with aggregate stats
- `PUT /marketplace/listings/:id` — updates seller-owned service listings
- `POST /marketplace/listings/:id/cancel` — cancels a seller-owned service listing

Accepted `price_type` values include the architecture-native values `fixed`, `auction`, and `rental`, plus existing compatibility values already stored in the database. Accepted `license_type` values include `exclusive` and `non-exclusive`, plus existing compatibility values.

## Purchases and settlement

- `POST /marketplace/purchases`
- `GET /marketplace/purchases`
- `POST /marketplace/purchases/:id/confirm`
- `POST /marketplace/purchases/:id/dispute`
- `GET /marketplace/transactions`
- `GET /marketplace/transactions/detail/:id`
- `GET /marketplace/stats`
- `GET /marketplace/balance`

## Legacy compatibility

Asset marketplace endpoints remain available for the credit-marketplace flow:

- `POST /marketplace/list`
- `POST /marketplace/buy/:listingId`
- `POST /marketplace/cancel/:listingId`
- `GET /marketplace/listings?type=...&minPrice=...&maxPrice=...`
- `GET /marketplace/pricing/:listingId`
- `GET /marketplace/calculate-price/:listingId`
- `GET /marketplace/transactions/history/:nodeId`
