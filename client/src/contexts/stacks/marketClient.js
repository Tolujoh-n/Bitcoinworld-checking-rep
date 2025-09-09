import {
  uintCV,
  principalCV,
  cvToHex,
  stringUtf8CV,
  fetchCallReadOnlyFunction,
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
      console.log("✅ Backend wallet login:", res.data);
    } catch (err) {
      console.error("❌ Wallet login failed:", err);
    }
  }

  return address;
}

// ------------------- INTERNAL HELPERS -------------------
async function contractCall({ functionName, functionArgs = [] }) {
  await ensureWalletAuth();

  return new Promise((resolve, reject) => {
    openContractCall({
      network: "testnet",
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName,
      functionArgs,
      appDetails: APP_DETAILS,
      onFinish: (data) => {
        console.log(`✅ ${functionName} tx:`, data);
        resolve(data);
      },
      onCancel: () => {
        console.warn(`⚠️ User cancelled ${functionName}`);
        reject(new Error("User cancelled"));
      },
    }).catch((err) => reject(err));
  });
}

async function contractRead({ functionName, functionArgs = [] }) {
  const senderAddress = await ensureWalletAuth();
  try {
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName,
      functionArgs,
      network: "testnet",
      senderAddress,
    });
    console.log(`📖 ${functionName} result:`, result);
    return result;
  } catch (err) {
    console.error(`❌ Error reading ${functionName}:`, err);
    throw err;
  }
}

// ------------------- WRITE FUNCTIONS -------------------
export async function createMarket(marketId, initialLiquidity) {
  return contractCall({
    functionName: "create-market",
    functionArgs: [uintCV(marketId), uintCV(initialLiquidity)],
  });
}

export async function addLiquidity(marketId, amount) {
  return contractCall({
    functionName: "add-liquidity",
    functionArgs: [uintCV(marketId), uintCV(amount)],
  });
}

export async function buyYes(amount) {
  return contractCall({
    functionName: "buy-yes",
    functionArgs: [uintCV(amount)],
  });
}

export async function buyNo(amount) {
  return contractCall({
    functionName: "buy-no",
    functionArgs: [uintCV(amount)],
  });
}

export async function redeem() {
  return contractCall({
    functionName: "redeem",
  });
}

export async function withdrawSurplus() {
  return contractCall({
    functionName: "withdraw-surplus",
  });
}

export async function pause() {
  return contractCall({
    functionName: "pause",
  });
}

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
        console.log("✅ sbtcTransfer tx:", data);
        resolve(data);
      },
      onCancel: () => {
        console.warn("⚠️ User cancelled sbtcTransfer");
        reject(new Error("User cancelled"));
      },
    }).catch((err) => reject(err));
  });
}

// ------------------- READ-ONLY GETTERS -------------------
export async function getQYes() {
  return contractRead({ functionName: "get-q-yes" });
}

export async function getQNo() {
  return contractRead({ functionName: "get-q-no" });
}

export async function getPool() {
  return contractRead({ functionName: "get-pool" });
}

export async function getStatus() {
  return contractRead({ functionName: "get-status" });
}

export async function getOutcome() {
  return contractRead({ functionName: "get-outcome" });
}

export async function getB() {
  return contractRead({ functionName: "get-b" });
}

const STACKS_API_URL = "https://api.testnet.hiro.so";

/**
 * Polls a transaction until it's confirmed or failed
 * @param {string} txId - Transaction ID (hex string)
 * @param {number} interval - Polling interval in ms
 * @param {number} maxAttempts - Max number of attempts
 */
export async function pollTx(txId, interval = 5000, maxAttempts = 60) {
  console.log(`Polling tx: ${txId}`);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await axios.get(`${STACKS_API_URL}/extended/v1/tx/${txId}`);
      if (res.data.tx_status === "success") {
        console.log("Transaction confirmed ✅:", res.data);
        return res.data;
      }
      if (
        res.data.tx_status === "abort_by_response" ||
        res.data.tx_status === "abort_by_post_condition"
      ) {
        throw new Error(`Transaction failed ❌: ${JSON.stringify(res.data)}`);
      }
      console.log(
        `Tx ${txId} status: ${res.data.tx_status} (attempt ${i + 1})`
      );
    } catch (err) {
      console.warn(`Error polling tx ${txId}:`, err.message || err);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(
    `Transaction ${txId} not confirmed after ${maxAttempts} attempts`
  );
}
