
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BlogPost, Category, ViewState, BlockType, ContentBlock, SiteSettings, User, Comment } from './types';
import { Icons } from './components/Icons';
import { BlockEditor } from './components/BlockEditor';
import { generateBlogContent, suggestTitle } from './services/geminiService';
import * as db from './services/mockFirebase';

// --- Constants ---
const CATEGORY_CONFIG: Record<Category, { color: string, icon: any }> = {
  [Category.Food]: { color: 'bg-emerald-100 text-emerald-800', icon: Icons.Coffee },
  [Category.Travel]: { color: 'bg-sky-100 text-sky-800', icon: Icons.Plane },
  [Category.Fashion]: { color: 'bg-rose-100 text-rose-800', icon: Icons.Camera },
  [Category.Technology]: { color: 'bg-indigo-100 text-indigo-800', icon: Icons.Smartphone },
  [Category.Lifestyle]: { color: 'bg-orange-100 text-orange-800', icon: Icons.Globe },
};

// Fixed IDs for stable images (no more random changing)
const DEFAULT_HERO_IMAGE = 'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&q=80&w=1920';
const DEFAULT_ABOUT_IMAGE = 'https://images.unsplash.com/photo-1516575150278-77136aed6920?auto=format&fit=crop&q=80&w=800';

const MOCK_POSTS: BlogPost[] = [
  {
    id: '1',
    title: 'The Art of Slow Living in Kyoto',
    excerpt: 'Discovering peace in the ancient capital through tea ceremonies and hidden gardens.',
    coverImage: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=800', // Kyoto/Zen vibe
    category: Category.Travel,
    tags: ['Japan', 'Mindfulness', 'Travel'],
    author: 'Roshni',
    publishedAt: new Date().toISOString(),
    status: 'published',
    views: 1240,
    blocks: [
      { id: 'b1', type: BlockType.Heading1, content: 'Arrival in Arashiyama', width: 100 },
      { id: 'b2', type: BlockType.Paragraph, content: 'The morning mist clung to the mountains as we stepped off the train. Kyoto feels different—time moves slower here.', width: 100 },
      { id: 'b3', type: BlockType.Image, content: '', src: 'https://images.unsplash.com/photo-1624253321171-1be53e12f5f4?auto=format&fit=crop&q=80&w=800', width: 100 },
      { id: 'b4', type: BlockType.Quote, content: 'Beauty lies in the spaces between things.', width: 100 },
    ]
  },
  {
    id: '2',
    title: 'Minimalist Wardrobe Essentials',
    excerpt: 'Building a capsule wardrobe that lasts a lifetime with just 20 items.',
    coverImage: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=80&w=800', // Fashion
    category: Category.Fashion,
    tags: ['Style', 'Sustainable', 'Minimalism'],
    author: 'Roshni',
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    status: 'published',
    views: 850,
    blocks: [
        { id: 'b1', type: BlockType.Paragraph, content: 'Fast fashion is out. Timeless pieces are in.', width: 100 },
    ]
  }
];

// --- Sub-Components ---

const Header: React.FC<{ 
    view: ViewState; 
    setView: (v: ViewState) => void;
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    onOpenNewsletter: () => void;
    user: User | null;
    onLogout: () => void;
}> = ({ view, setView, searchQuery, setSearchQuery, onOpenNewsletter, user, onLogout }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen && inputRef.current) {
        inputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Close mobile menu when view changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [view]);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-100 transition-all">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        
        {/* Mobile Menu Button (Left) */}
        <div className="md:hidden">
            <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 -ml-2 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
                {isMobileMenuOpen ? <Icons.X size={24} /> : <Icons.Menu size={24} />}
            </button>
        </div>

        <button 
          onClick={() => setView({ type: 'home' })}
          className="text-2xl font-serif font-bold tracking-tight text-stone-800 hover:opacity-80 transition-opacity absolute left-1/2 -translate-x-1/2 md:static md:translate-x-0 md:left-auto"
        >
          Ro-shines.
        </button>
        
        {/* Desktop Navigation */}
        <nav className={`hidden md:flex items-center gap-8 ${isSearchOpen ? 'opacity-0 pointer-events-none w-0' : 'opacity-100 w-auto'} transition-all duration-300`}>
           <button 
                onClick={() => setView({ type: 'home' })}
                className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
            >
                Journal
            </button>
            <button 
                onClick={() => setView({ type: 'about' })}
                className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
            >
                About
            </button>
            <button 
                onClick={onOpenNewsletter}
                className="text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors"
            >
                Newsletter
            </button>
        </nav>

        <div className="flex items-center gap-4">
          <div className={`relative flex items-center transition-all duration-300 ${isSearchOpen ? 'w-full md:w-64' : 'w-8'}`}>
            {isSearchOpen ? (
                <div className="absolute right-0 flex items-center w-48 md:w-full bg-stone-100 rounded-full overflow-hidden z-20">
                    <input 
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (view.type !== 'home') setView({ type: 'home' });
                        }}
                        placeholder="Search..."
                        className="w-full bg-transparent border-none outline-none px-4 py-1.5 text-sm text-stone-800 placeholder:text-stone-400"
                        onBlur={() => !searchQuery && setIsSearchOpen(false)}
                    />
                    <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="p-1.5 text-stone-400 hover:text-stone-600">
                        <Icons.X size={14} />
                    </button>
                </div>
            ) : (
                <button onClick={() => setIsSearchOpen(true)} className="p-2 text-stone-400 hover:text-stone-800 transition-colors">
                    <Icons.Search size={20} />
                </button>
            )}
          </div>
          
          <div className="hidden md:block w-px h-6 bg-stone-200 mx-2"></div>

          {user ? (
              <div className="hidden md:flex items-center gap-3">
                  <div className="flex items-center gap-2 group relative cursor-pointer">
                      <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-stone-200" />
                      
                      {/* Dropdown for User */}
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-stone-100 shadow-xl rounded-xl overflow-hidden hidden group-hover:block animate-fade-in p-1">
                           <div className="px-4 py-2 text-xs text-stone-400 border-b border-stone-50 mb-1">
                               Signed in as <br/><span className="text-stone-900 font-bold">{user.name}</span>
                               {user.isAdmin && <span className="ml-2 bg-rose-100 text-rose-800 text-[10px] px-1 rounded">ADMIN</span>}
                           </div>
                           
                           {/* Only Admins can see Dashboard */}
                           {user.isAdmin && (
                               <button 
                                    onClick={() => setView({ type: 'admin-dashboard' })}
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 rounded-lg flex items-center gap-2 text-stone-600"
                               >
                                    <Icons.Layout size={14} /> Dashboard
                               </button>
                           )}
                           
                           <button 
                                onClick={onLogout}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-rose-50 text-rose-600 rounded-lg flex items-center gap-2"
                           >
                                <Icons.X size={14} /> Logout
                           </button>
                      </div>
                  </div>
              </div>
          ) : (
              <button 
                  onClick={() => setView({ type: 'login' })}
                  className="hidden md:block bg-stone-900 text-white px-4 py-2 rounded-full text-xs font-semibold hover:bg-stone-700 transition-colors shadow-lg shadow-stone-200"
              >
                  Login
              </button>
          )}
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="absolute top-16 left-0 w-full bg-white border-b border-stone-100 shadow-xl md:hidden animate-slide-up z-40">
            <div className="flex flex-col p-4 space-y-2">
                <button 
                    onClick={() => setView({ type: 'home' })}
                    className="p-3 text-left font-serif font-medium text-stone-800 hover:bg-stone-50 rounded-xl"
                >
                    Journal
                </button>
                <button 
                    onClick={() => setView({ type: 'about' })}
                    className="p-3 text-left font-serif font-medium text-stone-800 hover:bg-stone-50 rounded-xl"
                >
                    About
                </button>
                <button 
                    onClick={() => { onOpenNewsletter(); setIsMobileMenuOpen(false); }}
                    className="p-3 text-left font-serif font-medium text-stone-800 hover:bg-stone-50 rounded-xl"
                >
                    Newsletter
                </button>
                <hr className="border-stone-100 my-2" />
                {user ? (
                    <>
                        <div className="p-3 flex items-center gap-3">
                            <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full border border-stone-200" />
                            <div className="text-sm">
                                <p className="font-bold text-stone-900">{user.name}</p>
                                <p className="text-xs text-stone-400">{user.email}</p>
                            </div>
                        </div>
                        {user.isAdmin && (
                            <button 
                                onClick={() => setView({ type: 'admin-dashboard' })}
                                className="p-3 text-left text-sm font-medium text-stone-600 hover:bg-stone-50 rounded-xl flex items-center gap-2"
                            >
                                <Icons.Layout size={16} /> Dashboard
                            </button>
                        )}
                        <button 
                            onClick={onLogout}
                            className="p-3 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2"
                        >
                            <Icons.X size={16} /> Logout
                        </button>
                    </>
                ) : (
                    <button 
                        onClick={() => setView({ type: 'login' })}
                        className="p-3 text-left font-bold text-stone-900 bg-stone-100 rounded-xl"
                    >
                        Login / Sign Up
                    </button>
                )}
            </div>
        </div>
      )}
    </header>
  );
};

