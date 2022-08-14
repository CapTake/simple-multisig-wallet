 type proposal_action is
  | Send_funds_proposal of address * tez
  | Add_signee_proposal of address
  | Remove_signee_proposal of address
  | Set_vote_threshold_proposal of nat
  | Set_proposal_duration_proposal of int

 type proposal is record [
    action : proposal_action;
    before : timestamp;
    votes  : map(address, bool);
 ]

 type storage is record [
    signees        : set(address);
    threshold      : nat;
    duration       : int;
    proposal_id    : nat;
    proposals      : map(nat, proposal);
 ]

  type vote is [@layout:comb] record [
    proposal_id : nat;
    i_approve   : bool;
  ]

type return is list (operation) * storage

type action is
  | Default
  | Execute of nat
  | Submit of proposal_action
  | Vote of vote

const noop : list (operation) = (nil: list (operation))
const asset_id : nat = 0n
const error_access_denied = "Access denied"
const error_not_a_pending_admin = "Not a pending admin"

 function clean_passed(var m : map(nat, proposal)) : map(nat, proposal)is {
   function folded (var dest : map(nat, proposal); const item : nat * proposal) : map(nat, proposal) is {
     if item.1.before > Tezos.get_now() then dest[item.0] := item.1 else skip;
   } with dest;
 } with Map.fold(folded, m, (map[] : map(nat, proposal)))

  function propose (const p : proposal_action; var s : storage) : return is {
    assert_with_error(s.signees contains Tezos.get_sender(), "Access denied");
    s.proposal_id := s.proposal_id + 1n;
    const proposal : proposal = record [
      action=p;
      before=Tezos.get_now() + s.duration;
      votes=map[];
    ];
    s.proposals[s.proposal_id] := proposal;
  } with (noop,s)

  function vote(const vote : vote; var s : storage) : return is {
    assert_with_error(s.signees contains Tezos.get_sender(), "Access denied");
    s.proposals[vote.proposal_id] := case (s.proposals[vote.proposal_id] : option(proposal)) of [
      | None -> (failwith("Unknown proposal ID") : proposal)
      | Some(a) -> {
        var p : proposal := a;
        p.votes[Tezos.get_sender()] := vote.i_approve;
       } with p
    ];
  } with(noop, s)

  function execute(const id : nat; var s : storage) : return is {
    assert_with_error(s.signees contains Tezos.get_sender(), "Access denied");
    const proposal : proposal = case (s.proposals[id] : option(proposal)) of [
      | None -> (failwith("Unknown proposal ID") : proposal)
      | Some(p) -> {
        function folded (const pro : nat; const vote : address * bool) : nat is pro + (if vote.1 then 1n else 0n);
        assert_with_error(Map.fold(folded, p.votes, 0n) >= s.threshold, "Vote threshold not reached");
       } with p
    ];
    s.proposals := Map.remove(id, s.proposals);
  } with case proposal.action of [
      | Send_funds_proposal(param) -> {
          const dest : contract(unit) = (Tezos.get_contract_with_error(param.0, "Bad destination address") : contract(unit));
        } with (list[Tezos.transaction(unit, param.1, dest)], s)
      | Add_signee_proposal(address) -> {
          s.signees := Set.add(address, s.signees);
        } with (noop, s)
      | Remove_signee_proposal(address) -> {
          assert_with_error(Set.cardinal(s.signees) > 1n, "Can't remove the last signee");
          s.signees := Set.remove(address, s.signees);
          if s.threshold > Set.cardinal(s.signees) then s.threshold := Set.cardinal(s.signees) else skip;
        } with (noop, s)
      | Set_vote_threshold_proposal(n) -> {
          assert_with_error(Set.cardinal(s.signees) >= n and n > 0n, "Threshold value makes no sense");
          s.threshold := n;
        } with (noop, s)
      | Set_proposal_duration_proposal(seconds) -> {
          s.duration := seconds;
        } with (noop, s)
    ]

  function main(const action : action; var s : storage) : return is {
    s.proposals := clean_passed(s.proposals);
  } with case action of [
      | Default -> (noop, s)
      | Execute(p) -> execute(p, s)
      | Submit(p) -> propose(p, s)
      | Vote(p) -> vote(p, s)
  ]
