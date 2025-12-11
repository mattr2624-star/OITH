# User Identity & Safety Compliance

## Age Verification, Reporting & Safety Features

---

## 1. Age Verification

### 1.1 Minimum Requirements

| Method | Compliance Level | Implementation |
|--------|------------------|----------------|
| Self-declaration (DOB entry) | Minimum acceptable | Required |
| Age gate screen | Minimum acceptable | Required |
| ID verification | Recommended | Optional but encouraged |
| Credit card verification | Strong | For premium features |

### 1.2 Self-Declaration Implementation

**Required elements:**
- [ ] Date of birth field at registration
- [ ] Calculate age and verify ≥ 18
- [ ] Clear messaging that app is for adults only
- [ ] Block underage users from completing signup

**UI Requirements:**
```
┌─────────────────────────────────────┐
│  Confirm Your Age                   │
│                                     │
│  [App Name] is for adults only.     │
│  You must be 18 or older to use     │
│  this app.                          │
│                                     │
│  Date of Birth:                     │
│  [ Month ▼ ] [ Day ▼ ] [ Year ▼ ]  │
│                                     │
│  By continuing, you confirm you     │
│  are at least 18 years old.         │
│                                     │
│        [ Continue ]                 │
└─────────────────────────────────────┘
```

### 1.3 Enhanced Age Verification (Recommended)

| Service | Method | Cost | Friction |
|---------|--------|------|----------|
| Jumio | ID document scan | Per verification | Medium |
| Onfido | ID + selfie match | Per verification | Medium |
| Veriff | Video-based verification | Per verification | High |
| Stripe Identity | ID verification | Per verification | Medium |

**When to require enhanced verification:**
- User flagged as potentially underage
- High-risk regions
- Premium feature access (optional)
- User-initiated for trust badge

### 1.4 Age Verification Audit Trail

Log all age verification events:
```json
{
  "user_id": "user_abc123",
  "timestamp": "2024-12-08T10:30:00Z",
  "verification_method": "self_declaration",
  "declared_dob": "2000-05-15",
  "calculated_age": 24,
  "result": "pass",
  "ip_address": "hashed",
  "device_id": "hashed"
}
```

---

## 2. Reporting & Safety Features

### 2.1 Report User Functionality

**Required implementation:**
- [ ] Report button accessible from user profile
- [ ] Report button accessible from chat/messages
- [ ] Clear reporting categories
- [ ] Optional detail field
- [ ] Confirmation of report submission

### 2.2 Report Categories

| Category | Description | Priority |
|----------|-------------|----------|
| Spam | Promotional content, bots | Medium |
| Fake profile | Not a real person, catfishing | High |
| Inappropriate photos | Explicit, offensive content | High |
| Harassment | Unwanted contact, intimidation | High |
| Hate speech | Discriminatory language | High |
| Threatening behavior | Violence, intimidation | Critical |
| Underage user | Appears to be under 18 | Critical |
| Scam/fraud | Financial scams, phishing | High |
| Other | Doesn't fit other categories | Medium |

### 2.3 Report Flow UI

```
┌─────────────────────────────────────┐
│  Report [Username]                  │
│                                     │
│  Why are you reporting this user?   │
│                                     │
│  ○ Spam                             │
│  ○ Fake profile                     │
│  ○ Inappropriate photos             │
│  ○ Harassment                       │
│  ○ Hate speech                      │
│  ○ Threatening behavior             │
│  ○ They seem underage               │
│  ○ Scam or fraud                    │
│  ○ Other                            │
│                                     │
│  Additional details (optional):     │
│  ┌─────────────────────────────────┐│
│  │                                 ││
│  └─────────────────────────────────┘│
│                                     │
│  [ Cancel ]        [ Submit Report ]│
└─────────────────────────────────────┘
```

### 2.4 Report Processing SLA

| Report Type | Initial Review | Resolution |
|-------------|----------------|------------|
| Underage user | 1 hour | 4 hours |
| Threatening behavior | 1 hour | 4 hours |
| Hate speech | 4 hours | 24 hours |
| Harassment | 4 hours | 24 hours |
| Inappropriate content | 24 hours | 48 hours |
| Fake profile | 24 hours | 72 hours |
| Spam | 24 hours | 72 hours |
| Other | 48 hours | 72 hours |

### 2.5 Report Actions

| Finding | Action | User Notification |
|---------|--------|-------------------|
| Confirmed violation | Account suspended | Yes (via email) |
| Minor violation | Warning issued | Yes (in-app + email) |
| Repeat violation | Permanent ban | Yes (via email) |
| Unsubstantiated | No action | No |
| False report | Note on reporter | No |

