# Deploying SnapList AI to Netlify

This guide walks through deploying your SnapList AI application to Netlify for production hosting.

## Prerequisites

- [x] GitHub repository created and code pushed
- [x] Firebase project configured with Google Sign-In
- [ ] Netlify account (free - sign up at https://netlify.com)

## Step 1: Create Netlify Account

1. Go to https://netlify.com
2. Click **"Sign up"**
3. Choose **"Sign up with GitHub"** (recommended for easy integration)
4. Authorize Netlify to access your GitHub account

## Step 2: Deploy Your Site

1. In Netlify dashboard, click **"Add new site"** → **"Import an existing project"**
2. Choose **"Deploy with GitHub"**
3. Select your repository: **`sujankapadia/snaplist`**
4. Netlify will auto-detect Vite settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Branch to deploy**: `main`
5. Click **"Deploy site"**

Netlify will assign you a URL like: `https://snaplist-abc123.netlify.app`

## Step 3: Configure Environment Variables

Your `.env` file is NOT committed to GitHub (good!), so you need to add those variables in Netlify:

1. In your site dashboard, go to **"Site configuration"** → **"Environment variables"**
2. Click **"Add a variable"**
3. Add each variable from your **local `.env` file**:

```
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

**⚠️ IMPORTANT**: Copy the actual values from your local `.env` file. Never commit API keys to Git!

4. Click **"Save"**
5. **Important**: Trigger a new deploy after adding variables:
   - Go to **"Deploys"** tab
   - Click **"Trigger deploy"** → **"Deploy site"**

## Step 4: Update Firebase Authorized Domains

Your Netlify URL needs to be authorized in Firebase for Google Sign-In to work:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your Firebase project
3. Navigate to **Authentication** → **Settings** → **Authorized domains**
4. Click **"Add domain"**
5. Add your Netlify domain (without https://):
   - Example: `snaplist-abc123.netlify.app`
6. Click **"Add"**

## Step 5: Custom Domain (Optional)

If you own a custom domain (e.g., `snaplist.yourdomain.com`):

1. In Netlify site dashboard, go to **"Domain management"**
2. Click **"Add custom domain"**
3. Enter your domain name
4. Follow Netlify's DNS configuration instructions
5. Netlify automatically provisions a free SSL certificate
6. **Remember**: Add the custom domain to Firebase authorized domains too!

## Step 6: Verify Deployment

1. Visit your Netlify URL
2. Test Google Sign-In (should show account picker)
3. Create a task and verify it saves
4. Test on mobile device:
   - Voice input should now work (HTTPS enabled!)
   - Cross-device sync should work
5. Test sign-out and sign back in

## Automatic Deployments

Once set up, Netlify will automatically:
- Deploy every time you push to the `main` branch
- Show deploy previews for pull requests
- Notify you of build failures

## Build Output

When Netlify builds your app, it runs:
```bash
npm install
npm run build
```

This creates the production-optimized files in the `dist/` directory, which Netlify then serves globally via CDN.

## Troubleshooting

### Build Fails
- Check **"Deploy log"** in Netlify dashboard
- Ensure all environment variables are set correctly
- Verify `package.json` scripts are correct

### Google Sign-In Fails
- Verify Netlify domain is in Firebase authorized domains
- Check browser console for error messages
- Ensure environment variables include `VITE_FIREBASE_AUTH_DOMAIN`

### App Loads But Features Don't Work
- Check browser console for API errors
- Verify Gemini API key is set correctly
- Check Firebase rules allow authenticated users

### Voice Input Doesn't Work
- Verify you're accessing via HTTPS (not HTTP)
- Check browser permissions for microphone
- Test on different browsers (Safari, Chrome)

## Monitoring

Netlify provides:
- **Analytics**: Track visitors and page views
- **Deploy notifications**: Email alerts for build status
- **Logs**: View deploy logs and function logs

## Cost

**Free tier includes:**
- 100GB bandwidth/month
- 300 build minutes/month
- Automatic HTTPS
- Continuous deployment
- Deploy previews

This is more than enough for a personal task manager app!

## Next Steps After Deployment

1. Update CLAUDE.md with production URL
2. Test app thoroughly on production
3. Share URL with trusted users for feedback
4. Monitor Firebase usage in Firebase Console
5. Consider PWA installation on mobile devices

## Rollback

If a deployment breaks something:
1. Go to **"Deploys"** tab in Netlify
2. Find a working previous deploy
3. Click **"..."** → **"Publish deploy"**
4. Instantly rolls back to that version

---

**Your SnapList AI will be live at**: `https://[your-site-name].netlify.app`

Enjoy your globally-accessible, HTTPS-enabled, auto-deploying task manager! 🚀
