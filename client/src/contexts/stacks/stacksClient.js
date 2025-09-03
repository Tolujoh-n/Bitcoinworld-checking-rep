import {
  AppConfig,
  UserSession,
  showConnect,
  openContractCall,
} from "@stacks/connect";
import {
  AnchorMode,
  fetchCallReadOnlyFunction,
  cvToJSON,
} from "@stacks/transactions";
import { StacksTestnet } from "@stacks/network";
import axios from "../../setupAxios";
import { BACKEND_URL } from "../Bakendurl";

// App setup
const appConfig = new AppConfig(["store_write", "publish_data"]);
export const userSession = new UserSession({ appConfig });

export const appDetails = {
  name: "BitcoinWorld",
  icon: "https://BitcoinWorld.app/BitcoinWorld.png",
};

// ✅ Proper network object
export const network = new StacksTestnet({
  url: "https://api.testnet.hiro.so",
});

// SCALE = 1e6 for fixed-point math
export const SCALE = 1_000_000n;

// ------------------- Wallet & Auth -------------------
export function isSignedIn() {
  return userSession.isUserSignedIn();
}

export function getUserData() {
  return userSession.loadUserData();
}

export function getWalletAddress() {
  if (!isSignedIn()) return null;
  return userSession.loadUserData().profile.stxAddress.testnet;
}

export function authenticate() {
  showConnect({
    appDetails,
    redirectTo: "/",
    onFinish: async () => {
      const address = getWalletAddress();
      console.log("🔑 Wallet connected:", address);

      // Auto-register/login user with backend
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
      window.location.reload();
    },
    userSession,
  });
}

// ------------------- Contract Call Wrapper -------------------
export async function callContract({
  contractAddress,
  contractName,
  functionName,
  functionArgs = [],
  onFinish,
  onCancel,
}) {
  if (!isSignedIn()) {
    authenticate();
    throw new Error("Wallet not connected");
  }

  console.log("📤 Calling contract:", {
    contractAddress,
    contractName,
    functionName,
    functionArgs,
  });

  return new Promise((resolve, reject) => {
    const options = {
      contractAddress,
      contractName,
      functionName,
      functionArgs,
      network,
      anchorMode: AnchorMode.Any,
      appDetails,
      onFinish: async (data) => {
        console.log("📥 Tx submitted:", data);
        if (onFinish) onFinish(data);
        resolve(data.txId); // resolve with txId
      },
      onCancel: () => {
        console.warn("🚫 Tx cancelled");
        if (onCancel) onCancel();
        reject(new Error("Transaction cancelled"));
      },
    };

    try {
      openContractCall(options);
    } catch (err) {
      reject(err);
    }
  });
}

// ------------------- Tx Confirmation Polling -------------------
export async function pollTx(txId, { interval = 5000, maxAttempts = 40 } = {}) {
  console.log("⏳ Polling tx:", txId);
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${network.coreApiUrl}/extended/v1/tx/${txId}`);
    const json = await res.json();
    if (
      json.tx_status === "success" ||
      json.tx_status === "abort_by_response"
    ) {
      console.log("✅ Tx confirmed:", json);
      return json;
    }
    if (json.tx_status === "failed") {
      throw new Error("❌ Tx failed: " + JSON.stringify(json));
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("⏱️ Tx polling timed out");
}

// ------------------- Read-Only Wrapper -------------------
export async function readOnlyCall({
  contractAddress,
  contractName,
  functionName,
  functionArgs = [],
  senderAddress,
}) {
  const res = await fetchCallReadOnlyFunction({
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    network,
    senderAddress,
  });

  const json = cvToJSON(res);
  console.log("📥 Read-only result:", { functionName, json });
  return json;
}
