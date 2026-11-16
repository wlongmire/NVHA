// Renders a content file's body. Astro's own renderer handles it; this file only holds small helpers.
export const plain = (md: string) => md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/[#*_>`\[\]]|\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
export const clip = (s: string, n = 160) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);
