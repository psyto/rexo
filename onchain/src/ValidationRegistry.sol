// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// Minimal faithful subset of the ERC-8004 Identity + Validation registries.
//
// Purpose: let a re-execution validator (Context Capital) register a
// validationResponse for an agent's job on-chain. Only lightweight commitments
// live here — a 0–100 score, integrity hashes, tag — while the evidence (the
// verified Receipt, the deliverable) lives off-chain at the URIs. This mirrors
// EIP-8004: `validationRequest` (agent owner/operator) → `validationResponse`
// (the named validator only) → `getValidationStatus`.
//
// The spec's Validation Registry is "under active revision"; this is a minimal
// reference to demonstrate the flow end-to-end, not a canonical deployment.

/// Minimal Identity registry — identity is the KEY, not the handle.
contract IdentityRegistry {
    struct Agent {
        address owner;
        bytes32 agentKeyHash; // keccak256 of the agent's public identity key
        string metadataURI;
    }

    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) public agents;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, bytes32 agentKeyHash, string metadataURI);

    function registerAgent(bytes32 agentKeyHash, string calldata metadataURI) external returns (uint256 agentId) {
        agentId = nextAgentId++;
        agents[agentId] = Agent(msg.sender, agentKeyHash, metadataURI);
        emit AgentRegistered(agentId, msg.sender, agentKeyHash, metadataURI);
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        return agents[agentId].owner;
    }

    function agentKeyHashOf(uint256 agentId) external view returns (bytes32) {
        return agents[agentId].agentKeyHash;
    }
}

/// Minimal Validation registry — the plug-in surface for a re-execution validator.
contract ValidationRegistry {
    struct Request {
        address validatorAddress;
        uint256 agentId;
        bytes32 requestHash; // commitment to the off-chain validation inputs
    }
    struct Response {
        uint8 response; // 0 = failed, 100 = passed, in-between = spectrum
        bytes32 responseHash; // commitment to the off-chain evidence (the verified Receipt)
        bytes32 tag; // e.g. "reexec"
        uint256 lastUpdate;
        bool present;
    }

    IdentityRegistry public immutable identity;
    mapping(bytes32 => Request) public requests; // keyed by requestHash
    mapping(bytes32 => Response) public responses; // keyed by requestHash

    event ValidationRequested(bytes32 indexed requestHash, address indexed validatorAddress, uint256 indexed agentId, string requestURI);
    event ValidationResponded(bytes32 indexed requestHash, address indexed validatorAddress, uint8 response, bytes32 responseHash, bytes32 tag);

    error NotAgentOwner();
    error RequestExists();
    error UnknownRequest();
    error NotNamedValidator();
    error BadScore();

    constructor(IdentityRegistry _identity) {
        identity = _identity;
    }

    /// The agent's owner/operator asks a specific validator to validate a job.
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external {
        if (identity.ownerOf(agentId) != msg.sender) revert NotAgentOwner();
        if (requests[requestHash].validatorAddress != address(0)) revert RequestExists();
        requests[requestHash] = Request(validatorAddress, agentId, requestHash);
        emit ValidationRequested(requestHash, validatorAddress, agentId, requestURI);
    }

    /// Only the named validator posts the recomputed result + evidence commitment.
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        bytes32 tag
    ) external {
        Request memory r = requests[requestHash];
        if (r.validatorAddress == address(0)) revert UnknownRequest();
        if (msg.sender != r.validatorAddress) revert NotNamedValidator();
        if (response > 100) revert BadScore();
        responses[requestHash] = Response(response, responseHash, tag, block.timestamp, true);
        emit ValidationResponded(requestHash, msg.sender, response, responseHash, tag);
        // `responseURI` points to the full verified Receipt off-chain.
        responseURI;
    }

    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (address validatorAddress, uint256 agentId, uint8 response, bytes32 responseHash, bytes32 tag, uint256 lastUpdate)
    {
        Request memory req = requests[requestHash];
        Response memory res = responses[requestHash];
        return (req.validatorAddress, req.agentId, res.response, res.responseHash, res.tag, res.lastUpdate);
    }
}