const Footer = ({ onOpenNewsletter }: { onOpenNewsletter: () => void }) => (
    <footer className="bg-white border-t border-stone-100 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
                <h3 className="font-serif font-bold text-xl mb-4">Ro-shines.</h3>
                <p className="text-stone-500 text-sm leading-relaxed max-w-xs">
                    Curating the finest in travel, lifestyle, and modern living. A space for quiet reflection and inspiration by Roshni.
                </p>
            </div>
            <div>
                <h4 className="font-sans font-bold text-sm uppercase tracking-wider text-stone-900 mb-4">Categories</h4>
                <ul className="space-y-2 text-stone-500 text-sm">
                    {Object.values(Category).map(c => <li key={c} className="hover:text-stone-800 cursor-pointer">{c}</li>)}
                </ul>
            </div>
            <div>
                <h4 className="font-sans font-bold text-sm uppercase tracking-wider text-stone-900 mb-4">Stay Connected</h4>
                <div className="flex flex-col gap-3 text-sm text-stone-500">
                     <a href="mailto:roshni.nekkanti@gmail.com" className="hover:text-stone-800 flex items-center gap-2">
                        <Icons.Send size={14}/> roshni.nekkanti@gmail.com
                     </a>
                     <a href="https://instagram.com/Roshni_Chowdary" target="_blank" rel="noopener noreferrer" className="hover:text-stone-800 flex items-center gap-2">
                        <Icons.Camera size={14}/> @Roshni_Chowdary
                     </a>
                     <button onClick={onOpenNewsletter} className="text-left hover:text-stone-800 flex items-center gap-2">
                        <Icons.Sparkles size={14}/> Subscribe to Newsletter
                     </button>
                </div>
                <p className="text-stone-400 text-xs mt-6">© 2026 Ro-shines Blog. All rights reserved.</p>
            </div>
        </div>
    </footer>
);

const NewsletterModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubscribe: (email: string) => void;
}> = ({ isOpen, onClose, onSubscribe }) => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');

    useEffect(() => {
        if (!isOpen) {
            setEmail('');
            setStatus('idle');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('sending');
        // Simulate SMTP connection and sending
        await new Promise(resolve => setTimeout(resolve, 2000));
        onSubscribe(email);
        setStatus('success');
    };

    const handleOpenTestEmail = () => {
        const subject = encodeURIComponent("Welcome to Ro-shines!");
        const body = encodeURIComponent(`Dear ${email || 'Subscriber'},\n\nI am so incredibly happy to have you here. Ro-shines is a piece of my heart, and I can't wait to share my latest stories with you.\n\nGrab a cup of coffee, stay awhile, and let's explore the beautiful details of life together.\n\nWith love,\nRoshni`);
        window.open(`mailto:${email}?subject=${subject}&body=${body}`);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 z-10">
                    <Icons.X size={20} />
                </button>

                {status === 'success' ? (
                     <div className="p-8 bg-rose-50/50 animate-fade-in">
                        <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                             <Icons.Check size={24} />
                        </div>
                        <h2 className="text-2xl font-serif font-bold text-center text-stone-900 mb-2">Welcome, friend!</h2>
                        <p className="text-center text-stone-500 text-sm mb-6">
                            We've successfully processed your subscription for <b>{email}</b>.
                        </p>
                        
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-100 text-left transform rotate-1 scale-95 origin-center mb-4">
                            <p className="font-serif italic text-stone-800 mb-2">Dear Subscriber,</p>
                            <p className="text-stone-600 text-sm leading-relaxed mb-4">
                                I am so incredibly happy to have you here. Ro-shines is a piece of my heart...
                            </p>
                            <p className="font-serif font-bold text-sm text-stone-900">With love,<br/>Roshni</p>
                        </div>
                        
                        <div className="text-center">
                            <button 
                                onClick={handleOpenTestEmail}
                                className="text-xs bg-stone-900 text-white px-3 py-1.5 rounded-full hover:bg-stone-700 transition-colors mb-4 inline-flex items-center gap-1"
                            >
                                <Icons.Send size={10} /> Open Test Email
                            </button>
                            <p className="text-[10px] text-stone-400 mb-2">
                                (Since this is a demo without a backend, clicking above will open your mail app to view the actual draft)
                            </p>
                            <button onClick={onClose} className="w-full text-stone-500 text-sm hover:text-stone-900 underline">
                                Close
                            </button>
                        </div>
                     </div>
                ) : (
                    <div className="p-8">
                        <div className="text-center mb-6">
                            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Icons.Sparkles size={24} />
                            </div>
                            <h2 className="text-2xl font-serif font-bold text-stone-900 mb-2">Join the Community</h2>
                            <p className="text-stone-500 text-sm">Get notified whenever I post a new story. No spam, just love.</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <input 
                                type="email" 
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:border-rose-300 focus:ring-2 focus:ring-rose-100 outline-none transition-all"
                                disabled={status === 'sending'}
                            />
                            <button 
                                type="submit" 
                                disabled={status === 'sending'}
                                className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                            >
                                {status === 'sending' ? (
                                    <><Icons.Sparkles className="animate-spin" size={16}/> Connecting to SMTP...</>
                                ) : 'Subscribe'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Authentication View ---

const LoginView: React.FC<{
    isRegister: boolean;
    onLogin: (user: User) => void;
    onSwitchMode: () => void;
}> = ({ isRegister, onLogin, onSwitchMode }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            let user: User;
            if (isRegister) {
                user = await db.registerUser(name, email, password);
            } else {
                user = await db.loginUser(email, password);
            }
            onLogin(user);
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4 py-12">
            <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl w-full max-w-md border border-stone-100 animate-fade-in">
                <div className="text-center mb-8">
                    <h2 className="font-serif font-bold text-3xl text-stone-900 mb-2">
                        {isRegister ? 'Join Ro-shines' : 'Welcome Back'}
                    </h2>
                    <p className="text-stone-500 text-sm">
                        {isRegister ? 'Create an account to join the conversation.' : 'Sign in to access your account and interact.'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-6 flex items-center gap-2">
                        <Icons.X size={14} /> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegister && (
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Name</label>
                            <input 
                                type="text"
                                required
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-stone-800 outline-none transition-colors"
                            />
                        </div>
                    )}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Email</label>
                        <input 
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-stone-800 outline-none transition-colors"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">Password</label>
                        <input 
                            type="password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:border-stone-800 outline-none transition-colors"
                        />
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-colors mt-6 disabled:opacity-70"
                    >
                        {loading ? 'Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-stone-500">
                    {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                    <button onClick={onSwitchMode} className="font-bold text-stone-900 hover:underline">
                        {isRegister ? 'Sign In' : 'Sign Up'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Main Views ---

const HomeView: React.FC<{ 
    posts: BlogPost[]; 
    onPostClick: (id: string) => void; 
    searchQuery: string;
    heroImage: string;
}> = ({ posts, onPostClick, searchQuery, heroImage }) => {
    const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
    
    const filteredPosts = useMemo(() => {
        let filtered = posts.filter(p => p.status === 'published');
        
        if (selectedCategory !== 'All') {
            filtered = filtered.filter(p => p.category === selectedCategory);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(p => 
                p.title.toLowerCase().includes(q) || 
                p.excerpt.toLowerCase().includes(q) ||
                p.tags.some(t => t.toLowerCase().includes(q))
            );
        }

        return filtered;
    }, [posts, selectedCategory, searchQuery]);

    return (
        <main className="min-h-screen">
            {/* Hero Section */}
            {!searchQuery && (
                <section className="relative h-[60vh] flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-stone-200">
                        <img 
                            src={heroImage} 
                            className="w-full h-full object-cover opacity-50 transition-opacity duration-1000" 
                            alt="Hero"
                        />
                    </div>
                    <div className="relative z-10 text-center px-4 animate-slide-up">
                        <span className="inline-block py-1 px-3 rounded-full bg-white/20 backdrop-blur-sm text-stone-900 text-xs font-semibold uppercase tracking-widest mb-4 border border-white/30">
                            Welcome to Ro-shines
                        </span>
                        <h1 className="text-5xl md:text-7xl font-serif font-bold text-stone-900 mb-6 drop-shadow-sm">
                            Stories by Roshni
                        </h1>
                        <p className="text-lg md:text-xl text-stone-700 max-w-2xl mx-auto font-light">
                            Exploring the intersection of design, culture, and conscious living.
                        </p>
                    </div>
                </section>
            )}

            {/* Content Area */}
            <div className="max-w-7xl mx-auto px-6 py-16">
                {/* Search Results Header */}
                {searchQuery && (
                     <div className="mb-8 pb-4 border-b border-stone-200">
                        <h2 className="text-2xl font-serif text-stone-800">
                            Search results for "<span className="italic">{searchQuery}</span>"
                        </h2>
                     </div>
                )}

                {/* Category Tabs */}
                {!searchQuery && (
                    <div className="flex flex-wrap gap-4 justify-center mb-16">
                        <button 
                            onClick={() => setSelectedCategory('All')}
                            className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${selectedCategory === 'All' ? 'bg-stone-800 text-white shadow-lg' : 'bg-white text-stone-500 hover:bg-stone-100'}`}
                        >
                            All Stories
                        </button>
                        {Object.values(Category).map(cat => {
                            const Icon = CATEGORY_CONFIG[cat].icon;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 ${selectedCategory === cat ? 'bg-stone-800 text-white shadow-lg' : 'bg-white text-stone-500 hover:bg-stone-100'}`}
                                >
                                    <Icon size={14} /> {cat}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Posts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                    {filteredPosts.map((post) => (
                        <article 
                            key={post.id} 
                            onClick={() => onPostClick(post.id)}
                            className="group cursor-pointer flex flex-col gap-4 animate-fade-in"
                        >
                            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
                                <img 
                                    src={post.coverImage} 
                                    alt={post.title}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                                />
                                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md shadow-sm">
                                    {post.category}
                                </div>
                            </div>
                            <div>
                                <h2 className="text-2xl font-serif font-bold text-stone-900 group-hover:text-rose-900 transition-colors mb-2 leading-tight">
                                    {post.title}
                                </h2>
                                <p className="text-stone-500 line-clamp-2 text-sm leading-relaxed mb-3">
                                    {post.excerpt}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-stone-400 font-medium">
                                    <span>{new Date(post.publishedAt).toLocaleDateString()}</span>
                                    <span>•</span>
                                    <span>{post.views} views</span>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
                
                {filteredPosts.length === 0 && (
                    <div className="text-center py-20 text-stone-400">
                        <Icons.Coffee size={48} className="mx-auto mb-4 opacity-50"/>
                        <p>No stories found.</p>
                        {searchQuery && <button onClick={() => window.location.reload()} className="mt-4 text-stone-800 underline">Clear Search</button>}
                    </div>
                )}
            </div>
        </main>
    );
}

// --- Interaction Components ---

const CommentSection: React.FC<{
    postId: string;
    currentUser: User | null;
    onLoginReq: () => void;
}> = ({ postId, currentUser, onLoginReq }) => {
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        db.getComments(postId).then(setComments);
    }, [postId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        if (!newComment.trim()) return;

        setSubmitting(true);
        try {
            const added = await db.addComment(postId, currentUser, newComment);
            setComments(prev => [added, ...prev]);
            setNewComment('');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="mt-12 pt-12 border-t border-stone-100 max-w-2xl mx-auto">
            <h3 className="font-serif font-bold text-2xl text-stone-900 mb-8">Comments ({comments.length})</h3>

            {/* Input Form */}
            <div className="mb-10 flex gap-4">
                <div className="w-10 h-10 rounded-full bg-stone-100 flex-shrink-0 overflow-hidden">
                    {currentUser ? (
                         <img src={currentUser.avatar} alt="User" className="w-full h-full object-cover"/>
                    ) : (
                         <div className="w-full h-full flex items-center justify-center text-stone-400"><Icons.Layout size={18}/></div>
                    )}
                </div>
                <div className="flex-1">
                    {currentUser ? (
                        <form onSubmit={handleSubmit}>
                            <textarea
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                placeholder="Share your thoughts..."
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 min-h-[100px] outline-none focus:border-stone-800 transition-colors text-sm"
                            />
                            <div className="flex justify-end mt-2">
                                <button 
                                    type="submit" 
                                    disabled={submitting || !newComment.trim()}
                                    className="bg-stone-900 text-white px-6 py-2 rounded-full text-sm font-semibold hover:bg-stone-700 disabled:opacity-50"
                                >
                                    {submitting ? 'Posting...' : 'Post Comment'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="bg-stone-50 rounded-xl p-6 text-center border border-stone-200">
                            <p className="text-stone-500 text-sm mb-3">Join the conversation to leave a comment.</p>
                            <button onClick={onLoginReq} className="text-rose-600 font-bold text-sm hover:underline">Log In to Comment</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Comment List */}
            <div className="space-y-8">
                {comments.map(comment => (
                    <div key={comment.id} className="flex gap-4 animate-fade-in">
                        <img src={comment.userAvatar || 'https://ui-avatars.com/api/?name=User'} alt={comment.userName} className="w-10 h-10 rounded-full bg-stone-100 flex-shrink-0 object-cover" />
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold text-stone-900 text-sm">{comment.userName}</span>
                                <span className="text-xs text-stone-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-stone-600 text-sm leading-relaxed">{comment.content}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const LikeButton: React.FC<{
    postId: string;
    currentUser: User | null;
    onLoginReq: () => void;
}> = ({ postId, currentUser, onLoginReq }) => {
    const [likes, setLikes] = useState(0);
    const [liked, setLiked] = useState(false);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        const fetchLikes = async () => {
            const status = await db.getLikeStatus(postId, currentUser?.id);
            setLikes(status.count);
            setLiked(status.liked);
        };
        fetchLikes();
    }, [postId, currentUser]);

    const handleToggle = async () => {
        if (!currentUser) {
            onLoginReq();
            return;
        }

        // Optimistic update
        const newLiked = !liked;
        setLiked(newLiked);
        setLikes(prev => newLiked ? prev + 1 : prev - 1);
        setAnimating(true);
        setTimeout(() => setAnimating(false), 300);

        // Actual API call
        const res = await db.toggleLike(postId, currentUser.id);
        setLikes(res.count);
        setLiked(res.liked);
    };

    return (
        <button 
            onClick={handleToggle}
            className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 ${liked ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}
        >
            <div className={`${animating ? 'scale-125' : 'scale-100'} transition-transform duration-200`}>
                <Icons.Sparkles className={liked ? 'fill-current' : ''} size={18} />
            </div>
            <span className="text-sm font-medium">{likes} {likes === 1 ? 'Like' : 'Likes'}</span>
        </button>
    );
};

const PostDetailView: React.FC<{ 
    post: BlogPost; 
    onBack: () => void;
    currentUser: User | null;
    onLoginReq: () => void;
}> = ({ post, onBack, currentUser, onLoginReq }) => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <article className="min-h-screen bg-white animate-fade-in">
            {/* Minimal Header for Post */}
            <div className="h-[60vh] relative w-full overflow-hidden">
                <img src={post.coverImage} className="w-full h-full object-cover" alt="Cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent flex items-end pb-16">
                    <div className="max-w-4xl mx-auto px-6 w-full text-white">
                        <button 
                            onClick={onBack}
                            className="mb-8 flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 w-fit px-4 py-2 rounded-full transition-colors backdrop-blur-sm bg-white/5 border border-white/10"
                        >
                            <Icons.ChevronLeft size={16} /> Back to Journal
                        </button>
                        <div className={`inline-block px-3 py-1 rounded text-xs font-bold uppercase tracking-widest mb-6 bg-white/20 backdrop-blur`}>
                            {post.category}
                        </div>
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold leading-tight mb-6 drop-shadow-sm">
                            {post.title}
                        </h1>
                        <div className="flex items-center gap-6 text-sm text-white/90 font-light tracking-wide">
                            <span className="flex items-center gap-2"><Icons.Layout size={14}/> By {post.author}</span>
                            <span>•</span>
                            <span className="flex items-center gap-2"><Icons.Calendar size={14}/> {new Date(post.publishedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-20">
                <div className="prose prose-stone prose-lg md:prose-xl mx-auto first-letter:text-5xl first-letter:font-serif first-letter:font-bold first-letter:mr-2 first-letter:float-left first-letter:text-stone-900">
                    {post.blocks.map(block => {
                        switch (block.type) {
                            case BlockType.Heading1:
                                return <h2 key={block.id} className="font-serif font-bold text-4xl mt-16 mb-8 text-stone-900 border-b border-stone-100 pb-4">{block.content}</h2>
                            case BlockType.Heading2:
                                return <h3 key={block.id} className="font-serif font-bold text-2xl mt-12 mb-6 text-stone-800">{block.content}</h3>
                            case BlockType.Paragraph:
                                return <p key={block.id} className="text-stone-700 leading-9 mb-8 font-light text-lg">{block.content}</p>
                            case BlockType.Quote:
                                return (
                                    <blockquote key={block.id} className="border-l-4 border-rose-300 pl-8 py-4 my-12 italic font-serif text-3xl text-stone-800 bg-gradient-to-r from-stone-50 to-transparent rounded-r-2xl">
                                        "{block.content}"
                                    </blockquote>
                                )
                            case BlockType.Image:
                                return (
                                    <figure key={block.id} className="my-12 flex flex-col items-center">
                                        <img 
                                            src={block.src || 'https://picsum.photos/800/400'} 
                                            alt="Content" 
                                            className="rounded-2xl shadow-xl"
                                            style={{ width: `${block.width || 100}%` }}
                                        />
                                        {block.caption && <figcaption className="text-center text-sm text-stone-400 mt-4 italic font-serif">{block.caption}</figcaption>}
                                    </figure>
                                )
                            default: return null;
                        }
                    })}
                </div>
                
                {/* Interaction Bar */}
                <div className="mt-16 flex items-center justify-between border-t border-b border-stone-100 py-6">
                    <div className="flex gap-2">
                        {post.tags.map(tag => (
                            <span key={tag} className="text-stone-500 text-sm">#{tag}</span>
                        ))}
                    </div>
                    <LikeButton postId={post.id} currentUser={currentUser} onLoginReq={onLoginReq} />
                </div>

                {/* Comments */}
                <CommentSection postId={post.id} currentUser={currentUser} onLoginReq={onLoginReq} />
            </div>
        </article>
    );
};

const AboutView: React.FC<{
    aboutImage: string;
}> = ({ aboutImage }) => {
    return (
        <div className="min-h-screen pt-12 pb-24 animate-fade-in bg-stone-50/50">
            <div className="max-w-5xl mx-auto px-6">
                <div className="flex flex-col md:flex-row gap-16 items-center">
                    {/* Image Column */}
                    <div className="w-full md:w-1/2 relative">
                        <div className="absolute inset-0 bg-rose-200 rounded-t-[10rem] rounded-b-[2rem] transform translate-x-4 translate-y-4"></div>
                        <div className="aspect-[3/4] rounded-t-[10rem] rounded-b-[2rem] overflow-hidden bg-stone-200 relative shadow-2xl">
                             <img 
                                src={aboutImage} 
                                alt="Roshni in Studio" 
                                className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000" 
                             />
                        </div>
                        <div className="absolute -bottom-6 -right-6 bg-white p-6 shadow-xl rounded-xl max-w-xs hidden md:block border border-stone-50">
                            <p className="font-serif italic text-stone-500 text-lg">"Capturing the quiet magic of everyday moments."</p>
                        </div>
                    </div>
                    
                    {/* Text Column */}
                    <div className="w-full md:w-1/2 space-y-8">
                        <div>
                            <span className="text-rose-600 font-bold tracking-widest text-xs uppercase mb-2 block">The Editor</span>
                            <h1 className="text-5xl md:text-7xl font-serif font-bold text-stone-900 leading-tight">
                                Hello,<br/>I'm Roshni.
                            </h1>
                        </div>
                        
                        <div className="prose prose-stone prose-lg text-stone-600 font-light leading-relaxed">
                            <p>
                                Welcome to my digital sanctuary. <b>Ro-shines</b> is born from a desire to slow down and document the beautiful details that often go unnoticed in our busy lives.
                            </p>
                            <p>
                                I am an artist and storyteller based in the city, but my heart belongs to the mountains. When I'm not writing, you can find me painting in my sun-drenched studio (usually with butterflies nearby!), exploring hidden coffee shops, or curating sustainable fashion pieces.
                            </p>
                            <p>
                                This blog is a collection of my favorite things—from travel diaries to mindful living tips. I hope it brings a little bit of light into your day.
                            </p>
                        </div>

                        <div className="pt-12 mt-8 border-t border-stone-200">
                             <h3 className="font-serif italic text-2xl text-stone-800 mb-8">Let's Connect</h3>
                             <div className="flex flex-col gap-4">
                                <a href="mailto:roshni.nekkanti@gmail.com" className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-stone-100 hover:border-rose-100 hover:shadow-lg hover:shadow-rose-50/50 transition-all duration-300 w-full">
                                     <div className="flex-shrink-0 w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Icons.Send size={20} />
                                     </div>
                                     <div className="min-w-0 flex-1">
                                         <span className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">Email Me</span>
                                         <span className="block font-serif text-sm md:text-lg text-stone-800 group-hover:text-rose-700 transition-colors break-all">roshni.nekkanti@gmail.com</span>
                                     </div>
                                </a>

                                <a href="https://instagram.com/Roshni_Chowdary" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4 p-5 rounded-2xl bg-white border border-stone-100 hover:border-pink-100 hover:shadow-lg hover:shadow-pink-50/50 transition-all duration-300 w-full">
                                     <div className="flex-shrink-0 w-12 h-12 rounded-full bg-pink-50 text-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Icons.Camera size={20} />
                                     </div>
                                     <div className="min-w-0 flex-1">
                                         <span className="block text-xs font-bold uppercase tracking-wider text-stone-400 mb-1">Instagram</span>
                                         <span className="block font-serif text-sm md:text-lg text-stone-800 group-hover:text-pink-700 transition-colors break-all">@Roshni_Chowdary</span>
                                     </div>
                                </a>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// --- Admin Components ---

const AdminSettings: React.FC<{
    settings: SiteSettings;
    onSave: (s: SiteSettings) => void;
    onCancel: () => void;
}> = ({ settings, onSave, onCancel }) => {
    const [aboutImage, setAboutImage] = useState(settings.aboutImage);
    const [heroImage, setHeroImage] = useState(settings.heroImage);
    const [siteName, setSiteName] = useState(settings.siteName);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'about' | 'hero') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (type === 'about') setAboutImage(reader.result as string);
                else setHeroImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="max-w-3xl mx-auto px-6 py-12 animate-fade-in">
             <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-serif font-bold text-stone-900">Site Settings</h2>
                <div className="flex gap-2">
                    <button onClick={onCancel} className="px-4 py-2 text-sm text-stone-500 hover:text-stone-900">Cancel</button>
                    <button 
                        onClick={() => onSave({ aboutImage, heroImage, siteName })}
                        className="bg-stone-900 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-stone-700 flex items-center gap-2"
                    >
                        <Icons.Save size={16} /> Save Changes
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl p-8 border border-stone-100 space-y-8">
                
                {/* About Page Image */}
                <div>
                    <label className="block text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">About Page Image</label>
                    <div className="flex items-start gap-6">
                        <div className="w-32 h-40 bg-stone-100 rounded-lg overflow-hidden border border-stone-200">
                            <img src={aboutImage} alt="About Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-stone-500 mb-3">Upload a new portrait for the About page. Vertical aspect ratio (3:4) recommended.</p>
                            <label className="cursor-pointer bg-stone-100 text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-200 transition-colors text-sm font-medium inline-block">
                                Upload New Image
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'about')} />
                            </label>
                        </div>
                    </div>
                </div>

                <hr className="border-stone-100"/>

                {/* Hero Image */}
                <div>
                    <label className="block text-sm font-bold text-stone-900 uppercase tracking-wider mb-4">Homepage Hero Image</label>
                    <div className="flex items-start gap-6">
                        <div className="w-48 h-28 bg-stone-100 rounded-lg overflow-hidden border border-stone-200">
                            <img src={heroImage} alt="Hero Preview" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1">
                            <p className="text-sm text-stone-500 mb-3">Upload a new banner for the homepage. Landscape aspect ratio (16:9) recommended.</p>
                            <label className="cursor-pointer bg-stone-100 text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-200 transition-colors text-sm font-medium inline-block">
                                Upload New Image
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'hero')} />
                            </label>
                        </div>
                    </div>
                </div>

                <hr className="border-stone-100"/>
                
                <div className="bg-rose-50 p-4 rounded-lg flex items-start gap-3">
                    <Icons.Sparkles className="text-rose-400 mt-1" size={20} />
                    <p className="text-sm text-stone-600">These settings are saved to your local browser storage. Clearing your cache will reset them.</p>
                </div>

            </div>
        </div>
    );
};

const AdminDashboard: React.FC<{ 
    posts: BlogPost[]; 
    onCreate: () => void;
    onEdit: (id: string) => void;
    onDelete: (id: string) => void;
    onOpenSettings: () => void;
}> = ({ posts, onCreate, onEdit, onDelete, onOpenSettings }) => {
    return (
        <div className="max-w-6xl mx-auto px-6 py-12 animate-fade-in">
            <div className="flex justify-between items-end mb-12">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">Dashboard</h1>
                    <p className="text-stone-500">Manage your stories and analytics.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={onOpenSettings}
                        className="bg-white border border-stone-200 text-stone-600 px-4 py-3 rounded-xl flex items-center gap-2 hover:bg-stone-50 transition-all shadow-sm"
                    >
                        <Icons.Sparkles size={18} /> Site Settings
                    </button>
                    <button 
                        onClick={onCreate}
                        className="bg-stone-900 text-white px-6 py-3 rounded-xl flex items-center gap-2 hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                        <Icons.Plus size={18} /> New Story
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                {[
                    { label: 'Total Views', val: posts.reduce((a, b) => a + b.views, 0).toLocaleString(), icon: Icons.Eye },
                    { label: 'Published', val: posts.filter(p => p.status === 'published').length, icon: Icons.Globe },
                    { label: 'Drafts', val: posts.filter(p => p.status === 'draft').length, icon: Icons.FileText },
                    { label: 'Total Posts', val: posts.length, icon: Icons.Layout }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-stone-50 rounded-xl text-stone-600">
                                <stat.icon size={20} />
                            </div>
                        </div>
                        <h3 className="text-3xl font-bold text-stone-800 mb-1">{stat.val}</h3>
                        <p className="text-stone-400 text-sm">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Posts Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 text-xs uppercase tracking-wider font-semibold">
                        <tr>
                            <th className="px-6 py-4">Title</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {posts.map(post => (
                            <tr key={post.id} className="hover:bg-stone-50/50 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-medium text-stone-900">{post.title}</div>
                                    <div className="text-xs text-stone-400 truncate max-w-xs">{post.excerpt}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${CATEGORY_CONFIG[post.category].color}`}>
                                        {post.category}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`flex items-center gap-1.5 text-xs font-medium ${post.status === 'published' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${post.status === 'published' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                        {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-stone-500">
                                    {new Date(post.publishedAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => onEdit(post.id)}
                                            className="p-2 hover:bg-stone-100 rounded-lg text-stone-500 hover:text-stone-800"
                                        >
                                            <Icons.PenTool size={16} />
                                        </button>
                                        <button 
                                            onClick={() => onDelete(post.id)}
                                            className="p-2 hover:bg-red-50 rounded-lg text-stone-400 hover:text-red-600"
                                        >
                                            <Icons.Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const EditorView: React.FC<{
    post?: BlogPost;
    onSave: (post: BlogPost) => void;
    onCancel: () => void;
}> = ({ post: initialPost, onSave, onCancel }) => {
    // State initialization
    const [title, setTitle] = useState(initialPost?.title || '');
    const [excerpt, setExcerpt] = useState(initialPost?.excerpt || '');
    const [category, setCategory] = useState<Category>(initialPost?.category || Category.Lifestyle);
    const [blocks, setBlocks] = useState<ContentBlock[]>(initialPost?.blocks || [{ id: '1', type: BlockType.Paragraph, content: '', width: 100 }]);
    const [status, setStatus] = useState<'draft' | 'published'>(initialPost?.status || 'draft');
    const [coverImage, setCoverImage] = useState(initialPost?.coverImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&q=80&w=800');
    
    // AI State
    const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

    const handleSave = () => {
        const newPost: BlogPost = {
            id: initialPost?.id || Math.random().toString(36).substr(2, 9),
            title: title || 'Untitled Post',
            excerpt,
            category,
            blocks,
            status,
            coverImage,
            author: initialPost?.author || 'Roshni',
            publishedAt: initialPost?.publishedAt || new Date().toISOString(),
            tags: [], // Simplification
            views: initialPost?.views || 0,
        };
        onSave(newPost);
    };

    const handleSuggestTitle = async () => {
        setIsGeneratingTitle(true);
        const contentSummary = excerpt || blocks.map(b => b.content).join(' ').slice(0, 500);
        const suggested = await suggestTitle(contentSummary);
        if (suggested) setTitle(suggested);
        setIsGeneratingTitle(false);
    };

    const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setCoverImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Editor Header */}
            <div className="sticky top-0 z-40 bg-white border-b border-stone-100 px-6 py-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <button onClick={onCancel} className="p-2 hover:bg-stone-100 rounded-full text-stone-500">
                        <Icons.X size={20} />
                    </button>
                    <span className="text-sm font-medium text-stone-400">
                        {initialPost ? 'Editing Story' : 'New Story'}
                    </span>
                    <span className="text-xs bg-stone-100 px-2 py-0.5 rounded text-stone-500">
                        {status === 'draft' ? 'Unsaved changes' : 'Saved'}
                    </span>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setStatus(status === 'draft' ? 'published' : 'draft')}
                        className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                    >
                        {status === 'published' ? 'Published' : 'Draft'}
                    </button>
                    <button 
                        onClick={handleSave}
                        className="bg-stone-900 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-stone-700 flex items-center gap-2"
                    >
                        <Icons.Save size={16} /> Save
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-12">
                {/* Meta Data Area */}
                <div className="mb-12 space-y-6">
                    {/* Cover Image */}
                    <div className="relative group w-full h-64 bg-stone-100 rounded-2xl overflow-hidden cursor-pointer border-2 border-dashed border-stone-200 hover:border-stone-400 transition-colors">
                        <img src={coverImage} className="w-full h-full object-cover" alt="Cover" />
                        <label className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                             <input type="file" className="hidden" onChange={handleCoverUpload} accept="image/*" />
                             <div className="opacity-0 group-hover:opacity-100 text-white font-medium flex flex-col items-center">
                                <Icons.Image size={24} className="mb-2" />
                                <span>Change Cover</span>
                             </div>
                        </label>
                    </div>

                    {/* Title Input */}
                    <div className="relative">
                        <input 
                            type="text" 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Story Title..."
                            className="w-full text-4xl md:text-5xl font-serif font-bold text-stone-900 placeholder:text-stone-300 outline-none bg-transparent"
                        />
                        <button 
                            onClick={handleSuggestTitle}
                            disabled={isGeneratingTitle}
                            className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-purple-400 hover:bg-purple-50 rounded-full hover:text-purple-600 transition-colors tooltip"
                            title="Generate Title with AI"
                        >
                            <Icons.Sparkles size={20} className={isGeneratingTitle ? 'animate-spin' : ''}/>
                        </button>
                    </div>

                    {/* Excerpt */}
                    <textarea 
                        value={excerpt}
                        onChange={(e) => setExcerpt(e.target.value)}
                        placeholder="Write a short excerpt..."
                        className="w-full text-xl text-stone-500 font-light outline-none bg-transparent resize-none h-20"
                    />

                    {/* Category Selector */}
                    <div className="flex gap-2 overflow-x-auto py-2">
                        {Object.values(Category).map(cat => (
                            <button
                                key={cat}
                                onClick={() => setCategory(cat)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${category === cat ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <hr className="border-stone-100 mb-12" />

                {/* Blocks Editor */}
                <BlockEditor blocks={blocks} onChange={setBlocks} />
            </div>
        </div>
    );
}

// --- Main App Component ---

const App: React.FC = () => {
    // Simulated Database
    const [posts, setPosts] = useState<BlogPost[]>(() => {
        const saved = localStorage.getItem('roshines_posts'); 
        return saved ? JSON.parse(saved) : MOCK_POSTS;
    });

    const [subscribers, setSubscribers] = useState<string[]>(() => {
        const saved = localStorage.getItem('roshines_subscribers');
        return saved ? JSON.parse(saved) : [];
    });

    const [siteSettings, setSiteSettings] = useState<SiteSettings>(() => {
        const saved = localStorage.getItem('roshines_settings');
        return saved ? JSON.parse(saved) : {
            aboutImage: DEFAULT_ABOUT_IMAGE,
            heroImage: DEFAULT_HERO_IMAGE,
            siteName: 'Ro-shines'
        };
    });

    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const saved = localStorage.getItem('roshines_current_user');
        return saved ? JSON.parse(saved) : null;
    });

    const [view, setView] = useState<ViewState>({ type: 'home' });
    const [searchQuery, setSearchQuery] = useState('');
    const [showNewsletter, setShowNewsletter] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);

    // Persistence
    useEffect(() => {
        localStorage.setItem('roshines_posts', JSON.stringify(posts));
    }, [posts]);

    useEffect(() => {
        localStorage.setItem('roshines_subscribers', JSON.stringify(subscribers));
    }, [subscribers]);

    useEffect(() => {
        localStorage.setItem('roshines_settings', JSON.stringify(siteSettings));
    }, [siteSettings]);

    useEffect(() => {
        if (currentUser) {
            localStorage.setItem('roshines_current_user', JSON.stringify(currentUser));
        } else {
            localStorage.removeItem('roshines_current_user');
        }
    }, [currentUser]);

    // Toast Timer
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // Handlers
    const handleCreatePost = () => setView({ type: 'admin-editor' });
    
    const handleEditPost = (id: string) => setView({ type: 'admin-editor', postId: id });
    
    const handleDeletePost = (id: string) => {
        if(confirm('Are you sure you want to delete this story?')) {
            setPosts(prev => prev.filter(p => p.id !== id));
        }
    };

    const handleSavePost = (post: BlogPost) => {
        let isNewPublish = false;
        
        setPosts(prev => {
            const existingIndex = prev.findIndex(p => p.id === post.id);
            if (existingIndex >= 0) {
                // Check if transitioning from draft to published
                if (prev[existingIndex].status === 'draft' && post.status === 'published') {
                    isNewPublish = true;
                }
                const newPosts = [...prev];
                newPosts[existingIndex] = post;
                return newPosts;
            } else {
                if (post.status === 'published') isNewPublish = true;
                return [post, ...prev];
            }
        });
        
        if (isNewPublish && subscribers.length > 0) {
            setNotification(`Newsletter sent to ${subscribers.length} subscribers!`);
        } else {
            setNotification('Story saved successfully.');
        }

        setView({ type: 'admin-dashboard' });
    };

    const handleSubscribe = (email: string) => {
        if (!subscribers.includes(email)) {
            setSubscribers(prev => [...prev, email]);
            // Do not close modal immediately, let the success state handle it
        } else {
            setNotification('You are already subscribed!');
            setShowNewsletter(false);
        }
    };

    const handleUpdateSettings = (newSettings: SiteSettings) => {
        setSiteSettings(newSettings);
        setNotification('Site settings updated!');
        setView({ type: 'admin-dashboard' });
    };

    const handleLogin = (user: User) => {
        setCurrentUser(user);
        setNotification(`Welcome back, ${user.name}!`);
        setView({ type: 'home' });
    };

    const handleLogout = () => {
        setCurrentUser(null);
        setNotification('Logged out successfully.');
        setView({ type: 'home' });
    };

    // Render Router
    const renderView = () => {
        // Admin Route Protection
        const adminRoutes = ['admin-dashboard', 'admin-editor', 'admin-settings'];
        if (adminRoutes.includes(view.type) && !currentUser?.isAdmin) {
             // Use setTimeout to avoid state update during render warning if immediate
             setTimeout(() => {
                 setNotification("Access Denied: Admin only area.");
                 setView({ type: 'home' });
             }, 0);
             return null;
        }

        switch (view.type) {
            case 'home':
                return <HomeView posts={posts} onPostClick={(id) => setView({ type: 'post', postId: id })} searchQuery={searchQuery} heroImage={siteSettings.heroImage} />;
            case 'post':
                const post = posts.find(p => p.id === view.postId);
                return post ? <PostDetailView 
                    post={post} 
                    onBack={() => setView({ type: 'home' })} 
                    currentUser={currentUser}
                    onLoginReq={() => setView({ type: 'login' })}
                /> : <div>Not Found</div>;
            case 'about':
                return <AboutView aboutImage={siteSettings.aboutImage} />;
            case 'login':
                return <LoginView isRegister={false} onLogin={handleLogin} onSwitchMode={() => setView({ type: 'register' })} />;
            case 'register':
                return <LoginView isRegister={true} onLogin={handleLogin} onSwitchMode={() => setView({ type: 'login' })} />;
            case 'admin-dashboard':
                return <AdminDashboard 
                    posts={posts} 
                    onCreate={handleCreatePost} 
                    onEdit={handleEditPost} 
                    onDelete={handleDeletePost} 
                    onOpenSettings={() => setView({ type: 'admin-settings' })}
                />;
            case 'admin-editor':
                const editPost = view.postId ? posts.find(p => p.id === view.postId) : undefined;
                return <EditorView post={editPost} onSave={handleSavePost} onCancel={() => setView({ type: 'admin-dashboard' })} />;
            case 'admin-settings':
                return <AdminSettings settings={siteSettings} onSave={handleUpdateSettings} onCancel={() => setView({ type: 'admin-dashboard' })} />;
            default:
                return <HomeView posts={posts} onPostClick={(id) => setView({ type: 'post', postId: id })} searchQuery={searchQuery} heroImage={siteSettings.heroImage} />;
        }
    };

    return (
        <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-rose-200 selection:text-rose-900">
            {view.type !== 'admin-editor' && view.type !== 'admin-settings' && view.type !== 'login' && view.type !== 'register' && (
                <Header 
                    view={view} 
                    setView={setView} 
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    onOpenNewsletter={() => setShowNewsletter(true)}
                    user={currentUser}
                    onLogout={handleLogout}
                />
            )}
            
            {renderView()}
            
            {view.type !== 'admin-editor' && view.type !== 'admin-settings' && view.type !== 'login' && view.type !== 'register' && (
                <Footer onOpenNewsletter={() => setShowNewsletter(true)} />
            )}

            {/* Global Components */}
            <NewsletterModal 
                isOpen={showNewsletter} 
                onClose={() => setShowNewsletter(false)} 
                onSubscribe={handleSubscribe} 
            />

            {/* Toast Notification */}
            {notification && (
                <div className="fixed bottom-6 right-6 bg-stone-900 text-white px-6 py-3 rounded-xl shadow-xl animate-slide-up flex items-center gap-3 z-50">
                    <Icons.Check size={18} className="text-emerald-400" />
                    <span className="text-sm font-medium">{notification}</span>
                </div>
            )}
        </div>
    );
};

export default App;
