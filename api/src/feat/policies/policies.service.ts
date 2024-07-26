import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ACCOUNT_ABI,
  asAddress,
  asPolicyKey,
  encodePolicy,
  encodePolicyStruct,
  validateMessage,
  validateTransaction,
  Policy,
  Address,
  UAddress,
  PLACEHOLDER_ACCOUNT_ADDRESS,
  Tx,
  UUID,
  asUUID,
} from 'lib';
import { TransactionsService } from '../transactions/transactions.service';
import {
  CreatePolicyInput,
  UniquePolicyInput,
  UpdatePoliciesInput,
  UpdatePolicyInput,
} from './policies.input';
import { UserInputError } from '@nestjs/apollo';
import { AccountsCacheService } from '../auth/accounts.cache.service';
import { DatabaseService } from '~/core/database';
import e from '~/edgeql-js';
import { ShapeFunc } from '~/core/database';
import {
  policyStateAsPolicy,
  PolicyShape,
  policyInputAsStateShape,
  selectPolicy,
  latestPolicy2,
} from './policies.util';
import { NameTaken, PolicyEvent, Policy as PolicyModel, ValidationError } from './policies.model';
import {
  TX_SHAPE,
  transactionAsTx,
  ProposalTxShape,
  selectTransaction,
} from '../transactions/transactions.util';
import { and, isExclusivityConstraintViolation } from '~/core/database';
import { selectAccount, selectAccount2 } from '../accounts/accounts.util';
import { err, ok } from 'neverthrow';
import { encodeFunctionData } from 'viem';
import { $Transaction } from '~/edgeql-js/modules/default';
import { getUserCtx } from '~/core/context';
import { PubsubService } from '~/core/pubsub/pubsub.service';

export const MIN_AUTO_POLICY_KEY = 32; // 2^5; keys [0, 31] are reserved for manual keys

export interface PolicyUpdatedPayload {
  event: PolicyEvent;
  account: UAddress;
  policyId: UUID;
}
const policyUpdatedTrigger = (account: UAddress) => `account.policy:${account}`;

export interface CreatePolicyParams extends CreatePolicyInput {
  initState?: boolean;
}

@Injectable()
export class PoliciesService {
  constructor(
    private db: DatabaseService,
    @Inject(forwardRef(() => TransactionsService))
    private transactions: TransactionsService,
    private userAccounts: AccountsCacheService,
    private pubsub: PubsubService,
  ) {}

  async selectUnique(id: UUID, shape?: ShapeFunc) {
    return this.db.queryWith2({ id: e.uuid }, { id }, ({ id }) =>
      e.select(e.Policy, (p) => ({
        filter_single: { id },
        ...shape?.(p),
      })),
    );
  }

  async latest(unique: { account: UAddress; key: number }, shape?: ShapeFunc) {
    return (await this.db.queryWith(
      { account: e.UAddress, key: e.int64 },
      ({ account, key }) => e.select(latestPolicy2(account, key), (p) => ({ ...shape?.(p) })),
      { account: unique.account, key: unique.key },
    )) as unknown as PolicyModel | null;
  }

  async policies(ids: UUID[], shape?: ShapeFunc) {
    if (!ids.length) return [];

    return await this.db.queryWith(
      { ids: e.array(e.uuid) },
      ({ ids }) =>
        e.select(e.Policy, (p) => ({
          filter: e.op(p.id, 'in', e.array_unpack(ids)),
          ...shape?.(p),
        })),
      { ids },
    );
  }

  async create({ account, name, key, initState, ...policyInput }: CreatePolicyParams) {
    key ??= await this.getNextKey(account);

    const state = policyInputAsStateShape(key, policyInput);
    const proposal =
      !initState && (await this.getStateProposal(account, policyStateAsPolicy(state)));

    try {
      const { id } = await this.db.query(
        e.insert(e.Policy, {
          account: selectAccount(account),
          key,
          name: name || `Policy ${key}`,
          ...(proposal && { proposal: selectTransaction(proposal) }),
          ...this.insertStateShape(state, initState ? { account: asAddress(account) } : undefined),
        }),
      );

      this.userAccounts.invalidateApproversCache(...policyInput.approvers);

      this.event({ event: PolicyEvent.created, account, policyId: asUUID(id) });

      return ok({ id, account, key });
    } catch (e) {
      // May occur due to key or name uniqueness; key however is only accepted internally so it must be by name
      if (isExclusivityConstraintViolation(e))
        return err(new NameTaken('A policy with this name already exists'));

      throw e;
    }
  }

