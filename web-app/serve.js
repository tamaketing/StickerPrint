/*
 * เซิร์ฟเวอร์แบบง่ายสำหรับทดสอบในเครื่อง (ไม่ต้องติดตั้งอะไรเพิ่ม)
 * วิธีใช้:  node serve.js   แล้วเปิด http://localhost:5173
 *          node serve.js 8080   เพื่อเปลี่ยนพอร์ต
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 5173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".map": "application/json; charset=utf-8"
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow"
  }, headers || {}));
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(url.parse(req.url).pathname || "/");
  } catch (e) {
    return send(res, 400, "Bad Request", { "Content-Type": "text/plain; charset=utf-8" });
  }

  if (pathname === "/") pathname = "/index.html";

  // กัน path traversal
  const target = path.normalize(path.join(ROOT, pathname));
  if (!target.startsWith(ROOT)) {
    return send(res, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
  }

  fs.stat(target, (err, stat) => {
    if (err || !stat.isFile()) {
      return send(res, 404, "404 Not Found", { "Content-Type": "text/plain; charset=utf-8" });
    }

    const ext = path.extname(target).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const noCache = [".html", ".js", ".css", ".json", ".txt"].includes(ext);

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": noCache ? "no-store" : "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow"
    });

    if (req.method === "HEAD") return res.end();
    fs.createReadStream(target).pipe(res);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("  พิมพ์สติ๊กเกอร์ (เว็บ) กำลังทำงาน");
  console.log("  เปิดเบราว์เซอร์ที่:  http://localhost:" + PORT);
  console.log("  หยุดเซิร์ฟเวอร์: กด Ctrl+C");
  console.log("");
});
