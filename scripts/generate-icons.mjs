import fs from "fs";
import sharp from "sharp";

const outputDir = "public/icons";

fs.mkdirSync(outputDir, { recursive: true });

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="110" fill="#070a12"/>
  <circle cx="256" cy="256" r="190" fill="#dc2626" opacity="0.18"/>
  <text x="50%" y="48%" dominant-baseline="middle" text-anchor="middle"
    font-family="Arial, sans-serif" font-size="86" font-weight="900" fill="#ffffff">
    Bảo
  </text>
  <text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle"
    font-family="Arial, sans-serif" font-size="58" font-weight="900" fill="#ef4444">
    Flix
  </text>
</svg>
`;

await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(`${outputDir}/icon-192.png`);
await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(`${outputDir}/icon-512.png`);
await sharp(Buffer.from(svg)).resize(180, 180).png().toFile(`${outputDir}/apple-touch-icon.png`);

console.log("Generated PWA icons.");