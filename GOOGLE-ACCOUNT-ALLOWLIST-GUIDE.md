# Google Account Allowlist Guide - SnapList

## Overview

This guide covers how to restrict SnapList access to specific Google accounts, preventing unauthorized users from signing in and accessing your task management system.

**Use Cases:**

- Personal use only (restrict to your own Google account)
- Family/team use (whitelist specific email addresses)
- Organization use (restrict to company domain, e.g., @yourcompany.com)
- Beta testing (limit to approved testers)

**Security Levels:**

1. ✅ **Client-side check** (easy, blocks UI access)
2. ✅✅ **Firestore Security Rules** (medium, blocks database access)
3. ✅✅✅ **Cloud Functions** (advanced, blocks authentication entirely)

---

## Table of Contents

1. [Method 1: Client-Side Allowlist (Simplest)](#method-1-client-side-allowlist-simplest)
2. [Method 2: Firestore Security Rules (Recommended)](#method-2-firestore-security-rules-recommended)
3. [Method 3: Cloud Functions (Most Secure)](#method-3-cloud-functions-most-secure)
4. [Method 4: Google Workspace Domain Restriction](#method-4-google-workspace-domain-restriction)
5. [Hybrid Approach (Best Practice)](#hybrid-approach-best-practice)
6. [Managing the Allowlist](#managing-the-allowlist)
7. [User Experience Considerations](#user-experience-considerations)

---

## Method 1: Client-Side Allowlist (Simplest)

### How It Works

After a user signs in with Google, check if their email is in an allowlist. If not, sign them out immediately.

**Pros:**

- ✅ Easy to implement (5 minutes)
- ✅ No Firebase config changes needed
- ✅ Can show custom error message

**Cons:**

- ⚠️ Can be bypassed by modifying client code
- ⚠️ User briefly gains access before being kicked out
- ⚠️ Not secure for sensitive data

**Best for:** Personal use, low-stakes applications

### Implementation

**File:** `src/App.jsx` (modify existing auth logic)

```javascript
// Add allowlist at top of file
const ALLOWED_EMAILS = ['you@gmail.com', 'partner@gmail.com', 'family.member@gmail.com'];

// Alternative: Domain-based allowlist
const ALLOWED_DOMAINS = ['@yourcompany.com', '@gmail.com'];

function isEmailAllowed(email) {
  // Option 1: Exact email match
  if (ALLOWED_EMAILS.includes(email.toLowerCase())) {
    return true;
  }

  // Option 2: Domain match
  const domain = email.substring(email.lastIndexOf('@'));
  if (ALLOWED_DOMAINS.some((d) => domain === d)) {
    return true;
  }

  return false;
}

// Modify existing auth state listener
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    if (currentUser) {
      // Check if user is allowed
      if (!isEmailAllowed(currentUser.email)) {
        toast.error(`Access denied. ${currentUser.email} is not authorized to use SnapList.`, {
          duration: 5000,
        });

        // Sign out unauthorized user
        await signOut(auth);
        setUser(null);
        return;
      }

      // User is allowed, proceed normally
      setUser(currentUser);
    } else {
      setUser(null);
    }
  });

  return () => unsubscribe();
}, []);
```

### Enhanced Version with Toast Notification

```javascript
// Add state for authorization status
const [authError, setAuthError] = useState(null);

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    if (currentUser) {
      const allowed = isEmailAllowed(currentUser.email);

      if (!allowed) {
        // Log unauthorized access attempt
        console.warn('Unauthorized access attempt:', {
          email: currentUser.email,
          uid: currentUser.uid,
          timestamp: new Date().toISOString(),
        });

        // Show error message
        toast.error(`Access Denied`, {
          description: `${currentUser.email} is not authorized. Contact the administrator to request access.`,
          duration: 10000,
        });

        setAuthError({
          email: currentUser.email,
          message: 'This account is not authorized to access SnapList.',
        });

        // Sign out
        await signOut(auth);
        setUser(null);
        return;
      }

      // Clear any previous errors
      setAuthError(null);
      setUser(currentUser);
    } else {
      setUser(null);
      setAuthError(null);
    }
  });

  return () => unsubscribe();
}, []);

// Show error banner on login screen
{
  !user && authError && (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md">
      <div className="bg-red-50 dark:bg-red-900/30 border-2 border-red-500 rounded-xl p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={24} />
          <div>
            <h3 className="font-bold text-red-900 dark:text-red-100">Access Denied</h3>
            <p className="text-sm text-red-700 dark:text-red-200 mt-1">
              <strong>{authError.email}</strong> is not authorized.
            </p>
            <p className="text-sm text-red-600 dark:text-red-300 mt-2">
              Contact the administrator to request access.
            </p>
          </div>
          <button
            onClick={() => setAuthError(null)}
            className="text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800 rounded p-1"
          >
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Environment Variable Approach

For easier management without code changes:

**File:** `.env`

```bash
# Comma-separated list of allowed emails
VITE_ALLOWED_EMAILS=you@gmail.com,partner@gmail.com,family@gmail.com

# Or domain-based
VITE_ALLOWED_DOMAIN=@yourcompany.com
```

**File:** `src/App.jsx`

```javascript
function isEmailAllowed(email) {
  const allowedEmailsEnv = import.meta.env.VITE_ALLOWED_EMAILS;
  const allowedDomain = import.meta.env.VITE_ALLOWED_DOMAIN;

  if (allowedEmailsEnv) {
    const allowedEmails = allowedEmailsEnv.split(',').map((e) => e.trim().toLowerCase());
    if (allowedEmails.includes(email.toLowerCase())) {
      return true;
    }
  }

  if (allowedDomain) {
    const domain = email.substring(email.lastIndexOf('@'));
    if (domain === allowedDomain.toLowerCase()) {
      return true;
    }
  }

  // If no restrictions configured, allow all (dev mode)
  if (!allowedEmailsEnv && !allowedDomain) {
    console.warn('No email restrictions configured. All users allowed.');
    return true;
  }

  return false;
}
```

**Usage:**

```bash
# Development (allow all)
npm run dev

# Production (restrict to specific emails)
VITE_ALLOWED_EMAILS=you@gmail.com npm run build
```

---

## Method 2: Firestore Security Rules (Recommended)

### How It Works

Even if a user bypasses client-side checks, they **cannot read or write any data** in Firestore unless their email is on the allowlist.

**Pros:**

- ✅✅ **Server-side enforcement** (cannot be bypassed)
- ✅ No backend code needed
- ✅ Protects data even if client is compromised
- ✅ Works with existing Firebase setup

**Cons:**

- ⚠️ User can still sign in (but can't do anything)
- ⚠️ Requires Firestore for allowlist storage

**Best for:** Production apps, sensitive data

### Implementation

#### Step 1: Create Allowlist Collection in Firestore

**Manually add via Firebase Console:**

1. Go to Firebase Console → Firestore Database
2. Create collection: `allowlist`
3. Add documents (one per allowed user):

```
Collection: allowlist

Document ID: you@gmail.com
  email: "you@gmail.com"
  added: 2026-01-04T12:00:00Z
  addedBy: "admin"
  reason: "Owner"

Document ID: partner@gmail.com
  email: "partner@gmail.com"
  added: 2026-01-04T12:05:00Z
  addedBy: "admin"
  reason: "Team member"
```

**Or add via code (one-time setup):**

```javascript
// Run this once to initialize allowlist
import { doc, setDoc, collection } from 'firebase/firestore';

async function initializeAllowlist() {
  const allowedUsers = [
    { email: 'you@gmail.com', reason: 'Owner' },
    { email: 'partner@gmail.com', reason: 'Team member' },
  ];

  for (const user of allowedUsers) {
    await setDoc(doc(db, 'allowlist', user.email), {
      email: user.email,
      added: new Date().toISOString(),
      addedBy: 'admin',
      reason: user.reason,
    });
  }

  console.log('Allowlist initialized!');
}

// Call once
initializeAllowlist();
```

#### Step 2: Update Firestore Security Rules

**File:** `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper function: Check if user is allowed
    function isUserAllowed() {
      return request.auth != null
        && exists(/databases/$(database)/documents/allowlist/$(request.auth.token.email));
    }

    // Allowlist collection (only admins can modify)
    match /allowlist/{email} {
      allow read: if request.auth != null; // Anyone authenticated can check
      allow write: if false; // Only manual updates via Firebase Console
    }

    // User data (only allowed users)
    match /users/{userId} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId
        && isUserAllowed(); // ← NEW: Check allowlist
    }

    // Tasks (only allowed users)
    match /users/{userId}/tasks/{taskId} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId
        && isUserAllowed(); // ← NEW: Check allowlist
    }

    // Categories (only allowed users)
    match /users/{userId}/categories/{categoryId} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId
        && isUserAllowed(); // ← NEW: Check allowlist
    }
  }
}
```

**Deploy rules:**

```bash
firebase deploy --only firestore:rules
```

#### Step 3: Update Client Code to Handle Access Denial

**File:** `src/App.jsx`

```javascript
// Add state for access status
const [hasAccess, setHasAccess] = useState(null); // null = checking, true/false = result

// Check if user is on allowlist
useEffect(() => {
  if (!user) {
    setHasAccess(null);
    return;
  }

  const checkAccess = async () => {
    try {
      // Try to read allowlist document for current user
      const allowlistDoc = await getDoc(doc(db, 'allowlist', user.email));

      if (allowlistDoc.exists()) {
        setHasAccess(true);
        console.log('✅ User has access:', user.email);
      } else {
        setHasAccess(false);
        console.warn('❌ User not on allowlist:', user.email);
        toast.error(
          'Access Denied',
          {
            description: `Your account (${user.email}) is not authorized. Contact the administrator.`,
            duration: 0, // Don't auto-dismiss
          }
        );
      }
    } catch (error) {
      console.error('Error checking allowlist:', error);
      setHasAccess(false);
    }
  };

  checkAccess();
}, [user]);

// Show loading state while checking access
if (user && hasAccess === null) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="animate-spin mx-auto mb-4" size={48} />
        <p className="text-slate-600 dark:text-slate-400">Verifying access...</p>
      </div>
    </div>
  );
}

