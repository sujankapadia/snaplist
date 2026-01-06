# Location-Based Features Guide - SnapList

## Overview

This guide covers implementing location-based tasks, location filters, and location-triggered reminders in SnapList, addressing the unique challenges of Progressive Web Apps (PWAs) vs. native mobile apps.

**Features to Implement:**

1. **Location-tagged tasks** - Attach locations to tasks (e.g., "Buy milk" at "Trader Joe's")
2. **Location-based filtering** - Show tasks near current location
3. **Location-based reminders** - Notify when user enters a location (geofencing)

**Key Challenges:**

- PWAs have limited background access (can't run constantly like native apps)
- Geofencing API not widely supported in browsers
- Battery and privacy concerns with constant location tracking
- Push notifications require server-side trigger

---

## Table of Contents

1. [PWA vs Native Apps: Location Capabilities](#pwa-vs-native-apps-location-capabilities)
2. [Feature 1: Location-Tagged Tasks](#feature-1-location-tagged-tasks)
3. [Feature 2: Location-Based Filtering](#feature-2-location-based-filtering)
4. [Feature 3: Location-Based Reminders (Geofencing)](#feature-3-location-based-reminders-geofencing)
5. [Background Location Tracking: What's Possible](#background-location-tracking-whats-possible)
6. [Implementation Strategy for SnapList](#implementation-strategy-for-snaplist)
7. [Privacy and Battery Considerations](#privacy-and-battery-considerations)
8. [Alternative Approaches](#alternative-approaches)
9. [Native App Migration Path](#native-app-migration-path)

---

## PWA vs Native Apps: Location Capabilities

### Native Apps (iOS/Android)

**What's Possible:**

| Feature                 | iOS                     | Android              | Background? | Battery Impact |
| ----------------------- | ----------------------- | -------------------- | ----------- | -------------- |
| **Current Location**    | ✅ Always               | ✅ Always            | ✅ Yes      | Medium         |
| **Continuous Tracking** | ✅ With permission      | ✅ With permission   | ✅ Yes      | High           |
| **Geofencing**          | ✅ Up to 20 regions     | ✅ Up to 100 regions | ✅ Yes      | Low            |
| **Background Updates**  | ✅ Significant location | ✅ Always            | ✅ Yes      | Medium-High    |
| **Low Power Mode**      | ✅ Reduced accuracy     | ✅ Reduced accuracy  | ✅ Yes      | Low            |

**Permissions:**

- iOS: "When In Use" or "Always" location access
- Android: "Foreground" or "Background" location access
- Users must explicitly grant background access (strict approval process)

### PWAs (Browser-Based)

**What's Possible:**

| Feature                     | Chrome             | Safari             | Firefox            | Background? | Battery Impact |
| --------------------------- | ------------------ | ------------------ | ------------------ | ----------- | -------------- |
| **Current Location**        | ✅ With permission | ✅ With permission | ✅ With permission | ❌ No       | Low            |
| **Continuous Tracking**     | ⚠️ Foreground only | ⚠️ Foreground only | ⚠️ Foreground only | ❌ No       | Medium         |
| **Geofencing API**          | ❌ Experimental    | ❌ Not supported   | ❌ Not supported   | ❌ No       | -              |
| **Background Geolocation**  | ❌ Not available   | ❌ Not available   | ❌ Not available   | ❌ No       | -              |
| **Service Worker Location** | ❌ Cannot access   | ❌ Cannot access   | ❌ Cannot access   | ❌ No       | -              |

**Key Limitation:** PWAs **cannot access location when app is in background or closed**.

**Why?** Privacy and battery concerns. Browsers intentionally restrict background location access to prevent:

- Constant location tracking by websites
- Battery drain from multiple sites polling location
- Privacy violations (websites tracking users 24/7)

### Comparison Table

| Capability                         | Native App                    | PWA                     |
| ---------------------------------- | ----------------------------- | ----------------------- |
| **Foreground location**            | ✅ Excellent                  | ✅ Excellent            |
| **Background location**            | ✅ Excellent                  | ❌ None                 |
| **Geofencing**                     | ✅ Native API                 | ❌ Not supported        |
| **Always-on tracking**             | ✅ Possible (with permission) | ❌ Impossible           |
| **Location in Service Worker**     | ✅ Yes                        | ❌ No                   |
| **Push notifications on location** | ✅ Device triggers            | ⚠️ Server triggers only |

---

## Feature 1: Location-Tagged Tasks

### Goal

Allow users to attach a location to tasks:

- "Buy milk" at "Trader Joe's, 123 Main St"
- "Pick up dry cleaning" at "Cleaners, 456 Oak Ave"
- "Return library books" at "Public Library"

### Implementation (Data Model)

**Firestore Schema:**

```javascript
// Collection: users/{userId}/tasks/{taskId}
{
  title: "Buy milk",
  category: "Groceries",
  location: {
    name: "Trader Joe's",              // Human-readable name
    address: "123 Main St, City, CA",  // Full address
    latitude: 37.7749,                 // Coordinates
    longitude: -122.4194,
    placeId: "ChIJd8BlQ2BZwokRjMKp...", // Google Places ID (optional)
    radius: 500                        // Radius in meters for "near" detection
  },
  dueDate: "2026-01-05T10:00:00Z",
  completed: false
}
```

### UI: Location Picker

**Component: Location Autocomplete**

```javascript
import { useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';

function LocationPicker({ value, onChange }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Use Google Places Autocomplete API
  const searchPlaces = async (searchQuery) => {
    if (!searchQuery || searchQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);

    try {
      // Option 1: Google Places API (requires API key)
      const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          searchQuery
        )}&key=${apiKey}`
      );
      const data = await response.json();

      setSuggestions(data.predictions || []);
    } catch (error) {
      console.error('Places search failed:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Get place details (coordinates) when user selects
  const selectPlace = async (placeId) => {
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry&key=${apiKey}`
      );
      const data = await response.json();

      if (data.result) {
        onChange({
          name: data.result.name,
          address: data.result.formatted_address,
          latitude: data.result.geometry.location.lat,
          longitude: data.result.geometry.location.lng,
          placeId: placeId,
          radius: 500, // Default 500m
        });
      }

      setQuery('');
      setSuggestions([]);
    } catch (error) {
      console.error('Place details failed:', error);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
        Location (optional)
      </label>

      {/* Selected location */}
      {value && (
        <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
          <MapPin size={18} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-900 dark:text-white truncate">{value.name}</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{value.address}</p>
          </div>
          <button
            onClick={() => onChange(null)}
            className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded"
          >
            <X size={16} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      )}

      {/* Search input */}
      {!value && (
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              searchPlaces(e.target.value);
            }}
            placeholder="Search for a place..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          />

          {/* Suggestions dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.place_id}
                  onClick={() => selectPlace(suggestion.place_id)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                >
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-slate-400 mt-1 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {suggestion.structured_formatting?.main_text}
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {suggestion.structured_formatting?.secondary_text}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LocationPicker;
```

**Add to Task Detail Modal:**

```javascript
// In task detail modal
const [location, setLocation] = useState(editingTask?.location || null);

<LocationPicker value={location} onChange={setLocation} />;

// Save location with task
await updateDoc(doc(db, 'users', user.uid, 'tasks', taskId), {
  location: location,
  updatedAt: serverTimestamp(),
});
```

### Alternative: Use Current Location

```javascript
// Add "Use Current Location" button
function UseCurrentLocationButton({ onChange }) {
  const [isLoading, setIsLoading] = useState(false);

  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    setIsLoading(true);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse geocode to get address (Google Geocoding API)
      const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.results && data.results[0]) {
        onChange({
          name: 'Current Location',
          address: data.results[0].formatted_address,
          latitude,
          longitude,
          radius: 100, // Smaller radius for "current location"
        });
      }

      toast.success('Location added');
    } catch (error) {
      console.error('Location error:', error);
      toast.error('Could not get location. Check permissions.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={getCurrentLocation}
      disabled={isLoading}
      className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
    >
      {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
      Use Current Location
    </button>
  );
}
```

---

## Feature 2: Location-Based Filtering

### Goal

Show tasks near user's current location:

- "You have 3 tasks near you"
- Filter: "Tasks within 1 mile"
- Sort by distance

### Implementation

**Step 1: Get Current Location**

```javascript
// In App.jsx
const [currentLocation, setCurrentLocation] = useState(null);
const [locationPermission, setLocationPermission] = useState('prompt'); // 'granted', 'denied', 'prompt'

useEffect(() => {
  // Check if location permission already granted
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      setLocationPermission(result.state);

      // Listen for permission changes
      result.addEventListener('change', () => {
        setLocationPermission(result.state);
      });
    });
  }
}, []);

const updateCurrentLocation = async () => {
  if (!navigator.geolocation) return;

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false, // Use false for battery efficiency
        timeout: 5000,
        maximumAge: 300000, // Cache for 5 minutes
      });
    });

    setCurrentLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Location update failed:', error);
  }
};

// Update location when app opens (if permission granted)
useEffect(() => {
  if (locationPermission === 'granted') {
    updateCurrentLocation();
  }
}, [locationPermission]);
```

**Step 2: Calculate Distance (Haversine Formula)**

```javascript
/**
 * Calculate distance between two coordinates in meters
 * Uses Haversine formula for accuracy
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Format distance for display
 */
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  } else {
    return `${(meters / 1000).toFixed(1)} km`;
  }
}
```

**Step 3: Filter Tasks by Location**

```javascript
// Add to filters state
const [locationFilter, setLocationFilter] = useState({
  enabled: false,
  radiusMeters: 1609, // 1 mile
});

// Add to filteredTasks memo
const filteredAndSortedTasks = useMemo(() => {
  let result = tasks;

  // ... existing filters (completed, search, category, date)

  // Location filter
  if (locationFilter.enabled && currentLocation) {
    result = result.filter((task) => {
      if (!task.location) return false; // No location, skip

      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        task.location.latitude,
        task.location.longitude
      );

      return distance <= locationFilter.radiusMeters;
    });
  }

  // ... sorting logic

  return result;
}, [tasks, filters, locationFilter, currentLocation]);
```

**Step 4: UI for Location Filter**

```javascript
// Location filter chip
function LocationFilterChip() {
  if (locationPermission !== 'granted') {
    return (
      <button
        onClick={updateCurrentLocation}
        className="px-4 py-2 rounded-full border border-slate-300 dark:border-slate-600 text-sm flex items-center gap-2"
      >
        <MapPin size={16} />
        Enable Location
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setLocationFilter((prev) => ({ ...prev, enabled: !prev.enabled }))}
        className={`px-4 py-2 rounded-full border text-sm flex items-center gap-2 transition-colors ${
          locationFilter.enabled
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300'
        }`}
      >
        <MapPin size={16} />
        {locationFilter.enabled ? 'Near Me' : 'All Locations'}
      </button>

      {locationFilter.enabled && (
        <select
          value={locationFilter.radiusMeters}
          onChange={(e) =>
            setLocationFilter((prev) => ({
              ...prev,
              radiusMeters: parseInt(e.target.value),
            }))
          }
          className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm bg-white dark:bg-slate-800"
        >
          <option value="500">500m</option>
          <option value="1609">1 mile</option>
          <option value="5000">5 km</option>
          <option value="16093">10 miles</option>
        </select>
      )}
    </div>
  );
}
```

**Step 5: Show Distance in Task Cards**

```javascript
// In task card component
{
  task.location && currentLocation && (
    <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
      <MapPin size={12} />
      <span>
        {formatDistance(
          calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            task.location.latitude,
            task.location.longitude
          )
        )}{' '}
        away
      </span>
    </div>
  );
}
```

---

## Feature 3: Location-Based Reminders (Geofencing)

### The Challenge: PWAs Cannot Do True Geofencing

**What native apps do:**

1. Register geofence regions with OS
2. OS monitors location in background
3. OS triggers app when user enters/exits region
4. Works even when app is closed

**What PWAs CANNOT do:**

- ❌ Register geofences with browser/OS
- ❌ Monitor location in background
- ❌ Trigger notifications based on location automatically
- ❌ Access location when app is closed

### Workaround Approaches

#### Option A: Server-Side Location Monitoring (Requires User Cooperation)

**How it works:**

1. User's device periodically sends location to server (when app is open)
2. Server stores last known location
3. Cloud Function checks if user near task locations
4. Server sends push notification when nearby

**Implementation:**

**Step 1: Periodic Location Updates (Foreground Only)**

```javascript
// In App.jsx
useEffect(() => {
  if (!user || locationPermission !== 'granted') return;

  // Update location every 5 minutes (when app is open)
  const intervalId = setInterval(
    () => {
      updateAndSyncLocation();
    },
    5 * 60 * 1000
  ); // 5 minutes

  // Also update immediately
  updateAndSyncLocation();

  return () => clearInterval(intervalId);
}, [user, locationPermission]);

const updateAndSyncLocation = async () => {
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000, // Accept 1-minute-old location
      });
    });

    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      timestamp: serverTimestamp(),
    };

    // Store in local state
    setCurrentLocation(location);

    // Sync to Firestore (for server-side geofencing)
    await updateDoc(doc(db, 'users', user.uid), {
      lastKnownLocation: location,
    });
  } catch (error) {
    console.error('Location sync failed:', error);
  }
};
```

**Step 2: Cloud Function for Geofence Checking**

```javascript
// functions/index.js
const functions = require('firebase-functions');
const admin = require('firebase-admin');

/**
 * Scheduled function: Check if users are near task locations
 * Runs every 5 minutes
 */
exports.checkGeofences = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  const db = admin.firestore();

  // Get all users with last known location
  const usersSnapshot = await db.collection('users').where('lastKnownLocation', '!=', null).get();

  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data();
    const lastLocation = user.lastKnownLocation;

    // Skip if location is stale (>10 minutes old)
    const locationAge = Date.now() - lastLocation.timestamp.toMillis();
    if (locationAge > 10 * 60 * 1000) continue;

    // Get user's incomplete tasks with locations
    const tasksSnapshot = await db
      .collection('users')
      .doc(userDoc.id)
      .collection('tasks')
      .where('completed', '==', false)
      .where('location', '!=', null)
      .get();

    for (const taskDoc of tasksSnapshot.docs) {
      const task = taskDoc.data();
      const taskLocation = task.location;

      // Calculate distance
      const distance = calculateDistance(
        lastLocation.latitude,
        lastLocation.longitude,
        taskLocation.latitude,
        taskLocation.longitude
      );

      // Check if within geofence radius
      if (distance <= taskLocation.radius) {
        // Check if we already sent notification recently
        const sentKey = `geofence_${taskDoc.id}_${new Date().toDateString()}`;
        const alreadySent = user.notificationsSent?.[sentKey];

        if (!alreadySent) {
          // Send push notification
          await sendPushNotification(user.fcmToken, {
            title: `📍 You're near: ${task.title}`,
            body: `${taskLocation.name} is ${formatDistance(distance)} away`,
            data: {
              taskId: taskDoc.id,
              type: 'geofence',
            },
          });

          // Mark as sent to avoid spam
          await db
            .collection('users')
            .doc(userDoc.id)
            .update({
              [`notificationsSent.${sentKey}`]: true,
            });
        }
      }
    }
  }
});

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

async function sendPushNotification(fcmToken, payload) {
  if (!fcmToken) return;

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
      webpush: {
        fcmOptions: {
          link: 'https://snaplist.netlify.app',
        },
      },
    });
  } catch (error) {
    console.error('Push notification failed:', error);
  }
}
```

**Step 3: Setup Push Notifications**

```javascript
// In App.jsx - Request notification permission
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const messaging = getMessaging(app);

