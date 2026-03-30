import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db, signIn, logOut, handleFirestoreError, OperationType } from "./lib/firebase";
import { UserProfile, ForumCategory, ForumThread, WikiArticle } from "./types";
import { 
  MessageSquare, 
  Book, 
  LogOut, 
  LogIn, 
  ChevronRight, 
  Plus, 
  Search, 
  User as UserIcon,
  Clock,
  Tag,
  ArrowLeft,
  Check,
  X,
  FileText,
  Shield,
  ExternalLink,
  Menu,
  ShoppingCart,
  Compass
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { formatDistanceToNow } from "date-fns";
import { cn } from "./lib/utils";

const SAMPLE_WIKI: WikiArticle[] = [
  {
    id: "1",
    title: "Getting Started",
    content: "# Getting Started\n\nWelcome to GSMP! To begin your journey, join the server at `play.gsmp.gg`. \n\n## First Steps\n1. Read the /rules\n2. Choose a starting kit\n3. Find a place to build your base\n4. Join a community town",
    category: "General",
    isDraft: false,
    lastUpdatedBy: "Admin",
    updatedAt: Timestamp.now()
  },
  {
    id: "2",
    title: "Server Rules",
    content: "# Server Rules\n\n1. No griefing or stealing.\n2. No hacking or cheating clients.\n3. Respect all players.\n4. No spamming in chat.\n5. Have fun!",
    category: "General",
    isDraft: false,
    lastUpdatedBy: "Admin",
    updatedAt: Timestamp.now()
  },
  {
    id: "3",
    title: "Game Modes",
    content: "# Game Modes\n\nWe offer several ways to play:\n\n- **Survival**: Classic Minecraft experience with community features.\n- **Creative**: Build to your heart's content in a dedicated world.\n- **Minigames**: Competitive fun with friends.",
    category: "Gameplay",
    isDraft: false,
    lastUpdatedBy: "Admin",
    updatedAt: Timestamp.now()
  },
  {
    id: "4",
    title: "Commands",
    content: "# Essential Commands\n\n- `/spawn`: Return to the main hub.\n- `/home`: Teleport to your set home.\n- `/sethome`: Save your current location as home.\n- `/tpa <player>`: Request to teleport to a friend.",
    category: "Gameplay",
    isDraft: false,
    lastUpdatedBy: "Admin",
    updatedAt: Timestamp.now()
  },
  {
    id: "5",
    title: "FAQ",
    content: "# Frequently Asked Questions\n\n**Q: How do I claim land?**\n*A: Use a golden shovel to select corners of your claim.*\n\n**Q: Can I play on Bedrock?**\n*A: Yes! Use port 19132.*",
    category: "Support",
    isDraft: false,
    lastUpdatedBy: "Admin",
    updatedAt: Timestamp.now()
  },
  {
    id: "6",
    title: "How to Contribute",
    content: "# Contributing to the Wiki\n\nWe love community contributions! To suggest a new page or edit an existing one, use the 'Submit Draft' button. Our staff will review your submission within 48 hours.",
    category: "Community",
    isDraft: false,
    lastUpdatedBy: "Admin",
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
  const [selectedWiki, setSelectedWiki] = useState<string | null>(null);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [wikiArticles, setWikiArticles] = useState<WikiArticle[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftCategory, setDraftCategory] = useState("General");

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
    if (!isAuthReady) return;
    const q = query(collection(db, "wikiArticles"), orderBy("updatedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WikiArticle));
      setWikiArticles(articles.length > 0 ? articles : SAMPLE_WIKI);
    }, (error) => handleFirestoreError(error, OperationType.GET, "wikiArticles"));
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

  const submitDraft = async () => {
    if (!user || !profile) return;
    try {
      await addDoc(collection(db, "wikiArticles"), {
        title: draftTitle,
        content: draftContent,
        category: draftCategory,
        isDraft: true,
        authorUid: user.uid,
        lastUpdatedBy: profile.displayName,
        updatedAt: serverTimestamp()
      });
      setIsDrafting(false);
      setDraftTitle("");
      setDraftContent("");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "wikiArticles");
    }
  };

  const approveDraft = async (article: WikiArticle) => {
    if (profile?.role !== 'admin') return;
    try {
      await updateDoc(doc(db, "wikiArticles", article.id), {
        isDraft: false,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "wikiArticles");
    }
  };

  const deleteArticle = async (id: string) => {
    if (profile?.role !== 'admin') return;
    try {
      await deleteDoc(doc(db, "wikiArticles", id));
      if (selectedWiki === id) setSelectedWiki(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "wikiArticles");
    }
  };

  const renderHome = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto py-8 px-4 space-y-4"
    >
      {!user && (
        <button 
          onClick={handleSignIn}
          className="w-full gsmp-card-gold p-6 flex items-center justify-between group relative overflow-hidden h-44"
        >
          <div className="absolute left-4 bottom-0 w-32 h-32 opacity-90">
            <img 
              src="https://mc-heads.net/body/steve/right" 
              alt="Steve" 
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex-1 text-right z-10">
            <div className="flex items-center justify-end gap-2 text-[#4a3b1a] font-black text-2xl uppercase tracking-tighter mb-1">
              <LogIn className="w-6 h-6" /> LOGIN
            </div>
            <p className="text-[#6b562a] font-bold text-sm leading-tight">
              Login to start<br />shopping
            </p>
          </div>
        </button>
      )}

      <button 
        onClick={() => setView("forum")}
        className="w-full gsmp-card-dark p-6 flex items-center justify-between group h-44 relative"
      >
        <div className="flex-1 text-left z-10">
          <div className="flex items-center gap-2 text-white font-black text-2xl uppercase tracking-tighter mb-1">
            <MessageSquare className="w-6 h-6" /> FORUM
          </div>
          <p className="text-[#888] font-bold text-sm leading-tight">
            Join the community<br />discussions
          </p>
        </div>
        <div className="absolute right-4 bottom-0 w-32 h-32 opacity-90">
          <img 
            src="https://mc-heads.net/body/MHF_Villager/left" 
            alt="Villager" 
            className="w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
      </button>

      <button 
        onClick={() => setView("wiki")}
        className="w-full gsmp-card-dark p-8 text-center group"
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 bg-[#222] rounded-full flex items-center justify-center mb-2 border border-[#333] group-hover:border-[#38e038]/30 transition-colors">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-white font-black text-2xl uppercase tracking-tighter">WIKI MENU</h3>
          <div className="flex items-center gap-4 w-full justify-center">
            <div className="h-[1px] bg-[#333] flex-1" />
            <span className="text-[#555] font-black text-xs tracking-[0.2em]">CLICK HERE</span>
            <div className="h-[1px] bg-[#333] flex-1" />
          </div>
        </div>
      </button>

      <div className="gsmp-card-dark p-8 text-center">
        <h4 className="text-white font-black text-xl uppercase tracking-tighter mb-2">
          WELCOME TO THE OFFICIAL<br />
          <span className="text-[#38e038]">GALAXY SMP</span>
        </h4>
      </div>
    </motion.div>
  );

  const renderForum = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto py-12 px-6"
    >
      <div className="flex items-center justify-between mb-12">
        <div>
          <h2 className="font-display text-4xl font-black text-white uppercase italic flex items-center gap-4">
            <MessageSquare className="w-10 h-10 text-[#38e038]" />
            Forum
          </h2>
          <p className="text-[#b0b0b0] mt-2 text-lg">The hub for community discussions</p>
        </div>
        {selectedCategory && (
          <button 
            onClick={() => setSelectedCategory(null)}
            className="gsmp-button-secondary py-2 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
      </div>

      {!selectedCategory ? (
        <div className="grid gap-6">
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="gsmp-card p-8 flex items-center gap-8 text-left group"
            >
              <div className="w-16 h-16 bg-[#222] rounded-xl flex items-center justify-center border border-[#333] group-hover:border-[#38e038]/30 transition-colors">
                <MessageSquare className="w-8 h-8 text-[#38e038]" />
              </div>
              <div className="flex-1">
                <h4 className="font-display text-2xl font-black text-white uppercase italic mb-1">{cat.name}</h4>
                <p className="text-[#b0b0b0]">{cat.description}</p>
              </div>
              <ChevronRight className="w-6 h-6 text-[#333] group-hover:text-[#38e038]" />
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-2xl font-black text-white uppercase italic">Latest Threads</h3>
            {user && (
              <button className="gsmp-button-primary py-2 px-4 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                New Thread
              </button>
            )}
          </div>
          {threads.length === 0 ? (
            <div className="gsmp-card p-20 text-center">
              <p className="text-[#555] italic text-xl">No threads found in this category.</p>
            </div>
          ) : (
            threads.map(thread => (
              <div key={thread.id} className="gsmp-card p-6 flex items-center justify-between group cursor-pointer">
                <div>
                  <h4 className="text-xl font-bold text-white mb-2 group-hover:text-[#38e038] transition-colors">{thread.title}</h4>
                  <div className="flex items-center gap-6 text-sm text-[#555]">
                    <span className="flex items-center gap-2"><UserIcon className="w-4 h-4" /> {thread.authorName}</span>
                    <span className="flex items-center gap-2"><Clock className="w-4 h-4" /> {formatDistanceToNow(thread.createdAt.toDate())} ago</span>
                    <span className="flex items-center gap-2 font-bold text-[#38e038]"><MessageSquare className="w-4 h-4" /> {thread.postCount} posts</span>
                  </div>
                </div>
                <ChevronRight className="w-6 h-6 text-[#333] group-hover:text-[#38e038]" />
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
      className="max-w-7xl mx-auto py-12 px-6 flex gap-10"
    >
      <aside className="w-72 flex-shrink-0">
        <div className="mb-10">
          <h2 className="font-display text-4xl font-black text-white uppercase italic flex items-center gap-4 mb-8">
            <Book className="w-10 h-10 text-[#38e038]" />
            Wiki
          </h2>
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#555]" />
            <input 
              type="text" 
              placeholder="Search articles..."
              className="w-full bg-[#151515] border border-[#252525] rounded-xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-[#38e038] transition-colors"
            />
          </div>
          {user && (
            <button 
              onClick={() => setIsDrafting(true)}
              className="w-full gsmp-button-secondary py-2 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Submit Draft
            </button>
          )}
        </div>

        <nav className="space-y-6">
          {Array.from(new Set(wikiArticles.filter(a => !a.isDraft).map(a => a.category))).map(cat => (
            <div key={cat}>
              <h5 className="text-xs font-black text-[#555] uppercase tracking-[0.2em] mb-4 px-4">{cat}</h5>
              <div className="space-y-1">
                {wikiArticles.filter(a => a.category === cat && !a.isDraft).map(article => (
                  <button 
                    key={article.id}
                    onClick={() => setSelectedWiki(article.id)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold transition-all",
                      selectedWiki === article.id 
                        ? "bg-[#38e038] text-black shadow-[0_0_15px_rgba(56,224,56,0.2)]" 
                        : "text-[#b0b0b0] hover:bg-[#151515] hover:text-white"
                    )}
                  >
                    {article.title}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {profile?.role === 'admin' && wikiArticles.some(a => a.isDraft) && (
            <div className="mt-10 pt-10 border-t border-[#222]">
              <h5 className="text-xs font-black text-yellow-500 uppercase tracking-[0.2em] mb-4 px-4">Pending Review</h5>
              <div className="space-y-1">
                {wikiArticles.filter(a => a.isDraft).map(article => (
                  <button 
                    key={article.id}
                    onClick={() => setSelectedWiki(article.id)}
                    className={cn(
                      "w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-between",
                      selectedWiki === article.id 
                        ? "bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.2)]" 
                        : "text-[#b0b0b0] hover:bg-[#151515] hover:text-white"
                    )}
                  >
                    <span className="truncate">{article.title}</span>
                    <FileText className="w-4 h-4 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>
      </aside>

      <main className="flex-1 gsmp-card p-12 min-h-[700px] relative">
        {isDrafting ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-10">
              <h3 className="font-display text-3xl font-black text-white uppercase italic">Create Wiki Draft</h3>
              <button onClick={() => setIsDrafting(false)} className="text-[#555] hover:text-white transition-colors"><X className="w-8 h-8" /></button>
            </div>
            <div className="space-y-6 flex-1 flex flex-col">
              <div className="space-y-2">
                <label className="text-xs font-black text-[#555] uppercase tracking-widest">Article Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Advanced Redstone Logic"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#252525] rounded-xl p-4 text-xl font-bold text-white focus:outline-none focus:border-[#38e038] transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-[#555] uppercase tracking-widest">Category</label>
                <select 
                  value={draftCategory}
                  onChange={(e) => setDraftCategory(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#252525] rounded-xl p-4 font-bold text-white focus:outline-none focus:border-[#38e038] transition-colors"
                >
                  <option>General</option>
                  <option>Gameplay</option>
                  <option>Community</option>
                  <option>Support</option>
                </select>
              </div>
              <div className="space-y-2 flex-1 flex flex-col">
                <label className="text-xs font-black text-[#555] uppercase tracking-widest">Content (Markdown)</label>
                <textarea 
                  placeholder="Write your article content here..."
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  className="w-full flex-1 bg-[#0a0a0a] border border-[#252525] rounded-xl p-6 font-mono text-sm text-[#b0b0b0] focus:outline-none focus:border-[#38e038] transition-colors resize-none"
                />
              </div>
              <button 
                onClick={submitDraft}
                disabled={!draftTitle || !draftContent}
                className="gsmp-button-primary w-full"
              >
                Submit Draft for Review
              </button>
            </div>
          </div>
        ) : selectedWiki ? (
          <div className="prose prose-invert max-w-none">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="bg-[#38e038]/10 text-[#38e038] px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-[#38e038]/20">
                  {wikiArticles.find(a => a.id === selectedWiki)?.category}
                </div>
                {wikiArticles.find(a => a.id === selectedWiki)?.isDraft && (
                  <div className="bg-yellow-500/10 text-yellow-500 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border border-yellow-500/20">
                    Pending Review
                  </div>
                )}
              </div>
              {profile?.role === 'admin' && (
                <div className="flex items-center gap-3">
                  {wikiArticles.find(a => a.id === selectedWiki)?.isDraft && (
                    <button 
                      onClick={() => approveDraft(wikiArticles.find(a => a.id === selectedWiki)!)}
                      className="p-3 bg-[#38e038]/10 text-[#38e038] rounded-xl hover:bg-[#38e038]/20 transition-colors border border-[#38e038]/20"
                      title="Approve Draft"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    onClick={() => deleteArticle(selectedWiki)}
                    className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors border border-red-500/20"
                    title="Delete Article"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
            <ReactMarkdown>
              {wikiArticles.find(a => a.id === selectedWiki)?.content || ""}
            </ReactMarkdown>
            <div className="mt-20 pt-10 border-t border-[#222] flex items-center justify-between text-xs text-[#555] font-bold uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4" />
                Updated by {wikiArticles.find(a => a.id === selectedWiki)?.lastUpdatedBy}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {wikiArticles.find(a => a.id === selectedWiki)?.updatedAt ? formatDistanceToNow(wikiArticles.find(a => a.id === selectedWiki)!.updatedAt.toDate()) + " ago" : "Just now"}
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
            <Book className="w-32 h-32 text-white mb-6" />
            <h3 className="font-display text-3xl font-black text-white uppercase italic mb-2">Knowledge Base</h3>
            <p className="text-lg max-w-xs">Select an article from the sidebar to begin your training.</p>
          </div>
        )}
      </main>
    </motion.div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0f1014]">
      <nav className="gsmp-header">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button className="text-white hover:text-[#38e038] transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#38e038] rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(56,224,56,0.2)]">
              <div className="w-4 h-4 bg-black rounded-sm" />
            </div>
            <span className="font-display text-xl font-black text-white uppercase italic tracking-tighter">
              GALAXY <span className="text-[#38e038]">SMP</span>
            </span>
          </div>

          <button 
            onClick={user ? logOut : handleSignIn}
            className="text-white hover:text-[#38e038] transition-colors"
          >
            {user ? (
              profile?.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-8 h-8 rounded-lg border border-[#333]" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-6 h-6" />
              )
            ) : (
              <UserIcon className="w-6 h-6" />
            )}
          </button>
        </div>
      </nav>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {view === "home" && renderHome()}
          {view === "forum" && renderForum()}
          {view === "wiki" && renderWiki()}
        </AnimatePresence>
      </main>

      <footer className="mt-auto border-t border-[#1a1a1a] py-16 px-6 bg-[#080808]">
        <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12 items-center">
          <div className="text-center md:text-left">
            <div className="font-display text-2xl font-black text-white uppercase italic mb-4">GSMP Network</div>
            <p className="text-[#555] text-sm max-w-xs">The premier Minecraft community for survival and creative enthusiasts.</p>
          </div>
          <div className="flex justify-center gap-8 text-xs font-black text-[#555] uppercase tracking-[0.2em]">
            <a href="#" className="hover:text-[#38e038] transition-colors">Discord</a>
            <a href="#" className="hover:text-[#38e038] transition-colors">Store</a>
            <a href="#" className="hover:text-[#38e038] transition-colors">Rules</a>
          </div>
          <div className="text-center md:text-right">
            <p className="text-xs text-[#333] font-bold uppercase tracking-widest">© 2026 GSMP Network</p>
            <p className="text-[10px] text-[#222] mt-1 uppercase tracking-tighter">Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
