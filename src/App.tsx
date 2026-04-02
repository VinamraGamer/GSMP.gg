import React, { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, Timestamp, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { auth, db, signIn, logOut, handleFirestoreError, OperationType, signInEmail, signUpEmail } from "./lib/firebase";
import { UserProfile, ForumCategory, ForumThread, WikiArticle, Player, MapInfo, NavItem, ToolItem, SiteSettings } from "./types";
import { Toaster, toast } from "sonner";
import * as LucideIcons from 'lucide-react';
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
  Lock,
  Edit,
  Loader2,
  HelpCircle
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
    rank: "Member",
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
    rank: "Legend",
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

export default function App({ initialView = "home" }: { initialView?: "home" | "forum" | "wiki" | "admin" }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [view, setView] = useState<"home" | "forum" | "wiki" | "admin">(initialView);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedWiki, setSelectedWiki] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [wikiArticles, setWikiArticles] = useState<WikiArticle[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftCategory, setDraftCategory] = useState("General");

  const [wikiCategoryFilter, setWikiCategoryFilter] = useState<string | null>(null);

  // Login Modal State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginName, setLoginName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  // Admin State
  const [editingArticle, setEditingArticle] = useState<WikiArticle | null>(null);
  const [editingCategory, setEditingCategory] = useState<ForumCategory | null>(null);
  const [editingNavItem, setEditingNavItem] = useState<NavItem | null>(null);
  const [editingToolItem, setEditingToolItem] = useState<ToolItem | null>(null);
  const [adminTab, setAdminTab] = useState<"wiki" | "forum" | "settings">("wiki");
  const [players, setPlayers] = useState<Player[]>([]);
  const [maps, setMaps] = useState<MapInfo[]>([]);

  // Site Settings State
  const [siteSettings, setSiteSettings] = useState<SiteSettings>({
    featuredArticleId: "1",
    featuredImage: "https://mc-heads.net/body/Dream/left",
    featuredText: "The history of Galaxy SMP.",
    wikiCategories: ['Players', 'Items', 'Locations', 'Events', 'Guides', 'Lore']
  });
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [toolItems, setToolItems] = useState<ToolItem[]>([]);

  // Admin Login State
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);

  const [devModeClicks, setDevModeClicks] = useState(0);
  const [isDevMode, setIsDevMode] = useState(() => localStorage.getItem('gsmp_dev_mode') === 'true');

  const handleDevModeClick = () => {
    const newCount = devModeClicks + 1;
    setDevModeClicks(newCount);
    if (newCount === 7) {
      setIsDevMode(true);
      localStorage.setItem('gsmp_dev_mode', 'true');
      toast.success("Developer Mode Activated! Admin Panel is now visible in the footer.");
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUsername === "admin" && adminPassword === "GSMP@2026") {
      setIsAdminAuthenticated(true);
      if (profile && user) {
        try {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
            role: 'admin',
            adminSecret: 'GALAXY_SECRET_2026'
          });
          setProfile({ ...profile, role: 'admin' });
          toast.success("Admin access granted permanently!");
        } catch (error) {
          console.error("Error updating admin role in Firestore:", error);
          setProfile({ ...profile, role: 'admin' });
          toast.info("Admin access granted for this session.");
        }
      } else {
        toast.info("Admin access granted for this session. Sign in to save changes permanently.");
      }
      setShowAdminLogin(false);
      setView("admin");
      setIsLoginModalOpen(false);
    } else {
      toast.error("Invalid admin credentials");
    }
  };

  const RotatingIcon = ({ icon, className }: { icon: any, className?: string }) => {
    const Icon = typeof icon === 'string' ? (LucideIcons as any)[icon] || LucideIcons.HelpCircle : icon;
    return <Icon className={cn(className, "transition-transform duration-500 group-hover:rotate-[360deg]")} />;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (!user) {
        setProfile(null);
      }
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
      } else {
        // Create a default profile if it doesn't exist
        const userProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || "Guest",
          photoURL: user.photoURL || undefined,
          role: "user"
        };
        setDoc(doc(db, "users", user.uid), userProfile as any).catch(() => {});
        setProfile(userProfile);
      }
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!isAuthReady) return;
    const q = query(collection(db, "forumCategories"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumCategory));
      setCategories(cats);
    }, (error) => handleFirestoreError(error, OperationType.GET, "forumCategories"));
    return unsubscribe;
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady) return;
    const q = query(collection(db, "wikiArticles"), orderBy("updatedAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WikiArticle));
      setWikiArticles(articles);
    }, (error) => handleFirestoreError(error, OperationType.GET, "wikiArticles"));
    return unsubscribe;
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady) return;
    const q = query(collection(db, "players"), orderBy("displayName", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const p = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Player));
      setPlayers(p);
    }, (error) => handleFirestoreError(error, OperationType.GET, "players"));
    return unsubscribe;
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady) return;
    const q = query(collection(db, "maps"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const m = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MapInfo));
      setMaps(m);
    }, (error) => handleFirestoreError(error, OperationType.GET, "maps"));
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

  useEffect(() => {
    if (!isAuthReady) return;
    const unsubscribe = onSnapshot(doc(db, "siteSettings", "general"), (docSnap) => {
      if (docSnap.exists()) {
        setSiteSettings(docSnap.data() as SiteSettings);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, "siteSettings/general"));
    return unsubscribe;
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady) return;
    const q = query(collection(db, "navItems"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as NavItem));
      setNavItems(items);
    }, (error) => handleFirestoreError(error, OperationType.GET, "navItems"));
    return unsubscribe;
  }, [isAuthReady]);

  useEffect(() => {
    if (!isAuthReady) return;
    const q = query(collection(db, "toolItems"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ToolItem));
      setToolItems(items);
    }, (error) => handleFirestoreError(error, OperationType.GET, "toolItems"));
    return unsubscribe;
  }, [isAuthReady]);

  const saveSiteSettings = async (settings: SiteSettings) => {
    if (!isAdmin()) return;
    try {
      await setDoc(doc(db, "siteSettings", "general"), settings);
      toast.success("Site settings updated!");
    } catch (error) {
      toast.error("Failed to update site settings");
      console.error(error);
    }
  };

  const saveNavItem = async (item: NavItem) => {
    if (!isAdmin()) return;
    try {
      if (item.id) {
        const { id, ...data } = item;
        await updateDoc(doc(db, "navItems", id), data);
      } else {
        const { id, ...data } = item;
        await addDoc(collection(db, "navItems"), data);
      }
      toast.success("Navigation item saved!");
      setEditingNavItem(null);
    } catch (error) {
      toast.error("Failed to save navigation item");
      console.error(error);
    }
  };

  const deleteNavItem = async (id: string) => {
    if (!isAdmin()) return;
    try {
      await deleteDoc(doc(db, "navItems", id));
      toast.success("Navigation item deleted!");
    } catch (error) {
      toast.error("Failed to delete navigation item");
      console.error(error);
    }
  };

  const saveToolItem = async (item: ToolItem) => {
    if (!isAdmin()) return;
    try {
      if (item.id) {
        const { id, ...data } = item;
        await updateDoc(doc(db, "toolItems", id), data);
      } else {
        const { id, ...data } = item;
        await addDoc(collection(db, "toolItems"), data);
      }
      toast.success("Tool item saved!");
      setEditingToolItem(null);
    } catch (error) {
      toast.error("Failed to save tool item");
      console.error(error);
    }
  };

  const deleteToolItem = async (id: string) => {
    if (!isAdmin()) return;
    try {
      await deleteDoc(doc(db, "toolItems", id));
      toast.success("Tool item deleted!");
    } catch (error) {
      toast.error("Failed to delete tool item");
      console.error(error);
    }
  };

  const seedSampleData = async () => {
    if (!isAdmin()) return;
    setIsProcessing(true);
    try {
      // Seed Site Settings
      await setDoc(doc(db, "siteSettings", "general"), {
        featuredArticleId: "",
        featuredImage: "https://mc-heads.net/body/Dream/left",
        featuredText: "The history of Galaxy SMP.",
        wikiCategories: ["Lore", "Mechanics", "History", "Players", "Maps"]
      });

      // Seed Nav Items
      const initialNav = [
        { name: 'Wiki', view: 'wiki', icon: 'Book', order: 1 },
        { name: 'Forum', view: 'forum', icon: 'MessageSquare', order: 2 },
      ];
      for (const item of initialNav) {
        await addDoc(collection(db, "navItems"), item);
      }

      // Seed Tool Items
      const initialTools = [
        { name: 'Create Article', icon: 'Plus', order: 1 },
        { name: 'What links here', icon: 'FileText', order: 2 },
      ];
      for (const item of initialTools) {
        await addDoc(collection(db, "toolItems"), item);
      }

      // Seed Wiki
      for (const article of SAMPLE_WIKI) {
        const { id, ...data } = article;
        await addDoc(collection(db, "wikiArticles"), { ...data, authorUid: user?.uid });
      }
      // Seed Categories
      for (const cat of SAMPLE_CATEGORIES) {
        const { id, ...data } = cat;
        await addDoc(collection(db, "forumCategories"), data);
      }
      // Seed Players
      for (const player of SAMPLE_PLAYERS) {
        const { uid, ...data } = player;
        await setDoc(doc(db, "players", uid), data);
      }
      toast.success("Sample data seeded successfully!");
    } catch (error) {
      toast.error("Failed to seed data");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignIn = () => {
    setIsLoginModalOpen(true);
  };

  const handleGoogleSignIn = async () => {
    try {
      await signIn();
      setIsLoginModalOpen(false);
      toast.success("Signed in with Google!");
    } catch (error) {
      console.error("Sign in failed", error);
      toast.error("Google sign in failed");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      if (isSignUp) {
        await signUpEmail(loginEmail, loginPass, loginName);
        toast.success("Account created successfully!");
      } else {
        await signInEmail(loginEmail, loginPass);
        toast.success("Signed in successfully!");
      }
      setIsLoginModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const submitDraft = async () => {
    if (!user || !profile) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, "wikiArticles"), {
        title: draftTitle,
        content: draftContent,
        category: draftCategory,
        isDraft: true,
        authorUid: user.uid,
        lastUpdatedBy: profile.displayName || "Anonymous",
        updatedAt: serverTimestamp()
      });
      setIsDrafting(false);
      setDraftTitle("");
      setDraftContent("");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "wikiArticles");
    } finally {
      setIsProcessing(false);
    }
  };

  const isAdmin = () => {
    return profile?.role === 'admin';
  };

  const approveDraft = async (article: WikiArticle) => {
    if (!isAdmin()) {
      toast.error("You do not have permission to approve drafts.");
      return;
    }
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, "wikiArticles", article.id), {
        isDraft: false,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: profile?.displayName || "Admin"
      });
      toast.success("Draft approved and published!");
    } catch (error) {
      toast.error("Failed to approve draft");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteArticle = async (id: string) => {
    if (!isAdmin()) {
      toast.error("You do not have permission to delete articles.");
      return;
    }
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, "wikiArticles", id));
      if (selectedWiki === id) setSelectedWiki(null);
      toast.success("Article deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete article");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveArticle = async (article: Partial<WikiArticle>) => {
    if (!isAdmin() || !user) {
      toast.error("You do not have permission to save articles.");
      return;
    }
    setIsProcessing(true);
    try {
      const { id, ...data } = article;
      const articleData = {
        ...data,
        updatedAt: serverTimestamp(),
        lastUpdatedBy: profile?.displayName || "Admin"
      };

      if (id) {
        await updateDoc(doc(db, "wikiArticles", id), articleData);
        toast.success("Article updated successfully!");
      } else {
        await addDoc(collection(db, "wikiArticles"), {
          ...articleData,
          authorUid: user.uid,
          isDraft: false
        });
        toast.success("Article created successfully!");
      }
      setEditingArticle(null);
    } catch (error) {
      toast.error("Failed to save article");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveCategory = async (category: Partial<ForumCategory>) => {
    if (!isAdmin()) {
      toast.error("You do not have permission to save categories.");
      return;
    }
    try {
      const { id, ...data } = category;
      if (id) {
        await updateDoc(doc(db, "forumCategories", id), {
          ...data
        });
        toast.success("Category updated!");
      } else {
        await addDoc(collection(db, "forumCategories"), {
          ...data,
          order: categories.length + 1
        });
        toast.success("Category created!");
      }
      setEditingCategory(null);
    } catch (error) {
      toast.error("Failed to save category");
      console.error(error);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!isAdmin()) {
      toast.error("You do not have permission to delete categories.");
      return;
    }
    try {
      await deleteDoc(doc(db, "forumCategories", id));
      toast.success("Category deleted!");
    } catch (error) {
      toast.error("Failed to delete category");
      console.error(error);
    }
  };

  const deletePlayer = async (id: string) => {
    if (!isAdmin()) {
      toast.error("You do not have permission to delete players.");
      return;
    }
    try {
      await deleteDoc(doc(db, "players", id));
      toast.success("Player deleted!");
    } catch (error) {
      toast.error("Failed to delete player");
      console.error(error);
    }
  };

  const deleteMap = async (id: string) => {
    if (!isAdmin()) {
      toast.error("You do not have permission to delete maps.");
      return;
    }
    try {
      await deleteDoc(doc(db, "maps", id));
      toast.success("Map deleted!");
    } catch (error) {
      toast.error("Failed to delete map");
      console.error(error);
    }
  };

  const renderAdmin = () => {
    if (!isAdmin() && !isAdminAuthenticated) {
      return (
        <div className="max-w-6xl mx-auto px-4 py-32 text-center space-y-6">
          <Lock className="w-16 h-16 text-slate-700 mx-auto" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">Access Denied</h2>
          <p className="text-slate-500 max-w-md mx-auto">You do not have permission to access the admin panel. Please log in with an admin account.</p>
          <button 
            onClick={() => setShowAdminLogin(true)}
            className="bg-[var(--mc-yellow)] text-slate-900 px-8 py-3 text-xs font-black uppercase tracking-widest rounded-lg"
          >
            Admin Login
          </button>
        </div>
      );
    }

    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", duration: 0.6, bounce: 0.3 }}
        className="max-w-6xl mx-auto px-4 py-12 space-y-8"
      >
      <div className="flex items-center justify-between border-b border-slate-800 pb-8">
        <h1 className="font-display text-4xl font-black text-white uppercase tracking-tight flex items-center gap-4 group">
          <RotatingIcon icon={Shield} className="w-10 h-10 text-red-500" />
          Admin Panel
        </h1>
        <div className="flex gap-4">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={seedSampleData}
            className="px-6 py-2 text-xs font-black uppercase tracking-widest bg-slate-800 text-slate-400 hover:text-white rounded-lg flex items-center gap-2 group"
          >
            <RotatingIcon icon={Activity} className="w-4 h-4" /> Seed Data
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setAdminTab("wiki")}
            className={cn("px-6 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-lg flex items-center gap-2 group", adminTab === "wiki" ? "bg-[var(--mc-yellow)] text-slate-900" : "bg-slate-800 text-slate-400 hover:text-white")}
          >
            <RotatingIcon icon={Book} className="w-4 h-4" /> Wiki Management
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setAdminTab("forum")}
            className={cn("px-6 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-lg flex items-center gap-2 group", adminTab === "forum" ? "bg-[var(--mc-yellow)] text-slate-900" : "bg-slate-800 text-slate-400 hover:text-white")}
          >
            <RotatingIcon icon={MessageSquare} className="w-4 h-4" /> Forum Management
          </motion.button>
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setAdminTab("settings")}
            className={cn("px-6 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-lg flex items-center gap-2 group", adminTab === "settings" ? "bg-[var(--mc-yellow)] text-slate-900" : "bg-slate-800 text-slate-400 hover:text-white")}
          >
            <RotatingIcon icon={Layout} className="w-4 h-4" /> Site Settings
          </motion.button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {adminTab === "wiki" ? (
          <motion.div 
            key="wiki-admin"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">Wiki Articles</h2>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setEditingArticle({ id: "", title: "", content: "", category: "Lore", isDraft: false, lastUpdatedBy: "", updatedAt: Timestamp.now(), infoboxData: {} })}
                className="bg-[var(--mc-green)] hover:bg-[var(--mc-dark-green)] text-white px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg flex items-center gap-2 transition-colors group"
              >
                <RotatingIcon icon={Plus} className="w-4 h-4" /> Add New Article
              </motion.button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {wikiArticles.map((article, idx) => (
                <motion.div 
                  key={article.id} 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (idx % 10) * 0.05 }}
                  className="mc-card p-6 flex items-center justify-between border-slate-800/50 hover:border-white/10 transition-all"
                >
                  <div>
                    <h3 className="text-lg font-bold text-white">{article.title}</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">{article.category} • {article.isDraft ? "Draft" : "Published"}</p>
                  </div>
                  <div className="flex gap-4">
                    {article.isDraft && (
                      <button 
                        onClick={() => approveDraft(article)}
                        className="text-green-500 hover:text-green-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 group"
                      >
                        <RotatingIcon icon={Check} className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}
                    <button 
                      onClick={() => setEditingArticle(article)}
                      className="text-blue-500 hover:text-blue-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 group"
                    >
                      <RotatingIcon icon={Edit} className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button 
                      disabled={isProcessing}
                      onClick={() => deleteArticle(article.id)}
                      className="text-red-500 hover:text-red-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <RotatingIcon icon={X} className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} /> {isProcessing ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : adminTab === "forum" ? (
          <motion.div 
            key="forum-admin"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">Forum Categories</h2>
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setEditingCategory({ id: "", name: "", description: "", icon: "MessageSquare", order: categories.length + 1 })}
                className="bg-[var(--mc-green)] hover:bg-[var(--mc-dark-green)] text-white px-6 py-2 text-xs font-black uppercase tracking-widest rounded-lg flex items-center gap-2 transition-colors group"
              >
                <RotatingIcon icon={Plus} className="w-4 h-4" /> Add New Category
              </motion.button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {categories.map((cat, idx) => (
                <motion.div 
                  key={cat.id} 
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (idx % 10) * 0.05 }}
                  className="mc-card p-6 flex items-center justify-between border-slate-800/50 hover:border-white/10 transition-all"
                >
                  <div>
                    <h3 className="text-lg font-bold text-white">{cat.name}</h3>
                    <p className="text-xs text-slate-500 uppercase tracking-widest">{cat.description}</p>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setEditingCategory(cat)}
                      className="text-blue-500 hover:text-blue-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 group"
                    >
                      <RotatingIcon icon={Edit} className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button 
                      onClick={() => deleteCategory(cat.id)}
                      className="text-red-500 hover:text-red-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 group"
                    >
                      <RotatingIcon icon={X} className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : adminTab === "settings" ? (
          <motion.div 
            key="settings-admin"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-12"
          >
            {/* Featured Article Settings */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-4">Featured Article</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Featured Article</label>
                  <select 
                    value={siteSettings.featuredArticleId}
                    onChange={(e) => saveSiteSettings({ ...siteSettings, featuredArticleId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white focus:outline-none focus:border-[var(--mc-yellow)] rounded-lg"
                  >
                    {wikiArticles.map(article => (
                      <option key={article.id} value={article.id}>{article.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Featured Text</label>
                  <input 
                    type="text" 
                    value={siteSettings.featuredText}
                    onChange={(e) => setSiteSettings({ ...siteSettings, featuredText: e.target.value })}
                    onBlur={() => saveSiteSettings(siteSettings)}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white focus:outline-none focus:border-[var(--mc-yellow)] rounded-lg"
                    placeholder="e.g. THE HISTORY OF GALAXY SMP"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Featured Image URL</label>
                  <input 
                    type="text" 
                    value={siteSettings.featuredImage}
                    onChange={(e) => setSiteSettings({ ...siteSettings, featuredImage: e.target.value })}
                    onBlur={() => saveSiteSettings(siteSettings)}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white focus:outline-none focus:border-[var(--mc-yellow)] rounded-lg"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Wiki Categories Settings */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-4">Wiki Categories</h2>
              <div className="flex flex-wrap gap-3">
                {siteSettings.wikiCategories.map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-lg group">
                    <span className="text-white text-xs font-bold uppercase tracking-widest">{cat}</span>
                    <button 
                      onClick={() => {
                        const newCats = siteSettings.wikiCategories.filter((_, i) => i !== idx);
                        saveSiteSettings({ ...siteSettings, wikiCategories: newCats });
                      }}
                      className="text-slate-600 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => {
                    const name = prompt("Enter new category name:");
                    if (name) {
                      saveSiteSettings({ ...siteSettings, wikiCategories: [...siteSettings.wikiCategories, name] });
                    }
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Category
                </button>
              </div>
            </div>

            {/* Navigation Management */}
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-white uppercase tracking-wider">Navigation Items</h2>
                <button 
                  onClick={() => setEditingNavItem({ id: "", name: "", view: "home", icon: "Home", order: navItems.length + 1 })}
                  className="bg-[var(--mc-green)] hover:bg-[var(--mc-dark-green)] text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Nav Item
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {navItems.map(item => (
                  <div key={item.id} className="mc-card p-4 flex items-center justify-between border-slate-800/50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-900 flex items-center justify-center border border-slate-800">
                        <RotatingIcon icon={Shield} className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold">{item.name}</h4>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">View: {item.view} • Order: {item.order}</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => setEditingNavItem(item)} className="text-blue-500 hover:text-blue-400"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => deleteNavItem(item.id)} className="text-red-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tools Management */}
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <h2 className="text-xl font-bold text-white uppercase tracking-wider">Wiki Tools</h2>
                <button 
                  onClick={() => setEditingToolItem({ id: "", name: "", icon: "Plus", order: toolItems.length + 1 })}
                  className="bg-[var(--mc-green)] hover:bg-[var(--mc-dark-green)] text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Tool
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {toolItems.map(item => (
                  <div key={item.id} className="mc-card p-4 flex items-center justify-between border-slate-800/50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-900 flex items-center justify-center border border-slate-800">
                        <RotatingIcon icon={Shield} className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold">{item.name}</h4>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">Order: {item.order}</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => setEditingToolItem(item)} className="text-blue-500 hover:text-blue-400"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => deleteToolItem(item.id)} className="text-red-500 hover:text-red-400"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Nav Item Modal */}
      <AnimatePresence>
        {editingNavItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 40 }}
              className="mc-card w-full max-w-md p-8 space-y-6"
            >
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">Edit Nav Item</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Name</label>
                  <input 
                    type="text" 
                    value={editingNavItem.name}
                    onChange={(e) => setEditingNavItem({ ...editingNavItem, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">View ID</label>
                  <input 
                    type="text" 
                    value={editingNavItem.view}
                    onChange={(e) => setEditingNavItem({ ...editingNavItem, view: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Order</label>
                  <input 
                    type="number" 
                    value={editingNavItem.order}
                    onChange={(e) => setEditingNavItem({ ...editingNavItem, order: parseInt(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <button onClick={() => setEditingNavItem(null)} className="mc-button">Cancel</button>
                <button onClick={() => saveNavItem(editingNavItem)} className="mc-button-primary">Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tool Item Modal */}
      <AnimatePresence>
        {editingToolItem && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 40 }}
              className="mc-card w-full max-w-md p-8 space-y-6"
            >
              <h2 className="text-xl font-bold text-white uppercase tracking-wider">Edit Tool Item</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Name</label>
                  <input 
                    type="text" 
                    value={editingToolItem.name}
                    onChange={(e) => setEditingToolItem({ ...editingToolItem, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">URL (Optional)</label>
                  <input 
                    type="text" 
                    value={editingToolItem.url || ""}
                    onChange={(e) => setEditingToolItem({ ...editingToolItem, url: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Order</label>
                  <input 
                    type="number" 
                    value={editingToolItem.order}
                    onChange={(e) => setEditingToolItem({ ...editingToolItem, order: parseInt(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-4">
                <button onClick={() => setEditingToolItem(null)} className="mc-button">Cancel</button>
                <button onClick={() => saveToolItem(editingToolItem)} className="mc-button-primary">Save</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Article Modal */}
      <AnimatePresence>
        {editingArticle && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 40 }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
              className="mc-card w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-display text-2xl font-black text-white uppercase tracking-tight">
                  {editingArticle.id ? "Edit Article" : "New Article"}
                </h2>
                <button onClick={() => setEditingArticle(null)} className="text-slate-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Title</label>
                  <input 
                    type="text" 
                    value={editingArticle.title}
                    onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white focus:outline-none focus:border-[var(--mc-yellow)] rounded-lg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Category</label>
                    <select 
                      value={editingArticle.category}
                      onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value as any })}
                      className="w-full bg-slate-900 border border-slate-800 p-4 text-white focus:outline-none focus:border-[var(--mc-yellow)] rounded-lg"
                    >
                      {['Players', 'Items', 'Locations', 'Events', 'Guides', 'Lore'].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Image URL (Optional)</label>
                    <input 
                      type="text" 
                      value={editingArticle.imageUrl || ""}
                      onChange={(e) => setEditingArticle({ ...editingArticle, imageUrl: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 p-4 text-white focus:outline-none focus:border-[var(--mc-yellow)] rounded-lg"
                      placeholder="https://mc-heads.net/body/Player/left"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Infobox Data (Key-Value Pairs)</label>
                    <button 
                      onClick={() => {
                        const newData = { ...(editingArticle.infoboxData || {}) };
                        newData[`Field ${Object.keys(newData).length + 1}`] = "Value";
                        setEditingArticle({ ...editingArticle, infoboxData: newData });
                      }}
                      className="text-[var(--mc-yellow)] hover:text-white text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Field
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(editingArticle.infoboxData || {}).map(([key, value], idx) => (
                      <div key={idx} className="flex gap-2 items-center bg-slate-950/50 p-2 border border-slate-800 rounded-lg">
                        <input 
                          type="text" 
                          value={key}
                          onChange={(e) => {
                            const newData = { ...editingArticle.infoboxData };
                            const oldVal = newData[key];
                            delete newData[key];
                            newData[e.target.value] = oldVal;
                            setEditingArticle({ ...editingArticle, infoboxData: newData });
                          }}
                          className="w-1/3 bg-transparent border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-widest focus:outline-none focus:border-[var(--mc-yellow)]"
                        />
                        <input 
                          type="text" 
                          value={value}
                          onChange={(e) => {
                            const newData = { ...editingArticle.infoboxData };
                            newData[key] = e.target.value;
                            setEditingArticle({ ...editingArticle, infoboxData: newData });
                          }}
                          className="flex-1 bg-transparent border-b border-slate-800 text-xs text-white focus:outline-none focus:border-[var(--mc-yellow)]"
                        />
                        <button 
                          onClick={() => {
                            const newData = { ...editingArticle.infoboxData };
                            delete newData[key];
                            setEditingArticle({ ...editingArticle, infoboxData: newData });
                          }}
                          className="text-slate-600 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Content (Markdown)</label>
                  <textarea 
                    value={editingArticle.content}
                    onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
                    className="w-full h-80 bg-slate-900 border border-slate-800 p-4 text-white focus:outline-none focus:border-[var(--mc-yellow)] resize-none rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setEditingArticle(null)} 
                  className="px-8 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white"
                >
                  Cancel
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  disabled={isProcessing}
                  onClick={() => saveArticle(editingArticle)}
                  className="bg-[var(--mc-yellow)] text-slate-900 px-10 py-3 text-xs font-black uppercase tracking-widest rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 group"
                >
                  {isProcessing && <RotatingIcon icon={Loader2} className="w-4 h-4 animate-spin" />}
                  {isProcessing ? "Saving..." : "Save Article"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingCategory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 40 }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
              className="mc-card w-full max-w-2xl p-8 space-y-8"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-display text-2xl font-black text-white uppercase tracking-tight">
                  {editingCategory.id ? "Edit Category" : "New Category"}
                </h2>
                <button onClick={() => setEditingCategory(null)} className="text-slate-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Name</label>
                  <input 
                    type="text" 
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white focus:outline-none focus:border-[var(--mc-yellow)] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Description</label>
                  <textarea 
                    value={editingCategory.description}
                    onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                    className="w-full h-32 bg-slate-900 border border-slate-800 p-4 text-white focus:outline-none focus:border-[var(--mc-yellow)] resize-none rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Icon (Lucide Name)</label>
                  <input 
                    type="text" 
                    value={editingCategory.icon}
                    onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white focus:outline-none focus:border-[var(--mc-yellow)] rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setEditingCategory(null)} 
                  className="px-8 py-3 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-white"
                >
                  Cancel
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => saveCategory(editingCategory)}
                  className="bg-[var(--mc-yellow)] text-slate-900 px-10 py-3 text-xs font-black uppercase tracking-widest rounded-lg"
                >
                  Save Category
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    );
  };

  const renderHome = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
      className="max-w-6xl mx-auto px-4 py-12 space-y-8"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar */}
        <aside className="lg:col-span-3 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setView('wiki')}
            className="mc-card p-8 text-center group cursor-pointer border-slate-800/50 hover:border-white/20 transition-all"
          >
            <div className="flex items-center justify-center gap-3 mb-2">
              <RotatingIcon icon={Compass} className="w-5 h-5 text-white" />
              <h3 className="font-display text-xl font-black text-white uppercase tracking-tight">WIKI INDEX</h3>
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="w-8 h-px bg-slate-800" />
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">EXPLORE ALL</p>
              <div className="w-8 h-px bg-slate-800" />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mc-card p-8 border-slate-800/50"
          >
            <h3 className="font-display text-xs font-bold text-yellow-500 mb-6 uppercase tracking-[0.3em] flex items-center gap-2">
              <RotatingIcon icon={Book} className="w-4 h-4" /> WIKI STATS
            </h3>
            <div className="space-y-4 text-xs font-bold">
              <div className="flex justify-between">
                <span className="text-slate-600 uppercase">Total Articles:</span>
                <span className="text-white">{wikiArticles.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 uppercase">Recent Edits:</span>
                <span className="text-white">12 Today</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 uppercase">Contributors:</span>
                <span className="text-white">48 Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 uppercase">Drafts Pending:</span>
                <span className="text-yellow-500">3 Reviews</span>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mc-card p-8 border-slate-800/50"
          >
            <div className="flex items-center justify-between mb-6 group">
              <h3 className="font-display text-xs font-bold text-yellow-500 uppercase tracking-[0.3em] flex items-center gap-2">
                <RotatingIcon icon={MessageSquare} className="w-4 h-4" /> FORUM STATS
              </h3>
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
            </div>
            <div className="space-y-4 text-xs font-bold">
              <div className="flex justify-between">
                <span className="text-slate-600 uppercase">Total Topics:</span>
                <span className="text-white">1,248</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 uppercase">Total Posts:</span>
                <span className="text-white">8,942</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 uppercase">Active Users:</span>
                <span className="text-white">156 Online</span>
              </div>
              <button 
                onClick={() => {
                  setView("forum");
                  toast.info("Showing trending topics!");
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-lg transition-all group mt-2"
              >
                <RotatingIcon icon={TrendingUp} className="w-4 h-4" /> View Trending
              </button>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.3 }}
            whileHover={{ scale: 1.05, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (siteSettings.featuredArticleId) {
                setSelectedWiki(siteSettings.featuredArticleId);
                setView("wiki");
              }
            }}
            className="mc-card overflow-hidden border-none bg-gradient-to-br from-blue-400 to-cyan-500 p-6 flex items-center gap-6 group cursor-pointer"
          >
            <div className="w-16 h-16 bg-slate-900/20 rounded-none p-2">
              <img 
                src={siteSettings.featuredImage || "https://mc-heads.net/body/Dream/left"} 
                alt="Featured Article" 
                className="w-full h-full object-contain" 
                referrerPolicy="no-referrer" 
              />
            </div>
            <div>
              <h3 className="font-display text-sm font-black text-white uppercase tracking-tight flex items-center gap-2">
                <RotatingIcon icon={Award} className="w-4 h-4" /> FEATURED ARTICLE
              </h3>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1">{siteSettings.featuredText || "The history of Galaxy SMP."}</p>
            </div>
          </motion.div>
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-9 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mc-card p-12 border-slate-800/50"
          >
            <h2 className="font-display text-xs font-bold text-slate-500 mb-2 uppercase tracking-[0.4em]">WELCOME TO THE OFFICIAL</h2>
            <h1 className="font-display text-4xl font-black text-white mb-6 tracking-tight uppercase">GALAXY SMP WIKI</h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl">
              Welcome to the official Galaxy SMP Wiki. Discover the lore, mechanics, and history of our universe. Crafted for players who want to dive deep into the galaxy.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mc-card p-12 border-slate-800/50"
          >
            <h3 className="font-display text-xs font-bold text-yellow-500 mb-6 uppercase tracking-[0.3em] flex items-center gap-2 group">
              <RotatingIcon icon={Info} className="w-4 h-4" /> WIKI GUIDELINES
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Learn how to contribute to the wiki and maintain our high standards of documentation. Our community is built on shared knowledge!<br />
              The quickest way to ask questions or get help is to join our discord.
            </p>
            <button 
              onClick={() => window.open('https://discord.gg/gsmp', '_blank')}
              className="bg-[#5865f2] hover:bg-[#4752c4] hover:scale-105 text-white px-10 py-4 text-xs font-black uppercase tracking-widest flex items-center gap-3 rounded-lg transition-all group"
            >
              <RotatingIcon icon={MessageSquare} className="w-5 h-5" /> Wiki Discord
            </button>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mc-card p-10 border-l-4 border-l-[#ef4444]"
            >
              <h3 className="font-display text-xs font-bold text-red-500 mb-6 uppercase tracking-[0.3em] flex items-center gap-2 group">
                <RotatingIcon icon={Shield} className="w-4 h-4" /> SERVER RULES
              </h3>
              <p className="text-slate-400 text-xs mb-8 leading-relaxed">Read the official rules of Galaxy SMP.</p>
              <button 
                onClick={() => {
                  const rulesArticle = wikiArticles.find(a => a.title.toLowerCase().includes('rules'));
                  if (rulesArticle) {
                    setSelectedWiki(rulesArticle.id);
                    setView("wiki");
                  } else {
                    toast.info("Rules article not found. Check back later!");
                  }
                }}
                className="w-full bg-[#ef4444] hover:bg-[#dc2626] hover:scale-105 text-white py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-lg transition-all group"
              >
                <RotatingIcon icon={FileText} className="w-4 h-4" /> View Rules
              </button>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mc-card p-10 border-l-4 border-l-[#22c55e]"
            >
              <h3 className="font-display text-xs font-bold text-green-500 mb-6 uppercase tracking-[0.3em] flex items-center gap-2 group">
                <RotatingIcon icon={Book} className="w-4 h-4" /> WIKI LORE
              </h3>
              <p className="text-slate-400 text-xs mb-8 leading-relaxed">Explore the deep history of the Galaxy universe.</p>
              <button 
                onClick={() => {
                  const loreArticle = wikiArticles.find(a => a.category.toLowerCase() === 'lore');
                  if (loreArticle) {
                    setSelectedWiki(loreArticle.id);
                    setView("wiki");
                  } else {
                    toast.info("Lore articles coming soon!");
                  }
                }}
                className="w-full bg-[#22c55e] hover:bg-[#16a34a] hover:scale-105 text-white py-3 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 rounded-lg transition-all group"
              >
                <RotatingIcon icon={Book} className="w-4 h-4" /> Read Lore
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderMap = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
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
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
      className="max-w-7xl mx-auto py-16 px-4 space-y-10"
    >
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Main Forum Content */}
        <div className="flex-1 space-y-10">
          <div className="flex items-center justify-between border-b border-slate-800 pb-8 group">
            <h2 className="text-white font-display font-black text-4xl tracking-tight flex items-center gap-4">
              <RotatingIcon icon={MessageSquare} className="w-10 h-10 text-blue-500" />
              COMMUNITY FORUM
            </h2>
            {selectedCategory && (
              <button 
                onClick={() => setSelectedCategory(null)}
                className="mc-button flex items-center gap-2 group"
              >
                <RotatingIcon icon={ArrowLeft} className="w-4 h-4" /> Back to Categories
              </button>
            )}
          </div>

          {!selectedCategory ? (
            <div className="grid grid-cols-1 gap-4">
              <AnimatePresence mode="popLayout">
                {categories.map((cat, idx) => (
                    <motion.button 
                      key={cat.id}
                      layout
                      initial={{ opacity: 0, x: idx % 2 === 0 ? -40 : 40 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      whileHover={{ scale: 1.02, x: 10 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ 
                        duration: 0.6,
                        delay: (idx % 4) * 0.1,
                        ease: "easeOut"
                      }}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="w-full mc-card p-8 flex items-center gap-8 text-left group border-slate-800/50 hover:border-blue-500/30 transition-all"
                    >
                    <div className="w-16 h-16 bg-slate-900 rounded-none flex items-center justify-center border border-slate-800 group-hover:border-blue-500/30 transition-all group">
                      <RotatingIcon icon={MessageSquare} className="w-8 h-8 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="text-white font-display font-bold text-xl mb-1 group-hover:text-blue-400 transition-colors">{cat.name}</h4>
                        {profile?.role === 'admin' && (
                          <div className="flex gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCategory(cat);
                                setView("admin");
                                setAdminTab("forum");
                              }}
                              className="p-2 text-blue-500/50 hover:text-blue-500 transition-colors group"
                              title="Edit Category"
                            >
                              <RotatingIcon icon={Edit} className="w-5 h-5" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCategory(cat.id);
                              }}
                              className="p-2 text-red-500/50 hover:text-red-500 transition-colors group"
                              title="Delete Category"
                            >
                              <RotatingIcon icon={X} className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-slate-500 text-sm font-medium">{cat.description}</p>
                    </div>
                    <RotatingIcon icon={ChevronRight} className="w-6 h-6 text-slate-700 group-hover:text-[var(--mc-green)] transition-all" />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-6">
                <h3 className="text-slate-500 font-display font-bold text-xs uppercase tracking-[0.2em]">THREADS</h3>
                {user && (
                  <button 
                    onClick={() => toast.info("Thread creation coming soon!")}
                    className="text-[var(--mc-green)] font-bold text-xs hover:underline flex items-center gap-2 uppercase tracking-widest group"
                  >
                    <RotatingIcon icon={Plus} className="w-4 h-4" /> NEW THREAD
                  </button>
                )}
              </div>
              {threads.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mc-card p-20 text-center border-dashed border-slate-800"
                >
                  <p className="text-slate-600 italic font-medium">No threads yet. Be the first to start a discussion!</p>
                </motion.div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {threads.map((thread, idx) => (
                        <motion.div 
                          key={thread.id} 
                          layout
                          initial={{ opacity: 0, x: -50 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true, margin: "-20px" }}
                          whileHover={{ scale: 1.01, x: 5 }}
                          whileTap={{ scale: 0.99 }}
                          transition={{ 
                            duration: 0.4,
                            delay: (idx % 6) * 0.05,
                            ease: "easeOut"
                          }}
                          className="mc-card p-8 group cursor-pointer border-slate-800/50 hover:border-blue-500/20 transition-all"
                        >
                        <h4 className="text-white font-bold text-lg mb-4 group-hover:text-[var(--mc-green)] transition-colors leading-snug">{thread.title}</h4>
                        <div className="flex items-center gap-6 text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                          <span className="flex items-center gap-2"><RotatingIcon icon={UserIcon} className="w-3.5 h-3.5" /> {thread.authorName}</span>
                          <span className="flex items-center gap-2"><RotatingIcon icon={Clock} className="w-3.5 h-3.5" /> {formatDistanceToNow(thread.createdAt.toDate())} AGO</span>
                          <span className="text-[var(--mc-green)] bg-green-500/5 px-2 py-1 rounded-none">{thread.postCount} POSTS</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
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
            {SAMPLE_PLAYERS.map((player, idx) => (
              <motion.div 
                key={player.uid} 
                initial={{ opacity: 0, x: idx % 2 === 0 ? -50 : 50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ 
                  duration: 0.6,
                  delay: (idx % 4) * 0.1,
                  ease: "easeOut"
                }}
                className="mc-card group overflow-hidden border-slate-800/50"
              >
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

                  <button 
                    onClick={() => toast.info(`Viewing profile for ${player.displayName} coming soon!`)}
                    className="w-full mc-button"
                  >
                    View Profile
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Players Sidebar */}
        <aside className="w-full lg:w-72 space-y-12">
          <div className="mc-card p-8 border-slate-800/50">
            <h3 className="font-display text-[10px] font-bold text-slate-600 mb-6 uppercase tracking-[0.3em] flex items-center gap-2">
              <RotatingIcon icon={Users} className="w-3 h-3" /> COMMUNITY STATS
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Total Members</span>
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">12,482</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Active Today</span>
                <span className="text-[10px] font-bold text-[var(--mc-green)] uppercase tracking-widest">842</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">Forum Threads</span>
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">1,248</span>
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
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
        className="max-w-7xl mx-auto py-10 px-4 pb-32"
      >
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Left Sidebar: Traditional Wiki Sidebar */}
          <aside className="w-full lg:w-56 flex-shrink-0">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="wiki-sidebar-group"
            >
              <h3 className="wiki-sidebar-title">NAVIGATION</h3>
              <nav className="space-y-0.5">
                <motion.button 
                  whileHover={{ x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedWiki(null)}
                  className={cn("wiki-sidebar-link group w-full text-left", !selectedWiki && "active")}
                >
                  <RotatingIcon icon={Layout} className="w-3.5 h-3.5" />
                  Wiki Home
                </motion.button>
                <motion.button 
                  whileHover={{ x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toast.info("Recent changes coming soon!")}
                  className="wiki-sidebar-link group w-full text-left"
                >
                  <RotatingIcon icon={TrendingUp} className="w-3.5 h-3.5" />
                  Recent Changes
                </motion.button>
                <motion.button 
                  whileHover={{ x: 5 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (wikiArticles.length > 0) {
                      const randomIdx = Math.floor(Math.random() * wikiArticles.length);
                      setSelectedWiki(wikiArticles[randomIdx].id);
                    } else {
                      toast.info("No articles available yet!");
                    }
                  }}
                  className="wiki-sidebar-link group w-full text-left"
                >
                  <RotatingIcon icon={Compass} className="w-3.5 h-3.5" />
                  Random Page
                </motion.button>
              </nav>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="wiki-sidebar-group"
            >
              <h3 className="wiki-sidebar-title">CATEGORIES</h3>
              <nav className="space-y-0.5">
                {(siteSettings.wikiCategories.length > 0 ? siteSettings.wikiCategories : ["Lore", "Mechanics", "History", "Players", "Maps"]).map(cat => (
                  <button 
                    key={cat}
                    onClick={() => {
                      setWikiCategoryFilter(cat);
                      setSelectedWiki(null);
                    }}
                    className={cn("wiki-sidebar-link group", wikiCategoryFilter === cat && "active")}
                  >
                    <RotatingIcon icon={Tag} className="w-3.5 h-3.5" />
                    {cat}
                  </button>
                ))}
              </nav>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="wiki-sidebar-group"
            >
              <h3 className="wiki-sidebar-title">TOOLS</h3>
              <nav className="space-y-0.5">
                {toolItems.length > 0 ? toolItems.sort((a, b) => a.order - b.order).map(item => (
                  <button 
                    key={item.id}
                    onClick={() => {
                      if (item.name === "Create Article") setIsDrafting(true);
                      else if (item.url) window.open(item.url, '_blank');
                      else toast.info(`${item.name} coming soon!`);
                    }}
                    className={cn("wiki-sidebar-link group", item.name === "Create Article" && "text-[var(--mc-green)]")}
                  >
                    <RotatingIcon icon={item.icon} className="w-3.5 h-3.5" />
                    {item.name}
                  </button>
                )) : (
                  <>
                    <button 
                      onClick={() => setIsDrafting(true)}
                      className="wiki-sidebar-link text-[var(--mc-green)] group"
                    >
                      <RotatingIcon icon={Plus} className="w-3.5 h-3.5" />
                      Create Article
                    </button>
                    <button 
                      onClick={() => toast.info("Link tracking coming soon!")}
                      className="wiki-sidebar-link group"
                    >
                      <RotatingIcon icon={FileText} className="w-3.5 h-3.5" />
                      What links here
                    </button>
                  </>
                )}
              </nav>
            </motion.div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {!selectedWiki ? (
              <div className="space-y-12">
                <div className="border-b border-slate-800 pb-8 flex items-center justify-between gap-6">
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex items-center gap-6"
                  >
                    <div className="w-16 h-16 bg-yellow-500/20 rounded-xl flex items-center justify-center border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.2)] flex-shrink-0">
                      <img 
                        src="https://mc-heads.net/avatar/Notch/96" 
                        alt="Wiki Logo" 
                        className="w-10 h-10"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div>
                      <h2 className="font-display text-4xl font-black text-white tracking-tight mb-2 leading-tight">
                        {wikiCategoryFilter ? `${wikiCategoryFilter.toUpperCase()} ARTICLES` : "GALAXY SMP WIKI"}
                      </h2>
                      <p className="text-slate-500 max-w-2xl leading-relaxed text-sm">
                        {wikiCategoryFilter 
                          ? `Browsing all articles in the ${wikiCategoryFilter} category.`
                          : `Welcome to the official community-driven encyclopedia for the Galaxy SMP. We currently have ${wikiArticles.length} articles being maintained by the community.`
                        }
                      </p>
                    </div>
                  </motion.div>
                  {wikiCategoryFilter && (
                    <button 
                      onClick={() => setWikiCategoryFilter(null)}
                      className="text-xs font-bold text-[var(--mc-green)] hover:underline uppercase tracking-widest flex items-center gap-2 group"
                    >
                      <RotatingIcon icon={X} className="w-3 h-3" /> View All Articles
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <AnimatePresence mode="popLayout">
                    {wikiArticles
                      .filter(a => !a.isDraft)
                      .filter(a => !wikiCategoryFilter || a.category === wikiCategoryFilter)
                      .map((article, idx) => (
                        <motion.button 
                          key={article.id}
                          layout
                          initial={{ opacity: 0, x: idx % 2 === 0 ? -30 : 30 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true, margin: "-50px" }}
                          whileHover={{ scale: 1.03, y: -5 }}
                          whileTap={{ scale: 0.98 }}
                          transition={{ 
                            duration: 0.5,
                            delay: (idx % 4) * 0.1,
                            ease: "easeOut"
                          }}
                          onClick={() => setSelectedWiki(article.id)}
                          className="mc-card p-8 text-left group border-slate-800/50 hover:border-[var(--mc-green)]/30 transition-all duration-300 hover:shadow-[0_0_30px_rgba(34,197,94,0.1)]"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 bg-yellow-500/20 rounded-full flex items-center justify-center border border-yellow-500/30">
                                <img 
                                  src="https://mc-heads.net/avatar/Notch/48" 
                                  alt="Contributor" 
                                  className="w-3.5 h-3.5"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                              <span className="text-[10px] font-bold text-[var(--mc-green)] uppercase tracking-[0.2em]">{article.category}</span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest">{formatDistanceToNow(article.updatedAt.toDate())} ago</span>
                          </div>
                          <h4 className="text-white font-bold text-xl mb-4 group-hover:text-[var(--mc-green)] transition-colors leading-snug">{article.title}</h4>
                          <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">{article.content.replace(/[#*`]/g, '')}</p>
                        </motion.button>
                      ))}
                  </AnimatePresence>
                </div>
              </div>
            ) : currentArticle ? (
              <motion.div 
                key={selectedWiki}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="wiki-content"
              >
                {/* Wiki Header Tabs */}
                <div className="flex items-center justify-between border-b border-slate-800 mb-10">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setView("wiki")}
                      className="px-6 py-3 text-xs font-bold text-white border-b-2 border-[var(--mc-green)] uppercase tracking-widest"
                    >
                      Read
                    </button>
                    <button 
                      onClick={() => {
                        if (profile?.role === 'admin') {
                          setEditingArticle(currentArticle);
                          setView("admin");
                          setAdminTab("wiki");
                        } else {
                          toast.error("Only admins can edit articles directly.");
                        }
                      }}
                      className="px-6 py-3 text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => toast.info("Article history coming soon!")}
                      className="px-6 py-3 text-xs font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
                    >
                      View History
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(window.location.href);
                        toast.success("Link copied to clipboard!");
                      }}
                      className="p-2 text-slate-500 hover:text-white transition-colors group"
                    >
                      <RotatingIcon icon={Share2} className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(currentArticle.content);
                        toast.success("Markdown content copied!");
                      }}
                      className="p-2 text-slate-500 hover:text-white transition-colors group"
                    >
                      <RotatingIcon icon={Copy} className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-col xl:flex-row gap-12">
                  <div className="flex-1 min-w-0">
                    <h1 className="flex items-center justify-between group">
                      {currentArticle.title}
                      {profile?.role === 'admin' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setEditingArticle(currentArticle);
                              setView("admin");
                              setAdminTab("wiki");
                            }}
                            className="p-2 text-blue-500/50 hover:text-blue-500 transition-colors group"
                            title="Edit Article"
                          >
                            <RotatingIcon icon={Edit} className="w-6 h-6" />
                          </button>
                          <button 
                            disabled={isProcessing}
                            onClick={() => deleteArticle(currentArticle.id)}
                            className="p-2 text-red-500/50 hover:text-red-500 transition-colors group disabled:opacity-50"
                            title="Delete Article"
                          >
                            <RotatingIcon icon={X} className={`w-6 h-6 ${isProcessing ? 'animate-spin' : ''}`} />
                          </button>
                        </div>
                      )}
                    </h1>
                    
                    <div className="article-meta">
                      <span className="flex items-center gap-2">
                        <div className="w-5 h-5 bg-yellow-500/20 rounded-full flex items-center justify-center border border-yellow-500/30">
                          <img 
                            src="https://mc-heads.net/avatar/Notch/48" 
                            alt="Contributor" 
                            className="w-3.5 h-3.5"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <RotatingIcon icon={UserIcon} className="w-3.5 h-3.5" /> {currentArticle.lastUpdatedBy}
                      </span>
                      <span className="w-1 h-1 bg-slate-800 rounded-full" />
                      <span className="flex items-center gap-2"><RotatingIcon icon={Clock} className="w-3.5 h-3.5" /> Last updated {formatDistanceToNow(currentArticle.updatedAt.toDate())} ago</span>
                    </div>

                    {/* Table of Contents */}
                    <motion.div 
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="wiki-toc"
                    >
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
                    </motion.div>

                    <div className="prose prose-invert max-w-none">
                      <ReactMarkdown>{currentArticle.content}</ReactMarkdown>
                    </div>

                    {currentArticle.coordinates && (
                      <motion.div 
                        id="coordinates" 
                        initial={{ y: 20, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                        className="mt-20 p-10 mc-card bg-slate-900/30 border-dashed border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8"
                      >
                        <div className="flex items-center gap-8">
                          <div className="w-16 h-16 bg-slate-800 rounded-none flex items-center justify-center border border-slate-700 shadow-xl">
                            <RotatingIcon icon={MapPin} className="w-8 h-8 text-[var(--mc-green)]" />
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
                            toast.success("Teleport command copied!");
                          }}
                          className="mc-button-primary px-8 py-3 flex items-center gap-2 group"
                        >
                          <RotatingIcon icon={Copy} className="w-4 h-4" /> Copy Teleport Command
                        </button>
                      </motion.div>
                    )}

                    {/* Categories Footer */}
                    <div className="mt-20 pt-8 border-t border-slate-800 flex items-center gap-4">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Categories:</span>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => toast.info(`Filtering by ${currentArticle.category} coming soon!`)}
                          className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-none text-[10px] font-bold text-slate-400 hover:text-white hover:scale-105 transition-all uppercase tracking-widest"
                        >
                          {currentArticle.category}
                        </button>
                        <button 
                          onClick={() => toast.info("Filtering by Galaxy SMP coming soon!")}
                          className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-none text-[10px] font-bold text-slate-400 hover:text-white hover:scale-105 transition-all uppercase tracking-widest"
                        >
                          Galaxy SMP
                        </button>
                        <button 
                          onClick={() => toast.info("Filtering by Community Content coming soon!")}
                          className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-none text-[10px] font-bold text-slate-400 hover:text-white hover:scale-105 transition-all uppercase tracking-widest"
                        >
                          Community Content
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Sidebar: Infobox */}
                  {currentArticle.infoboxData && (
                    <aside className="w-full xl:w-72 flex-shrink-0">
                      <motion.div 
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="infobox sticky top-24"
                      >
                        <div className="infobox-header">{currentArticle.title}</div>
                        {currentArticle.imageUrl && (
                          <div className="p-4 bg-slate-950/50 border-b border-slate-800">
                            <motion.img 
                              whileHover={{ scale: 1.05 }}
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
                      </motion.div>
                    </aside>
                  )}
                </div>
              </motion.div>
            ) : null}
          </main>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-300">
      <Toaster position="top-center" richColors />
      {/* Top Bar */}
      <div className="bg-white/5 border-b border-slate-800/50 backdrop-blur-sm py-0 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center justify-center flex-1">
            <motion.button 
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setView("home")} 
              className="nav-link active group"
            >
              <RotatingIcon icon={Home} className="w-4 h-4" /> Home
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => window.open('https://discord.gg/gsmp', '_blank')} 
              className="nav-link group"
            >
              <RotatingIcon icon={MessageSquare} className="w-4 h-4" /> Discord
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSearchOpen(true)}
              className="nav-link group"
            >
              <RotatingIcon icon={Search} className="w-4 h-4" /> Search
            </motion.button>
          </div>
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={user ? logOut : handleSignIn}
            className="text-[10px] font-black text-white hover:text-[var(--mc-yellow)] transition-colors uppercase tracking-[0.2em] px-6"
          >
            {user ? "LOGOUT" : "LOGIN"}
          </motion.button>
        </div>
      </div>

      {/* Main Header */}
      <header className="bg-[#1a1a1a] py-16 px-6 border-b border-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0%,transparent_70%)]" />
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
          {/* Left Side: Wiki Contributor */}
          <div className="flex items-center gap-6 order-2 md:order-1">
            <div className="w-20 h-20 bg-yellow-500/20 hexagon-frame flex items-center justify-center border border-[var(--mc-yellow)] shadow-[0_0_30px_rgba(242,213,126,0.4)] group">
              <img 
                src="https://mc-heads.net/avatar/Notch/144" 
                alt="Wiki Contributor" 
                className="w-16 h-16 hexagon-frame transition-all duration-500 hover:scale-110 drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="text-center md:text-left">
              <h4 className="text-white font-display font-black text-lg uppercase tracking-tight">WIKI <span className="text-slate-400">Contributor</span></h4>
              <motion.button 
                onClick={handleSignIn} 
                animate={{ 
                  scale: [1, 1.05, 1],
                  textShadow: [
                    "0 0 0px rgba(234,179,8,0)",
                    "0 0 10px rgba(234,179,8,0.5)",
                    "0 0 0px rgba(234,179,8,0)"
                  ]
                }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-[11px] font-bold text-yellow-500 hover:text-yellow-400 flex items-center gap-2 uppercase tracking-widest transition-colors group"
              >
                <RotatingIcon icon={LogIn} className="w-3.5 h-3.5" /> Login to edit articles
              </motion.button>
            </div>
          </div>

          {/* Center Logo: Galaxy SMP */}
          <div className="flex flex-col items-center gap-2 order-1 md:order-2 cursor-pointer group" onClick={() => setView("home")}>
            <div className="relative">
              <div className="w-32 h-32 bg-slate-900 flex items-center justify-center relative">
                {/* Portal Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-blue-600/20 animate-pulse rounded-full blur-xl" />
                <div className="w-24 h-24 bg-slate-950 rounded-full border-4 border-blue-500/30 flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.4)] transition-shadow duration-500 group-hover:shadow-[0_0_70px_rgba(59,130,246,0.6)]">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full animate-spin-slow flex items-center justify-center">
                    <div className="w-8 h-8 bg-slate-950 rounded-full" />
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <h1 className="font-display text-4xl font-black text-white tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">GALAXY</h1>
                <div className="bg-blue-600 px-6 py-1 text-xs font-black text-white uppercase tracking-[0.3em] shadow-[0_0_20px_rgba(37,99,235,0.5)]">SMP</div>
              </div>
            </div>
          </div>          {/* Right Side: Community Forum */}
          <div className="flex items-center gap-6 order-3">
            <div className="text-center md:text-right group">
              <h4 className="text-white font-display font-black text-lg uppercase tracking-tight flex items-center justify-end gap-3">
                <RotatingIcon icon={MessageSquare} className="w-5 h-5 text-slate-400" /> COMMUNITY FORUM
              </h4>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Join the discussion</p>
            </div>
            <div className="w-20 h-20 bg-blue-500/20 hexagon-frame flex items-center justify-center border border-blue-500 shadow-[0_0_30px_rgba(59,130,246,0.4)] group">
              <img 
                src="/input_file_2.png" 
                alt="Community Forum" 
                className="w-16 h-16 hexagon-frame transition-all duration-500 hover:scale-110 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.src = "https://mc-heads.net/avatar/Steve/64";
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Nav */}
      <nav className="bg-white/5 border-b border-slate-800/50 backdrop-blur-md sticky top-0 z-50 shadow-lg">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-center">
          {(navItems.length > 0 ? navItems.sort((a, b) => a.order - b.order) : [
            { id: 'wiki', name: 'Wiki', view: 'wiki', icon: Book },
            { id: 'forum', name: 'Forum', view: 'forum', icon: MessageSquare },
          ]).map(item => (
            <button
              key={item.id || item.name}
              onClick={() => setView(item.view as any)}
              className={cn("nav-link relative group", view === item.view && "active")}
            >
              <motion.div
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2"
              >
                <RotatingIcon icon={item.icon} className="w-4 h-4" />
                {item.name}
              </motion.div>
              {view === item.view && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--mc-green)]"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {view === "home" && renderHome()}
          {view === "forum" && renderForum()}
          {view === "wiki" && renderWiki()}
          {view === "admin" && renderAdmin()}
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
              ].map(item => (
                <button
                  key={item.name}
                  onClick={() => {
                    if (item.view === 'admin' && !isAdminAuthenticated) {
                      setShowAdminLogin(true);
                    } else {
                      setView(item.view as any);
                    }
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn("text-2xl font-display font-black uppercase tracking-widest flex items-center gap-4", view === item.view ? "text-[var(--mc-green)]" : "text-white")}
                >
                  <RotatingIcon icon={item.icon} className="w-8 h-8" />
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
              initial={{ scale: 0.8, opacity: 0, y: -40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -40 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.4 }}
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
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 40 }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
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
            {isDevMode && (
              <button 
                onClick={() => window.location.href = '/admin.html'}
                className="text-[10px] text-slate-600 hover:text-[var(--mc-yellow)] font-bold uppercase tracking-[0.2em] mb-4 transition-colors flex items-center justify-center md:justify-end gap-2"
              >
                <Shield className="w-3 h-3" /> Admin Panel
              </button>
            )}
            <p 
              onClick={handleDevModeClick}
              className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em] cursor-default select-none"
            >
              © 2026 GALAXY SMP NETWORK
            </p>
            <p className="text-[8px] text-slate-700 mt-3 uppercase tracking-widest leading-relaxed">Not an official Minecraft product. Not approved by or associated with Mojang or Microsoft.</p>
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLoginModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 40 }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
              className="w-full max-w-md bg-[#1a1a1a] border border-slate-800 p-8 relative z-10 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="font-display text-2xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                  <RotatingIcon icon={LogIn} className="w-6 h-6 text-yellow-500" />
                  {isSignUp ? "Create Account" : "Login"}
                </h2>
                <button onClick={() => setIsLoginModalOpen(false)} className="text-slate-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleEmailAuth} className="space-y-6">
                {isSignUp && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Display Name</label>
                    <input 
                      type="text"
                      required
                      value={loginName}
                      onChange={(e) => setLoginName(e.target.value)}
                      className="w-full bg-black/40 border border-slate-800 p-3 text-white text-sm focus:outline-none focus:border-yellow-500/50 transition-colors"
                      placeholder="Your Minecraft Name"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
                  <input 
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-black/40 border border-slate-800 p-3 text-white text-sm focus:outline-none focus:border-yellow-500/50 transition-colors"
                    placeholder="steve@minecraft.net"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Password</label>
                  <input 
                    type="password"
                    required
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    className="w-full bg-black/40 border border-slate-800 p-3 text-white text-sm focus:outline-none focus:border-yellow-500/50 transition-colors"
                    placeholder="••••••••"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-[#f2d57e] hover:bg-[#e5c76d] text-slate-900 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotatingIcon icon={LogIn} className="w-4 h-4" />}
                  {isSignUp ? "Create Account" : "Login Manually"}
                </button>
              </form>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800"></div>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                  <span className="bg-[#1a1a1a] px-4 text-slate-500 font-bold">Or continue with</span>
                </div>
              </div>

              <button 
                onClick={handleGoogleSignIn}
                className="w-full bg-white hover:bg-slate-100 text-slate-900 py-4 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all"
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                Google Account
              </button>

              <p className="mt-8 text-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}
                <button 
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="ml-2 text-yellow-500 hover:underline"
                >
                  {isSignUp ? "Login here" : "Sign up here"}
                </button>
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showAdminLogin && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mc-card w-full max-w-md p-8 space-y-8 border-slate-800"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-display text-2xl font-black text-white uppercase tracking-tight">Admin Login</h2>
                <button onClick={() => setShowAdminLogin(false)} className="text-slate-500 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Username</label>
                  <input 
                    type="text" 
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white focus:outline-none focus:border-[var(--mc-yellow)] rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Password</label>
                  <input 
                    type="password" 
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 p-4 text-white focus:outline-none focus:border-[var(--mc-yellow)] rounded-lg"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-[var(--mc-yellow)] text-slate-900 py-4 text-xs font-black uppercase tracking-widest rounded-lg"
                >
                  Access Admin Panel
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
