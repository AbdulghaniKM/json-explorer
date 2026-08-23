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

/**
 * A small but complete OpenAPI 3 document for the API viewer: two tags, path and query
 * parameters, a request body, several response codes and a security scheme, so every part of
 * the reader has something to show without shipping a megabyte of petstore.
 */
export const SAMPLE_OPENAPI = `{
  "openapi": "3.0.3",
  "info": {
    "title": "Orders API",
    "version": "1.4.0",
    "description": "Create, read and refund customer orders."
  },
  "servers": [{ "url": "https://api.example.com/v1" }],
  "security": [{ "bearerAuth": [] }],
  "paths": {
    "/orders": {
      "get": {
        "operationId": "listOrders",
        "summary": "List orders",
        "tags": ["orders"],
        "parameters": [
          { "name": "status", "in": "query", "schema": { "type": "string" } },
          { "name": "limit", "in": "query", "required": false, "schema": { "type": "integer", "format": "int32" } }
        ],
        "responses": {
          "200": {
            "description": "A page of orders",
            "content": { "application/json": { "schema": { "type": "array", "items": { "$ref": "#/components/schemas/Order" } } } }
          },
          "401": { "description": "Missing or invalid token" }
        }
      },
      "post": {
        "operationId": "createOrder",
        "summary": "Create an order",
        "tags": ["orders"],
        "requestBody": {
          "required": true,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/NewOrder" } } }
        },
        "responses": {
          "201": { "description": "Created", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Order" } } } },
          "422": { "description": "Validation failed" }
        }
      }
    },
    "/orders/{orderId}": {
      "parameters": [{ "name": "orderId", "in": "path", "required": true, "schema": { "type": "string" } }],
      "get": {
        "operationId": "getOrder",
        "summary": "Fetch one order",
        "tags": ["orders"],
        "responses": {
          "200": { "description": "The order", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Order" } } } },
          "404": { "description": "No such order" }
        }
      },
      "delete": {
        "operationId": "cancelOrder",
        "summary": "Cancel an order",
        "tags": ["orders"],
        "responses": { "204": { "description": "Cancelled" }, "409": { "description": "Already shipped" } }
      }
    },
    "/orders/{orderId}/refunds": {
      "parameters": [{ "name": "orderId", "in": "path", "required": true, "schema": { "type": "string" } }],
      "post": {
        "operationId": "refundOrder",
        "summary": "Refund an order",
        "description": "Refunds part or all of an order. Amounts are in minor units.",
        "tags": ["refunds"],
        "requestBody": {
          "required": true,
          "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Refund" } } }
        },
        "responses": {
          "202": { "description": "Refund queued", "content": { "application/json": { "schema": { "$ref": "#/components/schemas/Refund" } } } },
          "403": { "description": "Not permitted" }
        }
      }
    },
    "/health": {
      "get": {
        "operationId": "health",
        "summary": "Liveness probe",
        "tags": ["ops"],
        "security": [],
        "responses": { "200": { "description": "Healthy" } }
      }
    }
  },
  "components": {
    "securitySchemes": { "bearerAuth": { "type": "http", "scheme": "bearer" } },
    "schemas": {
      "Order": { "type": "object", "properties": { "id": { "type": "string" }, "total": { "type": "number" } } },
      "NewOrder": { "type": "object", "properties": { "items": { "type": "array", "items": { "type": "string" } } } },
      "Refund": { "type": "object", "properties": { "amount": { "type": "integer" }, "reason": { "type": "string" } } }
    }
  }
}`;
