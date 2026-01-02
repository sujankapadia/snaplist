import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged 
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
  writeBatch
} from 'firebase/firestore';
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
  User,
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
  SortAsc,
  ArrowUpDown
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'snap-list-ai';

// --- Helpers ---
const generateCategoryHue = () => {
  const hues = [210, 260, 140, 0, 45, 190, 320, 20, 170];
  return hues[Math.floor(Math.random() * hues.length)];
};

const URGENCY_LEVELS = { High: 3, Medium: 2, Low: 1 };
const URGENCY_COLORS = {
  High: 'text-red-500 dark:text-red-400',
  Medium: 'text-orange-500 dark:text-orange-400',
  Low: 'text-gray-400 dark:text-gray-500'
};

const SEED_CATEGORIES = [
  { name: 'Work', description: 'Professional tasks, meetings, and projects.' },
  { name: 'Groceries', description: 'Food, household supplies, and shopping lists.' },
  { name: 'Medical', description: 'Doctor appointments, prescriptions, and health tracking.' },
  { name: 'Fitness', description: 'Workouts, gym, and physical activities.' },
  { name: 'Bills', description: 'Utility payments, subscriptions, and recurring costs.' },
  { name: 'Finance', description: 'Banking, investments, and budget planning.' },
  { name: 'Auto', description: 'Car maintenance, fuel, and vehicle related tasks.' },
  { name: 'Home', description: 'Chores, repairs, and household management.' }
];

