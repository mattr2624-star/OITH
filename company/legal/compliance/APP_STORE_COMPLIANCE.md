# App Store Compliance

## Google Play Store & Apple App Store Requirements

---

## 1. Required Store Disclosures

### 1.1 Google Play Data Safety Section

**Location:** Play Console → App Content → Data Safety

| Data Type | Collected | Shared | Purpose | Required |
|-----------|-----------|--------|---------|----------|
| Name | ✅ | ❌ | Account management | Yes |
| Email address | ✅ | ❌ | Account management | Yes |
| Phone number | ✅ | ❌ | Verification | Yes |
| User IDs | ✅ | ❌ | Analytics | Yes |
| Address | ❌ | ❌ | - | No |
| Photos | ✅ | ❌ | Profile, messaging | Yes |
| Videos | ❌ | ❌ | - | No |
| Voice/sound recordings | ❌ | ❌ | - | No |
| Music files | ❌ | ❌ | - | No |
| Files/docs | ❌ | ❌ | - | No |
| Calendar events | ❌ | ❌ | - | No |
| Contacts | ❌ | ❌ | - | No |
| Precise location | ✅ | ❌ | Matching nearby users | Yes |
| Approximate location | ✅ | ❌ | Matching nearby users | Yes |
| Web browsing history | ❌ | ❌ | - | No |
| Search history | ❌ | ❌ | - | No |
| Installed apps | ❌ | ❌ | - | No |
| In-app search history | ✅ | ❌ | Improve matching | Yes |
| SMS/call logs | ❌ | ❌ | - | No |
| Health info | ❌ | ❌ | - | No |
| Fitness info | ❌ | ❌ | - | No |
| Emails | ❌ | ❌ | - | No |
| Text messages | ✅ | ❌ | In-app messaging | Yes |
| Purchase history | ✅ | ❌ | Subscription management | Yes |
| Credit info | ❌ | ❌ | - | No |
| Financial info | ❌ | ❌ | - | No |
| Crash logs | ✅ | ✅ | App stability | Yes |
| Performance diagnostics | ✅ | ✅ | App performance | Yes |
| Device/identifiers | ✅ | ❌ | Analytics, security | Yes |

**Data Deletion Disclosure:**
- [ ] Users can request data deletion
- [ ] Deletion available in-app AND via web form
- [ ] Specify what data is deleted vs retained

### 1.2 Apple App Privacy Nutrition Labels

**Location:** App Store Connect → App Privacy

#### Data Linked to You
| Data Type | Usage |
|-----------|-------|
| Contact Info (Email, Phone) | App Functionality |
| User Content (Photos, Messages) | App Functionality |
| Identifiers (User ID, Device ID) | App Functionality, Analytics |
| Location (Precise, Coarse) | App Functionality |
| Usage Data | Analytics, Product Personalization |
| Purchases | App Functionality |

#### Data Used to Track You
- [ ] Declare if using third-party advertising
- [ ] Declare if linking data across apps/websites

### 1.3 User Data Deletion Requirements

**Both stores require demonstrable data deletion:**

- [ ] In-app account deletion option (Settings → Delete Account)
- [ ] Web-based deletion request form
- [ ] Confirmation of deletion scope
- [ ] Retention of legally required data disclosed
- [ ] Deletion completes within 30 days

**Deletion Implementation:**
```
User Request → Confirmation → 7-day grace period → 
Soft delete → 30-day permanent deletion → Backup purge (90 days)
```

---

## 2. Permission Disclosures

### 2.1 Required Permission Justifications

| Permission | iOS Key | Android Permission | Justification |
|------------|---------|-------------------|---------------|
| Location | NSLocationWhenInUseUsageDescription | ACCESS_FINE_LOCATION | "Used to show you potential matches nearby" |
| Photos | NSPhotoLibraryUsageDescription | READ_EXTERNAL_STORAGE | "Used to select photos for your profile" |
| Camera | NSCameraUsageDescription | CAMERA | "Used to take photos for your profile" |
| Notifications | - | POST_NOTIFICATIONS | "Used to notify you of new matches and messages" |
| Contacts | NSContactsUsageDescription | READ_CONTACTS | Only if implemented - "Find friends on [App]" |

### 2.2 iOS Info.plist Strings

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>We use your location to show you potential matches nearby. Your exact location is never shared with other users.</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>We need access to your photos so you can select images for your dating profile.</string>

