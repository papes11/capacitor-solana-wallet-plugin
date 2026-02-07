# solana-mobile-capacitor

connect to native solana wallets

## Install

```bash
npx cap sync
```

## API

<docgen-index>

* [`startSession(...)`](#startsession)
* [`invoke(...)`](#invoke)
* [`endSession()`](#endsession)
* [Type Aliases](#type-aliases)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### startSession(...)

```typescript
startSession(config?: Readonly<{ baseUri?: string | undefined; }> | undefined) => Promise<void>
```

| Param        | Type                                                                       |
| ------------ | -------------------------------------------------------------------------- |
| **`config`** | <code><a href="#readonly">Readonly</a>&lt;{ baseUri?: string; }&gt;</code> |

--------------------


### invoke(...)

```typescript
invoke(options: { method: string; params: any; }) => Promise<void>
```

| Param         | Type                                          |
| ------------- | --------------------------------------------- |
| **`options`** | <code>{ method: string; params: any; }</code> |

--------------------


### endSession()

```typescript
endSession() => Promise<void>
```

--------------------


### Type Aliases


#### WalletAssociationConfig

<code><a href="#readonly">Readonly</a>&lt;{ baseUri?: string; }&gt;</code>


#### Readonly

Make all properties in T readonly

<code>{
 readonly [P in keyof T]: T[P];
 }</code>

</docgen-api>