useEffect(() => {
  if (!user) return;

  const setupPushNotifications = async () => {
    // Request notification permission
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });

      // Store token in Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        fcmToken: token,
      });

      // Listen for foreground messages
      onMessage(messaging, (payload) => {
        console.log('Notification received:', payload);

        // Show toast
        toast(payload.notification.title, {
          description: payload.notification.body,
        });
      });
    }
  };

  setupPushNotifications();
}, [user]);
```

**File:** `public/firebase-messaging-sw.js` (Service Worker for background notifications)

```javascript
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'YOUR_FIREBASE_API_KEY',
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.firebasestorage.app',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_FIREBASE_APP_ID',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: payload.data.taskId,
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(clients.openWindow('https://snaplist.netlify.app'));
});
```

**Limitations of Server-Side Approach:**

- ⚠️ Only works if user opens app periodically (to update location)
- ⚠️ Delay between entering geofence and notification (up to 5 minutes)
- ⚠️ Battery drain if checking too frequently
- ⚠️ Privacy concerns (storing user location on server)

#### Option B: Foreground Location Monitoring

**How it works:**

1. When app is open, continuously check location
2. Show in-app alert when near task location
3. No background functionality

**Implementation:**

```javascript
// In App.jsx
const [nearbyTasks, setNearbyTasks] = useState([]);