// Show access denied screen
if (user && hasAccess === false) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-md p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
            <ShieldAlert className="text-red-600 dark:text-red-400" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mb-4">
            Your account <strong>{user.email}</strong> is not authorized to access SnapList.
          </p>
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              To request access, please contact the administrator.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

// Normal app UI (user has access)
return (
  // ... existing SnapList UI
);
```

### Testing Security Rules

**Test unauthorized access:**

```bash
# Install Firebase emulator
npm install -g firebase-tools
firebase login

# Start emulator
firebase emulators:start --only firestore

# In another terminal, run tests
npm run test:security-rules
```

**File:** `test/security-rules.test.js`

```javascript
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'snaplist-test',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  });
});

test('Unauthorized user cannot read tasks', async () => {
  const unauthorized = testEnv.authenticatedContext('unauthorized-user', {
    email: 'hacker@example.com',
  });

  const tasksRef = unauthorized.firestore().collection('users/user123/tasks');

  await expect(tasksRef.get()).toDeny();
});

test('Authorized user can read tasks', async () => {
  // Add user to allowlist
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context
      .firestore()
      .collection('allowlist')
      .doc('authorized@gmail.com')
      .set({ email: 'authorized@gmail.com' });
  });

  const authorized = testEnv.authenticatedContext('user123', {
    email: 'authorized@gmail.com',
  });

  const tasksRef = authorized.firestore().collection('users/user123/tasks');

  await expect(tasksRef.get()).toAllow();
});
```

---

## Method 3: Cloud Functions (Most Secure)

### How It Works

Use Firebase Cloud Functions to **block authentication** before the user even gets a session token.

**Pros:**

- ✅✅✅ **Highest security** (user can't sign in at all)
- ✅ Clean UX (no flash of authenticated state)
- ✅ Can log unauthorized attempts
- ✅ Can send alerts to admin

**Cons:**

- ⚠️ Requires Firebase Blaze (pay-as-you-go) plan
- ⚠️ More complex setup
- ⚠️ Cloud Functions cold starts (~1-2s delay)

**Best for:** High-security applications, compliance requirements

### Implementation

#### Step 1: Initialize Cloud Functions

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Initialize functions
firebase init functions

# Choose:
# - JavaScript or TypeScript: JavaScript
# - ESLint: Yes
# - Install dependencies: Yes
```

