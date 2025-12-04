
export enum Category {
  Food = 'Food',
  Travel = 'Travel',
  Fashion = 'Fashion',
  Technology = 'Technology',
  Lifestyle = 'Lifestyle'
}

export enum BlockType {
  Paragraph = 'paragraph',
  Heading1 = 'h1',
  Heading2 = 'h2',
  Image = 'image',
  Quote = 'quote',
  List = 'list'
}

export interface ContentBlock {
  id: string;
  type: BlockType;
  content: string;
  // For images
  src?: string;
  width?: number; // percentage
  caption?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  coverImage: string;
  category: Category;
  tags: string[];
  blocks: ContentBlock[];
  author: string;
  publishedAt: string; // ISO date string
  status: 'draft' | 'published';
  views: number;
  // Computed fields from DB
  likesCount?: number; 
}

export interface SiteSettings {
  aboutImage: string;
  heroImage: string;
  siteName: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isAdmin?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
}

export type ViewState = 
  | { type: 'home' }
  | { type: 'post', postId: string }
  | { type: 'about' }
  | { type: 'login' }
  | { type: 'register' }
  | { type: 'admin-dashboard' }
  | { type: 'admin-editor', postId?: string }
  | { type: 'admin-settings' };
