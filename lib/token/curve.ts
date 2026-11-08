/**
 * $UMANITY launch settings for Meteora's Dynamic Bonding Curve.
 *
 * Fair launch: no presale, no team allocation and no vesting. Part of the
 * fixed supply is sold on the curve and the rest seeds the DAMM v2 pool at
 * graduation; fees are taken in USDC only. The config's fee claimer is the Umanity program's `fees` address, so
 * the program's `sweep_meteora_fees` is the only way to claim them, and it
 * splits every claim 50/50 between the drops fund and ops. At graduation all
 * liquidity is locked permanently to the same address.
 */
import {
  ActivationType,
  BaseFeeMode,
  CollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  buildCurveWithMarketCap,
} from "@meteora-ag/dynamic-bonding-curve-sdk";

export const UMANITY_SUPPLY = 1_000_000_000;

export type CurveOptions = {
  /** Market cap at the first trade, in USDC. */
  initialMarketCap: number;
  /** Market cap at which the curve graduates to a DAMM v2 pool, in USDC. */
  migrationMarketCap: number;
  /** Steady trading fee, in basis points (100 = 1%). */
  feeBps: number;
  /** Anti-sniping: the fee starts here and falls to `feeBps` over `launchFeeSecs`. */
  launchFeeBps?: number;
  launchFeeSecs?: number;
};

export function umanityCurve(o: CurveOptions) {
  const launch = o.launchFeeBps && o.launchFeeSecs && o.launchFeeBps > o.feeBps;
  return buildCurveWithMarketCap({
    token: {
      tokenType: TokenType.SPLToken,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: 6,
      tokenAuthorityOption: TokenAuthorityOption.CreatorUpdateAuthority,
      totalTokenSupply: UMANITY_SUPPLY,
      leftover: 0,
    },
    fee: {
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerExponential,
        feeSchedulerParam: launch
          ? {
              startingFeeBps: o.launchFeeBps!,
              endingFeeBps: o.feeBps,
              numberOfPeriod: Math.max(1, Math.floor(o.launchFeeSecs! / 10)),
              totalDuration: o.launchFeeSecs!,
            }
          : { startingFeeBps: o.feeBps, endingFeeBps: o.feeBps, numberOfPeriod: 0, totalDuration: 0 },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: 0,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.FixedBps100,
      migrationFee: { feePercentage: 0, creatorFeePercentage: 0 },
    },
    liquidityDistribution: {
      partnerPermanentLockedLiquidityPercentage: 100,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: {
      totalLockedVestingAmount: 0,
      numberOfVestingPeriod: 0,
      cliffUnlockAmount: 0,
      totalVestingDuration: 0,
      cliffDurationFromMigrationTime: 0,
    },
    activationType: ActivationType.Timestamp,
    initialMarketCap: o.initialMarketCap,
    migrationMarketCap: o.migrationMarketCap,
  });
}
