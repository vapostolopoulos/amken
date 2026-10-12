# Static server for the site that answers missing paths with 404.html, like GitHub Pages does.
# Also like Pages, it hides files and folders starting with _ or ., so _dev/ (the mock's demo photos) is served only
# with --mock, which serve.sh passes.
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

MOCK = "--mock" in sys.argv


class Handler(SimpleHTTPRequestHandler):
    def send_head(self):
        parts = unquote(urlsplit(self.path).path).split("/")
        if any(p[:1] in ("_", ".") and not (MOCK and p == "_dev") for p in parts):
            self.send_error(404)
            return None
        return super().send_head()

    # Without this the browser caches files by their Last-Modified date and keeps showing old copies after edits.
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_error(self, code, message=None, explain=None):
        if code != 404 or not os.path.exists("404.html"):
            return super().send_error(code, message, explain)
        body = open("404.html", "rb").read()
        self.send_response(404)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)


ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
