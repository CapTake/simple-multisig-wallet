import { TezosToolkit, MichelsonMap } from "@taquito/taquito";
import { InMemorySigner } from "@taquito/signer";
import contractJson from "../../build/Token.json";
import chai, { expect } from "chai";
import { rejects } from "assert";

// jest.setTimeout(50000);

const alice = {
  pkh: "tz1MnmtP4uAcgMpeZN6JtyziXeFqqwQG6yn6",
  sk: "edsk3Sb16jcx9KrgMDsbZDmKnuN11v4AbTtPBgBSBTqYftd8Cq3i1e",
  pk: "edpku9qEgcyfNNDK6EpMvu5SqXDqWRLuxdMxdyH12ivTUuB1KXfGP4",
};
const bob = {
  pk: "edpkurPsQ8eUApnLUJ9ZPDvu98E8VNj4KtJa1aZr16Cr5ow5VHKnz4",
  pkh: "tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
  sk: "edsk3RFfvaFaxbHx8BMtEW1rKQcPtDML3LXjNqMNLCzC3wLC1bWbAt"
};
const tokenId = 0;
const tokenDecimals = 6;
const initialTotalSupply = 1000 * 10 ** tokenDecimals;
const tokensToTransfer = 10 * 10 ** tokenDecimals;
const rpcUrl = "https://rpc.ithacanet.teztnets.xyz";

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
          admin: alice.pkh,
          pending_admin: null,
          paused: false,
          ledger: new MichelsonMap(),
          metadata: new MichelsonMap(),
          operators: new MichelsonMap(),
          token_metadata: new MichelsonMap(),
        }
      });
      await originationOp.confirmation();
      contractAddress = originationOp.contractAddress;
      expect(originationOp.hash).to.be.a('string');
      expect(contractAddress).to.be.a('string');
    } catch (error) {
      // console.error(error);
      expect(error).to.be.undefined;
    }
  });
});

