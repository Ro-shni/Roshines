
export enum Category {
  Food = 'Food',
  Travel = 'Travel',
  Fashion = 'Fashion',
  Technology = 'Technology',
  Lifestyle = 'Lifestyle',
  Journal = 'Journal'
}

export enum BlockType {
  Paragraph = 'paragraph',
  Heading1 = 'h1',
  Heading2 = 'h2',
  Heading3 = 'h3',
  Image = 'image',
  Video = 'video',
  Quote = 'quote',
  List = 'list', // Unordered bullet list
  OrderedList = 'ordered-list',
  Code = 'code',
  Divider = 'divider'
}

export type TextAlignment = 'left' | 'center' | 'right';

export interface ContentBlock {
  id: string;
  type: BlockType;
  content: string; // HTML string for text, or URL for media
  // For media
  src?: string;
  width?: number; // percentage
  caption?: string;
  align?: TextAlignment;
  language?: string; // For code blocks
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
  scheduledAt?: string; // ISO date string for future publishing
  status: 'draft' | 'published';
  views: number;
  likesCount?: number; 
}

export interface SiteSettings {
  aboutImage: string;
  heroImage: string;
  signatureImage: string;
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