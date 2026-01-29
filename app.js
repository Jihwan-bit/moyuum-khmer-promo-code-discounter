/* Moyuum Khmer Promo Code Discounter (Static / GitHub Pages)
   - Loads: ./data/moyuum_products.json and ./data/promotion_code.json
   - Promo code applies per-code discount rate via "Discount Rate"
   - Category ordering: by item count desc; within category: Main then Acc.
   - Khmer default UI; toggle EN
   - Invoice includes optional: order date/time, auto order no, customer name/contact/address
*/

// DOM helpers
const $ = (sel) => document.querySelector(sel);
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// CSS selector escaping helper
// - Used when building selectors that contain dynamic attribute values.
// - If this is missing, promo-gift "Add" clicks can silently fail due to a ReferenceError.
function cssEscape(value){
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(String(value ?? ''));
  }
  // Fallback: escape characters that would break a quoted attribute selector
  return String(value ?? '')
    .replace(/\\/g, "\\\\")
    .replace(/\"/g, "\\\"")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\f/g, "\\f");
}

// Barcode helpers (keep as string digits for stable matching)
function normalizeBarcode(v) {
  if (v === null || v === undefined) return '';
  // Accept numbers, strings, arrays (first item), etc.
  if (Array.isArray(v)) {
    if (v.length === 0) return '';
    return normalizeBarcode(v[0]);
  }
  return String(v)
    .trim()
    // remove spaces, commas, etc. but keep digits only
    .replace(/[^0-9]/g, '');
}

const DEFAULT_STOCK = 5;

const state = {
  lang: "km",              // 'km' or 'en'
  products: [],
  barcodeMap: {},            // barcode_norm -> product
  stockInitMap: {},           // barcode -> initial stock

  promos: [],
  ongoingPromotions: [],
  ongoingSelectedIndex: 0,

  // Moyuum Official Partners
  partners: [],
  partnersFilter: "all",     // all | pp | prov
  partnersExpanded: false,

  activeCategory: "All",
  promo: {
    codeRaw: "",
    valid: false,
    promoObj: null,        // {Promotion Code, Promotion Name, Telegram Contact, Discount Rate}
    discountRate: 0.10
  },
  cart: {},                // barcode_norm -> {barcode, qty}
  orderInfo: {
    orderDateTime: "",     // datetime-local string
    orderNo: "",
    customerName: "",
    customerContact: "",
    customerAddress: ""
  }
};

const I18N = {
  km: {
    brandSub: "បញ្ចូលកូដបញ្ចុះតម្លៃ (ស្រេចចិត្ត) ហើយបន្ថែមទំនិញទៅកន្ត្រក។",
    promoLabel: "បញ្ចូលលេខកូដប្រូម៉ូសិន (ជាជម្រើស)",
    promoPlaceholder: "បញ្ចូលលេខកូដ...",
    promoApply: "អនុវត្ត",
    promoClear: "លុប",
    ongoingTitle: "ប្រូម៉ូសិននៅបន្តដំណើរការ",
    ongoingSelectPlaceholder: "ជ្រើសរើសប្រូម៉ូសិន...",
    noOngoingPromotion: "អត់មានប្រូម៉ូសិនទេ ក្នុងខណៈពេលនេះ",

    partnersTitle: "ដៃគូផ្លូវការរបស់ Moyuum",
    partnersNo: "ល.រ",
    partnersShopName: "ឈ្មោះហាង",
    partnersMap: "ផែនទី",
    partnersContact: "ទំនាក់ទំនង",
    partnersFilterAll: "ដៃគូរសហការ",
    partnersFilterPP: "ភ្នំពេញ",
    partnersFilterProv: "ខេត្",
    partnersNoData: "អត់មានដៃគូផ្លូវការទេ ក្នុងខណៈពេលនេះ",
    partnersMapBtn: "ផែនទី",
    partnersContactBtn: "ទំនាក់ទំនង",
    partnersOpenInGMaps: "បើកក្នុង Google Maps",
    partnersView: "ពិនិត្យ",
    partnersHide: "លាក់",
    promoValid: (name, tg, pct) => `✅ ប្រូម៉ូសិននៅមានសុពលភាព — <b>${escapeHtml(name)}</b> · តំណភ្ជាប់តាមតេឡេក្រាម: <b>${escapeHtml(tg)}</b> · <b>${pct}% OFF</b>`,
    promoInvalid: "⚠️ Promo code is invalid (no discount applied).",
    orderTitle: "ព័ត៌មានបញ្ជាទិញ / អតិថិជន",
    orderDateLabel: "កាលបរិច្ឆេទ និងម៉ោងបញ្ជាទិញ",
    orderNoLabel: "លេខបញ្ជាទិញ (ស្វ័យប្រវត្តិ)",
    customerNameLabel: "ឈ្មោះអតិថិជន",
    customerContactLabel: "ទំនាក់ទំនង",
    customerAddressLabel: "អាសយដ្ឋាន",
    orderHint: "បើមិនបំពេញ វិក័យប័ត្រនឹងបង្ហាញជា N/A។ លេខកម្មង់ ត្រូវបានបង្កើតពី កាលបរិច្ឆេទ/ម៉ោង។",
    orderToggleOpen: "បង្ហាញ",
    orderToggleClose: "បិទ",
    stockModalTitle: "ជូនដំណឹង",
    confirmBtn: "បញ្ជាក់",
    stockInsufficient: (name, q) => `\'${name}\': ស្តុកមិនគ្រប់គ្រាន់ (សូមបញ្ចូលចំនួន: ${q}).`,
    productsTitle: "Products",
    cartTitle:"កន្ត្រកទំនិញ",
    clearCart:"លុបទំនិញដែលជ្រើសរួច",
    subtotal:"សរុបតម្លៃបឋម",
    discount: "បញ្ចុះតម្លៃ",
    total:"សរុបចុងក្រោយ",
    invoiceBtn: "បង្កើតវិក័យប័ត្រ",
    promoGiftTitle: "ជ្រើសរើសទំនិញឥតគិតថ្លៃ",
    promoGiftDesc: (freeQty, promoQty) => `លក្ខខណ្ឌប្រូម៉ូសិន: ទិញ ${promoQty}+ ឯកតា (ទំនិញមានសិទ្ធិ) → ជ្រើសរើសទំនិញឥតគិតថ្លៃ ${freeQty} ឯកតា`,
    promoGiftHint: (need) => `សូមជ្រើសរើសទំនិញឥតគិតថ្លៃចំនួន ${need} ឯកតា មុនពេលបង្កើតវិក័យប័ត្រ។`,
    promoGiftMustSelect: "សូមជ្រើសរើសទំនិញឥតគិតថ្លៃមុនពេលបង្កើតវិក័យប័ត្រ។",    freeItemDiscount: "ទំនិញឥតគិតថ្លៃ (តម្លៃ)",
    shortageDiscount: "បញ្ចុះតម្លៃ (ជំនួសស្តុកមិនគ្រប់)",

    giftDiscount: "បញ្ចុះតម្លៃ (ជំនួសទំនិញឥតគិតថ្លៃ)",

    cartNote: "Tip គន្លឹះ:\nជំហានទី១ សូមបន្ថែមទំនិញដែលចង់បាន →\nជំហានទី២ ចុចប៊ូតុង “បង្កើតវិក័យប័ត្រ” →\nជំហានទី៣ ថតរូបវិក័យប័ត្រ ឬទាញយកជា PDF",
    add: "Add",
    remove: "លុប",
    main: "Main",
    acc: "Acc.",
    stockLabel: "ស្តុក",
    stockOut: "អស់ស្តុក",
    stockExceed: (name, q) => `\'${name}\': ស្តុកមិនគ្រប់គ្រាន់ (សូមបញ្ចូលចំនួន: ${q}).`,
    invoiceTitle: "Invoice",
    invPromoName: "Promotion Name",
    invTelegram: "Telegram Contact",
    invPromoCode: "Promotion Code",
    invOrderNo: "Order No.",
    invOrderDate: "Order Date & Time",
    invCustomer: "Customer Info",
    thItem: "Item",
    thQty: "Qty",
    thUnit: "Unit ($)",
    thLine: "Line Total ($)",
    tfSubtotal:"សរុបតម្លៃបឋម",
    tfDiscount: "Discount",
    tfTotal: "Grand Total",
    invoiceFootnote: "ចំណាំ: តម្លៃត្រូវបានបង្ហាញជាដុល្លារអាមេរិក (USD)។ ព័ត៌មានប្រូម៉ូសិន និងព័ត៌មានអតិថិជន នឹងបង្ហាញជា N/A ប្រសិនបើមិនបានផ្តល់អោយ ឬមិនបានបំពេញ។",
    print: "Print",
    downloadPdf: "Download PDF",
        subtotalLabel: "សរុបតម្លៃបឋម",
    totalLabel: "សរុបចុងក្រោយ",
    generateInvoice: "បង្កើតវិក័យប័ត្រ",
    discountLabel: "បញ្ចុះតម្លៃ",
    cartTip: "Tip គន្លឹះ:<br>ជំហានទី១ សូមបន្ថែមទំនិញដែលចង់បាន →<br>ជំហានទី២ ចុចប៊ូតុង “បង្កើតវិក័យប័ត្រ” →<br>ជំហានទី៣ ថតរូបវិក័យប័ត្រ ឬទាញយកជា PDF",
    payQrTitle: "Payment QR",
    payQrDownload: "ទាញយក QR",
    payQrNote: "សូមស្កេន QR ដើម្បីបង់ប្រាក់",
    languageBtn: "EN",
    promoGiftSelect: "ជ្រើសរើសអំណោយឥតគិតថ្លៃ",
    promoGiftQty: "បរិមាណ",
    promoGiftAdd: "បន្ថែម",
    promoGiftSelected: "បានជ្រើស",
    promoGiftRemove: "លុប",
    promoGiftNeed: "ត្រូវការ",
    promoGiftLeft: "នៅសល់",
  },
  en: {
    brandSub: "Enter an optional promo code and add products to the cart.",
    promoLabel: "Promotion Code Input (Optional)",
    promoPlaceholder: "Enter promo code...",
    promoApply: "Apply",
    promoClear: "Clear",
    ongoingTitle: "Ongoing promotion",
    ongoingSelectPlaceholder: "Select a promotion...",
    noOngoingPromotion: "No promotion at this time",

    partnersTitle: "Moyuum Official Partners",
    partnersNo: "No.",
    partnersShopName: "Shop Name",
    partnersMap: "Google map",
    partnersContact: "Contact",
    partnersFilterAll: "All partners",
    partnersFilterPP: "Phnom Penh",
    partnersFilterProv: "Provinces",
    partnersNoData: "No partner at this time",
    partnersMapBtn: "Google map",
    partnersContactBtn: "Contact",
    partnersOpenInGMaps: "Open in Google Maps",
    partnersView: "View",
    partnersHide: "Hide",
    promoValid: (name, tg, pct) => `✅ Valid promo — <b>${escapeHtml(name)}</b> · <b>${escapeHtml(tg)}</b> · <b>${pct}% OFF</b>`,
    promoInvalid: "⚠️ Promo code is invalid (no discount applied).",
    orderTitle: "Order / Customer Info (Optional)",
    orderDateLabel: "Order Date & Time",
    orderNoLabel: "Order No. (auto)",
    customerNameLabel: "Customer Name",
    customerContactLabel: "Contact",
    customerAddressLabel: "Address",
    orderHint: "If left blank, invoice will show N/A. Order No. is generated from date/time.",
    orderToggleOpen: "Show",
    orderToggleClose: "Hide",
    stockModalTitle: "Notice",
    confirmBtn: "Confirm",
    stockInsufficient: (name, q) => `\'${name}\': Insufficient Stock (Inputted quantity: ${q})`,
    productsTitle: "Products",
    cartTitle: "Cart",
    clearCart: "Clear Cart",
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total",
    invoiceBtn: "Generate Invoice",
    promoGiftTitle: "Free Gift Selection",
    promoGiftDesc: (freeQty, promoQty) => `Promo: Buy ${promoQty}+ qualified item(s) → Choose ${freeQty} free item(s)`,
    promoGiftHint: (need) => `Please choose ${need} free item(s) before generating the invoice.`,
    promoGiftMustSelect: "Please choose the free gift items before generating the invoice.",    freeItemDiscount: "Free Items (Value)",
    shortageDiscount: "Gift Shortage Discount",

    giftDiscount: "Gift Discount (Stock Shortage)",

    cartNote: "Tip: Use “Generate Invoice” → Print / Download PDF.",
    add: "Add",
    remove: "Remove",
    main: "Main",
    acc: "Acc.",
    stockLabel: "Stock",
    stockOut: "Out of Stock",
    stockExceed: (name, q) => '',
    invoiceTitle: "Invoice",
    invPromoName: "Promotion Name",
    invTelegram: "Telegram Contact",
    invPromoCode: "Promotion Code",
    invOrderNo: "Order No.",
    invOrderDate: "Order Date & Time",
    invCustomer: "Customer Info",
    thItem: "Item",
    thQty: "Qty",
    thUnit: "Unit ($)",
    thLine: "Line Total ($)",
    tfSubtotal: "Subtotal",
    tfDiscount: "Discount",
    tfTotal: "Grand Total",
    invoiceFootnote: "Note: Prices are shown in USD. Promo & customer info are shown as N/A when not applied / not provided.",
    payQrTitle: "Payment QR",
    payQrDownload: "Download QR",
    print: "Print",
    downloadPdf: "Download PDF",
    languageBtn: "ខ្មែរ",
    promoGiftSelect: "Select free gift",
    promoGiftQty: "Qty",
    promoGiftAdd: "Add",
    promoGiftSelected: "Selected",
    promoGiftRemove: "Remove",
    promoGiftNeed: "Need",
    promoGiftLeft: "left"
  }
};

// Category labels (Khmer default). If not listed, fall back to raw Category text.
const CATEGORY_LABELS = {
  "Bottle": { km: "កំប៉ុងទឹកដោះគោ", en: "Bottle" },
  "Nipple": { km: "ក្បាលបំបៅ", en: "Nipple" },
  "Pacifier": { km: "គ្រឿងសំរាប់កូនង៉ែតជញ្ជក់លេង", en: "Pacifier" },
  "Teether": { km: "ប្រដាប់ខាំធ្មេញ", en: "Teether" },
  "Brush": { km: "ច្រាសលាងកំប៉ុង", en: "Brush" },
  "Milk Powder Case": { km: "ប្រអប់ដាក់ម្សៅទឹកដោះ", en: "Milk Powder Case" }
};

// Internal categories like "Bottle1", "Nipple2" are used for ordering only.
// Consumer-facing categories should be their base text: "Bottle", "Nipple", etc.
function baseCategoryKey(cat){
  const c = String(cat || "").trim();
  // Strip trailing digits only (e.g., Bottle1 -> Bottle). For Khmer text (no digits), this is a no-op.
  return c.replace(/\d+$/g, "");
}

function categoryLabel(raw){
  const key = baseCategoryKey(raw);
  const obj = CATEGORY_LABELS[key];
  if (!obj) return key;
  return state.lang === "km" ? (obj.km || key) : (obj.en || key);
}

function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, s => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"
  }[s]));
}


