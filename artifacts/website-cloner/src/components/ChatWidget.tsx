import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, X, Bot, Sparkles, AlertCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { db, CHATS_COLL } from '@/lib/firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { encryptMessage, decryptMessage } from '@/lib/crypto';

export interface ChatMessage {
  id: string;
  sessionId: string;
  sessionName: string;
  sender: 'user' | 'admin';
  text: string;
  timestamp: number;
}

const CHAT_SESSION_KEY = 'tinyfish_chat_session_id';
const CHAT_SESSION_NAME_KEY = 'tinyfish_chat_session_name';
const CHAT_LAST_READ_KEY = 'tinyfish_chat_last_read';

// Interactive suggestion chips
const SUGGESTIONS = [
  'How do I clone a website? 🌐',
  'Is this system secure? 🔒',
  'Can I download source code? 📂',
  'Contact an administrator 🧑‍💻'
];

export const getChatSession = () => {
  let sessionId = localStorage.getItem(CHAT_SESSION_KEY);
  let sessionName = localStorage.getItem(CHAT_SESSION_NAME_KEY);
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(CHAT_SESSION_KEY, sessionId);
  }
  if (!sessionName) {
    sessionName = 'Visitor #' + Math.floor(1000 + Math.random() * 9000);
    localStorage.setItem(CHAT_SESSION_NAME_KEY, sessionName);
  }
  return { sessionId, sessionName };
};

