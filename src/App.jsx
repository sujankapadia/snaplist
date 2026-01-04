import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  Mic,
  MicOff,
  Plus,
  CheckCircle,
  Circle,
  Trash2,
  Clock,
  Tag,
  AlertTriangle,
  Send,
  Loader2,
  X,
  ChevronRight,
  Calendar,
  FileText,
  Sun,
  Moon,
  Settings,
  Sparkles,
  Check,
  Search,
  Filter,
  ArrowUpDown,
  Paperclip,
  Image as ImageIcon,
  ExternalLink,
  LogOut,
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// Initialize App Check (protection against abuse)
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
if (recaptchaSiteKey && recaptchaSiteKey !== 'your_recaptcha_site_key_here') {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
  console.log('✅ Firebase App Check initialized');
} else {
  console.warn('⚠️ App Check not initialized - missing reCAPTCHA site key in .env');
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// --- Helpers ---
const generateCategoryHue = () => {
  const hues = [210, 260, 140, 0, 45, 190, 320, 20, 170];
  return hues[Math.floor(Math.random() * hues.length)];
};

const URGENCY_LEVELS = { High: 3, Medium: 2, Low: 1 };
const URGENCY_COLORS = {
  High: 'text-red-500 dark:text-red-400',
  Medium: 'text-orange-500 dark:text-orange-400',
  Low: 'text-gray-400 dark:text-gray-500',
};

const SEED_CATEGORIES = [
  { name: 'Work', description: 'Professional tasks, meetings, and projects.' },
  { name: 'Groceries', description: 'Food, household supplies, and shopping lists.' },
  { name: 'Medical', description: 'Doctor appointments, prescriptions, and health tracking.' },
  { name: 'Fitness', description: 'Workouts, gym, and physical activities.' },
  { name: 'Bills', description: 'Utility payments, subscriptions, and recurring costs.' },
  { name: 'Finance', description: 'Banking, investments, and budget planning.' },
  { name: 'Auto', description: 'Car maintenance, fuel, and vehicle related tasks.' },
  { name: 'Home', description: 'Chores, repairs, and household management.' },
];

export default function App() {
  // --- State ---
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [sortMethod, setSortMethod] = useState('dueDate');

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('snaplist-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const recognitionRef = useRef(null);
  const [speechSupported, setSpeechSupported] = useState(false);

  // --- Speech Detection Effect ---
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  // --- Theme Effect ---
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('snaplist-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('snaplist-theme', 'light');
    }
  }, [isDarkMode]);

  // --- Auth Setup ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account', // Always show account picker
    });
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
      toast.error('Failed to sign in. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setEditingTask(null);
      setShowCategoryManager(false);
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Failed to sign out. Please try again.');
    }
  };

  // --- Firestore Listeners ---
  useEffect(() => {
    if (!user) return;

    const catQuery = query(collection(db, 'users', user.uid, 'categories'));
    const unsubCats = onSnapshot(catQuery, async (snapshot) => {
      if (snapshot.empty) {
        const batch = writeBatch(db);
        SEED_CATEGORIES.forEach((cat) => {
          const hue = generateCategoryHue();
          const docRef = doc(collection(db, 'users', user.uid, 'categories'));
          batch.set(docRef, { ...cat, hue, createdAt: serverTimestamp() });
        });
        await batch.commit();
      } else {
        setCategories(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    });

    const taskQuery = query(collection(db, 'users', user.uid, 'tasks'));
    const unsubTasks = onSnapshot(taskQuery, (snapshot) => {
      setTasks(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubCats();
      unsubTasks();
    };
  }, [user]);

  // --- Filtering & Sorting Logic ---
  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks];
    if (statusFilter === 'active') result = result.filter((t) => !t.completed);
    else result = result.filter((t) => t.completed);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || (t.notes && t.notes.toLowerCase().includes(q))
      );
    }
    if (categoryFilter) result = result.filter((t) => t.category === categoryFilter);
    if (dateFilter !== 'all') {
      const now = new Date();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      result = result.filter((t) => {
        if (!t.dueDate) return false;
        const taskDate = new Date(t.dueDate);
        if (dateFilter === 'today') return taskDate <= endOfDay;
        if (dateFilter === 'week') {
          const nextWeek = new Date();
          nextWeek.setDate(now.getDate() + 7);
          return taskDate <= nextWeek;
        }
        if (dateFilter === 'month') {
          const nextMonth = new Date();
          nextMonth.setMonth(now.getMonth() + 1);
          return taskDate <= nextMonth;
        }
        return true;
      });
    }

    result.sort((a, b) => {
      if (sortMethod === 'newest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      if (sortMethod === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      if (sortMethod === 'urgency')
        return (URGENCY_LEVELS[b.urgency] || 0) - (URGENCY_LEVELS[a.urgency] || 0);
      if (sortMethod === 'category') return a.category.localeCompare(b.category);
      return 0;
    });
    return result;
  }, [tasks, searchQuery, dateFilter, categoryFilter, statusFilter, sortMethod]);

  // --- AI Logic ---
  const processWithAI = async (text) => {
    if (!text || text.trim().length < 2) return;
    setIsProcessing(true);
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const nowFull = new Date().toString();
    const categoryContext = categories
      .map((c) => `- ${c.name}: ${c.description || 'No description'}`)
      .join('\n');

    const systemPrompt = `Analyze task: "${text}". Time Context: ${nowFull}. Categories:\n${categoryContext}\nInstructions: 1. Match category. 2. Set urgency to EXACTLY one of: "High", "Medium", or "Low" (string values only). 3. Default time 9AM local if not specified. Return JSON only: {title: string, category: string, isNewCategory: boolean, urgency: "High"|"Medium"|"Low", dueDate: string (UTC ISO), notes: string}.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      );
      const data = await response.json();
      const result = JSON.parse(data.candidates[0].content.parts[0].text);
      await addDoc(collection(db, 'users', user.uid, 'tasks'), {
        ...result,
        completed: false,
        createdAt: serverTimestamp(),
        attachments: [],
      });
      setInputText('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to process task with AI. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Attachment Handlers ---
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingTask) return;

    setUploadingFile(true);
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storagePath = `users/${user.uid}/tasks/${editingTask.id}/attachments/${fileName}`;
    const storageRef = ref(storage, storagePath);

    try {
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        null,
        (error) => {
          console.error('Upload Error:', error);
          toast.error('Failed to upload file. Please try again.');
          setUploadingFile(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const attachmentObj = {
            id: crypto.randomUUID(),
            name: file.name,
            type: file.type,
            url: downloadURL,
            storagePath,
            createdAt: new Date().toISOString(),
          };

          const taskRef = doc(db, 'users', user.uid, 'tasks', editingTask.id);
          await updateDoc(taskRef, {
            attachments: arrayUnion(attachmentObj),
          });

          // Update local modal state
          setEditingTask((prev) => ({
            ...prev,
            attachments: [...(prev.attachments || []), attachmentObj],
          }));
          setUploadingFile(false);
        }
      );
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload file. Please try again.');
      setUploadingFile(false);
    }
  };

  const removeAttachment = async (attachment) => {
    if (!editingTask) return;

    try {
      // 1. Delete from Storage
      const storageRef = ref(storage, attachment.storagePath);
      await deleteObject(storageRef);

      // 2. Delete from Firestore
      const taskRef = doc(db, 'users', user.uid, 'tasks', editingTask.id);
      await updateDoc(taskRef, {
        attachments: arrayRemove(attachment),
      });

      // Update local modal state
      setEditingTask((prev) => ({
        ...prev,
        attachments: prev.attachments.filter((a) => a.id !== attachment.id),
      }));
    } catch (err) {
      console.error('Delete Error:', err);
      toast.error('Failed to delete attachment. Please try again.');
    }
  };

  // --- Speech & Handlers ---
  const toggleListening = () => {
    if (isProcessing) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onresult = (e) => {
      if (e.results[0].isFinal) processWithAI(e.results[0][0].transcript);
    };
    recognitionRef.current.start();
  };

  const getCategoryStyles = (catName) => {
    const cat = categories.find((c) => c.name === catName);
    const h = cat?.hue || 210;
    const l_bg = isDarkMode ? 20 : 92;
    const l_text = isDarkMode ? 85 : 30;
    return { backgroundColor: `hsl(${h}, 75%, ${l_bg}%)`, color: `hsl(${h}, 75%, ${l_text}%)` };
  };

  // --- Loading State View ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  // --- Login Wall (Hero Style) ---
  if (!user) {
    return (
      <div className="min-h-screen bg-indigo-600 dark:bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden transition-colors duration-500">
        {/* Decorative Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse delay-700"></div>

        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl w-full max-w-md p-8 rounded-[2.5rem] shadow-2xl z-10 text-center border border-white/20 dark:border-slate-800">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-4xl font-black mx-auto shadow-xl mb-6">
            S
          </div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white mb-2">SnapList AI</h1>
          <p className="text-slate-500 dark:text-slate-400 mb-10 leading-relaxed font-medium">
            Capture thoughts, categorize with AI, and master your day in seconds.
          </p>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95 group"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.04c1.94 0 3.51.68 4.75 1.83l3.48-3.48C18.13 1.42 15.31 0 12 0 7.31 0 3.25 2.68 1.21 6.6L4.82 9.39C5.7 6.84 8.09 5.04 12 5.04z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.85-.07-1.68-.22-2.48H12v4.69h6.48c-.28 1.48-1.11 2.73-2.38 3.58l3.69 2.87c2.16-1.99 3.4-4.92 3.4-8.66z"
              />
              <path
                fill="#FBBC05"
                d="M4.82 14.61c-.24-.71-.38-1.48-.38-2.27s.14-1.56.38-2.27L1.21 6.6C.44 8.19 0 10.01 0 12s.44 3.81 1.21 5.4l3.61-2.79z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.97-1.07 7.96-2.91l-3.69-2.87c-1.08.73-2.46 1.17-4.27 1.17-3.91 0-7.23-2.63-8.41-6.18L1.21 15.93C3.25 21.32 7.31 24 12 24z"
              />
            </svg>
            <span className="font-bold text-slate-700 dark:text-slate-100 group-hover:translate-x-1 transition-transform">
              Sign in with Google
            </span>
          </button>

          <div className="mt-8 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <span className="w-8 h-px bg-slate-200 dark:bg-slate-800"></span>
            Private & Secure
            <span className="w-8 h-px bg-slate-200 dark:bg-slate-800"></span>
          </div>
        </div>
      </div>
    );
  }

  // --- Main App Content ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 font-sans transition-colors duration-200">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
            S
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            SnapList
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-2 p-1 pl-1 pr-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="Profile"
                className="w-6 h-6 rounded-full"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                {user.email?.[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
              {user.displayName
                ? user.displayName.split(' ')[0]
                : user.email?.split('@')[0] || 'User'}
            </span>
          </button>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors"
          >
            {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Filter Row */}
      <div className="sticky top-[57px] z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 p-2 space-y-2">
        <div className="flex items-center gap-2 max-w-2xl mx-auto px-2">
          <div className="flex-1 flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl px-3 py-1.5 gap-2 border border-slate-200 dark:border-slate-700">
            <Search size={16} className="text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="bg-transparent border-none outline-none text-sm w-full"
            />
          </div>
          <button
            onClick={() => setShowSortMenu(true)}
            className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-transform"
          >
            <ArrowUpDown size={14} /> Sort
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-4 max-w-2xl mx-auto">
          <button
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'completed' : 'active')}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
              statusFilter === 'completed'
                ? 'bg-green-100 text-green-700 border-green-200'
                : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
            }`}
          >
            {statusFilter === 'completed' ? 'Done ✓' : 'Active'}
          </button>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 flex-shrink-0 mx-1" />
          {['all', 'today', 'week', 'month'].map((f) => (
            <button
              key={f}
              onClick={() => setDateFilter(f)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                dateFilter === f
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
            >
              {f}
            </button>
          ))}
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 flex-shrink-0 mx-1" />
          <button
            onClick={() => setCategoryFilter(null)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
              !categoryFilter
                ? 'bg-slate-800 text-white'
                : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.name)}
              style={categoryFilter === cat.name ? getCategoryStyles(cat.name) : {}}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all ${
                categoryFilter === cat.name
                  ? 'shadow-md scale-105'
                  : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <main className="max-w-2xl mx-auto p-4 space-y-3">
        {filteredAndSortedTasks.length === 0 && (
          <div className="py-20 text-center opacity-40 italic flex flex-col items-center">
            <Filter size={48} className="mb-4" />
            <p>No {statusFilter} tasks matches.</p>
          </div>
        )}
        {filteredAndSortedTasks.map((task) => (
          <div
            key={task.id}
            onClick={() => setEditingTask(task)}
            className={`group flex items-start gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all active:scale-[0.98] ${
              task.completed ? 'opacity-60 bg-slate-50 dark:bg-slate-950' : ''
            }`}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateDoc(doc(db, 'users', user.uid, 'tasks', task.id), {
                  completed: !task.completed,
                });
              }}
              className={`mt-0.5 flex-shrink-0 ${
                task.completed ? 'text-green-500' : 'text-slate-300 dark:text-slate-700'
              }`}
            >
              {task.completed ? <CheckCircle size={22} /> : <Circle size={22} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p
                  className={`font-semibold text-slate-800 dark:text-slate-100 truncate ${
                    task.completed ? 'line-through' : ''
                  }`}
                >
                  {task.title}
                </p>
                {task.isNewCategory && <Sparkles size={14} className="text-amber-500" />}
                {task.attachments?.length > 0 && <Paperclip size={12} className="text-slate-400" />}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span
                  style={getCategoryStyles(task.category)}
                  className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                >
                  {task.category}
                </span>
                {task.dueDate && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    <Clock size={10} />{' '}
                    {new Date(task.dueDate).toLocaleDateString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                )}
                <span
                  className={`text-[10px] font-bold uppercase ${
                    URGENCY_COLORS[task.urgency] || 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <AlertTriangle size={10} className="inline mr-1" />
                  {task.urgency}
                </span>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 dark:text-slate-700 mt-1" />
          </div>
        ))}
      </main>

      {/* Capture Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 dark:from-slate-950 to-transparent pointer-events-none">
        <div className="max-w-2xl mx-auto flex items-center gap-3 pointer-events-auto">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              processWithAI(inputText);
            }}
            className="flex-1 flex bg-white dark:bg-slate-900 rounded-full shadow-lg border border-slate-200 dark:border-slate-800 px-4 py-1"
          >
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? 'Listening...' : 'New task...'}
              className="flex-1 bg-transparent py-2 outline-none text-slate-800 dark:text-slate-100 text-sm pl-2"
            />
            <button type="submit" className="p-2 text-indigo-600 transition-colors">
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </form>
          {speechSupported && (
            <button
              onClick={toggleListening}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl text-white active:scale-90 transition-all ${
                isListening ? 'bg-red-500 animate-pulse' : 'bg-indigo-600 shadow-indigo-500/30'
              }`}
            >
              {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
          )}
        </div>
      </div>

      {/* Task Detail Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] animate-in slide-in-from-bottom duration-300">
            <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <h2 className="font-bold">Task Details</h2>
              <button
                onClick={() => setEditingTask(null)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto no-scrollbar">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Title
                </label>
                <input
                  className="w-full text-xl font-bold bg-transparent border-b border-slate-200 dark:border-slate-800 outline-none pb-2 text-slate-800 dark:text-white"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  onBlur={() =>
                    updateDoc(doc(db, 'users', user.uid, 'tasks', editingTask.id), {
                      title: editingTask.title,
                    })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Category
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl text-sm font-semibold outline-none ring-indigo-500/20 focus:ring-2 text-slate-800 dark:text-white"
                    value={editingTask.category}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingTask({ ...editingTask, category: val });
                      updateDoc(doc(db, 'users', user.uid, 'tasks', editingTask.id), {
                        category: val,
                        isNewCategory: false,
                      });
                    }}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Urgency
                  </label>
                  <select
                    className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl text-sm font-semibold outline-none ring-indigo-500/20 focus:ring-2 text-slate-800 dark:text-white"
                    value={editingTask.urgency}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingTask({ ...editingTask, urgency: val });
                      updateDoc(doc(db, 'users', user.uid, 'tasks', editingTask.id), {
                        urgency: val,
                      });
                    }}
                  >
                    {['High', 'Medium', 'Low'].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <Calendar size={12} /> Due Date
                </label>
                <input
                  type="datetime-local"
                  className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl text-sm font-semibold outline-none ring-indigo-500/20 focus:ring-2 text-slate-800 dark:text-white"
                  value={
                    editingTask.dueDate
                      ? new Date(editingTask.dueDate).toISOString().slice(0, 16)
                      : ''
                  }
                  onChange={(e) => {
                    const utcVal = e.target.value ? new Date(e.target.value).toISOString() : null;
                    setEditingTask({ ...editingTask, dueDate: utcVal });
                    updateDoc(doc(db, 'users', user.uid, 'tasks', editingTask.id), {
                      dueDate: utcVal,
                    });
                  }}
                />
              </div>

              {/* Attachments Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                    <Paperclip size={12} /> Attachments
                  </label>
                  <label
                    className={`cursor-pointer text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline ${
                      uploadingFile ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <Plus size={14} /> Add File
                    <input
                      type="file"
                      accept="image/*,.pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                  </label>
                </div>

                {uploadingFile && (
                  <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800 animate-pulse">
                    <Loader2 className="animate-spin text-indigo-600" size={18} />
                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wide">
                      Uploading file...
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {editingTask.attachments?.map((file) => (
                    <div
                      key={file.id}
                      className="group relative bg-slate-50 dark:bg-slate-800 rounded-xl border dark:border-slate-700 overflow-hidden shadow-sm"
                    >
                      {file.type.startsWith('image/') ? (
                        <div className="h-24 w-full bg-slate-200 dark:bg-slate-900 overflow-hidden flex items-center justify-center">
                          <img
                            src={file.url}
                            alt={file.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="h-24 w-full flex items-center justify-center text-slate-400">
                          <FileText size={32} />
                        </div>
                      )}
                      <div className="p-2 flex items-center justify-between gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm">
                        <span className="text-[10px] font-bold truncate flex-1">{file.name}</span>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300"
                          >
                            <ExternalLink size={12} />
                          </a>
                          <button
                            onClick={() => removeAttachment(file)}
                            className="p-1 hover:bg-red-50 dark:hover:bg-red-900/30 rounded text-red-500"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                  <FileText size={12} /> Notes
                </label>
                <textarea
                  className="w-full bg-slate-100 dark:bg-slate-800 p-4 rounded-xl text-sm min-h-[120px] outline-none ring-indigo-500/20 focus:ring-2 text-slate-800 dark:text-white"
                  value={editingTask.notes || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, notes: e.target.value })}
                  onBlur={() =>
                    updateDoc(doc(db, 'users', user.uid, 'tasks', editingTask.id), {
                      notes: editingTask.notes,
                    })
                  }
                  placeholder="Describe task details..."
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t dark:border-slate-800 flex gap-3">
              <button
                onClick={() => {
                  deleteDoc(doc(db, 'users', user.uid, 'tasks', editingTask.id));
                  setEditingTask(null);
                }}
                className="flex-1 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-bold text-sm transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setEditingTask(null)}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-500/30 active:scale-95 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sort Sheet */}
      {showSortMenu && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setShowSortMenu(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-3xl p-6 space-y-4 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs">
                Sort Tasks By
              </h3>
              <button onClick={() => setShowSortMenu(false)} className="text-slate-400 p-1">
                <X size={20} />
              </button>
            </div>
            {[
              { id: 'dueDate', label: 'Due Date (Earliest)', icon: Clock },
              { id: 'urgency', label: 'Urgency (Highest)', icon: AlertTriangle },
              { id: 'category', label: 'Category (A-Z)', icon: Tag },
              { id: 'newest', label: 'Newly Created', icon: Sparkles },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setSortMethod(m.id);
                  setShowSortMenu(false);
                }}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${
                  sortMethod === m.id
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-200'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <m.icon size={20} />
                <span className="font-bold">{m.label}</span>
                {sortMethod === m.id && <Check size={20} className="ml-auto" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Manager & Profile Settings */}
      {showCategoryManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-6 border-b dark:border-slate-800 flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="User"
                  className="w-12 h-12 rounded-full border-2 border-indigo-500"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold border-2 border-indigo-500">
                  {user.email?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="flex-1">
                <h2 className="font-black text-slate-800 dark:text-white">
                  {user.displayName || user.email?.split('@')[0] || 'User'}
                </h2>
                <p className="text-xs text-slate-500 font-medium">{user.email || 'No email'}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 transition-colors"
                title="Sign Out"
              >
                <LogOut size={20} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-4 no-scrollbar">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  My Categories
                </h3>
                <button
                  onClick={() =>
                    addDoc(collection(db, 'users', user.uid, 'categories'), {
                      name: 'New Category',
                      description: '',
                      hue: generateCategoryHue(),
                      createdAt: serverTimestamp(),
                    })
                  }
                  className="text-xs font-bold text-indigo-600 flex items-center gap-1"
                >
                  <Plus size={14} /> Add New
                </button>
              </div>
              <div className="space-y-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border dark:border-slate-800 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        style={getCategoryStyles(cat.name)}
                        className="px-3 py-1 rounded-full text-xs font-bold uppercase shadow-sm"
                      >
                        {cat.name}
                      </span>
                      <button
                        onClick={() => deleteDoc(doc(db, 'users', user.uid, 'categories', cat.id))}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <textarea
                      className="w-full bg-transparent text-sm text-slate-600 dark:text-slate-400 italic outline-none focus:text-slate-900 dark:focus:text-white border-none resize-none h-12"
                      placeholder="Add description to help AI match..."
                      value={cat.description || ''}
                      onChange={(e) =>
                        setCategories(
                          categories.map((c) =>
                            c.id === cat.id ? { ...c, description: e.target.value } : c
                          )
                        )
                      }
                      onBlur={(e) =>
                        updateDoc(doc(db, 'users', user.uid, 'categories', cat.id), {
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 border-t dark:border-slate-800 text-center bg-slate-50 dark:bg-slate-900/50">
              <button
                onClick={() => setShowCategoryManager(false)}
                className="px-10 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
