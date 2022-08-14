const { TezosToolkit, MichelCodecPacker } = require("@taquito/taquito")
const { InMemorySigner } = require("@taquito/signer")
const dotenv = require("dotenv")
dotenv.config()
const fs = require("fs")
const { parse } = require("csv-parse")

const CROWDSALE = 'KT1N1vyj1NLBtoydL5YH7TLnvdLiqqV2JwGB'
const WHITELIST_AMOUNT = 2

const wl = async (data) => {

  tezos = new TezosToolkit('https://rpc.ithacanet.teztnets.xyz') //'https://mainnet.api.tez.ie')
  tezos.setPackerProvider(new MichelCodecPacker())
  const signer = await InMemorySigner.fromSecretKey(process.env.ADMIN_SECRET_KEY)
  const ADMIN = await signer.publicKeyHash()
  tezos.setProvider({
    config: {
      confirmationPollingTimeoutSecond: 90000,
    },
    signer,
  })

  console.log(`Admin: ${ADMIN}, whitelisting ${data.length} Addresses`)
  const contract = await tezos.contract.at(CROWDSALE);
  let op = await contract.methods.whitelist_add(data).send()
  await op.confirmation(1)
  console.log('Done!')
}

fs.createReadStream('./whitelisted.csv').pipe(parse({delimiter: ','}, async function(err, data) {
    const whitelist = data.map(([address]) => ({ 0: address, 1: WHITELIST_AMOUNT }))
    if (err) {
        console.log(err.message)
        process.exit(1)
    }
    await wl(whitelist)
}))

