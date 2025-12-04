
import { User, Comment, BlogPost } from '../types';

// This service mimics Firebase interactions. 
// In a real app, you would replace localStorage calls with:
// await firebase.firestore().collection('...').add(...)

const DELAY = 600; // Simulate network latency

const ADMIN_CREDS = {
  email: 'roshni.nekkanti@gmail.com',
  password: '@Swaruparam12'
};

const getStorage = (key: string) => {
  const data = localStorage.getItem(`roshines_db_${key}`);
  return data ? JSON.parse(data) : [];
};

const setStorage = (key: string, data: any) => {
  localStorage.setItem(`roshines_db_${key}`, JSON.stringify(data));
};

// --- Auth Service ---

export const loginUser = async (email: string, password: string): Promise<User> => {
  await new Promise(resolve => setTimeout(resolve, DELAY));
  
  // 1. Check for Admin Hardcoded Credentials
  if (email === ADMIN_CREDS.email) {
    if (password === ADMIN_CREDS.password) {
      return {
        id: 'admin-roshni',
        name: 'Roshni',
        email: ADMIN_CREDS.email,
        avatar: 'https://images.unsplash.com/photo-1516575150278-77136aed6920?auto=format&fit=crop&q=80&w=200',
        isAdmin: true
      };
    } else {
      throw new Error('Invalid password for admin account');
    }
  }

  // 2. Check for Regular Users in Storage
  const users = getStorage('users');
  const user = users.find((u: any) => u.email === email && u.password === password);
  
  if (!user) throw new Error('Invalid email or password');
  
  const { password: _, ...userInfo } = user; // strip password
  return { ...userInfo, isAdmin: false };
};

export const registerUser = async (name: string, email: string, password: string): Promise<User> => {
  await new Promise(resolve => setTimeout(resolve, DELAY));

  if (email === ADMIN_CREDS.email) {
    throw new Error('This email is reserved for the administrator.');
  }

  const users = getStorage('users');
  
  if (users.find((u: any) => u.email === email)) {
    throw new Error('User already exists');
  }

  const newUser = {
    id: Math.random().toString(36).substr(2, 9),
    name,
    email,
    password, // In real app, never store plain text passwords
    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff`,
    isAdmin: false
  };

  users.push(newUser);
  setStorage('users', users);

  const { password: _, ...userInfo } = newUser;
  return userInfo;
};

// --- Firestore Service: Comments ---

export const getComments = async (postId: string): Promise<Comment[]> => {
  await new Promise(resolve => setTimeout(resolve, DELAY)); // latency
  const comments = getStorage('comments');
  return comments
    .filter((c: Comment) => c.postId === postId)
    .sort((a: Comment, b: Comment) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const addComment = async (postId: string, user: User, content: string): Promise<Comment> => {
  await new Promise(resolve => setTimeout(resolve, DELAY));
  const comments = getStorage('comments');
  
  const newComment: Comment = {
    id: Math.random().toString(36).substr(2, 9),
    postId,
    userId: user.id,
    userName: user.name,
    userAvatar: user.avatar,
    content,
    createdAt: new Date().toISOString()
  };

  comments.push(newComment);
  setStorage('comments', comments);
  return newComment;
};

// --- Firestore Service: Likes ---

export const toggleLike = async (postId: string, userId: string): Promise<{ liked: boolean, count: number }> => {
  // Returns new state
  const likes = getStorage('likes'); // Array of { postId, userId }
  
  const index = likes.findIndex((l: any) => l.postId === postId && l.userId === userId);
  let liked = false;

  if (index >= 0) {
    likes.splice(index, 1); // Unlike
    liked = false;
  } else {
    likes.push({ postId, userId }); // Like
    liked = true;
  }
  
  setStorage('likes', likes);
  
  // Recalculate count
  const count = likes.filter((l: any) => l.postId === postId).length;
  return { liked, count };
};

export const getLikeStatus = async (postId: string, userId?: string): Promise<{ liked: boolean, count: number }> => {
  const likes = getStorage('likes');
  const count = likes.filter((l: any) => l.postId === postId).length;
  const liked = userId ? likes.some((l: any) => l.postId === postId && l.userId === userId) : false;
  return { liked, count };
};