  async update({ account, key, name, ...policyInput }: UpdatePolicyInput) {
    // Metadata
    if (name !== undefined) {
      const updatedPolicies = await this.db.queryWith(
        { account: e.UAddress, key: e.int64 },
        ({ account, key }) =>
          e.update(e.Policy, (p) => ({
            filter: and(e.op(p.account, '=', selectAccount2(account)), e.op(p.key, '=', key)),
            set: { name },
          })),
        { account, key },
      );

      if (!updatedPolicies.length) throw new UserInputError("Policy doesn't exist");
    }

    // State
    if (Object.values(policyInput).some((v) => v !== undefined)) {
      // Get existing policy state
      // If approvers, threshold, or permissions are undefined then modify the policy accordingly
      // Propose new state
      const existing = await this.db.queryWith(
        { account: e.UAddress, key: e.int64 },
        ({ account, key }) =>
          e.select(latestPolicy2(account, key), (p) => ({
            draft: e.select(p.draft.is(e.Policy), () => PolicyShape),
            ...PolicyShape,
          })),
        { account, key },
      );
      if (!existing) throw new UserInputError("Policy doesn't exist");

      const currentState = existing.draft ?? existing;
      const currentPolicy = policyStateAsPolicy(currentState);

      const newState = policyInputAsStateShape(key, policyInput, currentState);
      const newPolicy = policyStateAsPolicy(newState);
      // TODO: update existing Policy object directly if equivalent
      if (encodePolicy(currentPolicy) === encodePolicy(newPolicy)) return ok(undefined); // Only update if policy would actually change

      const id = await this.db.query(
        e.insert(e.Policy, {
          account: selectAccount(account),
          key,
          name: name || selectPolicy({ account, key }).name,
          proposal: selectTransaction(await this.getStateProposal(account, newPolicy)),
          ...this.insertStateShape(newState),
        }).id,
      );

      this.userAccounts.invalidateApproversCache(
        ...newState.approvers.map((a) => asAddress(a.address)),
      );

      this.event({ event: PolicyEvent.created, account, policyId: asUUID(id) });
    }
  }

  async updatePolicies({ account, policies }: UpdatePoliciesInput) {
    const metadataUpdates = policies.filter((p) => p.name);
    if (metadataUpdates.length) {
      await this.db.queryWith(
        { policies: e.array(e.tuple({ account: e.UAddress, key: e.uint16, name: e.str })) },
        ({ policies }) =>
          e.for(e.cast(e.json, e.array_unpack(policies)), (p) =>
            e.update(latestPolicy2(e.cast(e.UAddress, p.account), e.cast(e.int64, p.key)), () => ({
              set: { name: e.cast(e.str, p.name) },
            })),
          ),
        {
          policies: metadataUpdates.map((p) => ({ account: p.account, key: p.key, name: p.name! })),
        },
      );
    }

    const existingPolicies = await this.db.queryWith(
      { policies: e.array(e.tuple({ account: e.UAddress, key: e.uint16 })) },
      ({ policies }) =>
        e.for(e.cast(e.json, e.array_unpack(policies)), (p) =>
          e.select(latestPolicy2(e.cast(e.UAddress, p.account), e.cast(e.int64, p.key)), (p) => ({
            draft: e.select(p.draft.is(e.Policy), () => PolicyShape),
            name: true,
            ...PolicyShape,
          })),
        ),
      { policies: policies.map((p) => ({ account: p.account, key: p.key })) },
    );

    const toUpdate = policies
      .map((p, i) => {
        const existing = existingPolicies[i];
        if (!existing)
          throw new UserInputError(`Policy doesn't exist: account=${p.account} key=${p.key}`);

        const currentState = existing.draft ?? existing;
        const currentPolicy = policyStateAsPolicy(currentState);

        const newState = policyInputAsStateShape(p.key, p, currentState);
        const newPolicy = policyStateAsPolicy(newState);
        // TODO: update existing Policy object directly if equivalent
        if (encodePolicy(currentPolicy) === encodePolicy(newPolicy)) return undefined; // Only update if policy would actually change

        return {
          account: p.account,
          state: newState,
          policy: newPolicy,
          name: p.name || existing.name,
        };
      })
      .filter(Boolean);

    if (!toUpdate.length) return;

    const transaction = await this.transactions.propose({
      label: 'Update ' + (toUpdate.length === 1 ? 'policy' : 'policies'),
      account,
      operations: toUpdate.map((p) => ({
        to: asAddress(p.account),
        data: encodeFunctionData({
          abi: ACCOUNT_ABI,
          functionName: 'addPolicy',
          args: [encodePolicyStruct(p.policy)],
        }),
      })),
    });

    const insertedPolicies = await this.db.query(
      e.select(
        e.set(
          ...toUpdate.map((p) =>
            e.insert(e.Policy, {
              account: selectAccount(account),
              key: p.policy.key,
              name: p.name,
              proposal: selectTransaction(transaction),
              ...this.insertStateShape(p.state),
            }),
          ),
        ).id,
      ),
    );

    this.userAccounts.invalidateApproversCache(
      ...toUpdate.flatMap((p) => p.state.approvers).map((a) => asAddress(a.address)),
    );

    const ids = (Array.isArray(insertedPolicies) ? insertedPolicies : [insertedPolicies]).map(
      asUUID,
    );

    ids.map((policyId) => this.event({ event: PolicyEvent.updated, account, policyId }));

    return ids;
  }

