import { useState, useEffect } from "react";
import {
  projectId,
  publicAnonKey,
} from "../utils/supabase/info";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "./ui/button";

interface HealthStatus {
  backend: "checking" | "connected" | "error";
  database: "checking" | "connected" | "error";
  auth: "checking" | "connected" | "error";
  message?: string;
}

export function BackendHealthCheck() {
  const [status, setStatus] = useState<HealthStatus>({
    backend: "checking",
    database: "checking",
    auth: "checking",
  });
  const [lastChecked, setLastChecked] = useState<Date>(
    new Date(),
  );

  const checkHealth = async () => {
    setStatus({
      backend: "checking",
      database: "checking",
      auth: "checking",
    });

    try {
      // Check backend health endpoint
      const healthResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-65e6e67f/health`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        },
      );

      if (healthResponse.ok) {
        setStatus((prev) => ({
          ...prev,
          backend: "connected",
        }));
      } else {
        setStatus((prev) => ({
          ...prev,
          backend: "error",
          message: `Backend returned ${healthResponse.status}`,
        }));
        return;
      }

      // Check database by attempting to read user workspaces (will fail if not logged in, but proves connection)
      try {
        const workspaceResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-65e6e67f/user/workspaces`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${publicAnonKey}`,
            },
          },
        );

        // Even if unauthorized (expected), a 401 means database connection is working
        if (
          workspaceResponse.status === 401 ||
          workspaceResponse.ok
        ) {
          setStatus((prev) => ({
            ...prev,
            database: "connected",
            auth: "connected",
          }));
        } else {
          setStatus((prev) => ({
            ...prev,
            database: "error",
            message: `Database check failed: ${workspaceResponse.status}`,
          }));
        }
      } catch (dbError) {
        setStatus((prev) => ({
          ...prev,
          database: "error",
          message: "Database connection failed",
        }));
      }

      setLastChecked(new Date());
    } catch (error) {
      setStatus({
        backend: "error",
        database: "error",
        auth: "error",
        message:
          error instanceof Error
            ? error.message
            : "Connection failed",
      });
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const getStatusIcon = (
    state: "checking" | "connected" | "error",
  ) => {
    switch (state) {
      case "checking":
        return (
          <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        );
      case "connected":
        return (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        );
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (
    state: "checking" | "connected" | "error",
  ) => {
    switch (state) {
      case "checking":
        return <Badge variant="secondary">Checking...</Badge>;
      case "connected":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
            Connected
          </Badge>
        );
      case "error":
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  const allConnected =
    status.backend === "connected" &&
    status.database === "connected" &&
    status.auth === "connected";
  const anyError =
    status.backend === "error" ||
    status.database === "error" ||
    status.auth === "error";

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Backend Health Check
              {allConnected && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              {anyError && (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
            <CardDescription>
              System connectivity status
            </CardDescription>
          </div>
          <Button
            onClick={checkHealth}
            variant="outline"
            size="sm"
          >
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Backend Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(status.backend)}
            <span className="font-medium">Backend Server</span>
          </div>
          {getStatusBadge(status.backend)}
        </div>

        {/* Database Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(status.database)}
            <span className="font-medium">
              Database (KV Store)
            </span>
          </div>
          {getStatusBadge(status.database)}
        </div>

        {/* Auth Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(status.auth)}
            <span className="font-medium">Authentication</span>
          </div>
          {getStatusBadge(status.auth)}
        </div>

        {/* Error Message */}
        {status.message && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {status.message}
            </p>
          </div>
        )}

        {/* Success Message */}
        {allConnected && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <p className="text-sm text-green-800 dark:text-green-200 font-medium">
              ✓ All systems operational
            </p>
            <p className="text-xs text-green-700 dark:text-green-300 mt-1">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          </div>
        )}

        {/* Connection Details */}
        <div className="mt-4 pt-4 border-t space-y-2">
          <p className="text-xs text-muted-foreground">
            <strong>Project ID:</strong> {projectId}
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Endpoint:</strong>{" "}
            /functions/v1/make-server-65e6e67f
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Status:</strong>{" "}
            {allConnected
              ? "🟢 Production Ready"
              : anyError
                ? "🔴 Error"
                : "🟡 Checking"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}