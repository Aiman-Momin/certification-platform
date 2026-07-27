/**
 * Phase 1 - Certificate Delivery (Email Module)
 * -----------------------------------------------
 * Requirement: "Email delivery should remain Pending and be triggered
 * manually after the workshop."
 *
 * This script is intentionally NOT called by phase1_mint.js. An admin runs
 * it on-demand (e.g. after the workshop wraps up) to send out certificates
 * whose certificateStatus === "Issued" but emailStatus === "Pending".
 *
 * Email sending itself is mocked (logged to console + certificates/ folder)
 * since no SMTP credentials exist in this prototype; swapping in a real
 * provider (nodemailer/SendGrid/SES) only requires replacing sendEmail().
 *
 * Run: npx hardhat run scripts/phase1_email.js --no-compile --network localhost
 * Optional: pass a participant id to send just one -> node ... -- P-001
 */
const path = require("path");
const { readJson, writeJson, CERTIFICATES_DIR, ensureDirs } = require("./lib/common");

const PARTICIPANTS_PATH = path.join(__dirname, "..", "data", "participants.json");

function sendEmail(participant) {
  // certificateLink is populated once the generated certificate (HTML/image)
  // has been uploaded somewhere with a public URL -- e.g. via IPFS, the same
  // way audioFeedbackUrl works for evaluator voice notes. Until that upload
  // step exists, this just falls back to the raw verification link.
  const certificateLink = participant.certificateLink || participant.verificationLink;

  const emailBody = `
Dear ${participant.name},

Congratulations on completing "${participant.workshopName}"!

Your blockchain-verified Participation Certificate has been issued.
  View your certificate: ${certificateLink}
  Token ID:     ${participant.tokenId}
  Transaction:  ${participant.txHash}
  Verify here:  ${participant.verificationLink}

This certificate is tamper-proof, instantly verifiable, and shareable
digitally on your resume, LinkedIn, or portfolio.

Warm regards,
Performing Arts Certification Team
`.trim();

  // Mock send: write the outgoing email to disk instead of hitting a real
  // SMTP/API provider, and log a delivery line to the console.
  const outPath = path.join(CERTIFICATES_DIR, `email-${participant.id}.txt`);
  require("fs").writeFileSync(outPath, emailBody);
  console.log(`SENT  ${participant.id} (${participant.name}) -> ${participant.email}`);
  console.log(`      -> saved: ${outPath}`);
  return true;
}

async function main() {
  ensureDirs();
  const participants = readJson(PARTICIPANTS_PATH);
  const filterId = process.argv[process.argv.length - 1].startsWith("P-")
    ? process.argv[process.argv.length - 1]
    : null;

  let sentCount = 0;

  for (const p of participants) {
    if (filterId && p.id !== filterId) continue;

    const eligible = p.certificateStatus === "Issued" && p.emailStatus === "Pending";
    if (!eligible) {
      console.log(
        `SKIP  ${p.id} (${p.name}) - certificateStatus=${p.certificateStatus}, emailStatus=${p.emailStatus}`
      );
      continue;
    }

    const ok = sendEmail(p);
    if (ok) {
      p.emailStatus = "Sent";
      p.emailSentAt = new Date().toISOString();
      sentCount++;
    }
  }

  writeJson(PARTICIPANTS_PATH, participants);
  console.log(`\nDone. ${sentCount} email(s) sent. participants.json updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});