// Custom browser-synthesized audio effects (Native Web Audio API)
const playSound = (type: 'open' | 'close' | 'send' | 'receive') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'open') {
      // Warm rising synthesizer chime
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'close') {
      // Smooth falling chord
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.12);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'send') {
      // Upbeat digital click/plip
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.04);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'receive') {
      // Soft ambient alert chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.06); // E5
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch (err) {
    // Graceful fallback if audio context blocked or unsupported
  }
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { sessionId, sessionName } = getChatSession();

  // Load chats from Firebase Firestore and decrypt in real-time
  useEffect(() => {
    const q = query(
      collection(db, CHATS_COLL),
      where('sessionId', '==', sessionId)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        const docPromises = snapshot.docs.map(async (doc) => {
          const data = doc.data();
          // Decrypt the message end-to-end!
          const decryptedText = await decryptMessage(data.text || '', sessionId);
          return {
            id: doc.id,
            sessionId: data.sessionId,
            sessionName: data.sessionName,
            sender: data.sender,
            text: decryptedText,
            timestamp: data.timestamp || Date.now(),
          } as ChatMessage;
        });

        const decryptedChats = await Promise.all(docPromises);
        // Sort chronologically
        decryptedChats.sort((a, b) => a.timestamp - b.timestamp);

        // Play chime if admin replied
        if (decryptedChats.length > messages.length && messages.length > 0) {
          const lastMsg = decryptedChats[decryptedChats.length - 1];
          if (lastMsg.sender === 'admin') {
            playSound('receive');
          }
        }

        setMessages(decryptedChats);

        // Manage unread badges
        if (!isOpen) {
          const lastReadRaw = localStorage.getItem(CHAT_LAST_READ_KEY);
          const lastRead = lastReadRaw ? parseInt(lastReadRaw, 10) : 0;
          const unread = decryptedChats.filter(
            c => c.sender === 'admin' && c.timestamp > lastRead
          ).length;
          setUnreadCount(unread);
        } else {
          setUnreadCount(0);
          localStorage.setItem(CHAT_LAST_READ_KEY, String(Date.now()));
        }
      } catch (err) {
        console.error('Error decrypting Firestore chats:', err);
      }
    }, (error) => {
      console.error('Firestore subscription error:', error);
    });

    return () => unsubscribe();
  }, [isOpen, sessionId, messages.length]);

  // Scroll to bottom
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 80);
    }
  }, [messages, isOpen, isTyping]);

  const toggleWidget = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      playSound('open');
      setUnreadCount(0);
      localStorage.setItem(CHAT_LAST_READ_KEY, String(Date.now()));
    } else {
      playSound('close');
    }
  };

  const handleSendText = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    try {
      // 1. Encrypt message for End-to-End Encryption (E2EE)
      const encryptedText = await encryptMessage(textToSend, sessionId);

      const newMessageData = {
        sessionId,
        sessionName,
        sender: 'user',
        text: encryptedText, // ciphertext stored securely in Firestore
        timestamp: Date.now(),
      };

      playSound('send');
      
      // 2. Add to Firebase Firestore
      await addDoc(collection(db, CHATS_COLL), newMessageData);

      // 3. Trigger simulated response on first message
      const myMsgCount = messages.filter(m => m.sender === 'user').length;
      if (myMsgCount === 0) {
        setIsTyping(true);
        setTimeout(async () => {
          setIsTyping(false);
          const welcomeText = `Hi ${sessionName}! Thanks for reaching out. Our administration team has been notified of your inquiry. Feel free to describe any design, layouts, or URLs you'd like cloned, and we'll reply to you right here!`;
          const encryptedWelcome = await encryptMessage(welcomeText, sessionId);

          await addDoc(collection(db, CHATS_COLL), {
            sessionId,
            sessionName,
            sender: 'admin',
            text: encryptedWelcome,
            timestamp: Date.now(),
          });
        }, 1800);
      }
    } catch (e) {
      console.error('Firebase save failed:', e);
      toast.error('Network delay. Message failed to deliver.');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    handleSendText(inputText.trim());
    setInputText('');
  };

  const selectSuggestion = (suggestion: string) => {
    handleSendText(suggestion);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-mono select-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.7, rotate: -2 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, y: 40, scale: 0.75, rotate: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 220 }}
            style={{ transformOrigin: 'bottom right' }}
            className="w-[360px] md:w-[385px] h-[550px] bg-[#09090b]/95 border border-primary/25 rounded-[28px] overflow-hidden flex flex-col shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_35px_rgba(132,255,150,0.08)] backdrop-blur-xl mb-4 relative"
          >
            {/* Ambient colorful decoration lines */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

            {/* Header */}
            <div className="p-4 bg-card/60 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <motion.div 
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
                    className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-inner"
                  >
                    <Bot className="w-5 h-5 text-primary" />
                  </motion.div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-[#09090b] shadow-[0_0_8px_#34d399]" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-foreground flex items-center gap-1 uppercase tracking-wider">
                    Support Live <Sparkles className="w-3 h-3 text-primary animate-pulse" />
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-[8px] text-[#a1a1aa] font-bold uppercase tracking-widest">
                        Online
                      </p>
                    </div>
                    <span className="text-[8px] text-white/20">•</span>
                    <div className="flex items-center gap-0.5 text-primary">
                      <Shield className="w-2.5 h-2.5" />
                      <p className="text-[8px] font-black uppercase tracking-widest">
                        E2EE Secure
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Close Button with micro-rotation */}
              <motion.button
                whileHover={{ rotate: 90, scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={toggleWidget}
                className="p-1.5 rounded-xl border border-white/5 text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Message Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [1, 1.1, 1], opacity: 1 }}
                    transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                    className="p-4 bg-primary/5 rounded-full border border-primary/15"
                  >
                    <MessageSquare className="w-7 h-7 text-primary" />
                  </motion.div>
                  
                  <div className="space-y-1">
                    <h5 className="text-xs font-black text-foreground uppercase tracking-wider">Start a Conversation</h5>
                    <p className="text-[10px] text-muted-foreground font-sans max-w-[240px] leading-relaxed">
                      Have questions about website cloning, layouts, or customized development? Ping our live desk.
                    </p>
                  </div>

                  {/* Suggestion Chips */}
                  <div className="pt-2 w-full space-y-1.5">
                    <p className="text-[9px] text-primary uppercase font-bold tracking-widest text-center mb-1">
                      Quick Questions
                    </p>
                    <div className="flex flex-col gap-1.5">
                      {SUGGESTIONS.map((suggestion, idx) => (
                        <motion.button
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          whileHover={{ scale: 1.02, x: 2, backgroundColor: 'rgba(255,255,255,0.05)' }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => selectSuggestion(suggestion)}
                          className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[10px] text-muted-foreground font-sans hover:text-foreground hover:border-primary/20 transition-all cursor-pointer"
                        >
                          {suggestion}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                      const isUser = msg.sender === 'user';
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, scale: 0.85, y: 15, x: isUser ? 10 : -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                          transition={{ type: 'spring', damping: 18, stiffness: 200 }}
                          className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                        >
                          <div className="flex items-center gap-1.5 px-1 opacity-60">
                            <span className="text-[8px] text-muted-foreground font-mono">
                              {isUser ? sessionName : 'Desk Administrator'}
                            </span>
                            <span className="text-[8px] text-muted-foreground">•</span>
                            <span className="text-[8px] text-muted-foreground">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <motion.div
                            whileHover={{ scale: 1.01 }}
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs font-sans leading-relaxed break-words shadow-md transition-all ${
                              isUser
                                ? 'bg-primary text-primary-foreground font-medium rounded-tr-sm'
                                : 'bg-card border border-white/5 text-foreground rounded-tl-sm'
                            }`}
                          >
                            {msg.text}
                          </motion.div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* Typing Simulator */}
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-start space-y-1"
                    >
                      <span className="text-[8px] text-muted-foreground font-mono px-1">Desk Administrator typing...</span>
                      <div className="bg-card border border-white/5 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleFormSubmit} className="p-3 border-t border-white/5 bg-card/20 flex items-center gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Write your inquiry..."
                className="flex-1 bg-[#101012]/90 border-white/5 h-10 text-xs font-sans rounded-xl focus-visible:ring-primary focus-visible:border-primary/40 transition-all placeholder:opacity-50"
              />
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  type="submit"
                  disabled={!inputText.trim()}
                  size="icon"
                  className="h-10 w-10 bg-primary text-primary-foreground hover:opacity-90 rounded-xl transition-all shrink-0 shadow-lg cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </motion.div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button Container with Multi-Glow Ripples */}
      <div className="relative">
        <AnimatePresence>
          {!isOpen && (
            <>
              {/* Outer Pulse glow wave 1 */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0.5 }}
                animate={{ scale: [1, 1.45, 1], opacity: [0.4, 0, 0.4] }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-full bg-primary/15 -z-10 pointer-events-none"
              />
              {/* Outer Pulse glow wave 2 */}
              <motion.div
                initial={{ scale: 0.95, opacity: 0.3 }}
                animate={{ scale: [1, 1.8, 1], opacity: [0.25, 0, 0.25] }}
                exit={{ opacity: 0 }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut', delay: 1.25 }}
                className="absolute inset-0 rounded-full bg-primary/10 -z-10 pointer-events-none"
              />
            </>
          )}
        </AnimatePresence>

        {/* Floating Toggle Button */}
        <motion.button
          id="floating-chat-trigger"
          onClick={toggleWidget}
          whileHover={{ scale: 1.12, rotate: [0, -5, 5, 0] }}
          whileTap={{ scale: 0.9 }}
          className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_0_30px_rgba(132,255,150,0.3)] hover:shadow-[0_0_45px_rgba(132,255,150,0.5)] transition-all relative border border-primary/40 cursor-pointer"
          title="Open Support Chat Desk"
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close-icon"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <X className="w-6 h-6" />
              </motion.div>
            ) : (
              <motion.div
                key="chat-icon"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MessageSquare className="w-6 h-6" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Unread badge */}
          {unreadCount > 0 && (
            <motion.span 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 min-w-[20px] h-5 bg-red-500 text-[10px] font-bold rounded-full border border-[#09090b] flex items-center justify-center px-1 animate-bounce"
            >
              {unreadCount}
            </motion.span>
          )}
        </motion.button>
      </div>
    </div>
  );
}

