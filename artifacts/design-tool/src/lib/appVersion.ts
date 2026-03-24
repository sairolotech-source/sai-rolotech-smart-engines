import { useState, useEffect } from "react";

export const APP_VERSION = "2.2.8";
export const APP_VERSION_TAG = "v2.2.8";

export function useAppVersion(): string {
  const [version, setVersion] = useState(APP_VERSION_TAG);
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api?.getAppInfo) {
      api.getAppInfo()
        .then((info: { version?: string }) => {
          if (info?.version) setVersion("v" + info.version);
        })
        .catch(() => {});
    }
  }, []);
  return version;
}
