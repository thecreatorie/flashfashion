#!/usr/bin/env node
// Match Shopify media-library files to existing products, then attach.
//
// Usage:
//   SHOPIFY_ADMIN_TOKEN=shpat_xxx node scripts/match-media-to-products.mjs
//   SHOPIFY_ADMIN_TOKEN=shpat_xxx node scripts/match-media-to-products.mjs --apply
//   SHOPIFY_ADMIN_TOKEN=shpat_xxx node scripts/match-media-to-products.mjs --apply --min-score=0.7
//
// Defaults to DRY RUN — nothing is attached until you pass --apply.
// Skips files already attached to their matched product.

const STORE = process.env.SHOPIFY_STORE || 'flash-fashion-5833.myshopify.com';
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = '2025-01';

if (!TOKEN) {
  console.error('Set SHOPIFY_ADMIN_TOKEN to a Custom App Admin API access token (shpat_...).');
  console.error('Required scopes: read_files, read_products, write_products.');
  process.exit(1);
}

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const MIN_SCORE = Number((args.find((a) => a.startsWith('--min-score=')) || '').split('=')[1] || 0.6);

const ENDPOINT = `https://${STORE}/admin/api/${API_VERSION}/graphql.json`;

async function gql(query, variables = {}) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  const cost = json.extensions?.cost?.throttleStatus;
  if (cost && cost.currentlyAvailable < 200) {
    await new Promise((r) => setTimeout(r, 800));
  }
  return json.data;
}

// ---------- Fetch ----------

