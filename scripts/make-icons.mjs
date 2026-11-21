// Renders PWA icons from an inline SVG using the preinstalled Playwright Chromium.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const glyph = (color) => `
  <g fill="none" stroke="${color}" stroke-width="28" stroke-linecap="round" stroke-linejoin="round">
    <path d="M150 210h212l-22 150H172z"/>
    <path d="M196 210l40-70M316 210l-40-70"/>
    <path d="M206 270v40M256 270v40M306 270v40"/>
  </g>`;
const svg = ({ size, pad = 0, bg = "#2f54d9", fg = "#ffffff", radius = 112 }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  ${bg ? `<rect width="512" height="512" rx="${radius}" fill="${bg}"/>` : ""}
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">${glyph(fg)}</g>
</svg>`;

const targets = [
  ["icon-192.png", svg({ size: 192 })],
  ["icon-512.png", svg({ size: 512 })],
  ["apple-touch-icon.png", svg({ size: 180, radius: 0 })],
  ["icon-maskable-512.png", svg({ size: 512, pad: 70, radius: 0 })],
  ["badge-96.png", svg({ size: 96, bg: null, fg: "#000000" })],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, markup] of targets) {
  const size = Number(markup.match(/width="(\d+)"/)[1]);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  writeFileSync(`public/icons/${file}`, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }));
}
writeFileSync("public/icons/icon.svg", svg({ size: 512 }).trim());
await browser.close();
console.log("icons written");
