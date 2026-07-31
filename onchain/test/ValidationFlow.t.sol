// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IdentityRegistry, ValidationRegistry} from "../src/ValidationRegistry.sol";

// Minimal cheatcode interface so this stays self-contained (no forge-std).
interface Vm {
    function prank(address) external;
    function expectRevert(bytes4) external;
}

/// End-to-end: Context Capital acts as a re-execution validator on ERC-8004.
/// The on-chain responseHash is the REAL reckn-R1 re-execution commitment from
/// the Context Capital receipt (fixtures/reckn-r1-bundle) — regenerate with:
///   npx tsx -e "import('./src/verify/recompute.js').then(m=>console.log(m.recompute('swe','fixtures/reckn-r1-bundle').commitment))"
contract ValidationFlowTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    IdentityRegistry identity;
    ValidationRegistry validation;

    address agentOwner = address(0xA0); // the human/org operating the agent
    address validator = address(0xCC); // Context Capital, the re-execution validator
    address stranger = address(0xBAD);

    // The verified Receipt's re-execution commitment (reckn-R1, target test passes).
    bytes32 constant RESPONSE_HASH = 0xb61a40402fa247ff4b8890c9a8c0fff19afffe0e6f5380baa822d63a9ef753a9;
    bytes32 constant AGENT_KEY_HASH = keccak256("agent:aegis-swe");
    bytes32 constant TAG = bytes32("reexec");

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

        // 3. Context Capital re-executes off-chain and posts the recomputed result:
        //    response = 100 (passed), responseHash = the verified Receipt's commitment
        vm.prank(validator);
        validation.validationResponse(requestHash, 100, "ipfs://receipt.json", RESPONSE_HASH, TAG);

        // 4. anyone can read the on-chain status
        (address v, uint256 aId, uint8 response, bytes32 rHash, bytes32 tag,) = validation.getValidationStatus(requestHash);
        require(v == validator, "validator mismatch");
        require(aId == agentId, "agentId mismatch");
        require(response == 100, "expected passed");
        require(rHash == RESPONSE_HASH, "responseHash must equal the receipt commitment");
        require(tag == TAG, "tag mismatch");
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