function parseBarcodeList(v){
  // Accept: null, array, comma/semicolon/newline separated list.
  // Always normalize to digits-only strings to match cart keys.
  if (v === null || v === undefined) return [];
  if (Array.isArray(v)) return v.map(normBarcode).filter(Boolean);
  const s = String(v);
  return s
    .split(/[,;\n\t]+/g)
    .map(normBarcode)
    .filter(Boolean);
}

function buildPromoGroupKey(triggerBarcodesNorm, promoQty, freeQty){
  const t = (triggerBarcodesNorm || []).slice().sort().join("|");
  return `${t}__PQ${promoQty}__FQ${freeQty}`;
}

function normBarcode(v){
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  const digits = s.replace(/\D/g, "");
  return digits || s;
}

function normalizeGDriveUrl(url){
  if (!url) return "";
  const s = String(url).trim();

  // Extract a Drive file ID if present anywhere in the string
  const idFromD = s.match(/\/d\/([A-Za-z0-9_-]{10,})/);
  const idFromId = s.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
  const id = (idFromD && idFromD[1]) || (idFromId && idFromId[1]) || "";

  if (id){
    // Thumbnail is often more reliable on GitHub Pages
    return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
  }
  return s;
}


function telegramUrl(raw){
  const s = String(raw || "").trim();
  if (!s || s === "N/A") return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (/t\.me\//i.test(s)) return s.startsWith("http") ? s : `https://${s}`;
  if (s.startsWith("@")){
    const u = s.slice(1).trim();
    return u ? `https://t.me/${u}` : "";
  }
  // If it's a plain username without @
  if (/^[A-Za-z0-9_]{5,}$/.test(s)) return `https://t.me/${s}`;
  // Otherwise, we don't know a safe Telegram URL format (could be a phone/label)
  return "";
}

function money(n){
  const x = Number(n || 0);
  return x.toFixed(2);
}


// Safe localStorage wrapper (prevents Tracking Prevention / privacy mode from breaking logic)
const safeStorage = (() => {
  let mem = {};
  const ok = (() => {
    try {
      localStorage.setItem('__t', '1');
      localStorage.removeItem('__t');
      return true;
    } catch (e) {
      return false;
    }
  })();

  return {
    get(key){
      if (ok){
        try { return localStorage.getItem(key); } catch(e){ return null; }
      }
      return (key in mem) ? mem[key] : null;
    },
    set(key, val){
      if (ok){
        try { localStorage.setItem(key, String(val)); return; } catch(e) {}
      }
      mem[key] = String(val);
    },
    del(key){
      if (ok){
        try { localStorage.removeItem(key); return; } catch(e) {}
      }
      if (key in mem) delete mem[key];
    }
  };
})();

function getGiftSelectedByBarcode(){
  const all = state.promoGiftSelection || {};
  const out = {};
  for (const offerKey of Object.keys(all)){
    const sel = all[offerKey] || {};
    for (const b of Object.keys(sel)){
      const q = Number(sel[b] || 0);
      if (q <= 0) continue;
      out[b] = (out[b] || 0) + q;
    }
  }
  return out;
}

function baseRemaining(barcode){
  const init = Number(state.stockInitMap?.[barcode] ?? DEFAULT_STOCK);
  const rem = init - cartQty(barcode);
  return Math.max(0, rem);
}

function getName(p){
  return state.lang === "km" ? (p["Name(KH.)"] || p["Name(EN.)"] || "N/A")
                            : (p["Name(EN.)"] || p["Name(KH.)"] || "N/A");
}

function getBasePrice(p){
  return Number(p["Retail Price ($)"] || 0);
}

function getUnitPrice(p){
  const base = getBasePrice(p);
  if (!state.promo.valid) return base;
  return +(base * (1 - (state.promo.discountRate || 0.10))).toFixed(2);
}

function isMain(p){
  return String(p["Main/Acc. Item"] || "").trim().toLowerCase() === "main";
}

function parseDiscountRate(promoObj){
  // promotion_code.json can include "Discount Rate" as:
  // - 0.05 (5%) OR
  // - 5 (5%)  OR
  // - 15 (15%)
  // If missing/invalid => 0.10
  const raw = promoObj ? promoObj["Discount Rate"] : null;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) return 0.10;
  if (num > 1) return Math.min(num / 100, 0.95);
  return Math.min(num, 0.95);
}

function pad2(n){ return String(n).padStart(2,"0"); }

function toDatetimeLocalValue(d){
  // local timezone value for datetime-local
  const x = new Date(d.getTime() - d.getTimezoneOffset()*60000);
  return x.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
}

function generateOrderNo(dtStr){
  // dtStr: YYYY-MM-DDTHH:MM from datetime-local
  let d = dtStr ? new Date(dtStr) : new Date();
  if (isNaN(d.getTime())) d = new Date();
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth()+1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function formatOrderDate(dtStr){
  if (!dtStr) return "N/A";
  // Show as "YYYY-MM-DD HH:MM"
  return String(dtStr).replace("T"," ");
}

function getCustomerSummary(){
  const name = (state.orderInfo.customerName || "").trim();
  const contact = (state.orderInfo.customerContact || "").trim();
  const addr = (state.orderInfo.customerAddress || "").trim();
  const parts = [];
  if (name) parts.push(name);
  if (contact) parts.push(contact);
  if (addr) parts.push(addr.replace(/\s+/g," ").trim());
  return parts.length ? parts.join(" | ") : "N/A";
}


function getCustomerMultiline(){
  const name = (state.orderInfo.customerName || "").trim();
  const contact = (state.orderInfo.customerContact || "").trim();
  const addr = (state.orderInfo.customerAddress || "").trim().replace(/\s+/g," ").trim();

  const nameOut = name ? name : "N/A";
  const contactOut = contact ? contact : "N/A";
  const addrOut = addr ? addr : "N/A";

  // Force 3-line format (as requested)
  return `Name: ${nameOut}\nContact: ${contactOut}\nAddress: ${addrOut}`;
}


function loadLocal(){
  try{
    const raw = safeStorage.get("moyuum_cart_v2");
    if (raw) state.cart = JSON.parse(raw) || {};
  }catch(e){}
try{
    const orderRaw = safeStorage.get("moyuum_order_v2");
    if (orderRaw) state.orderInfo = {...state.orderInfo, ...(JSON.parse(orderRaw) || {})};
  }catch(e){}
  try{
    const lang = safeStorage.get("moyuum_lang_v2");
    if (lang === "en" || lang === "km") state.lang = lang;
  }catch(e){}
    // Force Khmer as default on every load
  state.lang = "km";
// Always start with an empty cart
  state.cart = {};
}


function saveLocal(){
  try{ safeStorage.set("moyuum_cart_v2", JSON.stringify(state.cart)); }catch(e){}
try{ safeStorage.set("moyuum_order_v2", JSON.stringify(state.orderInfo)); }catch(e){}
  try{ safeStorage.set("moyuum_lang_v2", state.lang); }catch(e){}
}

async function loadData(){
  const [productsRes, promoRes] = await Promise.all([
    fetch("./data/moyuum_products.json", {cache:"no-store"}),
    fetch("./data/promotion_code.json", {cache:"no-store"})
  ]);

  state.products = await productsRes.json();
  state.promos = await promoRes.json();

  state.stockInitMap = {};

  state.products = state.products.map(p => {
    const q = {...p};
    q._barcode_norm = normBarcode(q["Barcode"]);
    // Initialize stock per product (prefer JSON Stock, fallback to DEFAULT_STOCK)
    if (q._barcode_norm){
      const s = Number(q.Stock);
      state.stockInitMap[q._barcode_norm] = (Number.isFinite(s) && s >= 0) ? s : DEFAULT_STOCK;
    }
    q._is_main = isMain(q);

    // ---- Promotion parsing (supports two data conventions) ----
    // Convention A (legacy / current engine):
    //   Gift item has Promotion Type = Free, and Promotion Barcode = *trigger* barcodes.
    // Convention B (user-friendly):
    //   Trigger item has Promotion Type = Free, and Promotion Barcode = *gift candidate* barcodes.
    // We store raw/normalized fields here and decide the interpretation AFTER barcodeMap is built.
    q._promo_type = String(q["Promotion Type"] || "").trim().toLowerCase();
    q._promo_qty = Number(q["Promotion Quantity"] ?? 0) || 0;
    q._free_qty = Number(q["Free Quantity"] ?? 0) || 0;
    q._promo_list_norm = parseBarcodeList(q["Promotion Barcode"] ?? "");
    q._promo_role = "";          // 'gift' | 'trigger'
    q._promo_triggers_norm = []; // barcode_norm[]
    q._promo_gifts_norm = [];    // barcode_norm[]
    q._promo_group_key = "";

    q.Image1 = normalizeGDriveUrl(q.Image1);
    q["Img Src."] = normalizeGDriveUrl(q["Img Src."] || q["Img Src"] || "");
    q.Image2 = normalizeGDriveUrl(q.Image2);

    // Image candidates: try thumbnail / direct links in order
    q._imageCandidates = [];
    if (q.Image1) q._imageCandidates.push(q.Image1);
    if (q.Image2) q._imageCandidates.push(q.Image2);

    // Also add uc export as fallback if we can find an id in raw strings
    const rawAll = String(p["Img Src."]||"") + " " + String(p.Image1||"") + " " + String(p.image||"") + " " + String(p.Image||"");
    const idMatch = rawAll.match(/\/d\/([A-Za-z0-9_-]{10,})/) || rawAll.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
    if (idMatch && idMatch[1]){
      q._imageCandidates.push(`https://drive.google.com/uc?export=view&id=${idMatch[1]}`);
      q._imageCandidates.push(`https://drive.google.com/thumbnail?id=${idMatch[1]}&sz=w2000`);
    }

    return q;
  });
}

async function loadOngoingPromotions(){
  // Safe load: if file missing or invalid, treat as no promotions.
  try{
    const res = await fetch("./data/ongoing_promotions.json", {cache:"no-store"});
    if (!res.ok){
      state.ongoingPromotions = [];
      return;
    }
    const arr = await res.json();
    if (!Array.isArray(arr)){
      state.ongoingPromotions = [];
      return;
    }
    state.ongoingPromotions = arr.map(p => {
      const q = {...p};
      // normalize common image fields
      q.Image1 = normalizeGDriveUrl(q.Image1 || q["Img Src."] || q["Img Src"] || q.image || q.Image || "");
      if (!q["Img Src."] && q.Image1) q["Img Src."] = q.Image1;
      q.Image2 = normalizeGDriveUrl(q.Image2 || "");
      return q;
    });
  }catch(_e){
    state.ongoingPromotions = [];
  }
}

async function loadOfficialPartners(){
  // Safe load: if file missing or invalid, treat as no partners.
  try{
    const res = await fetch("./data/official_partners.json", {cache:"no-store"});
    if (!res.ok){
      state.partners = [];
      return;
    }
    const arr = await res.json();
    if (!Array.isArray(arr)){
      state.partners = [];
      return;
    }
    state.partners = arr.map(p => ({...p}));
  }catch(_e){
    state.partners = [];
  }
}


function computeAccReferenceCounts(){
  // Count how many times a MAIN barcode is referenced inside ACC items' "Acc. Barcode" lists.
  const counts = {};
  for (const p of state.products){
    const isAcc = String(p["Main/Acc. Item"] || "").trim().toLowerCase().startsWith("acc");
    if (!isAcc) continue;
    const arr = Array.isArray(p["Acc. Barcode"]) ? p["Acc. Barcode"] : (p["Acc. Barcode"] ? [p["Acc. Barcode"]] : []);
    for (const b of arr){
      const nb = normBarcode(b);
      if (!nb) continue;
      counts[nb] = (counts[nb] || 0) + 1;
    }
  }
  state.refCounts = counts;
}

function categoryOrder(){
  // Category button order should use consumer-facing categories (Bottle/Nipple/...).
  // Internal categories like Bottle1/Bottle2 are only for listing logic.
  const counts = new Map();
  const pri = new Map();

  for (const p of state.products){
    // Only show categories that have at least one in-stock product
    if (!(Number(p.Stock || 0) > 0)) continue;
    const base = baseCategoryKey(p.Category || "Other");
    counts.set(base, (counts.get(base) || 0) + 1);

    const pPri = (typeof p.Priority === "number") ? p.Priority : (Number(p.Priority) || 99);
    const prevPri = pri.has(base) ? pri.get(base) : 99;
    pri.set(base, Math.min(prevPri, pPri));
  }

  return [...counts.entries()]
    .sort((a,b) => {
      const ca = a[0], cb = b[0];
      const pa = pri.get(ca) ?? 99;
      const pb = pri.get(cb) ?? 99;
      if (pa !== pb) return pa - pb;

      // within same priority, show categories with more products first
      const da = a[1], db = b[1];
      if (da !== db) return db - da;

      return ca.localeCompare(cb);
    })
    .map(([c]) => c);
}

function getCatNum(c){
  const m = String(c || "").match(/(\d+)$/);
  return m ? Number(m[1]) : 999;
}

function sizeRank(s, mlFallback){
  // Size ordering for consistent listing (S -> M -> L).
  // Some rows may have missing/variant size strings, so we use a
  // conservative fallback based on ml when available.
  const x = String(s || "").trim().toUpperCase();
  const map = { "XS":0, "S":1, "M":2, "L":3, "XL":4, "SMALL":1, "MEDIUM":2, "LARGE":3 };
  if (map[x] !== undefined) return map[x];

  const ml = Number(mlFallback);
  if (Number.isFinite(ml) && ml > 0){
    // Rough bucket for bottles/cups when Size isn't set.
    if (ml <= 200) return 1;   // S
    if (ml <= 280) return 2;   // M
    return 3;                  // L+
  }
  return 99;
}

function parseMl(qty){
  const t = String(qty || "");
  const m = t.match(/(\d+(?:\.\d+)?)\s*ml/i);
  return m ? Number(m[1]) : 999999;
}

function parseStage(nameEn){
  const t = String(nameEn || "");
  let m = t.match(/level\s*(\d+)/i);
  if (m) return Number(m[1]);
  m = t.match(/stage\s*(\d+)/i);
  if (m) return Number(m[1]);
  return 999;
}

function relatedCount(p){
  if (typeof p._related_count === "number") return p._related_count;
  if (Array.isArray(p._acc_barcodes)) return p._acc_barcodes.length;
  return 0;
}

function productSortKey(p){
  // Stable ordering inside groups: category number, size, volume(ml), stage, name
  const ml = parseMl(p.Quantity);
  return [
    getCatNum(p.Category),
    sizeRank(p.Size, ml),
    ml,
    parseStage(p["Name(EN.)"]),
    getName(p)
  ];
}

function compareKeys(aKey, bKey){
  for (let i=0;i<Math.max(aKey.length,bKey.length);i++){
    const a=aKey[i], b=bKey[i];
    if (a===b) continue;
    // numbers first
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b));
  }
  return 0;
}

