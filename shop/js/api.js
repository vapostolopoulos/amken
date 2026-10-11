const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname)
export const API = LOCAL ? 'http://localhost:8080' : 'https://api.amken.net'

export const SIZES = ['S', 'M', 'L', 'XL', 'XXL']

const TOKEN_KEY = 'eshop.jwt'

export const token = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: (value) => sessionStorage.setItem(TOKEN_KEY, value),
  clear: () => sessionStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `Request failed (${status})`)
    this.status = status
    this.fieldErrors = body?.fieldErrors ?? []
  }
}

// Sends JSON, attaches the admin JWT when present, throws ApiError on non-2xx.
// A 401 on an admin call means the 15-minute token expired: drop it and go to login.
export async function api(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token.get()) headers['Authorization'] = `Bearer ${token.get()}`

  const res = await fetch(API + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (res.status === 401 && token.get()) {
    token.clear()
    location.href = new URL('../admin/login.html', import.meta.url).href
  }
  if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null))
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

const CART_KEY = 'eshop.cart'

// The cart keeps only {productId, size, qty}. Names and prices come from the API, and the BE reprices at checkout.
// size is null for products without sizes.
export const cart = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) ?? []
    } catch {
      return []
    }
  },
  set(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items))
    showCartCount()
  },
  qty: (productId, size) => cart.get().find((i) => i.productId === productId && i.size === size)?.qty ?? 0,
  add(productId, size) {
    const items = cart.get()
    const item = items.find((i) => i.productId === productId && i.size === size)
    if (item) item.qty++
    else items.push({ productId, size, qty: 1 })
    cart.set(items)
  },
}

// Puts the item count on the Cart button that cart.js adds to the public shop pages.
export function showCartCount() {
  const button = document.getElementById('cart-button')
  if (!button) return
  const count = cart.get().reduce((sum, i) => sum + i.qty, 0)
  button.dataset.count = count || ''
  button.setAttribute('aria-label', count ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart')
}

// ponytail: currency hardcoded to EUR, move to the API if the shop ever sells in more than one.
const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' })
export const formatPrice = (price) => money.format(price)

// Tiny DOM builder so product text is always set via textContent, never parsed as HTML.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value)
    else node.setAttribute(key, value)
  }
  node.append(...children.filter((c) => c !== null && c !== undefined))
  return node
}
