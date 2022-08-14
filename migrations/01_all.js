const { TezosToolkit, MichelCodecPacker } = require("@taquito/taquito")
const { InMemorySigner } = require("@taquito/signer")

const { migrate } = require("../scripts/helpers")

const storage = require("../storage/Token")
const aStorage = require("../storage/Tokensale")

module.exports = async (tezos, network) => {

  tezos = new TezosToolkit(tezos.rpc.url)
  tezos.setPackerProvider(new MichelCodecPacker())
  const signer = await InMemorySigner.fromSecretKey(network.secretKey)
  const ADMIN = await signer.publicKeyHash()
  tezos.setProvider({
    config: {
      confirmationPollingTimeoutSecond: 90000,
    },
    signer,
  })

  console.log('Deploing FA2')
  storage.default.admin = ADMIN
  const minteryAddress = await migrate(
    tezos,
    "Token",
    storage
  )
  console.log(`Token: ${minteryAddress}`)

  aStorage.default.admin = ADMIN
  aStorage.default.token = minteryAddress

  console.log('Deploing Crowdsale contract')
  const crowdsaleAddress = await migrate(
    tezos,
    "Tokensale",
    aStorage
  )
  console.log(`Crowdsale: ${crowdsaleAddress}`)

  const contract = await tezos.contract.at(crowdsaleAddress);
  let op = await contract.methods.whitelist_add([{ 0: ADMIN, 1: 2 }]).send()
  await op.confirmation(1)
}
