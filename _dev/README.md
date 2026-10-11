# Local shop preview

Runs the shop against a mock of the eshop API, so you can click through it without the real backend.

## Start

Needs only `python3`. From the repo root:

```sh
./_dev/serve.sh
```

This starts:

| What | Where |
|---|---|
| The site (`site_server.py`; missing pages get `404.html`, like on GitHub Pages) | http://localhost:8000 |
| Mock API (`mock_api.py`) | http://localhost:8080 |

Ctrl+C stops both.

## Try it

- Shop: http://localhost:8000/shop/
- Admin: http://localhost:8000/shop/admin/, log in with `admin` / `admin`

Use `localhost`, not `127.0.0.1`. The shop only calls the local API from `localhost`, and the mock only allows that
origin.

## What the mock does

- 13 demo products, with the band's album art as sample photos
- Product create, edit and delete, including the 409 when two tabs edit the same product
- Login and 401 handling
- `POST /api/checkout` with `{items: [{productId, size, qty}]}`, which skips Stripe and returns
  `{url}` pointing at `shop/success.html`

It keeps data in memory, so a restart resets it. It only validates an empty name, unlike the real API. It returns
`images`, which the real API doesn't have yet.

## Against the real backend instead

Run only the site with `python3 -I _dev/site_server.py` from the repo root, and run the eshop backend on port 8080. The backend must allow
CORS from `http://localhost:8000`.

**Note:** the `_` prefix keeps this folder off the live site, because GitHub Pages (Jekyll) skips folders starting
with `_`.
