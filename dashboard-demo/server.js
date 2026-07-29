/**
 * Dashboard demo backend.
 *
 * Shows the real production flow:
 *   Admin dashboard (public/index.html)
 *     -> this server
 *       -> Supabase (stores participants)
 *       -> the moment someone is approved, automatically mints their
 *          certificate on-chain (no separate manual step, no terminal
 *          command -- this IS the "auto-mint on approval" requirement,
 *          just triggered by an API call instead of a raw DB webhook,
 *          which is functionally identical from the admin's point of view)
 *
 * Run: node dashboard-demo/server.js
 * Then open: http://localhost:3000
 */
require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// --- Supabase setup ---
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env");
  console.error("See dashboard-demo/SUPABASE_SETUP.md for setup steps.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Blockchain setup (reuses the same contract already deployed) ---
const RPC_URL = process.env.POLYGON_AMOY_RPC_URL;
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const artifact = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "build", "CertificateSBT.json"), "utf8")
);
const deployment = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "build", "deployment.json"), "utf8")
);

let contract = null;
function getContract() {
  if (!contract) {
    if (!RPC_URL || !PRIVATE_KEY) {
      throw new Error("POLYGON_AMOY_RPC_URL and DEPLOYER_PRIVATE_KEY must be set in .env");
    }
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    contract = new ethers.Contract(deployment.address, artifact.abi, wallet);
  }
  return contract;
}

function buildVerificationLink(txHash) {
  return `https://amoy.polygonscan.com/tx/${txHash}`;
}

// --- API routes ---

// List all participants
app.get("/api/participants", async (req, res) => {
  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Register a new participant (the "registration" step)
app.post("/api/participants", async (req, res) => {
  const { name, email, walletAddress, workshopName, workshopDate } = req.body;
  if (!name || !walletAddress || !workshopName) {
    return res.status(400).json({ error: "name, walletAddress, and workshopName are required" });
  }
  const { data, error } = await supabase
    .from("participants")
    .insert([{
      name,
      email,
      wallet_address: walletAddress,
      workshop_name: workshopName,
      workshop_date: workshopDate || null,
    }])
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data[0]);
});

// Approve a participant -> this AUTOMATICALLY triggers minting, right here.
// This is the core of the whole demo: one click, everything downstream
// happens with no further manual action.
app.post("/api/participants/:id/approve", async (req, res) => {
  const { id } = req.params;

  // 1. Mark approved in Supabase
  const { data: updated, error: updateErr } = await supabase
    .from("participants")
    .update({ approval_status: "Approved" })
    .eq("id", id)
    .select();
  if (updateErr) return res.status(500).json({ error: updateErr.message });
  const participant = updated[0];

  // 2. Automatically mint -- no separate step, no manual trigger.
  try {
    const contractInstance = getContract();
    const tx = await contractInstance.issueCertificate(
      participant.wallet_address,
      0, // CertKind.PARTICIPATION
      participant.name,
      participant.workshop_name,
      ""
    );
    const receipt = await tx.wait();

    const parsedLogs = receipt.logs.map((log) => {
      try { return contractInstance.interface.parseLog(log); } catch { return null; }
    });
    const event = parsedLogs.find((e) => e && e.name === "CertificateIssued");
    const tokenId = event ? event.args.tokenId.toString() : null;
    const verificationLink = buildVerificationLink(tx.hash);

    // 3. Write the result back to Supabase so the dashboard shows it live
    const { data: final, error: finalErr } = await supabase
      .from("participants")
      .update({
        certificate_status: "Issued",
        token_id: tokenId,
        tx_hash: tx.hash,
        verification_link: verificationLink,
      })
      .eq("id", id)
      .select();
    if (finalErr) return res.status(500).json({ error: finalErr.message });

    res.json({ success: true, participant: final[0] });
  } catch (mintErr) {
    console.error("Minting failed:", mintErr.message);
    res.status(500).json({ error: `Approved, but minting failed: ${mintErr.message}` });
  }
});

// --- Phase 2: Evaluation routes ---

// List all evaluations
app.get("/api/evaluations", async (req, res) => {
  const { data, error } = await supabase
    .from("evaluations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Submit an evaluation AND mint its certificate in one action -- this is
// the Phase 2 equivalent of "Approve": one click, evaluation is recorded
// AND the graded certificate is minted automatically, no separate step.
app.post("/api/evaluations", async (req, res) => {
  const {
    participantId, participantName, walletAddress, eventName,
    evaluatorName, evaluatorTitle, marksTotal, marksMax, grade,
    evaluationParameters, comments, audioFeedbackUrl,
  } = req.body;

  if (!participantName || !walletAddress || !eventName || !evaluatorName || !grade) {
    return res.status(400).json({
      error: "participantName, walletAddress, eventName, evaluatorName, and grade are required",
    });
  }

  // 1. Save the evaluation record first
  const { data: inserted, error: insertErr } = await supabase
    .from("evaluations")
    .insert([{
      participant_id: participantId || null,
      participant_name: participantName,
      wallet_address: walletAddress,
      event_name: eventName,
      evaluator_name: evaluatorName,
      evaluator_title: evaluatorTitle || "Evaluator",
      marks_total: marksTotal || null,
      marks_max: marksMax || 100,
      grade,
      evaluation_parameters: evaluationParameters || null,
      comments: comments || "",
      audio_feedback_url: audioFeedbackUrl || "",
    }])
    .select();
  if (insertErr) return res.status(500).json({ error: insertErr.message });
  const evaluation = inserted[0];

  // 2. Automatically mint the evaluation certificate -- kind = 1 (EVALUATION)
  try {
    const contractInstance = getContract();
    const tx = await contractInstance.issueCertificate(
      evaluation.wallet_address,
      1, // CertKind.EVALUATION
      evaluation.participant_name,
      evaluation.event_name,
      ""
    );
    const receipt = await tx.wait();

    const parsedLogs = receipt.logs.map((log) => {
      try { return contractInstance.interface.parseLog(log); } catch { return null; }
    });
    const event = parsedLogs.find((e) => e && e.name === "CertificateIssued");
    const tokenId = event ? event.args.tokenId.toString() : null;
    const verificationLink = buildVerificationLink(tx.hash);

    // 3. Write the result back so the dashboard shows it live
    const { data: final, error: finalErr } = await supabase
      .from("evaluations")
      .update({
        certificate_status: "Issued",
        token_id: tokenId,
        tx_hash: tx.hash,
        verification_link: verificationLink,
      })
      .eq("id", evaluation.id)
      .select();
    if (finalErr) return res.status(500).json({ error: finalErr.message });

    res.json({ success: true, evaluation: final[0] });
  } catch (mintErr) {
    console.error("Evaluation minting failed:", mintErr.message);
    res.status(500).json({ error: `Evaluation saved, but minting failed: ${mintErr.message}` });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dashboard demo running at http://localhost:${PORT}`);
});