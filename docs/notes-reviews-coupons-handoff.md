# Handoff notes: reviews purchaser gating + coupons

What this change set delivered, and what the follow-up order work resolved.

## Reviews

Done (module `src/modules/reviews/`):

- `createReview` now requires the reviewer to own a purchase for the product:
  an `Order` owned by the user that contains `items.productId === productId`
  and whose `status` is in `REVIEWABLE_ORDER_STATUSES`
  (`review.service.js`). Non-purchasers get `403 VERIFIED_PURCHASE_REQUIRED`.
- `verifiedPurchase` is always `true` for created reviews (only purchasers can
  review now).
- When an `orderId` is attached it must belong to the user, contain the
  product and also be in the accepted/completed set.
- Admin `DELETE /api/v1/admin/reviews/:id` (permission `review.moderate`) added
  through `admin.routes.js` -> `admin.controller.js` ->
  `admin.catalog.service.js:deleteReviewAdmin` -> `review.service.js:deleteReview`
  (hard delete + rating refresh).

If you later decide that a different order lifecycle point means "accepted /
completed", update the `REVIEWABLE_ORDER_STATUSES` array in
`review.service.js` (currently `confirmed` through `delivered`).

## Coupons

Coupon-side work plus the follow-up order integration. The items previously
listed as "Remaining for the order engineer" are now resolved (see below).

### Product/category restrictions

- Model fields `productIds` / `categoryIds` on `Coupon` (`coupon.model.js`);
  empty means "no restriction". Products store the full ancestor category path
  in `categoryIds`, so restricting by a parent category also covers
  descendants.
- Admin `POST/PATCH /admin/coupons` accept `productIds` / `categoryIds`
  (`admin.schemas.js:couponPayload`, `admin.catalog.service.js` CRUD + DTO).
- `coupon.service.js:validateCoupon` now accepts `{ ..., lines }`. When the
  coupon is scoped and `lines` are supplied it:
  - computes the eligible subtotal via `couponEligibleSubtotal`,
  - throws `COUPON_NOT_APPLICABLE` when no cart item is eligible,
  - computes the discount against the eligible subtotal only.
- Safe insertion point used: `cart.service.js:recomputeCartDoc` (used by
  `getCartByUser` -> checkout `options`/`preview`/`place-order`) passes its
  hydrated `lines` into `validateCoupon`. A scoped coupon that no longer
  matches the cart contents is dropped and removed from the cart.

### Per-user atomicity

- `coupon.service.js:useCoupon` now claims global capacity with a guarded
  `findOneAndUpdate` (`usedCount < usageLimit`) and reserves the per-user slot
  through the unique `{ coupon, user }` index plus an atomic `$inc`; when the
  resulting `usedCount` exceeds `perUserLimit` both counters are rolled back
  and `COUPON_PER_USER_LIMIT` is thrown. Concurrent double consumption is
  prevented.
- `coupon.service.js:releaseCouponUse(couponId, userId)` is exported as the
  symmetric decrement for cancelled/refunded orders.

### Remaining for the order engineer (RESOLVED)

All three follow-up items are implemented and covered by
`apps/api/tests/order-lifecycle.test.js`:

1. **Line-aware coupon validation at order time.** `placeOrder` passes the
   hydrated cart lines into `validateCoupon({ subtotalMinor, userId, lines })`
   (`order.service.js:302`), so scoped coupons are evaluated against the
   products actually ordered, matching the cart/preview discount.
2. **Claim before persistence.** The coupon is consumed (`consumeCoupon`) BEFORE
   `Order.create` (`order.service.js:311-314`); the catch block reverses the
   claim and releases stock reservations if creation fails. A latent bug was
   found and fixed here: the reversal was ALSO running on the success path
   right after `Order.create`, immediately decrementing `usedCount` on every
   coupon order back to zero.
3. **Coupon usage released on cancel/refund/return.** Customer cancellation
   (`cancelMyOrder`, `order.service.js:411-413`), and the admin cancel /
   refund / return paths (`admin.service.js:197-199`, `:241-244`,
   `:287-290`) release coupon usage via `releaseCouponByCode`, guarded by
   `couponReleasedAt`.

Inventory and payment semantics shipped with the same change set:

- **Payments default.** Every order starts `pending` via
  `initialPaymentStatusFor(paymentMethod)` with
  `INSTANT_CAPTURE_PROVIDERS = new Set([])`; COD flips to `paid` only at the
  `delivered` transition (existing behaviour), so nothing is `paid` at
  creation in this configuration.
- **Inventory lifecycle.** Placement reserves stock; the admin `delivered`
  transition calls `commitReservation` (stock really decreases, reservation
  released); `returned` calls `restoreCommittedStock`; cancel/refund of a
  pre-delivery order releases the reservation. Admin transitions use the
  package-level `ALLOWED_ORDER_TRANSITIONS` from `@shop/types`
  (`admin.service.js:172`).

## Wishlist

Done (`src/modules/wishlist/`): `POST /wishlist/items/move-to-cart` now
accepts an optional `variantId`. When the wishlist product has variants and no
variant was supplied it auto-selects the single active variant, requires an
explicit option when more than one active variant exists
(`400 VARIANT_REQUIRED`), and delegates quantity/stock rules to the cart
service (`addToCart`), so wishlist items are only removed on a successful
move.