#### Step 2: Create beforeSignIn Trigger

**File:** `functions/index.js`

```javascript
const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const ALLOWED_EMAILS = ['you@gmail.com', 'partner@gmail.com', 'family@gmail.com'];

exports.beforeSignIn = functions.auth.user().beforeSignIn((user, context) => {
  const email = user.email?.toLowerCase();

  // Check if email is allowed
  if (!ALLOWED_EMAILS.includes(email)) {
    // Log unauthorized attempt
    console.warn('Blocked sign-in attempt:', {
      email: email,
      uid: user.uid,
      timestamp: new Date().toISOString(),
      ip: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Reject authentication
    throw new functions.auth.HttpsError(
      'permission-denied',
      `Access denied. ${email} is not authorized to use SnapList. Contact the administrator to request access.`
    );
  }

  // Allow authentication
  console.log('✅ Allowed sign-in:', email);
  return;
});
```

**Advanced Version (Firestore-based allowlist):**

```javascript
exports.beforeSignIn = functions.auth.user().beforeSignIn(async (user, context) => {
  const email = user.email?.toLowerCase();

  // Check Firestore allowlist
  const allowlistDoc = await admin.firestore().collection('allowlist').doc(email).get();

  if (!allowlistDoc.exists) {
    // Log to Firestore for admin review
    await admin.firestore().collection('auth_denials').add({
      email: email,
      uid: user.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      ip: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Optional: Send alert to admin
    // await sendEmailAlert(email);

    throw new functions.auth.HttpsError(
      'permission-denied',
      `Access denied. ${email} is not authorized.`
    );
  }

  // Update last sign-in timestamp
  await allowlistDoc.ref.update({
    lastSignIn: admin.firestore.FieldValue.serverTimestamp(),
  });

  return;
});
```

