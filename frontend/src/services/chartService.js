/**
 * TrustFund – Chart Service
 * ==========================
 * Renders a modern donut chart on a canvas element for fund utilization.
 * Styled for the light fintech palette (white background, dark navy text, emerald & amber segments).
 * Uses real smart contract data: totalExpenses (utilized) and contractBalance (remaining).
 */

/**
 * Draw a donut chart showing fund utilization
 * @param {string} canvasId - The ID of the canvas element
 * @param {number} totalDonations - Total donations in ETH
 * @param {number} totalExpenses - Total expenses in ETH
 * @param {number} [contractBalance] - Remaining contract balance in ETH
 */
export function drawFundChart(canvasId, totalDonations, totalExpenses, contractBalance) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2 - 15;
  const radius = Math.min(width, height) / 2 - 40;
  const innerRadius = radius * 0.65; // Donut hole ratio

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // If no donations yet, safely render empty state (avoid division by zero)
  if (totalDonations <= 0) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 26;
    ctx.stroke();

    ctx.fillStyle = '#64748b';
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
    { label: 'Utilized', value: totalExpenses, color: '#f59e0b' },
    { label: 'Remaining', value: remaining, color: '#059669' },
  ];

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // Draw segments
  let currentAngle = -Math.PI / 2; // Start from top

  segments.forEach((segment) => {
    if (segment.value <= 0 || total <= 0) return;

    const sliceAngle = (segment.value / total) * 2 * Math.PI;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = segment.color;
    ctx.fill();

    currentAngle += sliceAngle;
  });

  // Draw inner circle (donut hole with crisp white background)
  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Subtle inner shadow ring
  ctx.beginPath();
  ctx.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Calculate percentage: (totalExpenses / totalDonations) * 100
  const rawPercentage = (totalExpenses / totalDonations) * 100;
  const formattedPct = rawPercentage % 1 === 0
    ? `${rawPercentage.toFixed(0)}%`
    : `${rawPercentage.toFixed(1)}%`;

  // Center percentage in bold Dark Navy
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 24px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(formattedPct, centerX, centerY - 8);

  // Subtitle "Funds Utilized"
  ctx.fillStyle = '#64748b';
  ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Funds Utilized', centerX, centerY + 14);

  // Draw modern legend below chart
  const legendY = height - 22;
  const legendSpacing = 135;
  const legendStartX = centerX - legendSpacing / 2;

  segments.forEach((segment, i) => {
    const x = legendStartX + i * legendSpacing;

    // Color indicator pill/circle
    ctx.beginPath();
    ctx.arc(x - 10, legendY, 5, 0, 2 * Math.PI);
    ctx.fillStyle = segment.color;
    ctx.fill();

    // Legend text
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 12px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${segment.label}: ${segment.value.toFixed(4)} ETH`, x, legendY + 4);
  });
}
