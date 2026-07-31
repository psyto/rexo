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
/// The responseHash is the REAL reckn-R1 verified-receipt commitment.
contract PostValidation {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 constant RESPONSE_HASH = 0xb61a40402fa247ff4b8890c9a8c0fff19afffe0e6f5380baa822d63a9ef753a9;
    bytes32 constant TAG = bytes32("reexec");

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
