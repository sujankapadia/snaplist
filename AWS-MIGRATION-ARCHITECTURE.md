# SnapList AWS Migration Architecture & Implementation Guide

## Executive Summary

This document outlines the architecture and implementation strategy for migrating SnapList from a Firebase-only architecture to a hybrid AWS + Firebase architecture, and eventually to a full AWS architecture. The migration is designed to be **incremental and non-breaking**, allowing the application to continue operating throughout the transition.

**Migration Benefits:**

- **Server-side rate limiting**: Unbypassable enforcement of usage limits
- **Advanced analytics**: Full control over usage tracking and cost attribution
- **Better cost visibility**: Tag-based cost allocation per user
- **Scalability**: Auto-scaling compute resources based on demand
- **Professional billing**: Direct Stripe Metering integration
- **Compliance ready**: HIPAA, SOC 2 compliance options

**Cost Impact:** For <100 users: ~$10-30/month. For 1000+ users: $50-200/month depending on usage.

---

## Table of Contents

1. [Current Architecture (Firebase-Only)](#current-architecture-firebase-only)
2. [Target Architecture Options](#target-architecture-options)
3. [Recommended Migration Path](#recommended-migration-path)
4. [Component Mapping: Firebase → AWS](#component-mapping-firebase--aws)
5. [Phase 1: Hybrid Architecture (AWS API + Firebase Data)](#phase-1-hybrid-architecture-aws-api--firebase-data)
6. [Phase 2: Full AWS Architecture](#phase-2-full-aws-architecture)
7. [Implementation Details](#implementation-details)
8. [Cost Analysis](#cost-analysis)
9. [Migration Strategy](#migration-strategy)
10. [Infrastructure as Code](#infrastructure-as-code)
11. [CI/CD Pipeline](#cicd-pipeline)
12. [Monitoring & Observability](#monitoring--observability)
13. [Security Considerations](#security-considerations)
14. [Rollback Plan](#rollback-plan)

---

## Current Architecture (Firebase-Only)

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     React PWA (Vite)                        │
│  - Deployed on Netlify                                      │
│  - Client-side only (no backend)                            │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─────────────────┐
                 │                 │
                 ▼                 ▼
    ┌────────────────────┐   ┌──────────────────┐
    │  Firebase Auth     │   │  Gemini API      │
    │  (Google Sign-In)  │   │  (Direct calls)  │
    └────────────────────┘   └──────────────────┘
                 │
                 ▼
    ┌────────────────────────────────────────┐
    │         Firebase Services              │
    ├────────────────────────────────────────┤
    │  - Firestore (NoSQL database)          │
    │  - Cloud Storage (file uploads)        │
    │  - App Check (reCAPTCHA v3)            │
    │  - Security Rules (client-side)        │
    └────────────────────────────────────────┘
```

### Current Data Flow

1. **User Authentication**: Direct Firebase Auth from browser
2. **AI Processing**: Browser → Gemini API (using exposed API key)
3. **Data Storage**: Browser → Firestore (with Security Rules)
4. **File Uploads**: Browser → Firebase Storage (with Security Rules)
5. **Rate Limiting**: Firebase Security Rules with `get()` calls (client-side)

### Current Limitations

| Issue                         | Impact                                                        |
| ----------------------------- | ------------------------------------------------------------- |
| **Exposed API Keys**          | Gemini API key visible in browser, vulnerable to abuse        |
| **Client-side rate limiting** | Can be bypassed with direct API calls or modified client code |
| **No usage tracking**         | Cannot track per-user costs or usage for billing              |
| **Limited analytics**         | No server-side logs, hard to debug user issues                |
| **Security Rules complexity** | Complex quota logic in Firestore rules, hard to maintain      |
| **No billing integration**    | Manual tracking required for usage-based pricing              |
| **Scaling limits**            | Firebase free tier limits could be hit unexpectedly           |

---

## Target Architecture Options

### Option A: Hybrid (AWS API + Firebase Data) - **RECOMMENDED**

**Best for:** Short-term (0-6 months), maintaining current features while adding server-side control

```
React PWA → AWS API Gateway → Lambda Functions → Firebase
              (Rate Limiting)   (Business Logic)   (Data Store)
                    ↓
                Stripe Metering
```

**Pros:**

- Minimal code changes
- Keep Firebase real-time features
- Add server-side rate limiting immediately
- Incremental migration (low risk)

**Cons:**

- Still paying for Firebase
- Dual infrastructure complexity

### Option B: Full AWS - **LONG-TERM GOAL**

**Best for:** Long-term (6+ months), full control, enterprise features

```
React PWA → CloudFront CDN → ALB → ECS/Lambda → RDS/DynamoDB
                                        ↓
                                   Stripe Metering
                                        ↓
                                   CloudWatch Logs
```

**Pros:**

- Full control over all components
- Better cost optimization at scale
- Advanced features (VPC, compliance, DR)
- No vendor lock-in to Firebase

**Cons:**

- Major rewrite of real-time features
- Higher operational complexity
- Need to build auth, real-time sync from scratch

### Option C: Serverless AWS (Lambda + DynamoDB) - **ALTERNATIVE**

**Best for:** Minimizing costs, variable traffic patterns

```
React PWA → API Gateway → Lambda → DynamoDB
                             ↓
                        EventBridge
                             ↓
                      S3 + Athena (Analytics)
```

**Pros:**

- Pay-per-use (no idle costs)
- Auto-scaling
- Simple deployment

**Cons:**

- Cold start latency
- DynamoDB query limitations vs Firestore
- No built-in real-time subscriptions

---

## Recommended Migration Path

We recommend **Option A (Hybrid)** for the initial migration, with a planned transition to **Option B (Full AWS)** once product-market fit is validated and scale demands it.

### Migration Timeline

```
Month 1-2:  Phase 1A - API Gateway + Lambda (Gemini proxy)
Month 2-3:  Phase 1B - Usage tracking + Stripe integration
Month 3-4:  Phase 1C - Rate limiting + user tiers
Month 6+:   Phase 2  - Full AWS migration (if needed)
```

---

## Component Mapping: Firebase → AWS

| Firebase Service    | AWS Equivalent                    | Migration Complexity | Notes                                         |
| ------------------- | --------------------------------- | -------------------- | --------------------------------------------- |
| **Firebase Auth**   | AWS Cognito                       | Medium               | Need to migrate user accounts, or keep hybrid |
| **Firestore**       | DynamoDB or RDS (PostgreSQL)      | High                 | Data model changes, no real-time out-of-box   |
| **Cloud Storage**   | S3                                | Low                  | Simple API swap                               |
| **App Check**       | WAF + API Gateway throttling      | Low                  | Built-in API Gateway features                 |
| **Security Rules**  | IAM + Lambda authorizers          | Medium               | Move logic to backend code                    |
| **Cloud Functions** | Lambda Functions                  | Low                  | Similar serverless model                      |
| **Hosting**         | CloudFront + S3 (keep Netlify OK) | Low                  | Netlify works fine for static hosting         |
| **Analytics**       | CloudWatch + X-Ray                | Low                  | Better server-side logging                    |

---

## Phase 1: Hybrid Architecture (AWS API + Firebase Data)

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                       React PWA (Vite)                           │
│                    Deployed on Netlify                           │
└────┬──────────────────────────────────┬──────────────────────────┘
     │                                  │
     │ (Auth & Real-time)               │ (API calls)
     ▼                                  ▼
┌──────────────────┐         ┌─────────────────────────────┐
│  Firebase Auth   │         │    AWS API Gateway          │
│  Firebase        │         │  - Rate Limiting            │
│  Firestore       │         │  - API Keys/JWT Auth        │
│  (Real-time DB)  │         │  - Usage Plans              │
└──────────────────┘         └────────┬────────────────────┘
                                      │
                                      ▼
                             ┌─────────────────────────────┐
                             │    Lambda Functions         │
                             │  - process_ai_task()        │
                             │  - track_usage()            │
                             │  - upload_file()            │
                             └────┬────────┬───────────────┘
                                  │        │
                 ┌────────────────┘        └──────────────┐
                 ▼                                        ▼
    ┌─────────────────────┐                  ┌────────────────────┐
    │   Gemini API        │                  │  Stripe Metering   │
    │   (Server-side)     │                  │  - Billing events  │
    └─────────────────────┘                  └────────────────────┘
                 │
                 ▼
    ┌─────────────────────────────────┐
    │   PostgreSQL RDS (Usage DB)     │
    │   - usage_events table          │
    │   - user_quotas table           │
    └─────────────────────────────────┘
```

### Request Flow Example: AI Task Processing

**Before (Current):**

1. User types task in React app
2. React app calls Gemini API directly (exposed API key)
3. React app saves result to Firestore
4. No usage tracking, no rate limiting enforcement

**After (Phase 1 Hybrid):**

1. User types task in React app
2. React app calls `POST /api/v1/tasks/process` (AWS API Gateway)
3. API Gateway validates rate limit (built-in quota)
4. Lambda function `process_ai_task`:
   - Validates user JWT (Firebase token)
   - Checks user tier from Firestore (`users/{uid}` doc)
   - Checks quota from RDS `usage_events` table
   - Calls Gemini API (server-side, hidden key)
   - Tracks usage in RDS
   - Sends meter event to Stripe
   - Returns result to client
5. React app saves task to Firestore (for real-time sync)

**Benefits:**

- ✅ Gemini API key hidden on server
- ✅ Unbypassable rate limiting
- ✅ Per-user usage tracking
- ✅ Stripe billing integration
- ✅ Keep Firestore real-time features

---

## Phase 2: Full AWS Architecture

### Architecture Diagram

```
                      ┌──────────────────────┐
                      │   Route 53 (DNS)     │
                      └──────────┬───────────┘
                                 │
                      ┌──────────▼───────────┐
                      │  CloudFront CDN      │
                      │  - React PWA (S3)    │
                      │  - Edge caching      │
                      └──────────┬───────────┘
                                 │
                      ┌──────────▼───────────┐
                      │   WAF (Web Firewall) │
                      │   - DDoS protection  │
                      │   - Bot filtering    │
                      └──────────┬───────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
     ┌────────▼─────────┐              ┌───────────▼────────┐
     │  API Gateway     │              │  S3 (Static Files) │
     │  /api/v1/*       │              │  - React build     │
     └────────┬─────────┘              └────────────────────┘
              │
     ┌────────▼─────────────────────────────────┐
     │   Application Load Balancer (ALB)        │
     │   - SSL Termination                      │
     │   - Health checks                        │
     └────────┬─────────────────────────────────┘
              │
     ┌────────▼─────────────────────────────────┐
     │   ECS Fargate Cluster                    │
     │   ┌──────────────────────────────────┐   │
     │   │  FastAPI Backend (Python)        │   │
     │   │  - Rate limiting (SlowAPI)       │   │
     │   │  - Business logic                │   │
     │   │  - JWT validation                │   │
     │   └──────────┬───────────────────────┘   │
     └──────────────┼───────────────────────────┘
                    │
     ┌──────────────┼───────────────────────────┐
     │              │                           │
     ▼              ▼                           ▼
┌─────────┐  ┌──────────────┐       ┌──────────────────┐
│  RDS    │  │  DynamoDB    │       │  ElastiCache     │
│  (SQL)  │  │  (NoSQL)     │       │  Redis           │
│ Users   │  │ Tasks        │       │ - Rate limiting  │
│ Usage   │  │ Categories   │       │ - Session cache  │
└─────────┘  └──────────────┘       └──────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│   CloudWatch + X-Ray + CloudTrail            │
│   - Logs, Metrics, Distributed Tracing       │
└──────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│   EventBridge + Lambda (Background Jobs)     │
│   - Send reminders                           │
│   - Daily usage reports                      │
│   - Stripe billing sync                      │
└──────────────────────────────────────────────┘
```

### Data Model: PostgreSQL (RDS)

**Replacing Firestore with relational model:**

```sql
-- Users table (replaces Firebase Auth users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE,  -- For migration phase
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    photo_url TEXT,
    tier VARCHAR(20) DEFAULT 'free',  -- 'free', 'pro', 'team'
    stripe_customer_id VARCHAR(128),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tasks table (replaces Firestore tasks collection)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    category VARCHAR(100),
    urgency VARCHAR(20),  -- 'High', 'Medium', 'Low'
    due_date TIMESTAMP,
    notes TEXT,
    completed BOOLEAN DEFAULT FALSE,
    is_new_category BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_completed (user_id, completed),
    INDEX idx_due_date (due_date)
);

-- Categories table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    hue INTEGER CHECK (hue >= 0 AND hue <= 360),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Attachments table
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    size_bytes BIGINT,
    s3_key TEXT NOT NULL,  -- S3 object key
    url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Usage tracking table
CREATE TABLE usage_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,  -- 'ai_call', 'storage_upload', 'api_request'
    quantity DECIMAL(10,2) DEFAULT 1,
    cost DECIMAL(10,6),  -- Actual cost incurred
    metadata JSONB,  -- Flexible additional data
    created_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_user_date (user_id, created_at),
    INDEX idx_event_type (event_type)
);

-- User quotas table (for rate limiting)
CREATE TABLE user_quotas (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    ai_calls_today INTEGER DEFAULT 0,
    api_calls_today INTEGER DEFAULT 0,
    storage_used_mb DECIMAL(10,2) DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Alternative: DynamoDB Model (Serverless Option)

**For tasks (NoSQL, similar to Firestore):**

```javascript
// Table: SnapList-Tasks
{
  PK: "USER#<user_id>",           // Partition Key
  SK: "TASK#<task_id>",           // Sort Key
  GSI1PK: "USER#<user_id>",       // Global Secondary Index 1
  GSI1SK: "DUE#<due_date>",       // For querying by due date
  title: "Buy milk",
  category: "Groceries",
  urgency: "High",
  completed: false,
  created_at: "2026-01-04T12:00:00Z"
}

// Table: SnapList-UsageEvents
{
  PK: "USER#<user_id>",
  SK: "EVENT#<timestamp>#<event_id>",
  event_type: "ai_call",
  quantity: 1,
  cost: 0.0001
}
```

**Benefits vs RDS:**

- Auto-scaling (no capacity planning)
- Pay per request (no idle costs)
- Sub-10ms latency
- No schema migrations

**Drawbacks vs RDS:**

- Limited query patterns (need to design keys carefully)
- No joins (need to denormalize data)
- Complex aggregations require DynamoDB Streams + Lambda

---

## Implementation Details

### Phase 1A: API Gateway + Lambda (Gemini Proxy)

**Step 1: Create Lambda Function for AI Processing**

**File:** `lambda/process_ai_task/index.py`

```python
import json
import os
import boto3
import requests
from datetime import datetime
import firebase_admin
from firebase_admin import auth, firestore

# Initialize Firebase Admin SDK (for token validation)
firebase_admin.initialize_app()
db = firestore.client()

# AWS clients
dynamodb = boto3.resource('dynamodb')
usage_table = dynamodb.Table(os.environ['USAGE_TABLE'])

# Secrets Manager for Gemini API key
secrets = boto3.client('secretsmanager')
gemini_key = secrets.get_secret_value(SecretId='gemini-api-key')['SecretString']

def lambda_handler(event, context):
    """
    Process AI task with Gemini API
    """
    try:
        # 1. Extract user token from headers
        token = event['headers'].get('Authorization', '').replace('Bearer ', '')

        # 2. Validate Firebase token (or JWT)
        decoded_token = auth.verify_id_token(token)
        user_id = decoded_token['uid']

        # 3. Check user tier from Firestore
        user_doc = db.collection('users').document(user_id).get()
        user_tier = user_doc.get('tier', 'free')

        # 4. Check quota from DynamoDB
        today = datetime.utcnow().date().isoformat()
        quota_key = f"USER#{user_id}#DATE#{today}"

        quota_item = usage_table.get_item(Key={'pk': quota_key}).get('Item', {})
        ai_calls_today = quota_item.get('ai_calls', 0)

        # Rate limit based on tier
        limits = {'free': 50, 'pro': 1000, 'team': 5000}
        if ai_calls_today >= limits[user_tier]:
            return {
                'statusCode': 429,
                'body': json.dumps({
                    'error': f'Daily limit reached ({limits[user_tier]} AI calls). Upgrade your plan.'
                })
            }

        # 5. Parse request body
        body = json.loads(event['body'])
        task_text = body['text']
        categories = body.get('categories', [])

        # 6. Call Gemini API (server-side, hidden key)
        gemini_response = requests.post(
            'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
            headers={'Content-Type': 'application/json'},
            params={'key': gemini_key},
            json={
                'contents': [{
                    'parts': [{
                        'text': f"Parse this task: {task_text}\nCategories: {categories}"
                    }]
                }],
                'generationConfig': {
                    'responseMimeType': 'application/json',
                    'responseSchema': {
                        'type': 'object',
                        'properties': {
                            'title': {'type': 'string'},
                            'category': {'type': 'string'},
                            'urgency': {'type': 'string'},
                            'dueDate': {'type': 'string'},
                            'notes': {'type': 'string'}
                        }
                    }
                }
            }
        )

        result = gemini_response.json()

        # 7. Track usage in DynamoDB
        usage_table.update_item(
            Key={'pk': quota_key},
            UpdateExpression='ADD ai_calls :inc SET updated_at = :now',
            ExpressionAttributeValues={
                ':inc': 1,
                ':now': datetime.utcnow().isoformat()
            }
        )

        # 8. Log to CloudWatch
        print(json.dumps({
            'event': 'ai_task_processed',
            'user_id': user_id,
            'tier': user_tier,
            'quota_used': ai_calls_today + 1,
            'timestamp': datetime.utcnow().isoformat()
        }))

        # 9. Return result
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'  # Configure properly for production
            },
            'body': json.dumps({
                'result': result,
                'quota': {
                    'used': ai_calls_today + 1,
                    'limit': limits[user_tier],
                    'tier': user_tier
                }
            })
        }

    except auth.InvalidIdTokenError:
        return {
            'statusCode': 401,
            'body': json.dumps({'error': 'Invalid authentication token'})
        }
    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
```

**Step 2: API Gateway Configuration**

**File:** `cloudformation/api-gateway.yaml` (excerpt)

```yaml
Resources:
  SnapListAPI:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: SnapListAPI
      ProtocolType: HTTP
      CorsConfiguration:
        AllowOrigins:
          - https://snaplist.netlify.app
          - http://localhost:5173
        AllowMethods:
          - GET
          - POST
          - PUT
          - DELETE
        AllowHeaders:
          - Content-Type
          - Authorization

  ProcessAITaskRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref SnapListAPI
      RouteKey: 'POST /api/v1/tasks/process'
      Target: !Sub 'integrations/${ProcessAITaskIntegration}'

  ProcessAITaskIntegration:
    Type: AWS::ApiGatewayV2::Integration
    Properties:
      ApiId: !Ref SnapListAPI
      IntegrationType: AWS_PROXY
      IntegrationUri: !GetAtt ProcessAITaskLambda.Arn
      PayloadFormatVersion: '2.0'

  # Rate limiting with Usage Plans
  UsagePlan:
    Type: AWS::ApiGateway::UsagePlan
    Properties:
      UsagePlanName: SnapListUsagePlan
      Throttle:
        RateLimit: 100 # requests per second
        BurstLimit: 200
      Quota:
        Limit: 10000 # requests per day
        Period: DAY
```

**Step 3: React Frontend Changes**

**File:** `src/services/api.js` (new file)

```javascript
import { getAuth } from 'firebase/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL; // AWS API Gateway URL

/**
 * Get Firebase ID token for authenticated requests
 */
async function getAuthToken() {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) throw new Error('User not authenticated');
  return await user.getIdToken();
}

/**
 * Call AWS backend API to process task with AI
 */
export async function processTaskWithAI(text, categories) {
  const token = await getAuthToken();

  const response = await fetch(`${API_BASE_URL}/api/v1/tasks/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text, categories }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to process task');
  }

  return await response.json();
}
```

**File:** `src/App.jsx` (modified)

```javascript
// OLD CODE (direct Gemini API call)
/*
const processWithAI = async (text) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const response = await fetch(`https://generativelanguage.googleapis.com/...`, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [...] }),
  });
  // ...
};
*/

// NEW CODE (AWS backend API)
import { processTaskWithAI } from './services/api';

const processWithAI = async (text) => {
  try {
    setIsProcessing(true);

    // Get category list for context
    const categoryList = categories.map((cat) => ({
      name: cat.name,
      description: cat.description,
    }));

    // Call AWS backend instead of direct Gemini API
    const { result, quota } = await processTaskWithAI(text, categoryList);

    // Show quota info to user
    if (quota.used >= quota.limit * 0.9) {
      toast.warning(
        `You've used ${quota.used}/${quota.limit} AI tasks today. ${
          quota.tier === 'free' ? 'Upgrade to Pro for unlimited tasks.' : ''
        }`
      );
    }

    // Save to Firestore (for real-time sync)
    await addDoc(collection(db, 'users', user.uid, 'tasks'), {
      ...result,
      completed: false,
      createdAt: serverTimestamp(),
      attachments: [],
    });

    setInputText('');
    toast.success('Task created!');
  } catch (err) {
    console.error(err);
    if (err.message.includes('Daily limit reached')) {
      toast.error(err.message);
    } else {
      toast.error('Failed to process task with AI. Please try again.');
    }
  } finally {
    setIsProcessing(false);
  }
};
```

**Step 4: Environment Variables**

**File:** `.env` (updated)

```bash
# Firebase (keep for auth + data)
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id

# AWS Backend API
VITE_API_BASE_URL=https://api.snaplist.com  # API Gateway custom domain

# Remove these (moved to backend)
# VITE_GEMINI_API_KEY=...  # Now in AWS Secrets Manager
```

---

### Phase 1B: Usage Tracking + Stripe Integration

**Lambda Function:** `lambda/track_usage/index.py`

```python
import stripe
import os

stripe.api_key = os.environ['STRIPE_API_KEY']

def track_and_bill(user_id, stripe_customer_id, event_type, quantity=1):
    """
    Track usage event and report to Stripe for billing
    """
    # Store in DynamoDB
    usage_table.put_item(Item={
        'pk': f"USER#{user_id}",
        'sk': f"EVENT#{datetime.utcnow().isoformat()}#{uuid.uuid4()}",
        'event_type': event_type,
        'quantity': quantity,
        'stripe_customer_id': stripe_customer_id,
        'billed': False
    })

    # Report to Stripe Metering API
    stripe.billing.MeterEvent.create(
        event_name="ai_task_processed",
        payload={
            "stripe_customer_id": stripe_customer_id,
            "value": quantity
        }
    )
```

**Stripe Setup:**

```bash
# 1. Create meter in Stripe (one-time)
stripe meters create \
  --display-name "AI Task Processing" \
  --event-name "ai_task_processed" \
  --default-aggregation sum \
  --value-settings-event-payload-key "value"

# 2. Create price attached to meter
stripe prices create \
  --currency usd \
  --billing_scheme per_unit \
  --unit_amount 10 \  # $0.10 per AI task
  --recurring interval=month \
  --recurring-meter <meter_id>
```

---

### Phase 1C: Rate Limiting Middleware

**Lambda Layer:** `layers/rate_limiter/python/rate_limiter.py`

```python
import redis
import os
from functools import wraps

# ElastiCache Redis connection
redis_client = redis.Redis(
    host=os.environ['REDIS_ENDPOINT'],
    port=6379,
    decode_responses=True
)

def rate_limit(limit_per_hour=100):
    """
    Decorator for Lambda functions to enforce rate limits
    """
    def decorator(func):
        @wraps(func)
        def wrapper(event, context):
            user_id = event['requestContext']['authorizer']['user_id']
            key = f"rate_limit:{user_id}:hour"

            # Increment counter
            count = redis_client.incr(key)

            # Set expiry on first request
            if count == 1:
                redis_client.expire(key, 3600)  # 1 hour

            # Check limit
            if count > limit_per_hour:
                return {
                    'statusCode': 429,
                    'body': json.dumps({
                        'error': 'Rate limit exceeded. Try again in an hour.'
                    })
                }

            # Add rate limit headers
            response = func(event, context)
            response['headers'] = response.get('headers', {})
            response['headers'].update({
                'X-RateLimit-Limit': str(limit_per_hour),
                'X-RateLimit-Remaining': str(limit_per_hour - count),
                'X-RateLimit-Reset': str(redis_client.ttl(key))
            })

            return response
        return wrapper
    return decorator

# Usage in Lambda function
@rate_limit(limit_per_hour=50)  # Free tier
def lambda_handler(event, context):
    # Function logic
    pass
```

---

## Cost Analysis

### Current Costs (Firebase-Only)

| Service                 | Free Tier              | Estimated Cost (100 users) | Estimated Cost (1000 users) |
| ----------------------- | ---------------------- | -------------------------- | --------------------------- |
| **Netlify**             | 100GB/month            | $0                         | $0 (within free tier)       |
| **Firebase Firestore**  | 50K reads, 20K writes  | $0-5                       | $25-50                      |
| **Firebase Storage**    | 5GB, 1GB/day downloads | $0-2                       | $10-20                      |
| **Firebase Auth**       | Unlimited              | $0                         | $0                          |
| **Gemini API**          | 1,500 req/day          | $0 (within free tier)      | $50-100 (if exceeded)       |
| **App Check reCAPTCHA** | 10K assessments/month  | $0                         | $10 (if exceeded)           |
| **Total**               |                        | **$5-7/month**             | **$95-180/month**           |

### Phase 1 Hybrid Costs (AWS API + Firebase)

| Service                    | Free Tier                | Estimated Cost (100 users) | Estimated Cost (1000 users) |
| -------------------------- | ------------------------ | -------------------------- | --------------------------- |
| **Netlify**                | Same as above            | $0                         | $0                          |
| **Firebase** (auth + data) | Same as above            | $3-5                       | $30-50                      |
| **API Gateway**            | 1M requests/month free   | $0-1                       | $3.50 (1M requests)         |
| **Lambda**                 | 1M requests, 400K GB-sec | $0-2                       | $10-15                      |
| **DynamoDB** (usage table) | 25GB storage, 25 WCU/RCU | $0                         | $5-10                       |
| **ElastiCache Redis**      | -                        | $15 (t4g.micro)            | $15 (can scale up)          |
| **Secrets Manager**        | $0.40/secret/month       | $1                         | $1                          |
| **CloudWatch Logs**        | 5GB free                 | $0-1                       | $5-10                       |
| **Data Transfer**          | 100GB/month free         | $0                         | $5-10                       |
| **Total**                  |                          | **$20-25/month**           | **$90-120/month**           |

**Cost Increase:** ~$15-20/month for <100 users, **~$10-60/month savings** at 1000+ users

### Phase 2 Full AWS Costs

| Service                 | Free Tier               | Estimated Cost (100 users) | Estimated Cost (1000 users) |
| ----------------------- | ----------------------- | -------------------------- | --------------------------- |
| **CloudFront**          | 1TB/month for 12 months | $1-5                       | $10-20                      |
| **S3** (static hosting) | 5GB storage, 20K GET    | $0-1                       | $2-5                        |
| **ALB**                 | -                       | $16 (fixed)                | $16-25                      |
| **ECS Fargate**         | -                       | $30 (0.25 vCPU)            | $120 (1 vCPU, 2 tasks)      |
| **RDS PostgreSQL**      | 750 hrs/month (t3.micro | $0-15                      | $50-100 (t3.small + backup) |
| **ElastiCache Redis**   | -                       | $15                        | $30 (m6g.large)             |
| **CloudWatch**          | 5GB free                | $2-5                       | $15-25                      |
| **Route 53**            | $0.50/hosted zone       | $1                         | $1                          |
| **WAF**                 | -                       | $5-10                      | $10-20                      |
| **Secrets Manager**     | -                       | $1                         | $2                          |
| **Total**               |                         | **$71-102/month**          | **$256-368/month**          |

**Break-even point:** ~500-1000 users (Firebase costs exceed AWS costs)

---

## Migration Strategy

### Pre-Migration Checklist

- [ ] Set up AWS account with Organizations (separate dev/staging/prod)
- [ ] Configure AWS CLI and credentials
- [ ] Set up Terraform or CloudFormation for Infrastructure as Code
- [ ] Create DynamoDB tables for usage tracking
- [ ] Set up RDS PostgreSQL instance (or DynamoDB)
- [ ] Configure ElastiCache Redis cluster
- [ ] Store Gemini API key in AWS Secrets Manager
- [ ] Set up CloudWatch log groups
- [ ] Create Stripe account and configure meters
- [ ] Set up CI/CD pipeline (GitHub Actions → AWS)

### Migration Steps (Phase 1)

#### Week 1: Infrastructure Setup

```bash
# 1. Initialize Terraform
cd infrastructure/terraform
terraform init
terraform plan
terraform apply

# 2. Deploy Lambda functions
cd lambda
./deploy.sh  # Packages and uploads to AWS

# 3. Configure API Gateway
aws cloudformation deploy \
  --template-file api-gateway.yaml \
  --stack-name snaplist-api \
  --capabilities CAPABILITY_IAM
```

#### Week 2: Backend Implementation

1. **Create Lambda functions**:
   - `process_ai_task` - AI processing with Gemini
   - `upload_file` - S3 file upload proxy
   - `track_usage` - Usage event logging
2. **Set up API Gateway routes**:
   - `POST /api/v1/tasks/process`
   - `POST /api/v1/files/upload`
   - `GET /api/v1/usage/{userId}`
3. **Configure authorizers**:
   - Firebase JWT validation Lambda authorizer
4. **Test endpoints** with Postman/curl

#### Week 3: Frontend Integration

1. **Create API client** (`src/services/api.js`)
2. **Update App.jsx** to call AWS APIs instead of direct Gemini
3. **Add quota display** in UI (show user their usage)
4. **Environment variables** for API Gateway URL
5. **Test in local development** (with staging API)

#### Week 4: Testing & Deployment

1. **End-to-end testing**:
   - AI task processing
   - Rate limiting (trigger 429 errors)
   - File uploads
   - Usage tracking
2. **Load testing** with Apache Bench or Locust
3. **Monitor CloudWatch** for errors
4. **Deploy to production**:
   ```bash
   npm run build
   netlify deploy --prod
   ```
5. **Monitor for 48 hours** before announcing

### Data Migration (Phase 2 Only)

**If migrating from Firestore to RDS:**

**Script:** `scripts/migrate_firestore_to_rds.py`

```python
import firebase_admin
from firebase_admin import firestore
import psycopg2
from datetime import datetime

# Initialize Firebase
firebase_admin.initialize_app()
db = firestore.client()

# PostgreSQL connection
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

def migrate_users():
    """Migrate users from Firestore to PostgreSQL"""
    users_ref = db.collection('users')

    for user_doc in users_ref.stream():
        user_data = user_doc.to_dict()

        cur.execute("""
            INSERT INTO users (firebase_uid, email, display_name, tier, created_at)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (firebase_uid) DO NOTHING
        """, (
            user_doc.id,
            user_data.get('email'),
            user_data.get('displayName'),
            user_data.get('tier', 'free'),
            user_data.get('createdAt', datetime.utcnow())
        ))

    conn.commit()
    print(f"Migrated {users_ref.stream().__sizeof__()} users")

def migrate_tasks():
    """Migrate tasks from Firestore to PostgreSQL"""
    users_ref = db.collection('users')

    for user_doc in users_ref.stream():
        tasks_ref = db.collection('users', user_doc.id, 'tasks')

        # Get user's internal ID from PostgreSQL
        cur.execute("SELECT id FROM users WHERE firebase_uid = %s", (user_doc.id,))
        user_id = cur.fetchone()[0]

        for task_doc in tasks_ref.stream():
            task_data = task_doc.to_dict()

            cur.execute("""
                INSERT INTO tasks (
                    user_id, title, category, urgency, due_date,
                    notes, completed, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id,
                task_data.get('title'),
                task_data.get('category'),
                task_data.get('urgency'),
                task_data.get('dueDate'),
                task_data.get('notes'),
                task_data.get('completed', False),
                task_data.get('createdAt', datetime.utcnow())
            ))

    conn.commit()
    print("Tasks migrated")

# Run migration
migrate_users()
migrate_tasks()
```

**Run migration:**

```bash
export DATABASE_URL="postgresql://user:pass@snaplist-db.amazonaws.com/snaplist"
python scripts/migrate_firestore_to_rds.py
```

---

## Infrastructure as Code

### Terraform Project Structure

```
infrastructure/
├── terraform/
│   ├── modules/
│   │   ├── api-gateway/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   └── outputs.tf
│   │   ├── lambda/
│   │   ├── rds/
│   │   ├── elasticache/
│   │   └── ecs/
│   ├── environments/
│   │   ├── dev/
│   │   │   └── main.tf
│   │   ├── staging/
│   │   └── prod/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
└── cloudformation/  # Alternative to Terraform
    ├── api-gateway.yaml
    ├── lambda.yaml
    └── rds.yaml
```

### Example Terraform Module: Lambda Function

**File:** `infrastructure/terraform/modules/lambda/main.tf`

```hcl
resource "aws_lambda_function" "process_ai_task" {
  filename         = "${path.module}/../../../../lambda/process_ai_task.zip"
  function_name    = "snaplist-${var.environment}-process-ai-task"
  role            = aws_iam_role.lambda_exec.arn
  handler         = "index.lambda_handler"
  runtime         = "python3.12"
  timeout         = 30
  memory_size     = 512

  environment {
    variables = {
      USAGE_TABLE         = var.usage_table_name
      REDIS_ENDPOINT      = var.redis_endpoint
      STRIPE_API_KEY      = var.stripe_api_key
      FIREBASE_CREDENTIALS = var.firebase_credentials_secret_arn
    }
  }

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.lambda_security_group_id]
  }

  tags = {
    Environment = var.environment
    Project     = "SnapList"
  }
}

resource "aws_iam_role" "lambda_exec" {
  name = "snaplist-${var.environment}-lambda-exec"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_policy" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_dynamodb" {
  name = "lambda-dynamodb-access"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ]
      Resource = var.usage_table_arn
    }]
  })
}
```

### Deploy with Terraform

```bash
# Initialize
cd infrastructure/terraform/environments/prod
terraform init

# Plan
terraform plan -out=tfplan

# Apply
terraform apply tfplan

# Get outputs (API Gateway URL)
terraform output api_gateway_url
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**File:** `.github/workflows/deploy-aws.yml`

```yaml
name: Deploy to AWS

on:
  push:
    branches:
      - main # Trigger on main branch push

env:
  AWS_REGION: us-east-1
  ENVIRONMENT: prod

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: |
          cd lambda
          pip install -r requirements.txt -t process_ai_task/
          pip install pytest boto3-stubs

      - name: Run tests
        run: |
          pytest lambda/tests/

  deploy-lambda:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Package Lambda functions
        run: |
          cd lambda
          ./package.sh  # Zips all functions

      - name: Deploy Lambda functions
        run: |
          aws lambda update-function-code \
            --function-name snaplist-prod-process-ai-task \
            --zip-file fileb://lambda/process_ai_task.zip

          aws lambda update-function-code \
            --function-name snaplist-prod-upload-file \
            --zip-file fileb://lambda/upload_file.zip

  deploy-frontend:
    needs: deploy-lambda
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Build React app
        run: npm run build
        env:
          VITE_API_BASE_URL: https://api.snaplist.com
          VITE_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          # ... other env vars

      - name: Deploy to Netlify
        uses: netlify/actions/cli@master
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
        with:
          args: deploy --prod

  notify:
    needs: [deploy-lambda, deploy-frontend]
    runs-on: ubuntu-latest
    steps:
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "✅ SnapList deployed to production",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*SnapList Production Deployment*\n✅ Lambda functions updated\n✅ Frontend deployed to Netlify"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Monitoring & Observability

### CloudWatch Dashboards

**Terraform:** `infrastructure/terraform/modules/monitoring/cloudwatch.tf`

```hcl
resource "aws_cloudwatch_dashboard" "snaplist" {
  dashboard_name = "SnapList-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", { stat = "Sum", label = "Total Invocations" }],
            [".", "Errors", { stat = "Sum", label = "Errors" }],
            [".", "Duration", { stat = "Average", label = "Avg Duration (ms)" }]
          ]
          period = 300
          stat   = "Average"
          region = var.aws_region
          title  = "Lambda Metrics"
        }
      },
      {
        type = "metric"
        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", { stat = "Sum" }],
            [".", "4XXError", { stat = "Sum" }],
            [".", "5XXError", { stat = "Sum" }]
          ]
          period = 300
          region = var.aws_region
          title  = "API Gateway Metrics"
        }
      },
      {
        type = "log"
        properties = {
          query = <<EOF
fields @timestamp, @message
| filter event = "ai_task_processed"
| stats count() by user_id
| sort count desc
| limit 20
EOF
          region      = var.aws_region
          title       = "Top 20 Users by AI Usage"
          logGroupNames = ["/aws/lambda/snaplist-${var.environment}-process-ai-task"]
        }
      }
    ]
  })
}
```

### CloudWatch Alarms

```hcl
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "snaplist-${var.environment}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name        = "Errors"
  namespace          = "AWS/Lambda"
  period             = 300
  statistic          = "Sum"
  threshold          = 10
  alarm_description  = "Alert when Lambda errors exceed 10 in 5 minutes"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    FunctionName = aws_lambda_function.process_ai_task.function_name
  }
}

resource "aws_sns_topic" "alerts" {
  name = "snaplist-${var.environment}-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}
```

### X-Ray Distributed Tracing

**Enable in Lambda:**

```python
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all

# Patch all supported libraries
patch_all()

@xray_recorder.capture('process_ai_task')
def lambda_handler(event, context):
    # Subsegment for Gemini API call
    with xray_recorder.capture('gemini_api_call'):
        response = requests.post(gemini_url, json=payload)

    # Subsegment for DynamoDB write
    with xray_recorder.capture('dynamodb_write'):
        usage_table.put_item(Item=item)

    return result
```

### Custom Metrics

```python
import boto3

cloudwatch = boto3.client('cloudwatch')

def publish_metric(metric_name, value, unit='Count'):
    """Publish custom metric to CloudWatch"""
    cloudwatch.put_metric_data(
        Namespace='SnapList',
        MetricData=[{
            'MetricName': metric_name,
            'Value': value,
            'Unit': unit,
            'Timestamp': datetime.utcnow()
        }]
    )

# Usage
publish_metric('AITasksProcessed', 1)
publish_metric('QuotaExceeded', 1)
```

---

## Security Considerations

### 1. Secrets Management

**Store all secrets in AWS Secrets Manager:**

```bash
# Store Gemini API key
aws secretsmanager create-secret \
  --name snaplist/prod/gemini-api-key \
  --secret-string "AIzaSy..."

# Store Stripe API key
aws secretsmanager create-secret \
  --name snaplist/prod/stripe-api-key \
  --secret-string "sk_live_..."

# Store Firebase service account
aws secretsmanager create-secret \
  --name snaplist/prod/firebase-credentials \
  --secret-string file://firebase-adminsdk.json
```

**Lambda access:**

```python
import boto3
import json

secrets_client = boto3.client('secretsmanager')

def get_secret(secret_name):
    response = secrets_client.get_secret_value(SecretId=secret_name)
    return response['SecretString']

# Usage
gemini_key = get_secret('snaplist/prod/gemini-api-key')
```

### 2. IAM Least Privilege

**Lambda execution role (minimal permissions):**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:us-east-1:*:log-group:/aws/lambda/snaplist-*"
    },
    {
      "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem"],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/snaplist-usage-*"
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:snaplist/prod/*"
    }
  ]
}
```

### 3. VPC Configuration

**Lambda in private subnets (for RDS access):**

```hcl
resource "aws_lambda_function" "process_ai_task" {
  # ... other config

  vpc_config {
    subnet_ids         = var.private_subnet_ids  # No internet access
    security_group_ids = [aws_security_group.lambda.id]
  }
}

# NAT Gateway for internet access (Gemini API)
resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = var.public_subnet_ids[0]
}
```

### 4. API Gateway Security

**Enable WAF and throttling:**

```yaml
Resources:
  WebACL:
    Type: AWS::WAFv2::WebACL
    Properties:
      DefaultAction:
        Allow: {}
      Rules:
        - Name: RateLimitRule
          Priority: 1
          Statement:
            RateBasedStatement:
              Limit: 2000 # requests per 5 minutes per IP
              AggregateKeyType: IP
          Action:
            Block: {}
        - Name: BlockBadBots
          Priority: 2
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesKnownBadInputsRuleSet
          Action:
            Block: {}
```

### 5. Encryption

- **At Rest**: Enable encryption for RDS, DynamoDB, S3, ElastiCache
- **In Transit**: HTTPS/TLS 1.2+ for all API calls
- **Secrets**: AWS Secrets Manager with automatic rotation

---

## Rollback Plan

### Automated Rollback (CloudFormation)

```bash
# If deployment fails, CloudFormation auto-rolls back
aws cloudformation deploy \
  --template-file api-gateway.yaml \
  --stack-name snaplist-api \
  --on-failure ROLLBACK

# Manual rollback to previous version
aws cloudformation rollback-stack --stack-name snaplist-api
```

### Lambda Version Rollback

```bash
# List previous versions
aws lambda list-versions-by-function \
  --function-name snaplist-prod-process-ai-task

# Rollback to version 3
aws lambda update-alias \
  --function-name snaplist-prod-process-ai-task \
  --name prod \
  --function-version 3
```

### Feature Flags (Gradual Rollout)

**Use LaunchDarkly or AWS AppConfig:**

```python
import boto3

appconfig = boto3.client('appconfig')

def get_feature_flag(flag_name):
    config = appconfig.get_configuration(
        Application='snaplist',
        Environment='prod',
        Configuration='feature-flags',
        ClientId='lambda-process-ai-task'
    )
    flags = json.loads(config['Content'].read())
    return flags.get(flag_name, False)

# Usage in Lambda
if get_feature_flag('use_aws_backend'):
    # Call new AWS backend
    result = process_with_aws_backend(task)
else:
    # Fallback to old direct Gemini call
    result = process_with_gemini_direct(task)
```

**Gradually roll out:**

- 10% of traffic → Monitor for 24 hours
- 50% of traffic → Monitor for 48 hours
- 100% of traffic → Full rollout

---

## Conclusion

### Recommended Path Forward

1. **Short-term (Month 1-3)**: Implement Phase 1 Hybrid

   - Move Gemini API calls to AWS Lambda
   - Add usage tracking and rate limiting
   - Integrate Stripe metering
   - **Cost:** +$15-20/month
   - **Risk:** Low (incremental changes)

2. **Medium-term (Month 3-6)**: Optimize Hybrid

   - Add caching with ElastiCache
   - Implement background jobs (reminders)
   - Advanced analytics with CloudWatch Insights
   - **Cost:** +$5-10/month
   - **Risk:** Low (infrastructure additions)

3. **Long-term (Month 6+)**: Evaluate Full AWS
   - Only if scaling to 1000+ users
   - Migrate Firestore → RDS/DynamoDB
   - Build custom real-time sync (WebSockets)
   - **Cost:** Variable ($100-300/month at scale)
   - **Risk:** High (major rewrite)

### Next Steps

1. Review this document and discuss team alignment
2. Set up AWS account and billing alerts
3. Create Terraform infrastructure for Phase 1
4. Implement first Lambda function (AI processing)
5. Test in staging environment
6. Gradual rollout to production with feature flags

---

## Appendix

### Useful AWS CLI Commands

```bash
# View Lambda logs
aws logs tail /aws/lambda/snaplist-prod-process-ai-task --follow

# Get API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --start-time 2026-01-01T00:00:00Z \
  --end-time 2026-01-04T23:59:59Z \
  --period 3600 \
  --statistics Sum

# List DynamoDB table contents
aws dynamodb scan --table-name snaplist-usage-prod

# Test Lambda function locally
aws lambda invoke \
  --function-name snaplist-prod-process-ai-task \
  --payload '{"body": "{\"text\": \"Buy milk\"}"}' \
  response.json
```

### Terraform State Management

```bash
# Use S3 backend for team collaboration
terraform {
  backend "s3" {
    bucket = "snaplist-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt = true
  }
}
```

### Cost Optimization Tips

1. **Use ARM-based instances** (Graviton2): 20% cheaper than x86
2. **Reserved Instances** for RDS/ElastiCache (if committed): 30-50% savings
3. **S3 Intelligent Tiering** for old files: Automatic cost optimization
4. **Lambda SnapStart** (Java): Reduce cold starts without cost
5. **CloudWatch Logs retention**: Set to 7-30 days (default is forever)

---

**Document Version:** 1.0
**Last Updated:** January 4, 2026
**Author:** Claude Code (with SnapList Team)
**Status:** Draft for Review