useEffect(() => {
  if (!currentLocation || !tasks) return;

  // Check every 30 seconds while app is open
  const checkInterval = setInterval(() => {
    const nearby = tasks.filter((task) => {
      if (!task.location || task.completed) return false;

      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        task.location.latitude,
        task.location.longitude
      );

      return distance <= task.location.radius;
    });

    // Show toast for new nearby tasks
    nearby.forEach((task) => {
      if (!nearbyTasks.find((t) => t.id === task.id)) {
        toast(`📍 You're near: ${task.title}`, {
          description: `${task.location.name} is nearby`,
          action: {
            label: 'View',
            onClick: () => setEditingTask(task),
          },
        });
      }
    });

    setNearbyTasks(nearby);
  }, 30000); // Every 30 seconds

  return () => clearInterval(checkInterval);
}, [currentLocation, tasks, nearbyTasks]);
```

**Pros:**

- ✅ Works entirely client-side
- ✅ No server needed
- ✅ Immediate feedback (no 5-minute delay)
- ✅ Privacy-preserving (location stays on device)

**Cons:**

- ❌ Only works when app is open
- ❌ No background monitoring at all

#### Option C: Manual "Check Nearby Tasks" Button

**How it works:**

1. User manually triggers location check
2. App shows tasks near current location
3. Simple, explicit, privacy-friendly

**Implementation:**

```javascript
function CheckNearbyButton() {
  const [nearbyTasks, setNearbyTasks] = useState([]);
  const [isChecking, setIsChecking] = useState(false);

  const checkNearby = async () => {
    setIsChecking(true);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude } = position.coords;

      const nearby = tasks.filter((task) => {
        if (!task.location || task.completed) return false;

        const distance = calculateDistance(
          latitude,
          longitude,
          task.location.latitude,
          task.location.longitude
        );

        return distance <= task.location.radius;
      });

      setNearbyTasks(nearby);

      if (nearby.length === 0) {
        toast('No tasks nearby', {
          description: "You don't have any tasks near your current location.",
        });
      } else {
        toast(`${nearby.length} task${nearby.length > 1 ? 's' : ''} nearby`, {
          description: 'Check the list below',
        });
      }
    } catch (error) {
      toast.error('Could not get location');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div>
      <button
        onClick={checkNearby}
        disabled={isChecking}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        {isChecking ? <Loader2 size={18} className="animate-spin" /> : <MapPin size={18} />}
        Check Nearby Tasks
      </button>

      {/* Show nearby tasks */}
      {nearbyTasks.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="font-semibold text-slate-900 dark:text-white">Tasks Near You</h3>
          {nearbyTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Background Location Tracking: What's Possible

### PWA Limitations

**What PWAs CANNOT do:**

- ❌ Access `navigator.geolocation` from Service Worker
- ❌ Run JavaScript when app is closed
- ❌ Register native geofences with OS
- ❌ Trigger code based on location automatically

**Why:** Security and privacy by design. Browsers prevent background location access to protect users.

### Service Worker Capabilities (What IS Possible)

**Service Workers CAN:**

- ✅ Receive push notifications (server-triggered)
- ✅ Show notifications when app is closed
- ✅ Sync data when connectivity restored (Background Sync API)
- ✅ Cache resources for offline use

**Service Workers CANNOT:**

- ❌ Access location APIs
- ❌ Run periodic tasks based on location
- ❌ Trigger based on proximity to coordinates

### Periodic Background Sync (Experimental)

**Periodic Background Sync API** allows limited background tasks:

```javascript
// In Service Worker (experimental, Chrome only)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-location') {
    event.waitUntil(checkLocationAndNotify());
  }
});

async function checkLocationAndNotify() {
  // ⚠️ Cannot access navigator.geolocation here!
  // Can only fetch from server or use cached data
}
```

**Status:**

- Chrome: Experimental (requires flag)
- Safari: Not supported
- Firefox: Not supported

**Even with Periodic Background Sync:**

- Still cannot access location directly
- Can only fetch server-side location checks
- Requires user engagement (app opened recently)

---

## Implementation Strategy for SnapList

### Recommended Approach: Hybrid

Combine multiple approaches for best user experience:

**Phase 1: Basic Location Features (No Background)**

```
✅ Location-tagged tasks (Google Places Autocomplete)
✅ Location-based filtering (show nearby tasks)
✅ Manual "Check Nearby" button
✅ In-app alerts when near location (foreground only)
```

**Phase 2: Push Notifications (Optional Background)**

```
⚠️ Server-side geofence checking (Cloud Function)
⚠️ Push notifications when near tasks
⚠️ Requires user to open app occasionally
```

**Phase 3: Native App (Full Geofencing)**

```
✅ True background geofencing (React Native)
✅ Always-on location monitoring
✅ Instant notifications when entering region
```

### Cost-Benefit Analysis

| Approach                   | Implementation Time | Monthly Cost | User Experience  | Battery Impact |
| -------------------------- | ------------------- | ------------ | ---------------- | -------------- |
| **Foreground Only**        | 4-6 hours           | $0           | ⚠️ Good (manual) | ✅ Low         |
| **Server-Side Geofencing** | 2-3 days            | $5-10        | ⚠️ OK (delayed)  | ⚠️ Medium      |
| **Native App**             | 2-4 weeks           | $0-99/year   | ✅ Excellent     | ⚠️ Medium      |

---

## Privacy and Battery Considerations

### Privacy Best Practices

1. **Ask for Permission Explicitly**

   ```javascript
   const requestLocationPermission = async () => {
     // Show explanation first
     const userConfirmed = confirm(
       'SnapList needs location access to show tasks near you. Your location is only used on your device and is not shared.'
     );

     if (userConfirmed) {
       const permission = await navigator.permissions.query({ name: 'geolocation' });
       // ... handle permission
     }
   };
   ```

2. **Store Location Locally When Possible**

   ```javascript
   // Use localStorage instead of Firestore for current location
   localStorage.setItem('lastLocation', JSON.stringify(location));
   ```

3. **Give User Control**

   ```javascript
   // Settings page
   const [shareLocation, setShareLocation] = useState(false);

   if (shareLocation) {
     // Sync location to server for geofencing
   } else {
     // Keep location local only
   }
   ```

4. **Be Transparent**

   ```
   "We use your location to:
   - Show tasks near you
   - Remind you when you're near a task location

   Your location is:
   - Only checked when you open the app
   - Stored on your device
   - Never shared with third parties"
   ```

### Battery Optimization

**Bad (Battery Drain):**

```javascript
// Continuous high-accuracy polling
setInterval(() => {
  navigator.geolocation.getCurrentPosition((pos) => syncLocation(pos), null, {
    enableHighAccuracy: true,
    maximumAge: 0,
  });
}, 10000); // Every 10 seconds
```

**Good (Battery Efficient):**

```javascript
// Infrequent low-accuracy polling
setInterval(() => {
  navigator.geolocation.getCurrentPosition((pos) => updateLocation(pos), null, {
    enableHighAccuracy: false, // Use GPS only if WiFi/cell unavailable
    maximumAge: 300000, // Accept 5-minute-old location
    timeout: 10000, // Don't wait forever
  });
}, 300000); // Every 5 minutes
```

**Best (User-Triggered):**

```javascript
// Only get location when user clicks button
<button onClick={updateCurrentLocation}>Check Nearby Tasks</button>
```

---

## Alternative Approaches

### Option 1: Time-Based Reminders Instead of Location

**If geofencing is too complex, use time-based reminders:**

```javascript
// Instead of "Notify when I'm at Trader Joe's"
// Use "Remind me at 5pm (when I usually go to Trader Joe's)"

const reminder = {
  taskId: task.id,
  time: '17:00',
  days: ['Monday', 'Wednesday', 'Friday'],
  enabled: true,
};
```

### Option 2: Integration with Google Maps

**Add "Open in Maps" button:**

```javascript
function OpenInMapsButton({ location }) {
  const openInMaps = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;
    window.open(url, '_blank');
  };

  return (
    <button onClick={openInMaps} className="...">
      <Navigation size={16} />
      Get Directions
    </button>
  );
}
```

### Option 3: Calendar Integration

**Create calendar events with location:**

```javascript
function AddToCalendarButton({ task }) {
  const addToCalendar = () => {
    const event = {
      title: task.title,
      location: task.location.name,
      start: task.dueDate,
      end: new Date(new Date(task.dueDate).getTime() + 3600000), // +1 hour
    };

    // Generate ICS file
    const ics = generateICS(event);
    downloadFile(ics, 'task.ics');
  };

  return <button onClick={addToCalendar}>Add to Calendar</button>;
}
```

---

## Native App Migration Path

### When to Consider Native App

**Indicators you need a native app:**

- ✅ Users want true background geofencing
- ✅ Location-based features are core to app value
- ✅ Users willing to install native app (vs. PWA)
- ✅ Have budget for native development

### React Native Migration

**File:** `package.json`

```json
{
  "name": "snaplist-native",
  "dependencies": {
    "react-native": "^0.73.0",
    "react-native-geolocation-service": "^5.3.1",
    "react-native-push-notification": "^8.1.1",
    "@react-native-firebase/app": "^18.7.3",
    "@react-native-firebase/firestore": "^18.7.3"
  }
}
```

**Geofencing with React Native:**

```javascript
import Geolocation from 'react-native-geolocation-service';
import PushNotification from 'react-native-push-notification';

// Register geofence
Geolocation.watchPosition(
  (position) => {
    const { latitude, longitude } = position.coords;

    // Check against task locations
    tasks.forEach((task) => {
      if (!task.location) return;

      const distance = calculateDistance(
        latitude,
        longitude,
        task.location.latitude,
        task.location.longitude
      );

      if (distance <= task.location.radius) {
        // Trigger local notification
        PushNotification.localNotification({
          title: `📍 You're near: ${task.title}`,
          message: `${task.location.name} is nearby`,
          data: { taskId: task.id },
        });
      }
    });
  },
  (error) => console.error(error),
  {
    enableHighAccuracy: false,
    distanceFilter: 100, // Only update if moved 100m
    interval: 60000, // Check every minute
    fastestInterval: 30000, // But no faster than 30s
  }
);
```

**Cost:**

- Development: $5-10k (if hiring) or 2-4 weeks (if DIY)
- App Store fees: $99/year (iOS) + $25 one-time (Android)
- Maintenance: Ongoing

---

## Recommended Implementation for SnapList

### Phase 1: MVP (This Month)

**Features:**

- ✅ Location-tagged tasks (Google Places API)
- ✅ Location-based filtering ("Near Me" filter)
- ✅ Manual "Check Nearby" button
- ✅ Show distance on task cards

**Implementation:**

- 6-8 hours development time
- $0 cost (Google Places API free tier: 28,000 requests/month)
- Foreground only (no background)

### Phase 2: Enhanced (Month 2-3)

**Features:**

- ✅ In-app alerts when near tasks (foreground)
- ✅ "Open in Maps" integration
- ✅ Location history (visited locations)

**Implementation:**

- 4-6 hours additional development
- $0 cost
- Still foreground only

### Phase 3: Background (Month 3-6, Optional)

**Features:**

- ⚠️ Server-side geofence checking
- ⚠️ Push notifications when near tasks
- ⚠️ Requires user to open app daily

**Implementation:**

- 2-3 days development (Cloud Functions, FCM setup)
- $5-10/month cost (Cloud Functions + FCM)
- Limited background functionality

### Phase 4: Native App (Month 6+, If Needed)

**Features:**

- ✅ True background geofencing
- ✅ Always-on location monitoring
- ✅ Native OS integration

**Implementation:**

- 2-4 weeks development (React Native)
- $99/year (iOS App Store)
- Full background functionality

---

## Appendix: Code Examples

### Complete Location Utility Functions

**File:** `src/utils/location.js`

```javascript
/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Format distance for display
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance (e.g., "500 m" or "1.5 km")
 */
export function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Request location permission and get current position
 * @returns {Promise<GeolocationPosition>}
 */
export async function getCurrentLocation() {
  if (!navigator.geolocation) {
    throw new Error('Geolocation not supported');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000, // 5 minutes
    });
  });
}

/**
 * Check if location permission is granted
 * @returns {Promise<'granted'|'denied'|'prompt'>}
 */
export async function checkLocationPermission() {
  if (!navigator.permissions) return 'prompt';

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    return result.state;
  } catch {
    return 'prompt';
  }
}
```

---

**Document Version:** 1.0
**Last Updated:** January 4, 2026
**Status:** Complete - Ready for Implementation
