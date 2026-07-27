const hre = require("hardhat");
const { getContract } = require("./lib/common");

async function main() {
  const { contract } = await getContract();
  const [owner, alice, , , bob] = await hre.ethers.getSigners();

  console.log("=== On-chain certificate records ===");
  for (let id = 1; id <= 3; id++) {
    const rec = await contract.certificates(id);
    const tokenOwner = await contract.ownerOf(id);
    console.log(
      `Token #${id} | kind=${rec.kind === 0n ? "PARTICIPATION" : "EVALUATION"} | name="${rec.participantName}" | event="${rec.eventName}" | owner=${tokenOwner}`
    );
  }

  console.log("\n=== Soulbound enforcement check ===");
  try {
    const tokenOwnerAddr = await contract.ownerOf(1);
    const signerForToken = tokenOwnerAddr.toLowerCase() === alice.address.toLowerCase() ? alice : owner;
    const asOwner = contract.connect(signerForToken);
    await asOwner.transferFrom(tokenOwnerAddr, bob.address, 1);
    console.log("UNEXPECTED: transfer succeeded (soulbound enforcement FAILED)");
  } catch (err) {
    console.log("OK: transfer correctly reverted ->", err.reason || err.shortMessage || err.message.split("\n")[0]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
