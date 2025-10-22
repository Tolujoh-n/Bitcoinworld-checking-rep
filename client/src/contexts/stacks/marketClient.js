import {
  uintCV,
  principalCV,
  stringUtf8CV,
  stringAsciiCV,
  fetchCallReadOnlyFunction,
  PostConditionMode,
} from "@stacks/transactions";
import { openContractCall } from "@stacks/connect";
import axios from "axios";
import { authenticate, getWalletAddress } from "../../utils/stacksConnect";
import { BACKEND_URL } from "../../contexts/Bakendurl";

// ------------------- CONFIG -------------------
const CONTRACT_ADDRESS = "ST1PSHE32YTEE21FGYEVTA24N681KRGSQM4VF9XZP";
const CONTRACT_NAME = "market-factory-v3";

const APP_DETAILS = {
  name: "Bitcoinworld",
  icon: "https://imglink.io/i/139bee27-a14b-4e2d-99c3-3b05d9cb6e53.png",
};

// Debugging control: set to true to enable logs
let MARKET_CLIENT_DEBUG = false;
const _loggedReadFunctions = new Set();
const _polledTxs = new Set();

export function setMarketClientDebug(v = false) {
  MARKET_CLIENT_DEBUG = !!v;
}

// Helper function to test quote parsing
export async function testQuote(marketId, amount, isYes = true) {
  const quote = isYes ? await getQuoteYes(marketId, amount) : await getQuoteNo(marketId, amount);
  
  // Handle BigInt serialization for logging
  const safeQuote = JSON.parse(JSON.stringify(quote, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
  console.log("🔍 Raw quote result:", JSON.stringify(safeQuote, null, 2));
  
  // Parse the quote result
  let quoteResult;
  if (quote?.value) {
    quoteResult = quote.value;
  } else if (quote?.okay) {
    quoteResult = quote.okay;
  } else {
    quoteResult = quote;
  }
  
  // Handle BigInt serialization for logging
  const safeQuoteResult = JSON.parse(JSON.stringify(quoteResult, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
  console.log("🔍 Parsed quote result:", JSON.stringify(safeQuoteResult, null, 2));
  console.log("🔍 Total value:", quoteResult?.total);
  
  return { quote, quoteResult, total: quoteResult?.total };
}

// ------------------- HELPER -------------------
async function ensureWalletAuth() {
  let address = getWalletAddress();
  if (!address) {
    address = await authenticate();
  }

  if (address) {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/wallet-login`, {
        walletAddress: address,
      });
      if (MARKET_CLIENT_DEBUG)
        console.log("✅ Backend wallet login:", res.data);
    } catch (err) {
      if (MARKET_CLIENT_DEBUG) console.error("❌ Wallet login failed:", err);
    }
  }

  return address;
}

// ------------------- INTERNAL HELPERS -------------------
async function contractCall({ functionName, functionArgs = [], postConditionMode = PostConditionMode.Allow }) {
  await ensureWalletAuth();
  // Make a human-readable dump of args for console logging
  const argsDump = (functionArgs || []).map((a) => {
    try {
      if (a && typeof a === "object") {
        return {
          type: a.type,
          value:
            typeof a.value === "object" && a.value !== null
              ? JSON.stringify(a.value)
              : String(a.value),
        };
      }
      return String(a);
    } catch (e) {
      return String(a);
    }
  });

  console.log("⤴️ Sending contract call to wallet:", {
    functionName,
    args: argsDump,
    marketId: functionArgs[0]?.value, // Log the marketId for debugging
  });

  return new Promise((resolve, reject) => {
    try {
      openContractCall({
        network: "testnet",
        contractAddress: CONTRACT_ADDRESS,
        contractName: CONTRACT_NAME,
        functionName,
        functionArgs,
        appDetails: APP_DETAILS,
        postConditionMode,
        onFinish: (data) => {
          // always log the raw response for visibility
          console.log(`⤵️ Wallet response for ${functionName}:`, data);
          if (MARKET_CLIENT_DEBUG) console.log(`✅ ${functionName} tx:`, data);
          resolve(data);
        },
        onCancel: () => {
          console.warn(`⚠️ User cancelled ${functionName}`);
          if (MARKET_CLIENT_DEBUG)
            console.warn(`⚠️ User cancelled ${functionName}`);
          reject(new Error("User cancelled"));
        },
      });
    } catch (err) {
      reject(err);
    }
  });
}

async function contractRead({ functionName, functionArgs = [] }) {
  const senderAddress = getWalletAddress(); // optional

  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName,
      functionArgs,
      network: "testnet",
      senderAddress,
    });

    if (MARKET_CLIENT_DEBUG && !_loggedReadFunctions.has(functionName)) {
      console.log(`📖 ${functionName} result:`, result);
      _loggedReadFunctions.add(functionName);
    }

    return result;
  } catch (err) {
    console.warn(`❌ Error reading ${functionName}:`, {
      message: err?.message || err,
      functionName,
      functionArgs,
      senderAddress,
    });
    throw err;
  }
}

// ------------------- WRITE FUNCTIONS -------------------

// Create a market
export async function createMarket(marketId, initialLiquidity) {
  console.log("🔍 createMarket called with:", { marketId, initialLiquidity, marketIdType: typeof marketId, initialLiquidityType: typeof initialLiquidity });
  
  // Ensure values are properly converted to numbers
  const marketIdNum = Number(marketId);
  const initialLiquidityNum = Number(initialLiquidity);
  
  console.log("🔍 Converted values:", { marketIdNum, initialLiquidityNum });
  
  if (isNaN(marketIdNum) || isNaN(initialLiquidityNum)) {
    throw new Error(`Invalid marketId or initialLiquidity: marketId=${marketId}, initialLiquidity=${initialLiquidity}`);
  }
  
  if (marketIdNum <= 0 || initialLiquidityNum <= 0) {
    throw new Error(`Invalid values: marketId=${marketIdNum}, initialLiquidity=${initialLiquidityNum}`);
  }
  
  // Ensure they are integers
  const marketIdInt = Math.floor(marketIdNum);
  const initialLiquidityInt = Math.floor(initialLiquidityNum);
  
  console.log("🔍 Final values for uintCV:", { marketIdInt, initialLiquidityInt });
  
  try {
    const marketIdCV = uintCV(marketIdInt);
    const initialLiquidityCV = uintCV(initialLiquidityInt);
    console.log("🔍 uintCV conversion successful:", { marketIdCV, initialLiquidityCV });
    
    return contractCall({
      functionName: "create-market",
      functionArgs: [marketIdCV, initialLiquidityCV],
    });
  } catch (error) {
    console.error("❌ uintCV conversion failed:", error);
    throw new Error(`uintCV conversion failed: ${error.message}`);
  }
}

// Add liquidity to a market
export async function addLiquidity(marketId, amount) {
  return contractCall({
    functionName: "add-liquidity",
    functionArgs: [uintCV(marketId), uintCV(amount)],
  });
}

// Buy YES tokens
export async function buyYes(marketId, amount) {
  return contractCall({
    functionName: "buy-yes",
    functionArgs: [uintCV(marketId), uintCV(amount)],
  });
}

// Buy NO tokens
export async function buyNo(marketId, amount) {
  return contractCall({
    functionName: "buy-no",
    functionArgs: [uintCV(marketId), uintCV(amount)],
  });
}

// Sell YES tokens
export async function sellYes(marketId, amount) {
  return contractCall({
    functionName: "sell-yes",
    functionArgs: [uintCV(marketId), uintCV(amount)],
  });
}

// Sell NO tokens
export async function sellNo(marketId, amount) {
  return contractCall({
    functionName: "sell-no",
    functionArgs: [uintCV(marketId), uintCV(amount)],
  });
}

// Buy YES tokens with auto-cap
export async function buyYesAuto(marketId, amount, targetCap, maxCost) {
  return contractCall({
    functionName: "buy-yes-auto",
    functionArgs: [
      uintCV(marketId),
      uintCV(amount),
      uintCV(targetCap),
      uintCV(maxCost),
    ],
  });
}

// Buy NO tokens with auto-cap
export async function buyNoAuto(marketId, amount, targetCap, maxCost) {
  return contractCall({
    functionName: "buy-no-auto",
    functionArgs: [
      uintCV(marketId),
      uintCV(amount),
      uintCV(targetCap),
      uintCV(maxCost),
    ],
  });
}

// Sell YES tokens with auto-cap
export async function sellYesAuto(marketId, amount, targetCap, maxCost) {
  return contractCall({
    functionName: "sell-yes-auto",
    functionArgs: [
      uintCV(marketId),
      uintCV(amount),
      uintCV(targetCap),
      uintCV(maxCost),
    ],
  });
}

// Sell NO tokens with auto-cap
export async function sellNoAuto(marketId, amount, targetCap, maxCost) {
  return contractCall({
    functionName: "sell-no-auto",
    functionArgs: [
      uintCV(marketId),
      uintCV(amount),
      uintCV(targetCap),
      uintCV(maxCost),
    ],
  });
}

// ------------------- SMART AUTO TRADING FUNCTIONS -------------------
// These functions automatically get quotes and set proper maxCost

// Smart buy YES with auto quote
export async function buyYesAutoSmart(marketId, amount) {
  console.log("🔍 buyYesAutoSmart called with:", { marketId, amount });
  
  // Get quote first - this is the key step
  const quote = await getQuoteYes(marketId, amount);
  console.log("🔍 Raw quote result:", quote);
  
  // Parse the quote result according to developer guidelines
  // The quote should return { cost, total, feeProtocol, feeLP, drip, brc20, team }
  let quoteResult;
  if (quote?.value) {
    quoteResult = quote.value;
  } else if (quote?.okay) {
    quoteResult = quote.okay;
  } else {
    quoteResult = quote;
  }
  
  console.log("🔍 Parsed quote result:", quoteResult);
  
  // Extract total from quote result - this is the exact value we need
  const total = quoteResult?.total;
  if (!total) {
    const safeQuoteResult = JSON.parse(JSON.stringify(quoteResult, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
    throw new Error(`Failed to get quote total. Quote result: ${JSON.stringify(safeQuoteResult)}`);
  }
  
  // Convert to BigInt if it's a string
  const totalBigInt = typeof total === 'string' ? parseInt(total, 10) : Number(total);
  
  // Use the exact total from the quote as maxCost
  const maxCost = totalBigInt;
  
  // Calculate targetCap as currentSpent + maxCost (or just use a reasonable cap)
  const targetCap = maxCost + 1; // Small buffer
  
  console.log("🔍 Final values:", { 
    marketId, 
    amount, 
    total: totalBigInt.toString(),
    maxCost: maxCost.toString(), 
    targetCap: targetCap.toString() 
  });
  
  return contractCall({
    functionName: "buy-yes-auto",
    functionArgs: [
      uintCV(marketId),
      uintCV(amount),
      uintCV(targetCap),
      uintCV(maxCost),
    ],
  });
}

// Smart buy NO with auto quote
export async function buyNoAutoSmart(marketId, amount) {
  console.log("🔍 buyNoAutoSmart called with:", { marketId, amount });
  
  // Get quote first - this is the key step
  const quote = await getQuoteNo(marketId, amount);
  console.log("🔍 Raw quote result:", quote);
  
  // Parse the quote result according to developer guidelines
  // The quote should return { cost, total, feeProtocol, feeLP, drip, brc20, team }
  let quoteResult;
  if (quote?.value) {
    quoteResult = quote.value;
  } else if (quote?.okay) {
    quoteResult = quote.okay;
  } else {
    quoteResult = quote;
  }
  
  console.log("🔍 Parsed quote result:", quoteResult);
  
  // Extract total from quote result - this is the exact value we need
  const total = quoteResult?.total;
  if (!total) {
    const safeQuoteResult = JSON.parse(JSON.stringify(quoteResult, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
    throw new Error(`Failed to get quote total. Quote result: ${JSON.stringify(safeQuoteResult)}`);
  }
  
  // Convert to BigInt if it's a string
  const totalBigInt = typeof total === 'string' ? parseInt(total, 10) : Number(total);
  
  // Use the exact total from the quote as maxCost
  const maxCost = totalBigInt;
  
  // Calculate targetCap as currentSpent + maxCost (or just use a reasonable cap)
  const targetCap = maxCost + 1; // Small buffer
  
  console.log("🔍 Final values:", { 
    marketId, 
    amount, 
    total: totalBigInt.toString(),
    maxCost: maxCost.toString(), 
    targetCap: targetCap.toString() 
  });
  
  return contractCall({
    functionName: "buy-no-auto",
    functionArgs: [
      uintCV(marketId),
      uintCV(amount),
      uintCV(targetCap),
      uintCV(maxCost),
    ],
  });
}

// Smart sell YES with auto quote
export async function sellYesAutoSmart(marketId, amount) {
  console.log("🔍 sellYesAutoSmart called with:", { marketId, amount });
  
  // Get quote first - this is the key step
  const quote = await getQuoteYes(marketId, amount);
  console.log("🔍 Raw quote result:", quote);
  
  // Parse the quote result according to developer guidelines
  // The quote should return { cost, total, feeProtocol, feeLP, drip, brc20, team }
  let quoteResult;
  if (quote?.value) {
    quoteResult = quote.value;
  } else if (quote?.okay) {
    quoteResult = quote.okay;
  } else {
    quoteResult = quote;
  }
  
  console.log("🔍 Parsed quote result:", quoteResult);
  
  // Extract total from quote result - this is the exact value we need
  const total = quoteResult?.total;
  if (!total) {
    const safeQuoteResult = JSON.parse(JSON.stringify(quoteResult, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
    throw new Error(`Failed to get quote total. Quote result: ${JSON.stringify(safeQuoteResult)}`);
  }
  
  // Convert to BigInt if it's a string
  const totalBigInt = typeof total === 'string' ? parseInt(total, 10) : Number(total);
  
  // Use the exact total from the quote as maxCost
  const maxCost = totalBigInt;
  
  // Calculate targetCap as currentSpent + maxCost (or just use a reasonable cap)
  const targetCap = maxCost + 1; // Small buffer
  
  console.log("🔍 Final values:", { 
    marketId, 
    amount, 
    total: totalBigInt.toString(),
    maxCost: maxCost.toString(), 
    targetCap: targetCap.toString() 
  });
  
  return contractCall({
    functionName: "sell-yes-auto",
    functionArgs: [
      uintCV(marketId),
      uintCV(amount),
      uintCV(targetCap),
      uintCV(maxCost),
    ],
  });
}

// Smart sell NO with auto quote
export async function sellNoAutoSmart(marketId, amount) {
  console.log("🔍 sellNoAutoSmart called with:", { marketId, amount });
  
  // Get quote first - this is the key step
  const quote = await getQuoteNo(marketId, amount);
  console.log("🔍 Raw quote result:", quote);
  
  // Parse the quote result according to developer guidelines
  // The quote should return { cost, total, feeProtocol, feeLP, drip, brc20, team }
  let quoteResult;
  if (quote?.value) {
    quoteResult = quote.value;
  } else if (quote?.okay) {
    quoteResult = quote.okay;
  } else {
    quoteResult = quote;
  }
  
  console.log("🔍 Parsed quote result:", quoteResult);
  
  // Extract total from quote result - this is the exact value we need
  const total = quoteResult?.total;
  if (!total) {
    const safeQuoteResult = JSON.parse(JSON.stringify(quoteResult, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ));
    throw new Error(`Failed to get quote total. Quote result: ${JSON.stringify(safeQuoteResult)}`);
  }
  
  // Convert to BigInt if it's a string
  const totalBigInt = typeof total === 'string' ? parseInt(total, 10) : Number(total);
  
  // Use the exact total from the quote as maxCost
  const maxCost = totalBigInt;
  
  // Calculate targetCap as currentSpent + maxCost (or just use a reasonable cap)
  const targetCap = maxCost + 1; // Small buffer
  
  console.log("🔍 Final values:", { 
    marketId, 
    amount, 
    total: totalBigInt.toString(),
    maxCost: maxCost.toString(), 
    targetCap: targetCap.toString() 
  });
  
  return contractCall({
    functionName: "sell-no-auto",
    functionArgs: [
      uintCV(marketId),
      uintCV(amount),
      uintCV(targetCap),
      uintCV(maxCost),
    ],
  });
}

// Resolve a market (YES / NO)
export async function resolveMarket(marketId, result) {
  return contractCall({
    functionName: "resolve",
    functionArgs: [uintCV(marketId), stringAsciiCV(result)], // result: "YES" or "NO"
  });
}

// Redeem winnings for a market
export async function redeem(marketId) {
  return contractCall({
    functionName: "redeem",
    functionArgs: [uintCV(marketId)],
  });
}

// Withdraw surplus funds
export async function withdrawSurplus(marketId) {
  return contractCall({
    functionName: "withdraw-surplus",
    functionArgs: [uintCV(marketId)],
  });
}

// Pause the contract
export async function pause() {
  return contractCall({
    functionName: "pause",
    postConditionMode: PostConditionMode.Deny,
  });
}

// Unpause the contract
export async function unpause() {
  return contractCall({
    functionName: "unpause",
    postConditionMode: PostConditionMode.Deny,
  });
}


// lock fees config
export async function lockfees() {
  return contractCall({
    functionName: "lock-fees-config",
  });
}

// set max trade
export async function maxtrade(maxtradeamount) {
  return contractCall({
    functionName: "set-max-trade",
    functionArgs: [uintCV(maxtradeamount)],
  });
}

// ------------------- MARKET MANAGEMENT FUNCTIONS -------------------

// Set fees globally (not market-specific)
export async function setFees(protocolBps, lpBps) {
  return contractCall({
    functionName: "set-fees",
    functionArgs: [uintCV(protocolBps), uintCV(lpBps)],
  });
}

// Set fee recipients globally (not market-specific)
export async function setFeeRecipients(drip, brc20, team, lp) {
  return contractCall({
    functionName: "set-fee-recipients",
    functionArgs: [principalCV(drip), principalCV(brc20), principalCV(team), principalCV(lp)],
  });
}

// Set max trade for a specific market
export async function setMaxTrade(marketId, limit) {
  console.log("🔍 setMaxTrade called with:", { marketId, limit, marketIdType: typeof marketId, limitType: typeof limit });
  
  // Ensure values are properly converted to numbers
  const marketIdNum = Number(marketId);
  const limitNum = Number(limit);
  
  console.log("🔍 Converted values:", { marketIdNum, limitNum });
  
  if (isNaN(marketIdNum) || isNaN(limitNum)) {
    throw new Error(`Invalid marketId or limit: marketId=${marketId}, limit=${limit}`);
  }
  
  if (marketIdNum <= 0 || limitNum <= 0) {
    throw new Error(`Invalid values: marketId=${marketIdNum}, limit=${limitNum}`);
  }
  
  // Ensure they are integers
  const marketIdInt = Math.floor(marketIdNum);
  const limitInt = Math.floor(limitNum);
  
  console.log("🔍 Final values for uintCV:", { marketIdInt, limitInt });
  
  try {
    const marketIdCV = uintCV(marketIdInt);
    const limitCV = uintCV(limitInt);
    console.log("🔍 uintCV conversion successful:", { marketIdCV, limitCV });
    
    return contractCall({
      functionName: "set-max-trade",
      functionArgs: [marketIdCV, limitCV],
    });
  } catch (error) {
    console.error("❌ uintCV conversion failed:", error);
    throw new Error(`uintCV conversion failed: ${error.message}`);
  }
}

// Pause a specific market
export async function pauseMarket(marketId) {
  return contractCall({
    functionName: "pause",
    functionArgs: [uintCV(marketId)],
    postConditionMode: PostConditionMode.Deny,
  });
}

// Unpause a specific market
export async function unpauseMarket(marketId) {
  return contractCall({
    functionName: "unpause",
    functionArgs: [uintCV(marketId)],
    postConditionMode: PostConditionMode.Deny,
  });
}
// ------------------- TOKEN HELPERS -------------------
export async function tokenMint(tokenName, amount, recipient) {
  return contractCall({
    functionName: "mint",
    functionArgs: [
      stringUtf8CV(tokenName),
      uintCV(amount),
      principalCV(recipient),
    ],
  });
}

export async function tokenBurn(amount) {
  return contractCall({
    functionName: "burn",
    functionArgs: [uintCV(amount)],
  });
}

export async function tokenTransfer(amount, sender, recipient) {
  return contractCall({
    functionName: "transfer",
    functionArgs: [uintCV(amount), principalCV(sender), principalCV(recipient)],
  });
}

export async function sbtcTransfer(amount, sender, recipient) {
  return new Promise((resolve, reject) => {
    openContractCall({
      network: "testnet",
      contractAddress: CONTRACT_ADDRESS,
      contractName: "sbtc-v2",
      functionName: "transfer",
      functionArgs: [
        uintCV(amount),
        principalCV(sender),
        principalCV(recipient),
      ],
      appDetails: APP_DETAILS,
      onFinish: (data) => {
        if (MARKET_CLIENT_DEBUG) console.log("✅ sbtcTransfer tx:", data);
        resolve(data);
      },
      onCancel: () => {
        if (MARKET_CLIENT_DEBUG) console.warn("⚠️ User cancelled sbtcTransfer");
        reject(new Error("User cancelled"));
      },
    }).catch((err) => reject(err));
  });
}

// ------------------- READ-ONLY GETTERS -------------------

// Pool size (sats)
export async function getPool(marketId) {
  return contractRead({
    functionName: "get-pool",
    functionArgs: [uintCV(marketId)],
  });
}

// LMSR parameter b
export async function getB(marketId) {
  return contractRead({
    functionName: "get-b",
    functionArgs: [uintCV(marketId)],
  });
}

// Status: "open" or "resolved"
export async function getStatus(marketId) {
  return contractRead({
    functionName: "get-status",
    functionArgs: [uintCV(marketId)],
  });
}

// Outcome: "", "YES", or "NO"
export async function getOutcome(marketId) {
  return contractRead({
    functionName: "get-outcome",
    functionArgs: [uintCV(marketId)],
  });
}

// Market initialized?
export async function getInitialized(marketId) {
  return contractRead({
    functionName: "get-initialized",
    functionArgs: [uintCV(marketId)],
  });
}

// YES token supply
export async function getYesSupply(marketId) {
  return contractRead({
    functionName: "get-yes-supply",
    functionArgs: [uintCV(marketId)],
  });
}

// NO token supply
export async function getNoSupply(marketId) {
  return contractRead({
    functionName: "get-no-supply",
    functionArgs: [uintCV(marketId)],
  });
}

// YES balance of a user
export async function getYesBalance(marketId, principal) {
  return contractRead({
    functionName: "get-yes-balance",
    functionArgs: [uintCV(marketId), principalCV(principal)],
  });
}

// NO balance of a user
export async function getNoBalance(marketId, principal) {
  return contractRead({
    functionName: "get-no-balance",
    functionArgs: [uintCV(marketId), principalCV(principal)],
  });
}

// Cap for a user
export async function getCap(marketId, principal) {
  return contractRead({
    functionName: "get-cap",
    functionArgs: [uintCV(marketId), principalCV(principal)],
  });
}

// Spent amount for a user
export async function getSpent(marketId, principal) {
  return contractRead({
    functionName: "get-spent",
    functionArgs: [uintCV(marketId), principalCV(principal)],
  });
}

// get quote amount for a yes
export async function getQuoteYes(marketId, amount) {
  return contractRead({
    functionName: "quote-buy-yes",
    functionArgs: [uintCV(marketId), uintCV(amount)],
  });
}

// get quote amount for a No
export async function getQuoteNo(marketId, amount) {
  return contractRead({
    functionName: "quote-buy-no",
    functionArgs: [uintCV(marketId), uintCV(amount)],
  });
}

// get reward claimed true/false
export async function getRewardClaimed(marketId, principal) {
  return contractRead({
    functionName: "get-spent",
    functionArgs: [uintCV(marketId), principalCV(principal)],
  });
}

// Use backend proxy to avoid CORS issues
const STACKS_PROXY_API = `${BACKEND_URL}/api/stacks`;

/**
 * Polls a transaction until it's confirmed or failed
 * @param {string} txId - Transaction ID (hex string)
 * @param {number} interval - Polling interval in ms
 * @param {number} maxAttempts - Max number of attempts
 */
export async function pollTx(txId, interval = 5000, maxAttempts = 60) {
  if (MARKET_CLIENT_DEBUG && !_polledTxs.has(txId)) {
    console.log(`Polling tx: ${txId}`);
    _polledTxs.add(txId);
  }
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await axios.get(`${STACKS_PROXY_API}/tx/${txId}`);
      const status = res.data.tx_status;
      const result = res.data.tx_result;

      if (status === "success") {
        console.log("✅ Transaction confirmed:", res.data);
        return res.data;
      }
      if (
        status === "abort_by_response" ||
        status === "abort_by_post_condition" ||
        status === "failed"
      ) {
        console.error("❌ Transaction failed:", {
          status,
          result,
          ...res.data,
        });
        throw new Error(
          `Transaction failed ❌ (${status}): ${result?.repr || result}`
        );
      }
    } catch (err) {
      if (MARKET_CLIENT_DEBUG)
        console.warn(`Error polling tx ${txId}:`, err.message || err);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(
    `Transaction ${txId} not confirmed after ${maxAttempts} attempts`
  );
}
