// Cart drawer for every public page: a fixed Cart button (top right) that opens a panel sliding in from the right.
// Importing this module (plus shop/css/cart.css) adds both to the page. On cart.html, which has #cart-page,
// the cart renders into the page instead of the drawer.
import { api, cart, el, formatPrice, showCartCount } from './api.js'

const status = el('p', { class: 'muted' })
const lines = el('ul', { class: 'cart-lines' })
const total = el('p', { class: 'cart-total' })
const note = el('p', { class: 'error', role: 'status' })
const error = el('p', { class: 'error', role: 'alert' })
const checkoutButton = el('button', { onclick: checkout }, 'Checkout')
const footer = el('div', { class: 'cart-footer' },
  total, note, error, checkoutButton,
  el('p', { class: 'muted' }, 'Shipping and payment on the next page.'),
)
const page = document.getElementById('cart-page')
// The panel fills the dialog, so a click whose target is the dialog itself landed on the backdrop.
const drawer = el('dialog', { class: 'cart-drawer', 'aria-labelledby': 'cart-title', onclick: (e) => e.target === drawer && drawer.close() },
  el('div', { class: 'cart-panel' },
    el('div', { class: 'cart-head' },
      el('h2', { id: 'cart-title' }, el('a', { href: new URL('../cart.html', import.meta.url).href }, 'Cart')),
      el('button', { class: 'link', onclick: () => drawer.close() }, 'Close'),
    ),
    ...(page ? [] : [status, lines, footer]),
  ),
)
page?.append(status, lines, footer)
const cartButton = el('button', { id: 'cart-button', class: 'nav-link cart-button', onclick: () => openCart() })
// Static markup, so innerHTML is safe here. The count badge is CSS reading data-count (see showCartCount).
cartButton.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7h12l1 14H5L6 7z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>'
// cart.html shows the cart itself, so it gets neither the button nor the drawer.
if (!page) document.body.append(cartButton, drawer)
showCartCount()

let products = new Map()

// Refetches products on every open so names, prices and stock are current.
export async function openCart() {
  if (!page && !drawer.open) drawer.showModal()
  note.textContent = error.textContent = ''
  status.textContent = 'Loading…'
  footer.hidden = true
  lines.replaceChildren()
  try {
    products = new Map((await api('/api/products')).map((p) => [p.id, p]))
    render()
  } catch {
    status.textContent = 'The shop is unavailable right now. Try again later.'
  }
}

function render() {
  // Drop lines whose product or size was removed since they were added.
  const rows = cart.get().flatMap((item) => {
    const p = products.get(item.productId)
    const v = p?.variants.find((v) => v.size === item.size)
    return v ? [{ item, p, v }] : []
  })
  cart.set(rows.map((r) => r.item))

  status.replaceChildren(...(rows.length ? [] : ['Your cart is empty. ', el('a', { href: new URL('../index.html', import.meta.url).href }, 'Start shopping')]))
  footer.hidden = !rows.length
  lines.replaceChildren(...rows.map(({ item, p, v }) => {
    const href = new URL(`../product.html?id=${p.id}`, import.meta.url).href
    return el('li', {},
      el('a', { href }, p.images?.length ? el('img', { src: p.images[0], alt: '' }) : null),
      el('div', {},
        el('a', { class: 'product-name', href }, p.name),
        el('p', { class: 'muted' }, item.size ? `${item.size} · ${formatPrice(p.price)}` : formatPrice(p.price)),
        el('div', { class: 'actions' },
          el('input', {
            type: 'number', min: '1', max: String(v.stock), value: String(item.qty),
            'aria-label': `Quantity of ${p.name}`,
            onchange: (e) => setQty(item, p, v, e.target.valueAsNumber),
          }),
          el('button', { class: 'link', onclick: () => update(item, 0) }, 'Remove'),
        ),
      ),
      el('p', { class: 'price' }, formatPrice(p.price * item.qty)),
    )
  }))
  total.replaceChildren(
    `Total ${formatPrice(rows.reduce((sum, { item, p }) => sum + p.price * item.qty, 0))} `,
    el('span', { class: 'muted' }, '+ shipping'),
  )
}

function update(item, qty, message = '') {
  cart.set(cart.get().flatMap((i) =>
    i.productId !== item.productId || i.size !== item.size ? [i] : qty > 0 ? [{ ...i, qty }] : [],
  ))
  render()
  note.textContent = message
}

// Out-of-range quantities snap back to 1 or the stock, and say why.
function setQty(item, p, v, wanted) {
  const name = item.size ? `${p.name} (${item.size})` : p.name
  if (wanted > v.stock) update(item, v.stock, `Only ${v.stock} of ${name} in stock.`)
  else if (!(wanted >= 1)) update(item, 1, `The minimum is 1. Use Remove to take ${name} out of the cart.`)
  else update(item, Math.floor(wanted))
}

async function checkout() {
  checkoutButton.disabled = true
  error.textContent = ''
  try {
    const { url } = await api('/api/checkout', { method: 'POST', body: { items: cart.get() } })
    location.href = url
  } catch (e) {
    // 409: something sold out since it was added; the BE message says what.
    error.textContent = e.status === 409 ? e.message : 'Checkout is unavailable right now. Try again later.'
    checkoutButton.disabled = false
  }
}

if (page) openCart()
