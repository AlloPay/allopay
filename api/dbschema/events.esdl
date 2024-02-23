module default {
  type Event {
    required account: Account;
    required systxHash: Bytes32;
    systx: SystemTx;
    result: Result;
    required block: bigint { constraint min_value(0); }
    required logIndex: uint32;
    required timestamp: datetime { default := datetime_of_statement(); }
    required property internal := exists .systx;

    constraint exclusive on ((.account, .block, .logIndex));
    index on ((.account, .internal));

    access policy members_can_select
      allow select
      using (.account in global current_accounts);
  }

  scalar type TransferDirection extending enum<`In`, `Out`>;

  type TransferDetails {
    required account: Account;
    required from: Address;
    required to: Address;
    required tokenAddress: UAddress;
    link token := (
      assert_single((
        with address := .tokenAddress
        select Token filter .address = address
        order by (exists .user) desc
        limit 1
      ))
    );
    required amount: decimal;
    required multi direction: TransferDirection;
    required isFeeTransfer: bool { default := false; }

    access policy members_can_select_insert
      allow select, insert
      using (.account in global current_accounts);
  }

  abstract type Transferlike extending Event, TransferDetails {}

  type Transfer extending Transferlike {}

  type TransferApproval extending Transferlike {
    link previous := (
      select TransferApproval
      filter .tokenAddress = .tokenAddress and .from = .from and .to = .to
      order by .block desc then .logIndex desc
      limit 1
    );
    required property delta := .amount - (.previous.amount ?? 0);
  }
}