import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGeneratePrompt } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Copy, Download, Terminal, Search, Check, Globe, Sparkles, MessageSquare, Send, Star, Heart, CheckCircle2, Lock } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { toast } from 'sonner';
import ChatWidget from '@/components/ChatWidget';

// Popular sites for live background preview cards
const SHOWCASE_SITES = [
  { url: 'https://stripe.com', label: 'stripe.com' },
  { url: 'https://vercel.com', label: 'vercel.com' },
  { url: 'https://github.com', label: 'github.com' },
  { url: 'https://linear.app', label: 'linear.app' },
  { url: 'https://notion.so', label: 'notion.so' },
  { url: 'https://figma.com', label: 'figma.com' },
];

function screenshotUrl(site: string) {
  return `https://api.microlink.io/?url=${encodeURIComponent(site)}&screenshot=true&meta=false&embed=screenshot.url&type=jpeg`;
}

// Floating card layout — positions around the edges
const CARD_CONFIGS = [
  { style: { top: '4%',   left:  '-6%'  }, rotate: -14, delay: 0    },
  { style: { top: '8%',   right: '-8%'  }, rotate:  10, delay: 0.15 },
  { style: { top: '44%',  left:  '-9%'  }, rotate:  12, delay: 0.3  },
  { style: { top: '42%',  right: '-10%' }, rotate: -9,  delay: 0.45 },
  { style: { bottom:'6%', left:  '-5%'  }, rotate:  8,  delay: 0.6  },
  { style: { bottom:'4%', right: '-7%'  }, rotate: -12, delay: 0.75 },
];

function FloatingCard({ site, config, index }: { site: typeof SHOWCASE_SITES[0]; config: typeof CARD_CONFIGS[0]; index: number }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ ...config.style, zIndex: 1 }}
      initial={{ opacity: 0, scale: 0.8, rotate: config.rotate - 5 }}
      animate={{
        opacity: loaded ? 0.35 : 0,
        scale: 0.75,
        rotate: config.rotate,
        y: [0, -8, 0],
      }}
      transition={{
        opacity: { duration: 0.8, delay: config.delay + 0.5 },
        scale:   { duration: 0.8, delay: config.delay + 0.5 },
        rotate:  { duration: 0.8, delay: config.delay + 0.5 },
        y: { duration: 4 + index * 0.5, repeat: Infinity, ease: 'easeInOut', delay: config.delay },
      }}
    >
      <div className="w-[280px] rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-black/40 backdrop-blur-sm">
        {/* Browser bar */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border-b border-white/10">
          <div className="w-2 h-2 rounded-full bg-red-400/70" />
          <div className="w-2 h-2 rounded-full bg-yellow-400/70" />
          <div className="w-2 h-2 rounded-full bg-green-400/70" />
          <div className="flex-1 mx-2 h-4 rounded-sm bg-white/10 flex items-center px-2">
            <span className="text-[8px] text-white/40 font-mono truncate">{site.label}</span>
          </div>
        </div>
        <img
          src={screenshotUrl(site.url)}
          alt={site.label}
          className="w-full h-[160px] object-cover object-top"
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)} // still show card even if image fails
        />
      </div>
    </motion.div>
  );
}

