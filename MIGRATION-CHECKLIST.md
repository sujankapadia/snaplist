# SnapList AI - Local Development Migration Checklist

This checklist covers the complete migration from Google Gemini Canvas sandbox to a local Vite development environment, including all Firebase setup from scratch.

## Phase 1: Firebase Console Setup

### 1.1 Create Firebase Project
- [ ] Go to [Firebase Console](https://console.firebase.google.com/)
- [ ] Click "Add project" or "Create a project"
- [ ] Project name: `SnapList` (or your preference)
- [ ] (Optional) Disable Google Analytics or configure it
- [ ] Click "Create project" and wait for provisioning

### 1.2 Add Web App to Project
- [ ] In Firebase Console, click the **Web icon** (`</>`) to add a web app
- [ ] App nickname: `SnapList Web` (or your preference)
- [ ] **Do NOT** check "Also set up Firebase Hosting" (not needed for PWA)
- [ ] Click "Register app"
- [ ] **Copy the `firebaseConfig` object** - you'll need this for `.env` file
  ```javascript
  const firebaseConfig = {
    apiKey: "AIza...",
    authDomain: "snaplist-xxxxx.firebaseapp.com",
    projectId: "snaplist-xxxxx",
    storageBucket: "snaplist-xxxxx.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
  };
  ```
- [ ] Click "Continue to console"

### 1.3 Enable Firebase Authentication
- [ ] In Firebase Console, navigate to **Build → Authentication**
- [ ] Click "Get started"
- [ ] Go to **Sign-in method** tab
- [ ] Find **Anonymous** in the provider list
- [ ] Click on "Anonymous"
- [ ] Toggle "Enable" to ON
- [ ] Click "Save"

### 1.4 Set Up Cloud Firestore
- [ ] In Firebase Console, navigate to **Build → Firestore Database**
- [ ] Click "Create database"
- [ ] **Location:** Choose closest region to your users (e.g., `us-central1`)
- [ ] **Security rules:** Start in **Production mode** (we'll add custom rules next)
- [ ] Click "Enable" and wait for database creation

### 1.5 Configure Firestore Security Rules
- [ ] In Firestore Database, go to **Rules** tab
- [ ] Replace default rules with:
  ```javascript
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /users/{userId}/{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```
- [ ] Click "Publish"
- [ ] Verify "Last updated" timestamp changes

### 1.6 Set Up Cloud Storage
- [ ] In Firebase Console, navigate to **Build → Storage**
- [ ] Click "Get started"
- [ ] **Security rules:** Start in **Production mode**
- [ ] **Location:** Use the **same region** as Firestore
- [ ] Click "Done"

### 1.7 Configure Storage Security Rules
- [ ] In Storage, go to **Rules** tab
- [ ] Replace default rules with:
  ```javascript
  rules_version = '2';
  service firebase.storage {
    match /b/{bucket}/o {
      match /users/{userId}/tasks/{taskId}/attachments/{fileName} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
  ```
- [ ] Click "Publish"

## Phase 2: Google AI Studio Setup

### 2.1 Get Gemini API Key
- [ ] Go to [Google AI Studio](https://aistudio.google.com/)
- [ ] Sign in with your Google account
- [ ] Click "Get API key" in the left sidebar
- [ ] Click "Create API key"
- [ ] Select "Create API key in new project" (or choose existing project)
- [ ] **Copy the API key** - you'll need this for `.env` file
- [ ] Store it securely (you won't be able to see it again)

## Phase 3: Local Project Initialization

### 3.1 Create Vite + React Project
```bash
npm create vite@latest snaplist -- --template react
cd snaplist
```
- [ ] Run the commands above
- [ ] Verify `snaplist` directory created

### 3.2 Install Core Dependencies
```bash
npm install firebase lucide-react
```
- [ ] Run command
- [ ] Verify `node_modules` created

### 3.3 Install Tailwind CSS
```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```
- [ ] Run commands
- [ ] Verify `tailwind.config.js` and `postcss.config.js` created

### 3.4 Install PWA Plugin
```bash
npm install -D vite-plugin-pwa
```
- [ ] Run command

## Phase 4: Configuration Files

### 4.1 Configure Tailwind CSS
- [ ] Open `tailwind.config.js`
- [ ] Replace content with:
  ```javascript
  /** @type {import('tailwindcss').Config} */
  export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
      extend: {},
    },
    plugins: [],
  }
  ```

### 4.2 Update CSS Entry Point
- [ ] Open/create `src/index.css`
- [ ] Replace content with:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;

  /* Hide scrollbar for Chrome, Safari and Opera */
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }

  /* Hide scrollbar for IE, Edge and Firefox */
  .no-scrollbar {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;  /* Firefox */
  }
  ```

### 4.3 Configure Vite for PWA
- [ ] Open `vite.config.js`
- [ ] Replace content with:
  ```javascript
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'
  import { VitePWA } from 'vite-plugin-pwa'

  export default defineConfig({
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'SnapList AI',
          short_name: 'SnapList',
          description: 'AI-powered task manager with voice capture',
          theme_color: '#4f46e5',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ]
  })
  ```

### 4.4 Create Environment Variables File
- [ ] Create `.env` in project root
- [ ] Add the following (replace with YOUR actual values from Firebase Console):
  ```env
  VITE_FIREBASE_API_KEY=AIza...
  VITE_FIREBASE_AUTH_DOMAIN=snaplist-xxxxx.firebaseapp.com
  VITE_FIREBASE_PROJECT_ID=snaplist-xxxxx
  VITE_FIREBASE_STORAGE_BUCKET=snaplist-xxxxx.appspot.com
  VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
  VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
  VITE_GEMINI_API_KEY=your_google_ai_studio_key
  ```
- [ ] Verify `.env` is listed in `.gitignore`

### 4.5 Update Main Entry Point
- [ ] Open `src/main.jsx`
- [ ] Replace content with:
  ```javascript
  import React from 'react'
  import ReactDOM from 'react-dom/client'
  import App from './App.jsx'
  import './index.css'

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  ```

## Phase 5: Code Migration

### 5.1 Move App Component
- [ ] Copy current `App.jsx` to `src/App.jsx`
- [ ] Delete old `App.jsx` from root directory

### 5.2 Update Firebase Initialization (in `src/App.jsx`)
Find lines 50-57 and replace:
```javascript
// OLD (sandbox):
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'snap-list-ai';
```

With:
```javascript
// NEW (local):
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
```

- [ ] Update Firebase config
- [ ] **Delete** the `appId` variable (no longer needed)

### 5.3 Update Gemini API Key (Line 209)
Find:
```javascript
const apiKey = "";
```

Replace with:
```javascript
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
```

- [ ] Update API key reference

### 5.4 Update Authentication Logic (Lines 120-133)
Find:
```javascript
const initAuth = async () => {
  try {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
      await signInWithCustomToken(auth, __initial_auth_token);
    } else {
      await signInAnonymously(auth);
    }
  } catch (err) { setErrorMessage("Authentication failed."); }
};
```

Replace with:
```javascript
const initAuth = async () => {
  try {
    await signInAnonymously(auth);
  } catch (err) {
    setErrorMessage("Authentication failed.");
    console.error(err);
  }
};
```

- [ ] Simplify auth initialization
- [ ] Remove `signInWithCustomToken` import (line 6)

### 5.5 Update ALL Firestore Paths
Search and replace in `src/App.jsx`:

**Categories Collection (Line ~139):**
```javascript
// OLD:
collection(db, 'artifacts', appId, 'users', user.uid, 'categories')
// NEW:
collection(db, 'users', user.uid, 'categories')
```

**Category Batch Write (Line ~145):**
```javascript
// OLD:
doc(collection(db, 'artifacts', appId, 'users', user.uid, 'categories'))
// NEW:
doc(collection(db, 'users', user.uid, 'categories'))
```

**Tasks Collection (Line ~154):**
```javascript
// OLD:
collection(db, 'artifacts', appId, 'users', user.uid, 'tasks')
// NEW:
collection(db, 'users', user.uid, 'tasks')
```

**Add Task (Line ~226):**
```javascript
// OLD:
collection(db, 'artifacts', appId, 'users', user.uid, 'tasks')
// NEW:
collection(db, 'users', user.uid, 'tasks')
```

**Storage Path (Line ~240):**
```javascript
// OLD:
const storagePath = `artifacts/${appId}/users/${user.uid}/tasks/${editingTask.id}/attachments/${fileName}`;
// NEW:
const storagePath = `users/${user.uid}/tasks/${editingTask.id}/attachments/${fileName}`;
```

**Task Document References (Lines ~260, 287, 440, 453, 467, 484, 542, 549):**
```javascript
// OLD:
doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', taskId)
// NEW:
doc(db, 'users', user.uid, 'tasks', taskId)
```

**Category Document References (Lines ~600, 607):**
```javascript
// OLD:
doc(db, 'artifacts', appId, 'users', user.uid, 'categories', categoryId)
// NEW:
doc(db, 'users', user.uid, 'categories', categoryId)
```

**Add Category (Line ~612):**
```javascript
// OLD:
collection(db, 'artifacts', appId, 'users', user.uid, 'categories')
// NEW:
collection(db, 'users', user.uid, 'categories')
```

Checklist for path updates:
- [ ] Categories collection path (line ~139)
- [ ] Category batch write path (line ~145)
- [ ] Tasks collection path (line ~154)
- [ ] Add task path (line ~226)
- [ ] Storage upload path (line ~240)
- [ ] Task update path - attachments (line ~260)
- [ ] Task update path - delete attachment (line ~287)
- [ ] Task update path - title (line ~440)
- [ ] Task update path - category (line ~453)
- [ ] Task update path - urgency (line ~467)
- [ ] Task update path - due date (line ~484)
- [ ] Task update path - notes (line ~542)
- [ ] Delete task path (line ~549)
- [ ] Delete category path (line ~600)
- [ ] Update category description path (line ~607)
- [ ] Add category path (line ~612)

## Phase 6: Testing & Validation

### 6.1 Run Development Server
```bash
npm run dev
```
- [ ] Run command
- [ ] Open browser to `http://localhost:5173` (or shown URL)
- [ ] Verify app loads without console errors

### 6.2 Test Firebase Authentication
- [ ] Open browser DevTools → Console
- [ ] Verify no auth errors
- [ ] Check Firebase Console → Authentication → Users
- [ ] Verify anonymous user appears after loading app

### 6.3 Test Task Creation
- [ ] Type a task in the input field (e.g., "Buy milk tomorrow at 3pm")
- [ ] Click Send or press Enter
- [ ] Verify task appears in the UI
- [ ] Check Firebase Console → Firestore Database → users collection
- [ ] Verify task document created with correct fields

### 6.4 Test Categories
- [ ] Click Settings (gear icon)
- [ ] Verify 8 default categories loaded
- [ ] Edit a category description
- [ ] Add a new category
- [ ] Delete a category
- [ ] Verify changes persist after page reload

### 6.5 Test Attachments
- [ ] Click on any task to open detail modal
- [ ] Click "Add File"
- [ ] Select an image file
- [ ] Verify upload progress indicator appears
- [ ] Verify image thumbnail appears after upload
- [ ] Click external link icon to open in new tab
- [ ] Click delete icon to remove attachment
- [ ] Check Firebase Console → Storage
- [ ] Verify file uploaded to correct path
- [ ] Verify file deleted when removed from task

### 6.6 Test Voice Input (requires HTTPS or localhost)
- [ ] Click microphone button
- [ ] Grant browser microphone permissions
- [ ] Speak a task (e.g., "Dentist appointment next Tuesday at 2pm")
- [ ] Verify task created with AI-parsed details
- [ ] Note: May not work on iOS Safari in development mode

### 6.7 Test Dark Mode
- [ ] Click moon/sun icon in header
- [ ] Verify theme switches
- [ ] Verify theme persists after page reload

### 6.8 Test Filtering & Sorting
- [ ] Create tasks in different categories
- [ ] Test category filter chips
- [ ] Test date range filters (all/today/week/month)
- [ ] Test status filter (active/completed)
- [ ] Click "Sort" button and test all sort options
- [ ] Test search functionality

## Phase 7: PWA Configuration (Optional but Recommended)

### 7.1 Create PWA Icons
- [ ] Create `public/icon-192.png` (192x192px)
- [ ] Create `public/icon-512.png` (512x512px)
- [ ] Both should be the SnapList logo/icon

### 7.2 Test PWA Install
- [ ] Build production version: `npm run build`
- [ ] Preview build: `npm run preview`
- [ ] Open browser to preview URL
- [ ] Look for "Install" button/prompt in browser
- [ ] Test installing to home screen

## Phase 8: Production Build

### 8.1 Build for Production
```bash
npm run build
```
- [ ] Run command
- [ ] Verify `dist/` folder created
- [ ] No build errors in console

### 8.2 Test Production Build
```bash
npm run preview
```
- [ ] Run command
- [ ] Test all features in production build
- [ ] Verify service worker registered (DevTools → Application → Service Workers)

## Phase 9: Deployment (Choose One)

### Option A: Vercel
```bash
npm install -g vercel
vercel
```
- [ ] Follow Vercel CLI prompts
- [ ] Add environment variables in Vercel dashboard
- [ ] Deploy

### Option B: Netlify
```bash
npm install -g netlify-cli
netlify deploy --prod
```
- [ ] Follow Netlify CLI prompts
- [ ] Add environment variables in Netlify dashboard
- [ ] Deploy

### Option C: Firebase Hosting
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```
- [ ] Select your Firebase project
- [ ] Set `dist` as public directory
- [ ] Configure as single-page app: Yes
- [ ] Don't overwrite `dist/index.html`
- [ ] Deploy

## Phase 10: Post-Deployment

### 10.1 Configure Production Domain
- [ ] Update Firebase Console → Authentication → Authorized domains
- [ ] Add your production domain (e.g., `snaplist.yourname.com`)

### 10.2 Update Security Rules (if needed)
- [ ] Review Firestore rules for production
- [ ] Review Storage rules for production
- [ ] Consider adding rate limiting if needed

### 10.3 Monitor Usage
- [ ] Check Firebase Console → Usage tab
- [ ] Monitor Firestore reads/writes
- [ ] Monitor Storage bandwidth
- [ ] Verify within free tier limits

## Troubleshooting

### Common Issues

**"Firebase: Error (auth/unauthorized-domain)"**
- Add your domain to Firebase Console → Authentication → Settings → Authorized domains

**"Upload failed: Permission denied"**
- Verify Storage security rules published correctly
- Check browser console for detailed error

**"Cannot read properties of undefined (reading 'uid')"**
- User not authenticated yet - add loading state check

**Voice input not working**
- Requires HTTPS or localhost
- Check browser microphone permissions
- iOS Safari has limited support for Web Speech API

**Gemini API errors**
- Verify API key is correct in `.env`
- Check API key has no restrictions blocking your domain
- Verify quota not exceeded in Google Cloud Console

**Tasks not persisting**
- Check browser console for Firestore errors
- Verify security rules allow write access
- Check Firebase Console → Firestore → Data to see if writes occurring

## Success Criteria

You've successfully migrated when:
- ✅ App runs on `localhost:5173` without errors
- ✅ Anonymous authentication works automatically
- ✅ Tasks can be created, edited, and deleted
- ✅ Categories can be managed
- ✅ Attachments upload and display correctly
- ✅ Dark mode toggles and persists
- ✅ Voice input captures and processes tasks
- ✅ Data persists across page refreshes
- ✅ PWA installs on mobile devices
- ✅ Production build deploys successfully

---

**Estimated Time:** 2-3 hours for first-time setup
**Difficulty:** Intermediate
**Prerequisites:** Node.js 18+, npm, Google account
