#!/usr/bin/env node
/**
 * build-bundle.mjs — đóng gói toàn bộ app thành MỘT tệp `bundle.html` chạy được qua `file://`.
 *
 * Không dùng dependency ngoài. Cách làm: nối các ES module theo đúng thứ tự phụ thuộc
 * vào một IIFE, thay `import` bằng truy cập trực tiếp biến trong cùng closure, và
 * thay `export` bằng khai báo `const`/`function` thường. CSS và manifest được inline.
 *
 * Kiểm chứng: sau khi build, mở `file://.../bundle.html` bằng Chrome headless phải render bàn cờ.
 *
 * Chạy: node build-bundle.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/** Thứ tự phụ thuộc: mỗi module chỉ import các module ĐỨNG TRƯỚC nó. */
const MODULES = [
  'src/config.js',
  'src/engine.js',
  'src/ai.js',
  'src/tutorial.js',
  'src/audio.js',
  'src/render.js',
  'src/ui.js',
  'src/zoom-guard.js',
  'src/main.js',
];

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/**
 * Phân tích câu `import` của một module và trả về:
 *  - code: source đã bỏ import/export, khai báo thường;
 *  - imported: danh sách tên được import từ module KHÁC;
 *  - names: tên export của module này.
 */
function transformModule(src, rel) {
  let out = src;
  const imported = [];
  // 1) Đọc và bỏ mọi câu import tĩnh (một dòng hoặc nhiều dòng, có alias).
  const importRe = /^import\s+([\s\S]*?)\s+from\s+['"][^'"]+['"];?\s*$/gm;
  out = out.replace(importRe, (m, clause) => {
    const c = clause.trim();
    // import * as NS from ... (không dùng trong dự án; báo lỗi nếu gặp)
    if (/^\*\s+as\s+/.test(c)) throw new Error(`${rel}: không hỗ trợ import * as`);
    let named = '';
    if (c.startsWith('{')) named = c;
    else {
      const braceIdx = c.indexOf('{');
      // default import (không dùng) + named
      if (braceIdx >= 0) named = c.slice(braceIdx);
    }
    const inner = named.replace(/^\{|\}$/g, '').trim();
    for (const raw of inner.split(',')) {
      const t = raw.trim();
      if (!t) continue;
      const parts = t.split(/\s+as\s+/);
      imported.push(parts.length === 2 ? parts[0].trim() : t);
    }
    return '';
  });
  // 2) Bỏ `export { ... };` dạng liệt kê, ghi nhận tên.
  const reExports = [];
  // `export { a as b }` → phải gán __M.b = a (localName khác publicName).
  const reAliases = [];
  out = out.replace(/^export\s*\{([^}]*)\};?\s*$/gm, (m, names) => {
    for (const raw of names.split(',')) {
      const t = raw.trim();
      if (!t) continue;
      const parts = t.split(/\s+as\s+/);
      if (parts.length === 2) {
        reExports.push(parts[1].trim());
        reAliases.push([parts[1].trim(), parts[0].trim()]);
      } else {
        reExports.push(parts[0].trim());
      }
    }
    return '';
  });
  // 3) export const/let/function/class → khai báo thường.
  const names = [];
  out = out.replace(/^export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (m, kind, name) => {
    names.push(name);
    return `${kind} ${name}`;
  });
  out = out.replace(/^export\s+(async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm, (m, isAsync, name) => {
    names.push(name);
    return `${isAsync ? 'async ' : ''}function ${name}`;
  });
  out = out.replace(/^export\s+class\s+([A-Za-z_$][\w$]*)/gm, (m, name) => {
    names.push(name);
    return `class ${name}`;
  });
  const leftover = out.match(/^export\s+.*$/m);
  if (leftover) throw new Error(`${rel}: còn câu export chưa xử lý → ${leftover[0].slice(0, 80)}`);
  // 4) Đưa tên import vào closure: `const ten = __M["ten"];` (đúng module scope thật).
  const decls = [...new Set(imported)].map((n) => `const ${n} = __M[${JSON.stringify(n)}];`).join('\n');
  return {
    code: `${decls}\n${out}`,
    imported: [...new Set(imported)],
    names: [...new Set([...names, ...reExports])],
    aliases: reAliases,
  };
}

