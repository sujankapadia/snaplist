# **Comprehensive Local Development Guide for SnapList AI**

This guide covers how to move SnapList from the sandbox environment to a professional local development setup using React, Vite, and Firebase.

## **1\. Project Initialization**

Open your terminal and run the following commands to create a new React project using Vite:

npm create vite@latest snaplist \-- \--template react  
cd snaplist  
npm install

## **2\. Install Dependencies**

Install the Firebase SDK and the necessary UI/icon libraries:

npm install firebase lucide-react

## **3\. Firebase Console Setup**

1. Go to the [Firebase Console](https://console.firebase.google.com/).  
2. Create a new project named **"SnapList"**.  
3. Add a **Web App** to the project to retrieve your firebaseConfig object.  
4. **Enable Services:**  
   * **Authentication:** Enable the **Anonymous** provider.  
   * **Firestore Database:** Create a database. Start in "Production" or "Test" mode.  
5. **Security Rules:** In the Firestore tab, update your rules to ensure users can only access their own data:  
   rules\_version \= '2';  
   service cloud.firestore {  
     match /databases/{database}/documents {  
       match /users/{userId}/{anyUserPath=\*\*} {  
         allow read, write: if request.auth \!= null && request.auth.uid \== userId;  
       }  
     }  
   }

## **4\. Environment Variables**

Create a file named .env in your project root. This keeps your API keys out of your source code. Replace the placeholders with your actual credentials:

VITE\_FIREBASE\_API\_KEY=your\_api\_key  
VITE\_FIREBASE\_AUTH\_DOMAIN=your\_project.firebaseapp.com  
VITE\_FIREBASE\_PROJECT\_ID=your\_project\_id  
VITE\_FIREBASE\_STORAGE\_BUCKET=your\_project.appspot.com  
VITE\_FIREBASE\_MESSAGING\_SENDER\_ID=your\_sender\_id  
VITE\_FIREBASE\_APP\_ID=your\_app\_id  
VITE\_GEMINI\_API\_KEY=your\_google\_ai\_studio\_key

## **5\. Refactoring App.jsx**

In your local project, update the initialization logic at the top of App.jsx to use these environment variables.

### **Initialization Logic**

import { initializeApp } from 'firebase/app';  
import { getAuth } from 'firebase/auth';  
import { getFirestore } from 'firebase/firestore';

const firebaseConfig \= {  
  apiKey: import.meta.env.VITE\_FIREBASE\_API\_KEY,  
  authDomain: import.meta.env.VITE\_FIREBASE\_AUTH\_DOMAIN,  
  projectId: import.meta.env.VITE\_FIREBASE\_PROJECT\_ID,  
  storageBucket: import.meta.env.VITE\_FIREBASE\_STORAGE\_BUCKET,  
  messagingSenderId: import.meta.env.VITE\_FIREBASE\_MESSAGING\_SENDER\_ID,  
  appId: import.meta.env.VITE\_FIREBASE\_APP\_ID  
};

const app \= initializeApp(firebaseConfig);  
const auth \= getAuth(app);  
const db \= getFirestore(app);  
const GEMINI\_API\_KEY \= import.meta.env.VITE\_GEMINI\_API\_KEY;

### **Simplified Firestore Paths**

Locally, you should simplify your Firestore paths. Replace the sandbox paths:  
collection(db, 'artifacts', appId, 'users', user.uid, 'tasks')  
With standard paths:  
collection(db, 'users', user.uid, 'tasks')

## **6\. Key Considerations for Local Development**

### **Tailwind CSS Setup**

The sandbox environment handles Tailwind automatically. Locally, you must install and configure it:

1. Install: npm install \-D tailwindcss postcss autoprefixer  
2. Initialize: npx tailwindcss init \-p  
3. Configure tailwind.config.js to include your React files:  
   content: \["./index.html", "./src/\*\*/\*.{js,ts,jsx,tsx}"\],

4. Add the @tailwind directives to your main index.css.

### **Gemini API Key**

To use the AI features locally, you need an API key from [Google AI Studio](https://aistudio.google.com/). The gemini-2.5-flash model currently offers a generous free tier for development.

### **PWA and Service Workers**

To make the app installable and support offline features:

1. Install the Vite PWA plugin: npm install vite-plugin-pwa \-D.  
2. Add it to your vite.config.js.  
3. This will generate the necessary manifest.json and service worker required for "Add to Home Screen" functionality on iOS and Android.

### **Testing Voice on Localhost**

Most browsers require **HTTPS** to use the Web Speech API (SpeechRecognition).

* During development, localhost is usually treated as a "secure context."  
* To test on a physical phone over your local Wi-Fi, you may need to use a tool like **ngrok** or configure Vite to serve over HTTPS.

## **7\. Running the Project**

Start your local development server:

npm run dev  
