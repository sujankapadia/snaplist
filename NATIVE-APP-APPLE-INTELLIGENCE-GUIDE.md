# Native App & Apple Intelligence Integration Guide

## Overview

This document outlines the strategy for potentially migrating SnapList from a Progressive Web App (PWA) to a native mobile app (React Native or iOS Swift) to leverage **Apple Intelligence** and **Apple Foundation Models** for on-device AI processing, with **Gemini as a fallback** for older devices.

**Key Motivation:**

- On-device AI processing (no API costs, privacy-first)
- True background geofencing for location-based task reminders
- Native iOS integration (widgets, shortcuts, deeper system access)
- Reduced dependency on cloud AI services

**Related Documentation:**

- See `LOCATION-BASED-FEATURES-GUIDE.md` for comprehensive location features implementation

---

## Table of Contents

1. [Current State: PWA Limitations](#current-state-pwa-limitations)
2. [Apple Intelligence Overview](#apple-intelligence-overview)
3. [React Native vs iOS Swift](#react-native-vs-ios-swift)
4. [Apple Intelligence Integration (React Native)](#apple-intelligence-integration-react-native)
5. [Dual AI Strategy: Apple Intelligence + Gemini Fallback](#dual-ai-strategy-apple-intelligence--gemini-fallback)
6. [Migration Path from PWA to React Native](#migration-path-from-pwa-to-react-native)
7. [Location-Based Features in Native App](#location-based-features-in-native-app)
8. [Cost-Benefit Analysis](#cost-benefit-analysis)
9. [Recommended Timeline](#recommended-timeline)
10. [Decision Framework](#decision-framework)

---

## Current State: PWA Limitations

### What SnapList PWA Can Do

- ✅ Voice input (Web Speech API)
- ✅ AI task processing (Gemini 2.5 Flash via cloud API)
- ✅ Foreground location access
- ✅ Offline support (Service Worker caching)
- ✅ Push notifications (server-triggered)
- ✅ File attachments
- ✅ Dark mode, responsive design

### What SnapList PWA Cannot Do

- ❌ **On-device AI processing** (no Apple Intelligence access)
- ❌ **Background location monitoring** (no geofencing)
- ❌ **True background tasks** (no location-based reminders when app closed)
- ❌ **Native system integration** (widgets, shortcuts, Siri integration)
- ❌ **Advanced iOS features** (Live Activities, App Clips, etc.)

### Why Consider Native?

1. **Privacy**: On-device AI means user tasks never leave the device
2. **Cost**: No Gemini API costs for supported devices
3. **Geofencing**: True background location-based reminders (see `LOCATION-BASED-FEATURES-GUIDE.md`)
4. **Performance**: Native apps feel faster and more responsive
5. **Features**: Access to iOS-exclusive capabilities

---

## Apple Intelligence Overview

### What is Apple Intelligence?

**Apple Intelligence** is Apple's suite of on-device AI capabilities introduced with iOS 18+. It includes:

- **Foundation Models**: Apple's proprietary large language models
- **On-Device Processing**: AI runs entirely on-device (iPhone 15 Pro+, M1+ Macs)
- **Privacy-First**: Data never leaves the device
- **System Integration**: Deep integration with iOS/macOS

### Apple Intelligence Capabilities

| Feature             | Minimum iOS                | SnapList Use Case                                       |
| ------------------- | -------------------------- | ------------------------------------------------------- |
| **Text Generation** | iOS 26+                    | Task categorization, note extraction, smart suggestions |
| **Text Embeddings** | iOS 17+                    | Semantic search, similar task detection                 |
| **Speech-to-Text**  | iOS 26+                    | Voice task capture (alternative to Web Speech API)      |
| **Text-to-Speech**  | iOS 13+ (enhanced iOS 17+) | Read tasks aloud, accessibility                         |

### Device Requirements

**Supported Devices:**

- iPhone 15 Pro / 15 Pro Max
- iPhone 16 / 16 Plus / 16 Pro / 16 Pro Max
- iPad with M1 chip or later
- Mac with M1 chip or later

**Unsupported Devices:** All older iPhones, iPads, Macs → **Requires Gemini fallback**

---

## React Native vs iOS Swift

### Comparison Table

| Criteria                      | React Native                              | iOS Swift                                  |
| ----------------------------- | ----------------------------------------- | ------------------------------------------ |
| **Code Reuse from PWA**       | ~60-70% (business logic, Firebase)        | ~0% (complete rewrite)                     |
| **Development Speed**         | ⚡ Faster (if you know React)             | 🐢 Slower                                  |
| **Cross-Platform**            | ✅ iOS + Android from same codebase       | ❌ iOS only                                |
| **Apple Intelligence Access** | ✅ Via `@react-native-ai/apple`           | ✅ Native APIs                             |
| **Performance**               | ⚠️ Good (near-native)                     | ✅ Excellent (truly native)                |
| **Learning Curve**            | ✅ Low (already know React)               | ❌ High (learn Swift + UIKit/SwiftUI)      |
| **Ecosystem**                 | Large (npm, Expo)                         | Large (CocoaPods, Swift Package Manager)   |
| **Maintenance**               | Medium (need to keep up with RN versions) | Medium (need to keep up with iOS versions) |
| **Cost (App Store)**          | $99/year                                  | $99/year                                   |

### Recommendation: React Native

**Why React Native makes more sense for SnapList:**

1. You already have React expertise from PWA
2. Can reuse Firebase logic, data models, business rules
3. Future Android support possible (single codebase)
4. Expo makes setup easier (no Xcode project management needed initially)
5. `@react-native-ai/apple` provides Apple Intelligence access
6. Faster time-to-market

**When to choose Swift:**

- You want absolute best performance
- You need very deep iOS system integration
- You only ever want iOS (no Android)
- You have Swift expertise or want to learn it

---

## Apple Intelligence Integration (React Native)

### Setup: @react-native-ai/apple

**Installation:**

```bash
npm install @react-native-ai/apple
```

**Prerequisites:**

- React Native or Expo application
- iOS 26+ for Apple Intelligence features
- Device with Apple Intelligence support (iPhone 15 Pro+, M1+ Mac/iPad)

**Basic Usage:**

```javascript
import { apple } from '@react-native-ai/apple';
import { generateText } from 'ai';

// Check if Apple Intelligence is available on this device
if (!apple.isAvailable()) {
  console.log('Apple Intelligence not available, falling back to Gemini');
  // Use Gemini instead (see Dual AI Strategy section)
}

// Generate text using Apple Intelligence
const processTaskWithAppleAI = async (userInput, categories) => {
  try {
    const { text } = await generateText({
      model: apple('gpt-4o'), // Apple's foundation model
      prompt: `Analyze task: "${userInput}". Current time: ${new Date().toISOString()}.

Categories:
${categories.map((c) => `- ${c.name}: ${c.description}`).join('\n')}

Instructions:
1. Extract task title
2. Match to best category (or suggest new one if no match)
3. Extract due date (default to 9AM local if time not specified)
4. Assign urgency: "High", "Medium", or "Low"
5. Extract any additional notes

Return JSON only:
{
  "title": string,
  "category": string,
  "isNewCategory": boolean,
  "urgency": "High"|"Medium"|"Low",
  "dueDate": string (UTC ISO format),
  "notes": string
}`,
    });

    return JSON.parse(text);
  } catch (error) {
    console.error('Apple Intelligence failed:', error);
    throw error;
  }
};
```

### Available Models

Apple Intelligence provides these models via `@react-native-ai/apple`:

| Model ID      | Description                           | Best For                             |
| ------------- | ------------------------------------- | ------------------------------------ |
| `gpt-4o`      | Apple's most capable foundation model | Complex task parsing, categorization |
| `gpt-4o-mini` | Faster, lighter model                 | Simple tasks, quick responses        |

**Note:** These model IDs are abstractions for Apple's proprietary models, not actual OpenAI GPT models.

### Features Available for SnapList

#### 1. Task Categorization (Text Generation)

```javascript
const result = await generateText({
  model: apple('gpt-4o'),
  prompt: taskCategorizationPrompt,
});
```

#### 2. Semantic Search (Text Embeddings)

```javascript
import { embed } from 'ai';

const searchTasks = async (query, tasks) => {
  // Generate embedding for search query
  const { embedding: queryEmbedding } = await embed({
    model: apple.embedding('text-embedding-3-small'),
    value: query,
  });

  // Generate embeddings for all tasks (do this once, cache results)
  const taskEmbeddings = await Promise.all(
    tasks.map((task) =>
      embed({
        model: apple.embedding('text-embedding-3-small'),
        value: `${task.title} ${task.notes}`,
      })
    )
  );

  // Calculate similarity scores (cosine similarity)
  const scores = taskEmbeddings.map((taskEmb, i) => ({
    task: tasks[i],
    score: cosineSimilarity(queryEmbedding, taskEmb.embedding),
  }));

  // Sort by relevance
  return scores.sort((a, b) => b.score - a.score);
};
```

#### 3. Voice Transcription (Speech-to-Text)

```javascript
import { experimental_transcribe } from '@react-native-ai/apple';

const transcribeVoiceInput = async (audioFileUri) => {
  const result = await experimental_transcribe({
    model: apple.transcription('whisper-1'),
    file: audioFileUri,
  });

  return result.text;
};
```

**Note:** iOS 26+ includes on-device speech recognition. For iOS 17-25, use React Native Voice library with cloud transcription.

#### 4. Read Tasks Aloud (Text-to-Speech)

```javascript
import { experimental_generateSpeech } from '@react-native-ai/apple';

const readTaskAloud = async (taskTitle) => {
  const result = await experimental_generateSpeech({
    model: apple.speech('tts-1'),
    voice: 'alloy', // or 'echo', 'fable', 'onyx', 'nova', 'shimmer'
    input: `Your task: ${taskTitle}`,
  });

  // Play audio
  // result.audio is a base64-encoded audio file
};
```

---

## Dual AI Strategy: Apple Intelligence + Gemini Fallback

### Why Dual Strategy?

**Problem:** Apple Intelligence only works on iOS 26+ with specific hardware (iPhone 15 Pro+, M1+ devices).

**Solution:** Use Apple Intelligence when available, fall back to Gemini for older devices.

### Implementation

```javascript
// src/utils/ai.js
import { apple } from '@react-native-ai/apple';
import { generateText } from 'ai';

// Check device capabilities once at app startup
const AI_PROVIDER = apple.isAvailable() ? 'apple' : 'gemini';

export const processTask = async (userInput, categories) => {
  if (AI_PROVIDER === 'apple') {
    return processWithAppleAI(userInput, categories);
  } else {
    return processWithGemini(userInput, categories);
  }
};

// Apple Intelligence implementation
const processWithAppleAI = async (userInput, categories) => {
  const categoryContext = categories.map((c) => `- ${c.name}: ${c.description}`).join('\n');

  const prompt = buildTaskPrompt(userInput, categoryContext);

  const { text } = await generateText({
    model: apple('gpt-4o'),
    prompt,
  });

  return JSON.parse(text);
};

// Gemini fallback implementation
const processWithGemini = async (userInput, categories) => {
  const categoryContext = categories.map((c) => `- ${c.name}: ${c.description}`).join('\n');

  const systemPrompt = buildTaskPrompt(userInput, categoryContext);

  const apiKey = process.env.REACT_NATIVE_GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.5,
      },
    }),
  });

  const data = await response.json();
  const generatedText = data.candidates[0].content.parts[0].text;

  return JSON.parse(generatedText);
};

// Shared prompt builder
const buildTaskPrompt = (userInput, categoryContext) => {
  const nowFull = new Date().toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return `Analyze task: "${userInput}"
Time Context: ${nowFull}

Categories:
${categoryContext}

Instructions:
1. Extract task title
2. Match to best category (or suggest new if no match)
3. Extract due date/time (default 9AM local if not specified)
4. Assign urgency: EXACTLY "High", "Medium", or "Low" (string)
5. Extract additional notes

Return JSON only:
{
  "title": string,
  "category": string,
  "isNewCategory": boolean,
  "urgency": "High"|"Medium"|"Low",
  "dueDate": string (UTC ISO),
  "notes": string
}`;
};

// Utility to show user which AI is being used
export const getAIProviderInfo = () => {
  if (AI_PROVIDER === 'apple') {
    return {
      name: 'Apple Intelligence',
      description: 'On-device AI (private, no costs)',
      icon: '🍎',
      privacy: 'high',
    };
  } else {
    return {
      name: 'Google Gemini',
      description: 'Cloud AI (requires internet)',
      icon: '🌐',
      privacy: 'medium',
    };
  }
};
```

### User Experience

**Settings Screen:**

```javascript
import { View, Text } from 'react-native';
import { getAIProviderInfo } from '../utils/ai';

function SettingsScreen() {
  const aiProvider = getAIProviderInfo();

  return (
    <View>
      <Text style={styles.sectionTitle}>AI Provider</Text>

      <View style={styles.providerCard}>
        <Text style={styles.providerIcon}>{aiProvider.icon}</Text>
        <View>
          <Text style={styles.providerName}>{aiProvider.name}</Text>
          <Text style={styles.providerDescription}>{aiProvider.description}</Text>

          {aiProvider.privacy === 'high' && (
            <Text style={styles.privacyBadge}>🔒 Your tasks stay on your device</Text>
          )}
        </View>
      </View>

      {aiProvider.name === 'Google Gemini' && (
        <Text style={styles.upgradeNote}>
          💡 Upgrade to iPhone 15 Pro or later for on-device AI processing
        </Text>
      )}
    </View>
  );
}
```

### Cost Comparison

| Device                   | AI Provider        | API Costs      | Privacy             | Performance |
| ------------------------ | ------------------ | -------------- | ------------------- | ----------- |
| iPhone 15 Pro+ (iOS 26+) | Apple Intelligence | $0             | 🔒 High (on-device) | ⚡ Fast     |
| iPhone 15 (iOS 26+)      | Gemini             | ~$0.50/month\* | ⚠️ Medium (cloud)   | ⚡ Fast     |
| iPhone 14 and older      | Gemini             | ~$0.50/month\* | ⚠️ Medium (cloud)   | ⚡ Fast     |

\*Assuming 1000 task captures/month @ $0.0005/request

---

## Migration Path from PWA to React Native

### Can You Mix PWA and React Native?

**Short answer: No.**

- React PWA runs in browser (JavaScript engine: V8/JavaScriptCore)
- React Native compiles to native code (JavaScript engine: Hermes/JSC bridge)
- **They are fundamentally different platforms**
- **You cannot import React Native modules into a PWA**

### Migration Options

#### Option 1: Keep PWA (Recommended for Now)

**Stay with current architecture, wait for:**

- iOS 26+ to gain market share (6-12 months)
- Apple to potentially expose Apple Intelligence to Safari/WebKit
- Browser-based on-device AI to mature (Chrome's `window.ai`, Transformers.js)

**Pros:**

- No rebuild needed
- Keep working codebase
- PWA works across all platforms (iOS, Android, Desktop)

**Cons:**

- No Apple Intelligence access
- No background geofencing
- Limited native features

#### Option 2: Full React Native Rewrite (v2.0)

**Rebuild SnapList as React Native app:**

**What you can reuse:**

- ✅ Firebase logic (same SDK)
- ✅ Business logic (task processing, categorization rules)
- ✅ Data models (Firestore schemas stay the same)
- ✅ Color system, design principles

**What you must rebuild:**

- ❌ UI components (`<div>` → `<View>`, `<input>` → `<TextInput>`)
- ❌ Styling (Tailwind CSS → React Native StyleSheet or NativeWind)
- ❌ Voice input (Web Speech API → React Native Voice)
- ❌ Navigation (React Router → React Navigation)
- ❌ All layout code

**Estimated Effort:** 2-4 weeks for experienced React developer

#### Option 3: Hybrid (Maintain Both)

**Build React Native app, keep PWA:**

- React Native app for iOS/Android (with Apple Intelligence)
- PWA for web users
- Shared Firebase backend
- Attempt to share business logic via npm packages

**Pros:** Best of both worlds
**Cons:** Double maintenance burden, complex

---

## Location-Based Features in Native App

See **`LOCATION-BASED-FEATURES-GUIDE.md`** for comprehensive location features documentation.

### What Native Apps Enable

**Background Geofencing:**

```javascript
import Geolocation from 'react-native-geolocation-service';
import PushNotification from 'react-native-push-notification';

// Register geofence monitoring
Geolocation.watchPosition(
  (position) => {
    const { latitude, longitude } = position.coords;

    // Check against all task locations
    tasks.forEach((task) => {
      if (!task.location) return;

      const distance = calculateDistance(
        latitude,
        longitude,
        task.location.latitude,
        task.location.longitude
      );

      // Within geofence radius?
      if (distance <= task.location.radius) {
        // Trigger local notification (works even when app is closed)
        PushNotification.localNotification({
          title: `📍 You're near: ${task.title}`,
          message: `${task.location.name} is ${formatDistance(distance)} away`,
          data: { taskId: task.id },
          playSound: true,
          vibrate: true,
        });
      }
    });
  },
  (error) => console.error(error),
  {
    enableHighAccuracy: false, // Save battery
    distanceFilter: 100, // Only update if moved 100m
    interval: 60000, // Check every minute
    fastestInterval: 30000, // But no faster than 30s
  }
);
```

**Permission Handling:**

```javascript
import { request, PERMISSIONS, RESULTS } from 'react-native-permissions';

const requestLocationPermission = async () => {
  // Request "While Using" permission first
  const result = await request(PERMISSIONS.IOS.LOCATION_WHEN_IN_USE);

  if (result === RESULTS.GRANTED) {
    // Then request "Always" permission for background geofencing
    const alwaysResult = await request(PERMISSIONS.IOS.LOCATION_ALWAYS);

    if (alwaysResult === RESULTS.GRANTED) {
      // Can now use background geofencing
      setupGeofencing();
    }
  }
};
```

### iOS Geofencing Limits

- **Maximum 20 geofences** can be monitored simultaneously
- Strategy: Monitor geofences for next 20 soonest tasks with locations
- Re-register geofences when tasks completed or new tasks added

---

## Cost-Benefit Analysis

### PWA (Current)

| Aspect           | Rating       | Notes                                |
| ---------------- | ------------ | ------------------------------------ |
| Development Time | ✅ Done      | Already built                        |
| Monthly Cost     | ⚠️ ~$5-10    | Gemini API costs (~1000 tasks/month) |
| Maintenance      | ✅ Low       | Just web stack                       |
| Feature Access   | ⚠️ Limited   | No Apple Intelligence, no geofencing |
| Cross-Platform   | ✅ Excellent | iOS, Android, Desktop, any browser   |
| Privacy          | ⚠️ Medium    | Tasks sent to Gemini cloud           |
| Performance      | ✅ Good      | Fast enough for web app              |
| App Store        | ❌ No        | Not listed in App Store              |

### React Native (Future v2.0)

| Aspect           | Rating       | Notes                                      |
| ---------------- | ------------ | ------------------------------------------ |
| Development Time | ❌ 2-4 weeks | Significant rebuild                        |
| Monthly Cost     | ✅ $0        | Apple Intelligence = no API costs          |
| Maintenance      | ⚠️ Medium    | Need to keep up with React Native versions |
| Feature Access   | ✅ Excellent | Apple Intelligence, geofencing, widgets    |
| Cross-Platform   | ✅ Good      | iOS + Android (from same codebase)         |
| Privacy          | ✅ High      | On-device AI (iPhone 15 Pro+)              |
| Performance      | ✅ Excellent | Native performance                         |
| App Store        | ✅ Yes       | Listed in App Store ($99/year)             |

---

## Recommended Timeline

### Short Term (Now - Month 3): Stay PWA

**Focus:**

1. ✅ Complete PWA migration (done)
2. ✅ Implement location-tagged tasks (foreground only)
3. ✅ Add "Check Nearby" button
4. ✅ Validate product-market fit with real users
5. ⚠️ Monitor iOS 26+ adoption rate
6. ⚠️ Track Gemini API costs

**Reasoning:**

- iOS 26+ (likely iOS 18.2+) won't have significant adoption for 6-12 months
- Current PWA works well and is deployed
- Validate product before committing to native rebuild

### Medium Term (Month 3-6): Decision Point

**Evaluate:**

- Are users requesting native features?
- Is Gemini API cost becoming significant?
- Has iOS 26+ reached >20% of your user base?
- Do you need background geofencing for your use case?

**If YES to 2+ questions → Proceed with React Native**
**If NO → Stay PWA, re-evaluate in 6 months**

### Long Term (Month 6+): React Native v2.0

**If proceeding:**

1. Create `react-native-v2` branch
2. Set up Expo project
3. Port core features (task capture, AI processing, Firebase)
4. Implement Apple Intelligence with Gemini fallback
5. Add background geofencing
6. Beta test with TestFlight
7. Launch in App Store

**Effort Estimate:**

- Week 1: Expo setup, Firebase integration, basic UI
- Week 2: Task capture flow, AI integration (dual strategy)
- Week 3: Location features, geofencing, notifications
- Week 4: Polish, testing, App Store submission

---

## Decision Framework

### When to Stay PWA

✅ You should **STAY with PWA** if:

- Your users are primarily on desktop or Android
- You want to avoid $99/year App Store fees
- You don't need background location features
- Gemini API costs are negligible (<$10/month)
- You value rapid iteration and deployment
- You want maximum cross-platform reach

### When to Go React Native

✅ You should **MIGRATE to React Native** if:

- Your users are primarily on iOS
- Background geofencing is critical for your product
- You want on-device AI (privacy-first value proposition)
- Gemini API costs are becoming significant
- You want App Store listing and native UX
- You have 2-4 weeks for migration

### Hybrid Approach

⚠️ **Consider Hybrid** (maintain both) if:

- You have diverse user base (web + mobile)
- You have resources for dual maintenance
- You want mobile-first features + web accessibility
- You can share business logic effectively

---

## Appendix: Quick Start for React Native Experiment

If you want to create an experimental branch to test React Native + Apple Intelligence:

### Step 1: Create Experimental Branch

```bash
git checkout -b experiment/react-native-apple-intelligence
```

### Step 2: Initialize Expo Project

```bash
npx create-expo-app snaplist-native
cd snaplist-native
```

### Step 3: Install Dependencies

```bash
npx expo install @react-native-ai/apple firebase react-native-geolocation-service react-native-push-notification
```

### Step 4: Minimal Proof of Concept

**File:** `App.js`

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { apple } from '@react-native-ai/apple';
import { generateText } from 'ai';

export default function App() {
  const [taskInput, setTaskInput] = useState('');
  const [aiProvider, setAiProvider] = useState('checking...');

  useEffect(() => {
    // Check if Apple Intelligence is available
    if (apple.isAvailable()) {
      setAiProvider('Apple Intelligence 🍎');
    } else {
      setAiProvider('Gemini (Fallback) 🌐');
    }
  }, []);

  const processTask = async () => {
    try {
      if (apple.isAvailable()) {
        // Use Apple Intelligence
        const { text } = await generateText({
          model: apple('gpt-4o'),
          prompt: `Extract task title from: "${taskInput}". Return JSON: {"title": string}`,
        });
        const result = JSON.parse(text);
        Alert.alert('Task Processed (Apple AI)', result.title);
      } else {
        // Fallback to Gemini (would need API key)
        Alert.alert('Would use Gemini here');
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>SnapList POC</Text>

      <Text style={{ marginBottom: 10 }}>AI Provider: {aiProvider}</Text>

      <TextInput
        value={taskInput}
        onChangeText={setTaskInput}
        placeholder="Enter a task..."
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 10,
          marginBottom: 20,
          borderRadius: 5,
        }}
      />

      <Button title="Process Task" onPress={processTask} />
    </View>
  );
}
```

### Step 5: Run on iOS

```bash
npx expo run:ios
```

**Note:** Requires Mac with Xcode installed. For testing on device, use Expo Go app.

---

**Document Version:** 1.0
**Last Updated:** January 5, 2026
**Status:** Complete - Ready for Decision Making

**Related Documents:**

- `LOCATION-BASED-FEATURES-GUIDE.md` - Comprehensive location features guide
- `CLAUDE.md` - Current PWA architecture documentation
- `MIGRATION-CHECKLIST.md` - PWA migration checklist (completed)
