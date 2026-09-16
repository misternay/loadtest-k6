// serve.mjs — เซิร์ฟเวอร์ทดสอบในเครื่องสำหรับเปิดเว็บบทเรียน
// ใช้:  node serve.mjs  (ค่าเริ่มต้นพอร์ต 4173)
// เหตุผลที่ต้องมี: หน้า tools/latency.html ดึง assets/data/latency-samples.json
// ซึ่งเบราว์เซอร์ไม่ยอมให้โหลดผ่าน file:// (CORS) จึงต้องเสิร์ฟผ่าน HTTP
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site');
const port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, {'content-type':'text/plain; charset=utf-8'}).end('404');
    return;
  }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
}).listen(port, () => console.log('serving site/ at http://localhost:' + port));