function getFilteredProducts(){
  // 1) Stock filter: only list items with Stock >= 1
  const stockOk = (p) => (Number(p.Stock || 0) >= 1);

  // 2) Category filter view (single category)
  if (state.activeCategory !== "All"){
    const items = state.products
      // activeCategory stores CONSUMER category (baseCategory)
      .filter(p => baseCategoryKey(p.Category || "") === state.activeCategory)
      .filter(stockOk);

    // Sort inside category: size/volume/stage asc, then name (no duplicates)
    return [...items].sort((a,b) => compareKeys(productSortKey(a), productSortKey(b)));
  }

  // 3) All view: Priority asc, then grouped by "most-related seed" + its related items
  const products = state.products.filter(stockOk);

  // Build maps for quick lookup by barcode
  const byBarcode = {};
  for (const p of products){
    if (p && p._barcode_norm) byBarcode[p._barcode_norm] = p;
  }

  // group by priority
  const priGroups = new Map();
  for (const p of products){
    const pri = (typeof p.Priority === "number") ? p.Priority : (Number(p.Priority) || 99);
    if (!priGroups.has(pri)) priGroups.set(pri, []);
    priGroups.get(pri).push(p);
  }

  const sortedPris = [...priGroups.keys()].sort((a,b)=>a-b);
  const out = [];
  const used = new Set();

  for (const pri of sortedPris){
    const group = priGroups.get(pri) || [];

    // Seeds: keep "internal" category buckets stable (e.g., Bottle1 before Bottle2)
    // and THEN apply "many related first" within each internal bucket.
    const seeds = [...group].sort((a,b)=>{
      const abase = baseCategoryKey(a.Category || "");
      const bbase = baseCategoryKey(b.Category || "");
      if (abase === bbase){
        const an = getCatNum(a.Category || "");
        const bn = getCatNum(b.Category || "");
        if (an !== bn) return an - bn;
      }
      const ac = relatedCount(a);
      const bc = relatedCount(b);
      if (ac !== bc) return bc - ac;
      return compareKeys(productSortKey(a), productSortKey(b));
    });

    for (const seed of seeds){
      const seedKey = seed._barcode_norm;
      if (!seedKey || used.has(seedKey)) continue;

      // --- Place seed (with special grouping for Nipple Level 1~4) ---
      const seedBase = baseCategoryKey(seed.Category || "");
      let seedGroup = [seed];

      // If multiple Nipple items share the same related (Acc) barcodes and the same relatedCount,
      // show them consecutively (Level/Size asc) BEFORE listing their related items.
      if (seedBase === "Nipple"){
        const accKey = (Array.isArray(seed._acc_barcodes_norm) ? seed._acc_barcodes_norm : []).join("|");
        const rc = relatedCount(seed);
        const siblings = group.filter(p => {
          const k = p && p._barcode_norm;
          if (!k || used.has(k)) return false;
          if (p === seed) return false;
          if (baseCategoryKey(p.Category || "") !== "Nipple") return false;
          if (relatedCount(p) !== rc) return false;
          const pk = (Array.isArray(p._acc_barcodes_norm) ? p._acc_barcodes_norm : []).join("|");
          return pk === accKey;
        });

        if (siblings.length){
          seedGroup = [seed, ...siblings].sort((a,b)=>compareKeys(productSortKey(a), productSortKey(b)));
        }
      }

      for (const s of seedGroup){
        const k = s && s._barcode_norm;
        if (!k || used.has(k)) continue;
        out.push(s);
        used.add(k);
      }

      // collect related items within SAME priority group
      const rels = [];
      const accList = Array.isArray(seed._acc_barcodes_norm) ? seed._acc_barcodes_norm : [];
      // seedBase is already defined above (used for the stage grouping). Reuse it here.
      const seedCatNum = getCatNum(seed.Category || "");
      for (const b of accList){
        const p = byBarcode[b];
        if (!p) continue;
        const pPri = (typeof p.Priority === "number") ? p.Priority : (Number(p.Priority) || 99);
        if (pPri !== pri) continue;
        if (used.has(p._barcode_norm)) continue;
        // Prevent same-base internal categories from being pulled "backwards".
        // Example: Bottle1 should not appear after Bottle2 just because it's in Bottle2's related list.
        // (It will be placed when Bottle1's own seed turn comes.)
        const pBase = baseCategoryKey(p.Category || "");
        if (pBase && seedBase && pBase === seedBase){
          const pCatNum = getCatNum(p.Category || "");
          if (pCatNum > 0 && seedCatNum > 0 && pCatNum < seedCatNum) continue;
        }
        rels.push(p);
      }

      // sort related by category number asc, then size/volume/stage asc
      rels.sort((a,b)=>compareKeys(productSortKey(a), productSortKey(b)));

      for (const r of rels){
        out.push(r);
        used.add(r._barcode_norm);
      }
    }
  }

  // Safety: remove duplicates (shouldn't happen), and keep stable
  const final = [];
  const seen = new Set();
  for (const p of out){
    if (!p || !p._barcode_norm) continue;
    if (seen.has(p._barcode_norm)) continue;
    seen.add(p._barcode_norm);
    final.push(p);
  }
  return final;
}

function buildCategoryFilters(){
  const wrap = $("#categoryFilters");
  wrap.innerHTML = "";

  const cats = categoryOrder();

  const all = document.createElement("button");
  all.className = "filter-btn" + (state.activeCategory === "All" ? " active" : "");
  all.textContent = (state.lang === "km") ? "ទាំងអស់" : "All";
  all.onclick = () => { state.activeCategory = "All"; renderAll(); };
  wrap.appendChild(all);

  for (const c of cats){
    const btn = document.createElement("button");
    btn.className = "filter-btn" + (state.activeCategory === c ? " active" : "");
    btn.textContent = categoryLabel(c);
    btn.onclick = () => { state.activeCategory = c; renderAll(); };
    wrap.appendChild(btn);
  }
}

function buildProductCard(p){
  const card = document.createElement("div");
  card.className = "card product-card";

    const imgWrap = document.createElement("div");
    imgWrap.className = "img";
    const img = document.createElement("img");
    img.alt = getName(p);
    img.loading = "lazy";
    const candidates = (p._imageCandidates && p._imageCandidates.length)
      ? p._imageCandidates
      : [p["Img Src."], p.Image1, p.Image2].filter(Boolean);
    let idx = 0;
    img.src = candidates[idx] || "";
    img.onerror = () => {
      idx += 1;
      if (idx < candidates.length){
        img.src = candidates[idx];
        return;
      }
      imgWrap.innerHTML = "<div style='color:rgba(15,23,42,.55);font-size:12px'>No image</div>";
    };
    // (do not overwrite onerror)
    imgWrap.appendChild(img);

    const body = document.createElement("div");
    body.className = "body";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = getName(p);

    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `
      <span>${escapeHtml(categoryLabel(String(p.Category || "")))}</span>
      <span>${p["Main/Acc. Item"] ? escapeHtml(String(p["Main/Acc. Item"])) : ""}</span>
    `;

    // Main/Acc. is optional. If missing, don't show the badge.
    const hasMainAcc = !!String(p["Main/Acc. Item"] || "").trim();
    const badge = hasMainAcc ? document.createElement("div") : null;
    if (badge){
      badge.className = "badge";
      badge.textContent = isMain(p) ? I18N[state.lang].main : I18N[state.lang].acc;
    }

    const price = document.createElement("div");
    price.className = "price";
    const base = getBasePrice(p);
    const unit = getUnitPrice(p);
    if (state.promo.valid && base !== unit){
      price.innerHTML = `<span>$${money(unit)}</span> <span class="old">$${money(base)}</span>`;
    } else {
      price.innerHTML = `<span>$${money(base)}</span>`;
    }

    const actions = document.createElement("div");
    actions.className = "actions";

    const qtyPill = document.createElement("div");
    qtyPill.className = "qty-pill";
    const minus = document.createElement("button");
    minus.className = "small-btn";
    minus.textContent = "−";
    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.oninput = () => {
      setInlineStockMsg(p._barcode_norm, validateStockInline(p._barcode_norm, qtyInput.value));
    };
    qtyInput.min = "1";
    qtyInput.value = "1";
    const plus = document.createElement("button");
    plus.className = "small-btn";
    plus.textContent = "+";
    minus.onclick = () => { qtyInput.value = String(Math.max(1, Number(qtyInput.value||1) - 1)); };
    plus.onclick  = () => { qtyInput.value = String(Math.max(1, Number(qtyInput.value||1) + 1)); };
    qtyPill.appendChild(minus);
    qtyPill.appendChild(qtyInput);
    qtyPill.appendChild(plus);

    const add = document.createElement("button");
    add.className = "btn btn-primary";
    add.textContent = I18N[state.lang].add;
    add.onclick = () => {
      const q = Math.max(1, Number(qtyInput.value || 1));
      addToCart(p._barcode_norm, q);
    };

    actions.appendChild(qtyPill);
    actions.appendChild(add);

    body.appendChild(title);
    body.appendChild(meta);
    if (badge) body.appendChild(badge);
    body.appendChild(price);

    body.appendChild(actions);

    // Inline insufficient stock message (hidden by default)
    const msgDiv = document.createElement("div");
    msgDiv.id = stockMsgId(p._barcode_norm);
    msgDiv.className = "stock-msg hidden";
    body.appendChild(msgDiv);
    setInlineStockMsg(p._barcode_norm, "");


    card.appendChild(imgWrap);
    card.appendChild(body);

  return card;
}


function categoryCountsInStock(items){
  const counts = new Map();
  for (const p of items){
    const base = baseCategoryKey(p.Category || p["Type (Category)"] || "");
    if (!base) continue;
    counts.set(base, (counts.get(base) || 0) + 1);
  }
  return counts;
}

function parseCompatibleTargets(p){
  // Prefer Excel-native field name: "Compatible Product"
  // Fallback to legacy: "Acc. Barcode" (older JSONs)
  const v = (p && (p["Compatible Product"] ?? p["Compatible Products"] ?? p["Acc. Barcode"] ?? "")) ?? "";
  return parseBarcodeList(v);
}


function allCompatibilityOrderedList(){
  // Undirected compatibility ordering (iterative, GLOBAL-degree leader selection):
  // - Build an UNDIRECTED graph from "Compatible Product" relations.
  // - Repeatedly pick the remaining node(s) with the highest GLOBAL degree (connections in the full graph),
  //   not the degree within remaining. (This preserves "leader order" even if some neighbors were already placed.)
  // - Render a batch: (leaders + their neighbors that are still remaining), sorted by Priority asc, then stable key.
  // - Remove rendered items, and repeat until exhausted.
  // - Nodes with zero global connections are appended at the end by Priority asc.
  // Notes:
  // - No compatible-count text is rendered.
  // - Layout remains the normal responsive grid.

  const stockOk = (p) => (Number(p.Stock || 0) >= 1);
  const items = state.products.filter(stockOk);

  // Build lookup by barcode
  const byBarcode = {};
  for (const p of items){
    if (p && p._barcode_norm) byBarcode[p._barcode_norm] = p;
  }

  const barcodes = Object.keys(byBarcode);
  const remaining = new Set(barcodes);

  // Build undirected adjacency: barcode -> Set(neighborBarcodes)
  const adj = new Map();
  for (const b of barcodes) adj.set(b, new Set());

  for (const p of items){
    const src = p?._barcode_norm;
    if (!src || !adj.has(src)) continue;

    const targets = parseCompatibleTargets(p);
    if (!targets || !targets.length) continue;

    for (const tRaw of targets){
      const tgt = normBarcode(tRaw);
      if (!tgt || tgt === src) continue;
      if (!adj.has(tgt)) continue; // ignore links to unknown products
      adj.get(src).add(tgt);
      adj.get(tgt).add(src);
    }
  }

  // Precompute GLOBAL degree (full-graph connections) for leader selection
  const globalDeg = new Map();
  for (const b of barcodes){
    globalDeg.set(b, (adj.get(b)?.size || 0));
  }

  const catCounts = categoryCountsInStock(items);
  const getPri = (p) => (typeof p.Priority === "number") ? p.Priority : (Number(p.Priority) || 99);
  const stableCmp = (a,b) => compareKeys(productSortKey(a), productSortKey(b));

  const out = [];

  while (remaining.size){
    // 1) find max GLOBAL degree among remaining
    let maxDeg = 0;
    for (const b of remaining){
      const d = globalDeg.get(b) || 0;
      if (d > maxDeg) maxDeg = d;
    }

    // If no one has any connections in the full graph, the rest are isolated.
    if (maxDeg <= 0) break;

    // 2) leaders: all remaining nodes with maxDeg (deterministic order for stability)
    const leaders = [];
    for (const b of remaining){
      const d = globalDeg.get(b) || 0;
      if (d !== maxDeg) continue;
      const p = byBarcode[b];
      if (!p) continue;
      const base = baseCategoryKey(p.Category || p["Type (Category)"] || "");
      const catCount = catCounts.get(base) || 0;
      leaders.push({ b, p, catCount, pri: getPri(p) });
    }
    leaders.sort((A,B)=>{
      if (A.catCount !== B.catCount) return B.catCount - A.catCount;
      if (A.pri !== B.pri) return A.pri - B.pri;
      return stableCmp(A.p, B.p);
    });

    // 3) batch = union(leaders + their DIRECT neighbors) that are still remaining
    const batchSet = new Set();
    for (const L of leaders){
      if (!remaining.has(L.b)) continue;
      batchSet.add(L.b);
      const neigh = adj.get(L.b);
      if (!neigh) continue;
      for (const n of neigh){
        if (remaining.has(n)) batchSet.add(n);
      }
    }

    const batchItems = Array.from(batchSet)
      .map(b => byBarcode[b])
      .filter(Boolean);

    // 4) sort batch by Priority asc, then stable key
    batchItems.sort((a,b)=>{
      const ap = getPri(a);
      const bp = getPri(b);
      if (ap !== bp) return ap - bp;
      return stableCmp(a,b);
    });

    // 5) output + remove
    for (const p of batchItems){
      out.push(p);
      if (p && p._barcode_norm) remaining.delete(p._barcode_norm);
    }
  }

  // Append remaining items by Priority asc
  const leftovers = Array.from(remaining)
    .map(b => byBarcode[b])
    .filter(Boolean);

  leftovers.sort((a,b)=>{
    const ap = getPri(a);
    const bp = getPri(b);
    if (ap !== bp) return ap - bp;
    return stableCmp(a,b);
  });

  out.push(...leftovers);
  return out;
}


function renderProducts(){
  const grid = $("#productGrid");
  grid.innerHTML = "";

  // All tab: compatibility-aware ordering, but keep the normal grid layout.
  if (state.activeCategory === "All"){
    grid.classList.add("grid");
    grid.classList.remove("cat-sections");

    const ordered = allCompatibilityOrderedList();
    for (const p of ordered){
      grid.appendChild(buildProductCard(p));
    }
    return;
  }

  // Other tabs: single grid
  grid.classList.add("grid");
  grid.classList.remove("cat-sections");

  // Single category tab: existing filter behavior
  const list = getFilteredProducts();
  for (const p of list){
    grid.appendChild(buildProductCard(p));
  }
}
function cartQty(barcode){
  return Number(state.cart?.[barcode]?.qty || 0);
}

function stockMsgId(barcode){
  const b = String(barcode || "");
  const safe = b.replace(/[^A-Za-z0-9_-]/g, "_");
  return `stockMsg_${safe}`;
}

