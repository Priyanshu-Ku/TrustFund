/**
 * TrustFund – Anime.js Animation Service
 * =======================================
 * Provides polished, premium, subtle fintech-style micro-interactions
 * and staggered transitions using Anime.js v4.
 *
 * Requirements:
 * - Respects @media (prefers-reduced-motion: reduce)
 * - Subtle fade and gentle lift (translateY)
 * - No excessive bouncing, spinning, or continuous looping
 * - Safe for SPA navigation and dynamically injected components
 */

import { animate } from 'animejs';

/**
 * Checks if user prefers reduced motion
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animate page section entrance on SPA navigation
 * @param {HTMLElement} sectionEl
 */
export function animatePageTransition(sectionEl) {
  if (!sectionEl || prefersReducedMotion()) return;

  animate(sectionEl, {
    opacity: [0, 1],
    translateY: [8, 0],
    duration: 280,
    ease: 'outQuad',
  });
}

/**
 * Animate cards with a staggered entrance when a dashboard section is navigated to
 * @param {HTMLElement} sectionEl
 */
export function animateCardStagger(sectionEl) {
  if (!sectionEl || prefersReducedMotion()) return;

  const cards = sectionEl.querySelectorAll(
    '.stat-card, .campaign-card, .hero-fintech-banner, .card:not(.d-none)'
  );

  if (!cards || cards.length === 0) return;

  animate(cards, {
    opacity: [0, 1],
    translateY: [12, 0],
    duration: 360,
    delay: (el, i) => Math.min(i * 40, 240),
    ease: 'outQuad',
  });
}

/**
 * Smoothly animates progress bar width
 * @param {HTMLElement} progressBarEl
 * @param {number} targetPercentage
 * @param {number} [duration=600]
 */
export function animateProgressBar(progressBarEl, targetPercentage, duration = 650) {
  if (!progressBarEl) return;

  const clamped = Math.max(0, Math.min(100, targetPercentage));
  const targetWidth = `${clamped}%`;

  if (prefersReducedMotion()) {
    progressBarEl.style.width = targetWidth;
    return;
  }

  animate(progressBarEl, {
    width: targetWidth,
    duration,
    ease: 'outCubic',
  });
}

/**
 * Animate entrance for an AI recommendation or result panel (e.g. Budget Planner, Categorization)
 * @param {HTMLElement} panelEl
 */
export function animatePanelEntrance(panelEl) {
  if (!panelEl || prefersReducedMotion()) return;

  animate(panelEl, {
    opacity: [0, 1],
    translateY: [14, 0],
    duration: 320,
    ease: 'outQuad',
  });
}

/**
 * Animate the chatbot panel opening
 * @param {HTMLElement} panelEl
 * @param {Function} [onComplete]
 */
export function animateChatbotOpen(panelEl, onComplete) {
  if (!panelEl) return;

  panelEl.classList.remove('d-none');

  if (prefersReducedMotion()) {
    if (onComplete) onComplete();
    return;
  }

  animate(panelEl, {
    opacity: [0, 1],
    translateY: [16, 0],
    scale: [0.97, 1],
    duration: 220,
    ease: 'outQuad',
  }).then(() => {
    if (onComplete) onComplete();
  });
}

/**
 * Animate the chatbot panel closing
 * @param {HTMLElement} panelEl
 * @param {Function} [onComplete]
 */
export function animateChatbotClose(panelEl, onComplete) {
  if (!panelEl) return;

  if (prefersReducedMotion()) {
    panelEl.classList.add('d-none');
    if (onComplete) onComplete();
    return;
  }

  animate(panelEl, {
    opacity: [1, 0],
    translateY: [0, 12],
    scale: [1, 0.97],
    duration: 170,
    ease: 'inQuad',
  }).then(() => {
    panelEl.classList.add('d-none');
    if (onComplete) onComplete();
  });
}

/**
 * Animate a newly appended chat message bubble
 * @param {HTMLElement} msgEl
 */
export function animateMessageBubble(msgEl) {
  if (!msgEl || prefersReducedMotion()) return;

  animate(msgEl, {
    opacity: [0, 1],
    translateY: [10, 0],
    duration: 200,
    ease: 'outQuad',
  });
}

