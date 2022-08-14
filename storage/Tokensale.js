import { MichelsonMap } from "@taquito/michelson-encoder";

import { zeroAddress } from "../test/helpers/Utils";

export default {
    admin: zeroAddress,
    pending_admin: null,
    owner: zeroAddress,
    token: zeroAddress,
    supply: 100,
    lot_size: 333000,
    lot_price: 3330000,
    sold: 0,
    whitelisted: new MichelsonMap(),
    paused: false
}
