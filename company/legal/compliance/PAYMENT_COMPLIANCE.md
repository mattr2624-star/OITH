# Payment Compliance

## Store Billing, Subscriptions & Financial Reporting

---

## 1. Platform Billing Requirements

### 1.1 Mandatory Platform Rules

| Platform | Requirement | Penalty for Non-Compliance |
|----------|-------------|---------------------------|
| iOS | Apple In-App Purchase (IAP) only | App rejection/removal |
| Android | Google Play Billing only | App rejection/removal |
| Both | No external payment links for digital goods | App removal |
| Both | No directing users to external payment | Account termination |

### 1.2 What Must Use Platform Billing

| Item Type | Platform Billing Required? |
|-----------|---------------------------|
| Subscriptions (Premium features) | ✅ Yes |
| Consumables (Boosts, Super Likes) | ✅ Yes |
| Virtual currency | ✅ Yes |
| Unlocking features | ✅ Yes |
| Physical goods | ❌ No (can use external) |
| Real-world services | ❌ No (can use external) |

### 1.3 Platform Fee Structure

| Platform | Standard Fee | Small Business Rate |
|----------|-------------|---------------------|
| Apple | 30% | 15% (< $1M/year) |
| Google | 30% | 15% (first $1M) |

---

## 2. Subscription Management

### 2.1 Subscription Tiers

| Tier | Features | Price (Monthly) | Price (Annual) |
|------|----------|-----------------|----------------|
| Free | Basic matching, limited swipes | $0 | $0 |
| Premium | Unlimited swipes, see who likes you | $XX.99 | $XX.99 |
| Premium+ | All Premium + Boosts, Priority | $XX.99 | $XX.99 |

### 2.2 Subscription Disclosure Requirements

**Before purchase, clearly display:**
- [ ] Subscription price
- [ ] Billing frequency (monthly/annual)
- [ ] Auto-renewal notice
- [ ] How to cancel
- [ ] Free trial terms (if applicable)

**Example disclosure text:**
```
Premium Subscription - $14.99/month

• Payment will be charged to your [iTunes Account / Google Play account]
• Subscription automatically renews unless canceled at least 24 hours 
  before the end of the current period
• Your account will be charged for renewal within 24 hours prior to 
  the end of the current period
• You can manage and cancel your subscription in your device's 
  account settings
• No refunds for partial unused periods
```

### 2.3 Free Trial Requirements

If offering free trials:
- [ ] Trial length clearly stated
- [ ] What happens after trial ends
- [ ] How to cancel before charge
- [ ] Trial only once per account

**Example:**
```
Start your 7-day free trial

• Free for 7 days, then $14.99/month
• Cancel anytime during trial at no charge
• Subscription renews automatically
```

### 2.4 Cancellation Flow

**Apple (iOS):**
- Direct user to Settings → [Name] → Subscriptions
- Or provide deep link: `itms-apps://apps.apple.com/account/subscriptions`

**Google (Android):**
- Direct user to Play Store → Menu → Subscriptions
- Or provide deep link to Play Store subscription management

**In-app guidance:**
```
To cancel your subscription:

iOS:
1. Open Settings on your device
2. Tap your name, then Subscriptions
3. Tap [App Name]
4. Tap Cancel Subscription

Android:
1. Open Google Play Store
2. Tap Menu → Subscriptions
3. Tap [App Name]
4. Tap Cancel Subscription

Note: Canceling stops future charges but doesn't 
provide a refund for the current period.
```

---

## 3. Refund Handling

### 3.1 Platform Refund Policies

| Platform | Refund Authority | Our Role |
|----------|------------------|----------|
| Apple | Apple handles | Can request via App Store |
| Google | Google handles | Can request via Play Store |

### 3.2 Refund Request Handling

**For user refund requests:**
1. Direct to platform (Apple/Google)
2. Document the request
3. Do not promise refunds we can't control

**Response template:**
```
Thank you for contacting us about a refund.

Subscription payments are processed by [Apple/Google], and refund 
requests must be submitted to them directly.

For Apple:
Visit reportaproblem.apple.com

For Google:
Visit play.google.com/store/account → Order History

If you have questions about your subscription or how to cancel, 
we're happy to help.
```

### 3.3 Refund Documentation

Track all refund-related events:
- [ ] Refund requests received
- [ ] Platform refund notifications
- [ ] Subscription status changes
- [ ] User communication history

---

## 4. Financial Reporting

### 4.1 Required Tracking

