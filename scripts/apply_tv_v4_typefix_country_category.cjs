const fs = require("fs");
const path = require("path");

const root = process.cwd();
const target = path.join(root, "components", "TvMovieDetailShell.tsx");

if (!fs.existsSync(target)) {
  throw new Error("Không tìm thấy components/TvMovieDetailShell.tsx");
}

let content = fs.readFileSync(target, "utf8");

const before = content;

// Fix optional array length checks that TypeScript rejects under strict/null checks.
// `movie.country?.length > 0` has type `number | undefined > 0`.
// Use nullish coalescing so the comparison is always number > 0.
content = content
  .replace(/\(movie\.country\?\.length\s*\?\?\s*0\)\s*>\s*0/g, "(movie.country?.length ?? 0) > 0")
  .replace(/movie\.country\?\.length\s*>\s*0/g, "(movie.country?.length ?? 0) > 0")
  .replace(/movie\.country\s*&&\s*movie\.country\.length\s*>\s*0/g, "(movie.country?.length ?? 0) > 0")
  .replace(/\(movie\.category\?\.length\s*\?\?\s*0\)\s*>\s*0/g, "(movie.category?.length ?? 0) > 0")
  .replace(/movie\.category\?\.length\s*>\s*0/g, "(movie.category?.length ?? 0) > 0")
  .replace(/movie\.category\s*&&\s*movie\.category\.length\s*>\s*0/g, "(movie.category?.length ?? 0) > 0");

// Fix subsequent `.map()` calls in JSX blocks so TypeScript does not complain
// if it loses narrowing inside JSX/minified expressions.
content = content
  .replace(/movie\.country\.map\(/g, "(movie.country ?? []).map(")
  .replace(/movie\.category\.map\(/g, "(movie.category ?? []).map(");

// If the previous replacements have already produced double-wrapped code,
// normalize the harmless but ugly variants.
content = content
  .replace(/\(\(movie\.country \?\? \[\]\)\s*\?\?\s*\[\]\)\.map\(/g, "(movie.country ?? []).map(")
  .replace(/\(\(movie\.category \?\? \[\]\)\s*\?\?\s*\[\]\)\.map\(/g, "(movie.category ?? []).map(");

if (content === before) {
  console.warn("Không thấy pattern cần sửa. File có thể đã được vá rồi.");
} else {
  fs.writeFileSync(target, content, "utf8");
  console.log("patched components/TvMovieDetailShell.tsx");
}

console.log("Done. Run: npm run lint && npm run build");