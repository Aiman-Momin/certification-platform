// Deploys CertificateSBT using the artifact produced by scripts/compile.js.
// Runs against Hardhat's in-process network by default (npx hardhat run
// scripts/deploy.js) or against Polygon Amoy if run with --network amoy
// (after filling in .env, see .env.example).
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  const artifactPath = path.join(__dirname, "..", "build", "CertificateSBT.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const factory = new hre.ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("CertificateSBT deployed at:", address);

  const deploymentInfo = {
    network: hre.network.name,
    address,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    abiPath: "build/CertificateSBT.json",
  };
  fs.writeFileSync(
    path.join(__dirname, "..", "build", "deployment.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("Saved deployment info -> build/deployment.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
