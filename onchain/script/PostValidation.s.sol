// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IdentityRegistry, ValidationRegistry} from "../src/ValidationRegistry.sol";

interface Vm {
    function startBroadcast() external;
    function stopBroadcast() external;
}

/// Broadcast the full ERC-8004 re-execution validation flow to a public testnet,
/// producing real on-chain transactions + explorer links.
///
/// Run (the broadcaster acts as both agent operator and validator):
///   forge script script/PostValidation.s.sol --rpc-url <TESTNET_RPC> \
///     --private-key <FUNDED_KEY> --broadcast
///
/// response/tag/responseHash carry the held-out CORRECTNESS TIER (held-out-verified
/// here: reckn-R1 passes committed 4/4 + independent held-out 4/4). Regenerate with
///   (cd ../onchain-svm && node scripts/compute-tier.mjs ../fixtures/reckn-r1-heldout)
contract PostValidation {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 constant RESPONSE_HASH = 0x32d758f63d8f84b55b3c9835a52d17341860f288e82f9535c23c4be67711f220;
    bytes32 constant TAG = bytes32("held-out-verified");

    function run() external {
        vm.startBroadcast();
        IdentityRegistry identity = new IdentityRegistry();
        ValidationRegistry validation = new ValidationRegistry(identity);

        uint256 agentId = identity.registerAgent(keccak256("agent:aegis-swe"), "ipfs://agent-card");

        bytes32 requestHash = keccak256("reckn-r1-basefee-nonce:job-request");
        // the broadcaster names itself as the validator for this single-key demo
        validation.validationRequest(msg.sender, agentId, "ipfs://request", requestHash);
        validation.validationResponse(requestHash, 100, "ipfs://receipt.json", RESPONSE_HASH, TAG);

        vm.stopBroadcast();
    }
}
