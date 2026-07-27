const hre = require("hardhat");
const { getContract } = require("./lib/common");

async function main() {
  const [signer] = await hre.ethers.getSigners();
  const { contract } = await getContract();

  console.log("Wallet being used to mint:", signer.address);

  const balance = await hre.ethers.provider.getBalance(signer.address);
  console.log("Wallet balance:", hre.ethers.formatEther(balance), "POL");

  const MINTER_ROLE = await contract.MINTER_ROLE();
  const hasRole = await contract.hasRole(MINTER_ROLE, signer.address);
  console.log("Does this wallet have MINTER_ROLE?", hasRole);

  const network = await hre.ethers.provider.getNetwork();
  console.log("Connected to chain ID:", network.chainId.toString());
}

main().catch(console.error);