  async remove({ account, key }: UniquePolicyInput) {
    const policy = await this.db.query(
      e.select(selectPolicy({ account, key }), (p) => ({
        isActive: true,
        removalDrafted: e.op('exists', p.draft.is(e.RemovedPolicy)),
      })),
    );
    if (!policy || policy.removalDrafted) return;

    const transaction =
      policy.isActive &&
      (await this.transactions.propose({
        account,
        operations: [
          {
            to: asAddress(account),
            data: encodeFunctionData({
              abi: ACCOUNT_ABI,
              functionName: 'removePolicy',
              args: [key],
            }),
          },
        ],
      }));

    await this.db.queryWith2(
      { account: e.UAddress, key: e.uint16, transaction: e.optional(e.uuid) },
      { account, key, transaction: transaction || undefined },
      ({ account, key, transaction }) =>
        e.insert(e.RemovedPolicy, {
          account: selectAccount2(account),
          key,
          proposal: e.select(e.Transaction, () => ({ filter_single: { id: transaction } })),
        }),
    );
  }

  validate(proposal: Tx | 'message' | null, policy: Policy | null) {
    if (!proposal) return [{ reason: 'Proposal not found', operation: -1 }];
    if (!policy) return [{ reason: 'Policy not active', operation: -1 }];

    const errors =
      proposal === 'message' ? validateMessage(policy) : validateTransaction(policy, proposal);

    return errors.map((e) => ({ reason: e.reason, operation: e.operation ?? -1 }));
  }

  async validateProposal(proposal: UUID, state: PolicyShape): Promise<ValidationError[]> {
    if (!state) return [{ reason: 'Policy not active' }];

    const p = await this.db.query(
      e.select(e.Proposal, () => ({
        filter_single: { id: proposal },
        __type__: { name: true },
        ...e.is(e.Transaction, TX_SHAPE),
        timestamp: true,
      })),
    );
    if (!p) return [{ reason: 'Proposal not found' }];

    return this.validate(
      p.__type__.name === $Transaction['__name__']
        ? transactionAsTx(p as ProposalTxShape)
        : 'message',
      policyStateAsPolicy(state),
    );
  }

