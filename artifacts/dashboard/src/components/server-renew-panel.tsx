import React, { useEffect, useState } from "react";
import { useExtensionInfo, useExtendServer, useAutoExtendConfig, useSetAutoExtendConfig } from "@/hooks/use-bytenut";
import { Clock, RefreshCw, Zap, ZapOff, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ServerRenewPanelProps {
  serverId: string;
}

const THRESHOLD_OPTIONS = [5, 10, 15, 20, 30];

function CircularCountdown({
  initialRemainingSeconds,
  fetchedAt,
  totalMinutes,
}: {
  initialRemainingSeconds: number;
  fetchedAt: number;
  totalMinutes: number;
}) {
  const [remaining, setRemaining] = useState<number>(() =>
    Math.max(0, initialRemainingSeconds - Math.floor((Date.now() - fetchedAt) / 1000)),
  );

  useEffect(() => {
    const tick = () => {
      const elapsed = Math.floor((Date.now() - fetchedAt) / 1000);
      setRemaining(Math.max(0, initialRemainingSeconds - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [initialRemainingSeconds, fetchedAt]);

  const totalSeconds = totalMinutes * 60;
  const fraction = totalSeconds > 0 ? Math.min(1, remaining / totalSeconds) : 0;

  const size = 88;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - fraction);

  const hours = Math.floor(remaining / 3600);
  const mins = Math.floor((remaining % 3600) / 60);

  const color =
    remaining > 30 * 60 ? "#22c55e" : remaining > 10 * 60 ? "#eab308" : "#ef4444";

  const label = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold font-mono leading-none" style={{ color }}>{label}</span>
        <span className="text-[9px] text-muted-foreground mt-0.5 tracking-widest uppercase">remaining</span>
      </div>
    </div>
  );
}

export function ServerRenewPanel({ serverId }: ServerRenewPanelProps) {
  const { data, isLoading, isError, dataUpdatedAt } = useExtensionInfo(serverId);
  const extend = useExtendServer(serverId);
  const { data: autoData, isLoading: autoLoading } = useAutoExtendConfig(serverId);
  const setAutoExtend = useSetAutoExtendConfig(serverId);

  const [showThreshold, setShowThreshold] = useState(false);

  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
        <Clock className="w-3 h-3" />
        <span>Loading renewal info…</span>
      </div>
    );
  }

  if (isError || !data?.extensionInfo?.data) return null;

  const info = data.extensionInfo.data as {
    minutesUntilExpiration: number;
    extendMinutes: number;
    canExtend: boolean;
    minutesUntilNextExtension: number;
    cooldownMinutes: number;
    extensionCount: number;
  };

  const autoConfig = autoData?.autoExtend;
  const autoEnabled = autoConfig?.enabled ?? false;
  const threshold = autoConfig?.thresholdMinutes ?? 10;
  const autoStatus = autoConfig?.status ?? "disabled";

  const initialRemainingSeconds = info.minutesUntilExpiration * 60;
  const expiryMs = dataUpdatedAt + initialRemainingSeconds * 1000;
  const expiryLabel = new Date(expiryMs).toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  const statusBadge =
    autoStatus === "extending" ? { label: "Extending…", color: "text-yellow-400" }
    : autoStatus === "cooldown" ? { label: "Cooldown", color: "text-blue-400" }
    : autoEnabled ? { label: "Auto ON", color: "text-green-400" }
    : null;

  return (
    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
      {/* Countdown + actions row */}
      <div className="flex items-center gap-4">
        <CircularCountdown
          initialRemainingSeconds={initialRemainingSeconds}
          fetchedAt={dataUpdatedAt}
          totalMinutes={info.extendMinutes}
        />
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Renew Server</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="truncate text-[11px]">{expiryLabel}</span>
          </div>
          <Button
            size="sm"
            disabled={!info.canExtend || extend.isPending}
            onClick={() => extend.mutate()}
            className="w-full h-8 text-xs font-bold bg-green-600 hover:bg-green-500 text-white disabled:opacity-40"
          >
            {extend.isPending
              ? <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
              : <span className="mr-1">+</span>}
            {extend.isSuccess ? "Extended!" : `+${info.extendMinutes} min`}
          </Button>
          {!info.canExtend && info.minutesUntilNextExtension > 0 && (
            <p className="text-[10px] text-muted-foreground text-center">
              Cooldown: {info.minutesUntilNextExtension}m remaining
            </p>
          )}
        </div>
      </div>

      {/* Auto-extend row */}
      <div className="bg-secondary/40 rounded-lg px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {autoEnabled
              ? <Zap className="w-3.5 h-3.5 text-green-400" />
              : <ZapOff className="w-3.5 h-3.5 text-muted-foreground" />}
            <span className="text-xs font-medium">Auto-Extend</span>
            {statusBadge && (
              <span className={`text-[10px] font-mono ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
            )}
          </div>
          <button
            disabled={autoLoading || setAutoExtend.isPending}
            onClick={() =>
              setAutoExtend.mutate({ enabled: !autoEnabled, thresholdMinutes: threshold })
            }
            className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
              autoEnabled ? "bg-green-600" : "bg-secondary border border-border"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                autoEnabled ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
        </div>

        {autoEnabled && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Extend when ≤</span>
            <div className="relative">
              <button
                onClick={() => setShowThreshold((v) => !v)}
                className="flex items-center gap-1 bg-background border border-border rounded px-2 py-0.5 text-xs font-mono hover:border-primary/50 transition-colors"
              >
                {threshold} min
                <ChevronDown className="w-3 h-3" />
              </button>
              {showThreshold && (
                <div className="absolute right-0 bottom-full mb-1 bg-card border border-border rounded shadow-lg z-10 overflow-hidden">
                  {THRESHOLD_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setAutoExtend.mutate({ enabled: true, thresholdMinutes: opt });
                        setShowThreshold(false);
                      }}
                      className={`block w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-secondary transition-colors ${
                        opt === threshold ? "text-primary font-bold" : ""
                      }`}
                    >
                      {opt} min
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span>remaining</span>
          </div>
        )}

        {autoConfig?.lastExtendedAt && (
          <p className="text-[10px] text-muted-foreground">
            Last auto-extended: {new Date(autoConfig.lastExtendedAt).toLocaleTimeString()}
          </p>
        )}
        {autoConfig?.lastError && (
          <p className="text-[10px] text-red-400 truncate" title={autoConfig.lastError}>
            Error: {autoConfig.lastError}
          </p>
        )}
      </div>
    </div>
  );
}