function setInlineStockMsg(barcode, message){
  const el = document.getElementById(stockMsgId(barcode));
  if (!el) return;
  if (!message){
    el.textContent = "";
    el.classList.add("hidden");
    return;
  }
  el.textContent = message;
  el.classList.remove("hidden");
}

function validateStockInline(barcode, desiredQty){
  const q = Math.max(1, Number(desiredQty || 1));
  const rem = stockRemaining(barcode);
  if (q > rem){
    const p = getProductByBarcode(barcode);
    const name = getProductDisplayName(p);
    // Uses I18N stockInsufficient(name, q)
    if (I18N[state.lang] && typeof I18N[state.lang].stockInsufficient === "function"){
      return I18N[state.lang].stockInsufficient(name, q);
    }
    return `'${name}': Insufficient Stock (Inputted quantity: ${q})`;
  }
  return "";
}


function giftQtyReserved(barcode){
  // promoGiftSelection is nested: { offerKey: { barcode: qty } }
  let total = 0;
  const all = state.promoGiftSelection || {};
  for (const offerKey of Object.keys(all)){
    const map = all[offerKey] || {};
    total += Number(map[barcode] || 0);
  }
  return total;
}

function stockRemaining(barcode){
  const init = Number(state.stockInitMap?.[barcode] ?? DEFAULT_STOCK);
  const rem = init - cartQty(barcode) - giftQtyReserved(barcode);
  return Math.max(0, rem);
}

function getProductDisplayName(p){
  if (!p) return "Item";
  const kmName = p["Khmer Name"] || p["Khmer"] || p["Name (Khmer)"] || "";
  const enName = p["English Name"] || p["English"] || p["Name (English)"] || "";
  const any = p.Name || p["Product Name"] || "";
  if (state.lang === "km") return String(kmName || enName || any || "Item").trim() || "Item";
  return String(enName || kmName || any || "Item").trim() || "Item";
}

function getProductByBarcode(barcode){
  return state.products.find(p => p._barcode_norm === barcode);
}

function addToCart(barcode, qty){
  if (!barcode) return;

  const q = Math.max(1, Number(qty || 1));
  const msg = validateStockInline(barcode, q);
  if (msg){
    setInlineStockMsg(barcode, msg);
    return;
  }
  setInlineStockMsg(barcode, "");

  const cur = state.cart[barcode]?.qty || 0;
  state.cart[barcode] = { barcode, qty: cur + q };
  saveLocal();
  renderCart();
  renderTotals();
  renderPromoGifts();
  updateInvoiceButton();
  renderOngoingPromotions();
  renderProducts();
}

function removeFromCart(barcode){
  delete state.cart[barcode];
  saveLocal();
  renderCart();
  renderTotals();
  renderPromoGifts();
  updateInvoiceButton();
  renderOngoingPromotions();
  renderProducts();
}

function setCartQty(barcode, qty){
  if (!barcode) return;

  const init = Number(state.stockInitMap?.[barcode] ?? DEFAULT_STOCK);
  const qRaw = Math.max(1, Number(qty || 1));
  const q = Math.min(qRaw, init);

  if (qRaw > init){
    const p = getProductByBarcode(barcode);
    const name = getProductDisplayName(p);
    const t = I18N[state.lang];
    const msg = (t && typeof t.stockInsufficient === "function")
      ? t.stockInsufficient(name, qRaw)
      : `'${name}': Insufficient Stock (Inputted quantity: ${qRaw})`;
    setInlineStockMsg(barcode, msg);
  }

  state.cart[barcode] = { barcode, qty: q };
  saveLocal();
  renderCart();
  renderTotals();
  renderPromoGifts();
  updateInvoiceButton();
  renderOngoingPromotions();
  renderProducts();
}


function computeTotals(){
  let subtotalBase = 0;
  let subtotalDiscounted = 0;

  for (const {barcode, qty} of Object.values(state.cart)){
    const p = getProductByBarcode(barcode);
    if (!p) continue;
    const base = getBasePrice(p);
    const unit = getUnitPrice(p);
    subtotalBase += base * qty;
    subtotalDiscounted += unit * qty;
  }

  const promoDiscount = state.promo.valid ? +(subtotalBase - subtotalDiscounted).toFixed(2) : 0;

  const giftStats = getPromoGiftStats();
  // IMPORTANT:
  // - If free items are provided, they should NOT reduce the payable total.
  //   (They are shown as FREE lines / informational "value" only.)
  // - Only a TRUE stock shortage compensation should reduce the total.
  const shortageDiscount = +( (giftStats.shortageDiscount || 0) ).toFixed(2);

  // Total should start from discounted subtotal (if promo valid, else same as base subtotal)
  let total = +(subtotalDiscounted - shortageDiscount).toFixed(2);
  if (!Number.isFinite(total)) total = 0;
  total = Math.max(0, total);

  return {
    subtotal: +subtotalBase.toFixed(2),
    discount: promoDiscount,
    // Keep fields for UI; free value is displayed separately in renderTotals / invoice.
    giftDiscount: shortageDiscount,
    total
  };
}





function computePromoGiftOffers(){
  // --- Free-gift promotion engine ---
  // IMPORTANT FIX ("nipple triggers bottle" bug):
  // Previous versions processed EVERY "Promotion Type: Free" row in *both* directions:
  //   - As a TRIGGER row (Convention B)
  //   - As a GIFT row (Convention A)
  // If a GIFT row (e.g., Nipple1) listed bottle barcodes as "Promotion Barcode",
  // Convention B mistakenly treated the nipple barcode as the *trigger*, making
  // "buy nipples => get bottles".
  //
  // This version assigns an explicit role per row using a simple heuristic:
  //   - If the row itself is MAIN and its Promotion Barcode points mostly to ACC => TRIGGER row (B)
  //   - If the row itself is ACC and its Promotion Barcode points mostly to MAIN => GIFT row (A)
  //   - Otherwise fall back to majority vote (main vs acc targets)
  // And a hard safety block:
  //   - ACC items are NEVER allowed to be promotion TRIGGERS.
  //     (So nipples/parts cannot trigger free gifts even if the JSON is wrong.)

  const products = state.products || [];
  const offerMap = new Map();

  // Build a quick lookup for product by normalized barcode
  const byBarcode = new Map();
  for (const p of products){
    const bc = normalizeBarcode(p._barcode_norm || p.Barcode);
    if (bc) byBarcode.set(bc, p);
  }

  // addOffer creates/updates an offer bucket.
  // - Default bucketing: per-trigger (single trigger) or group (multiple triggers) based on `isGroup`.
  // - For Convention B we sometimes need to FORCE grouping across multiple trigger rows that share
  //   the same candidate set + promo parameters. Use `forceGroupKey` to do that.
  function addOffer({triggerBarcodes, promoQty, freeQty, triggerProduct, candidateProducts, forceGroupKey=null, forceIsGroup=null}){
    const tbs = (triggerBarcodes || []).map(normalizeBarcode).filter(Boolean);
    const pq = Number(promoQty || 0);
    const fq = Number(freeQty || 0);
    if (!tbs.length || !(pq > 0 && fq > 0)) return;

    const isGroup = (forceIsGroup !== null && forceIsGroup !== undefined)
      ? !!forceIsGroup
      : (tbs.length > 1); // IMPORTANT: pool across multiple eligible trigger SKUs

    const triggerKeyPart = isGroup ? (tbs.slice().sort().join('|')) : tbs[0];
    const key = forceGroupKey
      ? String(forceGroupKey)
      : `${isGroup ? 'GROUP' : 'TRIGGER'}_${triggerKeyPart}__PQ${pq}__FQ${fq}`;

    if (!offerMap.has(key)){
      offerMap.set(key, {
        key,
        isGroup,
        triggerBarcode: isGroup ? '' : tbs[0],
        triggerBarcodes: tbs,
        triggerProduct: triggerProduct || null,
        promoQty: pq,
        freeQty: fq,
        candidates: [],
        candidateBarcodes: []
      });
    }

    const offer = offerMap.get(key);
    if (!offer.triggerProduct && triggerProduct) offer.triggerProduct = triggerProduct;

    // Merge trigger barcodes when multiple trigger rows are bucketed into one offer (Convention B)
    if (isGroup){
      const existing = new Set(offer.triggerBarcodes || []);
      for (const b of tbs){
        if (!existing.has(b)){
          existing.add(b);
          offer.triggerBarcodes.push(b);
        }
      }
    }

    const seen = new Set(offer.candidateBarcodes);
    for (const c of (candidateProducts || [])){
      if (!c) continue;
      const bc = normalizeBarcode(c._barcode_norm || c.Barcode);
      if (!bc || seen.has(bc)) continue;
      seen.add(bc);
      offer.candidateBarcodes.push(bc);
      offer.candidates.push(c);
    }
  }

  function triggerQtyForOffer(offer){
    if (!offer) return 0;
    if (!offer.isGroup){
      return cartQty(offer.triggerBarcode);
    }
    let sum = 0;
    for (const b of (offer.triggerBarcodes || [])) sum += cartQty(b);
    return sum;
  }

  // -----------------------------------------------------------------
  // Free-gift engine (Excel-first)
  //
  // New Excel columns:
  //   - "Free item barcode" (gift candidate barcodes; comma-separated)
  //   - "Free Qualifying purchase quantity" (trigger quantity)
  //   - "Free quantity" (free gift quantity)
  //
  // Legacy columns (kept for backward compatibility):
  //   - "Promotion Type" == "Free"
  //   - "Promotion Barcode" / "Promotion Quantity" / "Free Quantity"
  //
  // Rule here is simple and unambiguous:
  //   - Each qualifying product row is a TRIGGER.
  //   - Its "Free item barcode" lists the allowed gift candidates.
  //   - If multiple trigger rows share the same candidate-set + PQ/FQ, pool them into one offer.
  // -----------------------------------------------------------------
  for (const row of products){
    const rowBarcode = normalizeBarcode(row._barcode_norm || row.Barcode);
    if (!rowBarcode) continue;

    // Prefer Excel fields
    const excelCandList = row['Free item barcode (norm list)']
      ? (Array.isArray(row['Free item barcode (norm list)']) ? row['Free item barcode (norm list)'] : [])
      : parseBarcodeList(row['Free item barcode']);

    const excelPQ = Number(row['Free Qualifying purchase quantity'] || 0);
    const excelFQ = Number(row['Free quantity'] || 0);

    const hasExcelFree = (excelCandList && excelCandList.length) && (excelPQ > 0) && (excelFQ > 0);

    // Fallback to legacy fields if Excel fields are absent
    const legacyIsFree = String(row['Promotion Type'] || '').trim().toLowerCase() === 'free';
    const legacyPQ = Number(row['Promotion Quantity'] || 0);
    const legacyFQ = Number(row['Free Quantity'] || 0);
    const legacyCandList = parseBarcodeList(row['Promotion Barcode']);

    const useExcel = hasExcelFree;
    const promoQty = useExcel ? excelPQ : legacyPQ;
    const freeQty  = useExcel ? excelFQ : legacyFQ;
    const listBarcodes = useExcel ? excelCandList : legacyCandList;

    if (useExcel){
      // ok
    } else {
      if (!legacyIsFree) continue;
    }

    if (!(promoQty > 0 && freeQty > 0)) continue;
    if (!listBarcodes || !listBarcodes.length) continue;

    // Resolve candidate products by barcode
    const giftCandidates = [];
    for (const b of listBarcodes){
      const p = byBarcode.get(normalizeBarcode(b));
      if (p) giftCandidates.push(p);
    }
    if (!giftCandidates.length) continue;

    // Pool triggers that share the same parameters + candidate set
    const candKey = listBarcodes
      .map(normalizeBarcode)
      .filter(Boolean)
      .sort()
      .join('|');

    const pooledKey = `FREE_POOL__CANDS_${candKey}__PQ${promoQty}__FQ${freeQty}`;

    addOffer({
      triggerBarcodes: [rowBarcode],
      promoQty,
      freeQty,
      triggerProduct: row,
      candidateProducts: giftCandidates,
      forceGroupKey: pooledKey,
      forceIsGroup: true
    });
  }

  // Finalize: requiredCount based on cart quantities
  const offers = [];
  for (const offer of offerMap.values()){
    const triggerQty = triggerQtyForOffer(offer);
    const bundles = Math.floor(triggerQty / offer.promoQty);
    const requiredCount = bundles * offer.freeQty;
    if (requiredCount <= 0) continue;
    if (!offer.candidates || offer.candidates.length === 0) continue;

    offers.push({
      ...offer,
      triggerQty,
      requiredCount
    });
  }

  offers.sort((a,b)=>{
    const pa = Number(a.triggerProduct?.Priority || 0);
    const pb = Number(b.triggerProduct?.Priority || 0);
    if (pa != pb) return pa - pb;
    const ka = a.isGroup ? a.triggerBarcodes.join('|') : (a.triggerBarcode || '');
    const kb = b.isGroup ? b.triggerBarcodes.join('|') : (b.triggerBarcode || '');
    return String(ka).localeCompare(String(kb));
  });

  return offers;
}


function getPromoGiftStats(){
  const offers = computePromoGiftOffers();
  const selAll = state.promoGiftSelection || {};

  if (!offers.length){
    return {
      requiredTotal: 0,
      selectedTotal: 0,
      missingTotal: 0,
      providedValue: 0,
      shortageDiscount: 0,
      freeLines: []
    };
  }

  const globalSel = getGiftSelectedByBarcode();

  let requiredTotal = 0;
  let selectedTotal = 0;
  let missingTotal = 0;
  let shortageDiscount = 0;

  for (const offer of offers){
    const selMap = selAll[offer.key] || {};
    const selectedOffer = Object.values(selMap).reduce((a,v)=>a+Number(v||0),0);

    // How many gifts can this offer still claim considering selections in OTHER offers
    let maxPossible = 0;
    for (const cand of offer.candidates){
      const b = cand._barcode_norm;
      const reservedOther = (globalSel[b] || 0) - (Number(selMap[b] || 0));
      const canUse = Math.max(0, baseRemaining(b) - reservedOther);
      maxPossible += canUse;
    }

    const requiredOriginal = Number(offer.requiredCount || 0);
    const effectiveRequired = Math.min(requiredOriginal, maxPossible);
    const shortageCount = Math.max(0, requiredOriginal - effectiveRequired);

    const missingOffer = Math.max(0, effectiveRequired - selectedOffer);

    requiredTotal += effectiveRequired;
    selectedTotal += selectedOffer;
    missingTotal += missingOffer;

    // If we cannot fulfill all gifts due to stock, give a "shortage" discount
    // Valued at the cheapest eligible gift (discounted unit price if promo applied)
    if (shortageCount > 0 && offer.candidates && offer.candidates.length){
      let cheapest = Infinity;
      for (const c of offer.candidates){
        const u = getUnitPrice(c);
        if (Number.isFinite(u) && u < cheapest) cheapest = u;
      }
      if (Number.isFinite(cheapest) && cheapest < Infinity){
        shortageDiscount += shortageCount * cheapest;
      }
    }
  }

  // Free lines + provided value (sum over all selected gift items)
  const freeLines = [];
  let providedValue = 0;
  for (const [b, q] of Object.entries(globalSel)){
    const qty = Number(q || 0);
    if (qty <= 0) continue;
    const p = getProductByBarcode(b);
    if (!p) continue;
    freeLines.push({ p, qty });
    providedValue += qty * getUnitPrice(p);
  }

  freeLines.sort((a,b)=> String(getName(a.p)).localeCompare(String(getName(b.p))));

  return {
    requiredTotal,
    selectedTotal,
    missingTotal,
    providedValue: +providedValue.toFixed(2),
    shortageDiscount: +shortageDiscount.toFixed(2),
    freeLines
  };
}






