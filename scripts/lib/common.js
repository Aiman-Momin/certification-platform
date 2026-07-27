const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const ROOT = path.join(__dirname, "..", "..");
const BUILD_DIR = path.join(ROOT, "build");
const METADATA_DIR = path.join(ROOT, "metadata");
const CERTIFICATES_DIR = path.join(ROOT, "certificates");

/**
 * Loads the compiled artifact + deployment address, and returns a connected
 * ethers Contract instance for the CertificateSBT deployed on the currently
 * selected Hardhat network.
 */
async function getContract(signerOverride) {
  const artifact = JSON.parse(
    fs.readFileSync(path.join(BUILD_DIR, "CertificateSBT.json"), "utf8")
  );
  const deployment = JSON.parse(
    fs.readFileSync(path.join(BUILD_DIR, "deployment.json"), "utf8")
  );

  const [defaultSigner] = await hre.ethers.getSigners();
  const signer = signerOverride || defaultSigner;

  const contract = new hre.ethers.Contract(deployment.address, artifact.abi, signer);
  return { contract, deployment };
}

/**
 * Builds the "verification link" for a certificate. In this local prototype
 * this points at a block-explorer-style URL pattern (Polygonscan on Amoy /
 * mainnet); it also doubles as the shareable proof-of-authenticity link that
 * gets emailed to participants.
 */
function buildVerificationLink(networkName, txHash, tokenId) {
  const explorers = {
    amoy: "https://amoy.polygonscan.com",
    matic: "https://polygonscan.com",
    polygon: "https://polygonscan.com",
  };
  const base = explorers[networkName] || "https://amoy.polygonscan.com"; // default target chain for this project
  if (txHash) {
    return `${base}/tx/${txHash}`;
  }
  return `${base}/token/${tokenId}`;
}

function ensureDirs() {
  fs.mkdirSync(METADATA_DIR, { recursive: true });
  fs.mkdirSync(CERTIFICATES_DIR, { recursive: true });
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

module.exports = {
  ROOT,
  BUILD_DIR,
  METADATA_DIR,
  CERTIFICATES_DIR,
  getContract,
  buildVerificationLink,
  ensureDirs,
  readJson,
  writeJson,
};