async function listAllFiles() {
  const out = [];
  let cursor = null;
  while (true) {
    const data = await gql(
      `query($cursor: String) {
        files(first: 100, after: $cursor, query: "media_type:IMAGE") {
          nodes {
            id
            alt
            createdAt
            ... on MediaImage {
              image { url width height }
              originalSource { url }
              mimeType
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { cursor }
    );
    for (const n of data.files.nodes) {
      const url = n.image?.url || n.originalSource?.url;
      if (!url) continue;
      const filename = decodeURIComponent(url.split('/').pop().split('?')[0]);
      out.push({
        id: n.id,
        alt: n.alt || '',
        url,
        filename,
        basename: filename.replace(/\.[^.]+$/, ''),
      });
    }
    if (!data.files.pageInfo.hasNextPage) break;
    cursor = data.files.pageInfo.endCursor;
  }
  return out;
}

async function listAllProducts() {
  const out = [];
  let cursor = null;
  while (true) {
    const data = await gql(
      `query($cursor: String) {
        products(first: 100, after: $cursor) {
          nodes {
            id
            handle
            title
            tags
            media(first: 50) {
              nodes {
                ... on MediaImage {
                  image { url }
                }
              }
            }
          }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      { cursor }
    );
    for (const p of data.products.nodes) {
      const existingUrls = new Set(
        p.media.nodes.map((m) => m.image?.url).filter(Boolean)
      );
      out.push({ id: p.id, handle: p.handle, title: p.title, tags: p.tags || [], existingUrls });
    }
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }
  return out;
}

// ---------- Match ----------

function normalize(s) {
  return String(s)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(s) {
  return normalize(s).split(/\s+/).filter(Boolean);
}

// Jaccard token overlap
function tokenScore(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / new Set([...A, ...B]).size;
}

function matchFile(file, products) {
  const normName = normalize(file.basename);
  const normAlt = normalize(file.alt);

  const candidates = [];
  for (const p of products) {
    const handle = p.handle.toLowerCase();
    const titleNorm = normalize(p.title);

    // Strategy 1: exact handle prefix / contained in filename
    let score = 0;
    let reason = '';
    if (normName.includes(handle.replace(/-/g, ' '))) {
      score = Math.max(score, 0.95);
      reason = 'handle-in-filename';
    } else if (normAlt && normAlt.includes(handle.replace(/-/g, ' '))) {
      score = Math.max(score, 0.9);
      reason = 'handle-in-alt';
    }

    // Strategy 2: fuzzy title-token overlap with filename
    const nameScore = tokenScore(file.basename, p.title);
    if (nameScore > score) { score = nameScore; reason = `title-tokens(${nameScore.toFixed(2)})`; }

    // Strategy 3: fuzzy title-token overlap with alt text
    if (normAlt) {
      const altScore = tokenScore(file.alt, p.title);
      if (altScore > score) { score = altScore; reason = `alt-tokens(${altScore.toFixed(2)})`; }
    }

    // Strategy 4: tag match — file basename contains a tag
    for (const tag of p.tags) {
      const nTag = normalize(tag);
      if (nTag && normName.includes(nTag) && nTag.length >= 4) {
        if (0.7 > score) { score = 0.7; reason = `tag:${tag}`; }
      }
    }

    if (score > 0) candidates.push({ product: p, score, reason });
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best) return { status: 'unmatched' };

  const runner = candidates[1];
  const ambiguous = runner && Math.abs(runner.score - best.score) < 0.05 && runner.score >= MIN_SCORE;

  if (best.score < MIN_SCORE) return { status: 'below-threshold', best };
  if (ambiguous) return { status: 'ambiguous', best, runner };
  return { status: 'matched', best };
}

// ---------- Attach ----------

async function attachToProduct(productId, file) {
  const r = await gql(
    `mutation($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media { ... on MediaImage { id image { url } } }
        mediaUserErrors { field message }
      }
    }`,
    {
      productId,
      media: [{
        originalSource: file.url,
        alt: file.alt || undefined,
        mediaContentType: 'IMAGE',
      }],
    }
  );
  const errs = r.productCreateMedia.mediaUserErrors;
  if (errs.length) throw new Error(JSON.stringify(errs));
  return r.productCreateMedia.media[0];
}

// ---------- Main ----------

async function main() {
  console.log(`→ Fetching store ${STORE}...`);
  const [files, products] = await Promise.all([listAllFiles(), listAllProducts()]);
  console.log(`  ${files.length} files, ${products.length} products`);
  console.log(`  mode: ${APPLY ? 'APPLY' : 'DRY RUN'}, min-score: ${MIN_SCORE}\n`);

  const buckets = { matched: [], ambiguous: [], below: [], unmatched: [], skipped: [], attached: [], failed: [] };

  for (const file of files) {
    const result = matchFile(file, products);
    if (result.status === 'matched') {
      const already = result.best.product.existingUrls.has(file.url);
      const row = { file, ...result.best };
      if (already) { buckets.skipped.push(row); continue; }
      buckets.matched.push(row);
      if (APPLY) {
        try {
          await attachToProduct(result.best.product.id, file);
          buckets.attached.push(row);
          console.log(`  ✓ ${file.filename} → ${result.best.product.handle} (${result.best.reason})`);
        } catch (e) {
          buckets.failed.push({ ...row, error: e.message });
          console.log(`  ✗ ${file.filename} → ${result.best.product.handle}: ${e.message}`);
        }
      }
    } else if (result.status === 'ambiguous') {
      buckets.ambiguous.push({ file, ...result });
    } else if (result.status === 'below-threshold') {
      buckets.below.push({ file, ...result });
    } else {
      buckets.unmatched.push({ file });
    }
  }

  const line = (n, label) => console.log(`  ${String(n).padStart(4)} ${label}`);
  console.log('\n──── Report ────');
  line(buckets.matched.length, `matched (would attach${APPLY ? ' → attached ' + buckets.attached.length : ''})`);
  line(buckets.skipped.length, 'skipped (already attached to correct product)');
  line(buckets.ambiguous.length, `ambiguous (top score tied within 0.05)`);
  line(buckets.below.length, `below threshold (score < ${MIN_SCORE})`);
  line(buckets.unmatched.length, 'unmatched (no candidate product)');
  if (APPLY) line(buckets.failed.length, 'failed to attach');

  if (!APPLY && buckets.matched.length) {
    console.log('\n──── Would attach ────');
    for (const r of buckets.matched.slice(0, 40)) {
      console.log(`  ${r.file.filename}  →  ${r.product.handle}   [${r.reason}, ${r.score.toFixed(2)}]`);
    }
    if (buckets.matched.length > 40) console.log(`  … +${buckets.matched.length - 40} more`);
  }

  if (buckets.ambiguous.length) {
    console.log('\n──── Ambiguous (review) ────');
    for (const r of buckets.ambiguous.slice(0, 20)) {
      console.log(`  ${r.file.filename}`);
      console.log(`    top:    ${r.best.product.handle} (${r.best.score.toFixed(2)}, ${r.best.reason})`);
      console.log(`    runner: ${r.runner.product.handle} (${r.runner.score.toFixed(2)}, ${r.runner.reason})`);
    }
    if (buckets.ambiguous.length > 20) console.log(`  … +${buckets.ambiguous.length - 20} more`);
  }

  if (buckets.unmatched.length) {
    console.log('\n──── Unmatched ────');
    for (const r of buckets.unmatched.slice(0, 20)) console.log(`  ${r.file.filename}`);
    if (buckets.unmatched.length > 20) console.log(`  … +${buckets.unmatched.length - 20} more`);
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with `--apply` to attach the matched files.');
    console.log('Tune the threshold with `--min-score=0.7` (higher = stricter).');
  }
}

main().catch((e) => {
  console.error('\nFailed:', e.message || e);
  process.exit(1);
});
