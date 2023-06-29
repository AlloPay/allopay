// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import {Hook} from './hooks/Hooks.sol';

type PolicyKey is uint32;

struct Policy {
  PolicyKey key;
  uint8 threshold; /// @dev Each policy may only have up to 256 approvals; constrained by ApprovalsVerifier.MAX_APPROVALS
  address[] approvers;
  Hook[] hooks;
}