export default function App() {
  // --- State ---
  const [user, setUser] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  // Filtering & Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active'); // active, completed
  const [sortMethod, setSortMethod] = useState('dueDate'); // dueDate, urgency, category, newest

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('snaplist-theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const recognitionRef = useRef(null);

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
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { setErrorMessage("Authentication failed."); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- Firestore Listeners ---
  useEffect(() => {
    if (!user) return;

    const catQuery = query(collection(db, 'artifacts', appId, 'users', user.uid, 'categories'));
    const unsubCats = onSnapshot(catQuery, async (snapshot) => {
      if (snapshot.empty) {
        const batch = writeBatch(db);
        SEED_CATEGORIES.forEach(cat => {
          const hue = generateCategoryHue();
          const docRef = doc(collection(db, 'artifacts', appId, 'users', user.uid, 'categories'));
          batch.set(docRef, { ...cat, hue, createdAt: serverTimestamp() });
        });
        await batch.commit();
      } else {
        setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    });

    const taskQuery = query(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'));
    const unsubTasks = onSnapshot(taskQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubCats(); unsubTasks(); };
  }, [user]);

  // --- Filtering & Sorting Logic ---
  const filteredAndSortedTasks = useMemo(() => {
    let result = [...tasks];

    // 1. Filter by Completion Status (Important: Hides completed by default)
    if (statusFilter === 'active') {
      result = result.filter(t => !t.completed);
    } else {
      result = result.filter(t => t.completed);
    }

    // 2. Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    // 3. Category Filter
    if (categoryFilter) {
      result = result.filter(t => t.category === categoryFilter);
    }

    // 4. Date Range Filter
    if (dateFilter !== 'all') {
      const now = new Date();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      
      result = result.filter(t => {
        if (!t.dueDate) return false;
        const taskDate = new Date(t.dueDate);
        
        if (dateFilter === 'today') {
          return taskDate <= endOfDay;
        }
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

    // 5. Sorting
    result.sort((a, b) => {
      if (sortMethod === 'newest') {
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      }
      if (sortMethod === 'dueDate') {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      if (sortMethod === 'urgency') {
        return (URGENCY_LEVELS[b.urgency] || 0) - (URGENCY_LEVELS[a.urgency] || 0);
      }
      if (sortMethod === 'category') {
        return a.category.localeCompare(b.category);
      }
      return 0;
    });

    return result;
  }, [tasks, searchQuery, dateFilter, categoryFilter, statusFilter, sortMethod]);

  // --- AI Logic ---
  const processWithAI = async (text) => {
    if (!text || text.trim().length < 2) return;
    setIsProcessing(true);
    const apiKey = ""; 
    const now = new Date().toLocaleString();
    const categoryContext = categories.map(c => `- ${c.name}: ${c.description || 'No description'}`).join('\n');

    const systemPrompt = `Analyze task: "${text}". Use context: Time ${now}, Categories:\n${categoryContext}. Return JSON: {title, category, isNewCategory, urgency, dueDate (UTC ISO), notes}. If no match, suggest new category name.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await response.json();
      const result = JSON.parse(data.candidates[0].content.parts[0].text);
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'tasks'), { ...result, completed: false, createdAt: serverTimestamp() });
      setInputText('');
    } catch (err) { console.error(err); } 
    finally { setIsProcessing(false); }
  };

  // --- Speech & Handlers ---
  const toggleListening = () => {
    if (isProcessing) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return setErrorMessage("Speech not supported.");
    if (isListening) { recognitionRef.current?.stop(); return; }
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.onstart = () => setIsListening(true);
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onresult = (e) => { if (e.results[0].isFinal) processWithAI(e.results[0][0].transcript); };
    recognitionRef.current.start();
  };

  const getCategoryStyles = (catName) => {
    const cat = categories.find(c => c.name === catName);
    const h = cat?.hue || 210;
    const l_bg = isDarkMode ? 20 : 92;
    const l_text = isDarkMode ? 85 : 30;
    return { backgroundColor: `hsl(${h}, 75%, ${l_bg}%)`, color: `hsl(${h}, 75%, ${l_text}%)` };
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-24 font-sans transition-colors duration-200">
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">S</div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">SnapList</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowCategoryManager(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500"><Settings size={20}/></button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
        </div>
      </header>

      {/* Control Bar */}
      <div className="sticky top-[57px] z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 p-2 space-y-2 overflow-hidden">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <div className="flex-1 flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1.5 gap-2 border border-slate-200 dark:border-slate-700">
            <Search size={16} className="text-slate-400" />
            <input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="bg-transparent border-none outline-none text-sm w-full"
            />
            {searchQuery && <X size={14} className="text-slate-400" onClick={() => setSearchQuery('')} />}
          </div>
          <button 
            onClick={() => setShowSortMenu(true)}
            className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm"
          >
            <ArrowUpDown size={14} /> Sort
          </button>
        </div>

        {/* Filters Scrollable Row */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1 max-w-2xl mx-auto">
          {/* Status Group */}
          <button 
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'completed' : 'active')}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${statusFilter === 'completed' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700'}`}
          >
            {statusFilter === 'completed' ? 'Done ✓' : 'Active'}
          </button>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 flex-shrink-0 mx-1" />
          
          {/* Date Group */}
          {['all', 'today', 'week', 'month'].map(f => (
            <button 
              key={f}
              onClick={() => setDateFilter(f)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${dateFilter === f ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'}`}
            >
              {f}
            </button>
          ))}
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 flex-shrink-0 mx-1" />

          {/* Category Group */}
          <button 
            onClick={() => setCategoryFilter(null)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase border ${!categoryFilter ? 'bg-slate-800 text-white' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'}`}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setCategoryFilter(cat.name)}
              style={categoryFilter === cat.name ? getCategoryStyles(cat.name) : {}}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-black uppercase border transition-all ${categoryFilter === cat.name ? 'shadow-md scale-105' : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-slate-800'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-2xl mx-auto p-4 space-y-3">
        {filteredAndSortedTasks.length === 0 && (
          <div className="py-20 text-center opacity-40 italic flex flex-col items-center">
            <Filter size={48} className="mb-4" />
            <p>No {statusFilter} tasks found matches.</p>
          </div>
        )}
        {filteredAndSortedTasks.map((task) => (
          <div 
            key={task.id}
            onClick={() => setEditingTask(task)}
            className={`group flex items-start gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all active:scale-[0.98] ${task.completed ? 'opacity-60 bg-slate-50 dark:bg-slate-950' : ''}`}
          >
            <button 
              onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), { completed: !task.completed }); }}
              className={`mt-0.5 flex-shrink-0 ${task.completed ? 'text-green-500' : 'text-slate-300 dark:text-slate-700'}`}
            >
              {task.completed ? <CheckCircle size={22} /> : <Circle size={22} />}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={`font-semibold text-slate-800 dark:text-slate-100 truncate ${task.completed ? 'line-through' : ''}`}>
                  {task.title}
                </p>
                {task.isNewCategory && <Sparkles size={14} className="text-amber-500" />}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span 
                  style={getCategoryStyles(task.category)} 
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${!categories.find(c => c.name === task.category) ? 'border border-dashed border-slate-400 italic bg-slate-50 dark:bg-slate-800' : ''}`}
                >
                  {task.category}
                </span>
                {task.dueDate && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                    <Clock size={10} /> {new Date(task.dueDate).toLocaleDateString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}
                  </span>
                )}
                <span className={`text-[10px] font-bold uppercase ${URGENCY_COLORS[task.urgency]}`}>
                  <AlertTriangle size={10} className="inline mr-1" />{task.urgency}
                </span>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-300 dark:text-slate-700 mt-1" />
          </div>
        ))}
      </main>

      {/* Floating Capture Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 dark:from-slate-950 to-transparent pointer-events-none">
        <div className="max-w-2xl mx-auto flex items-center gap-3 pointer-events-auto">
          <form onSubmit={(e) => { e.preventDefault(); processWithAI(inputText); }} className="flex-1 flex bg-white dark:bg-slate-900 rounded-full shadow-lg border border-slate-200 dark:border-slate-800 px-4 py-1">
            <input 
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "Listening..." : "New task..."}
              className="flex-1 bg-transparent py-2 outline-none text-slate-800 dark:text-slate-100 text-sm"
            />
            <button type="submit" className="p-2 text-indigo-600">
              {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </form>
          <button onClick={toggleListening} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl text-white ${isListening ? 'bg-red-500 animate-pulse' : 'bg-indigo-600 shadow-indigo-500/30'}`}>
            {isListening ? <MicOff size={24} /> : <Mic size={24} />}
          </button>
        </div>
      </div>

      {/* Sort Menu Bottom Sheet */}
      {showSortMenu && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowSortMenu(false)}>
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-t-3xl p-6 space-y-4 animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-black text-slate-400 uppercase tracking-widest text-xs">Sort Tasks By</h3>
              <button onClick={() => setShowSortMenu(false)} className="text-slate-400 p-1"><X size={20}/></button>
            </div>
            {[
              { id: 'dueDate', label: 'Due Date (Earliest)', icon: Clock },
              { id: 'urgency', label: 'Urgency (Highest)', icon: AlertTriangle },
              { id: 'category', label: 'Category (A-Z)', icon: Tag },
              { id: 'newest', label: 'Newly Created', icon: Sparkles }
            ].map(m => (
              <button 
                key={m.id}
                onClick={() => { setSortMethod(m.id); setShowSortMenu(false); }}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all ${sortMethod === m.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                <m.icon size={20} />
                <span className="font-bold">{m.label}</span>
                {sortMethod === m.id && <Check size={20} className="ml-auto" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Detail Modal & Category Manager logic remains same (omitted for brevity but updated to use shared helpers) */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <h2 className="font-bold">Task Details</h2>
              <button onClick={() => setEditingTask(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full"><X size={20}/></button>
            </div>
            
            {editingTask.isNewCategory && (
              <div className="bg-amber-50 dark:bg-amber-900/20 p-4 border-b border-amber-100 dark:border-amber-900/30 flex items-start gap-3">
                <Sparkles className="text-amber-500 mt-1 flex-shrink-0" size={18} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    AI suggested a new category: <span className="font-bold underline">{editingTask.category}</span>
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => acceptSuggestedCategory(editingTask)} className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">
                      <Check size={14}/> Add to My Categories
                    </button>
                    <button onClick={() => setEditingTask({...editingTask, isNewCategory: false})} className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold">
                      Keep for this task only
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="p-6 space-y-5 overflow-y-auto">
              <input 
                className="w-full text-xl font-bold bg-transparent border-b border-slate-200 dark:border-slate-800 outline-none pb-2 text-slate-800 dark:text-white"
                value={editingTask.title}
                onChange={(e) => setEditingTask({...editingTask, title: e.target.value})}
                onBlur={() => updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', editingTask.id), { title: editingTask.title })}
              />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
                  <select 
                    className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl text-sm font-semibold outline-none ring-indigo-500/20 focus:ring-2 text-slate-800 dark:text-white"
                    value={editingTask.category}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingTask({...editingTask, category: val});
                      updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', editingTask.id), { category: val, isNewCategory: false });
                    }}
                  >
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    {!categories.find(c => c.name === editingTask.category) && <option value={editingTask.category}>{editingTask.category} (Suggested)</option>}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Urgency</label>
                  <select 
                    className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl text-sm font-semibold outline-none ring-indigo-500/20 focus:ring-2 text-slate-800 dark:text-white"
                    value={editingTask.urgency}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditingTask({...editingTask, urgency: val});
                      updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', editingTask.id), { urgency: val });
                    }}
                  >
                    {['High', 'Medium', 'Low'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Calendar size={12}/> Due Date</label>
                <input 
                  type="datetime-local"
                  className="w-full bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl text-sm font-semibold outline-none ring-indigo-500/20 focus:ring-2 text-slate-800 dark:text-white"
                  value={editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().slice(0, 16) : ''}
                  onChange={(e) => {
                    const utcVal = e.target.value ? new Date(e.target.value).toISOString() : null;
                    setEditingTask({...editingTask, dueDate: utcVal});
                    updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', editingTask.id), { dueDate: utcVal });
                  }}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><FileText size={12}/> Notes</label>
                <textarea 
                  className="w-full bg-slate-100 dark:bg-slate-800 p-4 rounded-xl text-sm min-h-[120px] outline-none ring-indigo-500/20 focus:ring-2 text-slate-800 dark:text-white"
                  value={editingTask.notes || ''}
                  onChange={(e) => setEditingTask({...editingTask, notes: e.target.value})}
                  onBlur={() => updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', editingTask.id), { notes: editingTask.notes })}
                  placeholder="Describe task details..."
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/80 border-t dark:border-slate-800 flex gap-3">
              <button onClick={() => { deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', editingTask.id)); setEditingTask(null); }} className="flex-1 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-bold text-sm">Delete</button>
              <button onClick={() => setEditingTask(null)} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm">Done</button>
            </div>
          </div>
        </div>
      )}

      {showCategoryManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2"><Tag size={20} className="text-indigo-600" /> My Categories</h2>
              <button onClick={() => setShowCategoryManager(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500"><X size={20}/></button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              <div className="space-y-3">
                {categories.map(cat => (
                  <div key={cat.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border dark:border-slate-800">
                    <div className="flex items-center justify-between mb-2">
                      <span style={getCategoryStyles(cat.name)} className="px-3 py-1 rounded-full text-xs font-bold uppercase">
                        {cat.name}
                      </span>
                      <button onClick={() => deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'categories', cat.id))} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                    </div>
                    <textarea 
                      className="w-full bg-transparent text-sm text-slate-600 dark:text-slate-400 italic outline-none focus:text-slate-900 dark:focus:text-white"
                      placeholder="Add description to help AI match..."
                      value={cat.description || ''}
                      onChange={(e) => setCategories(categories.map(c => c.id === cat.id ? {...c, description: e.target.value} : c))}
                      onBlur={(e) => updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'categories', cat.id), { description: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <button onClick={() => handleAddCategory("New Category", "Describe this...")} className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-600 font-bold transition-all flex items-center justify-center gap-2">
                <Plus size={18}/> Add Category
              </button>
            </div>
            <div className="p-4 border-t dark:border-slate-800 text-center">
              <button onClick={() => setShowCategoryManager(false)} className="px-8 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-lg">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}