export const SAMPLE_JSON = `{
  "id": "ord_9f2c41",
  "createdAt": "2026-03-14T09:24:11Z",
  "status": "shipped",
  "paid": true,
  "customer": {
    "id": 4821,
    "name": "Amina Yusuf",
    "email": "amina@example.com",
    "vip": false,
    "address": {
      "line1": "12 Riverside Walk",
      "city": "Manchester",
      "postcode": "M1 4BT",
      "country": "GB"
    }
  },
  "items": [
    { "sku": "KB-8801", "title": "Mechanical keyboard", "qty": 1, "price": 89.99, "tags": ["input", "usb-c"] },
    { "sku": "MS-2210", "title": "Wireless mouse", "qty": 2, "price": 24.5, "tags": ["input"] },
    { "sku": "HD-4410", "title": "USB-C hub", "qty": 1, "price": 39, "tags": [] }
  ],
  "totals": { "subtotal": 178.0, "shipping": 4.99, "tax": 36.6, "grand": 219.59 },
  "notes": null,
  "meta": { "channel": "web", "coupon": "SPRING10", "attempts": 3 }
}`;

export const SAMPLE_JSON_ALT = `{
  "id": "ord_9f2c41",
  "createdAt": "2026-03-14T09:24:11Z",
  "status": "delivered",
  "paid": true,
  "customer": {
    "id": 4821,
    "name": "Amina Yusuf",
    "email": "amina.yusuf@example.com",
    "vip": true,
    "address": {
      "line1": "12 Riverside Walk",
      "city": "Manchester",
      "postcode": "M1 4BT",
      "country": "GB"
    }
  },
  "items": [
    { "sku": "KB-8801", "title": "Mechanical keyboard", "qty": 1, "price": 79.99, "tags": ["input", "usb-c", "sale"] },
    { "sku": "MS-2210", "title": "Wireless mouse", "qty": 2, "price": 24.5, "tags": ["input"] }
  ],
  "totals": { "subtotal": 128.99, "shipping": 0, "tax": 25.8, "grand": 154.79 },
  "delivery": { "carrier": "Royal Mail", "trackingId": "RM77120041GB" },
  "meta": { "channel": "web", "coupon": "SPRING10", "attempts": 3 }
}`;

export const SAMPLE_MESSY = `Here is the order you asked for:

\`\`\`json
{
  // an order that needs a little help
  id: 'ord_9f2c41',
  status: “shipped”,
  paid: True
  customer: { name: 'Amina Yusuf', vip: False, note: None, },
  items: [
    { sku: 'KB-8801', qty: 1, price: 89.99, }
    { sku: 'MS-2210', qty: 2, price: 24.5 },
  ],
  /* totals are recalculated server-side */
  totals: { subtotal: 007, shipping: .5, tax = NaN, grand: 219.59 },
  invoice: https://example.com/i/9f2c41
\`\`\``;
