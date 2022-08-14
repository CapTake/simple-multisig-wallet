#include "../partial/fa2_types.ligo"
#include "../partial/fa2_errors.ligo"

 type storage is record [
    admin          : address;
    pending_admin  : option(address);
    ledger         : big_map (address, nat);
    metadata       : big_map (string, bytes);
    operators      : big_map (owner * address, unit);
    token_metadata : big_map (token_id, token_meta);
 ]

type return is list (operation) * storage

type mint_params is [@layout:comb] record [
  target: address;
  amount: nat;
]

type action is
  | Balance_of of balance_of_params
  | Confirm_admin
  | Mint of mint_params
  | Set_admin of option(address)
  | Transfer of transfer_params
  | Update_operators of update_operator_params

const noop : list (operation) = (nil: list (operation))
const asset_id : nat = 0n
const error_access_denied = "Access denied"
const error_not_a_pending_admin = "Not a pending admin"

  [@inline]
  function get_balance(const owner : owner; const s : storage) : amt is
    case s.ledger[owner] of [
      | None -> 0n
      | Some(a) -> a
    ]

  [@inline]
  function iterate_transfer (var s : storage; const param : transfer_param) : storage is block {
      const from_ : owner = param.from_;
      (* Perform single transfer *)
      function make_transfer(var s : storage; const tx : tx) : storage is 
        begin
          if tx.token_id =/= asset_id then failwith(fa2_token_undefined) else skip;
          
          assert_with_error(from_ = Tezos.sender or Big_map.mem((from_, Tezos.sender), s.operators), fa2_not_operator);

          var sender_balance : amt := get_balance(from_, s);
          if sender_balance < tx.amount then failwith(fa2_insufficient_balance) else skip;
          (* transfer only to different address, and not 0 amount, but not fail *)
          if (from_ = tx.to_) or (tx.amount = 0n) then skip else {
            const dest_balance : amt = get_balance(tx.to_, s);

            s.ledger[from_] := abs(sender_balance - tx.amount);

            if s.ledger[from_] = Some(0n) then s.ledger := Big_map.remove(from_, s.ledger) else skip;

            s.ledger[tx.to_] := dest_balance + tx.amount;
          };
        end with s;
    } with (List.fold(make_transfer, param.txs, s))

 function fa2_transfer(const p : transfer_params; var s : storage) : return is 
   (noop, List.fold(iterate_transfer, p, s))

 function fa2_balance_of(const params : balance_of_params; const s : storage) : return is
    begin
      function get_balance_response (const r : balance_of_request) : balance_of_response is
        record[
          balance = if asset_id = r.token_id then get_balance(r.owner, s) else (failwith(fa2_token_undefined) : amt);
          request = r;
        ];
    end with (list [Tezos.transaction(List.map(get_balance_response, params.requests), 0tz, params.callback)], s)

  function update_operator (var s : storage; const p : update_operator) : storage is block {
    case p of [
    | Add_operator(param) -> {
      (* Token id check *)
      if asset_id =/= param.token_id then failwith(fa2_token_undefined)
      else skip;
      
      (* Check an owner *)
      if Tezos.sender =/= param.owner then failwith(fa2_not_owner)
      else s.operators[(param.owner, param.operator)] := unit
    }
    | Remove_operator(param) -> {
      (* Token id check *)
      if asset_id =/= param.token_id then failwith(fa2_token_undefined)
      else skip;
      
      (* Check an owner *)
      if Tezos.sender =/= param.owner then failwith(fa2_not_owner)
      else s.operators := Big_map.remove((param.owner, param.operator), s.operators);
    }
    ]
  } with s

  function fa2_update_operators(const commands : update_operator_params; var s : storage) : return is
    (noop, List.fold(update_operator, commands, s))
  
  function mint(const p : mint_params; var s : storage) : return is block {
    assert_with_error(Tezos.sender = s.admin, error_access_denied);
    s.ledger[p.target] := case (s.ledger[p.target] : option(nat)) of [
      | None -> p.amount
      | Some(a) -> a + p.amount
    ];
  } with (noop, s)

  function set_admin(const p : option(address); var s : storage) : return is block {
    assert_with_error(Tezos.sender = s.admin, error_access_denied);
    s.pending_admin := p;
  } with (noop, s)


  function confirm_admin(var s : storage) : return is block {
    assert_with_error(Some(Tezos.sender) = s.pending_admin, error_not_a_pending_admin);
    s.pending_admin := (None: option(address));
    s.admin := Tezos.sender;
  } with (noop, s)

  function main(const action : action; var s : storage) : return is
    case action of [
      | Balance_of(p) -> fa2_balance_of(p, s)
      | Confirm_admin -> confirm_admin(s)
      | Mint(p) -> mint(p, s)
      | Set_admin(p) -> set_admin(p, s)
      | Transfer(p) -> fa2_transfer(p, s)
      | Update_operators(p) -> fa2_update_operators(p, s)
    ]

  [@view]
  function balance_of(const p : list(balance_of_request); const s : storage) : list(balance_of_response) is
    begin
      function get_balance_response (const r : balance_of_request) : balance_of_response is
        record[
          balance = if asset_id = r.token_id then get_balance(r.owner, s) else (failwith(fa2_token_undefined) : amt);
          request = r;
        ];
    end with List.map(get_balance_response, p)