// Firebase Firestore Service - Real database for persistent data
import { User, Comment, BlogPost } from '../types';
import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  addDoc, 
  setDoc,
  deleteDoc,
  updateDoc,
  increment,
  query, 
  where, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

// Collection names
const COLLECTIONS = {
  SUBSCRIBERS: 'subscribers',
  COMMENTS: 'comments',
  LIKES: 'likes',
  POSTS: 'posts'
};

// --- Firestore Service: Subscribers ---

export const subscribeUser = async (email: string): Promise<void> => {
  try {
    // Check if already subscribed
    const subscribersRef = collection(db, COLLECTIONS.SUBSCRIBERS);
    const q = query(subscribersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      // Add new subscriber
      await addDoc(subscribersRef, {
        email,
        subscribedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error subscribing user:', error);
    throw error;
  }
};

export const getSubscribersCount = async (): Promise<number> => {
  try {
    const subscribersRef = collection(db, COLLECTIONS.SUBSCRIBERS);
    const querySnapshot = await getDocs(subscribersRef);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting subscribers count:', error);
    return 0;
  }
};

export const getSubscribers = async (): Promise<string[]> => {
  try {
    const subscribersRef = collection(db, COLLECTIONS.SUBSCRIBERS);
    const querySnapshot = await getDocs(subscribersRef);
    return querySnapshot.docs.map(doc => doc.data().email);
  } catch (error) {
    console.error('Error getting subscribers:', error);
    return [];
  }
};

// --- Firestore Service: Comments ---

export const getComments = async (postId: string): Promise<Comment[]> => {
  try {
    const commentsRef = collection(db, COLLECTIONS.COMMENTS);
    // Simple query without orderBy to avoid index requirement
    const q = query(commentsRef, where('postId', '==', postId));
    const querySnapshot = await getDocs(q);
    
    const comments = querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        postId: data.postId,
        userId: data.userId,
        userName: data.userName,
        userAvatar: data.userAvatar,
        content: data.content,
        createdAt: data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate().toISOString() 
          : (data.createdAt || new Date().toISOString())
      };
    });
    
    // Sort on client side (newest first)
    return comments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('Error getting comments:', error);
    return [];
  }
};

