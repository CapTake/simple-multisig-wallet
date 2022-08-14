const { TezosToolkit, MichelCodecPacker } = require("@taquito/taquito")
const { InMemorySigner } = require("@taquito/signer")

const { migrate } = require("../scripts/helpers")

const aStorage = require("../storage/Wallet")

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

  console.log('Deploing Multisig Wallet')
  aStorage.default.signees = [ADMIN]
  const minteryAddress = await migrate(
    tezos,
    "Wallet",
    aStorage
  )
  console.log(`Address: ${minteryAddress}`)
 }