function autoSyncPromoGifts(){
  // Keep selections VALID and within bounds, without silently auto-filling.
  // - If required decreases, remove excess.
  // - If stock decreases / conflicts across offers, clamp.

  const offers = computePromoGiftOffers();
  if (!offers || offers.length === 0) return;
  if (!state.promoGiftSelection) state.promoGiftSelection = {};

  const globalSel = getGiftSelectedByBarcode();

  function effectiveRequiredForOffer(offer, selMap){
    let maxPossible = 0;
    for (const cand of (offer.candidates || [])){
      const b = cand._barcode_norm;
      const reservedOther = (globalSel[b] || 0) - Number(selMap[b] || 0);
      const canUse = Math.max(0, baseRemaining(b) - reservedOther);
      maxPossible += canUse;
    }
    const requiredOriginal = Number(offer.requiredCount || 0);
    return Math.min(requiredOriginal, maxPossible);
  }

  // 1) Clamp per-offer selections to stock and candidate set
  for (const offer of offers){
    if (!offer || !offer.key) continue;
    if (!state.promoGiftSelection[offer.key]) state.promoGiftSelection[offer.key] = {};

    const sel = state.promoGiftSelection[offer.key];
    const candSet = new Set((offer.candidates || []).map(c => c && c._barcode_norm).filter(Boolean));

    for (const b of Object.keys(sel)){
      if (!candSet.has(b)) { delete sel[b]; continue; }
      const q = Number(sel[b] || 0);
      if (!Number.isFinite(q) || q <= 0) { delete sel[b]; continue; }

      const max = baseRemaining(b);
      if (q > max) sel[b] = max;
      if (Number(sel[b] || 0) <= 0) delete sel[b];
    }
  }

  // Refresh global after clamps
  const globalAfterClamp = getGiftSelectedByBarcode();

  // 2) If any offer exceeds its effective required, remove excess (largest qty first)
  for (const offer of offers){
    if (!offer || !offer.key) continue;
    const sel = state.promoGiftSelection[offer.key] || {};

    // compute effective required with the *current* global reservations
    const effectiveRequired = effectiveRequiredForOffer(offer, sel);

    const selectedTotal = Object.values(sel).reduce((a,v)=>a+Number(v||0),0);
    if (selectedTotal <= effectiveRequired) continue;

    let excess = selectedTotal - effectiveRequired;
    const sorted = Object.entries(sel).sort((a,b)=>Number(b[1]||0)-Number(a[1]||0));

    for (const [b, qRaw] of sorted){
      if (excess <= 0) break;
      const q = Number(qRaw || 0);
      if (q <= 0) continue;
      const dec = Math.min(excess, q);
      const next = q - dec;
      if (next <= 0) delete sel[b];
      else sel[b] = next;
      excess -= dec;
    }
  }
}




function prunePromoGiftSelection(){
  // Prevent "phantom" free-item value/stock reservations from stale selections
  // (e.g., user previously selected a free gift from a different promo, then changed the cart)
  const offers = computePromoGiftOffers();
  const keySet = new Set((offers || []).map(o => o && o.key).filter(Boolean));

  if (!state.promoGiftSelection) state.promoGiftSelection = {};

  // Drop offer-keys that are no longer active
  for (const k of Object.keys(state.promoGiftSelection)){
    if (!keySet.has(k)) delete state.promoGiftSelection[k];
  }

  // Drop barcodes that are not candidates for the active offer
  for (const offer of (offers || [])){
    if (!offer || !offer.key) continue;
    const sel = state.promoGiftSelection[offer.key];
    if (!sel) continue;
    const candSet = new Set((offer.candidates || []).map(c => c && c._barcode_norm).filter(Boolean));

    for (const b of Object.keys(sel)){
      if (!candSet.has(b)) { delete sel[b]; continue; }
      const q = Number(sel[b] || 0);
      if (!Number.isFinite(q) || q <= 0) { delete sel[b]; continue; }
      // Clamp to remaining stock (cart already consumes stock; cross-offer clamping handled by autoSync)
      const max = baseRemaining(b);
      if (q > max) sel[b] = max;
      if (Number(sel[b] || 0) <= 0) delete sel[b];
    }
  }
}
function canGenerateInvoice(){
  const hasItems = Object.values(state.cart).length > 0;
  if (!hasItems) return false;

  const stats = getPromoGiftStats();
  // Require user to select all gifts that are feasible (effectiveRequired).
  return (stats.missingTotal || 0) <= 0;
}


function updateInvoiceButton(){
  const ok = canGenerateInvoice();
  const btn = document.getElementById('invoiceBtn');
  const foot = document.getElementById('invoiceFootnote');
  if (btn) btn.disabled = !ok;
  if (foot) foot.textContent = ok ? '' : (I18N[state.lang]?.promoGiftMustSelect || '');
}



function renderPromoGifts(){
  const section = qs('#promoGiftSection');
  const list = qs('#promoGiftList');
  const hint = qs('#promoGiftHint');
  if(!section || !list) return;

  const offers = computePromoGiftOffers();
  if(offers.length===0){
    section.classList.add('hidden');
    list.innerHTML = '';
    if (hint) hint.textContent = '';
    return;
  }

  if(!state.promoGiftSelection) state.promoGiftSelection = {};

  section.classList.remove('hidden');

  const lang = state.lang || 'en';
  const t = (k)=> (I18N[lang] && I18N[lang][k]) ? I18N[lang][k] : k;

  function nameOf(p){
    return (lang==='km') ? (p['Name(KH.)']||p['Name(EN.)']||'') : (p['Name(EN.)']||p['Name(KH.)']||'');
  }

  // Global selected qty by barcode across ALL offers
  const globalSel = getGiftSelectedByBarcode();

  // Build offer stats (effectiveRequired is still computed per-offer)
  const offerStats = offers.map(offer=>{
    const sel = state.promoGiftSelection[offer.key] || {};
    const selectedTotal = Object.values(sel).reduce((a,v)=>a+Number(v||0),0);

    let maxPossible = 0;
    for (const cand of offer.candidates){
      const b = cand._barcode_norm;
      const reservedOther = (globalSel[b] || 0) - (Number(sel[b] || 0));
      maxPossible += Math.max(0, baseRemaining(b) - reservedOther);
    }

    const requiredOriginal = Number(offer.requiredCount || 0);
    const effectiveRequired = Math.min(requiredOriginal, maxPossible);
    const left = Math.max(0, effectiveRequired - selectedTotal);

    return { offer, sel, selectedTotal, effectiveRequired, left };
  });

  const requiredTotal = offerStats.reduce((a,s)=>a+Number(s.effectiveRequired||0),0);
  const selectedTotal = Object.values(globalSel).reduce((a,v)=>a+Number(v||0),0);
  const leftTotal = Math.max(0, requiredTotal - selectedTotal);

  // Union candidate list across all offers (barcode -> product)
  const candMap = new Map();
  for (const os of offerStats){
    for (const c of (os.offer.candidates || [])){
      const b = c._barcode_norm;
      if (!b) continue;
      if (!candMap.has(b)) candMap.set(b, c);
    }
  }

  // Build option HTML (disable when remaining stock is 0)
  let firstEnabled = null;
  const optionsHtml = Array.from(candMap.entries())
    .sort((a,b)=> String(nameOf(a[1])).localeCompare(String(nameOf(b[1]))))
    .map(([b, c])=>{
      const remain = Math.max(0, baseRemaining(b) - (globalSel[b] || 0));
      const price = money(Number(c['Retail Price ($)']||0));
      const out = (remain <= 0);
      if (!out && !firstEnabled) firstEnabled = b;

      // If out of stock, show a reason in the label (instead of only disabled)
      const label = `${escapeHtml(nameOf(c))} ($${price})${out ? ` — ${escapeHtml(t('stockOut'))}` : ''}`;
      return `<option value="${b}" ${out?'disabled':''}>${label}</option>`;
    }).join('');

  const optionsFinalHtml = firstEnabled
    ? optionsHtml.replace(new RegExp(`value=\\"${firstEnabled}\\"`), `value=\"${firstEnabled}\" selected`)
    : `<option value="" disabled selected>${escapeHtml(t('stockOut'))}</option>` + optionsHtml;

  // Selected rows (aggregate by barcode across all offers)
  const selectedRows = Array.from(Object.entries(globalSel))
    .filter(([,q])=>Number(q||0) > 0)
    .map(([b, qRaw])=>{
      const p = getProductByBarcode(b);
      if (!p) return '';
      const q = Number(qRaw || 0);
      const price = money(Number(p['Retail Price ($)']||0));
      return `
        <div class="promo-gift-row">
          <div class="promo-gift-row-left">
            <div class="promo-gift-name">${escapeHtml(nameOf(p))}</div>
            <div class="promo-gift-meta">${t('promoGiftQty')}: <b>${q}</b> • <span class="strike">$${price}</span> <b>FREE</b></div>
          </div>
          <button class="btn btn-sm promoGiftRemoveUnifiedBtn" data-barcode="${b}">${t('promoGiftRemove')}</button>
        </div>
      `;
    }).join('');

  list.innerHTML = `
    <div class="promo-gift-block">
      <div class="promo-gift-header">
        <div class="promo-gift-title">${t('promoGiftTitle')}</div>
        <div class="promo-gift-sub">${t('promoGiftSelected')}: <b>${selectedTotal}</b> / ${requiredTotal} (${t('promoGiftNeed')} ${leftTotal} ${t('promoGiftLeft')})</div>
      </div>

      <div class="promo-gift-picker">
        <label class="promo-gift-label">${t('promoGiftSelect')}</label>
        <select class="promoGiftSelectUnified">${optionsFinalHtml}</select>

        <label class="promo-gift-label">${t('promoGiftQty')}</label>
        <div class="qty-pill promoGiftQtyPill">
          <button class="small-btn promoGiftQtyMinusUnified" type="button">−</button>
          <input class="promoGiftQtyUnified" type="number" min="1" step="1" inputmode="numeric" pattern="[0-9]*" value="1" />
          <button class="small-btn promoGiftQtyPlusUnified" type="button">+</button>
        </div>

        <button class="btn promoGiftAddUnifiedBtn">${t('promoGiftAdd')}</button>
      </div>

      <div class="promo-gift-selected">
        ${selectedRows || `<div class="muted">${typeof t('promoGiftHint')==='function' ? t('promoGiftHint')(leftTotal || 1) : t('promoGiftHint')}</div>`}
      </div>
    </div>
  `;

  // Global hint (below the list)
  const stats = getPromoGiftStats();
  if (hint){
    if ((stats.missingTotal || 0) > 0){
      hint.textContent = (I18N[state.lang] && typeof I18N[state.lang].promoGiftHint === 'function')
        ? I18N[state.lang].promoGiftHint(stats.missingTotal)
        : '';
    } else {
      hint.textContent = '';
    }
  }

  // --- Event wiring (unified) ---

  function allocateGift(barcode, qty){
    let remainingQty = Math.max(0, Number(qty || 0));
    if (!barcode || remainingQty <= 0) return 0;

    // temp view of global reservations as we allocate
    const tempGlobal = { ...getGiftSelectedByBarcode() };

    let allocatedTotal = 0;

    // Allocate into offers that accept this barcode and still need items
    for (const os of offerStats){
      if (remainingQty <= 0) break;
      if ((os.left || 0) <= 0) continue;

      const accepts = (os.offer.candidates || []).some(c => c && c._barcode_norm === barcode);
      if (!accepts) continue;

      const remainForBarcode = Math.max(0, baseRemaining(barcode) - (tempGlobal[barcode] || 0));
      if (remainForBarcode <= 0) break;

      const canAdd = Math.min(remainingQty, os.left, remainForBarcode);
      if (canAdd <= 0) continue;

      if(!state.promoGiftSelection[os.offer.key]) state.promoGiftSelection[os.offer.key] = {};
      const sel = state.promoGiftSelection[os.offer.key];
      sel[barcode] = Number(sel[barcode] || 0) + canAdd;

      tempGlobal[barcode] = (tempGlobal[barcode] || 0) + canAdd;
      remainingQty -= canAdd;
      allocatedTotal += canAdd;
    }

    return allocatedTotal;
  }

  const addBtn = qs('.promoGiftAddUnifiedBtn', list);
  if (addBtn){
    addBtn.addEventListener('click', ()=>{
      const select = qs('.promoGiftSelectUnified', list);
      const qtyEl = qs('.promoGiftQtyUnified', list);
      if(!select || !qtyEl) return;
      const b = select.value;
      let q = Number(qtyEl.value||0);
      if(!b || !Number.isFinite(q) || q<=0) return;

      // Recompute offers fresh on click (cart might have changed)
      prunePromoGiftSelection();

      const allocated = allocateGift(b, q);
      if (allocated > 0){
        renderAll();
      }
    });
  }

  const minusBtn = qs('.promoGiftQtyMinusUnified', list);
  if (minusBtn){
    minusBtn.addEventListener('click', ()=>{
      const qtyEl = qs('.promoGiftQtyUnified', list);
      if (!qtyEl) return;
      const cur = Math.max(1, Number(qtyEl.value || 1));
      qtyEl.value = String(Math.max(1, cur - 1));
    });
  }

  const plusBtn = qs('.promoGiftQtyPlusUnified', list);
  if (plusBtn){
    plusBtn.addEventListener('click', ()=>{
      const qtyEl = qs('.promoGiftQtyUnified', list);
      if (!qtyEl) return;
      const cur = Math.max(1, Number(qtyEl.value || 1));
      qtyEl.value = String(cur + 1);
    });
  }

  qsa('.promoGiftRemoveUnifiedBtn', list).forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const b = btn.getAttribute('data-barcode');
      if(!b) return;
      if(!state.promoGiftSelection) return;

      // Remove this gift barcode from ALL offers
      for (const k of Object.keys(state.promoGiftSelection)){
        if (state.promoGiftSelection[k] && state.promoGiftSelection[k][b] !== undefined){
          delete state.promoGiftSelection[k][b];
        }
      }
      renderAll();
    });
  });
}