---

## 3. Block Functionality

### 3.1 Block Requirements

- [ ] Block accessible from profile view
- [ ] Block accessible from chat
- [ ] Immediate effect (no delay)
- [ ] Blocked user cannot see blocker's profile
- [ ] Blocked user cannot message blocker
- [ ] Blocked user doesn't appear in matching
- [ ] Block is persistent until manually unblocked

### 3.2 Block Implementation

**What happens when User A blocks User B:**
- User B cannot see User A in discover/matching
- User B cannot view User A's profile
- User B cannot send messages to User A
- Existing conversation is hidden from both
- No notification sent to User B
- User A can unblock at any time

### 3.3 Block UI

```
┌─────────────────────────────────────┐
│  Block [Username]?                  │
│                                     │
│  They won't be able to:             │
│  • See your profile                 │
│  • Send you messages                │
│  • Find you in search               │
│                                     │
│  They won't be notified.            │
│                                     │
│  [ Cancel ]           [ Block ]     │
└─────────────────────────────────────┘
```

---

## 4. Safety Guidelines Page

### 4.1 Required Content (App Store Requirement)

Your Safety Guidelines page must include:

**Section 1: Meeting Safely**
- Always meet in public places for first meetings
- Tell a friend or family member where you're going
- Arrange your own transportation
- Stay sober and alert
- Trust your instincts

**Section 2: Protecting Your Information**
- Never share financial information
- Be cautious with personal details (address, workplace)
- Don't share your password
- Be wary of requests to move conversations off-app

**Section 3: Recognizing Red Flags**
- Refusing to meet in person
- Asking for money
- Inconsistent stories
- Pressuring you
- Requesting explicit photos
- Too good to be true profiles

**Section 4: Online Safety**
- Report suspicious behavior
- Block users who make you uncomfortable
- Don't click suspicious links
- Verify profiles when possible

**Section 5: If Something Goes Wrong**
- How to report in-app
- Local emergency services (911)
- National resources:
  - National Domestic Violence Hotline: 1-800-799-7233
  - RAINN: 1-800-656-4673
  - Crisis Text Line: Text HOME to 741741

### 4.2 Safety Guidelines Placement

- [ ] Accessible from app settings
- [ ] Linked during onboarding
- [ ] Linked in profile creation
- [ ] Available in app footer/menu
- [ ] Link in Help/Support section

---

## 5. Additional Safety Features

### 5.1 Safety Check-In (Recommended)

Optional feature for dates:
- Set a check-in time
- Receive reminder notification
- One-tap "I'm safe" response
- If no response, alert emergency contact

### 5.2 Location Sharing (Recommended)

Optional feature for users:
- Share real-time location with trusted contacts
- Time-limited sharing (e.g., 2 hours)
- Emergency SOS button

### 5.3 Photo Verification Badge

Trust signal for users:
- Take a specific pose selfie
- AI/human verification against profile photos
- Display verified badge on profile

### 5.4 Video Chat (Recommended)

In-app video chat benefits:
- Verify user before meeting
- No phone number exchange needed
- Safer than external apps

---

## 6. Compliance Checklist

### Required Features
- [ ] Age verification (DOB entry)
- [ ] Age gate screen (18+ confirmation)
- [ ] User report functionality
- [ ] Report category selection
- [ ] Block user functionality
- [ ] Safety guidelines page
- [ ] Emergency resources listed

### Recommended Features
- [ ] Enhanced ID verification option
- [ ] Photo verification badge
- [ ] In-app video chat
- [ ] Safety check-in for dates
- [ ] Location sharing with contacts
- [ ] Education prompts during onboarding

### Documentation
- [ ] Age verification process documented
- [ ] Report handling procedures documented
- [ ] Moderation team training materials
- [ ] Safety feature user guides

---

## 7. Moderation Team Requirements

### 7.1 Team Structure (Small Team)

| Role | Responsibility | Coverage |
|------|----------------|----------|
| Primary Moderator | Report review, user action | Business hours |
| Backup Moderator | After-hours critical reports | On-call |
| Escalation | Legal, PR concerns | As needed |

### 7.2 Moderator Guidelines

- Review reports within SLA
- Document all actions taken
- Escalate uncertain cases
- Never contact users personally
- Maintain user privacy
- Follow action guidelines consistently

### 7.3 Moderator Training Topics

- [ ] Platform policies and guidelines
- [ ] Report category handling
- [ ] Evidence evaluation
- [ ] Action decision framework
- [ ] Escalation procedures
- [ ] User communication templates
- [ ] Personal safety and self-care

---

*Last Updated: December 2025*
*Review Due: March 2025*

