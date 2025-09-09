// utils/stacksConnect.js
import {
  connect,
  getLocalStorage,
  isConnected,
  disconnect,
} from "@stacks/connect";

export async function authenticate() {
  if (isConnected()) {
    console.log("Already connected");
    return getWalletAddress();
  }

  const response = await connect(); // opens wallet popup
  console.log("Wallet connected:", response.addresses);

  return getWalletAddress();
}

export function logoutWallet() {
  disconnect();
}

export function getWalletAddress() {
  const userData = getLocalStorage();
  if (userData?.addresses?.stx?.[0]?.address) {
    return userData.addresses.stx[0].address;
  }
  return null;
}
