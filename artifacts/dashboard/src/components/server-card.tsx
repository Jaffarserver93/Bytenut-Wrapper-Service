import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Activity, Cpu, HardDrive, MemoryStick, Clock, AlertTriangle } from "lucide-react";

interface ServerData {
  id: string;
  nodeName: string;
  regionName: string;
  instanceName: string;
  instanceStatus: string;
  cpu: number;
  memory: number;
  diskSize: number;
  cpuLimit: number;
  gameTypeName: string;
  remainExpiredDays: number;
  serverInfo: {
    state: string;
    utilization: {
      memoryBytes: number;
      memoryLimitBytes: number;
      cpuAbsolute: number;
      uptime: number;
      diskBytes: number;
    };
  };
}

interface ServerCardProps {
  server: ServerData;
}

function formatBytes(bytes: number) {
  return (bytes / 1073741824).toFixed(2);
}

function formatUptime(seconds: number) {
  if (!seconds) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function ServerCard({ server }: ServerCardProps) {
  const { state, utilization } = server.serverInfo;
  
  const isOnline = state === "online";
  const isStarting = state === "starting";
  const isOffline = state === "offline";
  
  const cpuPercent = Math.min(100, (utilization.cpuAbsolute / server.cpuLimit) * 100) || 0;
  const memUsed = utilization.memoryBytes;
  const memTotal = utilization.memoryLimitBytes || (server.memory * 1024 * 1024);
  const memPercent = Math.min(100, (memUsed / memTotal) * 100) || 0;
  
  const diskPercent = Math.min(100, (utilization.diskBytes / (server.diskSize * 1073741824)) * 100) || 0;

  return (
    <Card className="border-border bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col group transition-colors hover:border-primary/50 hover:bg-card">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <CardTitle className="text-xl font-bold truncate max-w-[200px] flex items-center gap-2">
              {server.instanceName}
            </CardTitle>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>{server.nodeName}</span>
              <span>•</span>
              <span>{server.regionName}</span>
              <span>•</span>
              <span>{server.gameTypeName}</span>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={`
              font-mono px-3 py-1
              ${isOnline ? 'border-success text-success bg-success/10' : ''}
              ${isStarting ? 'border-warning text-warning bg-warning/10' : ''}
              ${isOffline ? 'border-error text-error bg-error/10' : ''}
            `}
          >
            {state.toUpperCase()}
          </Badge>
        </div>
        
        {server.remainExpiredDays <= 1 && (
          <div className="bg-warning/10 border border-warning/50 text-warning px-3 py-2 rounded-md text-xs flex items-center gap-2 mt-2">
            <AlertTriangle className="w-4 h-4" />
            <span>Expires in {server.remainExpiredDays} days</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          {/* CPU */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
              <span>{cpuPercent.toFixed(1)}%</span>
            </div>
            <Progress value={cpuPercent} className="h-1.5" indicatorClassName={cpuPercent > 80 ? "bg-error" : cpuPercent > 60 ? "bg-warning" : "bg-primary"} />
          </div>
          
          {/* Memory */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MemoryStick className="w-3 h-3" /> MEM</span>
              <span>{formatBytes(memUsed)} / {formatBytes(memTotal)} GB</span>
            </div>
            <Progress value={memPercent} className="h-1.5" indicatorClassName={memPercent > 80 ? "bg-error" : memPercent > 60 ? "bg-warning" : "bg-primary"} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><HardDrive className="w-3 h-3" /> Disk</span>
            <span className="text-sm">{formatBytes(utilization.diskBytes)} / {server.diskSize} GB</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Clock className="w-3 h-3" /> Uptime</span>
            <span className="text-sm">{formatUptime(utilization.uptime)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