function renderCart(){

  const wrap = $("#cartItems");
  wrap.innerHTML = "";

  const entries = Object.values(state.cart);
  if (!entries.length){
    wrap.innerHTML = `<div style="color:rgba(0,0,0,.35);font-size:12px;padding:8px 2px">—</div>`;
    // no cart items => no promo gifts
    if ($("#promoGiftSection")) $("#promoGiftSection").classList.add("hidden");
    $("#invoiceBtn").disabled = true;
    $("#invoiceFootnote").textContent = "";
    return;
  }

  for (const {barcode, qty} of entries){
    const p = getProductByBarcode(barcode);
    if (!p) continue;

    const item = document.createElement("div");
    item.className = "cart-item";

    const top = document.createElement("div");
    top.className = "top";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="name">${escapeHtml(getName(p))}</div>
      <div class="sub">${escapeHtml(categoryLabel(String(p.Category || "")))}${(p["Main/Acc. Item"]?` · ${escapeHtml(String(p["Main/Acc. Item"]))}`:"")}</div>
    `;

    const right = document.createElement("div");
    right.innerHTML = `<div class="lineTotal">$${money(getUnitPrice(p) * qty)}</div>`;

    top.appendChild(left);
    top.appendChild(right);

    const controls = document.createElement("div");
    controls.className = "controls";

    const qtyCtl = document.createElement("div");
    qtyCtl.className = "qty-pill";
    const minus = document.createElement("button");
    minus.className = "small-btn";
    minus.textContent = "−";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.value = String(qty);
    const plus = document.createElement("button");
    plus.className = "small-btn";
    plus.textContent = "+";
    minus.onclick = () => setCartQty(barcode, Math.max(1, Number(input.value||1) - 1));
    plus.onclick  = () => setCartQty(barcode, Math.max(1, Number(input.value||1) + 1));
    input.onchange = () => setCartQty(barcode, Math.max(1, Number(input.value||1)));
    qtyCtl.appendChild(minus);
    qtyCtl.appendChild(input);
    qtyCtl.appendChild(plus);

    const remove = document.createElement("button");
    remove.className = "btn btn-ghost";
    remove.textContent = I18N[state.lang].remove;
    remove.onclick = () => removeFromCart(barcode);

    controls.appendChild(qtyCtl);
    controls.appendChild(remove);

    item.appendChild(top);
    item.appendChild(controls);
    wrap.appendChild(item);
  }
}


function renderTotals(){
  const t = computeTotals();

  $("#subtotalValue").textContent = `$${money(t.subtotal)}`;
  $("#totalValue").textContent = `$${money(t.total)}`;

  const discountRow = $("#discountRow");
  const freeRow = $("#freeItemRow");
  const shortageRow = $("#shortageRow");

  const pct = Math.round((state.promo.discountRate || 0.10) * 100);
  $("#discountLabel").textContent = `${I18N[state.lang].discount} (${pct}%)`;

  if (state.promo.valid && t.discount > 0){
    discountRow.style.display = "";
    $("#discountValue").textContent = `- $${money(t.discount)}`;
  } else {
    discountRow.style.display = "none";
    $("#discountValue").textContent = "";
  }

  // Free-gift promo breakdown (independent of promo-code discount)
  const giftStats = getPromoGiftStats();
  const freeValue = giftStats.providedValue || 0;
  const shortageValue = giftStats.shortageDiscount || 0;
  const hasOffers = (computePromoGiftOffers().length > 0);

  if (freeRow){
    // Always show 0 while an active free-gift offer exists; avoid showing stale values.
    if (hasOffers || freeValue > 0){
      freeRow.style.display = "";
      $("#freeItemLabel").textContent = I18N[state.lang].freeItemDiscount;
      if (freeValue > 0){
        // Display "was $X, now $0" (informational only)
        $("#freeItemValue").innerHTML = `<span class="strike">$${money(freeValue)}</span> $0.00`;
      } else {
        $("#freeItemValue").textContent = "$0.00";
      }
    } else {
      freeRow.style.display = "none";
      $("#freeItemValue").textContent = "";
    }
  }

  if (shortageRow){
    if (shortageValue > 0){
      shortageRow.style.display = "";
      $("#shortageLabel").textContent = I18N[state.lang].shortageDiscount;
      $("#shortageValue").textContent = `- $${money(shortageValue)}`;
    } else {
      shortageRow.style.display = "none";
      $("#shortageValue").textContent = "";
    }
  }
}


function renderTexts(){
  const t = I18N[state.lang];
  $("#brandSub").textContent = t.brandSub;
  $("#promoLabel").textContent = t.promoLabel;
  $("#promoInput").placeholder = t.promoPlaceholder;
  $("#promoApplyBtn").textContent = t.promoApply;
  $("#promoClearBtn").textContent = t.promoClear;

  const ot = $("#ongoingTitle"); if (ot) ot.textContent = t.ongoingTitle;

  $("#orderTitle").textContent = t.orderTitle;
  $("#orderDateLabel").textContent = t.orderDateLabel;
  $("#orderNoLabel").textContent = t.orderNoLabel;
  $("#customerNameLabel").textContent = t.customerNameLabel;
  $("#customerContactLabel").textContent = t.customerContactLabel;
  $("#customerAddressLabel").textContent = t.customerAddressLabel;
  // One-line input placeholders (optional)
  const n = $("#customerNameInput"); if (n) n.placeholder = t.customerNameLabel;
  const c = $("#customerContactInput"); if (c) c.placeholder = t.customerContactLabel;
  const a = $("#customerAddressInput"); if (a) a.placeholder = t.customerAddressLabel;

  $("#orderHint").textContent = t.orderHint;

  $("#productsTitle").textContent = t.productsTitle;
  $("#cartTitle").textContent = t.cartTitle;
  $("#promoGiftTitle").textContent = t.promoGiftTitle;
  $("#clearCartBtn").textContent = t.clearCart;
  $("#subtotalLabel").textContent = t.subtotal;
  $("#totalLabel").textContent = t.total;
  const fi = $("#freeItemLabel"); if (fi) fi.textContent = t.freeItemDiscount;
  const sh = $("#shortageLabel"); if (sh) sh.textContent = t.shortageDiscount;
  $("#invoiceBtn").textContent = t.invoiceBtn;
  $("#cartNote").textContent = t.cartNote;

  $("#invoiceTitle").textContent = t.invoiceTitle;
  $("#invPromoNameLabel").textContent = t.invPromoName;
  $("#invTelegramLabel").textContent = t.invTelegram;
  $("#invPromoCodeLabel").textContent = t.invPromoCode;
  $("#invOrderNoLabel").textContent = t.invOrderNo;
  $("#invOrderDateLabel").textContent = t.invOrderDate;
  $("#invCustomerLabel").textContent = t.invCustomer;

  $("#thItem").textContent = t.thItem;
  $("#thQty").textContent = t.thQty;
  $("#thUnit").textContent = t.thUnit;
  $("#thLine").textContent = t.thLine;

  $("#tfSubtotal").textContent = t.tfSubtotal;
  $("#tfDiscount").textContent = t.tfDiscount;
  $("#tfTotal").textContent = t.tfTotal;
  $("#invoiceFootnote").textContent = t.invoiceFootnote;

  $("#printBtn").textContent = t.print;
  $("#downloadPdfBtn").textContent = t.downloadPdf;

  // Payment QR section
  const payQrTitleEl = document.getElementById("payQrTitle");
  if (payQrTitleEl) payQrTitleEl.textContent = t.payQrTitle;
  const downloadQrImgBtn = document.getElementById("downloadQrImgBtn");
  if (downloadQrImgBtn) downloadQrImgBtn.textContent = t.payQrDownload;
  $("#langToggle").textContent = t.languageBtn;

  // partners section title + toggle
  const pt = $("#partnersTitle");
  if (pt) pt.textContent = t.partnersTitle || "Moyuum Official Partners";

  const pToggle = $("#partnersToggle");
  if (pToggle){
    pToggle.textContent = state.partnersExpanded ? (t.partnersHide || "Hide") : (t.partnersView || "View");
  }

  document.documentElement.lang = (state.lang === "km" ? "km" : "en");
}

function applyPromoFromInput(){
  const input = $("#promoInput");
  const code = String(input.value || "").trim();
  state.promo.codeRaw = code;

  const meta = $("#promoMeta");
  const hint = $("#promoHint");

  if (!code){
    state.promo.valid = false;
    state.promo.promoObj = null;
    state.promo.discountRate = 0.10;
    meta.innerHTML = "";
    hint.textContent = "";
    saveLocal();
    renderAll();
    return;
  }

  const found = (state.promos || []).find(x =>
    String(x["Promotion Code"] || "").trim().toLowerCase() === code.toLowerCase()
  );

  if (found){
    state.promo.valid = true;
    state.promo.promoObj = found;
    state.promo.discountRate = parseDiscountRate(found);
    const pct = Math.round(state.promo.discountRate * 100);
    meta.innerHTML = I18N[state.lang].promoValid(found["Promotion Name"] || "N/A", found["Telegram Contact"] || "N/A", pct);
    hint.textContent = "";
  } else {
    state.promo.valid = false;
    state.promo.promoObj = null;
    state.promo.discountRate = 0.10;
    meta.innerHTML = "";
    hint.textContent = I18N[state.lang].promoInvalid;
  }

  saveLocal();
  renderAll();
}


function linkifyPromoMeta(){
  // If promo is valid, make the Telegram part clickable when possible.
  if (!state.promo.valid || !state.promo.promoObj) return;
  const tg = state.promo.promoObj["Telegram Contact"] || "N/A";
  const href = telegramUrl(tg);
  if (!href) return;

  const meta = $("#promoMeta");
  // Replace the first occurrence of the telegram text inside <b>...</b> with a link.
  const safeTg = escapeHtml(tg);
  meta.innerHTML = meta.innerHTML.replace(
    new RegExp(`<b>${safeTg}<\/b>`),
    `<a href="${href}" target="_blank" rel="noopener noreferrer"><b>${safeTg}</b></a>`
  );
}



function renderOngoingPromotions(){
  const t = I18N[state.lang];

  const titleEl = document.getElementById("ongoingTitle");
  if (titleEl) titleEl.textContent = t.ongoingTitle;

  const selectEl = document.getElementById("ongoingSelect");
  const displayEl = document.getElementById("ongoingDisplay");
  const legacyListEl = document.getElementById("ongoingList");

  const promos = Array.isArray(state.ongoingPromotions) ? state.ongoingPromotions : [];

  // Fallback: if the new UI is not present (older HTML), render the legacy list UI.
  if (!selectEl || !displayEl){
    if (!legacyListEl) return;
    legacyListEl.innerHTML = "";
    if (promos.length === 0){
      const p = document.createElement("div");
      p.className = "ongoing-empty";
      p.textContent = t.noOngoingPromotion;
      legacyListEl.appendChild(p);
      return;
    }
    for (const pr of promos){
      const item = document.createElement("div");
      item.className = "ongoing-item";

      const imgWrap = document.createElement("div");
      imgWrap.className = "ongoing-img";
      const img = document.createElement("img");
      img.loading = "lazy";
      const src = pr["Img Src."] || pr.Image1 || pr.Image2 || "";
      img.src = src;
      img.alt = (state.lang === "km") ? (pr["Name(KH.)"] || pr.km || "Promotion") : (pr["Name(EN.)"] || pr.en || "Promotion");
      img.onerror = () => { imgWrap.innerHTML = "<div class='ongoing-img-fallback'>No image</div>"; };
      if (src) imgWrap.appendChild(img);
      else imgWrap.innerHTML = "<div class='ongoing-img-fallback'>No image</div>";

      const body = document.createElement("div");
      body.className = "ongoing-body";
      const textEl = document.createElement("div");
      textEl.className = "ongoing-text";
      const kmText = pr["Name(KH.)"] || pr.km || pr.title_km || pr.titleKm || pr.title || "";
      const enText = pr["Name(EN.)"] || pr.en || pr.title_en || pr.titleEn || pr.title || "";
      textEl.textContent = (state.lang === "km") ? (kmText || enText) : (enText || kmText);
      body.appendChild(textEl);
      item.appendChild(imgWrap);
      item.appendChild(body);
      legacyListEl.appendChild(item);
    }
    return;
  }

  // New UI: dropdown selector + big image view
  const getTexts = (pr) => {
    const kmText = pr["Name(KH.)"] || pr.km || pr.title_km || pr.titleKm || pr.title || "";
    const enText = pr["Name(EN.)"] || pr.en || pr.title_en || pr.titleEn || pr.title || "";
    return { kmText, enText };
  };

  const renderEmpty = () => {
    selectEl.innerHTML = "";
    selectEl.disabled = true;
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = t.noOngoingPromotion;
    selectEl.appendChild(opt);

    displayEl.innerHTML = "<div class='ongoing-empty'>" + escapeHtml(t.noOngoingPromotion) + "</div>";
  };

  const renderSelected = (idx) => {
    const pr = promos[idx];
    if (!pr){
      displayEl.innerHTML = "<div class='ongoing-empty'>" + escapeHtml(t.noOngoingPromotion) + "</div>";
      return;
    }

    const { kmText, enText } = getTexts(pr);
    const primary = (state.lang === "km") ? (kmText || enText) : (enText || kmText);
    const secondary = (state.lang === "km") ? (enText || "") : (kmText || "");
    const src = pr["Img Src."] || pr.Image1 || pr.Image2 || pr.image || pr.imageUrl || "";

    // Build DOM (avoid innerHTML for image error handling)
    displayEl.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "ongoing-display";

    if (src){
      const img = document.createElement("img");
      img.className = "ongoing-display-img";
      img.loading = "lazy";
      img.src = src;
      img.alt = primary || "Promotion";
      img.onerror = () => {
        img.remove();
        const fb = document.createElement("div");
        fb.className = "ongoing-img-fallback";
        fb.textContent = "No image";
        wrapper.prepend(fb);
      };
      wrapper.appendChild(img);
    } else {
      const fb = document.createElement("div");
      fb.className = "ongoing-img-fallback";
      fb.textContent = "No image";
      wrapper.appendChild(fb);
    }

    const body = document.createElement("div");
    body.className = "ongoing-display-body";

    const title = document.createElement("div");
    title.className = "ongoing-display-title";
    title.textContent = primary || "Promotion";

    body.appendChild(title);

    if (secondary && secondary !== primary){
      const sub = document.createElement("div");
      sub.className = "ongoing-display-subtitle";
      sub.textContent = secondary;
      body.appendChild(sub);
    }

    wrapper.appendChild(body);
    displayEl.appendChild(wrapper);
  };

  if (promos.length === 0){
    renderEmpty();
    if (legacyListEl) legacyListEl.innerHTML = "";
    return;
  }

  // Populate select options
  selectEl.disabled = false;
  selectEl.innerHTML = "";

  for (let i = 0; i < promos.length; i++){
    const pr = promos[i];
    const { kmText, enText } = getTexts(pr);
    const label = (state.lang === "km") ? (kmText || enText) : (enText || kmText);
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = label || (t.ongoingSelectPlaceholder || "Promotion");
    selectEl.appendChild(opt);
  }

  // Clamp selection
  let idx = Number.isFinite(state.ongoingSelectedIndex) ? state.ongoingSelectedIndex : 0;
  idx = Math.max(0, Math.min(promos.length - 1, idx));
  state.ongoingSelectedIndex = idx;
  selectEl.value = String(idx);

  // Bind once
  if (!selectEl.__boundOngoingChange){
    selectEl.addEventListener("change", () => {
      const next = parseInt(selectEl.value, 10);
      state.ongoingSelectedIndex = Number.isFinite(next) ? next : 0;
      renderOngoingPromotions();
    });
    selectEl.__boundOngoingChange = true;
  }

  renderSelected(idx);

  // If legacy list exists, keep it empty to avoid duplicated UI.
  if (legacyListEl) legacyListEl.innerHTML = "";
}

// ------------------------------
// Moyuum Official Partners (Below Cart)
// ------------------------------
function buildPartnersFilterOptions(){
  const sel = $("#partnersFilter");
  if (!sel) return;
  const t = I18N[state.lang];

  // Keep current value if possible
  const prev = sel.value || state.partnersFilter || "all";
  sel.innerHTML = "";

  const addOpt = (value, label) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    sel.appendChild(o);
  };

  addOpt("all", t.partnersFilterAll || "All partners");
  addOpt("pp", t.partnersFilterPP || "Phnom Penh");
  addOpt("prov", t.partnersFilterProv || "Provinces");

  if (["all","pp","prov"].includes(prev)){
    sel.value = prev;
    state.partnersFilter = prev;
  } else {
    sel.value = "all";
    state.partnersFilter = "all";
  }

  if (!sel.__boundPartnersChange){
    sel.addEventListener("change", () => {
      state.partnersFilter = sel.value || "all";
      renderPartners();
    });
    sel.__boundPartnersChange = true;
  }
}


function getPartnerLatLng(partner){
  // Prefer explicit Lat/Lng fields (added to official_partners.json)
  const latRaw = partner && (partner["Lat"] ?? partner["lat"]);
  const lngRaw = partner && (partner["Lng"] ?? partner["lng"]);

  const lat = parseFloat(String(latRaw ?? "").trim());
  const lng = parseFloat(String(lngRaw ?? "").trim());
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };

  // Fallback: try to extract coordinates from a full Google Maps URL (not short maps.app.goo.gl)
  const raw = String((partner && partner["Google map"]) || "").trim();
  if (!raw) return null;

  // Example: .../@11.5564,104.9282,17z
  let m = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  // Example: ...?q=11.5564,104.9282  or  ...?query=11.5564,104.9282
  m = raw.match(/[?&](?:q|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };

  return null;
}


function buildPartnersEmbedUrl(partner){
  // Use a safe embed URL so it works without API keys.
  // If Lat/Lng exists, use it for accurate pin placement (no search ambiguity).
  const ll = getPartnerLatLng(partner);
  if (ll){
    const z = 17;
    return `https://www.google.com/maps?q=${ll.lat},${ll.lng}&z=${z}&output=embed`;
  }

  // Fallback: build a search query
  const shop = String(partner["Shop Name"] || "").trim();
  const loc1 = String(partner[state.lang === "km" ? "Location1_KH" : "Location1_EN"] || "").trim();
  const loc2 = String(partner[state.lang === "km" ? "Location2_KH" : "Location2_EN"] || "").trim();
  const q = [shop, loc2, loc1, "Cambodia"].filter(Boolean).join(" ");
  const enc = encodeURIComponent(q);
  return `https://www.google.com/maps?q=${enc}&output=embed`;
}

