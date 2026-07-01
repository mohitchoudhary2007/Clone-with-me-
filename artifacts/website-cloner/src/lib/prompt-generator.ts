/**
 * Generates a detailed website clone prompt by analyzing HTML/CSS without an LLM.
 * Extracts colors, fonts, layout, components, and structure.
 */

interface ParsedSite {
  title: string;
  description: string;
  url: string;
  colors: string[];
  fonts: string[];
  sections: string[];
  navLinks: string[];
  headings: string[];
  ctaButtons: string[];
  hasHero: boolean;
  hasForms: boolean;
  hasSearch: boolean;
  hasCarousel: boolean;
  hasTestimonials: boolean;
  hasPricing: boolean;
  hasFeatures: boolean;
  footerLinks: string[];
  techHints: string[];
  layoutHints: string[];
  colorScheme: "dark" | "light" | "unknown";
  backgroundColors: string[];
  primaryColors: string[];
}

function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)].filter(Boolean);
}

function extractColors(html: string): { all: string[]; backgrounds: string[]; primaries: string[] } {
  const allColors: string[] = [];
  const backgrounds: string[] = [];
  const primaries: string[] = [];

  // Extract hex colors
  const hexMatches = html.match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) ?? [];
  allColors.push(...hexMatches.slice(0, 30));

  // Extract rgb/rgba
  const rgbMatches = html.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g) ?? [];
  allColors.push(...rgbMatches.slice(0, 10));

  // Extract CSS variables
  const cssVarMatches = html.match(/--(?:color|bg|background|primary|accent|text)-[a-z-]+:\s*([^;]+)/g) ?? [];
  allColors.push(...cssVarMatches.slice(0, 15).map(m => m.trim()));

  // Identify background colors
  const bgMatches = html.match(/(?:background(?:-color)?)\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsl\([^)]+\))/g) ?? [];
  backgrounds.push(...bgMatches.slice(0, 10).map(m => m.replace(/background(?:-color)?\s*:\s*/, "").trim()));

  // Primary / brand colors from common patterns
  const primaryMatches = html.match(/(?:--primary|--accent|--brand|\.primary|\.btn-primary|\.cta)[^{]*{[^}]*(?:background|color)\s*:\s*(#[0-9a-fA-F]{3,8})/g) ?? [];
  primaries.push(...primaryMatches.slice(0, 5));

  return { all: unique(allColors), backgrounds: unique(backgrounds), primaries: unique(primaries) };
}

function extractFonts(html: string): string[] {
  const fonts: string[] = [];

  // Google Fonts imports
  const gfMatches = html.match(/family=([A-Za-z+]+)/g) ?? [];
  fonts.push(...gfMatches.map(m => m.replace("family=", "").replace(/\+/g, " ")));

  // Font-family declarations
  const ffMatches = html.match(/font-family\s*:\s*([^;}"']+)/gi) ?? [];
  ffMatches.slice(0, 10).forEach(m => {
    const val = m.replace(/font-family\s*:\s*/i, "").trim().replace(/["']/g, "");
    const first = val.split(",")[0].trim();
    if (first && !first.startsWith("var(") && first !== "inherit" && first !== "sans-serif") {
      fonts.push(first);
    }
  });

  return unique(fonts).slice(0, 6);
}

function extractNavLinks(html: string): string[] {
  const navSection = html.match(/<(?:nav|header)[^>]*>[\s\S]{0,3000}<\/(?:nav|header)>/i)?.[0] ?? "";
  const linkMatches = navSection.match(/<a[^>]*>([^<]{2,40})<\/a>/gi) ?? [];
  return unique(linkMatches.map(m => m.replace(/<[^>]+>/g, "").trim())).filter(t => t.length > 1 && t.length < 30).slice(0, 10);
}

function extractHeadings(html: string): string[] {
  const hMatches = html.match(/<h[1-3][^>]*>([^<]{3,120})<\/h[1-3]>/gi) ?? [];
  return unique(hMatches.map(m => m.replace(/<[^>]+>/g, "").trim())).slice(0, 8);
}

function extractCtaButtons(html: string): string[] {
  const btnMatches = html.match(/<(?:button|a)[^>]*(?:btn|button|cta)[^>]*>([^<]{2,60})<\/(?:button|a)>/gi) ?? [];
  return unique(btnMatches.map(m => m.replace(/<[^>]+>/g, "").trim())).filter(t => t.length > 1).slice(0, 6);
}

function extractSections(html: string): string[] {
  const sections: string[] = [];
  
  // Named sections
  const sectionMatches = html.match(/<(?:section|div)[^>]*(?:id|class)="([^"]{3,60})"/gi) ?? [];
  sectionMatches.slice(0, 20).forEach(m => {
    const match = m.match(/["']([^"']{3,60})["']/);
    if (match) {
      const cls = match[1].toLowerCase();
      if (/hero|banner|feature|about|service|pricing|testimonial|contact|faq|team|blog|footer|header|nav|cta/i.test(cls)) {
        sections.push(cls.split(/[\s-_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
      }
    }
  });

  return unique(sections).slice(0, 10);
}

function extractFooterLinks(html: string): string[] {
  const footerSection = html.match(/<footer[^>]*>[\s\S]{0,3000}<\/footer>/i)?.[0] ?? "";
  const linkMatches = footerSection.match(/<a[^>]*>([^<]{2,40})<\/a>/gi) ?? [];
  return unique(linkMatches.map(m => m.replace(/<[^>]+>/g, "").trim())).filter(t => t.length > 1 && t.length < 30).slice(0, 12);
}

function detectTechHints(html: string): string[] {
  const hints: string[] = [];
  if (/react|__NEXT_DATA__|_next\/static/i.test(html)) hints.push("React / Next.js");
  if (/vue\.js|vue\.min\.js|__vue__/i.test(html)) hints.push("Vue.js");
  if (/angular|ng-app|ng-controller/i.test(html)) hints.push("Angular");
  if (/tailwind/i.test(html)) hints.push("Tailwind CSS");
  if (/bootstrap/i.test(html)) hints.push("Bootstrap");
  if (/gsap|greensock/i.test(html)) hints.push("GSAP animations");
  if (/framer-motion|framer\.com/i.test(html)) hints.push("Framer Motion");
  if (/shadcn|radix-ui/i.test(html)) hints.push("shadcn/ui + Radix UI");
  if (/wordpress|wp-content/i.test(html)) hints.push("WordPress");
  if (/webflow/i.test(html)) hints.push("Webflow");
  if (/shopify/i.test(html)) hints.push("Shopify");
  return hints;
}

function detectColorScheme(html: string): "dark" | "light" | "unknown" {
  const darkMatches = (html.match(/dark(?:-mode|-theme|-bg)?/gi) ?? []).length;
  const lightMatches = (html.match(/light(?:-mode|-theme|-bg)?/gi) ?? []).length;
  const darkBgs = (html.match(/background(?:-color)?\s*:\s*(?:#(?:0[0-9a-f]{5}|1[0-9a-f]{5}|2[0-9a-f]{5})|rgb\(\s*[0-5]\d)/gi) ?? []).length;
  if (darkBgs > 3 || darkMatches > lightMatches + 2) return "dark";
  if (lightMatches > darkMatches + 2) return "light";
  return "unknown";
}

function parseSite(html: string, url: string, title: string, description: string): ParsedSite {
  const colors = extractColors(html);
  const htmlLower = html.toLowerCase();

  const hasHero = /class="[^"]*hero|id="[^"]*hero|class="[^"]*banner|class="[^"]*jumbotron/i.test(html);
  const hasForms = /<form[\s>]/i.test(html);
  const hasSearch = /<input[^>]*(?:type="search"|placeholder="search|search\.\.\.)/i.test(html);
  const hasCarousel = /carousel|slider|swiper|owl-carousel/i.test(html);
  const hasTestimonials = /testimonial|review|quote|customer-story/i.test(html);
  const hasPricing = /pricing|price|plan|subscription|\/month|\/year/i.test(html);
  const hasFeatures = /feature|benefit|advantage|why.*us|our.*service/i.test(html);

  const layoutHints: string[] = [];
  if (/grid-template|display:\s*grid/i.test(html)) layoutHints.push("CSS Grid layout");
  if (/display:\s*flex|flexbox/i.test(html)) layoutHints.push("Flexbox layout");
  if (/container|max-width/i.test(html)) layoutHints.push("Centered container layout");
  if (/<aside|sidebar/i.test(html)) layoutHints.push("Sidebar layout");
  if (/sticky|position:\s*fixed/i.test(html)) layoutHints.push("Sticky/fixed header navigation");

  return {
    title,
    description,
    url,
    colors: colors.all.slice(0, 20),
    fonts: extractFonts(html),
    sections: extractSections(html),
    navLinks: extractNavLinks(html),
    headings: extractHeadings(html),
    ctaButtons: extractCtaButtons(html),
    hasHero,
    hasForms,
    hasSearch,
    hasCarousel,
    hasTestimonials,
    hasPricing,
    hasFeatures,
    footerLinks: extractFooterLinks(html),
    techHints: detectTechHints(html),
    layoutHints: unique(layoutHints),
    colorScheme: detectColorScheme(html),
    backgroundColors: colors.backgrounds,
    primaryColors: colors.primaries,
  };
}

export function generateClonePrompt(html: string, url: string, title: string, description: string): string {
  const site = parseSite(html, url, title, description);
  let hostname = url;
  try { hostname = new URL(url).hostname.replace("www.", ""); } catch {}

  const lines: string[] = [];

  lines.push(`# Clone Prompt: ${site.title || hostname}`);
  lines.push("");
  lines.push(`**Source URL:** ${site.url}`);
  if (site.description) lines.push(`**Description:** ${site.description}`);
  lines.push("");

  // 1. Purpose & Overview
  lines.push("## 1. Purpose & Overview");
  lines.push(`Build a pixel-perfect clone of **${site.title || hostname}**.`);
  if (site.description) lines.push(`The site's goal: ${site.description}`);
  if (site.headings.length > 0) {
    lines.push(`Key messaging / headlines from the page:`);
    site.headings.slice(0, 4).forEach(h => lines.push(`  - "${h}"`));
  }
  lines.push("");

  // 2. Color Palette
  lines.push("## 2. Color Palette");
  lines.push(`**Color scheme:** ${site.colorScheme === "dark" ? "Dark theme (dark backgrounds, light text)" : site.colorScheme === "light" ? "Light theme (white/light backgrounds, dark text)" : "Mixed/Unknown — inspect source for exact values"}`);
  if (site.backgroundColors.length > 0) {
    lines.push(`**Background colors:** ${site.backgroundColors.slice(0, 5).join(", ")}`);
  }
  if (site.primaryColors.length > 0) {
    lines.push(`**Primary/accent colors:** ${site.primaryColors.slice(0, 3).join(", ")}`);
  }
  if (site.colors.length > 0) {
    lines.push(`**All detected colors:** ${site.colors.slice(0, 15).join(", ")}`);
  }
  lines.push("");

  // 3. Typography
  lines.push("## 3. Typography");
  if (site.fonts.length > 0) {
    lines.push(`**Fonts detected:** ${site.fonts.join(", ")}`);
    lines.push(`Import from Google Fonts: \`${site.fonts.map(f => `${f}:wght@400;500;600;700`).join("|")}\``);
  } else {
    lines.push("No custom fonts detected — likely uses system fonts (Inter, -apple-system, sans-serif).");
  }
  lines.push("Use large bold headings (h1: 48-72px), medium subheadings (h2: 32-40px), body text 16-18px, line-height 1.5-1.7.");
  lines.push("");

  // 4. Header & Navigation
  lines.push("## 4. Header & Navigation");
  lines.push(`Build a ${site.layoutHints.includes("Sticky/fixed header navigation") ? "sticky/fixed" : "top"} navigation bar with:`);
  lines.push(`  - Logo/brand name on the left`);
  if (site.navLinks.length > 0) {
    lines.push(`  - Navigation links: ${site.navLinks.join(" | ")}`);
  } else {
    lines.push(`  - Navigation links (inspect source for exact labels)`);
  }
  if (site.ctaButtons.length > 0) {
    lines.push(`  - CTA button on the right: "${site.ctaButtons[0]}"`);
  }
  lines.push(`  - Mobile: hamburger menu with slide-in drawer`);
  lines.push("");

  // 5. Hero Section
  if (site.hasHero) {
    lines.push("## 5. Hero Section");
    lines.push("Build a full-width hero section with:");
    if (site.headings.length > 0) lines.push(`  - Main headline: "${site.headings[0]}"`);
    if (site.headings.length > 1) lines.push(`  - Sub-headline: "${site.headings[1]}"`);
    if (site.ctaButtons.length > 0) lines.push(`  - Primary CTA: "${site.ctaButtons[0]}"${site.ctaButtons[1] ? ` and secondary CTA: "${site.ctaButtons[1]}"` : ""}`);
    lines.push(`  - ${site.colorScheme === "dark" ? "Dark background with gradient overlay" : "Light/white background with decorative elements"}`);
    lines.push(`  - Centered or split layout (text left, visual right)`);
    lines.push("");
  }

  // 6. Main Content Sections
  lines.push("## 6. Main Content Sections");
  if (site.sections.length > 0) {
    lines.push("Detected page sections (in order):");
    site.sections.forEach(s => lines.push(`  - **${s}**: build appropriate content blocks`));
  }
  if (site.hasFeatures) {
    lines.push("  - **Features/Benefits section**: 3–4 column grid of icon + heading + description cards");
  }
  if (site.hasTestimonials) {
    lines.push("  - **Testimonials section**: customer quotes in cards or carousel format");
  }
  if (site.hasPricing) {
    lines.push("  - **Pricing section**: 2–3 column pricing cards with feature lists and CTA buttons. Highlight the 'most popular' plan.");
  }
  if (site.hasCarousel) {
    lines.push("  - **Carousel/Slider**: implement with CSS or a library like Swiper.js");
  }
  if (site.hasForms) {
    lines.push("  - **Form section**: contact or sign-up form with styled inputs and submit button");
  }
  lines.push("");

  // 7. Interactive Elements & Animations
  lines.push("## 7. Interactive Elements & Animations");
  lines.push("  - Smooth hover transitions on all buttons and links (150–250ms ease)");
  lines.push("  - Scroll-triggered fade-in / slide-up animations for sections (use Intersection Observer or AOS library)");
  if (site.hasCarousel) lines.push("  - Auto-advancing carousel with pause-on-hover");
  if (site.hasSearch) lines.push("  - Search bar with live suggestions/filtering");
  lines.push("  - Mobile menu: smooth slide-in overlay");
  lines.push("  - Form inputs: focus ring animation, error state styling");
  lines.push("");

  // 8. Footer
  lines.push("## 8. Footer");
  if (site.footerLinks.length > 0) {
    lines.push(`Footer with multi-column link layout. Detected links: ${site.footerLinks.slice(0, 10).join(" | ")}`);
  } else {
    lines.push("Footer with logo, multi-column link sections (Company, Product, Resources, Legal), social icons, and copyright notice.");
  }
  lines.push("");

  // 9. Responsive Design
  lines.push("## 9. Responsive Design");
  lines.push("  - Desktop (1280px+): full layout");
  lines.push("  - Tablet (768px–1279px): 2-column grid, condensed navigation");
  lines.push("  - Mobile (<768px): single column, hamburger menu, stacked sections, larger tap targets (min 44px)");
  lines.push("");

  // 10. Key UI Components
  lines.push("## 10. Key UI Components");
  lines.push("  - **Buttons**: rounded corners (border-radius: 6–8px), solid fill for primary, outline for secondary, hover darkens by 10%");
  lines.push("  - **Cards**: subtle border or shadow, 16–24px padding, rounded corners");
  lines.push("  - **Navigation links**: no underline by default, underline or color change on hover");
  if (site.hasForms) {
    lines.push("  - **Form inputs**: full-width, 1px border, 12px radius, focus ring in primary color");
  }
  lines.push("  - **Section dividers**: generous vertical padding (80–120px) between sections");
  lines.push("");

  // 11. Tech Stack
  lines.push("## 11. Recommended Tech Stack");
  if (site.techHints.length > 0) {
    lines.push(`**Detected technologies on source site:** ${site.techHints.join(", ")}`);
  }
  lines.push("**Recommended stack for clone:**");
  lines.push("  - Framework: React + Next.js (App Router) or Vite + React");
  if (site.fonts.some(f => /tailwind|tw/i.test(f)) || /tailwind/i.test(html)) {
    lines.push("  - Styling: Tailwind CSS (detected on source)");
  } else {
    lines.push("  - Styling: Tailwind CSS or CSS Modules");
  }
  lines.push("  - Animations: Framer Motion (scroll animations) + CSS transitions (hover)");
  if (site.hasCarousel) lines.push("  - Carousel: Swiper.js or Embla Carousel");
  lines.push("  - Icons: Lucide React or Heroicons");
  lines.push("  - Deployment: Vercel or Netlify");
  lines.push("");

  // 12. Implementation Notes
  lines.push("## 12. Implementation Notes");
  if (site.layoutHints.length > 0) {
    lines.push(`**Layout patterns detected:** ${site.layoutHints.join(", ")}`);
  }
  lines.push("  - Start with mobile-first CSS, add breakpoints for tablet and desktop");
  lines.push("  - Use semantic HTML5 elements (<header>, <nav>, <main>, <section>, <article>, <footer>)");
  lines.push("  - Add proper meta tags, Open Graph, and Twitter Card for SEO");
  lines.push("  - Optimize images with lazy loading (loading='lazy') and modern formats (WebP)");
  lines.push("  - Ensure WCAG 2.1 AA accessibility: alt text, ARIA labels, keyboard navigation");
  lines.push("  - Test in Chrome, Firefox, Safari and on iOS/Android");
  lines.push("");

  return lines.join("\n");
}
