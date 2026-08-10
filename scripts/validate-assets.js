"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "web");
const files = ["sw.js", "manifest.webmanifest", "index.html", "about.html", "privacy.html"];
const text = files.map(file => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
const references = [...text.matchAll(/(?:src|href|property="og:image"|name="twitter:image"|itemprop="image")[=\s]+["']([^"']+)["']/g)]

for (const [, reference] of references) {
	if (/^(?:https?:|#|data:|javascript:)/.test(reference)) continue;
	const file = reference.split(/[?#]/)[0].replace(/^\//, "");
	if (file && !fs.existsSync(path.join(root, file))) throw new Error(`Missing web asset: ${reference}`);
}

for (const icon of ["icons/app-icon-192.svg", "icons/app-icon-512.svg"]) {
	const svg = fs.readFileSync(path.join(root, icon), "utf8");
	if (!/<svg\b[^>]*\b(?:width|viewBox)=/.test(svg)) throw new Error(`Invalid icon: ${icon}`);
}

console.log("Web asset references and manifest icons are valid.");
