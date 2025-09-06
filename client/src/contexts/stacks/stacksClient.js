import { AppConfig, UserSession, showConnect } from "@stacks/connect";
import {
  AnchorMode,
  fetchCallReadOnlyFunction,
  cvToJSON,
  cvToHex,
} from "@stacks/transactions";
import axios from "../../setupAxios";
import { BACKEND_URL } from "../Bakendurl";
import { request, openContractCall } from "@stacks/connect";
import { NETWORK } from "../Constants";

// App setup
const network = NETWORK;
const appConfig = new AppConfig(["store_write", "publish_data"]);
export const userSession = new UserSession({ appConfig });

export const appDetails = {
  name: "BitcoinWorld",
  icon: "https://imglink.io/i/139bee27-a14b-4e2d-99c3-3b05d9cb6e53.png",
};

// SCALE = 1e6 for fixed-point math
export const SCALE = 1;

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
      console.log("Wallet connected:", address);

      // Auto-register/login user with backend
      if (address) {
        try {
          const res = await axios.post(`${BACKEND_URL}/api/auth/wallet-login`, {
            walletAddress: address,
          });
          console.log("Backend wallet login:", res.data);
        } catch (err) {
          console.error("Wallet login failed:", err);
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
}) {
  if (!isSignedIn()) {
    await authenticate();
    throw new Error("Wallet not connected");
  }

  return new Promise((resolve, reject) => {
    const txOptions = {
      contractAddress,
      contractName,
      functionName,
      functionArgs,
      network,
      anchorMode: AnchorMode.Any,
      appDetails,
      onFinish: (data) => {
        console.log("Tx submitted:", data);
        resolve(data.txId); // return txid here
      },
      onCancel: () => {
        console.warn("User cancelled transaction popup");
        reject(new Error("User cancelled transaction"));
      },
    };
    console.log("Final txOptions:", txOptions);
    openContractCall(txOptions);
  });
}

// ------------------- Tx Confirmation Polling -------------------
export async function pollTx(txId, { interval = 5000, maxAttempts = 40 } = {}) {
  console.log("Polling tx:", txId);

  // Pick the correct API URL based on your network string
  const coreApiUrl =
    network === "testnet"
      ? "https://api.testnet.hiro.so"
      : "https://api.mainnet.hiro.so";

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(`${coreApiUrl}/extended/v1/tx/${txId}`);
    const json = await res.json();

    if (
      json.tx_status === "success" ||
      json.tx_status === "abort_by_response"
    ) {
      console.log("Tx confirmed:", json);
      return json;
    }
    if (json.tx_status === "failed") {
      throw new Error("Tx failed: " + JSON.stringify(json));
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Tx polling timed out");
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

  const hex = cvToHex(res);
  console.log("Read-only result:", { functionName, hex });
  return hex;
}