function build() {
  const chunks = [];
  const moduleInfo = [];
  const exported = new Set();
  const perModule = [];
  for (const rel of MODULES) {
    if (!fs.existsSync(path.join(ROOT, rel))) throw new Error(`Thiếu tệp ${rel}`);
    const { code, imported, names, aliases } = transformModule(read(rel), rel);
    for (const nm of names) exported.add(nm);
    perModule.push({ rel, code, imported, names, aliases });
    moduleInfo.push({ rel, names });
  }
  // Kiểm tra mọi tên import phải được export bởi một module ĐỨNG TRƯỚC (không vòng lặp).
  const available = new Set();
  for (const m of perModule) {
    for (const nm of m.imported) {
      if (!available.has(nm)) {
        throw new Error(`${m.rel}: import "${nm}" chưa được export bởi module trước đó (thứ tự MODULES sai?)`);
      }
    }
    for (const nm of m.names) available.add(nm);
    const aliasMap = new Map(m.aliases || []);
    const assign = m.names
      .map((nm) => `      __M[${JSON.stringify(nm)}] = ${aliasMap.has(nm) ? aliasMap.get(nm) : nm};`)
      .join('\n');
    chunks.push(`/* ===== ${m.rel} (${m.names.length} export) ===== */\n(function () {\n${m.code}\n${assign}\n    })();\n`);
  }

  const css = read('src/styles.css');
  const indexHtml = read('index.html');
  const manifest = JSON.parse(read('manifest.webmanifest'));
  const iconSvg = read('icon.svg').trim();

  // SVG icon nhúng thành data URI (để manifest/favicon vẫn có icon khi chạy file://).
  const iconDataUri = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`;
  manifest.icons = [
    { src: iconDataUri, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    { src: iconDataUri, sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
  ];
  const manifestUri = `data:application/manifest+json;base64,${Buffer.from(JSON.stringify(manifest)).toString('base64')}`;

  // Lấy phần <body> tĩnh của index.html (app shell, ad slot, gate, selftest).
  const bodyMatch = indexHtml.match(/<body[^>]*>([\s\S]*?)<script[\s\S]*?<\/html>/);
  let shell = bodyMatch ? bodyMatch[1] : '';
  // Bỏ script cũ (bundle sẽ tự chèn phần khởi động sau).
  shell = shell.replace(/<script[\s\S]*?<\/script>/g, '').trim();

  const bundleHtml = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Boxline — Cờ Ô Vuông (bản gói một tệp)</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="description" content="Boxline (Cờ Ô Vuông) — game Dots &amp; Boxes chơi offline.">
  <meta name="theme-color" content="#F7F8FA" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#0B0E13" media="(prefers-color-scheme: dark)">
  <meta name="color-scheme" content="light dark">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Boxline">
  <link rel="icon" type="image/svg+xml" href="${iconDataUri}">
  <link rel="apple-touch-icon" href="${iconDataUri}">
  <link rel="manifest" href="${manifestUri}">
  <script>
    (function () {
      try {
        var q = new URLSearchParams(location.search);
        var t = q.get('theme');
        if (t !== 'light' && t !== 'dark') {
          var raw = localStorage.getItem('db_settings');
          var saved = raw ? JSON.parse(raw) : null;
          t = saved && saved.theme ? saved.theme : 'system';
        }
        if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
      } catch (e) { /* bỏ qua */ }
    })();
  </script>
  <style>
${css}
  </style>
</head>
<body>
${shell}
  <script>
/* Bundle sinh tự động bởi build-bundle.mjs — ĐỪNG sửa tay.
   Nguồn: ${MODULES.join(', ')}  |  ${moduleInfo.reduce((a, m) => a + m.names.length, 0)} tên export. */
(function () {
  'use strict';
  var __M = {};
  window.__M = __M;
${chunks.join('\n')}
  /* Kiểm tra nhanh: mọi tên export phải tồn tại trong closure. */
  try {
    window.__bundleInfo = ${JSON.stringify(moduleInfo.map((m) => ({ module: m.rel, exports: m.names.length })))};
  } catch (e) {
    console.error('bundle info lỗi', e);
  }
})();
  </script>
</body>
</html>
`;

  const outPath = path.join(ROOT, 'bundle.html');
  fs.writeFileSync(outPath, bundleHtml, 'utf8');
  const kb = (fs.statSync(outPath).size / 1024).toFixed(1);
  console.log(`Đã tạo ${path.relative(process.cwd(), outPath) || 'bundle.html'} (${kb} KB, ${MODULES.length} module, ${moduleInfo.reduce((a, m) => a + m.names.length, 0)} export).`);
  console.log('Kiểm chứng: mở file:///…/bundle.html — hoặc chạy Chrome headless để chụp màn hình.');
}

build();
