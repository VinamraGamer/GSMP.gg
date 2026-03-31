import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db, signIn, logOut, handleFirestoreError, OperationType } from "./lib/firebase";
import { UserProfile, ForumCategory, ForumThread, WikiArticle, Player } from "./types";
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
  Compass,
  Map,
  Users,
  Info,
  AlertCircle,
  TrendingUp,
  Award,
  MapPin,
  Calendar,
  Layout,
  ChevronDown,
  ChevronUp,
  Copy,
  Share2,
  Home,
  Activity,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { formatDistanceToNow } from "date-fns";
import { cn } from "./lib/utils";

const SAMPLE_WIKI: WikiArticle[] = [
  {
    id: "1",
    title: "Galaxy SMP Rules",
    content: "# Server Rules\n\nWelcome to Galaxy SMP! To ensure a fun and fair experience for everyone, please follow these rules.\n\n## Core Rules\n1. **No Griefing**: Do not destroy or modify other players' builds without permission.\n2. **No Stealing**: Do not take items from chests that aren't yours.\n3. **No Hacking**: Using any client-side mods that give an unfair advantage (X-ray, Fly, etc.) will result in a permanent ban.\n4. **Respect Others**: Be kind and respectful in chat. No hate speech or harassment.\n\n## Land Claiming\nUse a golden shovel to protect your land. You start with 100 blocks and earn more as you play.",
    category: "Lore",
    isDraft: false,
    lastUpdatedBy: "Admin",
    updatedAt: Timestamp.now(),
    infoboxData: {
      "Type": "Official",
      "Enforced By": "Staff Team",
      "Last Revised": "March 2026"
    }
  },
  {
    id: "2",
    title: "The Great Citadel",
    content: "# The Great Citadel\n\nThe Great Citadel is the oldest player-built structure on the server. It was founded by the 'Ancient Ones' during the first week of the SMP.\n\n## History\nOriginally a small dirt hut, it evolved into a massive stone fortress over several months of collaborative building.\n\n## Features\n- **The Throne Room**: A massive hall with a gold-encrusted throne.\n- **The Vault**: A high-security area for storing rare items.\n- **The Gardens**: A peaceful area with rare flowers and trees.",
    category: "Locations",
    isDraft: false,
    lastUpdatedBy: "LoreMaster",
    updatedAt: Timestamp.now(),
    coordinates: { x: 1250, y: 72, z: -450 },
    imageUrl: "https://picsum.photos/seed/citadel/800/400",
    infoboxData: {
      "Founder": "Ancient Ones",
      "Built": "Week 1",
      "Style": "Gothic Stone",
      "Status": "Active"
    }
  },
  {
    id: "3",
    title: "Dream",
    content: "# Dream\n\nDream is one of the most active players on Galaxy SMP. Known for his incredible parkour skills and strategic gameplay.\n\n## Achievements\n- First to slay the Ender Dragon.\n- Founder of the 'Dream Team' faction.\n- Winner of the Season 1 Build Contest.",
    category: "Players",
    isDraft: false,
    lastUpdatedBy: "Admin",
    updatedAt: Timestamp.now(),
    imageUrl: "https://mc-heads.net/body/Dream/left",
    infoboxData: {
      "Rank": "Legend",
      "Faction": "Dream Team",
      "Join Date": "Jan 2026",
      "Kills": "152"
    }
  }
];

