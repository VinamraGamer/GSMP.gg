import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { auth, db, signIn, logOut, handleFirestoreError, OperationType } from "./lib/firebase";
import { UserProfile, ForumCategory, ForumThread, WikiArticle } from "./types";
import { 
  Layout, 
  MessageSquare, 
  Book, 
  Home, 
  LogOut, 
  LogIn, 
  ChevronRight, 
  Plus, 
  Search, 
  User as UserIcon,
  Clock,
  Tag,
  ArrowLeft
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { formatDistanceToNow } from "date-fns";
import { cn } from "./lib/utils";

const SAMPLE_WIKI: WikiArticle[] = [
  {
    id: "1",
    title: "Getting Started with Survival",
    content: "# Survival Basics\n\nWelcome to the survival guide. The first thing you need to do is punch a tree.\n\n## Key Steps:\n1. Collect wood\n2. Craft a crafting table\n3. Make a wooden pickaxe\n4. Mine stone\n5. Upgrade to stone tools",
    category: "Basics",
    lastUpdatedBy: "Steve",
    updatedAt: Timestamp.now()
  },
  {
    id: "2",
    title: "Redstone Engineering",
    content: "# Redstone Guide\n\nRedstone is the electricity of Minecraft. You can use it to build complex machines.\n\n## Components:\n- **Redstone Dust**: Transmits power\n- **Redstone Torch**: Constant power source\n- **Repeater**: Extends signal and adds delay\n- **Comparator**: Compares signal strengths",
    category: "Advanced",
    lastUpdatedBy: "Alex",
    updatedAt: Timestamp.now()
  },
  {
    id: "3",
    title: "The Nether Dimension",
    content: "# The Nether\n\nA dangerous dimension filled with lava and hostile mobs. You need a portal made of obsidian to get there.\n\n## Mobs:\n- Ghasts\n- Piglins\n- Wither Skeletons\n- Blazes",
    category: "Dimensions",
    lastUpdatedBy: "NetherExplorer",
    updatedAt: Timestamp.now()
  }
];

const SAMPLE_CATEGORIES: ForumCategory[] = [
  { id: "general", name: "General Discussion", description: "Talk about anything Minecraft related.", icon: "MessageSquare", order: 1 },
  { id: "support", name: "Support & Help", description: "Need help with the server or game?", icon: "HelpCircle", order: 2 },
  { id: "showcase", name: "Build Showcase", description: "Show off your amazing creations!", icon: "Image", order: 3 }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<"home" | "forum" | "wiki">("home");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [selectedWiki, setSelectedWiki] = useState<string | null>(null);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [wikiArticles, setWikiArticles] = useState<WikiArticle[]>(SAMPLE_WIKI);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      } else {
        setProfile(null);
      }
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isAuthReady) return;
    const q = query(collection(db, "forumCategories"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumCategory));
      setCategories(cats.length > 0 ? cats : SAMPLE_CATEGORIES);
    }, (error) => handleFirestoreError(error, OperationType.GET, "forumCategories"));
    return unsubscribe;
  }, [isAuthReady]);

  useEffect(() => {
    if (!selectedCategory) {
      setThreads([]);
      return;
    }
    const q = query(collection(db, "forumThreads"), orderBy("lastPostAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allThreads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumThread));
      setThreads(allThreads.filter(t => t.categoryId === selectedCategory));
    }, (error) => handleFirestoreError(error, OperationType.GET, "forumThreads"));
    return unsubscribe;
  }, [selectedCategory]);

  const handleSignIn = async () => {
    try {
      await signIn();
    } catch (error) {
      console.error("Sign in failed", error);
    }
  };

  const renderHome = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto py-12 px-6"
    >
      <div className="text-center mb-16">
        <h1 className="text-6xl font-black tracking-tighter mb-4 text-white uppercase italic">
          Minecraft <span className="text-[#38e038]">Community</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          The ultimate hub for survivalists, builders, and redstone engineers. Join the discussion or explore the knowledge base.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <button 
          onClick={() => setView("forum")}
          className="group relative overflow-hidden bg-[#222] border border-[#333] p-8 rounded-2xl text-left transition-all hover:border-[#38e038] hover:shadow-[0_0_30px_rgba(56,224,56,0.1)]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="p-4 bg-[#38e038]/10 rounded-xl">
              <MessageSquare className="w-8 h-8 text-[#38e038]" />
            </div>
            <ChevronRight className="w-6 h-6 text-gray-600 group-hover:text-[#38e038] transition-colors" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Community Forum</h3>
          <p className="text-gray-400">Discuss strategies, share builds, and connect with other players.</p>
        </button>

        <button 
          onClick={() => setView("wiki")}
          className="group relative overflow-hidden bg-[#222] border border-[#333] p-8 rounded-2xl text-left transition-all hover:border-[#38e038] hover:shadow-[0_0_30px_rgba(56,224,56,0.1)]"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="p-4 bg-[#38e038]/10 rounded-xl">
              <Book className="w-8 h-8 text-[#38e038]" />
            </div>
            <ChevronRight className="w-6 h-6 text-gray-600 group-hover:text-[#38e038] transition-colors" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Knowledge Wiki</h3>
          <p className="text-gray-400">Everything you need to know about blocks, mobs, and mechanics.</p>
        </button>
      </div>
    </motion.div>
  );

  const renderForum = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto py-8 px-6"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <MessageSquare className="w-8 h-8 text-[#38e038]" />
            Forum
          </h2>
          <p className="text-gray-400 mt-1">Connect with the community</p>
        </div>
        {selectedCategory && (
          <button 
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Categories
          </button>
        )}
      </div>

      {!selectedCategory ? (
        <div className="grid gap-4">
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="flex items-center gap-6 bg-[#222] border border-[#333] p-6 rounded-xl text-left hover:border-[#444] transition-all"
            >
              <div className="p-3 bg-[#333] rounded-lg">
                <MessageSquare className="w-6 h-6 text-[#38e038]" />
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-white">{cat.name}</h4>
                <p className="text-gray-400 text-sm">{cat.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">Threads</h3>
            {user && (
              <button className="flex items-center gap-2 bg-[#38e038] text-black font-bold py-2 px-4 rounded-lg hover:bg-[#2dbb2d] transition-colors">
                <Plus className="w-4 h-4" />
                New Thread
              </button>
            )}
          </div>
          {threads.length === 0 ? (
            <div className="bg-[#222] border border-[#333] p-12 rounded-xl text-center">
              <p className="text-gray-500 italic">No threads yet. Be the first to start one!</p>
            </div>
          ) : (
            threads.map(thread => (
              <div key={thread.id} className="bg-[#222] border border-[#333] p-6 rounded-xl hover:border-[#444] transition-all cursor-pointer">
                <h4 className="text-lg font-bold text-white mb-2">{thread.title}</h4>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" /> {thread.authorName}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatDistanceToNow(thread.createdAt.toDate())} ago</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {thread.postCount} posts</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </motion.div>
  );

  const renderWiki = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto py-8 px-6 flex gap-8"
    >
      <aside className="w-64 flex-shrink-0">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white flex items-center gap-3 mb-6">
            <Book className="w-8 h-8 text-[#38e038]" />
            Wiki
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              placeholder="Search wiki..."
              className="w-full bg-[#222] border border-[#333] rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-[#38e038] transition-colors"
            />
          </div>
        </div>

        <nav className="space-y-1">
          {Array.from(new Set(wikiArticles.map(a => a.category))).map(cat => (
            <div key={cat} className="mb-4">
              <h5 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 px-3">{cat}</h5>
              {wikiArticles.filter(a => a.category === cat).map(article => (
                <button 
                  key={article.id}
                  onClick={() => setSelectedWiki(article.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                    selectedWiki === article.id ? "bg-[#38e038]/10 text-[#38e038]" : "text-gray-400 hover:bg-[#222] hover:text-white"
                  )}
                >
                  {article.title}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 bg-[#222] border border-[#333] rounded-2xl p-10 min-h-[600px]">
        {selectedWiki ? (
          <div className="prose prose-invert max-w-none">
            <div className="flex items-center gap-2 text-xs text-[#38e038] font-bold uppercase tracking-widest mb-4">
              <Tag className="w-3 h-3" />
              {wikiArticles.find(a => a.id === selectedWiki)?.category}
            </div>
            <ReactMarkdown>
              {wikiArticles.find(a => a.id === selectedWiki)?.content || ""}
            </ReactMarkdown>
            <div className="mt-12 pt-8 border-t border-[#333] flex items-center justify-between text-xs text-gray-500 italic">
              <span>Last updated by {wikiArticles.find(a => a.id === selectedWiki)?.lastUpdatedBy}</span>
              <span>{formatDistanceToNow(wikiArticles.find(a => a.id === selectedWiki)?.updatedAt.toDate() || new Date())} ago</span>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Book className="w-16 h-16 text-[#333] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Select an article</h3>
            <p className="text-gray-500">Choose a topic from the sidebar to start reading.</p>
          </div>
        )}
      </main>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-[#111] text-gray-200 font-sans selection:bg-[#38e038] selection:text-black">
      <nav className="sticky top-0 z-50 bg-[#111]/80 backdrop-blur-md border-bottom border-[#222]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setView("home")}
              className="text-xl font-black tracking-tighter text-white uppercase italic flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-[#38e038] rounded flex items-center justify-center">
                <div className="w-4 h-4 bg-black rounded-sm" />
              </div>
              GSMP
            </button>
            <div className="hidden md:flex items-center gap-1">
              <button 
                onClick={() => setView("home")}
                className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", view === "home" ? "text-[#38e038]" : "text-gray-400 hover:text-white")}
              >
                Home
              </button>
              <button 
                onClick={() => setView("forum")}
                className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", view === "forum" ? "text-[#38e038]" : "text-gray-400 hover:text-white")}
              >
                Forum
              </button>
              <button 
                onClick={() => setView("wiki")}
                className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", view === "wiki" ? "text-[#38e038]" : "text-gray-400 hover:text-white")}
              >
                Wiki
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-[#222] px-3 py-1.5 rounded-full border border-[#333]">
                  {profile?.photoURL ? (
                    <img src={profile.photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-white">{profile?.displayName}</span>
                  {profile?.role === 'admin' && <span className="text-[10px] bg-[#38e038] text-black px-1.5 rounded font-black uppercase">Admin</span>}
                </div>
                <button 
                  onClick={logOut}
                  className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  title="Log Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleSignIn}
                className="flex items-center gap-2 bg-white text-black font-bold py-2 px-5 rounded-full hover:bg-gray-200 transition-colors"
              >
                <LogIn className="w-4 h-4" />
                Login
              </button>
            )}
          </div>
        </div>
      </nav>

      <main>
        <AnimatePresence mode="wait">
          {view === "home" && renderHome()}
          {view === "forum" && renderForum()}
          {view === "wiki" && renderWiki()}
        </AnimatePresence>
      </main>

      <footer className="mt-24 border-t border-[#222] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <h4 className="text-white font-bold mb-2">GSMP Community</h4>
            <p className="text-sm text-gray-500">Built for the players, by the players.</p>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Rules</a>
          </div>
          <p className="text-xs text-gray-600">© 2026 GSMP Community Hub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
