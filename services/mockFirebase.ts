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
  POSTS: 'posts',
  REACTIONS: 'reactions'
};

// --- Firestore Service: Subscribers ---

export const subscribeUser = async (email: string): Promise<{ isNewSubscriber: boolean }> => {
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
      return { isNewSubscriber: true };
    } else {
      return { isNewSubscriber: false };
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

export const getComments = async (postId: string, userId?: string): Promise<Comment[]> => {
  try {
    const commentsRef = collection(db, COLLECTIONS.COMMENTS);
    // Get all comments for this post (including replies)
    const q = query(commentsRef, where('postId', '==', postId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return [];
    }
    
    // Get all reactions for this post (handle errors gracefully)
    let reactionsMap: { [commentId: string]: { [reactionType: string]: number } } = {};
    let userReactionsMap: { [commentId: string]: string[] } = {};
    
    try {
      const reactionsRef = collection(db, COLLECTIONS.REACTIONS);
      const reactionsQuery = query(reactionsRef, where('postId', '==', postId));
      const reactionsSnapshot = await getDocs(reactionsQuery);
      
      console.log('Loading reactions for post:', postId, 'Found:', reactionsSnapshot.docs.length);
      
      reactionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const commentId = data.commentId;
        const reactionType = data.reactionType;
        
        console.log('Processing reaction:', { docId: doc.id, commentId, reactionType, userId: data.userId });
        
        if (!commentId || !reactionType) {
          console.warn('Skipping reaction with missing data:', { commentId, reactionType, data });
          return;
        }
        
        if (!reactionsMap[commentId]) {
          reactionsMap[commentId] = {};
        }
        // Initialize count if not exists
        if (typeof reactionsMap[commentId][reactionType] !== 'number') {
          reactionsMap[commentId][reactionType] = 0;
        }
        reactionsMap[commentId][reactionType]++;
        
        // Track user's reactions
        if (userId && data.userId === userId) {
          if (!userReactionsMap[commentId]) {
            userReactionsMap[commentId] = [];
          }
          if (!userReactionsMap[commentId].includes(reactionType)) {
            userReactionsMap[commentId].push(reactionType);
          }
        }
      });
      
      console.log('Reactions map built:', reactionsMap);
      console.log('User reactions map:', userReactionsMap);
    } catch (reactionError) {
      console.warn('Error loading reactions (continuing without reactions):', reactionError);
      // Continue without reactions if there's an error
    }
    
    const allComments = querySnapshot.docs.map(doc => {
      const data = doc.data();
      // Handle userAvatar - preserve the value if it exists and is a valid string
      let userAvatar: string | undefined = undefined;
      if (data.userAvatar && typeof data.userAvatar === 'string' && data.userAvatar.trim() !== '') {
        userAvatar = data.userAvatar;
      }
      
      console.log('Loading comment:', { 
        id: doc.id, 
        userName: data.userName, 
        userAvatar: data.userAvatar,
        processedAvatar: userAvatar,
        hasAvatarField: data.hasOwnProperty('userAvatar'),
        avatarType: typeof data.userAvatar
      });
      
      return {
        id: doc.id,
        postId: data.postId,
        userId: data.userId,
        userName: data.userName || 'Anonymous',
        userAvatar: userAvatar,
        content: data.content || '',
        parentId: data.parentId || undefined,
        createdAt: data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate().toISOString() 
          : (data.createdAt || new Date().toISOString()),
        reactions: reactionsMap[doc.id] || {},
        userReactions: userReactionsMap[doc.id] || [],
        replies: [] as Comment[]
      };
    });
    
    // Separate top-level comments and replies
    const topLevelComments = allComments.filter(c => !c.parentId);
    const replies = allComments.filter(c => c.parentId);
    
    // Nest replies under their parent comments
    topLevelComments.forEach(comment => {
      comment.replies = replies
        .filter(reply => reply.parentId === comment.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
    
    // Sort top-level comments (newest first)
    return topLevelComments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('Error getting comments:', error);
    return [];
  }
};

export const addComment = async (postId: string, user: User, content: string, parentId?: string): Promise<Comment> => {
  try {
    const commentsRef = collection(db, COLLECTIONS.COMMENTS);
    const commentData: any = {
      postId,
      userId: user.id,
      userName: user.name,
      content,
      createdAt: serverTimestamp()
    };
    
    // Always include userAvatar field - set to the avatar URL if available, otherwise null
    // This ensures the field exists in Firestore even if avatar is undefined
    commentData.userAvatar = (user.avatar && user.avatar.trim() !== '') ? user.avatar : null;
    
    if (parentId) {
      commentData.parentId = parentId;
    }
    
    console.log('Saving comment with data:', { 
      ...commentData, 
      userAvatar: commentData.userAvatar,
      userAvatarLength: commentData.userAvatar?.length 
    });
    
    const docRef = await addDoc(commentsRef, commentData);
    
    // Verify what was saved
    const savedDoc = await getDoc(docRef);
    console.log('Comment saved, retrieved data:', savedDoc.data());
    
    return {
      id: docRef.id,
      postId,
      userId: user.id,
      userName: user.name,
      userAvatar: user.avatar || undefined,
      content,
      parentId,
      createdAt: new Date().toISOString(),
      reactions: {},
      userReactions: [],
      replies: []
    };
  } catch (error) {
    console.error('Error adding comment:', error);
    throw error;
  }
};

export const toggleReaction = async (postId: string, commentId: string, userId: string, reactionType: string): Promise<{ count: number, userHasReacted: boolean }> => {
  try {
    if (!postId || !commentId || !userId || !reactionType) {
      throw new Error('Missing required parameters for toggleReaction');
    }
    
    console.log('Toggle reaction:', { postId, commentId, userId, reactionType });
    
    const reactionsRef = collection(db, COLLECTIONS.REACTIONS);
    
    // Query all reactions for this comment and user (simpler query, no composite index needed)
    const userReactionsQuery = query(
      reactionsRef, 
      where('commentId', '==', commentId),
      where('userId', '==', userId)
    );
    const userReactionsSnapshot = await getDocs(userReactionsQuery);
    
    console.log('User reactions query executed, found:', userReactionsSnapshot.docs.length);
    userReactionsSnapshot.docs.forEach(doc => {
      console.log('User reaction doc:', { id: doc.id, data: doc.data() });
    });
    
    // Find if user already has this reaction type
    const existingReaction = userReactionsSnapshot.docs.find(
      doc => {
        const data = doc.data();
        console.log('Checking reaction:', { docId: doc.id, reactionType: data.reactionType, match: data.reactionType === reactionType });
        return data.reactionType === reactionType;
      }
    );
    
    if (existingReaction) {
      // Remove reaction
      console.log('Removing existing reaction:', existingReaction.id);
      await deleteDoc(existingReaction.ref);
      
      // Wait a bit for deletion to propagate
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Get updated count for this reaction type
      const countQuery = query(
        reactionsRef, 
        where('commentId', '==', commentId), 
        where('reactionType', '==', reactionType)
      );
      const countSnapshot = await getDocs(countQuery);
      
      console.log('Reaction removed, new count:', countSnapshot.size);
      return { count: countSnapshot.size, userHasReacted: false };
    } else {
      // Add reaction
      console.log('Adding new reaction');
      const reactionData = {
        postId,
        commentId,
        userId,
        reactionType,
        createdAt: serverTimestamp()
      };
      console.log('Reaction data to save:', reactionData);
      
      const docRef = await addDoc(reactionsRef, reactionData);
      console.log('Reaction document created with ID:', docRef.id);
      
      // Verify the document was created by reading it back
      const verifyDoc = await getDoc(docRef);
      if (!verifyDoc.exists()) {
        throw new Error('Failed to create reaction document - document does not exist after creation');
      }
      console.log('Verified reaction document exists:', verifyDoc.data());
      
      // Wait a bit for write to propagate and indexes to update
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get updated count for this reaction type
      const countQuery = query(
        reactionsRef, 
        where('commentId', '==', commentId), 
        where('reactionType', '==', reactionType)
      );
      const countSnapshot = await getDocs(countQuery);
      
      console.log('Reaction added, count query result:', {
        count: countSnapshot.size,
        docs: countSnapshot.docs.map(d => ({ id: d.id, data: d.data() }))
      });
      
      // Double-check: query all reactions for this comment to see what we have
      const allReactionsQuery = query(reactionsRef, where('commentId', '==', commentId));
      const allReactionsSnapshot = await getDocs(allReactionsQuery);
      console.log('All reactions for comment:', allReactionsSnapshot.docs.map(d => ({ id: d.id, data: d.data() })));
      
      return { count: countSnapshot.size, userHasReacted: true };
    }
  } catch (error) {
    console.error('Error toggling reaction:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
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
