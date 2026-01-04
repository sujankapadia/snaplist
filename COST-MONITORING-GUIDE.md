# SnapList Cost Monitoring & Usage Tracking Guide

## **Your Current SnapList Cost Structure**

Right now, your app uses:

- **Netlify**: Free tier (100GB bandwidth/month, 300 build minutes)
- **Firebase**: Spark (free) or Blaze (pay-as-you-go)
  - Firestore: First 50K reads, 20K writes, 20K deletes per day are FREE
  - Authentication: FREE for all providers
  - Storage: 5GB storage, 1GB/day downloads FREE
- **Gemini API**: FREE tier (currently 1,500 requests/day for gemini-2.5-flash)

## **⚠️ Critical Risks for SnapList**

Based on the research and your architecture, here are your biggest cost vulnerabilities:

### **1. Gemini API Abuse (HIGHEST RISK)**

```javascript
// Current code in App.jsx:252-289
const processWithAI = async (text) => {
  // NO rate limiting!
  // NO per-user tracking!
  // NO cost monitoring!
  const response = await fetch(`https://generativelanguage.googleapis.com/...`);
};
```

**What could go wrong:**

- Malicious user writes script to spam your API → 10,000 requests/hour
- Even on free tier, you'd hit quota limits and app breaks for all users
- If you upgrade to paid tier ($0.10 per 1M chars), a spam attack = $$$$

**Current protection:** NONE

### **2. Firestore Write Abuse**

- Each task = 1 write, category = 1 write
- Malicious bot creates 1M tasks = $0.18 (writes) + storage costs
- Real risk: Runaway loops in your code (bug causes infinite writes)

**Current protection:** Firebase security rules limit to authenticated users only

### **3. Storage Attachment Bombs**

- Users can upload images/PDFs to Firebase Storage
- Malicious user uploads 100GB of files = $2.50/month storage + egress costs
- No file size limits, no per-user quotas

**Current protection:** NONE

## **Essential Monitoring Setup (Do This Before Deploying)**

### **1. Firebase Budget Alerts**

```bash
# Set up in Google Cloud Console
# Recommended thresholds for development/personal use:
- $5 budget with alerts at 50%, 75%, 90%, 100%
- Email alerts sent to your address
```

**Why:** You'll get warnings before costs spiral. Budget does NOT cap spending!

### **2. Firebase Usage Dashboard**

Monitor daily in Firebase Console:

- **Firestore**: Reads/writes/deletes per day
- **Storage**: Total GB stored, downloads per day
- **Authentication**: Active users

### **3. Gemini API Quota Monitoring**

Check Google AI Studio dashboard for:

- Requests per day/minute
- Token usage
- Quota limits approaching

## **Per-User Usage Tracking (For Scaling to Paid Tiers)**

Here's how to track costs per user for SnapList:

### **Pattern 1: Firestore Usage Collection**

```javascript
// Create a usage tracking collection
/users/{userId}/usage
  - geminiRequestsToday: 15
  - tasksCreated: 120
  - storageUsedMB: 45
  - lastResetDate: "2026-01-04"
  - tier: "free" | "pro" | "enterprise"
```

Increment counters on each action:

```javascript
// After successful Gemini API call
await updateDoc(doc(db, 'users', user.uid, 'usage', 'current'), {
  geminiRequestsToday: increment(1),
  lastRequest: serverTimestamp(),
});
```

### **Pattern 2: Rate Limiting with Usage Checks**

```javascript
const processWithAI = async (text) => {
  // Check usage before API call
  const usage = await getDoc(doc(db, 'users', user.uid, 'usage', 'current'));
  const limit = TIER_LIMITS[usage.tier].geminiPerDay; // e.g., 50 for free tier

  if (usage.geminiRequestsToday >= limit) {
    toast.error('Daily AI limit reached. Upgrade to Pro for unlimited requests.');
    return;
  }

  // Make API call...
  // Increment counter...
};
```

### **Pattern 3: Cloud Functions for Backend Metering**

```javascript
// Firebase Cloud Function (more secure - can't be bypassed by client)
exports.trackUsage = functions.firestore
  .document('users/{userId}/tasks/{taskId}')
  .onCreate(async (snap, context) => {
    const userId = context.params.userId;

    // Calculate costs
    const costs = {
      firestoreWrite: 0.00000036, // per write
      geminiTokens: snap.data().aiTokensUsed * 0.0000001,
      storage: snap.data().attachments?.length * 0.00001,
    };

    // Update user's cost tracker
    await admin
      .firestore()
      .doc(`users/${userId}/costs/monthly`)
      .update({
        totalCost: admin.firestore.FieldValue.increment(
          costs.firestoreWrite + costs.geminiTokens + costs.storage
        ),
      });
  });
