# Flash Fashion — Shopify theme

Festival fashion for performers, by performers. A production-ready Online Store 2.0 Liquid theme with a holographic / UV-neon aesthetic, dark default, and full theme-customizer support.

## What's included

- **Online Store 2.0** JSON templates with section groups for header and footer
- **All required templates**: `index`, `product`, `collection`, `list-collections`, `cart`, `search`, `page`, `blog`, `article`, `404`, `password`, `gift_card`, plus customer account templates (`login`, `register`, `account`, `addresses`, `order`, `reset_password`, `activate_account`)
- **Reusable sections**: hero (image or video), featured collection, image-with-text, lookbook (CMS-driven grid), testimonials, newsletter, rich text, FAQ, announcement bar
- **Cart drawer** with AJAX add-to-cart, quantity updates, line removal, and order notes
- **Theme customizer** controls for logo, colors (incl. three neon accents and a holographic gradient toggle), typography (heading + body font pickers), page width, section spacing, cart type, product card defaults, and social links
- **AA accessibility**: skip-to-content link, focus-visible outlines, reduced-motion support, ARIA labels, semantic landmarks
- **Performance**: a single CSS file, deferred JS, responsive `image_tag` with `widths`/`sizes`, `loading="lazy"` defaults
- **SEO**: Open Graph / Twitter card meta tags and `Product` JSON-LD on product pages

## Install

You'll need Shopify CLI (`npm i -g @shopify/cli @shopify/theme`) and a development store on the `info@flashfashion.com` account.

```bash
# From this directory:
shopify theme dev --store=<your-store>.myshopify.com
```

That spins up a local preview at `http://127.0.0.1:9292` against your store data. Edits hot-reload.

To push to the store:

```bash
shopify theme push --store=<your-store>.myshopify.com --unpublished
```

That creates an unpublished theme on the store; you can publish it from the Shopify admin once you've reviewed it.

## After install — do this in the Shopify admin

1. Create a navigation menu with handle `main-menu` and add it to the header (Online Store → Navigation).
2. Create at least one collection (e.g. `all`, `new-drops`, `festival-edits`).
3. Open the theme editor and connect the home page's "Featured collection" section to a real collection.
4. Upload product images. The product page expects multiple variant images.
5. Set up the password page (Online Store → Preferences) and the password page section.

## Project structure

```
assets/                 # CSS, JS
config/                 # settings_schema.json, settings_data.json
layout/                 # theme.liquid, password.liquid
locales/                # en.default.json + schema translations
sections/               # All sections + section-group JSON
snippets/               # Icons, product-card, price, meta-tags, cart-drawer, social-icons
templates/              # JSON templates + customer Liquid templates + gift_card.liquid
templates/customers/    # Customer account templates
```

## Notes

- The home page renders placeholder products until you connect a real collection.
- The cart drawer is the default; switch to a cart-page flow in **Theme settings → Cart**.
- The theme respects `prefers-reduced-motion` for users who opt out of animations.