  async best(account: UAddress, proposal: Tx | 'message') {
    const policies = await this.db.queryWith(
      { account: e.UAddress },
      ({ account }) =>
        e.select(selectAccount2(account).policies, (p) => ({
          id: true,
          isActive: true,
          ...PolicyShape,
        })),
      { account },
    );
    if (policies.length === 0)
      throw new UserInputError('No policies for account. Account is bricked');

    const { approver } = getUserCtx();
    const sorted = policies
      .map((p) => {
        const policy = policyStateAsPolicy(p);
        const validationErrors = this.validate(proposal, policy);
        const threshold = policy.threshold - Number(policy.approvers.has(approver)); // Expect the proposer to approve

        return { id: p.id, validationErrors, ...policy, threshold, isActive: p.isActive };
      })
      .sort(
        (a, b) =>
          Number(a.validationErrors.length) - Number(b.validationErrors.length) ||
          Number(b.isActive) - Number(a.isActive) ||
          a.permissions.delay - b.permissions.delay ||
          a.threshold - b.threshold,
      );

    const p = sorted[0];
    return {
      policyId: p.id,
      policy: e.assert_exists(e.select(e.Policy, () => ({ filter_single: { id: p.id } }))),
      policyKey: p.key,
      validationErrors: p.validationErrors,
    };
  }

  subscribe(accounts: UAddress[] = getUserCtx().accounts.map((a) => a.address)) {
    return this.pubsub.asyncIterator(accounts.map(policyUpdatedTrigger));
  }

  event(payload: PolicyUpdatedPayload) {
    this.pubsub.event<PolicyUpdatedPayload>(policyUpdatedTrigger(payload.account), payload);
  }

  private insertStateShape(p: NonNullable<PolicyShape>, initState?: { account: Address }) {
    if (initState) {
      p.actions = p.actions.map((a) => {
        const functions = a.functions.map((f) => ({
          ...f,
          contract: f.contract === PLACEHOLDER_ACCOUNT_ADDRESS ? initState.account : f.contract,
        }));

        return { ...a, functions: functions as [(typeof functions)[0], ...typeof functions] };
      });
    }

    return {
      ...(initState && { activationBlock: 0n }),
      approvers: e.for(e.cast(e.str, e.set(...p.approvers.map((a) => a.address))), (approver) =>
        e.insert(e.Approver, { address: e.cast(e.str, approver) }).unlessConflict((approver) => ({
          on: approver.address,
          else: approver,
        })),
      ),
      threshold: p.threshold || p.approvers.length,
      actions: e.for(e.cast(e.json, e.set(...p.actions.map((a) => e.json(a)))), (a) =>
        e.insert(e.Action, {
          label: e.cast(e.BoundedStr, a.label),
          functions: e.for(e.json_array_unpack(a.functions), (f) =>
            e.insert(e.ActionFunction, {
              contract: e.cast(e.Address, e.json_get(f, 'contract')),
              selector: e.cast(e.Bytes4, e.json_get(f, 'selector')),
              abi: e.cast(e.json, e.json_get(f, 'abi')),
            }),
          ),
          allow: e.cast(e.bool, a.allow),
          description: e.cast(e.str, e.json_get(a, 'description')),
        }),
      ),
      transfers: e.insert(e.TransfersConfig, {
        defaultAllow: p.transfers.defaultAllow,
        budget: p.transfers.budget,
        limits: e.for(e.cast(e.json, e.set(...p.transfers.limits.map((l) => e.json(l)))), (limit) =>
          e.insert(e.TransferLimit, {
            token: e.cast(e.Address, limit.token),
            amount: e.cast(e.uint224, e.cast(e.str, limit.amount)),
            duration: e.cast(e.uint32, limit.duration),
          }),
        ),
      }),
      allowMessages: p.allowMessages,
      delay: p.delay,
    } satisfies Partial<Parameters<typeof e.insert<typeof e.Policy>>[1]>;
  }

  private async getStateProposal(account: UAddress, policy: Policy) {
    return await this.transactions.propose({
      account,
      operations: [
        {
          to: asAddress(account),
          data: encodeFunctionData({
            abi: ACCOUNT_ABI,
            functionName: 'addPolicy',
            args: [encodePolicyStruct(policy)],
          }),
        },
      ],
    });
  }

  private async getNextKey(account: UAddress) {
    const maxKey = (await this.db.query(e.select(e.max(selectAccount(account).policies.key)))) as
      | number
      | null;

    return asPolicyKey(Math.max(MIN_AUTO_POLICY_KEY, maxKey !== null ? maxKey + 1 : 0));
  }
}
