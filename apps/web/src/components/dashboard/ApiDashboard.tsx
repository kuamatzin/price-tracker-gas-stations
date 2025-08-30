import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Activity, AlertCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/services/api-client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface EndpointMetrics {
  endpoint: string;
  status: "operational" | "degraded" | "down" | "slow";
  metrics: {
    response_time_avg: number;
    response_time_p95: number;
    error_rate: number;
    requests_per_minute: number;
    last_error: string | null;
  };
  uptime: number;
}

interface DashboardData {
  service: string;
  version: string;
  status: string;
  endpoints: EndpointMetrics[];
  system: {
    database: string;
    redis: string;
    disk_usage: number;
    memory_usage: number;
    cpu_usage: number;
    queue_size: number;
  };
  timestamp: string;
}

export const ApiDashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");
  const [chartData, setChartData] = useState<any[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await apiClient.get<DashboardData>(
        "/api/v1/status/dashboard",
      );
      setData(response.data);
      setLastUpdated(new Date().toLocaleTimeString());
      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      setLoading(false);
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    const wsUrl =
      process.env.REACT_APP_WS_URL || "wss://api.fuelintel.mx/status";
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);

      if (update.type === "endpoint_update") {
        setData((prev) => {
          if (!prev) return prev;
          const endpoints = prev.endpoints.map((ep) =>
            ep.endpoint === update.endpoint ? { ...ep, ...update.data } : ep,
          );
          return { ...prev, endpoints };
        });
      } else if (update.type === "chart_data") {
        setChartData((prev) => [...prev.slice(-20), update.data]);
      }

      setLastUpdated(new Date().toLocaleTimeString());
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected, reconnecting...");
      if (autoRefresh) {
        setTimeout(connectWebSocket, 5000);
      }
    };

    setSocket(ws);

    return ws;
  }, [autoRefresh]);

  useEffect(() => {
    fetchStatus();
    const ws = connectWebSocket();

    // Refresh every 30 seconds as fallback
    const interval = autoRefresh ? setInterval(fetchStatus, 30000) : null;

    return () => {
      if (interval) clearInterval(interval);
      ws?.close();
    };
  }, [fetchStatus, connectWebSocket, autoRefresh]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "degraded":
      case "slow":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "down":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-100 text-green-800 border-green-200";
      case "degraded":
      case "slow":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "down":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getOverallStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-100 text-green-800 border-green-200";
      case "degraded_performance":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "partial_outage":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "major_outage":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">FuelIntel API Status Dashboard</h1>
          <p className="text-muted-foreground">
            Version {data?.version} • Last updated: {lastUpdated}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              "px-4 py-2 rounded-lg transition-colors",
              autoRefresh
                ? "bg-primary text-primary-foreground"
                : "bg-gray-200 text-gray-700",
            )}
          >
            Auto-refresh: {autoRefresh ? "ON" : "OFF"}
          </button>
          <Badge
            className={cn(
              "text-lg px-4 py-2",
              getOverallStatusColor(data?.status || "unknown"),
            )}
          >
            {getStatusIcon(data?.status || "unknown")}
            <span className="ml-2">
              {data?.status?.replace(/_/g, " ") || "Unknown"}
            </span>
          </Badge>
        </div>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.system.database}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Redis Cache</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.system.redis}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Disk Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.system.disk_usage}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data?.system.memory_usage}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.system.cpu_usage}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Queue Size</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.system.queue_size}</div>
          </CardContent>
        </Card>
      </div>

      {/* Endpoints Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.endpoints.map((endpoint) => (
          <Card key={endpoint.endpoint} className="relative">
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-sm font-mono">
                  {endpoint.endpoint}
                </CardTitle>
                <Badge
                  variant="outline"
                  className={getStatusColor(endpoint.status)}
                >
                  {endpoint.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Avg Response:</span>
                <span className="font-medium">
                  {endpoint.metrics.response_time_avg}ms
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">P95 Response:</span>
                <span className="font-medium">
                  {endpoint.metrics.response_time_p95}ms
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Error Rate:</span>
                <span
                  className={cn(
                    "font-medium",
                    endpoint.metrics.error_rate > 5 ? "text-red-500" : "",
                  )}
                >
                  {endpoint.metrics.error_rate.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Requests/min:</span>
                <span className="font-medium">
                  {endpoint.metrics.requests_per_minute}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Uptime:</span>
                <span className="font-medium">{endpoint.uptime}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Response Time Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Response Time Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="#8884d8"
                  name="Average"
                />
                <Line
                  type="monotone"
                  dataKey="p95"
                  stroke="#82ca9d"
                  name="P95"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
