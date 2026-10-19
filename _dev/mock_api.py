# Mimics the eshop BE contract (products CRUD, versions, 409, login, 401) with CORS for localhost:8000.
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

products = {}

EU = set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split())
ZONES = ("gr", "eu", "world")
# Same shape as GET/PUT /api/shipping-rates. Placeholder rates; Music and Accessories fall back to default.
rates = [{"category": c, "rates": {z: {"first": f, "additional": a} for z, (f, a) in zip(ZONES, r)}}
         for c, r in [("default", ((5, 2), (10, 4), (20, 8))),
                      ("T-shirts", ((4, 1.5), (8, 3), (15, 6))),
                      ("Hoodies", ((6, 2), (12, 4), (22, 8)))]]


# The highest "first" among all units, plus "additional" for every other unit.
def shipping(items, country):
    zone = "gr" if country == "GR" else "eu" if country in EU else "world"
    by_category = {c["category"]: c["rates"][zone] for c in rates}
    units = [by_category.get(products[i["productId"]]["category"], by_category["default"])
             for i in items if i["productId"] in products for _ in range(i["qty"])]
    if not units:
        return 0
    top = max(units, key=lambda r: r["first"])
    return top["first"] + sum(u["additional"] for u in units) - top["additional"]


next_id = [1]
next_variant_id = [1]


def make_variants(inputs, existing=()):
    by_id = {v["id"]: v for v in existing}
    out = []
    for v in inputs:
        if v.get("id"):
            old = by_id[v["id"]]
            if v.get("version") != old["version"]:
                return None
            out.append({"id": v["id"], "size": v["size"], "stock": v["stock"], "version": old["version"] + 1})
        else:
            out.append({"id": next_variant_id[0], "size": v["size"], "stock": v["stock"], "version": 0})
            next_variant_id[0] += 1
    return out


class Handler(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "http://localhost:8000")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def reply(self, status, body=None):
        self.send_response(status)
        self.cors()
        data = b"" if body is None else json.dumps(body).encode()
        if data:
            self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        return json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"null")

    def invalid(self, field, message):
        self.reply(400, {"status": 400, "message": "Validation failed for one or more fields",
                         "fieldErrors": [{"field": field, "message": message}]})

    def authed(self):
        return self.headers.get("Authorization") == "Bearer test-jwt"

    def do_OPTIONS(self):
        self.reply(200)

    def do_GET(self):
        if self.path == "/api/shipping-rates":
            return self.reply(200, {"categories": rates}) if self.authed() else self.reply(401)
        m = re.fullmatch(r"/api/products(?:/(\d+))?", self.path)
        if not m:
            return self.reply(404)
        if m[1] is None:
            return self.reply(200, list(products.values()))
        p = products.get(int(m[1]))
        self.reply(200, p) if p else self.reply(404, {"status": 404, "message": "not found"})

    def do_POST(self):
        if self.path == "/auth/login":
            b = self.body()
            ok = b == {"username": "admin", "password": "admin"}
            return self.reply(200, {"token": "test-jwt"}) if ok else self.reply(401)
        if self.path == "/api/shipping":
            b = self.body()
            return self.reply(200, shipping(b["items"], b["country"]))
        if self.path == "/api/checkout":
            # The real BE reprices the cart, recomputes shipping, checks stock and returns a Stripe Checkout URL.
            # The mock skips Stripe.
            if not self.body().get("country"):
                return self.reply(400, {"status": 400, "message": "country is required"})
            return self.reply(200, {"url": "http://localhost:8000/shop/success.html"})
        if not self.authed():
            return self.reply(401)
        b = self.body()
        if not b["name"].strip():
            return self.invalid("name", "name is required")
        if len(b["images"]) > 10:
            return self.invalid("images", "images must have at most 10 entries")
        if b.get("version") is not None:
            return self.reply(400, {"status": 400, "message": "Supplied version for product creation"})
        pid = next_id[0]
        next_id[0] += 1
        products[pid] = {"id": pid, "category": b["category"], "name": b["name"], "description": b["description"],
                         "price": float(b["price"]), "images": b["images"],
                         "variants": make_variants(b["variants"]), "version": 0}
        self.reply(200, products[pid])

    def do_PUT(self):
        if not self.authed():
            return self.reply(401)
        b = self.body()
        if self.path == "/api/shipping-rates":
            if "default" not in [c["category"] for c in b["categories"]]:
                return self.reply(400, {"status": 400, "message": "The default shipping rate is required"})
            rates[:] = [{"category": c["category"],
                         "rates": {z: {k: float(c["rates"][z][k]) for k in ("first", "additional")} for z in ZONES}}
                        for c in b["categories"]]
            return self.reply(200, {"categories": rates})
        pid = int(self.path.rsplit("/", 1)[1])
        if len(b["images"]) > 10:
            return self.invalid("images", "images must have at most 10 entries")
        p = products[pid]
        variants = make_variants(b["variants"], p["variants"])
        if b.get("version") != p["version"] or variants is None:
            return self.reply(409, {"status": 409, "message": "The resource was modified by another request."})
        products[pid] = {**p, "category": b["category"], "name": b["name"], "description": b["description"],
                         "price": float(b["price"]), "images": b["images"],
                         "variants": variants, "version": p["version"] + 1}
        self.reply(200, products[pid])

    def do_DELETE(self):
        if not self.authed():
            return self.reply(401)
        products.pop(int(self.path.rsplit("/", 1)[1]), None)
        self.reply(200)


