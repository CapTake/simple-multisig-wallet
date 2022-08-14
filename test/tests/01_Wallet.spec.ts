import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import contractJson from "../../build/Wallet.json";
import { expect } from "chai";
import { rejects } from "assert";

// jest.setTimeout(50000);

const alice = {
  pkh: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
  sk: "edsk3QoqBuvdamxouPhin7swCvkQNgq4jP5KZPbwWNnwdZpSpJiEbq",
  pk: "edpkvGfYw3LyB1UcCahKQk4rF2tvbMUk8GFiTuMjL75uGXrpvKXhjn",
};
const bob = {
  pk: "edpkurPsQ8eUApnLUJ9ZPDvu98E8VNj4KtJa1aZr16Cr5ow5VHKnz4",
  pkh: "tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
  sk: "edsk3RFfvaFaxbHx8BMtEW1rKQcPtDML3LXjNqMNLCzC3wLC1bWbAt"
};

const rpcUrl = "https://rpc.jakartanet.teztnets.xyz";

let contractAddress = "";
let TezosAlice;
let TezosBob;
let aliceSigner;
let bobSigner;

before("setup", async () => {
  // sets up the Tezos toolkit instance with Alice as a signer
  TezosAlice = new TezosToolkit(rpcUrl);
  aliceSigner = new InMemorySigner(alice.sk);
  TezosAlice.setSignerProvider(aliceSigner);
  // sets up the Tezos toolkit instance with Bob as a signer
  TezosBob = new TezosToolkit(rpcUrl);
  bobSigner = new InMemorySigner(bob.sk);
  TezosBob.setSignerProvider(bobSigner);

});

describe("Origination of contract", () => {
  it("Should originate the contract", async () => {
    try {
      const originationOp = await TezosAlice.contract.originate({
        code: contractJson.michelson,
        storage: {
          signees: [alice.pkh],
          threshold: 1,
          duration: 3600,
          proposal_id: 0,
          proposals: new MichelsonMap()
        }
      });
      await originationOp.confirmation();
      contractAddress = originationOp.contractAddress;
      expect(originationOp.hash).to.be.a('string');
      expect(contractAddress).to.be.a('string');
      let op = await TezosAlice.contract.transfer({ to: contractAddress, amount: 1000000, mutez: true })
      await op.confirmation(1)
      op = await TezosAlice.contract.transfer({ to: bob.pkh, amount: 1000000, mutez: true })
      await op.confirmation(1)
    } catch (error) {
      // console.error(error);
      expect(error).to.be.undefined;
    }
  });
});

describe("Tests for proposals", () => {
  it("Should prevent Bob from creating a proposal", async () => {
    try {
      const contract = await TezosBob.contract.at(contractAddress);
      const amount = 10

      await rejects(contract.methods.send_funds_proposal(alice.pkh, amount).send(), (err: Error) => {
          expect(err.message).to.equal("Access denied");
          return true;
      });
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  });
  it("Should let Alice to proposal Bob as signee", async () => {
    try {
      const contract = await TezosAlice.contract.at(contractAddress)
      const storage = await contract.storage()
      const op = await contract.methods.add_signee_proposal(bob.pkh).send()
      await op.confirmation(1)

      const newStorage = await contract.storage()
      expect(newStorage.proposal_id.toNumber()).to.equal(storage.proposal_id.toNumber() + 1)
      const proposal = newStorage.proposals.get(newStorage.proposal_id)
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  });
  it("Should let Alice to vote 1", async () => {
    try {
      const contract = await TezosAlice.contract.at(contractAddress);
      const op = await contract.methods.vote(1, true).send();
      await op.confirmation(1);

      const newStorage = await contract.storage();
      // const alicenewBalance = await newStorage.ledger.get(alice.pkh);
      // expect(alicenewBalance.toNumber()).to.equal(amount * 2);
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  })
  it("Should let Alice to execute proposal 1", async () => {
    try {
      const contract = await TezosAlice.contract.at(contractAddress);
      const op = await contract.methods.execute(1).send();
      await op.confirmation(1);

      const newStorage = await contract.storage();
      expect(newStorage.signees).to.include(bob.pkh)
      expect(newStorage.signees).to.include(alice.pkh)
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  })
  it("Should let Bob to propose threshold 2", async () => {
    try {
      const contract = await TezosBob.contract.at(contractAddress)
      const storage = await contract.storage()
      const op = await contract.methods.set_vote_threshold_proposal(2).send()
      await op.confirmation(1);

      const newStorage = await contract.storage();
      expect(newStorage.proposal_id.toNumber()).to.equal(storage.proposal_id.toNumber() + 1)
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  })
  it("Should let Bob to vote 2", async () => {
    try {
      const contract = await TezosBob.contract.at(contractAddress);
      const op = await contract.methods.vote(2, true).send();
      await op.confirmation(1);

      const newStorage = await contract.storage();
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  })
  it("Should let Alice to execute threshold 2 proposal", async () => {
    try {
      const contract = await TezosAlice.contract.at(contractAddress);
      const op = await contract.methods.execute(2).send();
      await op.confirmation(1);

      const newStorage = await contract.storage();
      expect(newStorage.threshold.toNumber()).to.equal(2)
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  })
  it("Should let Bob to propose removal of Bob signee 3", async () => {
    try {
      const contract = await TezosBob.contract.at(contractAddress)
      const storage = await contract.storage()
      const op = await contract.methods.remove_signee_proposal(bob.pkh).send()
      await op.confirmation(1);

      const newStorage = await contract.storage();
      expect(newStorage.proposal_id.toNumber()).to.equal(storage.proposal_id.toNumber() + 1)
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  })
  it("Should let Alice to vote 3", async () => {
    try {
      const contract = await TezosAlice.contract.at(contractAddress);
      const op = await contract.methods.vote(3, true).send();
      await op.confirmation(1);

      const newStorage = await contract.storage();
      // const alicenewBalance = await newStorage.ledger.get(alice.pkh);
      // expect(alicenewBalance.toNumber()).to.equal(amount * 2);
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  })
  it("Should prevent Bob from executing a proposal 3", async () => {
    try {
      const contract = await TezosBob.contract.at(contractAddress);
      const amount = 10

      await rejects(contract.methods.execute(3).send(), (err: Error) => {
          expect(err.message).to.equal("Vote threshold not reached");
          return true;
      });
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  })
  it("Should let Bob to vote 3", async () => {
    try {
      const contract = await TezosBob.contract.at(contractAddress);
      const op = await contract.methods.vote(3, true).send();
      await op.confirmation(1);

      const newStorage = await contract.storage();
      // const alicenewBalance = await newStorage.ledger.get(alice.pkh);
      // expect(alicenewBalance.toNumber()).to.equal(amount * 2);
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  })
  it("Should let Bob to execute proposal 3", async () => {
    try {
      const contract = await TezosBob.contract.at(contractAddress)
      const op = await contract.methods.execute(3).send()
      await op.confirmation(1)

      const newStorage = await contract.storage()
      expect(newStorage.signees).to.not.include(bob.pkh)
    } catch (error) {
      console.error(error)
      expect(error).to.be.undefined;
    }
  })
})