| Data Point | Purpose | Retention |
|------------|---------|-----------|
| Subscription start date | Revenue recognition | 7 years |
| Subscription end date | Churn analysis | 7 years |
| Payment amount | Financial reporting | 7 years |
| Payment method | Platform attribution | 7 years |
| Plan type | Revenue segmentation | 7 years |
| Renewal events | Revenue recognition | 7 years |
| Cancellation events | Churn tracking | 7 years |
| Refund events | Financial reconciliation | 7 years |

### 4.2 Revenue Recognition

For subscription businesses:
- [ ] Recognize revenue ratably over subscription period
- [ ] Handle mid-period upgrades/downgrades
- [ ] Account for platform fees
- [ ] Track deferred revenue

### 4.3 Financial Audit Trail

Maintain records of:
```json
{
  "transaction_id": "txn_abc123",
  "user_id": "user_xyz789",
  "timestamp": "2024-12-08T10:30:00Z",
  "type": "subscription_start",
  "plan": "premium_monthly",
  "amount": 14.99,
  "currency": "USD",
  "platform": "ios",
  "platform_transaction_id": "apple_txn_123",
  "status": "completed"
}
```

### 4.4 Monthly Financial Reconciliation

- [ ] Reconcile platform payouts with internal records
- [ ] Account for platform fees
- [ ] Track refunds and chargebacks
- [ ] Document discrepancies

---

## 5. Implementation Checklist

### iOS (StoreKit / StoreKit 2)

- [ ] Configure products in App Store Connect
- [ ] Implement StoreKit for purchases
- [ ] Handle transaction verification
- [ ] Implement receipt validation (server-side)
- [ ] Handle subscription status changes
- [ ] Implement restore purchases
- [ ] Handle grace periods
- [ ] Handle billing retry

### Android (Google Play Billing)

- [ ] Configure products in Play Console
- [ ] Implement Play Billing Library
- [ ] Handle purchase verification
- [ ] Implement server-side validation
- [ ] Handle subscription status changes
- [ ] Implement acknowledge/consume
- [ ] Handle grace periods
- [ ] Handle account hold

### Server-Side Requirements

- [ ] Receipt/purchase validation endpoint
- [ ] Subscription status tracking
- [ ] Webhook handling (Apple Server Notifications)
- [ ] Webhook handling (Google Real-time Developer Notifications)
- [ ] Entitlement management
- [ ] Cross-platform subscription sync

---

## 6. Price Tier Documentation

### 6.1 Apple Price Tiers

Document your chosen price tiers:

| Product | Apple Tier | USD | Notes |
|---------|------------|-----|-------|
| Premium Monthly | Tier X | $X.99 | Auto-renewable |
| Premium Annual | Tier X | $X.99 | Auto-renewable |
| Boost Pack (5) | Tier X | $X.99 | Consumable |

### 6.2 Google Price Points

Document your pricing:

| Product | Base Price | Notes |
|---------|------------|-------|
| Premium Monthly | $X.99 | Auto-renewable |
| Premium Annual | $X.99 | Auto-renewable |
| Boost Pack (5) | $X.99 | Consumable |

### 6.3 Regional Pricing

Consider regional pricing adjustments:
- [ ] Use platform-suggested regional prices
- [ ] Or set custom prices per region
- [ ] Document pricing strategy

---

## 7. Compliance Documentation

### 7.1 For App Store Review

Prepare documentation showing:
- [ ] All IAP products configured correctly
- [ ] Subscription terms displayed clearly
- [ ] Cancellation instructions accessible
- [ ] No external payment links
- [ ] Restore purchases functionality

### 7.2 For Financial Audit

Maintain:
- [ ] Complete transaction history
- [ ] Revenue recognition documentation
- [ ] Platform payout records
- [ ] Refund and chargeback records
- [ ] Tax documentation

### 7.3 Tax Compliance

- [ ] Understand VAT/GST obligations
- [ ] Platform handles consumer tax (marketplace rules)
- [ ] Document tax treatment
- [ ] Consult with tax professional

---

## 8. Testing Checklist

### Sandbox Testing (Pre-Launch)

- [ ] Test subscription purchase flow
- [ ] Test subscription renewal
- [ ] Test subscription cancellation
- [ ] Test upgrade/downgrade
- [ ] Test restore purchases
- [ ] Test expired subscription handling
- [ ] Test receipt validation
- [ ] Test consumable purchases

### Production Monitoring

- [ ] Monitor purchase success rate
- [ ] Track subscription conversion
- [ ] Monitor renewal rate
- [ ] Track cancellation reasons
- [ ] Alert on payment failures spike

---

*Last Updated: December 2024*
*Review Due: March 2025*