<key>NSCameraUsageDescription</key>
<string>We need camera access so you can take photos for your dating profile.</string>
```

### 2.3 Age Rating

| Platform | Rating | Justification |
|----------|--------|---------------|
| Apple | 17+ | Dating content, user-generated content |
| Google | Mature 17+ | Dating content |

**Age Rating Questionnaire Answers:**
- Contains user-generated content: Yes
- Contains dating content: Yes
- Contains sexual content: No (moderated)
- Contains violence: No
- Contains gambling: No

---

## 3. Content Moderation Policies

### 3.1 Required Safety Features

**Both stores require dating apps to have:**

| Feature | Status | Implementation |
|---------|--------|----------------|
| User reporting | ⬜ Required | Report button on profiles/chats |
| User blocking | ⬜ Required | Block from profile/chat |
| Content flagging | ⬜ Required | Flag inappropriate content |
| Community guidelines | ⬜ Required | Accessible in-app |
| Moderation response | ⬜ Required | 24-hour review SLA |

### 3.2 Report Categories

Users must be able to report for:
- [ ] Spam
- [ ] Fake/scam profile
- [ ] Inappropriate photos
- [ ] Harassment
- [ ] Hate speech
- [ ] Underage user
- [ ] Threatening behavior
- [ ] Other

### 3.3 Community Guidelines (Required Content)

Your community guidelines must address:
- [ ] Age requirement (18+)
- [ ] Authentic profiles only
- [ ] No harassment or abuse
- [ ] No hate speech or discrimination
- [ ] No explicit content in public areas
- [ ] No commercial solicitation
- [ ] No illegal activity
- [ ] Consequences for violations

---

## 4. Dating App Category Requirements

### 4.1 Apple Requirements for Dating Apps

| Requirement | Status | Notes |
|-------------|--------|-------|
| Safety Guidelines page | ⬜ Required | In-app, prominent placement |
| Age verification | ⬜ Required | At minimum, self-declaration |
| No minors | ⬜ Required | Technical enforcement |
| Reporting mechanism | ⬜ Required | Easy to find and use |
| Moderation process | ⬜ Required | Documented, active |

### 4.2 Google Requirements for Dating Apps

| Requirement | Status | Notes |
|-------------|--------|-------|
| Safety information | ⬜ Required | Visible to users |
| Age gate (18+) | ⬜ Required | Before account creation |
| User safety features | ⬜ Required | Block, report, hide |
| Content policies | ⬜ Required | Enforced moderation |

### 4.3 Safety Guidelines Page Content

**Required elements for your Safety Guidelines:**

1. **Meeting Safely**
   - Meet in public places first
   - Tell someone where you're going
   - Arrange your own transportation

2. **Protecting Your Information**
   - Don't share financial info
   - Be cautious with personal details
   - Watch for red flags

3. **Recognizing Scams**
   - Romance scam warning signs
   - Financial request red flags
   - Verification bypass attempts

4. **Reporting Concerns**
   - How to report in-app
   - Emergency contacts (911, crisis lines)
   - Support resources

---

## 5. In-App Purchase Compliance

### 5.1 Platform Requirements

| Platform | Requirement | Status |
|----------|-------------|--------|
| iOS | Apple In-App Purchases only | ⬜ Required |
| Android | Google Play Billing only | ⬜ Required |
| Both | No external payment links | ⬜ Required |
| Both | Clear subscription terms | ⬜ Required |

### 5.2 Subscription Disclosure Requirements

- [ ] Price clearly displayed before purchase
- [ ] Subscription duration stated
- [ ] Auto-renewal disclosed
- [ ] Cancellation instructions provided
- [ ] Free trial terms clear (if applicable)

### 5.3 Store Guidelines Compliance

**Apple Guidelines:**
- No links to external payment methods
- In-app disclosure of subscription terms
- Easy cancellation path (can link to Settings)

**Google Guidelines:**
- Google Play Billing for all digital goods
- Subscription management in Play Store
- Clear disclosure of recurring charges

---

## 6. App Store Compliance Checklist

### Pre-Submission Checklist

**Apple App Store:**
- [ ] Privacy Nutrition Labels completed
- [ ] Age rating set to 17+
- [ ] Required permission strings added
- [ ] Safety Guidelines page implemented
- [ ] Block/report features functional
- [ ] IAP integrated (if applicable)
- [ ] Account deletion feature available

**Google Play Store:**
- [ ] Data Safety section completed
- [ ] Content rating questionnaire submitted
- [ ] Target audience declared (18+)
- [ ] Data deletion method provided
- [ ] Safety features implemented
- [ ] Play Billing integrated (if applicable)

### Post-Launch Monitoring

- [ ] Monitor reviews for policy concerns
- [ ] Respond to store policy updates
- [ ] Track app rejection reasons
- [ ] Update disclosures when features change

---

## 7. Common Rejection Reasons & Fixes

| Rejection Reason | Fix |
|------------------|-----|
| Incomplete Data Safety | Complete all required fields |
| Missing deletion method | Add in-app + web deletion |
| Privacy policy inaccessible | Ensure link works, hosting stable |
| Safety features missing | Implement block/report |
| Age gate insufficient | Add DOB verification |
| IAP bypass attempt | Remove all external payment refs |

---

*Last Updated: December 2024*
*Review Due: Per App Update*

