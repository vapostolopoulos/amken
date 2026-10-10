# Static server for the site that answers missing paths with 404.html, like GitHub Pages does.
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
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
