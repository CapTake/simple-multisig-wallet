# FA2 Smart contract template


# Requiremets

- Installed [NodeJS](https://nodejs.org/en/) (tested with NodeJS v15+);
- Installed [Yarn](https://classic.yarnpkg.com/lang/en/docs/install/#mac-stable);
- Installed node modules:

  ```shell
    yarn install
  ```

# Compiling

Compilation is splitted into a few steps.

To compile all contracts (without lambdas) run the next command:

```shell
  yarn compile
```

# Testing

To run all the tests execute the next command:

```shell
  yarn test
```

# Deploy

To deploy the contracts you should run the following command:

```shell
  yarn migrate
```

By default, the contracts will be deployed to the `development` network.

Also, you can deploy to the `mainnet`

```shell
  yarn migrate-mainnet
```
