const fs = require("fs");
const path = require("path");

const root = process.cwd();

function write(relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
  console.log(`patched ${relativePath}`);
}

write("components/TvDashboard.tsx", fs.readFileSync(path.join(__dirname, "TvDashboard.tsx.txt"), "utf8"));
write("components/TvSearchBox.tsx", fs.readFileSync(path.join(__dirname, "TvSearchBox.tsx.txt"), "utf8"));
write("components/TvMovieDetailShell.tsx", fs.readFileSync(path.join(__dirname, "TvMovieDetailShell.tsx.txt"), "utf8"));

console.log("Done. Run: npm run lint && npm run build");