function openPartnersMap(partner){
  const raw = String(partner["Google map"] || "").trim();
  const ll = getPartnerLatLng(partner);

  // Prefer Lat/Lng when available for zero-ambiguity pin location
  const directLink = ll ? `https://www.google.com/maps/search/?api=1&query=${ll.lat},${ll.lng}` : "";

  // Mobile: opening Google Maps in a new tab / native app is much more reliable
  // than iframe embedding (iframe is frequently blocked or hard to use on mobile).
  const isMobile = (
    (window.matchMedia && window.matchMedia("(max-width: 640px)").matches) ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(String(navigator.userAgent || ""))
  );
  if (isMobile){
    const fallbackSearch = (() => {
      const shop = String(partner["Shop Name"] || "").trim();
      const loc1 = String(partner["Location1_EN"] || "").trim();
      const loc2 = String(partner["Location2_EN"] || "").trim();
      const q = [shop, loc2, loc1, "Cambodia"].filter(Boolean).join(" ");
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    })();

    // Priority: direct lat/lng -> raw link -> search fallback
    const url = directLink || raw || fallbackSearch;
    try{ window.open(url, "_blank", "noopener"); }catch(_){ window.location.href = url; }
    return;
  }

  const modal = $("#partnersMapModal");
  const frame = $("#partnersMapFrame");
  const link = $("#partnersMapOpenLink");
  if (!modal || !frame) return;

  frame.src = buildPartnersEmbedUrl(partner);

  // "Open in Google Maps" link
  const linkUrl = directLink || raw;
  if (link){
    link.href = linkUrl || "#";
    link.style.display = linkUrl ? "inline-flex" : "none";
  }

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closePartnersMap(){
  const modal = $("#partnersMapModal");
  const frame = $("#partnersMapFrame");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
  if (frame) frame.src = "";
}

function renderPartners(){
  const t = I18N[state.lang] || I18N.en;

  const filterSel = $("#partnersFilter");
  const toggleBtn = $("#partnersToggle");
  const bodyWrap = $("#partnersBody");
  const list = $("#partnersList");
  const empty = $("#partnersEmpty");

  if (!filterSel || !list || !empty){
    return;
  }

  // Bind dropdown change once
  if (!filterSel._bound){
    filterSel.addEventListener("change", () => {
      state.partnersFilter = filterSel.value;
      renderPartners();
    });
    filterSel._bound = true;
  }

  // Build dropdown options every render (so labels follow current language)
  const opts = [
    { value: "all", label: (t.partnersFilterAll || "All partners") },
    { value: "pp", label: (t.partnersFilterPP || "Phnom Penh") },
    { value: "prov", label: (t.partnersFilterProv || "Provinces") },
  ];
  filterSel.innerHTML = "";
  for (const o of opts){
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.label;
    filterSel.appendChild(opt);
  }
  filterSel.value = state.partnersFilter || "all";

  // Bind expand/collapse once
  if (toggleBtn && !toggleBtn._bound){
    toggleBtn.addEventListener("click", () => {
      state.partnersExpanded = !state.partnersExpanded;
      renderTexts();
      renderPartners();
    });
    toggleBtn._bound = true;
  }

  if (bodyWrap){
    bodyWrap.classList.toggle("collapsed", !state.partnersExpanded);
  }

  // Don’t render heavy content unless user chose to view
  if (!state.partnersExpanded){
    list.innerHTML = "";
    empty.textContent = "";
    return;
  }

  list.innerHTML = "";
  empty.textContent = "";

  const partners = Array.isArray(state.partners) ? state.partners : [];
  if (partners.length === 0){
    empty.textContent = (t.partnersNoData || "No promotion at this time");
    return;
  }

  // Filter
  let filtered = partners.slice();
  const norm = (s) => String(s || "").trim().toLowerCase();
  if ((state.partnersFilter || "all") === "pp"){
    filtered = filtered.filter(p => norm(p.Location1_EN) === "phnom penh");
  } else if ((state.partnersFilter || "all") === "prov"){
    filtered = filtered.filter(p => norm(p.Location1_EN) !== "phnom penh");
  }

  if (filtered.length === 0){
    empty.textContent = (t.partnersNoData || "No promotion at this time");
    return;
  }

  // Grouping
  const groups = new Map();
  for (const p of filtered){
    const l1 = (state.lang === "km") ? (p.Location1_KH || p.Location1_EN || "") : (p.Location1_EN || p.Location1_KH || "");
    const l2 = (state.lang === "km") ? (p.Location2_KH || p.Location2_EN || "") : (p.Location2_EN || p.Location2_KH || "");

    const key = ((state.partnersFilter || "all") === "all") ? `${l1}|||${l2}` : `${l2}`;
    if (!groups.has(key)){
      groups.set(key, { l1, l2, items: [] });
    }
    groups.get(key).items.push(p);
  }

  let groupArr = Array.from(groups.values());

  // Sort items inside each group (Shop Name)
  groupArr.forEach(g => {
    g.items.sort((a, b) => {
      const an = String(a["Shop Name"] || "");
      const bn = String(b["Shop Name"] || "");
      return an.localeCompare(bn, undefined, { numeric: true, sensitivity: "base" });
    });
  });

  // Sort groups by number of shops (desc), then by location text
  groupArr.sort((a, b) => {
    if (b.items.length !== a.items.length) return b.items.length - a.items.length;
    const aKey = ((state.partnersFilter || "all") === "all") ? `${a.l1} ${a.l2}`.trim() : `${a.l2}`.trim();
    const bKey = ((state.partnersFilter || "all") === "all") ? `${b.l1} ${b.l2}`.trim() : `${b.l2}`.trim();
    return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: "base" });
  });

  let runningNo = 1;

  for (const g of groupArr){
    const details = document.createElement("details");
    details.className = "partner-group";

    const summary = document.createElement("summary");
    summary.className = "partner-group-header";

    const groupTitle = document.createElement("div");
    groupTitle.className = "partner-group-title";
    groupTitle.textContent = ((state.partnersFilter || "all") === "all") ? `${g.l1} · ${g.l2}` : `${g.l2}`;

    const count = document.createElement("div");
    count.className = "partner-group-count";
    count.textContent = String(g.items.length);

    const hint = document.createElement("div");
    hint.className = "partner-group-hint";
    hint.textContent = (t.partnersView || "View");

    summary.appendChild(groupTitle);
    summary.appendChild(count);
    summary.appendChild(hint);

    const body = document.createElement("div");
    body.className = "partner-group-body";

    const headerRow = document.createElement("div");
    headerRow.className = "partner-table-header";

    const hNo = document.createElement("div");
    hNo.className = "partner-cell partner-no";
    hNo.textContent = t.partnersNo || "No.";

    const hShop = document.createElement("div");
    hShop.className = "partner-cell partner-shop";
    hShop.textContent = t.partnersShopName || "Shop Name";

    const hMap = document.createElement("div");
    hMap.className = "partner-cell partner-map";
    hMap.textContent = t.partnersMap || "Google map";

    const hContact = document.createElement("div");
    hContact.className = "partner-cell partner-contact";
    hContact.textContent = t.partnersContact || "Contact";

    headerRow.appendChild(hNo);
    headerRow.appendChild(hShop);
    headerRow.appendChild(hMap);
    headerRow.appendChild(hContact);
    body.appendChild(headerRow);

    for (const p of g.items){
      const row = document.createElement("div");
      row.className = "partner-row";

      const noCell = document.createElement("div");
      noCell.className = "partner-cell partner-no";
      noCell.textContent = String(runningNo++);

      const shopCell = document.createElement("div");
      shopCell.className = "partner-cell partner-shop";
      shopCell.textContent = p["Shop Name"] || "";

      const mapCell = document.createElement("div");
      mapCell.className = "partner-cell partner-map";
      const mapBtn = document.createElement("button");
      mapBtn.className = "btn btn-secondary";
      mapBtn.type = "button";
      mapBtn.textContent = (t.partnersMapBtn || t.partnersMap || "Google map");
      mapBtn.addEventListener("click", (e) => {
        e.preventDefault();
        try{ openPartnersMap(p); }catch(err){ dbgCaptureError(err, "openPartnersMap_click"); }
      });
      mapCell.appendChild(mapBtn);

      const contactCell = document.createElement("div");
      contactCell.className = "partner-cell partner-contact";
      const a = document.createElement("a");
      a.href = p.Contact || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.className = "btn btn-secondary";
      a.textContent = (t.partnersContactBtn || t.partnersContact || "Contact");
      contactCell.appendChild(a);

      row.appendChild(noCell);
      row.appendChild(shopCell);
      row.appendChild(mapCell);
      row.appendChild(contactCell);
      body.appendChild(row);
    }

    details.appendChild(summary);
    details.appendChild(body);
    list.appendChild(details);
  }

  // update hint label when opened/closed
  list.addEventListener('toggle', (e)=>{
    // keep simple: no-op
  }, { once: true });
}

function renderAll(){

  renderTexts();
  buildCategoryFilters();
  renderOngoingPromotions();
  renderPartners();
  renderProducts();
  renderCart();
  prunePromoGiftSelection();
  autoSyncPromoGifts();
  renderPromoGifts();
  renderTotals();
  updateInvoiceButton();
// promo meta re-render (language + percent)
  if (state.promo.valid && state.promo.promoObj){
    const pct = Math.round((state.promo.discountRate || 0.10) * 100);
    $("#promoMeta").innerHTML = I18N[state.lang].promoValid(
      state.promo.promoObj["Promotion Name"] || "N/A",
      state.promo.promoObj["Telegram Contact"] || "N/A",
      pct
    );
    $("#promoHint").textContent = "";
    linkifyPromoMeta();
  } else if (state.promo.codeRaw){
    $("#promoMeta").innerHTML = "";
    $("#promoHint").textContent = I18N[state.lang].promoInvalid;
  } else {
    $("#promoMeta").innerHTML = "";
    $("#promoHint").textContent = "";
  }
}

function openModal(){
  const modal = $("#invoiceModal");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}
