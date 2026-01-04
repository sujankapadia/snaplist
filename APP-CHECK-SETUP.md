# Firebase App Check Setup Guide - reCAPTCHA v3

This guide walks you through setting up Firebase App Check with reCAPTCHA v3 to protect SnapList from abuse.

## Step 1: Get reCAPTCHA v3 Keys

### 1.1 Register Your Site

1. Visit: **https://www.google.com/recaptcha/admin/create**
2. Sign in with your Google account (same account as Firebase)

### 1.2 Fill Out the Form

- **Label**: `SnapList`
- **reCAPTCHA type**: Select **"reCAPTCHA v3"**
- **Domains**: Add these domains (one per line):

  ```
  localhost
  127.0.0.1
  ```

  **IMPORTANT**: After deploying to Netlify, come back and add your Netlify domain (e.g., `snaplist-abc123.netlify.app`)

- Check **"Accept the reCAPTCHA Terms of Service"**
- Click **"Submit"**

### 1.3 Save Your Keys

After submission, you'll see:

- **Site Key** (starts with `6L...`) - This is PUBLIC, goes in your code
- **Secret Key** - This is PRIVATE, goes in Firebase Console only

**Copy both keys** to a secure location (password manager, secure note, etc.)

---

## Step 2: Configure Firebase Console

### 2.1 Navigate to App Check

1. Go to: **https://console.firebase.google.com/**
2. Select your **SnapList** project
3. In the left sidebar, click **"App Check"** (under "Release & Monitor")

### 2.2 Register Your Web App

1. You should see your web app listed (something like "SnapList" or the Firebase web app name)
2. Click the **"..."** menu next to your app → **"Manage"** or **"Register"**
3. Select **"reCAPTCHA v3"** as the provider
4. **Paste your SECRET KEY** (from Step 1.3) into the "reCAPTCHA secret" field
5. Click **"Save"**

### 2.3 Leave Enforcement Disabled (For Now)

**IMPORTANT**: Do NOT enable enforcement yet!

- You should see services like "Cloud Firestore", "Cloud Storage" listed
- They should all show as **"Not enforced"**
- We'll test first, then enable enforcement later

---

## Step 3: Add to SnapList Code

### 3.1 Add Site Key to .env

I've already done this for you! Check your `.env` file - you should see:

```bash
VITE_RECAPTCHA_SITE_KEY=your_site_key_here
```

**ACTION REQUIRED**: Replace `your_site_key_here` with your **Site Key** from Step 1.3

### 3.2 Update Firebase Config (Code Changes)

The code has been updated in `src/App.jsx` to initialize App Check.

---

## Step 4: Test App Check

### 4.1 Start Development Server

```bash
npm run dev
```

### 4.2 Check Browser Console

1. Open your app at `http://localhost:5173/`
2. Open browser DevTools (F12 or Cmd+Option+I)
3. Look for App Check messages in the console:
   - ✅ Good: `Firebase App Check initialized successfully`
   - ❌ Bad: `App Check failed to initialize` - check your site key

### 4.3 Monitor Firebase Console

1. Go to Firebase Console → **App Check** → **Metrics**
2. You should see requests coming in with App Check tokens
3. Let it run for a few hours/days to verify everything works

---

## Step 5: Enable Enforcement (After Testing)

**ONLY do this after confirming App Check works in Step 4!**

### 5.1 Enable for Cloud Firestore

1. Firebase Console → **App Check**
2. Find **"Cloud Firestore"** in the services list
3. Click **"Enforce"**
4. Confirm the dialog

### 5.2 Enable for Cloud Storage

1. Find **"Cloud Storage"** in the services list
2. Click **"Enforce"**
3. Confirm the dialog

### 5.3 Verify Enforcement

- Requests without valid App Check tokens will now be rejected
- Your app should continue working normally (it has valid tokens)
- Bots/scripts will be blocked

---

## Troubleshooting

### Error: "App Check token is invalid"

**Cause**: Site key mismatch or domain not registered

**Fix**:

1. Verify `.env` has correct site key
2. Check reCAPTCHA admin console - ensure `localhost` is added to domains
3. Restart dev server after `.env` changes

### Error: "reCAPTCHA placeholder element must be an element or id"

**Cause**: App Check initialized too early

**Fix**: Ensure App Check is initialized AFTER Firebase app, BEFORE using Firestore/Storage

### No metrics showing in Firebase Console

**Cause**: App Check not properly initialized or requests not being made

**Fix**:

1. Check browser console for initialization errors
2. Make a test request (create a task, sign in, etc.)
3. Wait 5-10 minutes for metrics to appear

### Requests blocked after enabling enforcement

**Cause**: Old client without App Check or invalid tokens

**Fix**:

1. Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)
2. Clear browser cache
3. Ensure you're running latest code with App Check initialized

---

## Cost & Limits

**reCAPTCHA v3 Free Tier:**

- First **10,000 assessments per month**: FREE
- After that: $1 per 1,000 assessments

**Typical SnapList usage:**

- 10-50 users = ~1,000-5,000 assessments/month
- Well within free tier!

---

## Security Best Practices

1. ✅ **Never commit your secret key** - It's already in `.env` which is gitignored
2. ✅ **Add Netlify domain** to reCAPTCHA after deployment
3. ✅ **Monitor metrics** regularly in Firebase Console
4. ✅ **Enable enforcement** after confirming metrics look good
5. ✅ **Keep token auto-refresh enabled** (already configured in code)

---

## Next Steps After App Check

Once App Check is working:

1. Add Firestore Security Rules for rate limiting
2. Add file size limits for Storage
3. Deploy to Netlify
4. Add Netlify domain to reCAPTCHA and Firebase authorized domains

---

## Reference Links

- [Firebase App Check Docs](https://firebase.google.com/docs/app-check)
- [reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
- [App Check Metrics Dashboard](https://console.firebase.google.com/project/_/appcheck)
