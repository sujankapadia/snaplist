# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

**SnapList AI** is currently in migration from Google Gemini Canvas to a local Vite + React development environment. The codebase consists of a single `App.jsx` file that was built in the Gemini Canvas sandbox and needs to be migrated to a proper local development setup.

## Migration Status & Critical Issues

### Current State

- Single-file React application (`App.jsx`) with all components inline
- Uses **sandbox-specific Firebase paths**: `collection(db, 'artifacts', appId, 'users', user.uid, 'tasks')`
- Missing functions that are called but not defined:
  - `acceptSuggestedCategory()` (referenced at line 473)
  - `handleAddCategory()` (referenced at line 585)
- Empty Gemini API key at line 239
- No build tooling or project structure yet established

### Required for Local Development

The app needs full project initialization per `local-development-change-suggestions.md`:

1. Vite + React project scaffolding (`package.json`, `vite.config.js`, etc.)
2. Tailwind CSS configuration (`tailwind.config.js`, `postcss.config.js`, `index.css`)
3. Environment variables (`.env`) for Firebase config and Gemini API key
4. Firebase paths simplified from `artifacts/${appId}/users/${userId}/...` to `users/${userId}/...`
5. PWA configuration using `vite-plugin-pwa` for installability

## Architecture Overview

### Tech Stack

- **Frontend**: React with Tailwind CSS (mobile-first design)
- **Icons**: Lucide React
- **Backend**: Firebase (Anonymous Auth + Firestore)
- **AI**: Google Gemini (`gemini-2.5-flash-preview-09-2025` model)
- **Voice**: Web Speech API (browser native)

### Required Dependencies

```json
{
  "dependencies": {
    "firebase": "^latest",
    "lucide-react": "^latest",
    "react": "^latest",
    "react-dom": "^latest"
  },
  "devDependencies": {
    "vite": "^latest",
    "vite-plugin-pwa": "^latest",
    "tailwindcss": "^latest",
    "postcss": "^latest",
    "autoprefixer": "^latest"
  }
}
```

### Data Model (Firestore)

```
/users/{userId}/tasks
  - title: string
  - category: string
  - urgency: "High" | "Medium" | "Low"
  - dueDate: ISO timestamp
  - notes: string
  - completed: boolean
  - isNewCategory: boolean
  - createdAt: Firestore timestamp

/users/{userId}/categories
  - name: string
  - description: string (used in AI prompt context)
  - hue: number (0-360 for HSL color system)
  - createdAt: Firestore timestamp
```

### Core Application Flow

1. **Task Capture**: User speaks or types a task (e.g., "Buy milk tomorrow at 3pm")
2. **AI Processing**: `processWithAI()` (App.jsx:236-260) sends task to Gemini with:
   - Current time context for relative date parsing
   - All user categories with descriptions (context for categorization)
   - System prompt requesting structured JSON response
   - API endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent`
   - Uses `responseMimeType: "application/json"` for structured output
3. **AI Response**: Returns `{title, category, isNewCategory, urgency, dueDate, notes}`
   - `dueDate` is in UTC ISO format
   - `isNewCategory: true` if AI suggests a category not in user's list
4. **Category Handling**:
   - If `isNewCategory: true`, show amber banner with Sparkles icon in task detail modal
   - User can accept (calls `acceptSuggestedCategory()` - currently missing) or dismiss
5. **Real-time Sync**: Firestore `onSnapshot` keeps tasks/categories synced across devices/tabs

### Key State Management Patterns

- **Real-time listeners**: Set up in `useEffect` when `user` changes (lines 136-160)
- **Seed data**: If no categories exist, batch-create 8 default categories (lines 142-148):
  - Work, Groceries, Medical, Fitness, Bills, Finance, Auto, Home
  - Each gets a random hue from predefined palette: `[210, 260, 140, 0, 45, 190, 320, 20, 170]`
- **Filtering/Sorting**: Uses `useMemo` for derived state (lines 163-233)
  - Filters: completion status, search query, category, date range
  - Sorts: due date, urgency, category, newest
- **Theme**: Persisted in localStorage, respects system preference by default

### Dynamic Color System

Categories use HSL colors for accessibility:

- `getCategoryStyles()` generates background/text colors based on theme
- Dark mode: `hsl(hue, 75%, 20%)` background, `hsl(hue, 75%, 85%)` text
- Light mode: `hsl(hue, 75%, 92%)` background, `hsl(hue, 75%, 30%)` text

### Urgency System

Urgency levels are defined in `URGENCY_LEVELS` and `URGENCY_COLORS` constants:

- **High**: Priority 3, Red text (`text-red-500 dark:text-red-400`)
- **Medium**: Priority 2, Orange text (`text-orange-500 dark:text-orange-400`)
- **Low**: Priority 1, Gray text (`text-gray-400 dark:text-gray-500`)

### UI Component Patterns

**Mobile-First Design Principles:**

- Horizontal scrollable chip filters for categories/dates (no vertical scrollbar)
- Bottom sheet modals for sort menu and task details
- Sticky header and filter bar for persistent access
- Floating capture bar at bottom (gradient overlay to prevent content clash)

**Key UI Components:**

- **Task Cards** (`App.jsx:367-405`): Tap to edit, checkbox toggle, category badge, urgency indicator
- **Floating Capture Bar** (`App.jsx:408-426`): Text input + voice button, fixed bottom positioning
- **Sort Menu Bottom Sheet** (`App.jsx:428-454`): Slide-up modal with 4 sort options
- **Task Detail Modal** (`App.jsx:457-556`): Full-screen on mobile, centered on desktop
- **Category Manager Modal** (`App.jsx:558-594`): CRUD interface for categories with inline description editing
- **Filter Chips** (`App.jsx:318-357`): Status toggle, date range (all/today/week/month), category filters

## Firebase Configuration Notes

When migrating to local development, Firebase initialization must change from:

```javascript
const firebaseConfig = JSON.parse(__firebase_config); // Sandbox global
const appId = typeof __app_id !== 'undefined' ? __app_id : 'snap-list-ai'; // Sandbox global
```

To:

```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
```

All Firestore paths must be updated to remove the `artifacts/${appId}` prefix.

### Gemini API Configuration

The API key is currently empty at line 239. For local development, add to `.env`:

```
VITE_GEMINI_API_KEY=your_google_ai_studio_key
```

Then update App.jsx:

```javascript
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
```

Get API key from: https://aistudio.google.com/ (generous free tier for `gemini-2.5-flash` model)

## Missing Implementations

Two critical functions are called but not implemented in App.jsx:

1. **`acceptSuggestedCategory(task)`** - Should:

   - Create new category in Firestore with task's category name
   - Generate random hue from `generateCategoryHue()`
   - Update task to set `isNewCategory: false`

2. **`handleAddCategory(name, description)`** - Should:
   - Add new category to Firestore with generated hue
   - Used by "Add Category" button in category manager

## Firestore Security Rules

Required rules (set in Firebase Console):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{anyUserPath=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Voice Input Constraints

- Requires HTTPS or localhost (secure context for Web Speech API)
- For testing on physical devices over Wi-Fi, use ngrok or configure Vite HTTPS
- One-shot recording: listens once, processes final transcript, stops

## Future Roadmap (Not Yet Implemented)

Per `project-overview.md`, planned features include:

- Push notifications via Firebase Cloud Messaging
- Configurable reminder intervals (10m, 1h before due date)
- Cloud Functions for deadline monitoring