export const addComment = async (postId: string, user: User, content: string): Promise<Comment> => {
  try {
    const commentsRef = collection(db, COLLECTIONS.COMMENTS);
    const commentData = {
      postId,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar || null,
      content,
      createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(commentsRef, commentData);
    
    return {
      id: docRef.id,
      postId,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar,
      content,
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

// --- Firestore Service: Likes ---

export const toggleLike = async (postId: string, userId: string): Promise<{ liked: boolean, count: number }> => {
  try {
    const likeId = `${postId}_${userId}`;
    const likeRef = doc(db, COLLECTIONS.LIKES, likeId);
    const likeDoc = await getDoc(likeRef);
    
    let liked = false;
    
    if (likeDoc.exists()) {
      // Unlike - remove the document
      await deleteDoc(likeRef);
      liked = false;
    } else {
      // Like - add the document
      await setDoc(likeRef, {
        postId,
        userId,
        likedAt: serverTimestamp()
      });
      liked = true;
    }
    
    // Get the actual count from likes collection (source of truth)
    const count = await getLikeCount(postId);
    
    // Sync the post's likesCount with the actual count
    await syncPostLikesCount(postId, count);
    
    return { liked, count };
  } catch (error) {
    console.error('Error toggling like:', error);
    throw error;
  }
};

// Sync post's likesCount with the actual count from likes collection
const syncPostLikesCount = async (postId: string, actualCount: number): Promise<void> => {
  try {
    const postRef = doc(db, COLLECTIONS.POSTS, postId);
    await updateDoc(postRef, {
      likesCount: actualCount
    });
  } catch (error) {
    console.error('Error syncing likes count:', error);
  }
};

const getLikeCount = async (postId: string): Promise<number> => {
  try {
    const likesRef = collection(db, COLLECTIONS.LIKES);
    const q = query(likesRef, where('postId', '==', postId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.size;
  } catch (error) {
    console.error('Error getting like count:', error);
    return 0;
  }
};

export const getLikeStatus = async (postId: string, userId?: string): Promise<{ liked: boolean, count: number }> => {
  try {
    const count = await getLikeCount(postId);
    
    if (!userId) {
      return { liked: false, count };
    }
    
    const likeId = `${postId}_${userId}`;
    const likeRef = doc(db, COLLECTIONS.LIKES, likeId);
    const likeDoc = await getDoc(likeRef);
    
    return { liked: likeDoc.exists(), count };
  } catch (error) {
    console.error('Error getting like status:', error);
    return { liked: false, count: 0 };
  }
};

// --- Firestore Service: Posts (Optional - for persistent blog posts) ---

export const savePosts = async (posts: BlogPost[]): Promise<void> => {
  try {
    for (const post of posts) {
      const postRef = doc(db, COLLECTIONS.POSTS, post.id);
      await setDoc(postRef, {
        ...post,
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error saving posts:', error);
    throw error;
  }
};

export const getPosts = async (): Promise<BlogPost[] | null> => {
  try {
    const postsRef = collection(db, COLLECTIONS.POSTS);
    const querySnapshot = await getDocs(postsRef);
    
    if (querySnapshot.empty) {
      return null; // Return null to indicate no posts in Firestore, use local defaults
    }
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        excerpt: data.excerpt,
        coverImage: data.coverImage,
        category: data.category,
        tags: data.tags || [],
        blocks: data.blocks || [],
        author: data.author,
        publishedAt: data.publishedAt,
        scheduledAt: data.scheduledAt,
        status: data.status,
        views: data.views || 0,
        likesCount: data.likesCount || 0
      } as BlogPost;
    });
  } catch (error) {
    console.error('Error getting posts:', error);
    return null;
  }
};

export const savePost = async (post: BlogPost): Promise<void> => {
  try {
    const postRef = doc(db, COLLECTIONS.POSTS, post.id);
    await setDoc(postRef, {
      ...post,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error saving post:', error);
    throw error;
  }
};

export const deletePost = async (postId: string): Promise<void> => {
  try {
    const postRef = doc(db, COLLECTIONS.POSTS, postId);
    await deleteDoc(postRef);
  } catch (error) {
    console.error('Error deleting post:', error);
    throw error;
  }
};

// Increment view count for a post
export const incrementViews = async (postId: string): Promise<void> => {
  try {
    const postRef = doc(db, COLLECTIONS.POSTS, postId);
    await updateDoc(postRef, {
      views: increment(1)
    });
  } catch (error) {
    console.error('Error incrementing views:', error);
    // Don't throw - views are non-critical
  }
};

// Update likes count on the post document
export const updatePostLikesCount = async (postId: string, delta: number): Promise<void> => {
  try {
    const postRef = doc(db, COLLECTIONS.POSTS, postId);
    
    // For decrements, check current value first to avoid negative counts
    if (delta < 0) {
      const postDoc = await getDoc(postRef);
      if (postDoc.exists()) {
        const currentCount = postDoc.data().likesCount || 0;
        if (currentCount <= 0) {
          return; // Don't decrement if already 0 or less
        }
      }
    }
    
    await updateDoc(postRef, {
      likesCount: increment(delta)
    });
  } catch (error) {
    console.error('Error updating likes count:', error);
  }
};

// Legacy functions (kept for compatibility but no longer used)
export const loginUser = async (_email: string, _password: string): Promise<User> => {
  throw new Error('Use Google OAuth for authentication');
};

export const registerUser = async (_name: string, _email: string, _password: string): Promise<User> => {
  throw new Error('Use Google OAuth for authentication');
};