```

## **Recommended Tier Structure for SnapList**

Based on research showing 3-4 tiers as optimal:

| Tier     | Price  | Limits                                         | Target User           |
| -------- | ------ | ---------------------------------------------- | --------------------- |
| **Free** | $0     | 50 AI tasks/day, 100 tasks total, 50MB storage | Personal use, testing |
| **Pro**  | $5/mo  | Unlimited AI, 10K tasks, 5GB storage           | Power users           |
| **Team** | $15/mo | Everything + 5 members, shared lists           | Small teams           |

## **Production-Ready Rate Limiting for SnapList**

Here's what you should implement before going live:

### **Client-Side (Quick Win)**

```javascript
// Add to App.jsx
const RATE_LIMITS = {
  free: { geminiPerDay: 50, tasksPerDay: 100, storageMB: 50 },
  pro: { geminiPerDay: Infinity, tasksPerDay: Infinity, storageMB: 5000 },
};

// Check before expensive operations
if (userUsageToday >= limit) {
  toast.error('Daily limit reached. Upgrade or wait until tomorrow.');
  return;
}
```

### **Server-Side (Secure, Required for Production)**

Firebase Security Rules:

```javascript
// firestore.rules
match /users/{userId}/tasks/{taskId} {
  allow create: if request.auth.uid == userId
    && get(/databases/$(database)/documents/users/$(userId)/usage/current)
       .data.tasksCreated < 100; // Free tier limit
}
```

### **Advanced: Firebase App Check**

Prevents non-app clients from hitting your Firebase:

```bash
# Verifies requests come from your actual app, not bots
# Free, built into Firebase
```

## **Tools & Frameworks for Usage-Based Billing**

If you want to add paid tiers:

### **Option 1: Stripe Billing + Usage Reporting**

- **Stripe Metering API**: Track usage events, automatically charge per-use
- **Cost**: 2.9% + $0.30 per transaction
- **Integration**: `stripe.usageRecords.create()` after each AI call

### **Option 2: Dedicated Billing Platforms**

From the research, top options for 2025:

- **Lago** (open-source, usage-based billing)
- **Maxio** (for complex metering)
- **UniBee** (SaaS-specific)

### **Option 3: Firebase Extensions**

- **"Auto Stop Services" extension**: Automatically disables billing when budget hit
- **⚠️ Warning**: This will SHUT DOWN your app! Only for dev environments.

## **Essential Reading**

Based on the research, here are the must-read guides:

1. **Firebase Official Docs**:

   - [Avoid Surprise Bills](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills)
   - [Advanced Billing Alerts](https://firebase.google.com/docs/projects/billing/advanced-billing-alerts-logic)
   - [Firestore Pricing](https://firebase.google.com/docs/firestore/pricing)

2. **Cost Prevention**:

   - [How to Prevent Firebase Runaway Costs](https://flamesshield.com/blog/how-to-prevent-firebase-runaway-costs/)
   - [Hidden Costs of Firebase](https://moldstud.com/articles/p-the-hidden-costs-of-firebase-essential-tips-for-developers-to-avoid-surprises)

3. **SaaS Pricing Strategy**:
   - [SaaS Pricing Strategy Guide 2026](https://www.momentumnexus.com/blog/saas-pricing-strategy-guide-2026/)
   - [Consumption-Based Billing Guide](https://www.maxio.com/blog/consumption-based-billing)

## **Immediate Action Items for SnapList**

Before deploying to Netlify:

1. **[ ] Set up Google Cloud budget alerts** ($5 budget, 50%/75%/90%/100% alerts)
2. **[ ] Add Gemini API rate limiting** (50 requests/day/user for free tier)
3. **[ ] Add file size limits** (5MB max per attachment, 50MB total per user)
4. **[ ] Create usage tracking collection** in Firestore
5. **[ ] Add Firebase App Check** to prevent bot access
6. **[ ] Document your cost assumptions** (expected users, usage patterns)

## **For Your Current Use Case (Personal App)**

For a personal task manager with maybe 10-50 users:

- **Netlify**: Will stay free forever (you won't hit 100GB)
- **Firebase**: Will stay free if usage < 50K reads/day
- **Gemini**: Free tier = 1,500 requests/day = plenty for 50 users doing 30 tasks/day each

**Risk**: One malicious user or infinite loop bug could rack up charges.

**Mitigation**: Set $5 budget alert, add basic rate limiting (50 AI calls/user/day).

## **Questions to Consider**

- What is your expected user base? (10 users? 1000 users?)
- Are you okay with Firebase Blaze pay-as-you-go, or want to stay on Spark (free) tier?
- Do you plan to monetize this app, or keep it free for personal use?
- What's your acceptable monthly budget for hosting costs?
- Do you want to implement rate limiting now, or wait until you see real usage patterns?
