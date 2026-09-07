#!/usr/bin/env node
// Idempotent store setup: pages, navigation menu, collection.
// Usage: SHOPIFY_ADMIN_TOKEN=shpat_xxx node scripts/setup-store.mjs

const STORE = process.env.SHOPIFY_STORE || 'flash-fashion-5833.myshopify.com';
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;
const API_VERSION = '2025-01';

if (!TOKEN) {
  console.error('Set SHOPIFY_ADMIN_TOKEN to a Custom App Admin API access token (shpat_...).');
  process.exit(1);
}

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
  return json.data;
}

const PAGES = [
  {
    handle: 'about',
    title: 'About',
    body: `<p class="lead">Flash Fashion is festival armor for performers, by performers.</p>
<p>We started in 2022 backstage at a desert festival, fixing a torn jumpsuit with gaffer tape an hour before a fire set. The piece looked sick — but it didn't last the weekend. We knew there was a gap: festival fashion that's actually built for the people who work the dance floor.</p>
<p>Today our pieces show up everywhere from EDC mainstages to deep-playa fire circles. Every garment is designed with working performers — fire dancers, hoopers, DJs, drag artists — and tested through real Burning Man weeks and full festival runs.</p>
<h2>What we obsess over</h2>
<ul>
  <li><strong>Reflective panels.</strong> 3M-grade retroreflective material that lights up under camera flash and stage lighting.</li>
  <li><strong>Reinforced seams.</strong> Hardware rated for dust storms. Snaps that don't blow out.</li>
  <li><strong>Breathable fabrics.</strong> Hand-picked technical knits that move with you under desert sun and rave heat.</li>
  <li><strong>Ethical production.</strong> Small-batch runs, fair-wage manufacturing, fade-resistant low-impact dyes.</li>
</ul>
<p>Made in small drops every full moon. Worn under blacklight and moonlight everywhere.</p>`,
  },
  {
    handle: 'contact',
    title: 'Contact',
    body: `<p>Wholesale, press, collabs, or just want to say hi?</p>
<p><strong>Email:</strong> <a href="mailto:info@flashfashion.com">info@flashfashion.com</a></p>
<p><strong>Press:</strong> press@flashfashion.com</p>
<p><strong>Wholesale &amp; team kits:</strong> wholesale@flashfashion.com</p>
<p>We answer within two business days, usually faster. If you're a performer interested in fitting samples for stage, mention your festival/circuit in the subject line.</p>`,
  },
  {
    handle: 'shipping-returns',
    title: 'Shipping & returns',
    body: `<h2>Shipping</h2>
<ul>
  <li>U.S. orders over $150 ship free, standard.</li>
  <li>Standard U.S.: 3–5 business days. Express: 1–2 business days.</li>
  <li>International: 7–14 business days; duties calculated at checkout.</li>
  <li>Festival rush? Email us — if you're in by noon, we move heaven and the warehouse.</li>
</ul>
<h2>Returns</h2>
<ul>
  <li>30-day returns on unworn, unwashed items with tags attached.</li>
  <li>Sale items are final.</li>
  <li>Return shipping is on you for change-of-mind; on us for defects.</li>
</ul>
<p>Start a return: <a href="mailto:returns@flashfashion.com">returns@flashfashion.com</a> with your order number.</p>`,
  },
  {
    handle: 'size-guide',
    title: 'Size guide',
    body: `<p>Our pieces run true to size with stretch where it matters. When in doubt, size up for layering or size down for body-con looks.</p>
<table>
  <thead><tr><th>Size</th><th>Bust</th><th>Waist</th><th>Hips</th></tr></thead>
  <tbody>
    <tr><td>XS</td><td>32"</td><td>25"</td><td>34"</td></tr>
    <tr><td>S</td><td>34"</td><td>27"</td><td>36"</td></tr>
    <tr><td>M</td><td>36"</td><td>29"</td><td>38"</td></tr>
    <tr><td>L</td><td>38"</td><td>32"</td><td>41"</td></tr>
    <tr><td>XL</td><td>41"</td><td>35"</td><td>44"</td></tr>
  </tbody>
</table>
<p>Performer fit notes are listed on each product page (range of motion, stretch %, on-stage durability).</p>`,
  },
  {
    handle: 'lookbook',
    title: 'Lookbook',
    body: `<p>Three days, three performers, one moonrise. Editorial shoots from the playa, the desert, and the dance floor.</p>
<p>Looking for the spring drop? <a href="/collections/festival-drop-01">Shop Festival Drop 01</a>.</p>`,
  },
];

const COLLECTIONS = [
  { handle: 'festival-drop-01', title: 'Festival Drop 01', body: '<p>The first drop of 2026 — performance-grade festival pieces tested through Burning Man, EDC, and Lightning in a Bottle.</p>' },
  { handle: 'new-drops', title: 'New Drops', body: '<p>Our newest pieces, in stock for a limited run.</p>' },
];

