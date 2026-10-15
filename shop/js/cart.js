// Cart drawer for every public page: a fixed Cart button (top right) that opens a panel sliding in from the right.
// Importing this module (plus shop/css/cart.css) adds both to the page. On cart.html, which has #cart-page,
// the cart renders into the page instead of the drawer.
import { api, cart, el, formatPrice, showCartCount } from './api.js'

// ISO 3166-1 codes we ship to. The browser supplies the names; which zone a country falls in, and its price, is the
// BE's call. Left out: codes Stripe Checkout can't collect a shipping address for.
const COUNTRY_CODES = ('AD AE AF AG AI AL AM AO AQ AR AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CD CF CG CH CI CK CL CM CN CO CR CV CW CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FO FR GA GB ' +
  'GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HN HR HT HU ID IE IL IM IN IO IQ IS IT JE JM JO JP KE ' +
  'KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MK ML MM MN MO MQ MR MS MT MU ' +
  'MV MW MX MY MZ NA NC NE NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PY QA RE RO RS RU RW ' +
  'SA SB SC SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA ' +
  'UG US UY UZ VA VC VE VG VN VU WF WS YE YT ZA ZM ZW').split(' ')
const COUNTRY_KEY = 'eshop.country'
const regionName = new Intl.DisplayNames(['en'], { type: 'region' })

const status = el('p', { class: 'muted' })
const lines = el('ul', { class: 'cart-lines' })
const countrySelect = el('select', { onchange: pickCountry },
  el('option', { value: '' }, 'Pick a country'),
  ...COUNTRY_CODES.map((code) => [code, regionName.of(code)])
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => el('option', { value: code }, name)),
)
try {
  countrySelect.value = localStorage.getItem(COUNTRY_KEY) ?? ''
} catch {}
// The select is narrow, so hovering shows the full country name.
const showCountryTitle = () => (countrySelect.title = countrySelect.selectedOptions[0]?.text ?? '')
showCountryTitle()
const subtotalValue = el('span')
const shippingValue = el('span')
const totalValue = el('span')
const note = el('p', { class: 'error', role: 'status' })
const error = el('p', { class: 'error', role: 'alert' })
const checkoutButton = el('button', { onclick: checkout }, 'Checkout')
const footer = el('div', { class: 'cart-footer' },
  el('label', { class: 'cart-country' }, 'Ship to', countrySelect),
  el('div', { class: 'cart-sums' },
    el('p', {}, 'Subtotal', subtotalValue),
    el('p', {}, 'Shipping', shippingValue),
    el('p', { class: 'cart-total' }, 'Total', totalValue),
  ),
  note, error, checkoutButton,
  el('p', { class: 'muted' }, 'Address and payment on the next page.'),
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
let subtotal = 0
let shipping = null // quoted for the current cart and country; null until known
let quoteId = 0 // only the latest quote may update the totals

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
  subtotal = rows.reduce((sum, { item, p }) => sum + p.price * item.qty, 0)
  if (rows.length) quote()
}

function pickCountry() {
  showCountryTitle()
  try {
    localStorage.setItem(COUNTRY_KEY, countrySelect.value)
  } catch {}
  quote()
}

// Asks the BE what shipping costs for this cart and country. The BE recomputes it at checkout, so this is display only.
async function quote() {
  const id = ++quoteId
  shipping = null
  showTotals()
  if (!countrySelect.value) return
  try {
    const { amount } = await api('/api/shipping', { method: 'POST', body: { items: cart.get(), country: countrySelect.value } })
    if (id !== quoteId) return
    shipping = amount
    showTotals()
  } catch {
    if (id !== quoteId) return
    shippingValue.textContent = 'Unavailable, try again later'
    shippingValue.classList.add('error')
  }
}

function showTotals() {
  subtotalValue.textContent = formatPrice(subtotal)
  shippingValue.classList.toggle('error', !countrySelect.value)
  shippingValue.textContent = !countrySelect.value ? 'Pick a country' : shipping === null ? 'Calculating…' : formatPrice(shipping)
  totalValue.textContent = shipping === null ? '—' : formatPrice(subtotal + shipping)
  checkoutButton.disabled = shipping === null
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
    const { url } = await api('/api/checkout', { method: 'POST', body: { items: cart.get(), country: countrySelect.value } })
    location.href = url
  } catch (e) {
    // 409: something sold out since it was added; the BE message says what.
    error.textContent = e.status === 409 ? e.message : 'Checkout is unavailable right now. Try again later.'
    checkoutButton.disabled = shipping === null
  }
}

// Warnings go away on the next click anywhere. pointerdown fires before the blur that commits a quantity input, so a
// message that click triggers (or a checkout error arriving later) is set after this clears, and stays.
document.addEventListener('pointerdown', () => {
  note.textContent = error.textContent = ''
})

if (page) openCart()
