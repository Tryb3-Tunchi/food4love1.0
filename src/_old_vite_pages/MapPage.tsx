import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  circleMarker,
  layerGroup,
  map as createMap,
  tileLayer,
  type LayerGroup,
  type Map as LeafletMap,
} from "leaflet";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import type { Profile } from "../types/db";

const haversineKm = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
};

export function MapPage() {
  const { user, profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);

  const loc = useMemo(() => {
    if (profile?.lat == null || profile?.lng == null) return null;
    return { lat: profile.lat, lng: profile.lng };
  }, [profile?.lat, profile?.lng]);

  const refresh = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", user.id)
      .limit(80);
    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }
    setItems((data as Profile[]) ?? []);
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const nearby = useMemo(() => {
    if (!loc) return items.slice(0, 20).map((p) => ({ p, dist: null }));
    return items
      .map((p) => {
        const dist =
          p.lat != null && p.lng != null
            ? haversineKm(loc, { lat: p.lat, lng: p.lng })
            : null;
        return { p, dist };
      })
      .sort((a, b) => (a.dist ?? 9999) - (b.dist ?? 9999))
      .slice(0, 20);
  }, [items, loc]);

  useEffect(() => {
    if (!loc) return;
    if (!mapElRef.current) return;
    if (mapRef.current) return;

    const map = createMap(mapElRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([loc.lat, loc.lng], 13);

    tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const group = layerGroup().addTo(map);
    markersRef.current = group;

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
  }, [loc]);

  useEffect(() => {
    const map = mapRef.current;
    const group = markersRef.current;
    if (!map || !group || !loc) return;

    group.clearLayers();

    circleMarker([loc.lat, loc.lng], {
      radius: 8,
      weight: 2,
      color: "#111827",
      fillColor: "#f59e0b",
      fillOpacity: 0.9,
    }).addTo(group);

    for (const { p } of nearby) {
      if (p.lat == null || p.lng == null) continue;
      circleMarker([p.lat, p.lng], {
        radius: 7,
        weight: 2,
        color: p.role === "cook" ? "#16a34a" : "#ef4444",
        fillColor: p.role === "cook" ? "#86efac" : "#fecaca",
        fillOpacity: 0.75,
      }).addTo(group);
    }
  }, [loc, nearby]);

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col px-4 py-6">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-brand-700 dark:text-brand-300">
            Map
          </div>
          <div className="text-xs text-slate-600 dark:text-zinc-400">
            Nearby people and cooks
          </div>
        </div>
        <Link to="/swipe">
          <Button variant="secondary">Back</Button>
        </Link>
      </header>

      {!loc ? (
        <Card className="p-4">
          <div className="text-sm text-slate-700 dark:text-zinc-200">
            Enable location access so we can show nearby people and cooks.
          </div>
          <div className="mt-3">
            <Link to="/setup">
              <Button variant="primary" className="w-full">
                Open profile setup
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="h-[320px] w-full bg-black/5 dark:bg-white/8">
            <div ref={mapElRef} className="h-full w-full" />
          </div>
        </Card>
      )}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-700 dark:text-zinc-200">
          Nearby
        </div>
        <Button variant="ghost" onClick={() => refresh()} disabled={isLoading}>
          Refresh
        </Button>
      </div>

      <div className="mt-3 space-y-3">
        {isLoading ? (
          <div className="text-sm text-slate-600 dark:text-zinc-300">
            Loading…
          </div>
        ) : null}
        {nearby.map(({ p, dist }) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-100">
                  {p.nickname ?? p.name}
                </div>
                <div className="text-xs text-slate-600 dark:text-zinc-400">
                  {p.role === "cook" ? "Cook" : "Person"}
                  {dist != null ? ` • ${dist.toFixed(1)}km` : ""}
                </div>
              </div>
              {p.role === "cook" && p.specialty ? (
                <div className="shrink-0 rounded-full border border-black/10 bg-white/60 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/12 dark:bg-white/6 dark:text-zinc-200">
                  {p.specialty}
                </div>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
