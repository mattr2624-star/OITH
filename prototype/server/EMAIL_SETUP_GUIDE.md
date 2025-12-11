# Email Setup Guide for OITH Admin

This guide walks you through setting up real email functionality for the OITH Admin dashboard using Google Workspace and Gmail API.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    OITH Admin Dashboard                      │
│                     (manager.html)                           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Backend                           │
│                   (localhost:3001)                           │
│                   /api/email routes                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Gmail API                                 │
│              (Google Workspace / Gmail)                      │
│                  admin@oith.com                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

1. **Google Workspace account** with your domain (oith.com)
   - Sign up at https://workspace.google.com
   - Verify domain ownership
   - Create admin@oith.com email

2. **Google Cloud Project** for API access
   - Create at https://console.cloud.google.com

---

## Step 1: Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)

2. Create a new project:
   - Click "Select a project" → "New Project"
   - Name: `OITH Admin`
   - Click "Create"

3. Enable Gmail API:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click "Enable"

---

## Step 2: Configure OAuth Consent Screen

1. Go to "APIs & Services" → "OAuth consent screen"

2. Select "Internal" (for Google Workspace) or "External"

3. Fill in:
   - App name: `OITH Admin`
   - User support email: your email
   - Developer contact email: your email

4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`

5. Save and continue

---

## Step 3: Create OAuth Credentials

1. Go to "APIs & Services" → "Credentials"

2. Click "Create Credentials" → "OAuth client ID"

3. Application type: "Web application"

4. Name: `OITH Admin Dashboard`

5. Add Authorized redirect URIs:
   ```
   http://localhost:3001/api/email/oauth/callback
   ```

6. Click "Create"

7. **Save the Client ID and Client Secret** - you'll need these!

---

## Step 4: Configure Backend

1. Navigate to the server folder:
   ```bash
   cd prototype/server
   ```

2. Copy the environment template if you haven't:
   ```bash
   copy env-template.txt .env
   ```

3. Edit `.env` and add your Gmail credentials:
   ```env
   # Email Configuration
   GMAIL_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=your_client_secret_here
   GMAIL_EMAIL=admin@oith.com
   ```

4. Install dependencies (including googleapis):
   ```bash
   npm install
   ```

5. Start the server:
   ```bash
   npm start
   ```

---

## Step 5: Complete OAuth Authorization

1. With the server running, visit:
   ```
   http://localhost:3001/api/email/oauth/url
   ```

2. Click the authorization URL returned

3. Sign in with your Google Workspace account (admin@oith.com)

4. Grant permissions to OITH Admin

5. You'll be redirected back with a refresh token

6. **Copy the refresh token** and add it to your `.env`:
   ```env
   GMAIL_REFRESH_TOKEN=your_refresh_token_here
   ```

7. Restart the server

---

## Step 6: Verify Setup

1. Open the admin dashboard: `http://localhost:5500/manager.html`

2. Click the email icon in the header

3. You should see "● Connected" with your email address

4. Try sending a test email!

---

## API Endpoints

Once configured, these endpoints are available:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/email/status` | GET | Check email configuration status |
| `/api/email/inbox` | GET | Fetch inbox emails |
| `/api/email/message/:id` | GET | Get single email details |
| `/api/email/send` | POST | Send an email |
| `/api/email/mark-read/:id` | POST | Mark email as read |
| `/api/email/archive/:id` | DELETE | Archive an email |
| `/api/email/support` | GET | Get support messages |
| `/api/email/support` | POST | Receive support message (from user app) |

---

## Troubleshooting

### "Email not configured" message
- Check that all env variables are set correctly
- Restart the backend server after changing .env
- Verify the refresh token is valid

### OAuth errors
- Make sure redirect URI matches exactly
- Check that Gmail API is enabled
- Verify consent screen is configured

### "Access Denied" errors
- User must be in Google Workspace organization
- Check OAuth scopes are correct
- May need to re-authorize

---

## Security Notes

1. **Never commit `.env` to git** - it's already in .gitignore

2. **Refresh tokens are sensitive** - treat like passwords

3. **Use environment variables** in production (Amplify, Lambda, etc.)

4. **Rotate credentials** periodically

---

## Production Deployment

For AWS Amplify/Lambda deployment:

1. Store credentials in AWS Secrets Manager or environment variables

2. Update redirect URI to your production domain:
   ```
   https://your-api-domain.com/api/email/oauth/callback
   ```

3. Re-authorize with the production redirect URI

4. Add production domain to OAuth authorized origins

---

## Support

If you encounter issues:
1. Check server console for error messages
2. Verify credentials in Google Cloud Console
3. Test API endpoints directly with curl/Postman

