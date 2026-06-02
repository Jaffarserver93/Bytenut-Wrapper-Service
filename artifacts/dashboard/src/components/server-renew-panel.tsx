import React, { useEffect, useState } from "react";
import { useExtensionInfo, useExtendServer } from "@/hooks/use-bytenut";
import { Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ServerRenewPanelProps {
  serverId: string;
}

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
    remaining > 30 * 60
      ? "#22c55e"
      : remaining > 10 * 60
        ? "#eab308"
        : "#ef4444";

  const label = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold font-mono leading-none" style={{ color }}>
          {label}
        </span>
        <span className="text-[9px] text-muted-foreground mt-0.5 tracking-widest uppercase">
          remaining
        </span>
      </div>
    </div>
  );
}

export function ServerRenewPanel({ serverId }: ServerRenewPanelProps) {
  const { data, isLoading, isError, dataUpdatedAt } = useExtensionInfo(serverId);
  const extend = useExtendServer(serverId);

  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t border-border/50 flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
        <Clock className="w-3 h-3" />
        <span>Loading renewal info…</span>
      </div>
    );
  }

  if (isError || !data?.extensionInfo?.data) {
    return null;
  }

  const info = data.extensionInfo.data as {
    minutesUntilExpiration: number;
    extendMinutes: number;
    canExtend: boolean;
    minutesUntilNextExtension: number;
    cooldownMinutes: number;
    extensionCount: number;
  };

  const initialRemainingSeconds = info.minutesUntilExpiration * 60;
  const expiryMs = dataUpdatedAt + initialRemainingSeconds * 1000;
  const expiryLabel = new Date(expiryMs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
      <div className="flex items-center gap-4">
        <CircularCountdown
          initialRemainingSeconds={initialRemainingSeconds}
          fetchedAt={dataUpdatedAt}
          totalMinutes={info.extendMinutes}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Renew Server
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="truncate text-[11px]">{expiryLabel}</span>
          </div>
          <Button
            size="sm"
            disabled={!info.canExtend || extend.isPending}
            onClick={() => extend.mutate()}
            className="w-full h-8 text-xs font-bold bg-green-600 hover:bg-green-500 text-white disabled:opacity-40"
          >
            {extend.isPending ? (
              <RefreshCw className="w-3 h-3 mr-1.5 animate-spin" />
            ) : (
              <span className="mr-1">+</span>
            )}
            {extend.isSuccess ? "Extended!" : `+${info.extendMinutes} min`}
          </Button>
          {!info.canExtend && info.minutesUntilNextExtension > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1 text-center">
              Available in {info.minutesUntilNextExtension}m
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
