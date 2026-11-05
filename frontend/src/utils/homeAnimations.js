/**
 * TrustFund – Home Page Animations Module
 * ========================================
 * High-performance, subtle fintech micro-interactions and staggered entrances
 * built specifically for the TrustFund Home page using Anime.js v4.
 *
 * Requirements:
 * - Uses Anime.js v4 named ES module imports: `import { animate, stagger } from 'animejs';`
 * - Respects @media (prefers-reduced-motion: reduce)
 * - Safe for SPA navigation: cards remain visible by default without Flash of Invisible Content
 * - Cleans up active observers on navigation away
 */

import { animate, stagger } from 'animejs';

let scrollObserver = null;
let activeAnimations = [];

/**
 * Check if the user has requested reduced motion in their OS / browser
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animate the Top Giant Emerald Hero Banner elements:
 * - Category badge / label
 * - Hero big ETH amount (650ms, outCubic)
 * - Subtitle USD conversion (500ms, slight delay)
 * - Hero action buttons (400ms, staggered ~90ms)
 */
export function animateHomeHero() {
  if (prefersReducedMotion()) return;

  const heroBanner = document.querySelector('#section-home .hero-fintech-banner');
  if (!heroBanner) return;

  const categoryLabel = heroBanner.querySelector('.hero-category-label');
  const heroAmount = heroBanner.querySelector('.hero-big-number');
  const heroUsd = heroBanner.querySelector('.hero-usd-subtext');
  const heroButtons = heroBanner.querySelectorAll('.btn');

  // Animate category badge
  if (categoryLabel) {
    const a = animate(categoryLabel, {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 450,
      ease: 'outCubic',
    });
    activeAnimations.push(a);
  }

  // Animate hero big ETH amount (650ms, outCubic)
  if (heroAmount) {
    const a = animate(heroAmount, {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 650,
      ease: 'outCubic',
    });
    activeAnimations.push(a);
  }

  // Animate subtitle after the heading (500ms)
  if (heroUsd) {
    const a = animate(heroUsd, {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 500,
      delay: 120,
      ease: 'outCubic',
    });
    activeAnimations.push(a);
  }

  // Animate buttons (400ms, staggered ~90ms)
  if (heroButtons && heroButtons.length > 0) {
    const a = animate(heroButtons, {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 400,
      delay: stagger(90, { start: 160 }),
      ease: 'outCubic',
    });
    activeAnimations.push(a);
  }
}

/**
 * Animate the Bento Grid Campaign Cards with a staggered entrance:
 * - Card 1: Direct Impact
 * - Card 2: Education for All
 * - Card 3: Featured Campaign Target
 *
 * Note: Cards are NEVER permanently hidden via CSS, preventing empty states if JS fails.
 */
export function animateCampaignCards() {
  if (prefersReducedMotion()) return;

  const cards = document.querySelectorAll('#section-home .row.g-4.mb-4 > div');
  if (!cards || cards.length === 0) return;

  const a = animate(cards, {
    opacity: [0, 1],
    translateY: [20, 0],
    duration: 500,
    delay: stagger(90, { start: 100 }),
    ease: 'outCubic',
  });
  activeAnimations.push(a);
}

/**
 * Initialize IntersectionObserver for smooth scroll-based reveals of lower sections:
 * - Bottom metric cards row (Transactions confirmed, Allocation status, AI assistance)
 * - How TrustFund Works step cards
 * - About The Project card
 *
 * Each element is animated once when entering viewport and then unobserved.
 */
export function initScrollRevealAnimations() {
  if (prefersReducedMotion()) return;

  // Clean up any existing observer
  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }

  if (typeof IntersectionObserver === 'undefined') return;

  const revealTargets = document.querySelectorAll(
    '#section-home .row.g-4.mb-5 > div, #section-home .step-card, #section-home .py-5 .card'
  );

  if (!revealTargets || revealTargets.length === 0) return;

  scrollObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const target = entry.target;
          animate(target, {
            opacity: [0, 1],
            translateY: [18, 0],
            duration: 480,
            ease: 'outCubic',
          });
          observer.unobserve(target);
        }
      });
    },
    {
      root: null,
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.12,
    }
  );

  revealTargets.forEach((el) => {
    scrollObserver.observe(el);
  });
}

/**
 * Main entrance orchestrator for the Home page.
 * Called on page initialization and whenever navigating back to Home in SPA.
 */
export function playHomeAnimations() {
  // If reduced motion is requested, do nothing
  if (prefersReducedMotion()) return;

  // Clean up any previous observers and stop running animations to prevent duplicates/flicker
  cleanupHomeAnimations();

  // Animate hero and campaign cards immediately
  animateHomeHero();
  animateCampaignCards();

  // Arm scroll reveal observer for lower sections
  initScrollRevealAnimations();
}

/**
 * Clean up active animations and observers when navigating away from Home.
 */
export function cleanupHomeAnimations() {
  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }

  // Cancel any running animations to prevent flicker or race conditions
  if (activeAnimations && activeAnimations.length > 0) {
    activeAnimations.forEach((anim) => {
      try {
        if (anim && typeof anim.pause === 'function') anim.pause();
      } catch (_) {}
    });
  }
  activeAnimations = [];
}

