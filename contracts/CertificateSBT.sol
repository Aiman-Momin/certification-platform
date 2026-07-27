// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title CertificateSBT
/// @notice Soulbound (non-transferable) ERC-721 certificate token used for both
///         Phase 1 (Participation Certificates) and Phase 2 (Evaluation / Graded
///         Certificates) of the Performing Arts certification ecosystem.
/// @dev    Two certificate "kinds" are distinguished on-chain (0 = PARTICIPATION,
///         1 = EVALUATION) so verifiers / explorers can tell them apart without
///         parsing off-chain metadata. Tokens are minted only by wallets holding
///         MINTER_ROLE (the backend service account) and can never be transferred,
///         approved, or traded once issued -- enforced via _update override.
contract CertificateSBT is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    enum CertKind { PARTICIPATION, EVALUATION }

    struct CertificateRecord {
        CertKind kind;
        string participantName;
        string eventName;
        string metadataURI;   // e.g. ipfs://... or https://.../metadata/{id}.json
        uint256 issuedAt;
        address issuedTo;
    }

    uint256 private _tokenIdCounter;
    mapping(uint256 => CertificateRecord) public certificates;
    mapping(uint256 => string) private _tokenURIs;

    event CertificateIssued(
        uint256 indexed tokenId,
        CertKind indexed kind,
        address indexed participant,
        string participantName,
        string metadataURI
    );

    constructor() ERC721("Performing Arts Certificate", "PACERT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /// @notice Mint a new certificate (participation or evaluation) to a participant wallet.
    function issueCertificate(
        address to,
        CertKind kind,
        string calldata participantName,
        string calldata eventName,
        string calldata metadataURI
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        _tokenIdCounter += 1;
        uint256 newId = _tokenIdCounter;

        _safeMint(to, newId);
        _tokenURIs[newId] = metadataURI;

        certificates[newId] = CertificateRecord({
            kind: kind,
            participantName: participantName,
            eventName: eventName,
            metadataURI: metadataURI,
            issuedAt: block.timestamp,
            issuedTo: to
        });

        emit CertificateIssued(newId, kind, to, participantName, metadataURI);
        return newId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    /// @dev Soulbound enforcement: block every transfer except the initial mint
    ///      (from == address(0)) and burns (to == address(0), not exposed here).
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address)
    {
        address from = _ownerOf(tokenId);
        require(from == address(0) || to == address(0), "CertificateSBT: non-transferable (soulbound)");
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
