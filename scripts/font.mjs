// Lastik's license doesn't allow the font file on a public GitHub repo, so app/fonts/ is gitignored.
// Locally the file is already there. On Vercel, this writes it from the LASTIK_WOFF2_BASE64 environment
// variable (the font file, base64-encoded) before the build, so the live site still gets the font.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const file = new URL("../app/fonts/Lastik.woff2", import.meta.url);
if (!existsSync(file)) {
    const b64 = process.env.LASTIK_WOFF2_BASE64;
    if (!b64) {
        console.error("Missing app/fonts/Lastik.woff2. Set LASTIK_WOFF2_BASE64 (base64 of the font file) in the environment.");
        process.exit(1);
    }
    mkdirSync(new URL("../app/fonts/", import.meta.url), { recursive: true });
    writeFileSync(file, Buffer.from(b64, "base64"));
    console.log("Wrote app/fonts/Lastik.woff2 from LASTIK_WOFF2_BASE64");
}