describe("Tests for minting", () => {
  it("Should let Alice to mint a token", async () => {
    try {
      const contract = await TezosAlice.contract.at(contractAddress);
      const amount = initialTotalSupply / 2;
      const op = await contract.methods
        .mint(alice.pkh, amount).send();
      await op.confirmation();

      const newStorage = await contract.storage();
      const alicenewBalance = await newStorage.ledger.get(alice.pkh);
      expect(alicenewBalance.toNumber()).to.equal(amount);
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  });
  it("Should let Alice to mint more tokens", async () => {
    try {
      const contract = await TezosAlice.contract.at(contractAddress);
      const amount = initialTotalSupply / 2;
      const op = await contract.methods
        .mint(alice.pkh, amount).send();
      await op.confirmation();

      const newStorage = await contract.storage();
      const alicenewBalance = await newStorage.ledger.get(alice.pkh);
      expect(alicenewBalance.toNumber()).to.equal(amount * 2);
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  });
  it("Should prevent Bob from minting", async () => {
    try {
      const contract = await TezosBob.contract.at(contractAddress);
      const amount = initialTotalSupply;

      await rejects(contract.methods
        .mint(alice.pkh, amount)
        .send(), (err: Error) => {
          expect(err.message).to.equal("Access denied");
          return true;
      });
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  });
});

describe("Tests for transfers", () => {
  it("Should prevent Alice from sending tokens", async () => {
    const contract = await TezosAlice.contract.at(contractAddress);
    await rejects(contract.methods
      .transfer([
        {
          from_: alice.pkh,
          txs: [
            {
              to_: bob.pkh,
              token_id: tokenId,
              amount: initialTotalSupply / 2
            }
          ]
        }
      ])
      .send(), (err: Error) => {
      expect(err.message).to.equal("TX Disallowed");

      return true;
    });
  });
  it("Should allow Alice to whitelist her address", async () => {
    try {
      const contract = await TezosAlice.contract.at(contractAddress);
      const storage = await contract.storage();
      expect(storage.allowed).to.not.include(alice.pkh);
      const op = await contract.methods
        .allow_address(alice.pkh, true)
        .send();
      await op.confirmation(1);

      const newStorage = await contract.storage();
      expect(newStorage.allowed).to.include(alice.pkh);
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  });
  it("Should allow Alice to transfer tokens to Bob", async () => {
    try {
      const contract = await TezosAlice.contract.at(contractAddress);
      const storage = await contract.storage();
      const aliceOriginalBalance = await storage.ledger.get(alice.pkh);
      expect(aliceOriginalBalance.toNumber()).to.equal(initialTotalSupply);
      const bobOriginalBalance = await storage.ledger.get(bob.pkh);
      expect(bobOriginalBalance).to.be.undefined;

      const op = await contract.methods
        .transfer([
          {
            from_: alice.pkh,
            txs: [{ to_: bob.pkh, token_id: tokenId, amount: tokensToTransfer }]
          }
        ])
        .send();
      await op.confirmation();

      const newStorage = await contract.storage();
      const alicenewBalance = await newStorage.ledger.get(alice.pkh);
      expect(alicenewBalance.toNumber()).to.equal(
        aliceOriginalBalance.toNumber() - tokensToTransfer
      );
      const bobNewBalance = await newStorage.ledger.get(bob.pkh);
      expect(bobNewBalance.toNumber()).to.equal(tokensToTransfer);
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  });

  it("Should prevent Alice from sending more than her balance", async () => {
    const contract = await TezosAlice.contract.at(contractAddress);
    const storage = await contract.storage();
    const aliceOriginalBalance = await storage.ledger.get(alice.pkh);
    await rejects(contract.methods
      .transfer([
        {
          from_: alice.pkh,
          txs: [
            {
              to_: bob.pkh,
              token_id: tokenId,
              amount: aliceOriginalBalance.toNumber() + 1
            }
          ]
        }
      ])
      .send(), (err: Error) => {
      expect(err.message).to.equal("FA2_INSUFFICIENT_BALANCE");
      return true;
    });
  });

  it("Should prevent Alice from transferring Bob's tokens", async () => {
    const contract = await TezosAlice.contract.at(contractAddress);
    await rejects(contract.methods
        .transfer([
          {
            from_: bob.pkh,
            txs: [
              {
                to_: alice.pkh,
                token_id: tokenId,
                amount: 10 ** tokenDecimals
              }
            ]
          }
        ]).send(), (err: Error) => {
          expect(err.message).to.equal("FA2_NOT_OPERATOR");
          return true;
    });
  });

  it("Should prevent Alice from transferring tokens with unknown token id", async () => {
    const contract = await TezosAlice.contract.at(contractAddress);
    await rejects(contract.methods
        .transfer([
          {
            from_: alice.pkh,
            txs: [
              {
                to_: bob.pkh,
                token_id: tokenId + 13,
                amount: 10 ** tokenDecimals
              }
            ]
          }
        ]).send(), (err: Error) => {
          expect(err.message).to.equal("FA2_TOKEN_UNDEFINED");
          return true;
    });
  });

  it("Should prevent Bob from making transfers on behalf of Alice", async () => {
    const contract = await TezosBob.contract.at(contractAddress);
    await rejects(contract.methods
        .transfer([
          {
            from_: alice.pkh,
            txs: [
              {
                to_: bob.pkh,
                token_id: tokenId,
                amount: 10 ** tokenDecimals
              }
            ]
          }
        ])
        .send(), (err: Error) => {
          expect(err.message).to.equal("FA2_NOT_OPERATOR");
          return true;
    });
  });
});

describe("Tests for operators", () => {
  it("Should set Bob as an operator for Alice", async () => {
    try {
      const contract = await TezosAlice.contract.at(contractAddress);
      const storage = await contract.storage();
      const aliceOperator = await storage.operators.get({
        0: alice.pkh,
        1: bob.pkh
      });
      expect(aliceOperator).to.be.undefined;

      const op = await contract.methods
        .update_operators([
          {
            add_operator: {
              owner: alice.pkh,
              operator: bob.pkh,
              token_id: tokenId
            }
          }
        ])
        .send();
      await op.confirmation();
      const newStorage = await contract.storage();
      const aliceNewOperator = await newStorage.operators.get({
        0: alice.pkh,
        1: bob.pkh
      });
      expect(aliceNewOperator).to.be.ok;
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  });

  it("Should prevent Alice add an operator for Bob", async () => {
    try {
      const contract = await TezosAlice.contract.at(contractAddress);
      const storage = await contract.storage();
      const aliceOperator = await storage.operators.get({
        0: bob.pkh,
        1: alice.pkh
      });
      expect(aliceOperator).to.be.undefined;
      await rejects(contract.methods
        .update_operators([
          {
            add_operator: {
              owner: bob.pkh,
              operator: alice.pkh,
              token_id: tokenId
            }
          }
        ])
        .send(), (err: Error) => {
          expect(err.message).to.equal("FA2_NOT_OWNER");
          return true;
      });
    } catch (error) {
      expect(error).to.be.undefined;
    }
  });

  it("Should let Bob make a transfer on behalf of Alice", async () => {
    try {
      const contract = await TezosBob.contract.at(contractAddress);
      const storage = await contract.storage();
      const aliceOriginalBalance = await storage.ledger.get(alice.pkh);
      expect(aliceOriginalBalance.toNumber()).to.equal(
        initialTotalSupply - tokensToTransfer
      );
      const bobOriginalBalance = await storage.ledger.get(bob.pkh);
      expect(bobOriginalBalance.toNumber()).to.equal(tokensToTransfer);

      const op = await contract.methods
        .transfer([
          {
            from_: alice.pkh,
            txs: [{ to_: bob.pkh, token_id: tokenId, amount: tokensToTransfer }]
          }
        ])
        .send();
      await op.confirmation();

      const newStorage = await contract.storage();
      const alicenewBalance = await newStorage.ledger.get(alice.pkh);
      expect(alicenewBalance.toNumber()).to.equal(
        aliceOriginalBalance.toNumber() - tokensToTransfer
      );
      const bobNewBalance = await newStorage.ledger.get(bob.pkh);
      expect(bobNewBalance.toNumber()).to.equal(
        bobOriginalBalance.toNumber() + tokensToTransfer
      );
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  });

  it("Should remove Bob as an operator for Alice", async () => {
    try {
      const contract = await TezosAlice.contract.at(contractAddress);
      const storage = await contract.storage();
      const aliceOperator = await storage.operators.get({
        0: alice.pkh,
        1: bob.pkh
      });
      expect(aliceOperator).to.be.ok;

      const op = await contract.methods
        .update_operators([
          {
            remove_operator: {
              owner: alice.pkh,
              operator: bob.pkh,
              token_id: tokenId
            }
          }
        ])
        .send();
      await op.confirmation();
      const newStorage = await contract.storage();
      const aliceNewOperator = await newStorage.operators.get({
        0: alice.pkh,
        1: bob.pkh
      });
      expect(aliceNewOperator).to.be.undefined;
    } catch (error) {
      console.error(error);
      expect(error).to.be.undefined;
    }
  });
});