// Animated typing dots
function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center">
      {[0, 1, 2].map(i => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary inline-block"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </span>
  );
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const generatePrompt = useGeneratePrompt();
  const [, setLocation] = useLocation();

  // Admin Config controls
  const [showLiveCards, setShowLiveCards] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [lockClickCount, setLockClickCount] = useState(0);

  const handleLockClick = () => {
    const next = lockClickCount + 1;
    if (next >= 3) {
      setLockClickCount(0);
      toast.success('Security protocol validated. Accessing administration panel...');
      setLocation('/admin');
    } else {
      setLockClickCount(next);
    }
  };

  useEffect(() => {
    try {
      const cfgCards = localStorage.getItem('tinyfish_cfg_cards');
      if (cfgCards !== null) setShowLiveCards(cfgCards === 'true');

      const cfgMaint = localStorage.getItem('tinyfish_cfg_maint');
      if (cfgMaint !== null) setMaintenanceMode(cfgMaint === 'true');
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    const trimmedInput = url.trim().toLowerCase();
    if (trimmedInput === '/admin' || trimmedInput === 'admin') {
      setLocation('/admin');
      return;
    }

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    const newCloneId = Math.random().toString(36).substring(2, 9);
    const newClone = {
      id: newCloneId,
      url: targetUrl,
      timestamp: new Date().toLocaleString(),
      status: 'processing',
      error: undefined as string | undefined
    };
    
    try {
      const existing = localStorage.getItem('tinyfish_clones');
      const clones = existing ? JSON.parse(existing) : [];
      localStorage.setItem('tinyfish_clones', JSON.stringify([newClone, ...clones]));
    } catch (e) {}

    generatePrompt.mutate(
      { data: { url: targetUrl } },
      {
        onSuccess: () => {
          try {
            const existing = localStorage.getItem('tinyfish_clones');
            const clones = existing ? JSON.parse(existing) : [];
            const idx = clones.findIndex((c: any) => c.id === newCloneId);
            if (idx !== -1) {
              clones[idx].status = 'success';
              localStorage.setItem('tinyfish_clones', JSON.stringify(clones));
            }
          } catch (e) {}
        },
        onError: (err: any) => {
          const message =
            err?.response?.data?.error ||
            err?.data?.error ||
            err?.error ||
            err?.message ||
            'Failed to generate prompt. Please verify the URL and try again.';
          
          try {
            const existing = localStorage.getItem('tinyfish_clones');
            const clones = existing ? JSON.parse(existing) : [];
            const idx = clones.findIndex((c: any) => c.id === newCloneId);
            if (idx !== -1) {
              clones[idx].status = 'failed';
              clones[idx].error = message;
              localStorage.setItem('tinyfish_clones', JSON.stringify(clones));
            }
          } catch (e) {}
          toast.error(message);
        },
      }
    );
  };

  const handleCopy = () => {
    if (!generatePrompt.data?.prompt) return;
    navigator.clipboard.writeText(generatePrompt.data.prompt);
    setCopied(true);
    toast.success('Prompt copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!generatePrompt.data) return;
    const { prompt, analyzedUrl } = generatePrompt.data;
    let domain = analyzedUrl;
    try { domain = new URL(analyzedUrl).hostname.replace('www.', ''); } catch {}
    const blob = new Blob([prompt], { type: 'text/plain' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${domain}-clone-prompt.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  const hasResult = !!generatePrompt.data;
  const isPending = generatePrompt.isPending;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans relative overflow-hidden">

      {/* ── Background layers ── */}
      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:32px_32px]" />
      {/* Top glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] pointer-events-none bg-[radial-gradient(circle_at_50%_0%,hsl(84_100%_59%/0.18),transparent_70%)]" />
      {/* Bottom glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none bg-[radial-gradient(circle_at_50%_100%,hsl(84_100%_59%/0.07),transparent_70%)]" />

      {/* ── Floating live website cards ── */}
      {showLiveCards && SHOWCASE_SITES.map((site, i) => (
        <FloatingCard key={site.url} site={site} config={CARD_CONFIGS[i]} index={i} />
      ))}

      {/* ── Main content ── */}
      <main
        className={`flex-1 flex flex-col w-full max-w-4xl mx-auto px-6 relative z-10 transition-all duration-700 ease-in-out ${
          hasResult ? 'pt-24 pb-36' : 'pt-44 pb-44 md:pt-64 md:pb-64 min-h-[90vh]'
        }`}
      >

        {/* Header */}
        <motion.div
          className={`w-full max-w-2xl mx-auto flex flex-col gap-8 ${hasResult ? 'mb-10' : ''}`}
          layout
        >
          <motion.div
            className="space-y-4 text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            {/* Logo + Name */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <motion.div
                className="p-2.5 bg-primary/10 rounded-lg border border-primary/25 shadow-[0_0_20px_hsl(84_100%_59%/0.15)]"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                <Terminal className="w-6 h-6 text-primary" />
              </motion.div>
              <motion.h1
                className="text-3xl md:text-4xl font-mono font-bold tracking-tight text-foreground"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                Clone <span className="text-primary">with me</span>
              </motion.h1>
            </div>

            <motion.p
              className="text-muted-foreground font-mono text-sm md:text-base leading-relaxed max-w-lg mx-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.25 }}
            >
              Paste any website URL — get a complete, detailed prompt to recreate it from scratch.
            </motion.p>
          </motion.div>

          {/* Input form or Maintenance Mode Banner */}
          {maintenanceMode ? (
            <motion.div
              className="bg-amber-500/5 border border-amber-500/15 rounded-3xl p-12 md:p-16 space-y-8 text-center font-mono max-w-3xl mx-auto w-full shadow-2xl backdrop-blur-md relative overflow-hidden"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              {/* Decorative side accent glow lines */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
              
              <div className="space-y-6">
                <motion.button
                  id="maintenance-lock-btn"
                  onClick={handleLockClick}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto transition-all shadow-[0_0_25px_rgba(245,158,11,0.15)] hover:shadow-[0_0_35px_rgba(245,158,11,0.25)] hover:border-amber-500/50 cursor-pointer"
                  title="System Locked - Click 3 times for Admin Login"
                >
                  <Lock className="w-8 h-8 text-amber-400 animate-pulse" />
                </motion.button>

                <div className="space-y-4">
                  <h3 className="text-2xl md:text-3xl font-extrabold text-amber-400 uppercase tracking-widest leading-none">
                    Routine Maintenance
                  </h3>
                  <div className="w-24 h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 to-transparent mx-auto" />
                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto font-sans font-medium">
                    Our cloning platform is undergoing a major scheduled upgrade. We are implementing enhanced SSL protocols, strict sandboxing patterns, and custom layout analysis logic for designers and developers.
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 flex flex-wrap items-center justify-center gap-6 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500/80 animate-ping" /> Upgrade in progress</span>
                <span className="text-white/10">•</span>
                <span>System status: Offline</span>
                <span className="text-white/10">•</span>
                <span>Port: Sandboxed</span>
              </div>
            </motion.div>
          ) : (
            <motion.form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
            >
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-muted-foreground">
                  <Globe className="w-4 h-4" />
                </div>
                <Input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="pl-11 font-mono bg-card/60 border-border h-14 text-base focus-visible:ring-primary shadow-sm backdrop-blur-sm transition-all focus-visible:shadow-[0_0_20px_hsl(84_100%_59%/0.15)]"
                  disabled={isPending}
                />
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                <Button
                  type="submit"
                  disabled={isPending || !url.trim()}
                  className="h-14 px-8 font-mono uppercase tracking-wider font-bold shadow-[0_0_20px_hsl(84_100%_59%/0.12)] hover:shadow-[0_0_30px_hsl(84_100%_59%/0.3)] transition-all bg-primary text-primary-foreground w-full sm:w-auto"
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Generate
                    </span>
                  )}
                </Button>
              </motion.div>
            </motion.form>
          )}

          {/* Loading state */}
          <AnimatePresence>
            {isPending && (
              <motion.div
                className="flex flex-col items-center gap-6 pt-10"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.5 }}
              >
                <div className="relative">
                  <motion.div
                    className="w-16 h-16 rounded-full border-4 border-muted border-t-primary"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                  />
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <div className="w-2.5 h-2.5 bg-primary rounded-full" />
                  </motion.div>
                </div>
                <div className="font-mono text-sm text-center space-y-1">
                  <p className="text-primary flex items-center gap-2 justify-center">
                    Generating clone prompt <TypingDots />
                  </p>
                  <p className="text-muted-foreground text-xs">Fetching HTML · Analyzing layout · Building prompt</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Results */}
        <AnimatePresence>
          {hasResult && !isPending && (
            <motion.div
              className="w-full flex flex-col gap-6"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            >
              <div className="border border-border bg-card/50 backdrop-blur-md rounded-xl overflow-hidden shadow-2xl shadow-black/60 relative">

                {/* Green accent line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

                {/* Result header */}
                <div className="p-6 md:px-8 md:py-6 border-b border-border bg-muted/20">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <h2 className="text-lg font-bold text-foreground truncate">
                          {generatePrompt.data!.title}
                        </h2>
                      </div>
                      <a
                        href={generatePrompt.data!.analyzedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-primary hover:underline font-mono text-xs opacity-80 hover:opacity-100 transition-opacity truncate"
                      >
                        {generatePrompt.data!.analyzedUrl}
                      </a>
                      {generatePrompt.data!.description && (
                        <p className="text-muted-foreground text-sm leading-relaxed mt-1 line-clamp-2">
                          {generatePrompt.data!.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                        <Button
                          variant="outline"
                          onClick={handleCopy}
                          className="font-mono text-xs h-9 px-4 bg-background/50 hover:bg-muted gap-2"
                        >
                          <AnimatePresence mode="wait">
                            {copied ? (
                              <motion.span key="check" className="flex items-center gap-2" initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}>
                                <Check className="w-3.5 h-3.5 text-primary" /> Copied
                              </motion.span>
                            ) : (
                              <motion.span key="copy" className="flex items-center gap-2" initial={{ scale: 0.7 }} animate={{ scale: 1 }} exit={{ scale: 0.7 }}>
                                <Copy className="w-3.5 h-3.5" /> Copy
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </Button>
                      </motion.div>
                      <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                        <Button
                          variant="outline"
                          onClick={handleDownload}
                          className="font-mono text-xs h-9 px-4 bg-background/50 hover:bg-muted gap-2"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </Button>
                      </motion.div>
                    </div>
                  </div>
                </div>

                {/* Prompt output */}
                <div className="relative bg-background/30">
                  <pre className="p-6 md:p-8 font-mono text-sm text-foreground/80 whitespace-pre-wrap overflow-auto max-h-[60vh] custom-scrollbar leading-relaxed selection:bg-primary/20 selection:text-primary">
                    {generatePrompt.data!.prompt}
                  </pre>
                </div>

              </div>

              {/* Try another */}
              <motion.p
                className="text-center text-xs font-mono text-muted-foreground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Enter another URL above to generate a new prompt
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Footer with Copyright ── */}
      <footer className="w-full border-t border-border bg-card/25 backdrop-blur-md relative z-10 py-16 mt-auto">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
          
          <div className="flex items-center justify-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg border border-primary/25">
              <Terminal className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-mono font-bold tracking-tight text-foreground">
              Clone <span className="text-primary">with me</span>
            </span>
          </div>

          <p className="text-sm font-mono text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Analyze structure, stylesheets, assets, and design paradigms to convert target websites into standard instructions and detailed code-cloning templates.
          </p>

          <div className="pt-2 font-mono text-xs text-muted-foreground space-y-1">
            <p>© {new Date().getFullYear()} clone with me. All rights reserved.</p>
            <p className="flex items-center justify-center gap-1 mt-3 text-[10px] opacity-70">
              Made with <Heart className="w-3 h-3 text-red-400 fill-red-400 animate-pulse" /> for designers and developers
            </p>
          </div>

        </div>

        {/* Disclaimer Section */}
        <div className="max-w-4xl mx-auto px-6 mt-12 pt-8 border-t border-white/5 text-center">
          <p className="text-xs font-mono text-muted-foreground/60 leading-relaxed max-w-2xl mx-auto">
            For Educational & Research Purposes Only. Respect copyrights, trademarks, and the intellectual property rights of others.
          </p>
        </div>
      </footer>
      <ChatWidget />
    </div>
  );
}
