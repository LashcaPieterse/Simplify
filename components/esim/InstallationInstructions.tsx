"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import type {
  InstallationInstructionStep,
  InstallationInstructionsResult,
  InstallationPlatformInstructions,
  InstallationPlatformName,
} from "@/lib/airalo/installInstructions";
import { isValidIccid, normalizeIccid } from "@/lib/esim/iccid";
import { cn } from "@/components/utils";

interface InstallationInstructionsProps {
  iccid: string | null | undefined;
  className?: string;
}

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: InstallationInstructionsResult };

const PLATFORM_LABELS: Record<InstallationPlatformName, string> = {
  ios: "iOS",
  android: "Android",
};

interface CopyButtonProps {
  value: string;
  label?: string;
}

function CopyButton({ value, label = "Copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy value", error);
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full px-3 py-1 text-xs font-semibold text-teal-700 hover:text-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function StepsList({ steps }: { steps: InstallationInstructionStep[] | null }) {
  if (!steps || steps.length === 0) {
    return <p className="text-sm text-sand-500">Follow the on-device prompts.</p>;
  }

  return (
    <ol className="ml-5 list-decimal space-y-2 text-sm text-brand-900">
      {steps.map((step) => (
        <li key={`${step.order}-${step.text.slice(0, 8)}`}>
          <span className={cn("text-sm text-brand-900", step.emphasis ? "font-semibold" : undefined)}>
            {step.text}
          </span>
        </li>
      ))}
    </ol>
  );
}

function SectionShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-sand-200 p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-brand-900">{title}</h4>
      </div>
      {children}
    </div>
  );
}

