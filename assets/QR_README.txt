Payment QR file location

- Main file used by the app:
  assets/payment_qr.png

- Backup sample file:
  assets/payment_qr_SAMPLE.png

How to use:
1) Replace assets/payment_qr.png with your real QR image (PNG recommended).
2) Keep the filename the same.
3) Commit & push to GitHub Pages. The QR will appear in the Invoice and in the PDF.

Optional (use an online URL instead):
- Open app.js and edit:
  const PAYMENT_QR_URL = "assets/payment_qr.png";
  -> change to your https://... direct image URL (CORS must be allowed).
