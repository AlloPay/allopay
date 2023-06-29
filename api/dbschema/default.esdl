module default {
  scalar type Address extending str {
    constraint regexp(r'^0x[0-9a-fA-F]{40}$');
  }

  global current_user_address: Address;
  global current_user := (
    select User filter .address = global current_user_address
  );

  global current_user_accounts_array: array<uuid>;
  global current_user_accounts := (
    select array_unpack(global current_user_accounts_array)
  );

  scalar type Name extending str {
    constraint min_len_value(1);
    constraint max_len_value(50);
  }

  scalar type Bytes extending str {
    constraint regexp(r'0x(?:[0-9a-fA-F]{2})*$');
  }

  scalar type Bytes4 extending str {
    constraint regexp(r'^0x[0-9a-fA-F]{8}$');
  }

  scalar type Bytes32 extending str {
    constraint regexp(r'^0x[0-9a-fA-F]{64}$');
  }

  scalar type uint16 extending int32 {
    constraint min_value(0);
    constraint max_value(2 ^ 16 - 1);
  }

  scalar type uint32 extending int64 {
    constraint min_value(0);
    constraint max_value(2 ^ 32 - 1);
  }

  scalar type uint64 extending bigint {
    constraint min_value(0);
    constraint max_value(2n ^ 64n - 1n);
  }

  scalar type uint224 extending bigint {
    constraint min_value(0);
    constraint max_value(2n ^ 224n - 1n);
  }

  scalar type uint256 extending bigint {
    constraint min_value(0);
    constraint max_value(2n ^ 256n - 1n);
  }

  type User {
    required address: Address { constraint exclusive; }
    name: Name;
    pushToken: str;
    multi link contacts := .<user[is Contact];

    # Anyone select is required due to issue - https://github.com/edgedb/edgedb/issues/5504
    # Ideally we want anyone_insert
    access policy anyone_select_insert
      allow select, insert;

    access policy user_select_update
      allow select, update
      using (.address ?= global current_user_address);
  }

  type Account extending User {
    required isActive: bool;
    required implementation: Address;
    required salt: Bytes32;
    multi link policies := .<account[is Policy];
    multi link proposals := .<account[is Proposal];
    multi link transactionProposals := .<account[is TransactionProposal];
    multi link transfers := .<account[is Transfer];

    # Counteract anyone_select_insert in User, required due to edgedb issue
    access policy deny_public_select
      deny select
      using (.id not in global current_user_accounts);

    access policy members_update
      allow update
      using (.id in global current_user_accounts);
  }

  type Contact {
    required user: User;
    required address: Address;
    required name: Name;

    constraint exclusive on ((.user, .address));
    constraint exclusive on ((.user, .name));

    access policy user_all
      allow all
      using (.user.address ?= global current_user_address);
  }

  abstract type Proposal {
    required hash: Bytes32 {
      constraint exclusive;
    }
    required account: Account;
    policy: Policy;
    label: str {
      constraint min_len_value(1);
      constraint max_len_value(50);
    }
    createdAt: datetime {
      readonly := true;
      default := datetime_of_statement();
    }
    required proposedBy: User {
      readonly := true;
      default := (select User filter .address = global current_user_address);
    }
    multi link responses := .<proposal[is ProposalResponse];
    multi link approvals := .<proposal[is Approval];
    multi link rejections := .<proposal[is Rejection];

    access policy members_only
      allow all
      using (.account.id in global current_user_accounts);
  }

  abstract type ProposalResponse {
    required proposal: Proposal {
      on target delete delete source;
    }
    required user: User;
    createdAt: datetime {
      readonly := true;
      default := datetime_of_statement();
    }

    constraint exclusive on ((.proposal, .user));

    access policy user_all
      allow all
      using (.user.address ?= global current_user_address);

    access policy members_can_select
      allow select
      using (.proposal.account.id in global current_user_accounts);
  }

  type Approval extending ProposalResponse {
    required signature: Bytes;
  }

  type Rejection extending ProposalResponse {}

  type Operation {
    required to: Address;
    value: uint256;
    data: Bytes;
  }

  type TransactionProposal extending Proposal {
    required multi operations: Operation {
      constraint exclusive;
      on source delete delete target;
    }
    required nonce: uint64;
    required gasLimit: uint256 { default := 0n; }
    required feeToken: Address;
    required simulation: Simulation;
    multi link transactions := .<proposal[is Transaction];
    link transaction := (
      select .transactions
      order by .submittedAt desc
      limit 1
    );
    required property status := (
      select assert_exists(<TransactionProposalStatus>(
        'Pending' if (not exists .transaction) else
        'Executing' if (not exists .transaction.receipt) else
        'Successful' if (.transaction.receipt.success) else
        'Failed'
      ))
    );

    constraint exclusive on ((.account, .nonce));
  }

  scalar type TransactionProposalStatus extending enum<'Pending', 'Executing', 'Successful', 'Failed'>;

  type Simulation {
    multi transfers: TransferDetails;
  }

  type Event {
    required account: Account;
    required transactionHash: Bytes32;
    required logIndex: uint32;
    required block: bigint { constraint min_value(0n); }
    required timestamp: datetime { default := datetime_of_statement(); }

    constraint exclusive on ((.block, .logIndex));

    access policy members_can_select
      allow select
      using (.account.id in global current_user_accounts);
  }

  scalar type TransferDirection extending enum<'In', 'Out'>;

  type TransferDetails {
    required account: Account;
    required direction: TransferDirection;
    required from: Address;
    required to: Address;
    required token: Address;
    required amount: bigint;

    access policy members_can_select_insert
      allow select, insert
      using (.account.id in global current_user_accounts);
  }

  abstract type Transferlike extending Event, TransferDetails {}

  type Transfer extending Transferlike {}

  type TransferApproval extending Transferlike {
    link previous := (
      select TransferApproval
      filter .token = .token and .from = .from and .to = .to
      order by .block desc then .logIndex desc
      limit 1
    );
    required property delta := .amount - (.previous.amount ?? 0);
  }

  type Transaction {
    required hash: Bytes32 { constraint exclusive; }
    required proposal: TransactionProposal;
    required gasPrice: uint256;
    required submittedAt: datetime {
      readonly := true;
      default := datetime_of_statement();
    }
    receipt: Receipt { constraint exclusive; }

    access policy members_can_select_insert
      allow select, insert
      using (.proposal.account.id in global current_user_accounts);
  }

  type Receipt {
    required link transaction := assert_exists(.<receipt[is Transaction]);
    required success: bool;
    required responses: array<Bytes>;
    multi link events := (
      with txHash := .transaction.hash
      select Event
      filter .transactionHash = txHash
    );
    required gasUsed: bigint { constraint min_value(0n); }
    required fee: bigint { constraint min_value(0n); }
    required block: bigint { constraint min_value(0n); }
    required timestamp: datetime { default := datetime_of_statement(); }
  }

  type Contract {
    required address: Address {
      constraint exclusive;
    }

    multi functions: Function;
  }

  scalar type AbiSource extending enum<'Verified'>;

  type Function {
    required selector: Bytes4;
    required abi: json;
    required abiMd5: str { constraint exclusive; }
    required source: AbiSource;

    index on (.selector);
  }
}
