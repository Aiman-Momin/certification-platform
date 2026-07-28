/**
 * Builds certificate/data/index.json -- a simple lookup table mapping each
 * token ID to its metadata filename -- and copies every metadata JSON file
 * into certificate/data/ so the dynamic certificate page (certificate/index.html)
 * can fetch and render ANY certificate by ID, without needing a separate
 * generated HTML file per participant.
 *
 * This replaces generating one .html file per person. Instead:
 *   - One page (certificate/index.html) handles every certificate
 *   - Each certificate's link is just: certificate/?id=<tokenId>
 *   - Adding a new certificate later only requires re-running this script
 *     and pushing -- no per-person file generation or uploads needed
 *
 * Run: node scripts/build_certificate_index.js
 */
const fs = require("fs");
const path = require("path");

const METADATA_DIR = path.join(__dirname, "..", "metadata");
const CERT_DATA_DIR = path.join(__dirname, "..", "certificate", "data");
const SUBMISSIONS_PATH = path.join(__dirname, "..", "data", "submissions.json");
const PARTICIPANTS_PATH = path.join(__dirname, "..", "data", "participants.json");

// --- EDIT THIS once you have real hosting set up ---
const SITE_BASE_URL = "https://kalachain-certifications.github.io/certification-platform";
// -----------------------------------------------------

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function main() {
  fs.mkdirSync(CERT_DATA_DIR, { recursive: true });

  const metadataFiles = fs.readdirSync(METADATA_DIR).filter((f) => f.endsWith(".json"));
  if (metadataFiles.length === 0) {
    console.error("No metadata files found. Run phase1_mint.js / phase2_mint.js first.");
    process.exit(1);
  }

  const index = {};

  for (const fileName of metadataFiles) {
    const meta = readJson(path.join(METADATA_DIR, fileName));
    const tokenId = String(meta.tokenId);

    // Copy the metadata file into certificate/data/ so it's servable
    fs.copyFileSync(path.join(METADATA_DIR, fileName), path.join(CERT_DATA_DIR, fileName));

    index[tokenId] = fileName;
    console.log(`INDEXED  token ${tokenId} -> ${fileName}  (${meta.participant?.name || "unknown"})`);
  }

  writeJson(path.join(CERT_DATA_DIR, "index.json"), index);
  console.log(`\nWrote certificate/data/index.json with ${Object.keys(index).length} entries.`);

  // Now compute the clean certificate link for each participant/submission
  // and write it back as `certificateLink`, same as before -- just a much
  // shorter, cleaner URL this time.
  const submissions = fs.existsSync(SUBMISSIONS_PATH) ? readJson(SUBMISSIONS_PATH) : [];
  const participants = fs.existsSync(PARTICIPANTS_PATH) ? readJson(PARTICIPANTS_PATH) : [];

  let linked = 0;
  for (const tokenId of Object.keys(index)) {
    const link = `${SITE_BASE_URL}/certificate/?id=${tokenId}`;
    const sub = submissions.find((s) => String(s.tokenId) === tokenId);
    if (sub) { sub.certificateLink = link; linked++; }
    const part = participants.find((p) => String(p.tokenId) === tokenId);
    if (part) { part.certificateLink = link; linked++; }
  }

  writeJson(SUBMISSIONS_PATH, submissions);
  writeJson(PARTICIPANTS_PATH, participants);

  console.log(`Linked ${linked} record(s) with clean certificate URLs.`);
  console.log("\nExample link:");
  const firstId = Object.keys(index)[0];
  console.log(`  ${SITE_BASE_URL}/certificate/?id=${firstId}`);
  console.log("\nNow commit + push (this ONE push handles any number of certificates):");
  console.log("  git add certificate data/submissions.json data/participants.json");
  console.log('  git commit -m "Update certificate index"');
  console.log("  git push");
}

main();