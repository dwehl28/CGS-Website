"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

function isStandaloneDisplay() {
  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

export default function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(true);

  useEffect(() => {
    const environmentTimer = window.setTimeout(() => {
      setIsIos(isIosDevice());
      setIsStandalone(isStandaloneDisplay());
    }, 0);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.clearTimeout(environmentTimer);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  if (isStandalone || (!isIos && !installPrompt)) {
    return null;
  }

  async function handleInstallClick() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
      setIsStandalone(true);
    }
  }

  return (
    <div className="rounded-[1.25rem] border border-[var(--sun)]/30 bg-[var(--sun)]/10 p-4 text-sm leading-6 text-zinc-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-white">Install CGS Golf</p>
          {isIos ? (
            <p className="mt-1 text-zinc-300">
              In Safari, use Share, then Add to Home Screen.
            </p>
          ) : (
            <p className="mt-1 text-zinc-300">
              Add the player app to this device.
            </p>
          )}
        </div>
        {installPrompt ? (
          <button
            type="button"
            className="btn-secondary shrink-0"
            onClick={handleInstallClick}
          >
            Install app
          </button>
        ) : null}
      </div>
    </div>
  );
}
