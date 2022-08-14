import { MichelsonMap } from "@taquito/michelson-encoder";
import { char2Bytes } from '@taquito/utils'

import { zeroAddress } from "../test/helpers/Utils";

const metadata = new MichelsonMap();
metadata.set('', char2Bytes('tezos-storage:contents'));
metadata.set('contents', char2Bytes(JSON.stringify({
    version: '1.0',
    name: 'SomeToken',
    interfaces: ['TZIP-012','TZIP-016']
})))

const token_info = MichelsonMap.fromLiteral({
    name: char2Bytes('SomeToken'),
    symbol: char2Bytes('SOME'),
    decimals: char2Bytes("6")
  })
const token_metadata = MichelsonMap.fromLiteral({
    0: { token_id: 0, token_info }
})

export default {
    admin: zeroAddress,
    pending_admin: null,
    ledger: MichelsonMap.fromLiteral({
      tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb: 1000000000000
    }),
    metadata,
    operators: new MichelsonMap(),
    token_metadata,
}

