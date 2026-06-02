import React from "react";
import { useProfile, useServers } from "@/hooks/use-bytenut";
import { useAuth } from "@/context/AuthContext";
import { ServerCard } from "@/components/server-card";
import { Button } from "@/components/ui/button";
import { LogOut, User, Activity, Wallet, CreditCard, Clock, Globe } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const { data: profileRes, isLoading: loadingProfile, isError: errorProfile } = useProfile();
  const { data: serversRes, isLoading: loadingServers, isError: errorServers } = useServers();

  React.useEffect(() => {
    if (errorProfile) {
      logout();
    }
  }, [errorProfile, logout]);

  const profile = profileRes?.profile?.data;
  const servers = serversRes?.servers?.data || [];

  return (
    <div className="min-h-screen bg-background font-mono text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/20 text-primary rounded-xl flex items-center justify-center border border-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.2)]">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">System Status</h1>
              <p className="text-muted-foreground text-sm">Bytenut Network Overview</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={logout} className="md:self-start">
            <LogOut className="w-4 h-4 mr-2" />
            DISCONNECT
          </Button>
        </header>

        {/* Profile Stats */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {loadingProfile ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg bg-card/50" />
            ))
          ) : profile ? (
            <>
              <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
                <div className="bg-secondary p-3 rounded-md text-muted-foreground">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">OPERATOR</p>
                  <p className="font-bold">{profile.username}</p>
                </div>
              </div>
              <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
                <div className="bg-secondary p-3 rounded-md text-muted-foreground">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">BALANCE</p>
                  <p className="font-bold">${profile.money.toFixed(2)}</p>
                </div>
              </div>
              <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
                <div className="bg-secondary p-3 rounded-md text-muted-foreground">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">POINTS</p>
                  <p className="font-bold">{profile.point}</p>
                </div>
              </div>
              <div className="bg-card border border-border p-4 rounded-lg flex items-center gap-4">
                <div className="bg-secondary p-3 rounded-md text-muted-foreground">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">IP ADDRESS</p>
                  <p className="font-bold text-sm">{profile.loginIp}</p>
                </div>
              </div>
            </>
          ) : null}
        </section>

        {/* Servers Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              Active Instances
            </h2>
            {servers.length > 0 && (
              <span className="text-sm text-muted-foreground bg-secondary px-2 py-1 rounded">
                Total: {servers.length}
              </span>
            )}
          </div>

          {loadingServers ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-xl bg-card/50" />
              ))}
            </div>
          ) : errorServers ? (
            <div className="bg-destructive/10 border border-destructive text-destructive p-6 rounded-lg flex flex-col items-center justify-center text-center">
              <Activity className="w-8 h-8 mb-2" />
              <h3 className="font-bold mb-1">Telemetry Failure</h3>
              <p className="text-sm">Unable to connect to instance management API.</p>
            </div>
          ) : servers.length === 0 ? (
            <div className="bg-card/50 border border-border border-dashed p-12 rounded-xl flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                <Activity className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold mb-2">No Active Instances</h3>
              <p className="text-muted-foreground max-w-sm">
                You don't have any game servers running in the Bytenut cloud.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {servers.map((server: any) => (
                <ServerCard key={server.id} server={server} />
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