const SAMPLE_PLAYERS: Player[] = [
  {
    uid: "dream-uid",
    username: "Dream",
    displayName: "Dream",
    bio: "The speedrunner of Galaxy SMP. Catch me if you can!",
    stats: {
      kills: 152,
      deaths: 12,
      playtime: "450h",
      joinDate: Timestamp.now(),
      skinUrl: "https://mc-heads.net/body/Dream/left"
    },
    baseLocation: { x: 1250, y: 72, z: -450 }
  },
  {
    uid: "techno-uid",
    username: "Technoblade",
    displayName: "Technoblade",
    bio: "Blood for the Blood God! Farming potatoes is my passion.",
    stats: {
      kills: 999,
      deaths: 0,
      playtime: "1200h",
      joinDate: Timestamp.now(),
      skinUrl: "https://mc-heads.net/body/Technoblade/left"
    },
    baseLocation: { x: -500, y: 64, z: 2000 }
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
  const [view, setView] = useState<"home" | "forum" | "wiki" | "players" | "map">("home");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedWiki, setSelectedWiki] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [wikiArticles, setWikiArticles] = useState<WikiArticle[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftCategory, setDraftCategory] = useState("General");

  const [wikiCategoryFilter, setWikiCategoryFilter] = useState<string | null>(null);

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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto px-4 py-12 space-y-8"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="mc-card p-8 text-center group cursor-pointer border-slate-800/50 hover:border-white/20">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Compass className="w-5 h-5 text-white" />
              <h3 className="font-display text-xl font-black text-white uppercase tracking-tight">WIKI INDEX</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="w-8 h-px bg-slate-800" />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">EXPLORE ALL</p>
              <div className="w-8 h-px bg-slate-800" />
            </div>
          </div>

          <div className="mc-card p-8 border-slate-800/50">
            <h3 className="font-display text-xs font-bold text-yellow-500 mb-6 uppercase tracking-[0.3em]">SERVER INFO</h3>
            <div className="space-y-4 text-xs font-bold">
              <div className="flex justify-between">
                <span className="text-slate-600 uppercase">IP:</span>
                <span className="text-white">gsmp.gg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 uppercase">Bedrock Port:</span>
                <span className="text-white">19132</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 uppercase">Java Version:</span>
                <span className="text-white">1.21.x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 uppercase">Discord:</span>
                <a href="#" className="text-blue-400 hover:underline">discord.gg/gsmp</a>
              </div>
            </div>
          </div>

          <div className="mc-card p-8 border-slate-800/50">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xs font-bold text-yellow-500 uppercase tracking-[0.3em] flex items-center gap-2">
                <Activity className="w-4 h-4" /> SERVER STATUS
              </h3>
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            </div>
            <div className="space-y-4">
              <div className="bg-black/40 border border-slate-800 p-3 text-center text-sm font-bold text-white tracking-widest rounded-lg">
                GSMP.GG
              </div>
              <div className="text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
                0 / 3500
              </div>
              <button className="w-full bg-[#f2d57e] hover:bg-[#e5c76d] text-slate-900 py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-lg transition-colors">
                <Copy className="w-4 h-4" /> Copy IP
              </button>
            </div>
          </div>

          <div className="mc-card overflow-hidden border-none bg-gradient-to-br from-blue-400 to-cyan-500 p-6 flex items-center gap-6 group cursor-pointer">
            <div className="w-16 h-16 bg-slate-900/20 rounded-none p-2">
              <img src="https://mc-heads.net/body/Dream/left" alt="Featured Article" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h3 className="font-display text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Award className="w-4 h-4" /> FEATURED ARTICLE
              </h3>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">The history of Galaxy SMP.</p>
            </div>
          </div>

          <div className="mc-card p-8 border-slate-800/50">
            <h3 className="font-display text-xs font-bold text-yellow-500 mb-6 uppercase tracking-[0.3em] flex items-center gap-2">
              <Users className="w-4 h-4" /> RECENT CONTRIBUTORS
            </h3>
            <div className="flex gap-2">
              {['Steve', 'Alex', 'Dream', 'Techno', 'Notch'].map((name, i) => (
                <div key={i} className="w-8 h-8 bg-slate-800 border border-slate-700 p-1">
                  <img src={`https://mc-heads.net/avatar/${name}/32`} alt={name} className="w-full h-full" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-9 space-y-6">
          <div className="mc-card p-12 border-slate-800/50">
            <h2 className="font-display text-xs font-bold text-slate-500 mb-2 uppercase tracking-[0.4em]">WELCOME TO THE OFFICIAL</h2>
            <h1 className="font-display text-4xl font-black text-white mb-6 tracking-tight uppercase">GALAXY SMP WIKI</h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
              Welcome to the official Galaxy SMP Wiki. Discover the lore, mechanics, and history of our universe. Crafted for players who want to dive deep into the galaxy.
            </p>
          </div>

          <div className="mc-card p-12 border-slate-800/50">
            <h3 className="font-display text-xs font-bold text-yellow-500 mb-6 uppercase tracking-[0.3em] flex items-center gap-2">
              <Info className="w-4 h-4" /> WIKI GUIDELINES
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Learn how to contribute to the wiki and maintain our high standards of documentation. Our community is built on shared knowledge!<br />
              The quickest way to ask questions or get help is to join our discord.
            </p>
            <button className="bg-[#5865f2] hover:bg-[#4752c4] text-white px-10 py-4 text-xs font-black uppercase tracking-widest flex items-center gap-3 rounded-lg transition-colors">
              <MessageSquare className="w-5 h-5" /> Wiki Discord
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="mc-card p-10 border-l-4 border-l-[#ef4444]">
              <h3 className="font-display text-xs font-bold text-red-500 mb-6 uppercase tracking-[0.3em] flex items-center gap-2">
                <Shield className="w-4 h-4" /> SERVER RULES
              </h3>
              <p className="text-slate-400 text-xs mb-8 leading-relaxed">Read the official rules of Galaxy SMP.</p>
              <button className="w-full bg-[#ef4444] hover:bg-[#dc2626] text-white py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-lg transition-colors">
                <FileText className="w-4 h-4" /> View Rules
              </button>
            </div>
            <div className="mc-card p-10 border-l-4 border-l-[#22c55e]">
              <h3 className="font-display text-xs font-bold text-green-500 mb-6 uppercase tracking-[0.3em] flex items-center gap-2">
                <Book className="w-4 h-4" /> WIKI LORE
              </h3>
              <p className="text-slate-400 text-xs mb-8 leading-relaxed">Explore the deep history of the Galaxy universe.</p>
              <button className="w-full bg-[#22c55e] hover:bg-[#16a34a] text-white py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-lg transition-colors">
                <Book className="w-4 h-4" /> Read Lore
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderMap = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 py-12"
    >
      <div className="mc-card p-1 border-slate-800 bg-slate-950 overflow-hidden h-[80vh]">
        <iframe 
          src="https://map.gsmp.gg" 
          className="w-full h-full border-none"
          title="Server Map"
        />
      </div>
    </motion.div>
  );

  const renderForum = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto py-16 px-4 space-y-10"
    >
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Main Forum Content */}
        <div className="flex-1 space-y-10">
          <div className="flex items-center justify-between border-b border-slate-800 pb-8">
            <h2 className="text-white font-display font-black text-4xl tracking-tight flex items-center gap-4">
              <MessageSquare className="w-10 h-10 text-blue-500" />
              COMMUNITY FORUM
            </h2>
            {selectedCategory && (
              <button 
                onClick={() => setSelectedCategory(null)}
                className="mc-button"
              >
                Back to Categories
              </button>
            )}
          </div>

          {!selectedCategory ? (
            <div className="grid grid-cols-1 gap-4">
              {categories.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="w-full mc-card p-8 flex items-center gap-8 text-left group border-slate-800/50"
                >
                  <div className="w-16 h-16 bg-slate-900 rounded-none flex items-center justify-center border border-slate-800 group-hover:border-blue-500/30 transition-all">
                    <MessageSquare className="w-8 h-8 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-display font-bold text-xl mb-1">{cat.name}</h4>
                    <p className="text-slate-500 text-sm font-medium">{cat.description}</p>
                  </div>
                  <ChevronRight className="w-6 h-6 text-slate-700 group-hover:text-[var(--mc-green)] transition-all" />
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                <h3 className="text-slate-500 font-display font-bold text-xs uppercase tracking-[0.2em]">THREADS</h3>
                {user && (
                  <button className="text-[var(--mc-green)] font-bold text-xs hover:underline flex items-center gap-2 uppercase tracking-widest">
                    <Plus className="w-4 h-4" /> NEW THREAD
                  </button>
                )}
              </div>
              {threads.length === 0 ? (
                <div className="mc-card p-20 text-center border-dashed border-slate-800">
                  <p className="text-slate-600 italic font-medium">No threads yet. Be the first to start a discussion!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {threads.map(thread => (
                    <div key={thread.id} className="mc-card p-8 group cursor-pointer border-slate-800/50">
                      <h4 className="text-white font-bold text-lg mb-4 group-hover:text-[var(--mc-green)] transition-colors leading-snug">{thread.title}</h4>
                      <div className="flex items-center gap-6 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-2"><UserIcon className="w-3.5 h-3.5" /> {thread.authorName}</span>
                        <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> {formatDistanceToNow(thread.createdAt.toDate())} AGO</span>
                        <span className="text-[var(--mc-green)] bg-green-500/5 px-2 py-1 rounded-none">{thread.postCount} POSTS</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Forum Sidebar */}
        <aside className="w-full lg:w-72 space-y-12">
          <div className="mc-card p-8 border-slate-800/50">
            <h3 className="font-display text-[10px] font-bold text-slate-600 mb-6 uppercase tracking-[0.3em]">FORUM STATS</h3>
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1">Total Threads</p>
                <p className="text-xl font-black text-white">1,248</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1">Total Posts</p>
                <p className="text-xl font-black text-white">12,852</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest mb-1">Online Members</p>
                <p className="text-xl font-black text-[var(--mc-green)]">42</p>
              </div>
            </div>
          </div>

          <div className="mc-card p-8 border-slate-800/50">
            <h3 className="font-display text-[10px] font-bold text-slate-600 mb-6 uppercase tracking-[0.3em]">TOP CONTRIBUTORS</h3>
            <div className="space-y-4">
              {['Technoblade', 'Dream', 'LoreMaster'].map((name, i) => (
                <div key={name} className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-slate-800 rounded-none flex items-center justify-center text-[10px] font-bold text-white">#{i+1}</div>
                  <div>
                    <p className="text-xs font-bold text-white">{name}</p>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{150 - i * 20} posts</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );

  const renderPlayers = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto py-16 px-4 pb-32"
    >
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Main Players Content */}
        <div className="flex-1 space-y-12">
          <div className="border-b border-slate-800 pb-8">
            <h2 className="font-display text-4xl font-black text-white tracking-tight flex items-center gap-4">
              <Users className="w-10 h-10 text-[var(--mc-green)]" />
              SERVER LEGENDS
            </h2>
            <p className="text-slate-500 mt-4 max-w-2xl leading-relaxed">
              The history of Galaxy SMP is written by its players. Here are the most prominent figures currently active on the server.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {SAMPLE_PLAYERS.map(player => (
              <div key={player.uid} className="mc-card group overflow-hidden border-slate-800/50">
                <div className="h-32 bg-slate-950 relative">
                  <div className="absolute -bottom-12 left-8 w-24 h-24 mc-card bg-slate-900 p-2 rounded-none border-slate-800">
                    <img 
                      src={player.stats.skinUrl} 
                      alt={player.username} 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
                <div className="pt-16 p-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display text-xl font-bold text-white">{player.displayName}</h3>
                    <span className="text-[10px] font-bold text-[var(--mc-green)] uppercase tracking-widest bg-green-500/5 px-2 py-1 rounded-none">Active</span>
                  </div>
                  <p className="text-slate-500 text-sm mb-8 line-clamp-2 leading-relaxed">{player.bio}</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-slate-950/50 p-4 rounded-none border border-slate-800/50">
                      <p className="text-[10px] font-bold text-slate-700 uppercase mb-1 tracking-wider">Kills</p>
                      <p className="text-white text-lg font-bold">{player.stats.kills}</p>
                    </div>
                    <div className="bg-slate-950/50 p-4 rounded-none border border-slate-800/50">
                      <p className="text-[10px] font-bold text-slate-700 uppercase mb-1 tracking-wider">Playtime</p>
                      <p className="text-white text-lg font-bold">{player.stats.playtime}</p>
                    </div>
                  </div>

                  <button className="w-full mc-button">
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Players Sidebar */}
        <aside className="w-full lg:w-72 space-y-12">
          <div className="mc-card p-8 border-slate-800/50">
            <h3 className="font-display text-[10px] font-bold text-slate-600 mb-6 uppercase tracking-[0.3em]">SERVER STATUS</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Status</span>
                <span className="text-[10px] font-bold text-[var(--mc-green)] uppercase tracking-widest">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Players</span>
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">42 / 100</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Version</span>
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">1.20.4</span>
              </div>
            </div>
          </div>

          <div className="mc-card p-8 border-slate-800/50">
            <h3 className="font-display text-[10px] font-bold text-slate-600 mb-6 uppercase tracking-[0.3em]">TOP KILLERS</h3>
            <div className="space-y-4">
              {SAMPLE_PLAYERS.sort((a, b) => b.stats.kills - a.stats.kills).map((p, i) => (
                <div key={p.uid} className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-slate-800 rounded-none flex items-center justify-center text-[10px] font-bold text-white">#{i+1}</div>
                  <div>
                    <p className="text-xs font-bold text-white">{p.displayName}</p>
                    <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{p.stats.kills} kills</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );

  const renderWiki = () => {
    const currentArticle = wikiArticles.find(a => a.id === selectedWiki);
    const wikiCategories = ['Players', 'Items', 'Locations', 'Events', 'Guides', 'Lore'];

    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-7xl mx-auto py-10 px-4 pb-32"
      >
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Left Sidebar: Traditional Wiki Sidebar */}
          <aside className="w-full lg:w-56 flex-shrink-0">
            <div className="wiki-sidebar-group">
              <h3 className="wiki-sidebar-title">NAVIGATION</h3>
              <nav className="space-y-0.5">
                <button 
                  onClick={() => setSelectedWiki(null)}
                  className={cn("wiki-sidebar-link", !selectedWiki && "active")}
                >
                  <Layout className="w-3.5 h-3.5" />
                  Wiki Home
                </button>
                <button className="wiki-sidebar-link">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Recent Changes
                </button>
                <button className="wiki-sidebar-link">
                  <Compass className="w-3.5 h-3.5" />
                  Random Page
                </button>
              </nav>
            </div>

            <div className="wiki-sidebar-group">
              <h3 className="wiki-sidebar-title">CATEGORIES</h3>
              <nav className="space-y-0.5">
                {wikiCategories.map(cat => (
                  <button 
                    key={cat}
                    onClick={() => {
                      setWikiCategoryFilter(cat);
                      setSelectedWiki(null);
                    }}
                    className={cn("wiki-sidebar-link", wikiCategoryFilter === cat && "active")}
                  >
                    <Tag className="w-3.5 h-3.5" />
                    {cat}
                  </button>
                ))}
              </nav>
            </div>

            <div className="wiki-sidebar-group">
              <h3 className="wiki-sidebar-title">TOOLS</h3>
              <nav className="space-y-0.5">
                <button 
                  onClick={() => setIsDrafting(true)}
                  className="wiki-sidebar-link text-[var(--mc-green)]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create Article
                </button>
                <button className="wiki-sidebar-link">
                  <FileText className="w-3.5 h-3.5" />
                  What links here
                </button>
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {!selectedWiki ? (
              <div className="space-y-12">
                <div className="border-b border-slate-800 pb-8 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-4xl font-black text-white tracking-tight mb-4 leading-tight">
                      {wikiCategoryFilter ? `${wikiCategoryFilter.toUpperCase()} ARTICLES` : "GALAXY SMP WIKI"}
                    </h2>
                    <p className="text-slate-500 max-w-2xl leading-relaxed">
                      {wikiCategoryFilter 
                        ? `Browsing all articles in the ${wikiCategoryFilter} category.`
                        : `Welcome to the official community-driven encyclopedia for the Galaxy SMP. We currently have ${wikiArticles.length} articles being maintained by the community.`
                      }
                    </p>
                  </div>
                  {wikiCategoryFilter && (
                    <button 
                      onClick={() => setWikiCategoryFilter(null)}
                      className="text-xs font-bold text-[var(--mc-green)] hover:underline uppercase tracking-widest"
                    >
                      View All Articles
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {wikiArticles
                    .filter(a => !a.isDraft)
                    .filter(a => !wikiCategoryFilter || a.category === wikiCategoryFilter)
                    .map(article => (
                      <button 
                        key={article.id}
                        onClick={() => setSelectedWiki(article.id)}
                        className="mc-card p-8 text-left group border-slate-800/50 hover:border-[var(--mc-green)]/30"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] font-bold text-[var(--mc-green)] uppercase tracking-[0.2em]">{article.category}</span>
                          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{formatDistanceToNow(article.updatedAt.toDate())} ago</span>
                        </div>
                        <h4 className="text-white font-bold text-xl mb-4 group-hover:text-[var(--mc-green)] transition-colors leading-snug">{article.title}</h4>
                        <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">{article.content.replace(/[#*`]/g, '')}</p>
                      </button>
                    ))}
                </div>
              </div>
            ) : currentArticle ? (
              <div className="wiki-content">
                {/* Wiki Header Tabs */}
                <div className="flex items-center justify-between border-b border-slate-800 mb-10">
                  <div className="flex items-center gap-1">
                    <button className="px-6 py-3 text-xs font-bold text-white border-b-2 border-[var(--mc-green)] uppercase tracking-widest">Read</button>
                    <button className="px-6 py-3 text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest">Edit</button>
                    <button className="px-6 py-3 text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest">View History</button>
                  </div>
                  <div className="flex items-center gap-4">
                    <button className="p-2 text-slate-500 hover:text-white transition-colors"><Share2 className="w-4 h-4" /></button>
                    <button className="p-2 text-slate-500 hover:text-white transition-colors"><Copy className="w-4 h-4" /></button>
                  </div>
                </div>

                <div className="flex flex-col xl:flex-row gap-12">
                  <div className="flex-1 min-w-0">
                    <h1 className="flex items-center justify-between">
                      {currentArticle.title}
                      {profile?.role === 'admin' && (
                        <button 
                          onClick={() => deleteArticle(currentArticle.id)}
                          className="p-2 text-red-500/50 hover:text-red-500 transition-colors"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      )}
                    </h1>
                    
                    <div className="article-meta">
                      <span className="flex items-center gap-2"><UserIcon className="w-3.5 h-3.5" /> {currentArticle.lastUpdatedBy}</span>
                      <span className="w-1 h-1 bg-slate-800 rounded-full" />
                      <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Last updated {formatDistanceToNow(currentArticle.updatedAt.toDate())} ago</span>
                    </div>

                    {/* Table of Contents */}
                    <div className="wiki-toc">
                      <div className="wiki-toc-title">
                        Contents
                        <ChevronDown className="w-4 h-4 text-slate-700" />
                      </div>
                      <nav className="space-y-1">
                        <a href="#introduction" className="wiki-toc-item">
                          <span className="text-[10px] font-bold text-slate-700">1</span> Introduction
                        </a>
                        <a href="#history" className="wiki-toc-item">
                          <span className="text-[10px] font-bold text-slate-700">2</span> History
                        </a>
                        <a href="#features" className="wiki-toc-item">
                          <span className="text-[10px] font-bold text-slate-700">3</span> Features
                        </a>
                        <a href="#coordinates" className="wiki-toc-item">
                          <span className="text-[10px] font-bold text-slate-700">4</span> Coordinates
                        </a>
                      </nav>
                    </div>

                    <div className="prose prose-invert max-w-none">
                      <ReactMarkdown>{currentArticle.content}</ReactMarkdown>
                    </div>

                    {currentArticle.coordinates && (
                      <div id="coordinates" className="mt-20 p-10 mc-card bg-slate-900/30 border-dashed border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="flex items-center gap-8">
                          <div className="w-16 h-16 bg-slate-800 rounded-none flex items-center justify-center border border-slate-700 shadow-xl">
                            <MapPin className="w-8 h-8 text-[var(--mc-green)]" />
                          </div>
                          <div>
                            <h4 className="text-white font-bold text-xl tracking-tight mb-1">Navigation Data</h4>
                            <p className="font-mono text-sm text-slate-500 tracking-wider">
                              X: {currentArticle.coordinates.x} / Y: {currentArticle.coordinates.y} / Z: {currentArticle.coordinates.z}
                            </p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`/tp ${currentArticle.coordinates?.x} ${currentArticle.coordinates?.y} ${currentArticle.coordinates?.z}`);
                          }}
                          className="mc-button-primary px-8 py-3"
                        >
                          Copy Teleport Command
                        </button>
                      </div>
                    )}

                    {/* Categories Footer */}
                    <div className="mt-20 pt-8 border-t border-slate-800 flex items-center gap-4">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Categories:</span>
                      <div className="flex flex-wrap gap-2">
                        <button className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-none text-[10px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">{currentArticle.category}</button>
                        <button className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-none text-[10px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Galaxy SMP</button>
                        <button className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-none text-[10px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-widest">Community Content</button>
                      </div>
                    </div>
                  </div>

                  {/* Right Sidebar: Infobox */}
                  {currentArticle.infoboxData && (
                    <aside className="w-full xl:w-72 flex-shrink-0">
                      <div className="infobox sticky top-24">
                        <div className="infobox-header">{currentArticle.title}</div>
                        {currentArticle.imageUrl && (
                          <div className="p-4 bg-slate-950/50 border-b border-slate-800">
                            <img 
                              src={currentArticle.imageUrl} 
                              alt={currentArticle.title} 
                              className="w-full h-auto rounded-none border border-slate-800"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        {Object.entries(currentArticle.infoboxData).map(([label, value]) => (
                          <div key={label} className="infobox-row">
                            <div className="infobox-label">{label}</div>
                            <div className="infobox-value">{value}</div>
                          </div>
                        ))}
                      </div>
                    </aside>
                  )}
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300">
      {/* Top Bar */}
      <div className="bg-white/5 border-b border-slate-800/50 backdrop-blur-sm py-0 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center justify-center flex-1">
            <button onClick={() => setView("home")} className="nav-link active">
              <Home className="w-4 h-4" /> Home
            </button>
            <a href="https://discord.com/invite/gsmp" target="_blank" className="nav-link">
              <MessageSquare className="w-4 h-4" /> Discord
            </a>
          </div>
          <button 
            onClick={user ? logOut : handleSignIn}
            className="text-[10px] font-black text-white hover:text-[var(--mc-yellow)] transition-colors uppercase tracking-[0.2em] px-6"
          >
            {user ? "LOGOUT" : "LOGIN"}
          </button>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-[#1a1a1a] py-12 px-6 border-b border-slate-900">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Left Side */}
          <div className="flex items-center gap-6 order-2 md:order-1">
            <div className="w-16 h-16 bg-slate-900 hexagon-frame flex items-center justify-center border border-slate-800 shadow-xl">
              <img src="https://mc-heads.net/avatar/Steve/64" alt="Guest" className="w-10 h-10 hexagon-frame" referrerPolicy="no-referrer" />
            </div>
            <div className="text-center md:text-left">
              <h4 className="text-white font-display font-black text-sm uppercase tracking-tight">WIKI CONTRIBUTOR</h4>
              <button onClick={handleSignIn} className="text-[10px] font-bold text-yellow-500 hover:underline flex items-center gap-2 uppercase tracking-widest">
                <LogIn className="w-3 h-3" /> Login to edit articles
              </button>
            </div>
          </div>

          {/* Center Logo */}
          <div className="flex flex-col items-center gap-2 order-1 md:order-2 cursor-pointer" onClick={() => setView("home")}>
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-violet-600 rounded-none flex items-center justify-center shadow-2xl shadow-blue-500/20">
                <div className="w-12 h-12 bg-white rounded-none rotate-45" />
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 px-4 py-1 text-[10px] font-black text-white uppercase tracking-tighter whitespace-nowrap">
                GALAXY WIKI
              </div>
            </div>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-6 order-3">
            <div className="hidden md:flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-none mr-4">
              <Search className="w-3 h-3 text-slate-500" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-transparent border-none text-[10px] font-bold text-white focus:outline-none w-24 uppercase tracking-widest"
                onClick={() => setIsSearchOpen(true)}
                readOnly
              />
            </div>
            <div className="text-center md:text-right">
              <h4 className="text-white font-display font-black text-sm uppercase tracking-tight flex items-center justify-end gap-2">
                <Book className="w-4 h-4" /> WIKI GUIDE
              </h4>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">New to the wiki?</p>
            </div>
            <div className="w-16 h-16 bg-slate-900 hexagon-frame flex items-center justify-center border border-slate-800 shadow-xl">
              <img src="https://mc-heads.net/avatar/Alex/64" alt="Wiki" className="w-10 h-10 hexagon-frame" referrerPolicy="no-referrer" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Nav */}
      <nav className="bg-white/5 border-b border-slate-800/50 backdrop-blur-md sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-center">
          {[
            { name: 'Wiki', view: 'wiki', icon: Book },
            { name: 'Forum', view: 'forum', icon: MessageSquare },
            { name: 'Players', view: 'players', icon: Users },
            { name: 'Map', view: 'map', icon: Map },
          ].map(item => (
            <button
              key={item.name}
              onClick={() => setView(item.view as any)}
              className={cn("nav-link", view === item.view && "active")}
            >
              <item.icon className="w-4 h-4" />
              {item.name}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {view === "home" && renderHome()}
          {view === "forum" && renderForum()}
          {view === "wiki" && renderWiki()}
          {view === "players" && renderPlayers()}
          {view === "map" && renderMap()}
        </AnimatePresence>
      </main>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="fixed inset-0 z-[60] bg-[var(--bg-dark)] lg:hidden p-8 pt-24"
          >
            <div className="space-y-8">
              {[
                { name: 'Wiki', view: 'wiki', icon: Book },
                { name: 'Forum', view: 'forum', icon: MessageSquare },
                { name: 'Players', view: 'players', icon: Users },
                { name: 'Map', view: 'map', icon: Map },
              ].map(item => (
                <button
                  key={item.name}
                  onClick={() => {
                    setView(item.view as any);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn("text-2xl font-display font-black uppercase tracking-widest flex items-center gap-4", view === item.view ? "text-[var(--mc-green)]" : "text-white")}
                >
                  <item.icon className="w-8 h-8" />
                  {item.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Modal */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-start justify-center pt-24 px-4"
            onClick={() => setIsSearchOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-3xl mc-card bg-slate-900 p-0 overflow-hidden border-slate-800 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-10 border-b border-slate-800 flex items-center gap-8">
                <Search className="w-10 h-10 text-[var(--mc-green)]" />
                <input 
                  autoFocus
                  type="text"
                  placeholder="Search wiki, players, lore..."
                  className="flex-1 bg-transparent border-none text-3xl font-display font-bold text-white focus:outline-none placeholder:text-slate-700 tracking-tight"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <button onClick={() => setIsSearchOpen(false)} className="text-slate-700 hover:text-white transition-colors">
                  <X className="w-10 h-10" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-6">
                {searchQuery ? (
                  <div className="space-y-3">
                    {wikiArticles.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase())).map(article => (
                      <button
                        key={article.id}
                        onClick={() => {
                          setSelectedWiki(article.id);
                          setView("wiki");
                          setIsSearchOpen(false);
                          setSearchQuery("");
                        }}
                        className="w-full p-8 text-left hover:bg-white/5 rounded-none flex items-center justify-between group transition-all"
                      >
                        <div>
                          <p className="text-white font-bold text-xl mb-1">{article.title}</p>
                          <p className="text-xs font-bold text-[var(--mc-green)] uppercase tracking-[0.2em]">{article.category}</p>
                        </div>
                        <ChevronRight className="w-6 h-6 text-slate-800 group-hover:text-[var(--mc-green)] transition-all" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-20 text-center">
                    <p className="font-display font-bold text-sm text-slate-700 uppercase tracking-[0.3em]">Type something to search...</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Draft Modal */}
      <AnimatePresence>
        {isDrafting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="w-full max-w-3xl mc-card p-12 space-y-10 border-slate-800 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display font-extrabold text-3xl text-white tracking-tight">SUBMIT WIKI DRAFT</h2>
                <button onClick={() => setIsDrafting(false)} className="text-slate-700 hover:text-white transition-colors">
                  <X className="w-10 h-10" />
                </button>
              </div>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest">Article Title</label>
                  <input 
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-none p-5 text-white focus:outline-none focus:border-[var(--mc-green)]/50 font-bold text-lg shadow-inner"
                    placeholder="e.g. The Great Citadel"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest">Category</label>
                  <select 
                    value={draftCategory}
                    onChange={(e) => setDraftCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-none p-5 text-white focus:outline-none focus:border-[var(--mc-green)]/50 font-bold appearance-none shadow-inner"
                  >
                    {['Players', 'Items', 'Locations', 'Events', 'Guides', 'Lore'].map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest">Content (Markdown)</label>
                  <textarea 
                    value={draftContent}
                    onChange={(e) => setDraftContent(e.target.value)}
                    className="w-full h-80 bg-slate-900 border border-slate-800 rounded-none p-5 text-white focus:outline-none focus:border-[var(--mc-green)]/50 resize-none font-medium leading-relaxed shadow-inner"
                    placeholder="# Your Content Here..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-6">
                <button onClick={() => setIsDrafting(false)} className="mc-button px-10">Cancel</button>
                <button onClick={submitDraft} className="mc-button-primary px-10">Submit for Review</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-auto border-t border-slate-800 py-32 px-6 bg-[#141414]">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-24 items-center">
          <div className="text-center md:text-left">
            <div className="font-display font-black text-3xl text-white tracking-tighter mb-6">GALAXY <span className="text-blue-500">SMP</span></div>
            <p className="text-slate-500 text-sm max-w-xs leading-relaxed">The premier Minecraft community for survival and creative enthusiasts. Join the legend today.</p>
          </div>
          <div className="flex justify-center gap-12 text-xs font-bold text-slate-500 uppercase tracking-[0.3em]">
            <a href="#" className="hover:text-white transition-all">Discord</a>
            <a href="#" className="hover:text-white transition-all">Store</a>
            <a href="#" className="hover:text-white transition-all">Rules</a>
          </div>
          <div className="text-center md:text-right">
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">© 2026 GALAXY SMP NETWORK</p>
            <p className="text-[8px] text-slate-700 mt-3 uppercase tracking-widest leading-relaxed">Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