#### Step 3: Deploy Cloud Function

```bash
firebase deploy --only functions
```

#### Step 4: Enable Blocking Functions in Firebase Console

1. Go to Firebase Console → Authentication → Settings
2. Click **"Manage"** under "Blocking functions"
3. Enable **"Before sign-in"** trigger
4. Select your deployed function: `beforeSignIn`
5. Save

#### Step 5: Handle Errors in Client

**File:** `src/App.jsx`

```javascript
const handleLogin = async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });

  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Login failed:', error);

    // Check if blocked by Cloud Function
    if (error.code === 'auth/user-disabled' || error.message.includes('permission-denied')) {
      toast.error('Access Denied', {
        description:
          'Your account is not authorized to access SnapList. Contact the administrator to request access.',
        duration: 10000,
      });
    } else {
      toast.error('Failed to sign in. Please try again.');
    }
  }
};
```

### Monitoring Unauthorized Attempts

**CloudWatch Dashboard (if using Cloud Functions):**

```javascript
// Query denied sign-ins
exports.getDeniedAttempts = functions.https.onCall(async (data, context) => {
  // Only allow admin
  if (context.auth?.token?.email !== 'admin@gmail.com') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only');
  }

  const denials = await admin
    .firestore()
    .collection('auth_denials')
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get();

  return denials.docs.map((doc) => doc.data());
});
```

---

## Method 4: Google Workspace Domain Restriction

### How It Works

If all authorized users are on the same domain (e.g., `@yourcompany.com`), you can restrict to that domain only.

**Pros:**

- ✅ Simple rule ("everyone at company X")
- ✅ Automatic for new employees
- ✅ No manual email list maintenance

**Cons:**

