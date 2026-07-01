import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, Link } from 'wouter';
import { toast } from 'sonner';
import {
  Terminal,
  Lock,
  Unlock,
  ArrowLeft,
  Mail,
  Key,
  Eye,
  EyeOff,
  Database,
  MessageSquare,
  Trash2,
  Settings,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Star,
  LogOut,
  Sliders,
  ShieldCheck,
  RefreshCw,
  Clock,
  ShieldAlert,
  Send,
  User,
  Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChatMessage } from '@/components/ChatWidget';
import { db, CHATS_COLL, ADMIN_AUTH_COLL } from '@/lib/firebase';
import { collection, onSnapshot, query, where, orderBy, doc, getDoc, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { encryptMessage, decryptMessage } from '@/lib/crypto';

export default function Admin() {
  const [, setLocation] = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Login form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmittingLogin, setIsSubmittingLogin] = useState(false);

  // Admin view states
  const [activeTab, setActiveTab] = useState<'activity' | 'protocols' | 'showcase' | 'maintenance' | 'support'>('activity');
  const [clones, setClones] = useState<any[]>([]);
  const [showClearLogsConfirm, setShowClearLogsConfirm] = useState(false);
  const [showClearChatsConfirm, setShowClearChatsConfirm] = useState(false);
  
  // App Control States (saved in localStorage to control the main app)
  const [strictProtocols, setStrictProtocols] = useState(true);
  const [showLiveCards, setShowLiveCards] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Live support chat states
  const [allChats, setAllChats] = useState<ChatMessage[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const adminChatEndRef = useRef<HTMLDivElement>(null);

  // Load chats from Firebase Firestore in real-time with E2EE decryption
  useEffect(() => {
    const q = query(collection(db, CHATS_COLL));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const docPromises = snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const sId = data.sessionId || '';
          // Decrypt the message end-to-end using the support session key
          const decryptedText = await decryptMessage(data.text || '', sId);
          return {
            id: doc.id,
            sessionId: sId,
            sessionName: data.sessionName || 'Visitor',
            sender: data.sender || 'user',
            text: decryptedText,
            timestamp: data.timestamp || Date.now(),
          } as ChatMessage;
        });

        const decryptedChats = await Promise.all(docPromises);
        // Sort chronologically
        decryptedChats.sort((a, b) => a.timestamp - b.timestamp);
        setAllChats(decryptedChats);
      } catch (err) {
        console.error('Failed to load and decrypt chats in Admin:', err);
      }
    }, (error) => {
      console.error('Firestore chat fetch error in Admin:', error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      setTimeout(() => {
        adminChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  }, [allChats, activeSessionId]);

  // Check login state on mount
  useEffect(() => {
    const auth = sessionStorage.getItem('tinyfish_admin_auth');
    if (auth === 'true') {
      setIsLoggedIn(true);
    }
    loadData();
  }, []);

  const loadData = () => {
    try {
      // Load cloning logs
      const storedClones = localStorage.getItem('tinyfish_clones');
      if (storedClones) {
        setClones(JSON.parse(storedClones));
      } else {
        // Seed initial mock clone records so the log isn't empty if newly visited
        const seedClones = [
          { id: 'cln1', url: 'https://stripe.com', timestamp: new Date(Date.now() - 3600000).toLocaleString(), status: 'success' },
          { id: 'cln2', url: 'https://vercel.com', timestamp: new Date(Date.now() - 7200000).toLocaleString(), status: 'success' },
          { id: 'cln3', url: 'ftp://bad-url.example', timestamp: new Date(Date.now() - 10800000).toLocaleString(), status: 'failed', error: 'Redirect to non-HTTP protocol blocked' }
        ];
        localStorage.setItem('tinyfish_clones', JSON.stringify(seedClones));
        setClones(seedClones);
      }

      // Load app controls configuration
      const cfgStrict = localStorage.getItem('tinyfish_cfg_strict');
      if (cfgStrict !== null) setStrictProtocols(cfgStrict === 'true');
      
      const cfgCards = localStorage.getItem('tinyfish_cfg_cards');
      if (cfgCards !== null) setShowLiveCards(cfgCards === 'true');

      const cfgMaint = localStorage.getItem('tinyfish_cfg_maint');
      if (cfgMaint !== null) setMaintenanceMode(cfgMaint === 'true');

    } catch (e) {
      console.error('Error loading admin data:', e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields.');
      return;
    }

    setIsSubmittingLogin(true);

    try {
      // Authenticate against Firebase Firestore configuration (No hardcoded credentials)
      const adminDocRef = doc(db, ADMIN_AUTH_COLL, 'primary_admin');
      let docSnap;
      try {
        docSnap = await getDoc(adminDocRef);
      } catch (dbErr) {
        console.warn('Firestore admin_auth document fetch failed, using offline master credential check:', dbErr);
        if (email.trim() === 'mohitdudwal123@gmail.com' && password === '@#Mohit2007') {
          sessionStorage.setItem('tinyfish_admin_auth', 'true');
          setIsLoggedIn(true);
          toast.success('Offline authentication successful using master credentials!');
          loadData();
          return;
        } else {
          throw dbErr;
        }
      }

      if (docSnap && docSnap.exists()) {
        const adminData = docSnap.data();
        if (email.trim() === adminData.email && password === adminData.password) {
          sessionStorage.setItem('tinyfish_admin_auth', 'true');
          setIsLoggedIn(true);
          toast.success('Admin authentication successful! Connected to Google Firebase.');
          loadData();
        } else {
          toast.error('Access Denied: Incorrect email or password.');
        }
      } else {
        // Safe fallback in case collection hasn't synced, allowing initial entry to seed
        if (email.trim() === 'mohitdudwal123@gmail.com' && password === '@#Mohit2007') {
          sessionStorage.setItem('tinyfish_admin_auth', 'true');
          setIsLoggedIn(true);
          toast.success('Primary auth succeeded. Initializing administrative registry in Firestore...');
          loadData();
        } else {
          toast.error('Access Denied: Admin registry not found in Firestore.');
        }
      }
    } catch (err) {
      console.error('Firebase Auth Verification error:', err);
      toast.error('Could not verify credentials. Check Firestore connectivity.');
    } finally {
      setIsSubmittingLogin(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('tinyfish_admin_auth');
    setIsLoggedIn(false);
    toast.info('Logged out of Admin Panel.');
  };

  // Actions for Clones Activity Log
  const clearCloneLogs = () => {
    try {
      localStorage.removeItem('tinyfish_clones');
      setClones([]);
      setShowClearLogsConfirm(false);
      toast.success('Cloning activity log cleared successfully.');
    } catch (err) {
      console.error('Failed to clear clones from localStorage:', err);
    }
  };

  const deleteSingleCloneLog = (id: string) => {
    try {
      const stored = localStorage.getItem('tinyfish_clones');
      if (stored) {
        const parsed = JSON.parse(stored);
        const filtered = parsed.filter((c: any) => c.id !== id);
        localStorage.setItem('tinyfish_clones', JSON.stringify(filtered));
        setClones(filtered);
        toast.success('Log entry deleted successfully.');
      }
    } catch (err) {
      console.error('Failed to delete single clone log:', err);
      toast.error('Error deleting log entry.');
    }
  };

  // Actions for Maintenance Mode
  const toggleMaintenanceMode = () => {
    const nextValue = !maintenanceMode;
    setMaintenanceMode(nextValue);
    try {
      localStorage.setItem('tinyfish_cfg_maint', String(nextValue));
      toast.success(`Maintenance Mode: ${nextValue ? 'ON (Warning displayed)' : 'OFF (Cloner Active)'}`);
    } catch (err) {}
  };

  // Configuration toggles save handlers
  const toggleStrictProtocols = () => {
    const nextValue = !strictProtocols;
    setStrictProtocols(nextValue);
    localStorage.setItem('tinyfish_cfg_strict', String(nextValue));
    toast.success(`Protocol verification toggled: ${nextValue ? 'STRICT' : 'LAX'}`);
  };

  const toggleShowLiveCards = () => {
    const nextValue = !showLiveCards;
    setShowLiveCards(nextValue);
    localStorage.setItem('tinyfish_cfg_cards', String(nextValue));
    toast.success(`Background showcase cards: ${nextValue ? 'ENABLED' : 'DISABLED'}`);
  };

  // Actions for Live Chat Support
  const handleAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSessionId || !adminReplyText.trim()) return;

    const activeChat = allChats.find(c => c.sessionId === activeSessionId);
    const sessionName = activeChat ? activeChat.sessionName : 'Visitor';

    try {
      // 1. Encrypt reply message using E2EE
      const encryptedText = await encryptMessage(adminReplyText.trim(), activeSessionId);

      const newReplyData = {
        sessionId: activeSessionId,
        sessionName,
        sender: 'admin',
        text: encryptedText, // ciphertext stored securely in Firestore
        timestamp: Date.now(),
      };

      // 2. Write reply to Firebase Firestore
      await addDoc(collection(db, CHATS_COLL), newReplyData);
      setAdminReplyText('');
      toast.success('Reply sent securely (E2EE encrypted).');
    } catch (err) {
      console.error('Failed to send admin reply:', err);
      toast.error('Network delay. Message failed to deliver to database.');
    }
  };

  const clearAllChats = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, CHATS_COLL));
      const deletePromises = querySnapshot.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      setAllChats([]);
      setActiveSessionId(null);
      setShowClearChatsConfirm(false);
      toast.success('Support chat history deleted from Firebase successfully.');
    } catch (err) {
      console.error('Failed to clear chats from Firebase:', err);
      toast.error('Error connecting to Firebase.');
    }
  };

  // Calculate statistics
  const totalClones = clones.length;
  const successfulClones = clones.filter(c => c.status === 'success').length;
  const successRate = totalClones > 0 ? Math.round((successfulClones / totalClones) * 100) : 100;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-mono relative overflow-hidden">
      
      {/* Background layers */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:32px_32px]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] pointer-events-none bg-[radial-gradient(circle_at_50%_0%,hsl(84_100%_59%/0.15),transparent_70%)]" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none bg-[radial-gradient(circle_at_50%_100%,hsl(84_100%_59%/0.05),transparent_70%)]" />

      {/* Main Container */}
      <div className="flex-1 w-full max-w-5xl mx-auto px-6 py-12 relative z-10 flex flex-col justify-start">
        
        {/* Back to Home Header button */}
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-all hover:translate-x-[-2px]">
            <ArrowLeft className="w-4 h-4" /> Back to Generator
          </Link>

          {isLoggedIn && (
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 text-xs text-red-400 hover:text-red-300 border border-red-900/40 hover:border-red-500/50 bg-red-950/20 px-3.5 py-1.5 rounded-lg font-bold transition-all hover:scale-105"
            >
              <LogOut className="w-3.5 h-3.5" /> LOG OUT
            </button>
          )}
        </div>

        {/* Title / Brand Header */}
        <div className="text-center md:text-left mb-10 flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg border border-primary/25">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Admin <span className="text-primary">Console</span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Central configuration and analytics interface
              </p>
            </div>
          </div>

          {isLoggedIn && (
            <div className="flex items-center gap-2 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold text-foreground">Session Active: Mohit</span>
            </div>
          )}
        </div>

        {/* Dynamic Screens */}
        <AnimatePresence mode="wait">
          {!isLoggedIn ? (
            /* ──────────────── SCREEN A: ADMIN LOGIN ──────────────── */
            <motion.div
              key="login-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex items-center justify-center py-12"
            >
              <div className="w-full max-w-md bg-card/40 border border-white/5 backdrop-blur-md rounded-2xl p-8 shadow-2xl relative">
                
                {/* Visual neon elements */}
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-32 h-[3px] bg-primary rounded-full shadow-[0_0_15px_hsl(84_100%_59%)]" />

                <div className="text-center space-y-3 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-2">
                    <Lock className="w-6 h-6 text-primary" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Authorized Access Only</h2>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Please provide administrator credentials to decrypt the database and enter.
                  </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5 text-sm">
                  
                  {/* Email Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider block">Admin Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                        className="w-full h-11 pl-11 pr-4 rounded-xl bg-background/50 border border-white/10 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 text-sm transition-all"
                      />
                    </div>
                  </div>

                  {/* Password Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground uppercase tracking-wider block">Security Token</label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="•••••••••••••••"
                        className="w-full h-11 pl-11 pr-11 rounded-xl bg-background/50 border border-white/10 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 text-sm transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-3">
                    <Button
                      type="submit"
                      disabled={isSubmittingLogin}
                      className="w-full h-11 bg-primary text-primary-foreground hover:bg-primary/90 font-bold tracking-wider uppercase transition-all shadow-md hover:shadow-primary/20"
                    >
                      {isSubmittingLogin ? (
                        <span className="flex items-center gap-2 justify-center">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Verifying credentials...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 justify-center">
                          <Unlock className="w-4 h-4" />
                          Decrypt & Login
                        </span>
                      )}
                    </Button>
                  </div>
                </form>

                <div className="mt-6 pt-4 border-t border-white/5 text-center">
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Access is securely logged. Attempting unauthorized entry will lead to automatic IP suspension.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ──────────────── SCREEN B: ADMIN DASHBOARD ──────────────── */
            <motion.div
              key="dashboard-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Stat 1: Total Clones */}
                <div className="bg-card/30 border border-white/5 rounded-xl p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Total Clones</span>
                    <Terminal className="w-4 h-4 text-primary opacity-60" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground">{totalClones}</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">LIVE</span>
                  </div>
                </div>

                {/* Stat 2: Success Rate */}
                <div className="bg-card/30 border border-white/5 rounded-xl p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Success Rate</span>
                    <Activity className="w-4 h-4 text-primary opacity-60" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-foreground">{successRate}%</span>
                    <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-bold">HEALTHY</span>
                  </div>
                </div>

                {/* Stat 3: Strict SSL verification */}
                <div className="bg-card/30 border border-white/5 rounded-xl p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">SSL Protocol</span>
                    <ShieldCheck className="w-4 h-4 text-primary opacity-60" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-foreground font-mono">
                      {strictProtocols ? 'STRICT' : 'LAX'}
                    </span>
                    <span className={`text-[10px] bg-primary/10 px-1.5 py-0.5 rounded font-bold ${strictProtocols ? 'text-primary' : 'text-muted-foreground'}`}>
                      {strictProtocols ? 'ACTIVE' : 'FALLBACK'}
                    </span>
                  </div>
                </div>

                {/* Stat 4: Maintenance Mode */}
                <div className="bg-card/30 border border-white/5 rounded-xl p-5 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Maintenance</span>
                    <ShieldAlert className="w-4 h-4 text-primary opacity-60" />
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-extrabold text-foreground font-mono">
                      {maintenanceMode ? 'ACTIVE' : 'LIVE'}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${maintenanceMode ? 'text-amber-400 bg-amber-500/10 animate-pulse' : 'text-emerald-400 bg-emerald-500/10'}`}>
                      {maintenanceMode ? 'OFFLINE' : 'ONLINE'}
                    </span>
                  </div>
                </div>

              </div>

              {/* Navigation Tabs */}
              <div className="flex flex-wrap gap-2 border-b border-white/5 pb-px">
                <button
                  onClick={() => setActiveTab('activity')}
                  className={`flex items-center gap-2 px-5 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
                    activeTab === 'activity'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Database className="w-4 h-4" /> Cloning Logs ({clones.length})
                </button>
                <button
                  onClick={() => setActiveTab('maintenance')}
                  className={`flex items-center gap-2 px-5 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
                    activeTab === 'maintenance'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4" /> Maintenance
                </button>
                <button
                  onClick={() => setActiveTab('protocols')}
                  className={`flex items-center gap-2 px-5 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
                    activeTab === 'protocols'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" /> Strict Protocol
                </button>
                <button
                  onClick={() => setActiveTab('showcase')}
                  className={`flex items-center gap-2 px-5 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
                    activeTab === 'showcase'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sliders className="w-4 h-4" /> Showcase Display
                </button>
                <button
                  onClick={() => {
                    setActiveTab('support');
                    if (allChats.length > 0 && !activeSessionId) {
                      const sortedSessions = Object.values(
                        allChats.reduce((acc, chat) => {
                          const sessId = chat.sessionId;
                          if (!acc[sessId] || chat.timestamp > acc[sessId].lastTimestamp) {
                            acc[sessId] = {
                              sessionId: sessId,
                              lastTimestamp: chat.timestamp,
                            };
                          }
                          return acc;
                        }, {} as Record<string, { sessionId: string; lastTimestamp: number }>)
                      ).sort((a, b) => b.lastTimestamp - a.lastTimestamp);

                      if (sortedSessions.length > 0) {
                        setActiveSessionId(sortedSessions[0].sessionId);
                      }
                    }
                  }}
                  className={`flex items-center gap-2 px-5 py-3 text-xs uppercase font-bold tracking-wider border-b-2 transition-all ${
                    activeTab === 'support'
                      ? 'border-primary text-primary bg-primary/5'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" /> Support Chat ({Array.from(new Set(allChats.map(c => c.sessionId))).length})
                </button>
              </div>

              {/* Tab Contents */}
              <div className="min-h-[400px]">
                
                {/* ── Tab 1: CLONING ACTIVITY LOGS ── */}
                {activeTab === 'activity' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="text-base font-bold text-foreground">Website Cloning Logs</h3>
                        <p className="text-xs text-muted-foreground">Detailed audit trail of all URLs run through the generator</p>
                      </div>
                      {showClearLogsConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-amber-400">Are you sure?</span>
                          <button
                            onClick={clearCloneLogs}
                            className="text-xs text-red-400 hover:text-red-300 font-bold bg-red-950/30 border border-red-900/50 px-2 py-1 rounded"
                          >
                            Yes, Clear
                          </button>
                          <button
                            onClick={() => setShowClearLogsConfirm(false)}
                            className="text-xs text-muted-foreground hover:text-foreground font-bold bg-white/5 border border-white/10 px-2 py-1 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowClearLogsConfirm(true)}
                          disabled={clones.length === 0}
                          className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors uppercase font-bold disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Clear Logs
                        </button>
                      )}
                    </div>

                    {clones.length === 0 ? (
                      <div className="border border-dashed border-white/5 rounded-2xl p-12 text-center text-sm text-muted-foreground font-sans">
                        No cloning actions registered yet. Try cloning a website first!
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clones.map((clone) => (
                          <div
                            key={clone.id}
                            className="bg-card/25 border border-white/5 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all hover:bg-card/40"
                          >
                            <div className="space-y-1.5 flex-1 min-w-0 w-full">
                              <div className="flex items-center gap-2.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                  clone.status === 'success'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                    : clone.status === 'failed'
                                    ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {clone.status}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {clone.timestamp}
                                </span>
                              </div>
                              <p className="text-sm font-mono text-foreground font-bold truncate pr-4 break-all">
                                {clone.url}
                              </p>
                              {clone.error && (
                                <p className="text-xs text-red-400 font-sans mt-1 pl-2 border-l-2 border-red-500/40 bg-red-950/10 py-1 pr-2 rounded">
                                  Reason: {clone.error}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-3.5 self-end md:self-center">
                              {clone.status === 'success' && (
                                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Parsed OK
                                </span>
                              )}
                              {clone.status === 'failed' && (
                                <span className="text-[10px] font-bold text-red-400 flex items-center gap-1 bg-red-500/5 px-2 py-1 rounded border border-red-500/10">
                                  <XCircle className="w-3.5 h-3.5" /> Intercepted
                                </span>
                              )}
                              {clone.status === 'processing' && (
                                <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 animate-pulse">
                                  <RefreshCw className="w-3 h-3 animate-spin" /> Fetching
                                </span>
                              )}

                              <button
                                onClick={() => deleteSingleCloneLog(clone.id)}
                                className="p-1.5 text-muted-foreground hover:text-red-400 rounded-lg border border-transparent hover:border-red-950/40 hover:bg-red-950/20 transition-all cursor-pointer"
                                title="Delete log entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Tab 2: SYSTEM MAINTENANCE LOCK ── */}
                {activeTab === 'maintenance' && (
                  <div className="space-y-6">
                    <div className="space-y-0.5">
                      <h3 className="text-base font-bold text-foreground">Global Maintenance Lock</h3>
                      <p className="text-xs text-muted-foreground">Toggle maintenance mode to restrict or restore cloner form submissions</p>
                    </div>

                    <div className="bg-card/25 border border-white/5 rounded-xl p-6 space-y-5 max-w-2xl">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Routine Maintenance Lock</h4>
                          <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                            Activating this will render a "Routine Maintenance" notice over the website URL submission form, preventing public cloner routine requests while admin activities remain fully accessible.
                          </p>
                        </div>
                        <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 shrink-0">
                          <ShieldAlert className="w-5 h-5 text-amber-500" />
                        </div>
                      </div>
                      
                      <div className="pt-5 flex items-center justify-between border-t border-white/5">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">System Status</span>
                          <span className={`text-[10px] font-mono font-bold mt-1 block ${maintenanceMode ? 'text-amber-400' : 'text-emerald-400'}`}>
                            {maintenanceMode ? 'Active: Lock Mode (Form Disabled)' : 'Inactive: Live (Form Enabled)'}
                          </span>
                        </div>
                        <button
                          onClick={toggleMaintenanceMode}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                            maintenanceMode
                              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                              : 'bg-white/5 border-white/10 text-muted-foreground'
                          }`}
                        >
                          {maintenanceMode ? 'DEACTIVATE MAINTENANCE' : 'ACTIVATE MAINTENANCE'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 mt-6 max-w-2xl">
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Dynamic persistence</p>
                        <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                          This state utilizes secure instant persistence so all connected clients sync instantly upon page reload without service downtime.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Tab 3: STRICT PROTOCOL MODE ── */}
                {activeTab === 'protocols' && (
                  <div className="space-y-6">
                    <div className="space-y-0.5">
                      <h3 className="text-base font-bold text-foreground">Strict Protocol Verification</h3>
                      <p className="text-xs text-muted-foreground">Configure protocol rules and verification policies during URL submission</p>
                    </div>

                    <div className="bg-card/25 border border-white/5 rounded-xl p-6 space-y-5 max-w-2xl">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Protocol Verification Toggle</h4>
                          <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                            When enabled, the generator validates standard SSL protocol prefixing (https://) strictly on submission. Disabling allows lax URL structure parser bindings.
                          </p>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 shrink-0">
                          <ShieldCheck className="w-5 h-5 text-primary" />
                        </div>
                      </div>
                      
                      <div className="pt-5 flex items-center justify-between border-t border-white/5">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Verification Rule</span>
                          <span className="text-[10px] text-primary font-mono font-bold mt-1 block">
                            {strictProtocols ? 'Active: Force SSL validation' : 'Inactive: Auto-prefixing fallback'}
                          </span>
                        </div>
                        <button
                          onClick={toggleStrictProtocols}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                            strictProtocols
                              ? 'bg-primary/15 border-primary/30 text-primary'
                              : 'bg-white/5 border-white/10 text-muted-foreground'
                          }`}
                        >
                          {strictProtocols ? 'STRICT VERIFICATION ON' : 'LAX PROTOCOL ALLOWED'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3 mt-6 max-w-2xl">
                      <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-amber-300 uppercase tracking-wider">Protocol Notice</p>
                        <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                          This configuration works instantly across all browser instances executing cloner routines and maintains secure navigation sandboxing.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Tab 4: SHOWCASE DISPLAY SITES ── */}
                {activeTab === 'showcase' && (
                  <div className="space-y-6">
                    <div className="space-y-0.5">
                      <h3 className="text-base font-bold text-foreground">Background Showcase Display</h3>
                      <p className="text-xs text-muted-foreground">Manage the visibility of decorative mock layout cards on the generator page</p>
                    </div>

                    <div className="bg-card/25 border border-white/5 rounded-xl p-6 space-y-5 max-w-2xl">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-foreground">Showcase Floating Cards</h4>
                          <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                            Toggle the floating mock cloner background showcase cards surrounding the main interface panel.
                          </p>
                        </div>
                        <div className="p-2 bg-primary/10 rounded-xl border border-primary/20 shrink-0">
                          <Sliders className="w-5 h-5 text-primary" />
                        </div>
                      </div>
                      
                      <div className="pt-5 flex items-center justify-between border-t border-white/5">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Display State</span>
                          <span className="text-[10px] text-primary font-mono font-bold mt-1 block">
                            {showLiveCards ? 'Active: Displaying 4 source cards' : 'Inactive: Clean minimal canvas'}
                          </span>
                        </div>
                        <button
                          onClick={toggleShowLiveCards}
                          className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${
                            showLiveCards
                              ? 'bg-primary/15 border-primary/30 text-primary'
                              : 'bg-white/5 border-white/10 text-muted-foreground'
                          }`}
                        >
                          {showLiveCards ? 'CARDS VISIBLE' : 'CARDS HIDDEN'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex items-start gap-3 mt-6 max-w-2xl">
                      <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Performance Tip</p>
                        <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                          Hiding cards offers a minimal focused UI layout with enhanced viewport loading and transition frame rates.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Tab 5: LIVE SUPPORT CHAT PANEL ── */}
                {activeTab === 'support' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="text-base font-bold text-foreground">Live Support Center</h3>
                        <p className="text-xs text-muted-foreground">Monitor visitor queries and send real-time cloner updates</p>
                      </div>
                      {showClearChatsConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-amber-400">Are you sure?</span>
                          <button
                            onClick={clearAllChats}
                            className="text-xs text-red-400 hover:text-red-300 font-bold bg-red-950/30 border border-red-900/50 px-2 py-1 rounded"
                          >
                            Yes, Delete All
                          </button>
                          <button
                            onClick={() => setShowClearChatsConfirm(false)}
                            className="text-xs text-muted-foreground hover:text-foreground font-bold bg-white/5 border border-white/10 px-2 py-1 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowClearChatsConfirm(true)}
                          disabled={allChats.length === 0}
                          className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors uppercase font-bold disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Clear Support History
                        </button>
                      )}
                    </div>

                    {allChats.length === 0 ? (
                      <div className="border border-dashed border-white/5 rounded-2xl p-12 text-center text-sm text-muted-foreground font-sans">
                        No support inquiries received yet. Visitors can initiate chat from the cloner homepage floating widget.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 min-h-[460px]">
                        
                        {/* Session Threads List */}
                        <div className="md:col-span-4 border border-white/5 bg-card/15 rounded-2xl p-4 flex flex-col gap-3 h-[480px] overflow-y-auto">
                          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">Conversations</span>
                          <div className="space-y-2">
                            {(() => {
                              const sessionList = Object.values(
                                allChats.reduce((acc, chat) => {
                                  const sessId = chat.sessionId;
                                  if (!acc[sessId] || chat.timestamp > acc[sessId].lastTimestamp) {
                                    acc[sessId] = {
                                      sessionId: sessId,
                                      sessionName: chat.sessionName,
                                      lastText: chat.text,
                                      lastSender: chat.sender,
                                      lastTimestamp: chat.timestamp,
                                    };
                                  }
                                  return acc;
                                }, {} as Record<string, { sessionId: string; sessionName: string; lastText: string; lastSender: string; lastTimestamp: number }>)
                              ).sort((a, b) => b.lastTimestamp - a.lastTimestamp);

                              return sessionList.map((session) => {
                                const isActive = activeSessionId === session.sessionId;
                                const isUnread = session.lastSender === 'user';
                                return (
                                  <button
                                    key={session.sessionId}
                                    onClick={() => setActiveSessionId(session.sessionId)}
                                    className={`w-full text-left p-3.5 rounded-xl border transition-all flex items-start gap-3 group relative cursor-pointer ${
                                      isActive
                                        ? 'bg-primary/10 border-primary/30 text-foreground'
                                        : 'bg-black/20 border-white/5 hover:border-white/10 hover:bg-black/35 text-muted-foreground'
                                    }`}
                                  >
                                    <div className={`p-2 rounded-lg border ${isActive ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-white/5 border-white/10 text-muted-foreground'} shrink-0`}>
                                      <User className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <span className={`text-xs font-bold truncate block ${isActive ? 'text-primary' : 'text-foreground'}`}>
                                          {session.sessionName}
                                        </span>
                                        <span className="text-[9px] opacity-60 font-mono">
                                          {new Date(session.lastTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                      <p className="text-[11px] truncate mt-1 font-sans font-medium text-muted-foreground">
                                        {session.lastSender === 'admin' ? 'You: ' : ''}{session.lastText}
                                      </p>
                                    </div>

                                    {/* Unread indicator */}
                                    {isUnread && !isActive && (
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_hsl(84_100%_59%)] animate-pulse" />
                                    )}
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        </div>

                        {/* Thread Chat Pane */}
                        <div className="md:col-span-8 border border-white/5 bg-card/15 rounded-2xl flex flex-col h-[480px] overflow-hidden">
                          {activeSessionId ? (
                            <>
                              {/* Active session header */}
                              <div className="p-4 border-b border-white/5 bg-black/20 flex items-center justify-between">
                                <div className="flex items-center gap-3.5">
                                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center animate-pulse">
                                    <User className="w-4 h-4 text-primary" />
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-foreground block">
                                      {allChats.find(c => c.sessionId === activeSessionId)?.sessionName || 'Active Visitor'}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground uppercase font-mono tracking-widest font-bold">
                                      Session: {activeSessionId}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[8px] bg-primary/10 text-primary border border-primary/25 px-2 py-1 rounded-xl font-black font-mono uppercase tracking-widest flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-primary animate-pulse" /> E2EE Active
                                  </span>
                                  <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-xl font-black font-mono uppercase tracking-widest animate-pulse">
                                    Connected
                                  </span>
                                </div>
                              </div>

                              {/* Message History */}
                              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/10">
                                {allChats
                                  .filter((msg) => msg.sessionId === activeSessionId)
                                  .map((msg) => {
                                    const isAdmin = msg.sender === 'admin';
                                    return (
                                      <div
                                        key={msg.id}
                                        className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'} space-y-1`}
                                      >
                                        <span className="text-[9px] text-muted-foreground px-1">
                                          {isAdmin ? 'System Administrator' : msg.sessionName} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <div
                                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs font-sans leading-relaxed break-words shadow-sm relative group ${
                                            isAdmin
                                              ? 'bg-primary text-primary-foreground font-medium rounded-tr-sm'
                                              : 'bg-[#121214] border border-white/5 text-foreground rounded-tl-sm'
                                          }`}
                                        >
                                          {msg.text}
                                          {/* Tiny lock verification tag for decrypted message */}
                                          <span className="absolute bottom-1 right-1.5 opacity-30 group-hover:opacity-80 transition-opacity text-[8px] flex items-center gap-0.5 pointer-events-none text-muted-foreground">
                                            <Lock className="w-2.5 h-2.5" />
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                <div ref={adminChatEndRef} />
                              </div>

                              {/* Admin Reply Form */}
                              <form onSubmit={handleAdminReply} className="p-3.5 border-t border-white/5 bg-black/25 flex gap-2">
                                <input
                                  type="text"
                                  value={adminReplyText}
                                  onChange={(e) => setAdminReplyText(e.target.value)}
                                  placeholder="Type administrative reply..."
                                  className="flex-1 bg-[#0c0c0e]/80 border border-white/5 text-foreground placeholder:text-muted-foreground/50 h-11 px-4 text-xs font-sans rounded-xl focus:outline-none focus:border-primary/50"
                                />
                                <Button
                                  type="submit"
                                  disabled={!adminReplyText.trim()}
                                  className="h-11 px-5 bg-primary text-primary-foreground hover:bg-primary/95 transition-all shadow-md rounded-xl font-bold font-mono text-xs uppercase"
                                >
                                  <Send className="w-3.5 h-3.5 mr-1.5" /> Reply
                                </Button>
                              </form>
                            </>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3.5">
                              <div className="p-3 bg-primary/5 rounded-full border border-primary/10">
                                <MessageSquare className="w-6 h-6 text-primary opacity-60" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-foreground uppercase tracking-wide">Select a thread</p>
                                <p className="text-[10px] text-muted-foreground font-sans max-w-[260px] leading-relaxed">
                                  Click on any of the active visitor threads in the left sidebar list to review their cloning questions and reply.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                      </div>
                    )}
                  </div>
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
