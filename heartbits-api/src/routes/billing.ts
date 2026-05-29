// ---------------------------------------------------------------------------
// /api/v1/billing — payment stubs (return 501 until Stripe is activated)
//
// Routes:
//   POST /api/v1/billing/checkout      → Stripe checkout session
//   GET  /api/v1/billing/portal        → Stripe billing portal URL
//   POST /api/v1/billing/webhook       → Stripe webhook (only place that writes tokens)
//   GET  /api/v1/billing/subscription  → Current subscription status
// ---------------------------------------------------------------------------
import { Elysia } from 'elysia'

const NOT_ENABLED = {
  error: 'Payment features not yet enabled',
  docs: `https://${process.env['API_DOMAIN'] ?? 'api.heartbits.example.com'}/swagger#/billing`,
}

export const billingRoute = new Elysia({ prefix: '/api/v1/billing' })
  .post('/checkout', ({ set }) => {
    set.status = 501
    return NOT_ENABLED
  })
  .get('/portal', ({ set }) => {
    set.status = 501
    return NOT_ENABLED
  })
  .post('/webhook', ({ set }) => {
    // Stripe will retry — return 501 so it backs off gracefully
    set.status = 501
    return NOT_ENABLED
  })
  .get('/subscription', ({ set }) => {
    set.status = 501
    return NOT_ENABLED
  })