# SEED: demo products so the shop isn't empty. Image paths are site-relative, like the ones the editor saves.
IMG = "/images/"
for name, cat, price, sizes, images in [
    ("Passive Tee", "T-shirts", 25, [("S", 0), ("M", 4), ("L", 2)], ["passive.jpg", "emblem-white.png", "landing-bg.jpg"]),
    ("Theater Hoodie", "Hoodies", 45, [("M", 3), ("L", 0), ("XL", 1)], ["theater.jpg", "emblem.png"]),
    ("Adrenaline Vinyl", "Music", 22, [(None, 10)], ["adrenaline.jpg"]),
    ("Sticker Pack", "Accessories", 5, [(None, 0)], []),
    ("Adrenaline Tee", "T-shirts", 25, [("S", 2), ("M", 5), ("L", 5), ("XL", 1)], ["adrenaline.jpg", "emblem-white.png"]),
    ("Theater Tee", "T-shirts", 25, [("M", 0), ("L", 0)], ["theater.jpg"]),
    ("Emblem Hoodie", "Hoodies", 50, [("S", 1), ("M", 2), ("L", 3), ("XL", 2), ("XXL", 1)], ["emblem-white.png", "emblem.png"]),
    ("Passive Aggression Vinyl", "Music", 24, [(None, 7)], ["passive.jpg"]),
    ("Theater of the Absurd CD", "Music", 12, [(None, 15)], ["theater.jpg"]),
    ("Adrenaline Shot CD", "Music", 10, [(None, 3)], ["adrenaline.jpg"]),
    ("Landing Poster", "Accessories", 15, [(None, 20)], ["landing-bg.jpg"]),
    ("Emblem Patch", "Accessories", 6, [(None, 40)], ["emblem.png"]),
    ("Tour Tote Bag", "Accessories", 18, [(None, 8)], ["emblem-white.png"]),
]:
    pid = next_id[0]
    next_id[0] += 1
    products[pid] = {"id": pid, "category": cat, "name": name, "price": price, "version": 0,
                     "images": [IMG + i for i in images],
                     "description": "Heavyweight cotton.\nScreen-printed front." if cat != "Music" else "180g black vinyl.",
                     "variants": make_variants([{"size": s, "stock": n} for s, n in sizes])}

ThreadingHTTPServer(("127.0.0.1", 8080), Handler).serve_forever()
