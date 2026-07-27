// Compiles contracts/CertificateSBT.sol using the solc npm package directly
// (bypasses Hardhat's compiler downloader, which needs network access to
// binaries.soliditylang.org -- not required in restricted / offline CI envs).
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const CONTRACTS_DIR = path.join(__dirname, "..", "contracts");
const BUILD_DIR = path.join(__dirname, "..", "build");
const ENTRY = "CertificateSBT.sol";

function findImports(importPath) {
  const candidates = [
    path.join(CONTRACTS_DIR, importPath),
    path.join(__dirname, "..", "node_modules", importPath),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return { contents: fs.readFileSync(c, "utf8") };
    }
  }
  return { error: `File not found: ${importPath}` };
}

function main() {
  const source = fs.readFileSync(path.join(CONTRACTS_DIR, ENTRY), "utf8");

  const input = {
    language: "Solidity",
    sources: { [ENTRY]: { content: source } },
    settings: {
      evmVersion: "cancun",
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        "*": { "*": ["abi", "evm.bytecode.object", "evm.deployedBytecode.object"] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  if (output.errors) {
    const fatal = output.errors.filter((e) => e.severity === "error");
    output.errors.forEach((e) => console.log(e.formattedMessage));
    if (fatal.length) {
      throw new Error(`Compilation failed with ${fatal.length} error(s).`);
    }
  }

  const contract = output.contracts[ENTRY]["CertificateSBT"];
  const artifact = {
    contractName: "CertificateSBT",
    abi: contract.abi,
    bytecode: "0x" + contract.evm.bytecode.object,
    deployedBytecode: "0x" + contract.evm.deployedBytecode.object,
  };

  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(BUILD_DIR, "CertificateSBT.json"),
    JSON.stringify(artifact, null, 2)
  );

  console.log(`Compiled OK -> build/CertificateSBT.json`);
  console.log(`ABI entries: ${artifact.abi.length}, bytecode size: ${(artifact.bytecode.length - 2) / 2} bytes`);
}

main();