async function upsertPage({ handle, title, body }) {
  // Find existing
  const existing = await gql(
    `query($handle: String!) { pages(first: 1, query: $handle) { nodes { id handle } } }`,
    { handle: `handle:${handle}` }
  );
  const found = existing.pages.nodes.find((p) => p.handle === handle);

  if (found) {
    const r = await gql(
      `mutation($id: ID!, $page: PageUpdateInput!) {
        pageUpdate(id: $id, page: $page) {
          page { id handle title }
          userErrors { field message }
        }
      }`,
      { id: found.id, page: { title, body } }
    );
    if (r.pageUpdate.userErrors.length) throw new Error('Page update: ' + JSON.stringify(r.pageUpdate.userErrors));
    return r.pageUpdate.page;
  } else {
    const r = await gql(
      `mutation($page: PageCreateInput!) {
        pageCreate(page: $page) {
          page { id handle title }
          userErrors { field message }
        }
      }`,
      { page: { title, handle, body, isPublished: true } }
    );
    if (r.pageCreate.userErrors.length) throw new Error('Page create: ' + JSON.stringify(r.pageCreate.userErrors));
    return r.pageCreate.page;
  }
}

async function upsertCollection({ handle, title, body }) {
  const existing = await gql(
    `query($q: String!) { collections(first: 1, query: $q) { nodes { id handle } } }`,
    { q: `handle:${handle}` }
  );
  const found = existing.collections.nodes.find((c) => c.handle === handle);

  if (found) return found;

  const r = await gql(
    `mutation($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection { id handle title }
        userErrors { field message }
      }
    }`,
    { input: { title, handle, descriptionHtml: body } }
  );
  if (r.collectionCreate.userErrors.length) throw new Error('Collection create: ' + JSON.stringify(r.collectionCreate.userErrors));
  return r.collectionCreate.collection;
}

async function getOrCreateMenu(handle, title, items) {
  const existing = await gql(
    `query { menus(first: 50) { nodes { id handle title } } }`
  );
  const found = existing.menus.nodes.find((m) => m.handle === handle);

  const itemsInput = items.map((it) => ({
    title: it.title,
    type: it.type,
    resourceId: it.resourceId || null,
    url: it.url || null,
    items: [],
  }));

  if (found) {
    const r = await gql(
      `mutation($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
        menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
          menu { id handle }
          userErrors { field message }
        }
      }`,
      { id: found.id, title, handle, items: itemsInput }
    );
    if (r.menuUpdate.userErrors.length) throw new Error('Menu update: ' + JSON.stringify(r.menuUpdate.userErrors));
    return r.menuUpdate.menu;
  } else {
    const r = await gql(
      `mutation($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
        menuCreate(title: $title, handle: $handle, items: $items) {
          menu { id handle }
          userErrors { field message }
        }
      }`,
      { title, handle, items: itemsInput }
    );
    if (r.menuCreate.userErrors.length) throw new Error('Menu create: ' + JSON.stringify(r.menuCreate.userErrors));
    return r.menuCreate.menu;
  }
}

async function main() {
  console.log(`→ Setting up ${STORE}...`);

  console.log('\n[1/3] Pages');
  const pageMap = {};
  for (const p of PAGES) {
    const out = await upsertPage(p);
    pageMap[p.handle] = out;
    console.log(`  ✓ ${p.title} (${p.handle})`);
  }

  console.log('\n[2/3] Collections');
  const collMap = {};
  for (const c of COLLECTIONS) {
    const out = await upsertCollection(c);
    collMap[c.handle] = out;
    console.log(`  ✓ ${c.title} (${c.handle})`);
  }

  console.log('\n[3/3] Navigation menus');

  // Main menu
  await getOrCreateMenu('main-menu', 'Main menu', [
    { title: 'Shop', type: 'COLLECTION', resourceId: collMap['festival-drop-01'].id },
    { title: 'New Drops', type: 'COLLECTION', resourceId: collMap['new-drops'].id },
    { title: 'Lookbook', type: 'PAGE', resourceId: pageMap['lookbook'].id },
    { title: 'About', type: 'PAGE', resourceId: pageMap['about'].id },
    { title: 'Contact', type: 'PAGE', resourceId: pageMap['contact'].id },
  ]);
  console.log('  ✓ main-menu');

  // Footer "Shop" column
  await getOrCreateMenu('footer', 'Footer', [
    { title: 'All products', type: 'COLLECTION', resourceId: collMap['festival-drop-01'].id },
    { title: 'New Drops', type: 'COLLECTION', resourceId: collMap['new-drops'].id },
    { title: 'Lookbook', type: 'PAGE', resourceId: pageMap['lookbook'].id },
    { title: 'About', type: 'PAGE', resourceId: pageMap['about'].id },
  ]);
  console.log('  ✓ footer');

  console.log('\nDone. Refresh the theme editor to see the new content.');
}

main().catch((e) => {
  console.error('Setup failed:', e.message || e);
  process.exit(1);
});
