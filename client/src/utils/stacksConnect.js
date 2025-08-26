import { AppConfig, showConnect, UserSession } from "@stacks/connect";

const appConfig = new AppConfig(["store_write", "publish_data"]);
export const userSession = new UserSession({ appConfig });

export const appDetails = {
  name: "BitcoinWorld",
  icon: "https://BitcoinWorld.rocks/BitcoinWorld.png",
};

export function authenticate() {
  showConnect({
    appDetails,
    redirectTo: "/",
    onFinish: () => {
      window.location.reload();
    },
    userSession,
  });
}
