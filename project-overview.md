# **SnapList AI: Project Overview & Implementation**

SnapList AI is a productivity-focused Progressive Web App (PWA) designed for "zero-friction" task capture. It combines the immediacy of voice input with the organizational power of Large Language Models (LLMs) to categorize and prioritize tasks automatically.

## **1\. Core Philosophy**

The app is built on the principle of **Fast Capture**. Users often have ideas or to-dos while on the move; SnapList removes the cognitive load of deciding which list an item belongs to by delegating that logic to an AI agent.

## **2\. Key Features**

### **🎙️ AI Voice Capture**

- **Technology:** Uses the native browser **Web Speech API**.
- **Implementation:** A one-shot recording system that listens for a final transcript and immediately passes it to the AI brain.
- **Benefit:** Hands-free operation, perfect for mobile users.

### **🧠 Intelligent Categorization**

- **Engine:** Powered by **Gemini 2.5 Flash**.
- **Logic:** The AI extracts the task title, interprets relative dates (e.g., "tomorrow at 10am"), assigns an urgency level, and matches the task to the most relevant user-defined category.
- **Suggestion System:** If no category fits, the AI suggests a new one, which the user can "Accept" into their master list with a single tap.

### **🗂️ Dynamic Category Management**

- **Customization:** Users can manage their own categories, including names and detailed descriptions.
- **Contextual Learning:** Category descriptions are fed into the LLM's prompt, allowing the AI to learn the user's specific organizational style (e.g., what constitutes "Work" vs. "Personal").
- **Visuals:** Categories use a dynamic HSL color system that ensures accessibility and high contrast in both Light and Dark modes.

### **🔍 Smart Filtering & Sorting**

- **Mobile-First UI:** Uses a horizontal "Chip" system for quick filtering by date (Today, Week, Month) or category.
- **Focus Mode:** Completed tasks are hidden by default to maintain a clean "Active" view.
- **Sorting:** Flexible sorting options including Due Date, Urgency, Category, and Newest.

### **🌓 Adaptive Theming**

- **Logic:** Follows system preferences by default but allows for a manual toggle.
- **Storage:** Theme preferences are persisted in localStorage.

## **3\. Technical Architecture**

### **Frontend**

- **Framework:** React.
- **Styling:** Tailwind CSS with a mobile-first responsive design.
- **Icons:** Lucide-React.

### **Backend (Firebase)**

- **Authentication:** Firebase Anonymous Auth, ensuring every user has a private, siloed data experience without a forced sign-up flow.
- **Database:** Cloud Firestore.
  - /users/{userId}/tasks: Stores individual to-do items, metadata, and AI-generated notes.
  - /users/{userId}/categories: Stores custom categories, descriptions, and color hues.
- **Real-time Sync:** Uses onSnapshot for instant updates across devices or browser tabs.

### **AI Integration**

- **Model:** gemini-2.5-flash-preview-09-2025.
- **Interface:** Non-streaming JSON response mode for structured data extraction.

## **4\. Current Data Schema**

### **Task Object**

{
"title": "Clean the garage",
"category": "Home",
"urgency": "Medium",
"dueDate": "2024-10-25T14:00:00Z",
"notes": "Specifically the north wall shelves",
"completed": false,
"isNewCategory": false,
"createdAt": "Timestamp"
}

### **Category Object**

{
"name": "Home",
"description": "Chores and household maintenance",
"hue": 140,
"createdAt": "Timestamp"
}

## **5\. Roadmap & Future Improvements**

- **Push Notifications:** Implementation of Firebase Cloud Messaging (FCM) and a Service Worker listener for deadline alerts.
- **Reminder Intervals:** Configurable lead-times (e.g., 10m, 1h before) stored as specific reminder timestamps.
- **Cloud Functions:** A backend trigger to monitor timestamps and push alerts to the client when the app is closed.
