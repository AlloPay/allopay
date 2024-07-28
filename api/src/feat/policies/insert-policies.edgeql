with account := (select Account filter .address = <UAddress>$account),
     txId := <optional uuid>$transaction,
     tx := ((select Transaction filter .id = txId) if exists txId else {})
for p in array_unpack(<array<json>>$policies) union (
  insert Policy {
    account := account,
    key := <uint16>p['key'],
    proposal := tx,
    activationBlock := <bigint><str>p['activationBlock'],
    name := <str>p['name'],
    threshold := <uint16>p['threshold'],
    approvers := (
      for approver in array_unpack(<array<json>>p['approvers']) union (
        insert Approver {
          address := <Address>approver['address'],
        } unless conflict on .address else (select Approver)
      )
    ),
    actions := (
      for action in array_unpack(<array<json>>p['actions']) union (
        insert Action {
          label := <str>action['label'],
          functions := (
            for func in array_unpack(<array<json>>action['functions']) union (
              insert ActionFunction {
                contract := <Address>json_get(func, 'contract'),
                selector := <Bytes4>json_get(func, 'selector'),
                abi := <json>json_get(func, 'abi'),
              }
            )
          ),
          allow := <bool>action['allow'],
          description := <str>json_get(action, 'description'), 
        }
      )
    ),
    transfers := (
      insert TransfersConfig {
        defaultAllow := <bool>p['transfers']['defaultAllow'],
        budget := <uint32>p['transfers']['budget'],
        limits := (
          for l in array_unpack(<array<json>>json_get(p, 'transfers.limits')) union (
            insert TransferLimit {
              token := <Address>l['token'],
              amount := <uint224><str>l['amount'],
              duration := <uint32><str>l['duration'],
            }
          )
        ),
      }
    ),
    allowMessages := <bool>json_get(p, 'allowMessages'),
    delay := <uint32>json_get(p, 'delay'),
  }
)