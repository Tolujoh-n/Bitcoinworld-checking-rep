import {
  uintCV,
  principalCV,
  stringUtf8CV,
  PostConditionMode,
} from "@stacks/transactions";
import { openContractCall } from "@stacks/connect";
import axios from "axios";
import { authenticate, getWalletAddress } from "../../utils/stacksConnect";
import { BACKEND_URL } from "../../contexts/Bakendurl";

// ------------------- CONFIG -------------------
const CONTRACT_ADDRESS = "ST1PSHE32YTEE21FGYEVTA24N681KRGSQM4VF9XZP";
const CONTRACT_NAME = "market-factory-v2";

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
async function contractCall({ functionName, functionArgs = [] }) {
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
        postConditionMode: PostConditionMode.Allow,
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
  // For read-only calls we should not force wallet authentication (this can
  // trigger connect popups repeatedly while polling). Use the currently
  // connected wallet address if present, otherwise omit the senderAddress.
  const senderAddress = getWalletAddress();
  try {
    // Serialize Clarity values into plain JSON that the backend proxy can
    // forward to the Hiro API. We expect functionArgs to be clarity CV objects
    // created using helpers like uintCV(), principalCV(), stringUtf8CV().
    const serializeArg = (a) => {
      if (a == null) return null;
      try {
        if (typeof a === "object" && a.type) {
          let v = a.value;
          if (typeof v === "bigint") v = v.toString();
          if (v && typeof v === "object" && typeof v.toString === "function")
            v = v.toString();
          return { type: a.type, value: v };
        }
        return { type: typeof a, value: String(a) };
      } catch (e) {
        return { type: typeof a, value: String(a) };
      }
    };

    const serializedArgs = (functionArgs || []).map(serializeArg);

    // Call backend proxy which forwards the read-only call to Hiro to avoid CORS
    const res = await axios.post(`${BACKEND_URL}/api/stacks/call-read`, {
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName,
      functionArgs: serializedArgs,
      senderAddress: senderAddress || undefined,
    });

    const result = res.data;
    if (MARKET_CLIENT_DEBUG && !_loggedReadFunctions.has(functionName)) {
      console.log(`📖 ${functionName} result (proxy):`, result);
      _loggedReadFunctions.add(functionName);
    }
    return result;
  } catch (err) {
    // Log structured error for easier debugging
    console.warn(`❌ Error reading ${functionName} (proxy):`, {
      message: err?.message || err,
      functionName,
      functionArgs: (functionArgs || []).map((a) => ({
        type: a?.type,
        value: a?.value,
      })),
      senderAddress,
    });
    throw err;
  }
}

// ------------------- WRITE FUNCTIONS -------------------

// Create a market
export async function createMarket(marketId, initialLiquidity) {
  return contractCall({
    functionName: "create-market",
    functionArgs: [uintCV(marketId), uintCV(initialLiquidity)],
  });
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

// Resolve a market (YES / NO)
export async function resolveMarket(marketId, result) {
  return contractCall({
    functionName: "resolve",
    functionArgs: [uintCV(marketId), stringUtf8CV(result)], // result: "YES" or "NO"
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
export async function withdrawSurplus() {
  return contractCall({
    functionName: "withdraw-surplus",
  });
}

// Pause the contract
export async function pause() {
  return contractCall({
    functionName: "pause",
  });
}

// Unpause the contract
export async function unpause() {
  return contractCall({
    functionName: "unpause",
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
