import { Timestamp } from "firebase/firestore";

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'user';
}

export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  order: number;
}

export interface ForumThread {
  id: string;
  categoryId: string;
  title: string;
  authorUid: string;
  authorName: string;
  createdAt: Timestamp;
  lastPostAt: Timestamp;
  postCount: number;
}

export interface ForumPost {
  id: string;
  threadId: string;
  content: string;
  authorUid: string;
  authorName: string;
  createdAt: Timestamp;
}

export interface WikiArticle {
  id: string;
  title: string;
  content: string;
  category: 'Players' | 'Items' | 'Locations' | 'Events' | 'Guides' | 'Lore';
  isDraft: boolean;
  authorUid?: string;
  lastUpdatedBy: string;
  updatedAt: Timestamp;
  infoboxData?: Record<string, string>;
  coordinates?: { x: number; y: number; z: number };
  imageUrl?: string;
}

export interface PlayerStats {
  kills: number;
  deaths: number;
  playtime: string;
  joinDate: Timestamp;
  skinUrl?: string;
}

export interface Player {
  uid: string;
  username: string;
  displayName: string;
  rank: string;
  stats: PlayerStats;
  bio: string;
  baseLocation?: { x: number; y: number; z: number };
}

export interface MapInfo {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  author: string;
  createdAt: Timestamp;
}

export interface NavItem {
  id: string;
  name: string;
  view: string;
  icon: string;
  order: number;
}

export interface ToolItem {
  id: string;
  name: string;
  url?: string;
  icon: string;
  order: number;
  action?: string;
}

export interface SiteSettings {
  featuredArticleId: string;
  featuredImage: string;
  featuredText: string;
  wikiCategories: string[];
}
