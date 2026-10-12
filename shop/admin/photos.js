// Photos the product editor offers. A static site can't list a folder, so this list is kept by hand: commit the file
// to images/products/, then add its path here. The editor saves the picked paths on the product, in order.
import { LOCAL } from '../js/api.js'

const PHOTOS = [
  '/images/products/passive-aggression-lp-red.jpg',
  '/images/products/passive-aggression-cd.png',
  '/images/products/theater-of-the-absurd-cd.jpg',
  '/images/products/skull-tee.png',
  '/images/products/skull-2-tee.png',
  '/images/products/hoodie.png',
]

// Locally the mock's demo products use the band's album art, so offer that too. _dev/ isn't published, and locally
// site_server.py serves it only with the mock (serve.sh), so against the real backend this import 404s and is skipped.
// A function rather than top-level await: edit.js must register before Alpine starts.
export async function loadPhotos() {
  if (!LOCAL) return PHOTOS
  try {
    return [...PHOTOS, ...(await import('/_dev/photos.js')).default]
  } catch {
    return PHOTOS
  }
}
