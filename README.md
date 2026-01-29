# Moyuum Khmer Promo Code Discounter (Static / GitHub Pages)

This project is **static HTML/CSS/JS** (no build tools) and is ready for **GitHub Pages**.

## Files

- `index.html` : Main page (products + cart + invoice modal)
- `styles.css` : Styling
- `app.js` : Logic (promo code, sorting, cart, invoice, PDF)
- `data/moyuum_products.json` : Product data
  - Image field: prefers `Img Src.` (Excel-style), falls back to `Image1` for legacy data.
- `data/promotion_code.json` : Promo code list (edit this)

## Promo Codes (per-code discount)

`data/promotion_code.json` entries:

- `Promotion Code`
- `Promotion Name`
- `Telegram Contact`
- `Discount Rate`  ✅ NEW

`Discount Rate` can be:
- `0.05` = 5%
- `0.15` = 15%
- `5` = 5%  (percent form)
- `15` = 15% (percent form)

If `Discount Rate` is missing/invalid, it falls back to **10%**.

## Sorting & Filtering

- Category buttons:
  - `All` first (localized)
  - Then categories ordered by **number of products** in that category (descending)
- Inside a category:
  - If `Main/Acc. Item` exists, `Main` items are shown first; if the field is missing, all items are listed normally.

## Category localization (Khmer/English)

Category labels are defined inside `app.js` in `CATEGORY_LABELS`.
- Khmer UI shows Khmer category labels.
- English UI shows English category labels.
- If a category is not found in the map, it falls back to the raw `Category` text from the product JSON.

## Order / Customer info (optional)

You can optionally fill:
- Order Date & Time
- Order No. (auto-generated from date/time)
- Customer Name / Contact / Address

Invoice prints these fields as `N/A` if blank.

## Run locally (VSCode)

Option A:
- Install **Live Server** extension
- Right click `index.html` → “Open with Live Server”

## Deploy to GitHub Pages

1. Push repo
2. GitHub repo → Settings → Pages
3. Source: Deploy from a branch → `main` / `(root)`


## Payment QR on Invoice (optional)

- Default QR image file: `assets/payment_qr.png`  
  → Replace this file with your real **payment QR** image (PNG recommended).

- If you prefer using an online image URL, edit this line in `app.js`:

```js
const PAYMENT_QR_URL = "assets/payment_qr.png";
```

> Note: For the PDF capture (html2canvas) to include the QR image, the image should be same-origin (recommended) or served with CORS enabled.