export function InstallationInstructions({ iccid, className }: InstallationInstructionsProps) {
  const [state, setState] = useState<FetchState>({ status: iccid ? "loading" : "idle" });
  const [reloadToken, setReloadToken] = useState(0);
  const [activePlatform, setActivePlatform] = useState<InstallationPlatformName>("ios");
  const [isIos174Plus, setIsIos174Plus] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") {
      return;
    }

    const userAgent = navigator.userAgent ?? "";
    const isIos = /iPhone|iPad|iPod/.test(userAgent);

    setIsIosDevice(isIos);

    if (!isIos) {
      setIsIos174Plus(false);
      return;
    }

    const match = userAgent.match(/OS (\d+)_?(\d+)?/);
    const major = Number(match?.[1] ?? Number.NaN);
    const minor = Number(match?.[2] ?? 0);

    if (Number.isFinite(major) && (major > 17 || (major === 17 && minor >= 4))) {
      setIsIos174Plus(true);
    }
  }, []);

  useEffect(() => {
    if (!iccid) {
      setState({ status: "idle" });
      return;
    }

    const normalized = normalizeIccid(iccid);

    if (!isValidIccid(normalized)) {
      setState({
        status: "error",
        message: "We couldn't validate the ICCID. Confirm the digits and try again.",
      });
      return;
    }

    const controller = new AbortController();
    setState({ status: "loading" });

    fetch(`/api/sims/${encodeURIComponent(normalized)}/instructions`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const message =
            typeof body?.message === "string"
              ? body.message
              : "We couldn't load the installation instructions.";
          throw new Error(message);
        }

        return (await response.json()) as InstallationInstructionsResult;
      })
      .then((data) => {
        setState({ status: "ready", data });
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }

        setState({
          status: "error",
          message:
            error instanceof Error && error.message
              ? error.message
              : "We couldn't load the installation instructions.",
        });
      });

    return () => controller.abort();
  }, [iccid, reloadToken]);

  const hasIos = state.status === "ready" && state.data.platforms.some((p) => p.platform === "ios");
  const hasAndroid =
    state.status === "ready" && state.data.platforms.some((p) => p.platform === "android");

  useEffect(() => {
    if (activePlatform === "ios" && !hasIos && hasAndroid) {
      setActivePlatform("android");
    }

    if (activePlatform === "android" && !hasAndroid && hasIos) {
      setActivePlatform("ios");
    }
  }, [activePlatform, hasIos, hasAndroid]);

  const platformsByType = useMemo(() => {
    const groups: Record<InstallationPlatformName, InstallationPlatformInstructions[]> = {
      ios: [],
      android: [],
    };

    if (state.status === "ready") {
      state.data.platforms.forEach((platform) => {
        groups[platform.platform].push(platform);
      });
    }

    return groups;
  }, [state]);

  const selectedPlatforms =
    platformsByType[activePlatform]?.length > 0
      ? platformsByType[activePlatform]
      : [];

  const renderInstructions = () => {
    if (state.status === "idle") {
      return (
        <p className="text-sm text-sand-500">
          We&apos;ll surface the full instructions once the ICCID is available.
        </p>
      );
    }

    if (state.status === "loading") {
      return <p className="text-sm text-sand-500">Loading installation guide…</p>;
    }

    if (state.status === "error") {
      return (
        <div className="space-y-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          <p>{state.message}</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <button
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
              className="rounded-full bg-white px-3 py-1 font-semibold text-rose-900 shadow-sm ring-1 ring-rose-200 hover:bg-rose-100"
            >
              Retry
            </button>
            <a
              href="https://airalopartners.zendesk.com/hc/en-us/sections/13207524820893-FAQ"
              target="_blank"
              rel="noreferrer"
              className="rounded-full px-3 py-1 font-semibold text-rose-900 underline-offset-2 hover:underline"
            >
              Visit FAQ
            </a>
          </div>
        </div>
      );
    }

    if (selectedPlatforms.length === 0) {
      return (
        <p className="text-sm text-sand-500">
          We couldn&apos;t find instructions for {PLATFORM_LABELS[activePlatform]} yet.
        </p>
      );
    }

    return (
      <div className="space-y-6">
        {!state.data.isRequestedLanguageAvailable && state.data.requestedLanguage ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            We couldn&apos;t find instructions in {state.data.requestedLanguage.toUpperCase()}.
            Showing {state.data.language} instead.
          </div>
        ) : null}
        {selectedPlatforms.map((platform) => (
          <div key={platform.id} className="space-y-4">
            {(platform.model || platform.version) && (
              <div className="flex flex-wrap gap-3 text-sm text-sand-500">
                {platform.model ? <span>Model: {platform.model}</span> : null}
                {platform.version ? <span>OS: {platform.version}</span> : null}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-3">
              <SectionShell title="Scan QR">
                {platform.qr ? (
                  <div className="space-y-3">
                    <StepsList steps={platform.qr.steps} />
                    {platform.qr.qrCodeUrl ? (
                      <div className="rounded-2xl bg-sand-50 p-4 text-center">
                        <Image
                          src={platform.qr.qrCodeUrl}
                          alt="QR code for installing the eSIM"
                          width={128}
                          height={128}
                          className="mx-auto h-32 w-32 object-contain"
                          unoptimized
                        />
                        {platform.qr.qrCodeData ? (
                          <div className="mt-2 flex items-center justify-between text-xs text-sand-500">
                            <span className="truncate font-mono">
                              {platform.qr.qrCodeData}
                            </span>
                            <CopyButton value={platform.qr.qrCodeData} />
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {platform.qr.directAppleInstallationUrl ? (
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (!platform.qr?.directAppleInstallationUrl) return;
                            window.open(platform.qr.directAppleInstallationUrl, "_blank", "noopener,noreferrer");
                          }}
                          disabled={!isIos174Plus || !isIosDevice}
                          title={
                            isIos174Plus && isIosDevice
                              ? "Open the direct install link in Safari."
                              : "Send to an iPhone running iOS 17.4+ to use direct install."
                          }
                          className={cn(
                            "inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500",
                            isIos174Plus && isIosDevice
                              ? "bg-teal-600 text-white hover:bg-teal-500"
                              : "cursor-not-allowed bg-sand-200 text-sand-500",
                          )}
                        >
                          Install with Apple (iOS 17.4+)
                        </button>
                        <p className="text-xs text-sand-500">
                          {isIos174Plus && isIosDevice
                            ? "Opens the universal link in Safari on supported iPhones."
                            : "Available on iPhones running iOS 17.4 or later."}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-sand-500">QR installation isn&apos;t available yet.</p>
                )}
              </SectionShell>
              <SectionShell title="Enter manually">
                {platform.manual ? (
                  <div className="space-y-3">
                    <StepsList steps={platform.manual.steps} />
                    {platform.manual.smdpAddressAndActivationCode ? (
                      <div className="rounded-2xl bg-sand-50 p-4">
                        <p className="text-xs uppercase tracking-wide text-sand-500">
                          SM-DP+ address & activation code
                        </p>
                        <div className="mt-1 flex items-center justify-between gap-4">
                          <span className="font-mono text-sm text-brand-900">
                            {platform.manual.smdpAddressAndActivationCode}
                          </span>
                          <CopyButton
                            value={platform.manual.smdpAddressAndActivationCode}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-sand-500">
                    Manual setup isn&apos;t available for this platform.
                  </p>
                )}
              </SectionShell>
              <div className="space-y-3 rounded-2xl border border-sand-200 p-4">
                <details className="group" open>
                  <summary className="flex cursor-pointer items-center justify-between text-base font-semibold text-brand-900">
                    After installation
                  </summary>
                  <div className="mt-3 space-y-3">
                    {platform.network ? (
                      <>
                        <StepsList steps={platform.network.steps} />
                        <div className="space-y-1 text-sm text-sand-600">
                          {platform.network.apnValue ? (
                            <p>
                              APN: <span className="font-semibold">{platform.network.apnValue}</span>
                              {platform.network.apnType ? ` (${platform.network.apnType})` : null}
                            </p>
                          ) : null}
                          {platform.network.isRoaming !== null ? (
                            <p>Data roaming: {platform.network.isRoaming ? "On" : "Off"}</p>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-sand-500">
                        We&apos;ll surface the network configuration when it&apos;s ready.
                      </p>
                    )}
                  </div>
                </details>
              </div>
            </div>
          </div>
        ))}
        {state.data.share ? (
          <div className="rounded-2xl border border-sand-200 bg-sand-50 p-4">
            <h4 className="text-base font-semibold text-brand-900">Share from another device</h4>
            <div className="mt-2 space-y-2 text-sm text-brand-900">
              {state.data.share.link ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-sand-200">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-sand-500">Shareable link</p>
                    <p className="truncate font-medium">{state.data.share.link}</p>
                  </div>
                  <CopyButton value={state.data.share.link} />
                </div>
              ) : null}
              {state.data.share.accessCode ? (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-sand-200">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-sand-500">Access code</p>
                    <p className="font-medium">{state.data.share.accessCode}</p>
                  </div>
                  <CopyButton value={state.data.share.accessCode} />
                </div>
              ) : null}
              <p className="text-xs text-sand-500">
                Open the link and enter the access code on another device to start installation.
              </p>
            </div>
          </div>
        ) : null}
        <p className="text-xs text-sand-500">
          Need more help?{" "}
          <a
            href={state.data.faqUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-teal-700 underline-offset-2 hover:underline"
          >
            Visit the full FAQ
          </a>
          .
        </p>
      </div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex gap-3 rounded-full bg-sand-100 p-1">
        {(Object.keys(PLATFORM_LABELS) as InstallationPlatformName[]).map((platform) => {
          const isActive = platform === activePlatform;
          const isEnabled = platform === "ios" ? hasIos : hasAndroid;
          return (
            <button
              key={platform}
              type="button"
              disabled={!isEnabled}
              onClick={() => setActivePlatform(platform)}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm font-semibold",
                isActive
                  ? "bg-white text-brand-900 shadow"
                  : "text-sand-500 hover:text-brand-900",
                !isEnabled && "opacity-60",
              )}
            >
              {PLATFORM_LABELS[platform]}
            </button>
          );
        })}
      </div>
      {renderInstructions()}
    </div>
  );
}

export default InstallationInstructions;