- ⚠️ **Requires Google Workspace** (paid Google account)
- ⚠️ All or nothing (can't exclude specific people)

**Best for:** Company internal tools

### Implementation

#### Option A: Client-Side Domain Check

```javascript
const ALLOWED_DOMAIN = '@yourcompany.com';

function isEmailAllowed(email) {
  return email.toLowerCase().endsWith(ALLOWED_DOMAIN);
}
```

#### Option B: Firebase Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAllowedDomain() {
      return request.auth != null
        && request.auth.token.email.matches('.*@yourcompany.com$');
    }

    match /users/{userId} {
      allow read, write: if request.auth.uid == userId && isAllowedDomain();
    }
  }
}
```

#### Option C: Google Cloud Identity-Aware Proxy (IAP)

For full Google Workspace integration:

1. Deploy SnapList behind Google Cloud Identity-Aware Proxy
2. Configure IAP to allow only your Workspace domain
3. Users must be logged into their Workspace account

**Setup:**

- Requires Google Cloud Platform
- Complex setup, overkill for small apps

---

## Hybrid Approach (Best Practice)

### Recommended: Client + Security Rules + Cloud Function

**Layer 1: Client-Side (UX)**

- Quick feedback to user
- Show friendly error message
- Log attempt for debugging

**Layer 2: Firestore Security Rules (Data Protection)**

- Prevent database access
- Works even if client is bypassed
- No backend code needed

**Layer 3: Cloud Function (Auth Blocking)**

- Stop sign-in before session created
- Cleanest UX (no flash of access)
- Only for high-security needs

### Implementation

**Step 1: Client-Side Check** (see Method 1)

**Step 2: Security Rules** (see Method 2)

**Step 3: Cloud Function** (optional, see Method 3)

**Result:**

- User tries to sign in
- Cloud Function blocks if not on allowlist → Clean rejection
- If Cloud Function is bypassed somehow, client checks → Shows error banner
- If client is bypassed, Security Rules prevent data access → Database protected

---

## Managing the Allowlist

### Option 1: Firebase Console (Manual)

1. Go to Firebase Console → Firestore
2. Navigate to `allowlist` collection
3. Add/remove documents manually

**Pros:** Simple, no code needed
**Cons:** Manual process, not scalable

### Option 2: Admin Panel in SnapList

**Add admin UI for managing allowlist:**

```javascript
// Admin page (only accessible to specific admin email)
function AdminPanel() {
  const [newEmail, setNewEmail] = useState('');
  const [allowlist, setAllowlist] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'allowlist'), (snapshot) => {
      setAllowlist(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const addUser = async () => {
    if (!newEmail.includes('@')) {
      toast.error('Invalid email');
      return;
    }

    await setDoc(doc(db, 'allowlist', newEmail), {
      email: newEmail,
      added: new Date().toISOString(),
      addedBy: user.email,
    });

    toast.success(`Added ${newEmail} to allowlist`);
    setNewEmail('');
  };

  const removeUser = async (email) => {
    if (confirm(`Remove ${email} from allowlist?`)) {
      await deleteDoc(doc(db, 'allowlist', email));
      toast.success(`Removed ${email}`);
    }
  };

  // Only show to admin
  if (user.email !== 'admin@gmail.com') {
    return <div>Access denied</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Allowlist Management</h1>

      {/* Add user form */}
      <div className="flex gap-2 mb-6">
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="user@gmail.com"
          className="flex-1 px-4 py-2 border rounded-lg"
        />
        <button
          onClick={addUser}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
        >
          Add User
        </button>
      </div>

      {/* Allowlist table */}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800">
            <th className="p-3 text-left">Email</th>
            <th className="p-3 text-left">Added</th>
            <th className="p-3 text-left">Added By</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {allowlist.map((entry) => (
            <tr key={entry.id} className="border-b dark:border-slate-700">
              <td className="p-3">{entry.email}</td>
              <td className="p-3 text-sm text-slate-600">
                {new Date(entry.added).toLocaleDateString()}
              </td>
              <td className="p-3 text-sm text-slate-600">{entry.addedBy || 'Manual'}</td>
              <td className="p-3 text-right">
                <button
                  onClick={() => removeUser(entry.email)}
                  className="text-red-600 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Option 3: Firebase Admin SDK Script

**File:** `scripts/manage-allowlist.js`

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function addUser(email) {
  await db.collection('allowlist').doc(email).set({
    email: email,
    added: admin.firestore.FieldValue.serverTimestamp(),
    addedBy: 'admin-script',
  });
  console.log(`✅ Added ${email}`);
}

async function removeUser(email) {
  await db.collection('allowlist').doc(email).delete();
  console.log(`❌ Removed ${email}`);
}

async function listUsers() {
  const snapshot = await db.collection('allowlist').get();
  console.log('Allowed users:');
  snapshot.forEach((doc) => {
    console.log(`  - ${doc.id}`);
  });
}

// Command-line interface
const command = process.argv[2];
const email = process.argv[3];

switch (command) {
  case 'add':
    addUser(email);
    break;
  case 'remove':
    removeUser(email);
    break;
  case 'list':
    listUsers();
    break;
  default:
    console.log('Usage:');
    console.log('  node manage-allowlist.js add user@gmail.com');
    console.log('  node manage-allowlist.js remove user@gmail.com');
    console.log('  node manage-allowlist.js list');
}
```

**Usage:**

```bash
node scripts/manage-allowlist.js add newuser@gmail.com
node scripts/manage-allowlist.js remove olduser@gmail.com
node scripts/manage-allowlist.js list
```

---

## User Experience Considerations

### 1. Clear Error Messages

**Bad:**

```
Error: permission-denied
```

**Good:**

```
Access Denied

Your account (user@gmail.com) is not authorized to access SnapList.

To request access, please contact:
- Email: admin@snaplist.com
- Or message: @admin on Slack
```

### 2. Request Access Flow

**Add "Request Access" button:**

```javascript
function AccessDeniedScreen({ deniedEmail }) {
  const [requestSent, setRequestSent] = useState(false);

  const requestAccess = async () => {
    // Log request to Firestore
    await addDoc(collection(db, 'access_requests'), {
      email: deniedEmail,
      requestedAt: serverTimestamp(),
      status: 'pending',
    });

    // Send email to admin (requires Cloud Function)
    // await httpsCallable(functions, 'sendAccessRequest')({ email: deniedEmail });

    setRequestSent(true);
    toast.success('Access request sent to administrator');
  };

  return (
    <div className="text-center">
      <h1>Access Denied</h1>
      <p>Your account ({deniedEmail}) is not authorized.</p>

      {!requestSent ? (
        <button onClick={requestAccess} className="btn-primary mt-4">
          Request Access
        </button>
      ) : (
        <div className="bg-green-50 p-4 rounded-lg mt-4">
          <p>✅ Request sent! You'll receive an email when approved.</p>
        </div>
      )}
    </div>
  );
}
```

### 3. Admin Notifications

**Cloud Function to notify admin:**

```javascript
exports.onAccessRequest = functions.firestore
  .document('access_requests/{requestId}')
  .onCreate(async (snap, context) => {
    const request = snap.data();

    // Send email to admin
    await admin
      .firestore()
      .collection('mail')
      .add({
        to: 'admin@gmail.com',
        message: {
          subject: `SnapList Access Request: ${request.email}`,
          text: `${request.email} has requested access to SnapList.\n\nApprove: https://snaplist.com/admin/approve/${context.params.requestId}`,
          html: `
          <p><strong>${request.email}</strong> has requested access to SnapList.</p>
          <p><a href="https://snaplist.com/admin/approve/${context.params.requestId}">Approve Access</a></p>
        `,
        },
      });
  });
```

---

## Security Best Practices

### 1. Never Store Allowlist in Client Code

**Bad:**

```javascript
// In App.jsx (visible to anyone inspecting code)
const ALLOWED_EMAILS = ['secret@gmail.com'];
```

**Good:**

```javascript
// In Firestore (server-side validation)
exists(/databases/$(database)/documents/allowlist/$(request.auth.token.email))
```

### 2. Log Unauthorized Attempts

```javascript
// Cloud Function
exports.beforeSignIn = functions.auth.user().beforeSignIn(async (user, context) => {
  if (!allowed) {
    // Log to Firestore
    await admin.firestore().collection('security_events').add({
      type: 'unauthorized_signin_attempt',
      email: user.email,
      ip: context.ipAddress,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Alert if multiple attempts from same IP
    const recentAttempts = await admin
      .firestore()
      .collection('security_events')
      .where('ip', '==', context.ipAddress)
      .where('timestamp', '>', new Date(Date.now() - 3600000))
      .get();

    if (recentAttempts.size > 5) {
      // Send alert to admin
      console.error('⚠️ Multiple unauthorized attempts from IP:', context.ipAddress);
    }

    throw new functions.auth.HttpsError('permission-denied', 'Access denied');
  }
});
```

### 3. Rate Limit Access Requests

Prevent spam from users requesting access repeatedly:

```javascript
// Client-side check before allowing request
const canRequestAccess = async (email) => {
  const recentRequests = await getDocs(
    query(
      collection(db, 'access_requests'),
      where('email', '==', email),
      where('requestedAt', '>', new Date(Date.now() - 86400000)) // Last 24 hours
    )
  );

  if (recentRequests.size >= 3) {
    toast.error('You can only request access 3 times per day');
    return false;
  }

  return true;
};
```

---

## Recommended Implementation for SnapList

### For Personal Use (You Only)

**Use Method 1 (Client-Side) + Method 2 (Security Rules)**

1. Add your email to `.env`:

   ```bash
   VITE_ALLOWED_EMAILS=you@gmail.com
   ```

2. Update Firestore rules with allowlist check

3. Manually create `allowlist` collection with your email

**Cost:** $0 (no Cloud Functions needed)
**Setup Time:** 10 minutes

### For Family/Team Use (5-10 People)

**Use Method 2 (Security Rules) + Admin Panel**

1. Create `allowlist` collection in Firestore
2. Add Security Rules with allowlist check
3. Build simple admin panel to manage users
4. Share admin credentials with trusted person

**Cost:** $0 (no Cloud Functions needed)
**Setup Time:** 30 minutes

### For Beta Testing / Growing App (10-100 People)

**Use Method 2 (Security Rules) + Method 3 (Cloud Functions)**

1. Implement Cloud Function with `beforeSignIn` trigger
2. Add Firestore allowlist
3. Build admin panel with access request workflow
4. Set up email notifications for new requests

**Cost:** ~$1-5/month (Cloud Functions + email)
**Setup Time:** 2-3 hours

---

## Testing Your Implementation

### Test Case 1: Allowed User

```bash
# Sign in with allowed email
# Expected: Success, full access to app
```

### Test Case 2: Unauthorized User

```bash
# Sign in with non-allowed email
# Expected: Error message, sign out, no database access
```

### Test Case 3: Firestore Security Rules

```javascript
// Try to read tasks without allowlist entry
const tasksRef = collection(db, 'users/attacker-uid/tasks');
await getDocs(tasksRef);
// Expected: Error - Missing or insufficient permissions
```

### Test Case 4: Bypassing Client-Side Check

```javascript
// Modify browser code to bypass client check
// Then try to read data
// Expected: Firestore Security Rules should still block access
```

---

## Appendix: Firestore Security Rules Templates

### Template 1: Email Allowlist

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isUserAllowed() {
      return request.auth != null
        && exists(/databases/$(database)/documents/allowlist/$(request.auth.token.email));
    }

    match /allowlist/{email} {
      allow read: if request.auth != null;
      allow write: if false;
    }

    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId && isUserAllowed();
    }
  }
}
```

### Template 2: Domain Allowlist

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAllowedDomain() {
      return request.auth != null
        && request.auth.token.email.matches('.*@(gmail\\.com|yourcompany\\.com)$');
    }

    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId && isAllowedDomain();
    }
  }
}
```

### Template 3: Hybrid (Email + Domain)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isUserAllowed() {
      let email = request.auth.token.email;
      return request.auth != null && (
        // Check allowlist
        exists(/databases/$(database)/documents/allowlist/$(email))
        // OR check allowed domains
        || email.matches('.*@yourcompany\\.com$')
      );
    }

    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId && isUserAllowed();
    }
  }
}
```

---

**Document Version:** 1.0
**Last Updated:** January 4, 2026
**Status:** Production Ready
