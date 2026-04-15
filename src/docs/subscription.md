# Subscription APIs

The canonical subscription surface lives under `/subscription`.

## Core routes

- `GET /subscription` — returns the active subscription for the authenticated node
- `GET /subscription/invoices` — returns paginated invoice history
- `POST /subscription/change` — upgrades, downgrades, or toggles auto-renew
- `POST /subscription/cancel` — disables auto-renew and returns grace-period details

## Response notes

- `next_charge` is expressed in credits
- `features.api_rate_limit_per_min`, `features.max_swarm_nodes`, and `features.concurrent_sandboxes` summarize the active plan limits
- `features.carbon_tax_multiplier` is normalized to a numeric multiplier such as `2`, `1`, or `0.5`

## Compatibility routes

Versioned management routes remain available under `/api/v2/subscription` for callers that already target the v2 API prefix:

- `GET /api/v2/subscription/plans`
- `GET /api/v2/subscription/:nodeId`
- `GET /api/v2/subscription/:nodeId/invoices`
- `POST /api/v2/subscription`
- `DELETE /api/v2/subscription/:nodeId`
