import { useEffect, useMemo, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

export function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) {
    return;
  }

  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js");
  });
}

export function usePwaInstall() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standaloneMedia = window.matchMedia("(display-mode: standalone)");
    const syncStandalone = () => {
      setIsStandalone(standaloneMedia.matches || window.navigator.standalone === true);
    };

    syncStandalone();
    standaloneMedia.addEventListener("change", syncStandalone);

    const onBeforeInstall = (event: BeforeInstallPromptEvent) => {
      event.preventDefault();
      setInstallEvent(event);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    return () => {
      standaloneMedia.removeEventListener("change", syncStandalone);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const installHint = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    if (isStandalone) {
      return "Installed";
    }
    if (installEvent) {
      return "Installable";
    }
    if (isIos) {
      return "Use Share > Add to Home Screen";
    }
    return "PWA shell ready";
  }, [installEvent, isStandalone]);

  const promptInstall = async () => {
    if (!installEvent) {
      return;
    }

    await installEvent.prompt();
    const result = await installEvent.userChoice;
    if (result.outcome === "accepted") {
      setInstallEvent(null);
    }
  };

  return {
    canInstall: Boolean(installEvent),
    installHint,
    isStandalone,
    promptInstall
  };
}

