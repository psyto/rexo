// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IdentityRegistry, ValidationRegistry} from "../src/ValidationRegistry.sol";

// Minimal cheatcode interface so this stays self-contained (no forge-std).
interface Vm {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

/// End-to-end: Rexo acts as a re-execution validator on ERC-8004, and carries the
/// held-out CORRECTNESS TIER on-chain via the standard fields (not just pass/fail):
///   response (0..100) = assurance the tier deserves, tag = tier label,
///   responseHash = reproducible commitment to the re-execution facts.
/// The tier is derived by re-running committed + INDEPENDENT held-out suites —
/// regenerate the hashes/tags with:
///   (cd ../onchain-svm && node scripts/compute-tier.mjs ../fixtures/reckn-r1-heldout)
///   (cd ../onchain-svm && node scripts/compute-tier.mjs ../fixtures/swe-heldout-catch)
contract ValidationFlowTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    IdentityRegistry identity;
    ValidationRegistry validation;

    address agentOwner = address(0xA0); // the human/org operating the agent
    address validator = address(0xCC); // Rexo, the re-execution validator
    address stranger = address(0xBAD);

    // held-out-verified: reckn-R1 fix passes committed 4/4 AND an independent
    // held-out suite 4/4 → response 100, tag "held-out-verified".
    bytes32 constant RESPONSE_HASH = 0x32d758f63d8f84b55b3c9835a52d17341860f288e82f9535c23c4be67711f220;
    bytes32 constant TAG = bytes32("held-out-verified");
    // held-out-FAILED: a patch that passes its OWN tests (3/3) but the held-out
    // suite catches it (0/2) → response 0, tag "held-out-FAILED" (pass-but-wrong).
    bytes32 constant FAILED_HASH = 0xee80a0a3c889a142766cce5d4c7652ee35773ffe0a03d2740cc1803801902d2e;
    bytes32 constant FAILED_TAG = bytes32("held-out-FAILED");
    bytes32 constant AGENT_KEY_HASH = keccak256("agent:aegis-swe");

    function setUp() public {
        identity = new IdentityRegistry();
        validation = new ValidationRegistry(identity);
    }

    function test_reexec_validator_posts_response() public {
        // 1. the operator registers the agent (identity = key hash)
        vm.prank(agentOwner);
        uint256 agentId = identity.registerAgent(AGENT_KEY_HASH, "ipfs://agent-card");

        // 2. the operator requests validation from Context Capital
        bytes32 requestHash = keccak256("reckn-r1-basefee-nonce:job-request");
        vm.prank(agentOwner);
        validation.validationRequest(validator, agentId, "ipfs://request", requestHash);

        // 3. Rexo re-executes committed + held-out off-chain and posts the tier:
        //    held-out-verified → response 100, tag "held-out-verified"
        vm.prank(validator);
        validation.validationResponse(requestHash, 100, "ipfs://receipt.json", RESPONSE_HASH, TAG);

        // 4. anyone can read the tier on-chain
        (address v, uint256 aId, uint8 response, bytes32 rHash, bytes32 tag,) = validation.getValidationStatus(requestHash);
        require(v == validator, "validator mismatch");
        require(aId == agentId, "agentId mismatch");
        require(response == 100, "held-out-verified must post 100");
        require(rHash == RESPONSE_HASH, "responseHash must equal the tier commitment");
        require(tag == TAG, "tag must be held-out-verified");
    }

    /// The honest half: a patch that passes its own tests but the independent
    /// held-out suite catches is recorded as tier held-out-FAILED (response 0),
    /// NOT a cosmetic 100 — the on-chain record can't launder a wrong deliverable.
    function test_heldout_failed_records_zero_tier() public {
        vm.prank(agentOwner);
        uint256 agentId = identity.registerAgent(AGENT_KEY_HASH, "ipfs://agent-card");
        bytes32 requestHash = keccak256("median-even-length-bug:job-request");
        vm.prank(agentOwner);
        validation.validationRequest(validator, agentId, "ipfs://request", requestHash);

        vm.prank(validator);
        validation.validationResponse(requestHash, 0, "ipfs://receipt.json", FAILED_HASH, FAILED_TAG);

        (, , uint8 response, bytes32 rHash, bytes32 tag,) = validation.getValidationStatus(requestHash);
        require(response == 0, "held-out-FAILED must post 0");
        require(rHash == FAILED_HASH, "responseHash must equal the failed-tier commitment");
        require(tag == FAILED_TAG, "tag must be held-out-FAILED");
    }

    function test_only_named_validator_can_respond() public {
        vm.prank(agentOwner);
        uint256 agentId = identity.registerAgent(AGENT_KEY_HASH, "ipfs://agent-card");
        bytes32 requestHash = keccak256("req2");
        vm.prank(agentOwner);
        validation.validationRequest(validator, agentId, "ipfs://request", requestHash);

        // a stranger cannot post a response for someone else's named validation
        vm.prank(stranger);
        vm.expectRevert(ValidationRegistry.NotNamedValidator.selector);
        validation.validationResponse(requestHash, 100, "ipfs://x", RESPONSE_HASH, TAG);
    }

    function test_only_agent_owner_can_request() public {
        vm.prank(agentOwner);
        uint256 agentId = identity.registerAgent(AGENT_KEY_HASH, "ipfs://agent-card");
        // a stranger cannot request validation on an agent they don't own
        vm.prank(stranger);
        vm.expectRevert(ValidationRegistry.NotAgentOwner.selector);
        validation.validationRequest(validator, agentId, "ipfs://request", keccak256("req3"));
    }
}
