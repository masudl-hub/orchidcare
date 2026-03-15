import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SensorReading {
  plant_id: string;
  soil_moisture: number | null;
  temperature: number | null;
  humidity: number | null;
  light_lux: number | null;
  battery_pct: number | null;
  created_at: string;
}

export interface SensorRange {
  plant_id: string;
  soil_moisture_min: number | null;
  soil_moisture_ideal_min: number | null;
  soil_moisture_ideal_max: number | null;
  soil_moisture_max: number | null;
  temperature_min: number | null;
  temperature_ideal_min: number | null;
  temperature_ideal_max: number | null;
  temperature_max: number | null;
  humidity_min: number | null;
  humidity_ideal_min: number | null;
  humidity_ideal_max: number | null;
  humidity_max: number | null;
  light_lux_min: number | null;
  light_lux_ideal_min: number | null;
  light_lux_ideal_max: number | null;
  light_lux_max: number | null;
  reasoning: string | null;
  is_active: boolean;
}

export interface SensorAlert {
  id: string;
  plant_id: string;
  alert_type: string;
  severity: string;
  metric: string | null;
  message: string;
  status: string;
  created_at: string;
}

export interface MetricStatus {
  value: number;
  unit: string;
  status: "ok" | "warning" | "critical" | "low" | "medium" | "bright" | "direct";
  idealMin: number | null;
  idealMax: number | null;
  min: number | null;
  max: number | null;
}

export interface SensorData {
  latest: SensorReading | null;
  ranges: SensorRange | null;
  alerts: SensorAlert[];
  history: SensorReading[];
  isStale: boolean;
  isOffline: boolean;
  lastReadingAge: string | null;
  metrics: {
    soil_moisture: MetricStatus | null;
    temperature: MetricStatus | null;
    humidity: MetricStatus | null;
    light_lux: MetricStatus | null;
  };
}

function assessMetric(
  value: number | null | undefined,
  metric: string,
  ranges: SensorRange | null,
  unit: string,
): MetricStatus | null {
  if (value == null) return null;

  const idealMin = ranges?.[`${metric}_ideal_min` as keyof SensorRange] as number | null;
  const idealMax = ranges?.[`${metric}_ideal_max` as keyof SensorRange] as number | null;
  const min = ranges?.[`${metric}_min` as keyof SensorRange] as number | null;
  const max = ranges?.[`${metric}_max` as keyof SensorRange] as number | null;

  let status: MetricStatus["status"] = "ok";

  if (min != null && value < min) status = "critical";
  else if (max != null && value > max) status = "critical";
  else if (idealMin != null && value < idealMin) status = "warning";
  else if (idealMax != null && value > idealMax) status = "warning";

  return { value, unit, status, idealMin, idealMax, min, max };
}

function formatAge(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min}m ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export function useSensorData(plantId: string | null) {
  return useQuery<SensorData>({
    queryKey: ["sensorData", plantId],
    queryFn: async (): Promise<SensorData> => {
      if (!plantId) {
        return { latest: null, ranges: null, alerts: [], history: [], isStale: false, isOffline: false, lastReadingAge: null, metrics: { soil_moisture: null, temperature: null, humidity: null, light_lux: null } };
      }

      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [latestResult, rangesResult, alertsResult, historyResult] = await Promise.all([
        supabase
          .from("sensor_readings")
          .select("plant_id, soil_moisture, temperature, humidity, light_lux, battery_pct, created_at")
          .eq("plant_id", plantId)
          .order("created_at", { ascending: false })
          .limit(1),

        supabase
          .from("sensor_ranges")
          .select("*")
          .eq("plant_id", plantId)
          .eq("is_active", true)
          .limit(1),

        supabase
          .from("sensor_alerts")
          .select("id, plant_id, alert_type, severity, metric, message, status, created_at")
          .eq("plant_id", plantId)
          .eq("status", "active"),

        supabase
          .from("sensor_readings")
          .select("plant_id, soil_moisture, temperature, humidity, light_lux, battery_pct, created_at")
          .eq("plant_id", plantId)
          .gte("created_at", since24h)
          .order("created_at", { ascending: true }),
      ]);

      const latest = latestResult.data?.[0] || null;
      const ranges = rangesResult.data?.[0] || null;
      const alerts = alertsResult.data || [];
      const history = historyResult.data || [];

      let isStale = false;
      let isOffline = false;
      let lastReadingAge: string | null = null;

      if (latest) {
        const ageMs = Date.now() - new Date(latest.created_at).getTime();
        isStale = ageMs > 30 * 60 * 1000;
        isOffline = ageMs > 24 * 60 * 60 * 1000;
        lastReadingAge = formatAge(ageMs);
      }

      const metrics = {
        soil_moisture: assessMetric(latest?.soil_moisture, "soil_moisture", ranges, "%"),
        temperature: assessMetric(latest?.temperature, "temperature", ranges, "°C"),
        humidity: assessMetric(latest?.humidity, "humidity", ranges, "%"),
        light_lux: assessMetric(latest?.light_lux, "light_lux", ranges, " lux"),
      };

      return { latest, ranges, alerts, history, isStale, isOffline, lastReadingAge, metrics };
    },
    enabled: !!plantId,
    refetchInterval: 60_000, // Refresh every 60s
    staleTime: 30_000,
  });
}

