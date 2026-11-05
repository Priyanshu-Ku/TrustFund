/**
 * TrustFund – Chart Service
 * ==========================
 * Renders a modern donut chart on a canvas element for fund utilization.
 * Styled for both Light and Dark fintech palettes.
 * Uses real smart contract data: totalExpenses (utilized) and contractBalance (remaining).
 * Includes smooth sweep entrance and dynamic text-measured, unclipped legends.
 */

import { prefersReducedMotion } from './animationService.js';

let activeAnimationTimer = null;

/**
 * Draw a donut chart showing fund utilization
 * @param {string} canvasId - The ID of the canvas element
 * @param {number} totalDonations - Total donations in ETH
 * @param {number} totalExpenses - Total expenses in ETH
 * @param {number} [contractBalance] - Remaining contract balance in ETH
 * @param {boolean} [shouldAnimate=true] - Whether to animate the sweep entrance
 */
export function drawFundChart(canvasId, totalDonations, totalExpenses, contractBalance, shouldAnimate = true) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (activeAnimationTimer) {
    cancelAnimationFrame(activeAnimationTimer);
    activeAnimationTimer = null;
  }

  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

  // Theme-aware design tokens
  const emptyRingColor = isDark ? '#234638' : '#e2e8f0';
  const emptyTextColor = isDark ? '#A8BDB2' : '#64748b';
  const innerCircleBg = isDark ? '#11231C' : '#ffffff';
  const centerPercentColor = isDark ? '#F0FDF4' : '#0f172a';
  const subtitleColor = isDark ? '#A8BDB2' : '#64748b';
  const legendTextColor = isDark ? '#F0FDF4' : '#0f172a';
  const remainingColor = isDark ? '#00D68F' : '#059669';
  const utilizedColor = '#f59e0b';

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2 - 18;
  const radius = Math.min(width, height) / 2 - 38;
  const innerRadius = radius * 0.65; // Donut hole ratio

  // Function to render chart at progress p (from 0 to 1)
  function renderFrame(p) {
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // If no donations yet, safely render empty state
    if (totalDonations <= 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = emptyRingColor;
      ctx.lineWidth = 26;
      ctx.stroke();

      ctx.fillStyle = emptyTextColor;
      ctx.font = '600 14px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No donations yet', centerX, centerY + 5);
      return;
    }

    // Use actual contract balance if provided, else fallback to totalDonations - totalExpenses
    const remaining = typeof contractBalance === 'number'
      ? Math.max(0, contractBalance)
      : Math.max(0, totalDonations - totalExpenses);

    const segments = [
      { label: 'Utilized', value: totalExpenses, color: utilizedColor },
      { label: 'Remaining', value: remaining, color: remainingColor },
    ];

    const total = segments.reduce((sum, s) => sum + s.value, 0);

    // Draw animated donut segments (scaled by sweep progress p)
    let currentAngle = -Math.PI / 2; // Start from 12 o'clock

    segments.forEach((segment) => {
      if (segment.value <= 0 || total <= 0) return;

      const fullSliceAngle = (segment.value / total) * 2 * Math.PI;
      const sliceAngle = fullSliceAngle * p;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = segment.color;
      ctx.fill();

      currentAngle += fullSliceAngle;
    });

    // Draw inner circle (donut hole with matching card background)
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.fillStyle = innerCircleBg;
    ctx.fill();

    // Subtle inner shadow ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
    ctx.strokeStyle = isDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Exact calculated percentage: (totalExpenses / totalDonations) * 100
    const rawPercentage = (totalExpenses / totalDonations) * 100;
    const formattedPct = rawPercentage % 1 === 0
      ? `${rawPercentage.toFixed(0)}%`
      : `${rawPercentage.toFixed(1)}%`;

    // Center percentage in bold text
    ctx.fillStyle = centerPercentColor;
    ctx.font = '800 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(formattedPct, centerX, centerY - 8);

    // Subtitle "Funds Utilized"
    ctx.fillStyle = subtitleColor;
    ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Funds Utilized', centerX, centerY + 14);

    // Draw unclipped, dynamic horizontally centered legend below chart
    const legendY = height - 20;
    ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';

    const label0 = `Utilized: ${totalExpenses.toFixed(4)} ETH`;
    const label1 = `Remaining: ${remaining.toFixed(4)} ETH`;

    const textWidth0 = ctx.measureText(label0).width;
    const textWidth1 = ctx.measureText(label1).width;

    const pillGap = 16;
    const itemWidth0 = textWidth0 + 16; // 10px circle + 6px gap
    const itemWidth1 = textWidth1 + 16;
    const totalLegendWidth = itemWidth0 + itemWidth1 + pillGap;

    const startX = Math.max(12, (width - totalLegendWidth) / 2);

    // Segment 0: Utilized
    ctx.beginPath();
    ctx.arc(startX + 5, legendY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = utilizedColor;
    ctx.fill();
    ctx.fillStyle = legendTextColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label0, startX + 15, legendY);

    // Segment 1: Remaining
    const startX1 = startX + itemWidth0 + pillGap;
    ctx.beginPath();
    ctx.arc(startX1 + 5, legendY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = remainingColor;
    ctx.fill();
    ctx.fillStyle = legendTextColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label1, startX1 + 15, legendY);
  }

  // If reduced motion is requested or animation disabled, render final state immediately
  if (!shouldAnimate || prefersReducedMotion()) {
    renderFrame(1);
    return;
  }

  // Smooth easeOutQuad progress animation over 420ms
  const startTime = performance.now();
  const duration = 420;

  function step(now) {
    const elapsed = now - startTime;
    const rawProgress = Math.min(elapsed / duration, 1);
    // EaseOutQuad
    const eased = 1 - (1 - rawProgress) * (1 - rawProgress);

    renderFrame(eased);

    if (rawProgress < 1) {
      activeAnimationTimer = requestAnimationFrame(step);
    } else {
      activeAnimationTimer = null;
    }
  }

  activeAnimationTimer = requestAnimationFrame(step);
}
