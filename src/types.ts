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
  category: string;
  isDraft: boolean;
  authorUid?: string;
  lastUpdatedBy: string;
  updatedAt: Timestamp;
}