function closeModal(){
  const modal = $("#invoiceModal");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

function buildInvoice(){
  const t = computeTotals();
  const tbody = $("#invoiceTbody");
  tbody.innerHTML = "";

  const promoName = state.promo.valid ? (state.promo.promoObj?.["Promotion Name"] || "N/A") : "N/A";
  const telegram = state.promo.valid ? (state.promo.promoObj?.["Telegram Contact"] || "N/A") : "N/A";
  const promoCode = state.promo.valid ? (state.promo.promoObj?.["Promotion Code"] || state.promo.codeRaw || "N/A") : "N/A";

  $("#invPromoName").textContent = promoName;
  const tgEl = $("#invTelegram");
  tgEl.textContent = telegram;
  const tgHref = telegramUrl(telegram);
  if (tgHref){ tgEl.setAttribute("href", tgHref); tgEl.classList.add("meta-link"); }
  else { tgEl.setAttribute("href", "#"); tgEl.classList.remove("meta-link"); }
  $("#invPromoCode").textContent = promoCode;

  // Order/Customer
  $("#invOrderNo").textContent = state.orderInfo.orderNo || "N/A";
  $("#invOrderDate").textContent = formatOrderDate(state.orderInfo.orderDateTime);
  $("#invCustomer").textContent = getCustomerMultiline();

  // Dynamic discount label in invoice
  const pct = Math.round((state.promo.discountRate || 0.10) * 100);
  $("#tfDiscount").textContent = `${I18N[state.lang].tfDiscount} (${pct}%)`;

  for (const {barcode, qty} of Object.values(state.cart)){
    const p = getProductByBarcode(barcode);
    if (!p) continue;

    const unit = getUnitPrice(p);
    const line = unit * qty;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(getName(p))}</td>
      <td class="right">${qty}</td>
      <td class="right">$${money(unit)}</td>
      <td class="right">$${money(line)}</td>
    `;
    tbody.appendChild(tr);
  }
  // Promo gift (FREE) lines
  const giftStats = getPromoGiftStats();
  if (giftStats.freeLines && giftStats.freeLines.length){
    for (const gl of giftStats.freeLines){
      const p = gl.p;
      const qty = gl.qty;
      const unit = getUnitPrice(p);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(getName(p))} <span class="tag">FREE</span></td>
        <td class="right">${qty}</td>
        <td class="right"><span class="strike">$${money(unit)}</span></td>
        <td class="right"><span class="strike">$${money(unit * qty)}</span> $0.00</td>
      `;
      tbody.appendChild(tr);
    }
  }


  $("#tfSubtotalVal").textContent = `$${money(t.subtotal)}`;
  $("#tfTotalVal").textContent = `$${money(t.total)}`;

  const discRow = $("#tfDiscountRow");
  if (state.promo.valid && t.discount > 0){
    discRow.style.display = "";
    $("#tfDiscountVal").textContent = `- $${money(t.discount||0)}`;
  } else {
    discRow.style.display = "none";
    $("#tfDiscountVal").textContent = "";
  }

  // Free item / shortage discount summary (gift promo; independent of promo code)
  const giftStats2 = getPromoGiftStats();
  const freeValue = giftStats2.providedValue || 0;
  const shortageValue = giftStats2.shortageDiscount || 0;

  if (freeValue > 0){
    $("#tfFreeItemRow").style.display = "";
    $("#tfFreeItemLabel").textContent = I18N[state.lang].freeItemDiscount;
    // Informational only (does NOT affect total)
    $("#tfFreeItemVal").textContent = `$${money(freeValue)}`;
  } else {
    $("#tfFreeItemRow").style.display = "none";
    $("#tfFreeItemVal").textContent = "";
  }

  if (shortageValue > 0){
    $("#tfShortageRow").style.display = "";
    $("#tfShortageLabel").textContent = I18N[state.lang].shortageDiscount;
    $("#tfShortageVal").textContent = `- $${money(shortageValue)}`;
  } else {
    $("#tfShortageRow").style.display = "none";
    $("#tfShortageVal").textContent = "";
  }
}
async function downloadInvoicePdf(){
  // Use html2canvas rasterization so Khmer text renders correctly without PDF font embedding.
  const modal = $("#invoiceModal");
  const card = modal ? modal.querySelector(".modal-card") : null;
  if (!card || !window.html2canvas || !window.jspdf) return;

  // Temporarily ensure the modal is visible for capture
  const wasHidden = modal.getAttribute("aria-hidden") === "true";
  if (wasHidden){
    modal.classList.add("show");
    modal.setAttribute("aria-hidden","false");
  }

  // Capture at higher scale for readability
  const canvas = await window.html2canvas(card, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true
  });

  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({unit:"pt", format:"a4"});

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Fit image to page width with margins
  const margin = 24;
  const usableW = pageWidth - margin * 2;
  const imgW = usableW;
  const imgH = (canvas.height * imgW) / canvas.width;

  let y = margin;
  let remainingH = imgH;
  let srcY = 0;

  // If content exceeds one page, slice the canvas into page-sized chunks
  const pxPerPt = canvas.width / imgW; // pixels per point at current scaling
  const pageUsableH = pageHeight - margin * 2;
  const pagePxH = Math.floor(pageUsableH * pxPerPt);

  while (remainingH > 0){
    // Create a slice canvas
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = Math.min(pagePxH, canvas.height - srcY);
    const ctx = slice.getContext("2d");
    ctx.drawImage(canvas, 0, srcY, canvas.width, slice.height, 0, 0, canvas.width, slice.height);

    const sliceData = slice.toDataURL("image/png");
    const sliceHpt = (slice.height * imgW) / slice.width;

    if (srcY > 0) doc.addPage();
    doc.addImage(sliceData, "PNG", margin, margin, imgW, sliceHpt);

    srcY += slice.height;
    remainingH = (canvas.height - srcY) / pxPerPt;
  }

  // Filename
  const orderNo = $("#invOrderNo")?.textContent?.trim() || "invoice";
  doc.save(`Invoice_${orderNo}.pdf`);

  // Restore modal hidden state if needed
  if (wasHidden){
    modal.classList.remove("show");
    modal.setAttribute("aria-hidden","true");
  }
}

function syncOrderInputsToState(){
  state.orderInfo.orderDateTime = String($("#orderDateInput").value || "").trim();
  state.orderInfo.customerName = String($("#customerNameInput").value || "").trim();
  state.orderInfo.customerContact = String($("#customerContactInput").value || "").trim();
  state.orderInfo.customerAddress = String($("#customerAddressInput").value || "").trim();

  // Generate order no whenever date/time changes (or if missing)
  if (!state.orderInfo.orderDateTime){
    state.orderInfo.orderNo = "";
  } else {
    state.orderInfo.orderNo = generateOrderNo(state.orderInfo.orderDateTime);
  }
  $("#orderNoInput").value = state.orderInfo.orderNo || "";
  saveLocal();
}

function attachEvents(){
  $("#promoApplyBtn").onclick = applyPromoFromInput;
  $("#promoClearBtn").onclick = () => {
    $("#promoInput").value = "";
    state.promo.codeRaw = "";
    state.promo.valid = false;
    state.promo.promoObj = null;
    state.promo.discountRate = 0.10;
    saveLocal();
    renderAll();
  };
  $("#promoInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") applyPromoFromInput();
  });

  $("#clearCartBtn").onclick = () => {
    state.cart = {};
    saveLocal();
    renderAll();
  };

  $("#langToggle").onclick = () => {
    state.lang = state.lang === "km" ? "en" : "km";
    saveLocal();
    renderAll();
  };

  // Order/customer inputs
  $("#orderDateInput").addEventListener("change", () => { syncOrderInputsToState(); });
  $("#customerNameInput").addEventListener("input", () => { syncOrderInputsToState(); });
  $("#customerContactInput").addEventListener("input", () => { syncOrderInputsToState(); });
  $("#customerAddressInput").addEventListener("input", () => { syncOrderInputsToState(); });

  $("#invoiceBtn").onclick = () => {
    if (!Object.keys(state.cart).length) return;

    // If user didn't set order date/time, set to now (optional convenience)
    if (!$("#orderDateInput").value){
      $("#orderDateInput").value = toDatetimeLocalValue(new Date());
    }
    syncOrderInputsToState();

    buildInvoice();
    openModal();
  };

  // modal close
  $("#invoiceModal").addEventListener("click", (e) => {
    if (e.target?.dataset?.close) closeModal();
  });
  // partners map modal close
  const _partnersMapModal = $("#partnersMapModal");
  if (_partnersMapModal){
    _partnersMapModal.addEventListener("click", (e) => {
      if (e.target?.dataset?.close) closePartnersMap();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape"){
      closeModal();
      closePartnersMap();
    }
  });

  $("#printBtn").onclick = () => window.print();
  $("#downloadPdfBtn").onclick = downloadInvoicePdf;
}

// ---------------- Debug helpers (enable with ?debug=1) ----------------
const DEBUG_ENABLED = (new URLSearchParams(location.search).get("debug") === "1") || (safeStorage.get("moyuum_debug") === "1");

const __dbg = {
  enabled: DEBUG_ENABLED,
  errors: [],
  logs: [],
  lastSnapshot: null,
};

function dbgLog(...args){
  if (!__dbg.enabled) return;
  try { console.log("[DBG]", ...args); } catch {}
  __dbg.logs.push({ t: new Date().toISOString(), msg: args.map(a=>{
    try { return typeof a === "string" ? a : JSON.stringify(a); } catch { return String(a); }
  }).join(" ") });
  if (__dbg.logs.length > 300) __dbg.logs.shift();
  updateDebugPanel();
}

function dbgErr(err, context){
  const msg = (err && (err.stack || err.message)) ? (err.stack || err.message) : String(err);
  __dbg.errors.push({ t: new Date().toISOString(), context: context || "", msg });
  if (__dbg.errors.length > 100) __dbg.errors.shift();
  try { console.error("[DBG:ERROR]", context || "", err); } catch {}
  updateDebugPanel();
}

function getDebugSnapshot(){
  // Avoid huge payloads
  const cartMini = (state.cart || []).map(i => ({
    barcode: i.barcode,
    qty: i.qty,
    isFree: !!i.isFree,
    freeOf: i.freeOf || null,
  }));
  const promoMini = {
    appliedPromo: state.appliedPromo || null,
    promoInput: (qs('#promoInput') ? qs('#promoInput').value : "") || "",
  };

  let offers = null;
  try {
    if (typeof getPromoGiftStats === 'function') offers = getPromoGiftStats();
  } catch (e) {
    offers = { error: String(e) };
  }

  return {
    time: new Date().toISOString(),
    version: "debug-build-1",
    productsLoaded: Array.isArray(state.products) ? state.products.length : null,
    cart: cartMini,
    totals: state.totals || null,
    promo: promoMini,
    giftStats: offers,
    errors: __dbg.errors.slice(-20),
    logs: __dbg.logs.slice(-50),
  };
}

function runDiagnostics(){
  const report = { issues: [], summary: {} };
  try {
    const products = Array.isArray(state.products) ? state.products : [];
    report.summary.products = products.length;

    // Barcode uniqueness
    const seen = new Map();
    for (const p of products){
      const b = normalizeBarcode(p.Barcode);
      if (!b) continue;
      if (seen.has(b)) report.issues.push({ type: "DUPLICATE_BARCODE", barcode: b, a: seen.get(b), b: p["Code#"] || p["Name(EN.)"] });
      else seen.set(b, p["Code#"] || p["Name(EN.)"] || "(unknown)");
    }

    // Promo field sanity
    let promoCount = 0;
    for (const p of products){
      const pt = (p["Promotion Type"] || "").toString().trim();
      const pq = Number(p["Promotion Quantity"] || 0);
      const fq = Number(p["Free Quantity"] || 0);
      const pb = p["Promotion Barcode"];
      if (!pt) continue;
      promoCount++;
      if (!pb) report.issues.push({ type: "PROMO_NO_BARCODE", item: p["Code#"] || p["Name(EN.)"] });
      if (!(pq > 0)) report.issues.push({ type: "PROMO_BAD_PROMO_QTY", item: p["Code#"] || p["Name(EN.)"], value: p["Promotion Quantity"] });
      if (pt.toLowerCase() === "free" && !(fq > 0)) report.issues.push({ type: "PROMO_BAD_FREE_QTY", item: p["Code#"] || p["Name(EN.)"], value: p["Free Quantity"] });
      // Ensure parsed list is non-empty when present
      try {
        const list = Array.isArray(pb) ? pb : pb.toString().split(/[,;\s]+/g).filter(Boolean);
        const norm = list.map(normalizeBarcode).filter(Boolean);
        if (norm.length === 0) report.issues.push({ type: "PROMO_BARCODE_PARSE_EMPTY", item: p["Code#"] || p["Name(EN.)"], raw: pb });
      } catch (e) {
        report.issues.push({ type: "PROMO_BARCODE_PARSE_ERROR", item: p["Code#"] || p["Name(EN.)"], error: String(e) });
      }
    }
    report.summary.promoItems = promoCount;
  } catch (e) {
    report.issues.push({ type: "DIAGNOSTIC_CRASH", error: String(e) });
  }
  state.__diagnostics = report;
  dbgLog("Diagnostics", report.summary, "issues=", report.issues.length);
  updateDebugPanel();
  return report;
}

function ensureDebugPanel(){
  const panel = qs('#debugPanel');
  if (!panel) return;
  const enabled = __dbg.enabled;
  panel.classList.toggle('hidden', !enabled);
  panel.setAttribute('aria-hidden', enabled ? 'false' : 'true');

  const copyBtn = qs('#debugCopyBtn');
  if (copyBtn && !copyBtn.__bound){
    copyBtn.__bound = true;
    copyBtn.addEventListener('click', async () => {
      try {
        const snap = getDebugSnapshot();
        await navigator.clipboard.writeText(JSON.stringify(snap, null, 2));
        dbgLog("Copied debug snapshot to clipboard");
      } catch (e) {
        dbgErr(e, "copy_debug_snapshot");
        alert("Copy failed. Open devtools console for details.");
      }
    });
  }

  const refreshBtn = qs('#debugRefreshBtn');
  if (refreshBtn && !refreshBtn.__bound){
    refreshBtn.__bound = true;
    refreshBtn.addEventListener('click', () => {
      try { runDiagnostics(); } catch (e) { dbgErr(e, "runDiagnostics"); }
    });
  }

  const closeBtn = qs('#debugCloseBtn');
  if (closeBtn && !closeBtn.__bound){
    closeBtn.__bound = true;
    closeBtn.addEventListener('click', () => {
      safeStorage.set('moyuum_debug', '0');
      location.href = location.pathname; // drop query
    });
  }
}

function updateDebugPanel(){
  if (!__dbg.enabled) return;
  const body = qs('#debugBody');
  if (!body) return;
  try {
    const snap = getDebugSnapshot();
    const diag = state.__diagnostics || null;
    const text = {
      ...snap,
      diagnostics: diag,
      hints: [
        "Enable debug with ?debug=1",
        "Copy snapshot and paste into ChatGPT when reporting a bug",
      ],
    };
    body.textContent = JSON.stringify(text, null, 2);
  } catch (e) {
    body.textContent = "Failed to render debug snapshot: " + String(e);
  }
}

window.addEventListener('error', (e) => {
  try { dbgErr(e.error || e.message, "window.error"); } catch {}
});
window.addEventListener('unhandledrejection', (e) => {
  try { dbgErr(e.reason, "unhandledrejection"); } catch {}
});

// Quick toggle: Ctrl+Shift+D
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')){
    const on = safeStorage.get('moyuum_debug') === '1';
    safeStorage.set('moyuum_debug', on ? '0' : '1');
    location.reload();
  }
});

// Expose a minimal debug API
window.MOYUUM_DEBUG = {
  enabled: () => __dbg.enabled,
  snapshot: () => getDebugSnapshot(),
  diagnostics: () => runDiagnostics(),
};

(async function init(){
  try{
    loadLocal();
    await loadData();
    await loadOngoingPromotions();
    await loadOfficialPartners();
    computeAccReferenceCounts();

  // Promo input: do NOT auto-fill on load
  state.promo.codeRaw = "";
  $("#promoInput").value = "";
  try{ safeStorage.del("moyuum_promo_v2"); }catch(e){}

  // Order inputs from cache (or set now)
  if (!state.orderInfo.orderDateTime){
    state.orderInfo.orderDateTime = toDatetimeLocalValue(new Date());
  }
  $("#orderDateInput").value = state.orderInfo.orderDateTime;
  $("#customerNameInput").value = state.orderInfo.customerName || "";
  $("#customerContactInput").value = state.orderInfo.customerContact || "";
  $("#customerAddressInput").value = state.orderInfo.customerAddress || "";

  // Generate order no from date/time
  state.orderInfo.orderNo = generateOrderNo(state.orderInfo.orderDateTime);
  $("#orderNoInput").value = state.orderInfo.orderNo;

  // Ensure promo is NOT auto-filled on initial load
  $("#promoInput").value = "";
  state.promo.codeRaw = "";
  state.promo.valid = false;
  state.promo.promoObj = null;
  applyPromoFromInput();
  // Default: collapse order/customer to keep products near the top
  const ob = $("#orderBody");
  if (ob) ob.classList.remove("collapsed");
    attachEvents();
    renderAll();

    // Show initial diagnostics in debug panel, if enabled
    if (DEBUG_ENABLED){
      try{ runDiagnostics(); }catch(e){}
      try{ renderDebugPanel(); }catch(e){}
    }
  }catch(err){
    dbgCaptureError(err, "init");
    console.error("[INIT ERROR]", err);
    try{ renderDebugPanel(); }catch(e){}
    alert("An initialization error occurred.\n\nOpen this page with ?debug=1 and copy the debug snapshot.");
  }
})();