// Hook for collection grid — batch fetch latest status for all plants
export function useSensorStatusBatch(plantIds: string[]) {
  return useQuery({
    queryKey: ["sensorStatusBatch", plantIds.join(",")],
    queryFn: async () => {
      if (!plantIds.length) return {};

      const [readingsResult, rangesResult, alertsResult] = await Promise.all([
        supabase
          .from("sensor_readings")
          .select("plant_id, soil_moisture, temperature, humidity, light_lux, created_at")
          .in("plant_id", plantIds)
          .order("created_at", { ascending: false })
          .limit(plantIds.length * 2),

        supabase
          .from("sensor_ranges")
          .select("plant_id, soil_moisture_ideal_min, soil_moisture_ideal_max, temperature_ideal_min, temperature_ideal_max, humidity_ideal_min, humidity_ideal_max")
          .in("plant_id", plantIds)
          .eq("is_active", true),

        supabase
          .from("sensor_alerts")
          .select("plant_id, severity")
          .in("plant_id", plantIds)
          .eq("status", "active"),
      ]);

      // Latest per plant
      const latestByPlant: Record<string, any> = {};
      for (const r of readingsResult.data || []) {
        if (!latestByPlant[r.plant_id]) latestByPlant[r.plant_id] = r;
      }

      // Ranges per plant
      const rangesByPlant: Record<string, any> = {};
      for (const r of rangesResult.data || []) {
        rangesByPlant[r.plant_id] = r;
      }

      // Worst alert severity per plant
      const alertsByPlant: Record<string, string> = {};
      for (const a of alertsResult.data || []) {
        const current = alertsByPlant[a.plant_id];
        if (!current || a.severity === "critical" || (a.severity === "warning" && current !== "critical")) {
          alertsByPlant[a.plant_id] = a.severity;
        }
      }

      // Compute status per plant: "ok" | "warning" | "critical" | "offline" | "stale" | null
      const status: Record<string, { status: string; soil_moisture?: number }> = {};
      for (const pid of plantIds) {
        const reading = latestByPlant[pid];
        if (!reading) continue; // No sensor data for this plant

        const ageMs = Date.now() - new Date(reading.created_at).getTime();
        if (ageMs > 24 * 60 * 60 * 1000) {
          status[pid] = { status: "offline" };
        } else if (ageMs > 30 * 60 * 1000) {
          status[pid] = { status: "stale", soil_moisture: reading.soil_moisture };
        } else if (alertsByPlant[pid] === "critical") {
          status[pid] = { status: "critical", soil_moisture: reading.soil_moisture };
        } else if (alertsByPlant[pid] === "warning") {
          status[pid] = { status: "warning", soil_moisture: reading.soil_moisture };
        } else {
          status[pid] = { status: "ok", soil_moisture: reading.soil_moisture };
        }
      }

      return status;
    },
    enabled: plantIds.length > 0,
    refetchInterval: 120_000,
    staleTime: 60_000,
  });
}
