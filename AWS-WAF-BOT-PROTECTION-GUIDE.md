# AWS WAF Bot Protection Guide

## Executive Summary

This document provides a comprehensive guide to AWS WAF (Web Application Firewall) and its bot protection capabilities, specifically the **Challenge action**, **CAPTCHA action**, and **Bot Control** managed rule group. This serves as an alternative or complement to Firebase App Check for protecting web applications from bots, scrapers, and malicious traffic.

**Key Capabilities:**

- **Challenge**: Invisible JavaScript-based browser verification (similar to reCAPTCHA v3)
- **CAPTCHA**: Visible puzzle challenges for suspicious traffic
- **Bot Control**: Advanced bot detection using fingerprinting, behavioral analysis, and ML
- **Rate Limiting**: Built-in request throttling per IP or session
- **Custom Rules**: Fine-grained control over traffic filtering

**Cost Impact:** For SnapList with 100 users: ~$24/month. For 1000+ users: ~$64/month.

---

## Table of Contents

1. [AWS WAF Overview](#aws-waf-overview)
2. [Challenge Action (Invisible Verification)](#challenge-action-invisible-verification)
3. [CAPTCHA Action (Visible Puzzle)](#captcha-action-visible-puzzle)
4. [Bot Control (Advanced Detection)](#bot-control-advanced-detection)
5. [How They Work Together](#how-they-work-together)
6. [Implementation Guide](#implementation-guide)
7. [Configuration Examples](#configuration-examples)
8. [Monitoring & Analytics](#monitoring--analytics)
9. [Cost Analysis](#cost-analysis)
10. [Comparison: WAF vs Firebase App Check](#comparison-waf-vs-firebase-app-check)
11. [Recommendations for SnapList](#recommendations-for-snaplist)
12. [Troubleshooting](#troubleshooting)

---

## AWS WAF Overview

### What is AWS WAF?

**AWS WAF (Web Application Firewall)** is a managed firewall service that protects web applications from common web exploits and bots. It sits between your users and your application, inspecting every HTTP/HTTPS request.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        End Users                                 │
│            (Browsers, Mobile Apps, Bots)                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AWS WAF                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Rules Engine                                             │  │
│  │  - Challenge (JavaScript verification)                    │  │
│  │  - CAPTCHA (visual puzzles)                              │  │
│  │  - Bot Control (ML-based detection)                      │  │
│  │  - Rate limiting                                         │  │
│  │  - Geo-blocking                                          │  │
│  │  - Custom rules                                          │  │
│  └───────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Protected Resources                              │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ CloudFront  │  │     ALB     │  │ API Gateway │            │
│  │    (CDN)    │  │ (Load Bal.) │  │   (APIs)    │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│         │                 │                 │                   │
│         └─────────────────┴─────────────────┘                   │
│                         │                                       │
│                         ▼                                       │
│              ┌─────────────────────┐                           │
│              │ Your Application    │                           │
│              │ (Lambda, ECS, EC2)  │                           │
│              └─────────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

### Key Concepts

**Web ACL (Access Control List)**

- Collection of rules that define traffic filtering logic
- Attached to CloudFront, ALB, or API Gateway
- Evaluated in priority order (lower number = higher priority)

**Rules**

- Individual conditions that match requests (IP, headers, body, etc.)
- Can have actions: Allow, Block, Count, Challenge, CAPTCHA
- Can add labels for downstream processing

**Rule Groups**

- Collections of reusable rules
- AWS-managed (Bot Control, Core Rule Set) or custom

**Tokens**

- Issued after successful Challenge or CAPTCHA completion
- Stored in cookies
- Valid for ~5 minutes (customizable)
- Automatically sent with subsequent requests

---

## Challenge Action (Invisible Verification)

### What It Does

The **Challenge action** runs a **silent JavaScript test** in the user's browser to verify it's a legitimate browser and not a bot. This happens **without user interaction** — no visible CAPTCHA puzzle.

**Think of it as:** AWS's version of reCAPTCHA v3's invisible mode.

### How It Works

```
┌──────────────────────────────────────────────────────────────┐
│  Step 1: User Request                                        │
│  Browser → WAF: "GET /tasks"                                 │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 2: WAF Evaluation                                      │
│  - No valid token in cookies                                 │
│  - Challenge rule matches                                    │
│  → Send Challenge response                                   │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 3: JavaScript Challenge Sent to Browser                │
│  HTTP 202 (Accepted) with JavaScript payload:                │
│  <html>                                                       │
│    <script src="aws-waf-challenge.js"></script>             │
│    <script>                                                   │
│      // Cryptographic puzzle                                 │
│      // Browser fingerprinting                               │
│      // Execution timing checks                              │
│      solveChallenge().then(token => {                        │
│        setCookie('aws-waf-token', token);                    │
│        window.location.reload(); // Retry original request   │
│      });                                                      │
│    </script>                                                  │
│  </html>                                                      │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 4: Browser Executes Challenge                          │
│  - Runs cryptographic computations (~200-500ms)              │
│  - Proves JavaScript execution capability                    │
│  - Generates proof-of-work token                             │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 5: Retry with Token                                    │
│  Browser → WAF: "GET /tasks"                                 │
│  Cookie: aws-waf-token=eyJhbGc...                            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 6: Token Validation                                    │
│  - WAF verifies token cryptographic signature                │
│  - Checks token timestamp (not expired)                      │
│  - Validates token scope (correct Web ACL)                   │
│  → Token valid: Allow request                                │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Step 7: Request Forwarded to Application                    │
│  WAF → Application: "GET /tasks" (request allowed)           │
└──────────────────────────────────────────────────────────────┘
```

### User Experience

**Legitimate Browser (Chrome, Firefox, Safari):**

- ✅ First request: ~500ms delay (Challenge execution)
- ✅ Subsequent requests: No delay (token cached)
- ✅ User sees **nothing** — seamless experience

**Bot/Script (Python requests, curl, Selenium without proper execution):**

- ❌ JavaScript challenge fails or times out
- ❌ Request blocked (403 Forbidden) or escalated to CAPTCHA
- ❌ Cannot proceed without solving CAPTCHA

### When to Use Challenge

**Best for:**

- First-time visitors (no token yet)
- Suspicious traffic patterns
- After failed authentication attempts
- Protecting sensitive endpoints (`/api/admin/*`)

**Avoid for:**

- Static assets (images, CSS, JS) — adds unnecessary latency
- Public APIs consumed by known partners — use API keys instead
- Verified bots (search engines) — use Bot Control to allow them

### Configuration

**Basic Challenge Rule:**

```yaml
# CloudFormation / Terraform
Rules:
  - Name: ChallengeAllTraffic
    Priority: 10
    Statement:
      NotStatement: # Challenge if NO valid token
        Statement:
          LabelMatchStatement:
            Scope: LABEL
            Key: awswaf:managed:token:accepted
    Action:
      Challenge:
        ImmunityTimeProperty:
          ImmunityTime: 300 # Token valid for 5 minutes (default: 300s)
    VisibilityConfig:
      SampledRequestsEnabled: true
      CloudWatchMetricsEnabled: true
      MetricName: ChallengeActions
```

**Challenge Specific Paths:**

```yaml
# Only challenge API endpoints, not static files
Statement:
  AndStatement:
    Statements:
      - ByteMatchStatement:
          SearchString: /api/
          FieldToMatch:
            UriPath: {}
          TextTransformations:
            - Priority: 0
              Type: LOWERCASE
      - NotStatement:
          Statement:
            LabelMatchStatement:
              Key: awswaf:managed:token:accepted
Action:
  Challenge: {}
```

### Immunity Time

**Immunity Time** determines how long a token remains valid after solving a Challenge.

| Immunity Time | Use Case                              | Trade-offs                                   |
| ------------- | ------------------------------------- | -------------------------------------------- |
| **60s**       | High security, frequent re-challenges | ❌ More overhead, ✅ harder to abuse         |
| **300s**      | Balanced (default)                    | ⚖️ Good UX, moderate security                |
| **900s**      | Low friction, user-friendly           | ✅ Best UX, ❌ longer window for token reuse |

**Custom Immunity Time:**

```yaml
Action:
  Challenge:
    CustomRequestHandling:
      InsertHeaders:
        - Name: x-challenge-timestamp
          Value: ${timestamp}
    ImmunityTimeProperty:
      ImmunityTime: 600 # 10 minutes
```

---

## CAPTCHA Action (Visible Puzzle)

### What It Does

The **CAPTCHA action** shows a **visual puzzle** to users, requiring them to prove they're human by solving a challenge. This is **visible** and requires **user interaction**.

**Examples of puzzles:**

- Select all images with traffic lights
- Type the distorted text
- Click "I'm not a robot" checkbox

### When to Use CAPTCHA

**Escalation scenarios:**

1. **Challenge Failed**: JavaScript test couldn't verify browser
2. **Rate Limit Exceeded**: User made too many requests
3. **Suspicious Behavior**: Multiple failed login attempts, unusual patterns
4. **High-Risk Actions**: Password reset, account creation

**DO NOT use for:**

- Every request (terrible UX)
- Static content (images, CSS)
- Verified users with active sessions

### User Experience

**User Flow:**

```
1. User triggers CAPTCHA rule (e.g., exceeds rate limit)
   ↓
2. WAF sends CAPTCHA response (HTTP 405)
   ↓
3. Browser shows CAPTCHA page:
   ┌─────────────────────────────────────┐
   │  🛡️ Security Check                  │
   │                                     │
   │  To continue, please verify you're  │
   │  not a robot.                       │
   │                                     │
   │  [  ]  I'm not a robot              │
   │                                     │
   │  ──────────────────────────────     │
   │  Select all squares with:           │
   │                                     │
   │  🚦 Traffic Lights                  │
   │  ┌───┬───┬───┐                      │
   │  │   │ ✓ │   │                      │
   │  ├───┼───┼───┤                      │
   │  │ ✓ │   │ ✓ │                      │
   │  ├───┼───┼───┤                      │
   │  │   │   │   │                      │
   │  └───┴───┴───┘                      │
   │                                     │
   │  [Verify]                           │
   └─────────────────────────────────────┘
   ↓
4. User solves puzzle
   ↓
5. WAF issues token (cookie: aws-waf-token)
   ↓
6. Browser retries original request with token
   ↓
7. WAF validates token → Request allowed
   ↓
8. User can browse normally (token valid for immunity period)
```

**After solving:**

- Token stored in cookie
- Valid for immunity period (5-15 minutes, configurable)
- User can make requests without seeing CAPTCHA again

### Configuration

**Basic CAPTCHA Rule (Rate Limiting):**

```yaml
Rules:
  - Name: RateLimitCAPTCHA
    Priority: 20
    Statement:
      RateBasedStatement:
        Limit: 2000 # Requests per 5 minutes
        AggregateKeyType: IP
    Action:
      Captcha:
        ImmunityTimeProperty:
          ImmunityTime: 300 # 5 minutes of access after solving
    VisibilityConfig:
      SampledRequestsEnabled: true
      CloudWatchMetricsEnabled: true
      MetricName: RateLimitCAPTCHAs
```

**CAPTCHA for Failed Challenges:**

```yaml
# If Challenge fails, escalate to CAPTCHA
Rules:
  # First: Try Challenge
  - Name: ChallengeFirst
    Priority: 10
    Statement:
      NotStatement:
        Statement:
          LabelMatchStatement:
            Key: awswaf:managed:token:accepted
    Action:
      Challenge: {}

  # Second: If Challenge fails, show CAPTCHA
  - Name: CAPTCHAOnChallengeFail
    Priority: 11
    Statement:
      LabelMatchStatement:
        Scope: LABEL
        Key: awswaf:managed:token:rejected
    Action:
      Captcha:
        ImmunityTimeProperty:
          ImmunityTime: 900 # 15 minutes after solving
```

**CAPTCHA for Sensitive Actions:**

```yaml
# Require CAPTCHA for login/signup endpoints
Statement:
  OrStatement:
    Statements:
      - ByteMatchStatement:
          SearchString: /api/auth/login
          FieldToMatch:
            UriPath: {}
          TextTransformations:
            - Priority: 0
              Type: LOWERCASE
      - ByteMatchStatement:
          SearchString: /api/auth/signup
          FieldToMatch:
            UriPath: {}
          TextTransformations:
            - Priority: 0
              Type: LOWERCASE
Action:
  Captcha:
    ImmunityTimeProperty:
      ImmunityTime: 1800 # 30 minutes
```

### Custom CAPTCHA Page

By default, AWS WAF shows a generic CAPTCHA page. You can customize it:

**Terraform Configuration:**

```hcl
resource "aws_wafv2_web_acl" "main" {
  # ... other config

  captcha_config {
    immunity_time_property {
      immunity_time = 300
    }
  }

  # Note: Full HTML customization requires CloudFront custom error pages
}
```

**CloudFront Custom Error Page** (for branded CAPTCHA):

```hcl
resource "aws_cloudfront_distribution" "main" {
  # ... other config

  custom_error_response {
    error_code            = 405 # WAF CAPTCHA response
    response_code         = 200
    response_page_path    = "/custom-captcha.html"
    error_caching_min_ttl = 0
  }
}
```

**File:** `public/custom-captcha.html`

```html
<!doctype html>
<html>
  <head>
    <title>SnapList - Security Verification</title>
    <style>
      body {
        font-family: 'Inter', sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .captcha-container {
        background: white;
        padding: 3rem;
        border-radius: 1rem;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        text-align: center;
        max-width: 400px;
      }
      h1 {
        color: #667eea;
        margin-bottom: 1rem;
      }
      p {
        color: #64748b;
        margin-bottom: 2rem;
      }
    </style>
  </head>
  <body>
    <div class="captcha-container">
      <h1>🛡️ SnapList Security Check</h1>
      <p>To protect our users, please verify you're human.</p>
      <!-- AWS WAF CAPTCHA widget inserted here automatically -->
      <div id="aws-waf-captcha"></div>
    </div>
  </body>
</html>
```

---

## Bot Control (Advanced Detection)

### What It Is

**AWS Managed Rules Bot Control** is a **paid add-on** ($10/month) that provides advanced bot detection using:

1. **TLS Fingerprinting**: Analyzes TLS handshake patterns (JA3, JA4 signatures)
2. **HTTP Fingerprinting**: Inspects HTTP header order and values
3. **Browser Interrogation**: Runs JavaScript to verify browser authenticity
4. **Device Fingerprinting**: Tracks device characteristics (screen size, plugins, fonts)
5. **Behavioral Analysis**: Monitors request patterns and timing
6. **Known Signatures**: Database of known bot user agents and IP ranges
7. **Machine Learning**: Anomaly detection for unknown bots

### Bot Categories

**Category 1: Verified Bots** (Usually Allow)

- **Search Engines**: Googlebot, Bingbot, Baiduspider
- **Monitoring**: Pingdom, Datadog, New Relic
- **Social Media**: Facebookbot, Twitterbot, LinkedInbot
- **Archiving**: Internet Archive, CommonCrawl

**Category 2: Targeted Bots** (Usually Block)

- **Scrapers**: Content extractors, price monitoring
- **Credential Stuffing**: Brute-force login tools
- **Vulnerability Scanners**: Security testing tools
- **Click Fraud**: Ad fraud bots
- **Inventory Hoarding**: Bots that hold items in carts

**Category 3: Unverified Bots** (Usually Challenge)

- **Unknown User Agents**: Custom scripts, headless browsers
- **Automated Browsers**: Selenium, Puppeteer without proper config
- **Spoofed Headers**: Bots pretending to be browsers

### Detection Techniques

**1. TLS Fingerprinting (JA3/JA4)**

Every client has a unique TLS handshake signature based on:

- SSL/TLS version
- Cipher suites order
- Extensions order
- Elliptic curves

**Example:**

- **Chrome 120**: `771,4865-4866-4867-49195-49199,0-23-65281-10-11-35-16-5-13-18-51-45-43-27-17513,29-23-24,0`
- **Python requests**: `771,49200-49196-49192-49188-49172-49162-159-107-57-52393,0-10-11,23-24-25,0`

Bot Control can detect that the second one is **not a real browser**.

**2. HTTP Fingerprinting**

Bots often have different HTTP header patterns:

| Header              | Real Browser                 | Python requests           |
| ------------------- | ---------------------------- | ------------------------- |
| **User-Agent**      | Complex, version-specific    | Generic "python-requests" |
| **Accept**          | Specific MIME types          | `*/*`                     |
| **Accept-Language** | User's locale (en-US, es-MX) | Often missing             |
| **Accept-Encoding** | gzip, deflate, br            | gzip, deflate             |
| **Connection**      | keep-alive                   | Often missing             |
| **Header Order**    | Consistent per browser       | Alphabetical (bot script) |

**3. JavaScript Challenges**

Bot Control can inject JavaScript to verify browser behavior:

```javascript
// Executed in browser
(function () {
  // Check if DOM API exists
  if (typeof document === 'undefined') return false;

  // Check canvas fingerprinting
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Bot Check', 2, 2);
  var fingerprint = canvas.toDataURL();

  // Check for headless browser indicators
  if (navigator.webdriver === true) return false;
  if (window.navigator.plugins.length === 0) return false;

  // Send proof to WAF
  return cryptoProof;
})();
```

**Headless browsers (Puppeteer, Selenium) are often detected** unless properly configured.

### Inspection Levels

| Level        | Cost        | Detection Methods                                       |
| ------------ | ----------- | ------------------------------------------------------- |
| **COMMON**   | $10/month   | Verified bots, known signatures, basic fingerprinting   |
| **TARGETED** | $10/month\* | + TLS fingerprinting, behavioral analysis, JS challenge |

\*Same price, but TARGETED is more aggressive and accurate.

**Recommendation:** Use **TARGETED** for production (better protection for same cost).

### Configuration

**Basic Bot Control Rule:**

```yaml
Rules:
  - Name: BotControl
    Priority: 1
    Statement:
      ManagedRuleGroupStatement:
        VendorName: AWS
        Name: AWSManagedRulesBotControlRuleSet
        ManagedRuleGroupConfigs:
          - AWSManagedRulesBotControlRuleSet:
              InspectionLevel: TARGETED # or COMMON
    OverrideAction:
      None: {} # Apply all rules in the group
    VisibilityConfig:
      SampledRequestsEnabled: true
      CloudWatchMetricsEnabled: true
      MetricName: BotControl
```

**Allow Verified Bots (Search Engines):**

```yaml
# Bot Control labels detected bots
# We can write rules to act on those labels

Rules:
  # Rule 1: Bot Control detection
  - Name: BotControl
    Priority: 1
    Statement:
      ManagedRuleGroupStatement:
        Name: AWSManagedRulesBotControlRuleSet

  # Rule 2: Allow verified bots (Googlebot, Bingbot)
  - Name: AllowVerifiedBots
    Priority: 2
    Statement:
      LabelMatchStatement:
        Scope: LABEL
        Key: awswaf:managed:aws:bot-control:bot:verified
    Action:
      Allow: {}
```

**Block Scrapers:**

```yaml
# Block content scrapers and fetchers
Rules:
  - Name: BlockScrapers
    Priority: 3
    Statement:
      OrStatement:
        Statements:
          # Scraping bots
          - LabelMatchStatement:
              Scope: LABEL
              Key: awswaf:managed:aws:bot-control:bot:category:scraping
          # Content fetchers
          - LabelMatchStatement:
              Scope: LABEL
              Key: awswaf:managed:aws:bot-control:bot:category:content_fetcher
          # HTTP libraries (curl, wget, Python requests)
          - LabelMatchStatement:
              Scope: LABEL
              Key: awswaf:managed:aws:bot-control:bot:category:http_library
    Action:
      Block:
        CustomResponse:
          ResponseCode: 403
          CustomResponseBodyKey: bot_blocked_body
```

**Challenge Unverified Bots:**

```yaml
# Suspicious bots that aren't verified
Rules:
  - Name: ChallengeUnverifiedBots
    Priority: 4
    Statement:
      AndStatement:
        Statements:
          # Bot detected
          - LabelMatchStatement:
              Scope: LABEL
              Key: awswaf:managed:aws:bot-control:signal:automated_browser
          # But NOT verified
          - NotStatement:
              Statement:
                LabelMatchStatement:
                  Scope: LABEL
                  Key: awswaf:managed:aws:bot-control:bot:verified
    Action:
      Challenge: {} # Try to verify with JavaScript
```

### Bot Control Labels

Bot Control adds **labels** to requests for downstream rule processing:

**Verification Labels:**

```
awswaf:managed:aws:bot-control:bot:verified           # Known good bot
awswaf:managed:aws:bot-control:bot:unverified         # Unknown bot
```

**Category Labels:**

```
awswaf:managed:aws:bot-control:bot:category:search_engine
awswaf:managed:aws:bot-control:bot:category:monitoring
awswaf:managed:aws:bot-control:bot:category:scraping
awswaf:managed:aws:bot-control:bot:category:content_fetcher
awswaf:managed:aws:bot-control:bot:category:http_library
awswaf:managed:aws:bot-control:bot:category:advertising
awswaf:managed:aws:bot-control:bot:category:archiver
```

**Signal Labels:**

```
awswaf:managed:aws:bot-control:signal:automated_browser     # Selenium, Puppeteer
awswaf:managed:aws:bot-control:signal:known_bot_data_center # Bot IP ranges
awswaf:managed:aws:bot-control:signal:non_browser_user_agent
```

**Name Labels (Specific Bots):**

```
awswaf:managed:aws:bot-control:bot:name:googlebot
awswaf:managed:aws:bot-control:bot:name:bingbot
awswaf:managed:aws:bot-control:bot:name:slackbot
```

### Custom Response for Bots

Instead of generic 403, return helpful messages:

```yaml
# Define custom response body
CustomResponseBodies:
  bot_blocked_body:
    ContentType: APPLICATION_JSON
    Content: |
      {
        "error": "Bot Detected",
        "message": "This endpoint is for human users only. If you're a legitimate bot, please contact support@snaplist.com to be whitelisted.",
        "support": "https://snaplist.com/support"
      }

# Use in block action
Action:
  Block:
    CustomResponse:
      ResponseCode: 403
      CustomResponseBodyKey: bot_blocked_body
```

---

## How They Work Together

### Layered Defense Strategy

The most effective bot protection uses **all three mechanisms** in layers:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Bot Control (Identify bot types)                  │
│  - Search engines → Allow                                    │
│  - Scrapers → Block                                          │
│  - Unknown → Label for next layer                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Challenge (Verify browsers)                       │
│  - Unverified traffic → JavaScript test                     │
│  - Success → Issue token, allow                              │
│  - Failure → Label for next layer                            │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: CAPTCHA (Final verification)                      │
│  - Challenge failures → Visual puzzle                        │
│  - Rate limit exceeded → Visual puzzle                       │
│  - Success → Issue token, allow                              │
│  - Failure → Block                                           │
└─────────────────────────────────────────────────────────────┘
```

### Complete Rule Set Example

**For SnapList Production:**

```yaml
Resources:
  SnapListWebACL:
    Type: AWS::WAFv2::WebACL
    Properties:
      Name: SnapList-Production
      Scope: REGIONAL
      DefaultAction:
        Allow: {}

      Rules:
        # ════════════════════════════════════════════════════
        # LAYER 1: BOT CONTROL (Identify bots)
        # ════════════════════════════════════════════════════
        - Name: BotControl
          Priority: 1
          Statement:
            ManagedRuleGroupStatement:
              VendorName: AWS
              Name: AWSManagedRulesBotControlRuleSet
              ManagedRuleGroupConfigs:
                - AWSManagedRulesBotControlRuleSet:
                    InspectionLevel: TARGETED
          OverrideAction:
            None: {}
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: BotControlRuleGroup
            SampledRequestsEnabled: true

        # ════════════════════════════════════════════════════
        # LAYER 1A: Allow verified bots (search engines)
        # ════════════════════════════════════════════════════
        - Name: AllowVerifiedBots
          Priority: 2
          Statement:
            LabelMatchStatement:
              Scope: LABEL
              Key: awswaf:managed:aws:bot-control:bot:verified
          Action:
            Allow:
              CustomRequestHandling:
                InsertHeaders:
                  - Name: x-bot-type
                    Value: verified
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: AllowedVerifiedBots
            SampledRequestsEnabled: true

        # ════════════════════════════════════════════════════
        # LAYER 1B: Block malicious bots (scrapers, attackers)
        # ════════════════════════════════════════════════════
        - Name: BlockMaliciousBots
          Priority: 3
          Statement:
            OrStatement:
              Statements:
                - LabelMatchStatement:
                    Scope: LABEL
                    Key: awswaf:managed:aws:bot-control:bot:category:scraping
                - LabelMatchStatement:
                    Scope: LABEL
                    Key: awswaf:managed:aws:bot-control:bot:category:content_fetcher
                - LabelMatchStatement:
                    Scope: LABEL
                    Key: awswaf:managed:aws:bot-control:bot:category:http_library
          Action:
            Block:
              CustomResponse:
                ResponseCode: 403
                CustomResponseBodyKey: bot_blocked
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: BlockedMaliciousBots
            SampledRequestsEnabled: true

        # ════════════════════════════════════════════════════
        # LAYER 2: CHALLENGE (Invisible verification)
        # ════════════════════════════════════════════════════
        - Name: ChallengeUnverified
          Priority: 10
          Statement:
            AndStatement:
              Statements:
                # No valid token yet
                - NotStatement:
                    Statement:
                      LabelMatchStatement:
                        Scope: LABEL
                        Key: awswaf:managed:token:accepted
                # Skip static assets
                - NotStatement:
                    Statement:
                      ByteMatchStatement:
                        SearchString: /static/
                        FieldToMatch:
                          UriPath: {}
                        TextTransformations:
                          - Priority: 0
                            Type: LOWERCASE
          Action:
            Challenge:
              ImmunityTimeProperty:
                ImmunityTime: 300 # 5 minutes
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: ChallengeActions
            SampledRequestsEnabled: true

        # ════════════════════════════════════════════════════
        # LAYER 3A: CAPTCHA for failed challenges
        # ════════════════════════════════════════════════════
        - Name: CAPTCHAOnChallengeFail
          Priority: 11
          Statement:
            LabelMatchStatement:
              Scope: LABEL
              Key: awswaf:managed:token:rejected
          Action:
            Captcha:
              ImmunityTimeProperty:
                ImmunityTime: 900 # 15 minutes after solving
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: CAPTCHAChallengeFail
            SampledRequestsEnabled: true

        # ════════════════════════════════════════════════════
        # LAYER 3B: CAPTCHA for rate limiting
        # ════════════════════════════════════════════════════
        - Name: RateLimitCAPTCHA
          Priority: 20
          Statement:
            RateBasedStatement:
              Limit: 2000 # Requests per 5 minutes
              AggregateKeyType: IP
          Action:
            Captcha:
              CustomRequestHandling:
                InsertHeaders:
                  - Name: x-rate-limit-triggered
                    Value: 'true'
              ImmunityTimeProperty:
                ImmunityTime: 600 # 10 minutes
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: RateLimitCAPTCHA
            SampledRequestsEnabled: true

        # ════════════════════════════════════════════════════
        # LAYER 3C: CAPTCHA for sensitive endpoints
        # ════════════════════════════════════════════════════
        - Name: CAPTCHAAuthEndpoints
          Priority: 30
          Statement:
            AndStatement:
              Statements:
                # Auth endpoints
                - OrStatement:
                    Statements:
                      - ByteMatchStatement:
                          SearchString: /api/auth/login
                          FieldToMatch:
                            UriPath: {}
                          TextTransformations:
                            - Priority: 0
                              Type: LOWERCASE
                      - ByteMatchStatement:
                          SearchString: /api/auth/signup
                          FieldToMatch:
                            UriPath: {}
                          TextTransformations:
                            - Priority: 0
                              Type: LOWERCASE
                # No valid token
                - NotStatement:
                    Statement:
                      LabelMatchStatement:
                        Key: awswaf:managed:token:accepted
          Action:
            Captcha:
              ImmunityTimeProperty:
                ImmunityTime: 1800 # 30 minutes
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: AuthEndpointCAPTCHA
            SampledRequestsEnabled: true

        # ════════════════════════════════════════════════════
        # LAYER 4: Geo-blocking (optional)
        # ════════════════════════════════════════════════════
        - Name: BlockHighRiskCountries
          Priority: 40
          Statement:
            GeoMatchStatement:
              CountryCodes:
                - CN # China
                - RU # Russia
                - KP # North Korea
                # Add countries based on your threat model
          Action:
            Block:
              CustomResponse:
                ResponseCode: 403
                CustomResponseBodyKey: geo_blocked
          VisibilityConfig:
            CloudWatchMetricsEnabled: true
            MetricName: GeoBlocked
            SampledRequestsEnabled: false # Don't sample for privacy

      # Custom response bodies
      CustomResponseBodies:
        bot_blocked:
          ContentType: APPLICATION_JSON
          Content: |
            {
              "error": "Bot Detected",
              "message": "Automated access is not permitted. If you're a legitimate service, contact support@snaplist.com.",
              "code": "BOT_BLOCKED"
            }
        geo_blocked:
          ContentType: APPLICATION_JSON
          Content: |
            {
              "error": "Access Restricted",
              "message": "Service not available in your region.",
              "code": "GEO_BLOCKED"
            }

      VisibilityConfig:
        CloudWatchMetricsEnabled: true
        MetricName: SnapListWAF
        SampledRequestsEnabled: true
```

---

## Implementation Guide

### Step 1: Create WAF Web ACL

**Terraform:** `infrastructure/terraform/modules/waf/main.tf`

```hcl
resource "aws_wafv2_web_acl" "snaplist" {
  name  = "snaplist-${var.environment}"
  scope = var.scope # "REGIONAL" or "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Bot Control rule
  rule {
    name     = "BotControl"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesBotControlRuleSet"

        managed_rule_group_configs {
          aws_managed_rules_bot_control_rule_set {
            inspection_level = "TARGETED"
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "BotControl"
      sampled_requests_enabled  = true
    }
  }

  # Challenge rule
  rule {
    name     = "Challenge"
    priority = 10

    action {
      challenge {}
    }

    statement {
      not_statement {
        statement {
          label_match_statement {
            scope = "LABEL"
            key   = "awswaf:managed:token:accepted"
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "Challenge"
      sampled_requests_enabled  = true
    }
  }

  # Rate limit with CAPTCHA
  rule {
    name     = "RateLimit"
    priority = 20

    action {
      captcha {}
    }

    statement {
      rate_based_statement {
        limit              = var.rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "RateLimit"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "SnapListWAF"
    sampled_requests_enabled  = true
  }

  tags = {
    Environment = var.environment
    Project     = "SnapList"
  }
}

# Variables
variable "environment" {
  type    = string
  default = "prod"
}

variable "scope" {
  type    = string
  default = "REGIONAL"
  validation {
    condition     = contains(["REGIONAL", "CLOUDFRONT"], var.scope)
    error_message = "Scope must be REGIONAL or CLOUDFRONT"
  }
}

variable "rate_limit" {
  type        = number
  default     = 2000
  description = "Requests per 5 minutes before CAPTCHA"
}

# Outputs
output "web_acl_id" {
  value = aws_wafv2_web_acl.snaplist.id
}

output "web_acl_arn" {
  value = aws_wafv2_web_acl.snaplist.arn
}
```

### Step 2: Associate WAF with Resources

**Option A: API Gateway**

```hcl
resource "aws_wafv2_web_acl_association" "api_gateway" {
  resource_arn = aws_apigatewayv2_stage.prod.arn
  web_acl_arn  = aws_wafv2_web_acl.snaplist.arn
}
```

**Option B: Application Load Balancer**

```hcl
resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.snaplist.arn
}
```

**Option C: CloudFront**

```hcl
# WAF must be in us-east-1 for CloudFront
resource "aws_wafv2_web_acl" "cloudfront" {
  provider = aws.us_east_1
  scope    = "CLOUDFRONT"
  # ... rest of config
}

resource "aws_cloudfront_distribution" "main" {
  # ... other config

  web_acl_id = aws_wafv2_web_acl.cloudfront.arn
}
```

### Step 3: Deploy

```bash
cd infrastructure/terraform/modules/waf
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

### Step 4: Test WAF Rules

**Test Challenge:**

```bash
# First request (should return Challenge)
curl -v https://api.snaplist.com/tasks

# Response: 202 Accepted with JavaScript challenge
# Browser would execute this automatically

# Second request with token (after solving Challenge)
curl -v https://api.snaplist.com/tasks \
  -H "Cookie: aws-waf-token=eyJhbGc..."

# Response: 200 OK (request allowed)
```

**Test Rate Limit:**

```bash
# Trigger rate limit
for i in {1..2001}; do
  curl https://api.snaplist.com/tasks
done

# Response: 405 Method Not Allowed (CAPTCHA page)
```

**Test Bot Control:**

```bash
# Simulate scraper bot
curl -A "python-requests/2.28.0" https://api.snaplist.com/tasks

# Response: 403 Forbidden (blocked)

# Simulate Googlebot
curl -A "Mozilla/5.0 (compatible; Googlebot/2.1)" \
  https://api.snaplist.com/tasks

# Response: 200 OK (allowed)
```

---

## Monitoring & Analytics

### CloudWatch Metrics

**Key Metrics:**

| Metric                | Description                        | Alert Threshold            |
| --------------------- | ---------------------------------- | -------------------------- |
| **AllowedRequests**   | Requests that passed WAF           | -                          |
| **BlockedRequests**   | Requests blocked by WAF            | > 1000/5min (under attack) |
| **CountedRequests**   | Requests counted (monitoring mode) | -                          |
| **CaptchaSent**       | CAPTCHAs shown to users            | > 100/hour (bot surge)     |
| **ChallengeSent**     | Challenges sent to browsers        | -                          |
| **ChallengeFailures** | Failed Challenge attempts          | > 50/hour (bot activity)   |

### CloudWatch Dashboard

**Terraform:** `infrastructure/terraform/modules/waf/monitoring.tf`

```hcl
resource "aws_cloudwatch_dashboard" "waf" {
  dashboard_name = "SnapList-WAF-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      # Traffic Overview
      {
        type   = "metric"
        width  = 24
        height = 6
        properties = {
          metrics = [
            ["AWS/WAFV2", "AllowedRequests", { stat = "Sum", color = "#2ca02c" }],
            [".", "BlockedRequests", { stat = "Sum", color = "#d62728" }],
            [".", "CaptchaSent", { stat = "Sum", color = "#ff7f0e" }],
            [".", "ChallengeSent", { stat = "Sum", color = "#1f77b4" }]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "WAF Traffic Overview"
          yAxis = {
            left = {
              label = "Requests"
            }
          }
        }
      },

      # Bot Control Detections
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            ["AWS/WAFV2", "BlockedRequests", { stat = "Sum" }]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "Blocked Bots"
          annotations = {
            horizontal = [{
              value = 100
              label = "High bot activity threshold"
              color = "#d62728"
            }]
          }
        }
      },

      # Challenge/CAPTCHA Success Rate
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          metrics = [
            [{ expression = "m2/(m1+m2)*100", label = "Challenge Failure Rate (%)" }],
            ["AWS/WAFV2", "ChallengeSent", { id = "m1", visible = false }],
            [".", "ChallengeFailures", { id = "m2", visible = false }]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "Challenge Failure Rate"
          yAxis = {
            left = {
              label = "Percentage",
              min   = 0,
              max   = 100
            }
          }
        }
      },

      # Top Blocked IPs (requires logging)
      {
        type   = "log"
        width  = 24
        height = 6
        properties = {
          query   = <<-EOT
            fields httpRequest.clientIp as IP, action
            | filter action = "BLOCK"
            | stats count() as BlockCount by IP
            | sort BlockCount desc
            | limit 20
          EOT
          region  = var.aws_region
          title   = "Top 20 Blocked IP Addresses"
          logGroupNames = [aws_cloudwatch_log_group.waf_logs.name]
        }
      }
    ]
  })
}
```

### CloudWatch Alarms

```hcl
# High bot traffic alert
resource "aws_cloudwatch_metric_alarm" "high_bot_traffic" {
  alarm_name          = "snaplist-${var.environment}-high-bot-traffic"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name        = "BlockedRequests"
  namespace          = "AWS/WAFV2"
  period             = 300
  statistic          = "Sum"
  threshold          = 1000
  alarm_description  = "More than 1000 blocked requests in 10 minutes"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    WebACL = aws_wafv2_web_acl.snaplist.name
    Region = var.aws_region
    Rule   = "BlockMaliciousBots"
  }
}

# High CAPTCHA rate (potential bot attack or false positives)
resource "aws_cloudwatch_metric_alarm" "high_captcha_rate" {
  alarm_name          = "snaplist-${var.environment}-high-captcha-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name        = "CaptchaSent"
  namespace          = "AWS/WAFV2"
  period             = 3600
  statistic          = "Sum"
  threshold          = 100
  alarm_description  = "More than 100 CAPTCHAs sent in 1 hour (check for false positives)"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    WebACL = aws_wafv2_web_acl.snaplist.name
    Region = var.aws_region
  }
}

# SNS topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "snaplist-${var.environment}-waf-alerts"
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}
```

### WAF Logging

**Enable logging to S3 or CloudWatch Logs:**

```hcl
# CloudWatch Logs
resource "aws_cloudwatch_log_group" "waf_logs" {
  name              = "/aws/wafv2/snaplist-${var.environment}"
  retention_in_days = 30
}

resource "aws_wafv2_web_acl_logging_configuration" "main" {
  resource_arn = aws_wafv2_web_acl.snaplist.arn

  log_destination_configs = [
    aws_cloudwatch_log_group.waf_logs.arn
  ]

  # Redact sensitive data
  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}
```

**Analyze logs with CloudWatch Insights:**

```sql
-- Top blocked user agents
fields httpRequest.headers.name, httpRequest.headers.value, action
| filter action = "BLOCK"
| filter httpRequest.headers.name = "User-Agent"
| stats count() as BlockCount by httpRequest.headers.value as UserAgent
| sort BlockCount desc
| limit 20

-- Challenge failure rate over time
fields @timestamp, action
| filter action in ["CHALLENGE", "BLOCK"] and terminatingRuleType = "CHALLENGE"
| stats count() by bin(5m) as Period, action
| sort Period desc

-- Geo distribution of blocked traffic
fields httpRequest.country, action
| filter action = "BLOCK"
| stats count() as BlockCount by httpRequest.country
| sort BlockCount desc
```

---

## Cost Analysis

### Pricing Breakdown

| Component                | Unit Price                 | Notes                                |
| ------------------------ | -------------------------- | ------------------------------------ |
| **Web ACL**              | $5.00/month                | Per Web ACL (one per environment)    |
| **Rules**                | $1.00/month per rule       | Includes managed rule groups         |
| **Requests**             | $0.60 per 1M requests      | All requests inspected by WAF        |
| **Bot Control**          | $10.00/month               | Flat fee for managed rule group      |
| **Challenge Actions**    | $0.40 per 1,000 Challenges | JavaScript verification              |
| **CAPTCHA Actions**      | $0.40 per 1,000 CAPTCHAs   | Visual puzzles shown to users        |
| **Logging (CloudWatch)** | $0.50 per GB ingested      | Optional, recommended for production |
| **Logging (S3)**         | $0.023 per GB              | Cheaper long-term storage            |

### Cost Examples

**Example 1: SnapList with 100 Users (Low Traffic)**

**Assumptions:**

- 50,000 requests/month
- 10% require Challenge (5,000 Challenges)
- 1% require CAPTCHA (500 CAPTCHAs)
- Bot Control enabled
- 5 rules (Bot Control, Challenge, CAPTCHA, Allow Verified, Block Scrapers)

| Item          | Calculation   | Cost             |
| ------------- | ------------- | ---------------- |
| Web ACL       | Fixed         | $5.00            |
| Rules (5)     | 5 × $1        | $5.00            |
| Requests      | 0.05M × $0.60 | $0.03            |
| Bot Control   | Fixed         | $10.00           |
| Challenges    | 5 × $0.40     | $2.00            |
| CAPTCHAs      | 0.5 × $0.40   | $0.20            |
| Logging (1GB) | 1 × $0.50     | $0.50            |
| **Total**     |               | **$22.73/month** |

**Example 2: SnapList with 1,000 Users (Medium Traffic)**

**Assumptions:**

- 500,000 requests/month
- 10% require Challenge (50,000 Challenges)
- 1% require CAPTCHA (5,000 CAPTCHAs)
- Bot Control enabled
- 5 rules

| Item           | Calculation  | Cost             |
| -------------- | ------------ | ---------------- |
| Web ACL        | Fixed        | $5.00            |
| Rules (5)      | 5 × $1       | $5.00            |
| Requests       | 0.5M × $0.60 | $0.30            |
| Bot Control    | Fixed        | $10.00           |
| Challenges     | 50 × $0.40   | $20.00           |
| CAPTCHAs       | 5 × $0.40    | $2.00            |
| Logging (10GB) | 10 × $0.50   | $5.00            |
| **Total**      |              | **$47.30/month** |

**Example 3: SnapList with 10,000 Users (High Traffic)**

**Assumptions:**

- 5,000,000 requests/month
- 10% require Challenge (500,000 Challenges)
- 1% require CAPTCHA (50,000 CAPTCHAs)
- Bot Control enabled
- 5 rules

| Item            | Calculation | Cost              |
| --------------- | ----------- | ----------------- |
| Web ACL         | Fixed       | $5.00             |
| Rules (5)       | 5 × $1      | $5.00             |
| Requests        | 5M × $0.60  | $3.00             |
| Bot Control     | Fixed       | $10.00            |
| Challenges      | 500 × $0.40 | $200.00           |
| CAPTCHAs        | 50 × $0.40  | $20.00            |
| Logging (100GB) | 100 × $0.50 | $50.00            |
| **Total**       |             | **$293.00/month** |

### Cost Optimization Strategies

**1. Reduce Challenge Frequency**

Most legitimate users will have tokens cached, so only first-time/returning users get Challenged.

**Optimization:**

- Increase immunity time from 5 minutes → 15 minutes
- Challenge only API endpoints, not static assets
- Skip Challenge for authenticated users with valid sessions

**Savings:** ~50% reduction in Challenge actions

**2. Use Challenge Before CAPTCHA**

CAPTCHAs have same cost as Challenges, but worse UX. Use Challenge first, CAPTCHA only as fallback.

**3. Disable Bot Control on Dev/Staging**

Bot Control costs $10/month per environment. Only enable on production.

**Savings:** $10-20/month (if you have 2-3 environments)

**4. S3 Logging Instead of CloudWatch**

CloudWatch Logs: $0.50/GB
S3: $0.023/GB

**Savings:** ~95% on logging costs (but slower to query)

**5. Count Mode for Testing**

Before enabling Block/Challenge, use "Count" action to measure traffic without impacting users.

```yaml
Action:
  Count: {} # Just log, don't block
```

---

## Comparison: WAF vs Firebase App Check

### Feature Comparison

| Feature                    | **AWS WAF (Challenge + Bot Control)**    | **Firebase App Check (reCAPTCHA v3)**           |
| -------------------------- | ---------------------------------------- | ----------------------------------------------- |
| **Device Attestation**     | ❌ No                                    | ✅ Yes (iOS App Attest, Android Play Integrity) |
| **Invisible Verification** | ✅ Yes (Challenge action)                | ✅ Yes (reCAPTCHA v3)                           |
| **Visible CAPTCHA**        | ✅ Yes (CAPTCHA action)                  | ⚠️ Only if reCAPTCHA suspects abuse             |
| **Bot Detection**          | ✅✅ Advanced (ML, fingerprinting)       | ⚠️ Basic (reCAPTCHA signals)                    |
| **Known Bot Database**     | ✅ Verified bots (search engines)        | ❌ No                                           |
| **TLS Fingerprinting**     | ✅ Yes (JA3/JA4)                         | ❌ No                                           |
| **Behavioral Analysis**    | ✅ Yes (request patterns)                | ⚠️ Limited (reCAPTCHA scoring)                  |
| **Rate Limiting**          | ✅ Built-in (per IP, per session)        | ❌ Must implement in Security Rules             |
| **Geo-Blocking**           | ✅ Built-in                              | ❌ Must implement in Security Rules             |
| **Custom Rules**           | ✅ Extensive (IP, headers, body, etc.)   | ❌ Limited to reCAPTCHA config                  |
| **Integration Complexity** | ⚠️ Medium (requires WAF setup)           | ✅ Easy (4 lines of code)                       |
| **Mobile App Support**     | ⚠️ Manual SDK integration                | ✅ Native iOS/Android SDKs                      |
| **Cost (100 users)**       | **~$23/month**                           | **$0** (free tier)                              |
| **Cost (1,000 users)**     | **~$47/month**                           | **$0-10/month**                                 |
| **Cost (10,000 users)**    | **~$293/month**                          | **$10-50/month**                                |
| **Privacy**                | ✅ AWS only (no third-party)             | ⚠️ Google collects user data                    |
| **Compliance**             | ✅ HIPAA, SOC 2, PCI DSS ready           | ⚠️ Google's privacy policy applies              |
| **Vendor Lock-in**         | ⚠️ AWS-specific                          | ⚠️ Google/Firebase-specific                     |
| **Analytics**              | ✅✅ Detailed (CloudWatch, S3 exports)   | ⚠️ Basic (Firebase Console)                     |
| **Customization**          | ✅✅ Full control over rules             | ❌ Limited to reCAPTCHA settings                |
| **False Positive Rate**    | ⚠️ Can be high (requires tuning)         | ✅ Generally low (Google's ML)                  |
| **Bypass Difficulty**      | ✅ Moderate (JavaScript challenges)      | ✅✅ Very hard (device attestation)             |
| **Attack Surface**         | ⚠️ Larger (more rules = more complexity) | ✅ Simpler (single token validation)            |

### When to Use Each

**Use Firebase App Check if:**

- ✅ Cost-sensitive (<1000 users)
- ✅ Need mobile app attestation (iOS/Android)
- ✅ Want simplest setup (4 lines of code)
- ✅ Already using Firebase for backend
- ✅ Don't mind Google collecting user data

**Use AWS WAF if:**

- ✅ Scaling to 1000+ users (cost-effective at scale)
- ✅ Need advanced bot analytics
- ✅ Require compliance (HIPAA, SOC 2)
- ✅ Want full control over bot detection rules
- ✅ Already on AWS infrastructure
- ✅ Privacy-focused (no third-party data sharing)
- ✅ Need geo-blocking or complex filtering

**Use Both (Hybrid) if:**

- ✅ Want defense-in-depth (layered security)
- ✅ App Check for client verification + WAF for backend protection
- ✅ Budget allows (~$30-50/month extra)

```
React PWA → Firebase App Check → CloudFront + WAF → API Gateway
              (Client verify)      (Bot detection)    (Backend)
```

This gives you:

- ✅ Best-in-class client attestation (App Check)
- ✅ Advanced bot detection (WAF Bot Control)
- ✅ DDoS protection (WAF rate limiting)
- ✅ Compliance ready (AWS infrastructure)

---

## Recommendations for SnapList

### Current State (100 users, Firebase-only)

**Keep Firebase App Check** — No reason to switch yet.

**Why?**

- Already implemented ($0 engineering cost)
- Free tier covers your usage
- Superior mobile app attestation
- Simpler to maintain

**Cost:** $0/month

### Growth Stage (500-1000 users)

**Add AWS WAF** in front of Firebase App Check.

**Architecture:**

```
React PWA → Firebase App Check → AWS WAF → API Gateway → Lambda
              (Token 1)            (Token 2)               ↓
                                                       Firebase/RDS
```

**Benefits:**

- Layered security (two verification layers)
- WAF blocks bots before hitting Firebase quotas
- Advanced analytics from WAF logs

**Cost:** ~$25/month (WAF) + $0 (App Check) = **$25/month total**

### Scale Stage (1000+ users, monetization)

**Full AWS WAF + Optional App Check**

**Option A: WAF Only (if ditching Firebase)**

```
React PWA → CloudFront + WAF → API Gateway → Lambda → RDS
```

**Cost:** ~$50/month

**Option B: Hybrid (keep Firebase for real-time features)**

```
React PWA → App Check + WAF → API Gateway → Lambda → Firebase + RDS
```

**Cost:** ~$50/month

**Recommendation:** **Option B (Hybrid)** — Best of both worlds for only $50/month.

---

## Troubleshooting

### Common Issues

#### Issue 1: Challenge Causing Infinite Loops

**Symptom:** Browser keeps refreshing, never gets past Challenge

**Cause:** JavaScript execution blocked by:

- Content Security Policy (CSP)
- Browser extensions (ad blockers)
- CORS issues

**Fix:**

1. **Check CSP headers:**

```html
<!-- Allow WAF JavaScript -->
<meta
  http-equiv="Content-Security-Policy"
  content="script-src 'self' https://your-waf-endpoint.amazonaws.com"
/>
```

2. **Check CORS:**

```yaml
# API Gateway CORS config
CorsConfiguration:
  AllowOrigins:
    - https://snaplist.netlify.app
  AllowMethods:
    - GET
    - POST
    - OPTIONS
  AllowHeaders:
    - Content-Type
    - Authorization
    - x-aws-waf-token # Important!
  AllowCredentials: true
```

3. **Whitelist your testing IP:**

```yaml
# Temporarily bypass Challenge for your IP
Rules:
  - Name: BypassChallengeForDev
    Priority: 5
    Statement:
      IPSetReferenceStatement:
        ARN: arn:aws:wafv2:region:account:regional/ipset/dev-ips
    Action:
      Allow: {}
```

#### Issue 2: Legitimate Users Getting Blocked

**Symptom:** Real users see CAPTCHA or get blocked

**Cause:**

- Bot Control false positives
- Rate limit too aggressive
- Geo-blocking your own users

**Fix:**

1. **Check CloudWatch metrics:**

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name BlockedRequests \
  --dimensions Name=Rule,Value=BlockMaliciousBots \
  --start-time 2026-01-04T00:00:00Z \
  --end-time 2026-01-04T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

2. **Review sampled requests:**

```bash
# Get recent blocked requests
aws wafv2 get-sampled-requests \
  --web-acl-arn <your-web-acl-arn> \
  --rule-metric-name BlockMaliciousBots \
  --scope REGIONAL \
  --time-window StartTime=1609459200,EndTime=1609545600 \
  --max-items 100
```

3. **Temporarily use Count mode:**

```yaml
# Change Block to Count for debugging
Action:
  Count:
    CustomRequestHandling:
      InsertHeaders:
        - Name: x-waf-action
          Value: would-block
```

4. **Increase rate limits:**

```yaml
# Increase from 2000 → 5000
Statement:
  RateBasedStatement:
    Limit: 5000
```

#### Issue 3: Search Engines Being Blocked

**Symptom:** Google/Bing can't crawl your site

**Cause:** Missing "Allow Verified Bots" rule

**Fix:**

```yaml
# Add this rule BEFORE Challenge/Block rules (low priority number)
Rules:
  - Name: AllowVerifiedBots
    Priority: 2 # MUST be before Challenge/Block rules
    Statement:
      LabelMatchStatement:
        Scope: LABEL
        Key: awswaf:managed:aws:bot-control:bot:verified
    Action:
      Allow: {}
```

**Verify in Google Search Console:**

- Check "URL Inspection" tool
- Look for crawl errors
- Request re-crawl after fix

#### Issue 4: High Costs from Challenges

**Symptom:** WAF bill is $200/month, mostly Challenges

**Cause:** Every request triggering Challenge (no token caching)

**Fix:**

1. **Increase immunity time:**

```yaml
Action:
  Challenge:
    ImmunityTimeProperty:
      ImmunityTime: 900 # 15 minutes instead of 5
```

2. **Skip Challenge for static assets:**

```yaml
Statement:
  AndStatement:
    Statements:
      # Only challenge API endpoints
      - ByteMatchStatement:
          SearchString: /api/
          FieldToMatch:
            UriPath: {}
      # No valid token
      - NotStatement:
          Statement:
            LabelMatchStatement:
              Key: awswaf:managed:token:accepted
```

3. **Skip Challenge for authenticated users:**

```yaml
# If user has valid session cookie, skip Challenge
Statement:
  AndStatement:
    Statements:
      # No WAF token
      - NotStatement:
          Statement:
            LabelMatchStatement:
              Key: awswaf:managed:token:accepted
      # AND no session cookie
      - NotStatement:
          Statement:
            ByteMatchStatement:
              SearchString: session=
              FieldToMatch:
                SingleHeader:
                  Name: cookie
```

#### Issue 5: CAPTCHA Not Displaying

**Symptom:** User sees blank page instead of CAPTCHA

**Cause:**

- CSP blocking AWS CAPTCHA widget
- JavaScript errors
- Network issues

**Fix:**

1. **Check browser console for errors**

2. **Update CSP:**

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://*.amazonaws.com;
    frame-src https://*.amazonaws.com;
    connect-src 'self' https://*.amazonaws.com;
  "
/>
```

3. **Test CAPTCHA directly:**

```bash
curl -v https://api.snaplist.com/api/tasks \
  -H "X-Forwarded-For: 1.2.3.4" \
  --rate 10000 # Trigger rate limit

# Should return 405 with CAPTCHA HTML
```

---

## Appendix

### Useful AWS CLI Commands

**Get Web ACL details:**

```bash
aws wafv2 get-web-acl \
  --scope REGIONAL \
  --id <web-acl-id> \
  --name SnapList-Production
```

**List sampled requests:**

```bash
aws wafv2 get-sampled-requests \
  --web-acl-arn <arn> \
  --rule-metric-name BotControl \
  --scope REGIONAL \
  --time-window StartTime=1704326400,EndTime=1704412800 \
  --max-items 100
```

**Update rule priority:**

```bash
aws wafv2 update-web-acl \
  --scope REGIONAL \
  --id <id> \
  --name SnapList-Production \
  --lock-token <token> \
  --rules file://updated-rules.json
```

**Export CloudWatch Logs:**

```bash
# Export last 24 hours of WAF logs
aws logs create-export-task \
  --log-group-name /aws/wafv2/snaplist-prod \
  --from $(date -d '24 hours ago' +%s)000 \
  --to $(date +%s)000 \
  --destination snaplist-waf-logs \
  --destination-prefix waf-logs/
```

### Further Reading

**AWS Documentation:**

- [AWS WAF Developer Guide](https://docs.aws.amazon.com/waf/latest/developerguide/)
- [Bot Control Rule Group](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-bot.html)
- [CAPTCHA and Challenge Actions](https://docs.aws.amazon.com/waf/latest/developerguide/waf-captcha-and-challenge.html)

**Blog Posts:**

- [Protect Against Bots with AWS WAF Challenge and CAPTCHA](https://aws.amazon.com/blogs/networking-and-content-delivery/protect-against-bots-with-aws-waf-challenge-and-captcha-actions/)
- [JA3 and JA4 Fingerprinting in AWS WAF](https://engineering.doit.com/ja3-and-ja4-fingerprints-in-aws-waf-and-beyond-e2d18dca198a)

---

**Document Version:** 1.0
**Last Updated:** January 4, 2026
**Author:** Claude Code (with SnapList Team)
**Status:** Complete
