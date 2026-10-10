import { api, token, SIZES } from '../js/api.js'

if (!token.get()) location.replace('login.html')

const toVariant = ({ id = null, size = null, stock = 0, version = null } = {}) => ({ id, size, stock, version })

// The editor always shows every size; the API only has the variants that were saved.
// Both shapes are kept so toggling "No sizes" back and forth loses nothing.
const toForm = (product) => {
  const variants = product.variants ?? []
  return {
    ...product,
    price: product.price === '' ? '' : Number(product.price).toFixed(2),
    noSizes: variants.some((v) => v.size === null),
    noSizeVariant: toVariant(variants.find((v) => v.size === null)),
    sized: SIZES.map((size) => toVariant(variants.find((v) => v.size === size) ?? { size, stock: '' })),
  }
}

// An empty stock means the size isn't sold: it's left out, and the API deletes any variant left out.
// 0 means sold out and is kept, so the size still shows (crossed out) in the shop.
const offered = (form) => form.sized.filter((v) => v.stock !== '' && v.stock !== null)

const toInput = (form) => ({
  category: form.category,
  name: form.name,
  description: form.description,
  price: form.price,
  images: form.images ?? [], // no upload UI yet; sent back unchanged so a save never drops them
  version: form.version ?? null,
  variants: form.noSizes ? [form.noSizeVariant] : offered(form),
})

// No top-level await: Alpine (the next deferred script) must find this listener registered.
document.addEventListener('alpine:init', () => {
  Alpine.data('editor', () => ({
    id: new URLSearchParams(location.search).get('id'),
    loading: true,
    saving: false,
    loadError: '',
    error: '',
    fieldErrors: [],
    conflict: false,
    form: toForm({ category: '', name: '', description: '', price: '' }),

    async init() {
      if (this.id) {
        try {
          this.form = toForm(await api(`/api/products/${encodeURIComponent(this.id)}`))
        } catch (e) {
          this.loadError = e.status === 404 ? 'This product no longer exists.' : e.message
        }
      }
      this.loading = false
    },

    async save() {
      this.error = ''
      this.fieldErrors = []
      this.conflict = false
      if (!this.form.noSizes && !offered(this.form).length) {
        this.error = 'Set the stock for at least one size, or tick No sizes.'
        return
      }
      this.saving = true
      try {
        await api(this.id ? `/api/products/${encodeURIComponent(this.id)}` : '/api/products', {
          method: this.id ? 'PUT' : 'POST',
          body: toInput(this.form),
        })
        location.href = 'index.html'
      } catch (e) {
        this.conflict = e.status === 409
        this.error = this.conflict ? 'Someone else changed this product since you opened it.' : e.message
        this.fieldErrors = e.fieldErrors ?? []
        this.saving = false
      }
    },
  }))
})
