import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Issue } from "../types";
import { Shield, MapPin, AlertCircle, Eye, Layers, Compass } from "lucide-react";

// Monkey-patch Leaflet to prevent "Cannot read properties of undefined (reading '_leaflet_pos')" crashes
if (typeof window !== "undefined" && L && L.DomUtil) {
  const originalGetPosition = L.DomUtil.getPosition;
  L.DomUtil.getPosition = function (el: any) {
    if (!el) {
      return new L.Point(0, 0);
    }
    try {
      return originalGetPosition(el);
    } catch (e) {
      return new L.Point(0, 0);
    }
  };

  const originalSetPosition = L.DomUtil.setPosition;
  L.DomUtil.setPosition = function (el: any, point: any) {
    if (!el) return;
    try {
      originalSetPosition(el, point);
    } catch (e) {}
  };
}

interface MainMapProps {
  issues: Issue[];
  selectedIssue: Issue | null;
  onSelectIssue: (issue: Issue) => void;
  viewMode: "pins" | "heatmap";
  setViewMode: (mode: "pins" | "heatmap") => void;
  userLocation: { lat: number; lng: number } | null;
  proximityFilter: number | "all";
  onUpdateUserLocation: (lat: number, lng: number) => void;
  onBoundsChange: (bounds: {
    northEast: { lat: number; lng: number };
    southWest: { lat: number; lng: number };
  }) => void;
}

export default function MainMap({
  issues,
  selectedIssue,
  onSelectIssue,
  viewMode,
  setViewMode,
  userLocation,
  proximityFilter,
  onUpdateUserLocation,
  onBoundsChange
}: MainMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const heatGroupRef = useRef<L.LayerGroup | null>(null);
  const userGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [groupHazards, setGroupHazards] = useState(true);
  const [mapStyle, setMapStyle] = useState<"street" | "satellite">("street");
  const [isMapReady, setIsMapReady] = useState(false);

  // Indiranagar, Bangalore Coordinate Center
  const DEFAULT_CENTER: [number, number] = [12.972, 77.6416];

  // Helper to resolve severity color classes
  const getSeverityColors = (severity: number) => {
    switch (severity) {
      case 1:
        return { bg: "bg-green-500", ping: "bg-green-400", hex: "#22c55e" };
      case 2:
        return { bg: "bg-emerald-500", ping: "bg-emerald-400", hex: "#10b981" };
      case 3:
        return { bg: "bg-amber-500", ping: "bg-amber-400", hex: "#f59e0b" };
      case 4:
        return { bg: "bg-rose-500", ping: "bg-rose-400", hex: "#f43f5e" };
      case 5:
      default:
        return { bg: "bg-red-800", ping: "bg-red-700", hex: "#991b1b" };
    }
  };

  // 1. Initialize Map
  useEffect(() => {
    if (!containerRef.current) return;

    // Remove any stale leaflet instances
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Determine initial center
    let initialCenter = DEFAULT_CENTER;
    if (userLocation) {
      initialCenter = [userLocation.lat, userLocation.lng];
    } else if (selectedIssue) {
      initialCenter = [selectedIssue.coordinates.lat, selectedIssue.coordinates.lng];
    } else if (issues.length > 0) {
      initialCenter = [issues[0].coordinates.lat, issues[0].coordinates.lng];
    }

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: 14,
      zoomControl: false,
      scrollWheelZoom: true,
    });

    // Custom positioned Zoom Control
    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    heatGroupRef.current = L.layerGroup().addTo(map);
    userGroupRef.current = L.layerGroup().addTo(map);
    setIsMapReady(true);

    // Initial bounds dispatch
    const boundsTimeout = setTimeout(() => {
      if (mapRef.current) {
        try {
          const b = mapRef.current.getBounds();
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          onBoundsChange({
            northEast: { lat: ne.lat, lng: ne.lng },
            southWest: { lat: sw.lat, lng: sw.lng }
          });
        } catch (e) {}
      }
    }, 150);

    const handleMove = () => {
      const b = map.getBounds();
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      onBoundsChange({
        northEast: { lat: ne.lat, lng: ne.lng },
        southWest: { lat: sw.lat, lng: sw.lng }
      });
    };

    map.on("moveend", handleMove);
    map.on("zoomend", handleMove);

    return () => {
      clearTimeout(boundsTimeout);
      map.off("moveend", handleMove);
      map.off("zoomend", handleMove);
      setIsMapReady(false);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // 1b. Manage Tile Layer based on mapStyle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    if (mapStyle === "street") {
      tileLayerRef.current = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
      }).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 20
      }).addTo(map);
    }
  }, [mapStyle, isMapReady]);

  // Click listener to set simulated user location
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      onUpdateUserLocation(e.latlng.lat, e.latlng.lng);
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [onUpdateUserLocation]);

  // Pan to userLocation when updated
  useEffect(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.setView(
        [userLocation.lat, userLocation.lng],
        mapRef.current.getZoom() || 14,
        { animate: true, duration: 1.2 }
      );
    }
  }, [userLocation]);

  // 2. Pan to selected issue
  useEffect(() => {
    if (mapRef.current && selectedIssue) {
      mapRef.current.setView(
        [selectedIssue.coordinates.lat, selectedIssue.coordinates.lng],
        16,
        { animate: true, duration: 1 }
      );
    }
  }, [selectedIssue]);

  // 3. Render User Beacons & Radius Boundary
  useEffect(() => {
    const map = mapRef.current;
    const userGroup = userGroupRef.current;
    if (!map || !userGroup) return;

    // Safely unbind and close tooltips before clearing layers
    try {
      map.closeTooltip();
    } catch (e) {}
    userGroup.eachLayer((layer: any) => {
      if (layer.closeTooltip) {
        layer.closeTooltip();
      }
      if (layer.unbindTooltip) {
        layer.unbindTooltip();
      }
    });
    userGroup.clearLayers();

    if (userLocation) {
      // Draw user location blue pulsing beacon
      const userIcon = L.divIcon({
        className: "custom-user-beacon",
        html: `
          <div class="relative flex items-center justify-center h-10 w-10">
            <span class="absolute inline-flex h-9 w-9 animate-ping rounded-full bg-blue-400 opacity-60"></span>
            <span class="absolute inline-flex h-6 w-6 rounded-full bg-blue-650/30"></span>
            <div class="relative flex items-center justify-center h-5 w-5 rounded-full bg-blue-600 border-2 border-white shadow-md">
              <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon });
      userMarker.bindTooltip(`
        <div class="px-2 py-1 text-slate-800">
          <p class="font-bold text-xs text-blue-700 flex items-center gap-1">
            📍 Your Focus Center
          </p>
          <p class="text-[9px] font-mono text-slate-500 mt-0.5">${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}</p>
          <p class="text-[9px] text-slate-400 font-sans mt-1">Click anywhere on the map to shift focus</p>
        </div>
      `, { direction: "top", offset: [0, -10], opacity: 0.95 });

      userMarker.addTo(userGroup);

      // Draw proximity boundary circle if active
      if (proximityFilter !== "all") {
        const radiusInMeters = proximityFilter * 1000;
        const boundaryCircle = L.circle([userLocation.lat, userLocation.lng], {
          radius: radiusInMeters,
          color: "#2563eb",
          fillColor: "#3b82f6",
          fillOpacity: 0.04,
          weight: 1.5,
          dashArray: "6,6"
        });

        boundaryCircle.bindTooltip(`
          <div class="px-2 py-1 text-slate-800 font-mono text-[10px]">
            <p class="font-bold text-blue-700">Neighborhood Focus Boundary</p>
            <p class="mt-0.5">Radius: ${proximityFilter} km (${radiusInMeters} meters)</p>
          </div>
        `, { sticky: true, opacity: 0.9 });

        boundaryCircle.addTo(userGroup);
      }
    }

    return () => {
      try {
        if (userGroupRef.current) {
          userGroupRef.current.clearLayers();
        }
      } catch (e) {}
    };
  }, [userLocation, proximityFilter]);

  // 4. Render Layers depending on viewMode, issues, and clustering options
  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    const heatGroup = heatGroupRef.current;

    if (!map || !markers || !heatGroup) return;

    // Safely unbind and close tooltips before clearing layers
    try {
      map.closeTooltip();
    } catch (e) {}
    markers.eachLayer((layer: any) => {
      if (layer.closeTooltip) {
        layer.closeTooltip();
      }
      if (layer.unbindTooltip) {
        layer.unbindTooltip();
      }
    });
    markers.clearLayers();

    heatGroup.eachLayer((layer: any) => {
      if (layer.closeTooltip) {
        layer.closeTooltip();
      }
      if (layer.unbindTooltip) {
        layer.unbindTooltip();
      }
    });
    heatGroup.clearLayers();

    if (viewMode === "pins") {
      if (groupHazards) {
        // Group close-piled issues into clusters
        interface HazardCluster {
          id: string;
          centroid: [number, number];
          items: Issue[];
        }

        const clusters: HazardCluster[] = [];
        const zoom = map.getZoom();

        // Tune grouping distance dynamically based on scale zoom
        let clusterRadiusMeters = 200;
        if (zoom >= 17) {
          clusterRadiusMeters = 40;
        } else if (zoom >= 16) {
          clusterRadiusMeters = 80;
        } else if (zoom >= 15) {
          clusterRadiusMeters = 160;
        } else if (zoom <= 12) {
          clusterRadiusMeters = 550;
        }

        issues.forEach((issue) => {
          const issueLatLng = L.latLng(issue.coordinates.lat, issue.coordinates.lng);
          const nearbyCluster = clusters.find((cluster) => {
            const clusterLatLng = L.latLng(cluster.centroid[0], cluster.centroid[1]);
            return map.distance(issueLatLng, clusterLatLng) < clusterRadiusMeters;
          });

          if (nearbyCluster) {
            nearbyCluster.items.push(issue);
            // Re-average center
            const latAvg = nearbyCluster.items.reduce((s, x) => s + x.coordinates.lat, 0) / nearbyCluster.items.length;
            const lngAvg = nearbyCluster.items.reduce((s, x) => s + x.coordinates.lng, 0) / nearbyCluster.items.length;
            nearbyCluster.centroid = [latAvg, lngAvg];
          } else {
            clusters.push({
              id: `cluster-${issue.id}`,
              centroid: [issue.coordinates.lat, issue.coordinates.lng],
              items: [issue]
            });
          }
        });

        // Draw each cluster
        clusters.forEach((cluster) => {
          if (cluster.items.length === 1) {
            // Render single regular pin
            const issue = cluster.items[0];
            const colors = getSeverityColors(issue.severity);
            const isSelected = selectedIssue?.id === issue.id;

            const customIcon = L.divIcon({
              className: "custom-leaflet-pin",
              html: `
                <div class="relative flex items-center justify-center pointer-events-auto h-9 w-9">
                  <span class="absolute inline-flex h-8 w-8 animate-ping rounded-full ${colors.ping} opacity-40"></span>
                  <div class="relative flex items-center justify-center h-6 w-6 rounded-full ${colors.bg} ${isSelected ? 'ring-4 ring-offset-2 ring-indigo-600 scale-125' : 'border border-white scale-100'} shadow-lg transition-transform duration-300">
                    <span class="text-[9px] font-mono font-bold text-white">${issue.severity}</span>
                  </div>
                </div>
              `,
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            });

            const marker = L.marker(cluster.centroid, { icon: customIcon });
            marker.on("click", (e) => {
              L.DomEvent.stopPropagation(e);
              onSelectIssue(issue);
            });

            marker.bindTooltip(`
              <div class="px-2 py-1 text-slate-800">
                <p class="font-semibold text-xs font-display flex items-center gap-1">
                  <span class="w-2 h-2 rounded-full ${colors.bg}"></span>
                  ${issue.title}
                </p>
                <p class="text-[10px] font-mono text-slate-500 mt-0.5">${issue.category} • Urgency: ${issue.urgency}</p>
              </div>
            `, { direction: "top", offset: [0, -10], opacity: 0.95 });

            marker.addTo(markers);
          } else {
            // Render aggregated hazard group cluster pin
            const maxSeverity = Math.max(...cluster.items.map((i) => i.severity));
            const colors = getSeverityColors(maxSeverity);
            
            // Highlight if any issue inside the cluster is selected
            const hasSelected = selectedIssue ? cluster.items.some((i) => i.id === selectedIssue.id) : false;

            const clusterIcon = L.divIcon({
              className: "custom-leaflet-cluster",
              html: `
                <div class="relative flex items-center justify-center pointer-events-auto h-11 w-11 select-none">
                  <span class="absolute inline-flex h-10 w-10 animate-pulse rounded-full ${colors.ping} opacity-50"></span>
                  <div class="relative flex flex-col items-center justify-center h-8 w-8 rounded-full ${colors.bg} ${hasSelected ? 'ring-4 ring-indigo-600 ring-offset-2 scale-110' : 'border border-white hover:scale-105'} shadow-xl transition-all duration-200">
                    <span class="text-[9.5px] font-black text-white leading-none">${cluster.items.length}</span>
                    <span class="text-[6.5px] font-bold text-white/90 uppercase tracking-tighter leading-none mt-0.5">Piled</span>
                  </div>
                  <div class="absolute -top-0.5 -right-0.5 bg-slate-900 border border-white text-white text-[7.5px] px-1 py-0.2 rounded-full font-bold shadow font-mono">
                    ⚠️
                  </div>
                </div>
              `,
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            });

            const marker = L.marker(cluster.centroid, { icon: clusterIcon });
            
            // Click zooms in further to unpack cluster
            marker.on("click", (e) => {
              L.DomEvent.stopPropagation(e);
              const currentZoom = map.getZoom();
              map.setView(cluster.centroid, Math.min(20, currentZoom + 1));
              
              // Select the first severe issue in the clustered array
              const sortedItems = [...cluster.items].sort((a, b) => b.severity - a.severity);
              onSelectIssue(sortedItems[0]);
            });

            // Build dynamic grouped item description
            let tooltipHtml = `
              <div class="px-2.5 py-2 text-slate-800 max-w-sm">
                <p class="font-extrabold text-xs text-indigo-700 flex items-center gap-1 uppercase tracking-wider font-mono">
                  ⚡ Dense Hazard Cluster (${cluster.items.length} incidents)
                </p>
                <div class="space-y-1.5 mt-1.5 border-t border-slate-100 pt-1.5 max-h-[140px] overflow-y-auto pr-1">
            `;
            cluster.items.forEach((item) => {
              tooltipHtml += `
                <div class="flex items-center justify-between gap-4 text-[10px] mt-0.5">
                  <span class="font-bold text-slate-700 truncate max-w-[155px]">${item.title}</span>
                  <span class="font-mono text-[9px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.2 rounded select-none">Sev ${item.severity}</span>
                </div>
              `;
            });
            tooltipHtml += `
                </div>
                <p class="text-[8.5px] text-slate-450 mt-2 font-display font-medium">Click cluster badge to center zoom and inspect details</p>
              </div>
            `;

            marker.bindTooltip(tooltipHtml, { direction: "top", offset: [0, -10], opacity: 0.98 });
            marker.addTo(markers);
          }
        });
      } else {
        // Render regularly without grouping
        issues.forEach((issue) => {
          const colors = getSeverityColors(issue.severity);
          const isSelected = selectedIssue?.id === issue.id;

          const customIcon = L.divIcon({
            className: "custom-leaflet-pin",
            html: `
              <div class="relative flex items-center justify-center pointer-events-auto h-9 w-9">
                <span class="absolute inline-flex h-8 w-8 animate-ping rounded-full ${colors.ping} opacity-40"></span>
                <div class="relative flex items-center justify-center h-6 w-6 rounded-full ${colors.bg} ${isSelected ? 'ring-4 ring-offset-2 ring-indigo-600 scale-125' : 'border border-white scale-100'} shadow-lg transition-transform duration-300">
                  <span class="text-[9px] font-mono font-bold text-white">${issue.severity}</span>
                </div>
              </div>
            `,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          });

          const marker = L.marker([issue.coordinates.lat, issue.coordinates.lng], { icon: customIcon });
          marker.on("click", (e) => {
            L.DomEvent.stopPropagation(e);
            onSelectIssue(issue);
          });

          marker.bindTooltip(`
            <div class="px-2 py-1 text-slate-800">
              <p class="font-semibold text-xs font-display flex items-center gap-1">
                <span class="w-2 h-2 rounded-full ${colors.bg}"></span>
                ${issue.title}
              </p>
              <p class="text-[10px] font-mono text-slate-500 mt-0.5">${issue.category} • Urgency: ${issue.urgency}</p>
            </div>
          `, { direction: "top", offset: [0, -10], opacity: 0.95 });

          marker.addTo(markers);
        });
      }
    } else {
      // Draw Heatmap Overlay represented by large glowing density circles for active/open issues
      const activeIssues = issues.filter((i) => i.status !== "Resolved");

      activeIssues.forEach((issue) => {
        const colors = getSeverityColors(issue.severity);
        const radius = issue.severity * 50;

        const circle = L.circle([issue.coordinates.lat, issue.coordinates.lng], {
          radius: radius,
          color: colors.hex,
          fillColor: colors.hex,
          fillOpacity: 0.25,
          weight: 1
        });

        circle.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          onSelectIssue(issue);
        });

        circle.bindTooltip(`
          <div class="px-2 py-1 text-slate-800 max-w-xs">
            <p class="font-bold text-xs text-rose-700 flex items-center gap-1">
              <AlertCircle class="w-3.5 h-3.5" /> High Risk Cluster Hotspot
            </p>
            <p class="font-semibold text-xs mt-1 font-display">${issue.title}</p>
            <p class="text-[10px] font-mono text-slate-500 mt-0.5">Hazard Impact Radius: ${radius}m</p>
          </div>
        `, { direction: "top", opacity: 0.95 });

        circle.addTo(heatGroup);
      });
    }

    return () => {
      try {
        if (markersRef.current) {
          markersRef.current.clearLayers();
        }
        if (heatGroupRef.current) {
          heatGroupRef.current.clearLayers();
        }
      } catch (e) {}
    };
  }, [issues, viewMode, selectedIssue, groupHazards]);

  return (
    <div className="relative w-full h-full min-h-[350px] md:min-h-[500px] bg-slate-50 rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm">
      {/* Floating Clustering & Layer Controls UI (Top Right) */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col sm:flex-row gap-2">
        {/* Toggle Map Style (Street vs Satellite) */}
        <div className="flex bg-white/95 backdrop-blur-md rounded-xl p-1 border border-slate-200 shadow-md">
          <button
            id="toggle-map-style-street"
            type="button"
            onClick={() => setMapStyle("street")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold tracking-wide transition-all ${
              mapStyle === "street"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
            title="Switch to Street View"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Street</span>
          </button>
          <button
            id="toggle-map-style-satellite"
            type="button"
            onClick={() => setMapStyle("satellite")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold tracking-wide transition-all ${
              mapStyle === "satellite"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
            title="Switch to Satellite View"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Satellite</span>
          </button>
        </div>

        {/* Toggle Clustering */}
        <div className="flex bg-white/95 backdrop-blur-md rounded-xl p-1 border border-slate-200 shadow-md">
          <button
            id="toggle-hazard-clustering"
            type="button"
            onClick={() => setGroupHazards(!groupHazards)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold tracking-wide transition-all ${
              groupHazards
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            }`}
            title="Toggle automatic piling/grouping of nearby hazard incidents"
          >
            <Layers className={`w-3.5 h-3.5 ${groupHazards ? "animate-pulse" : ""}`} />
            <span>{groupHazards ? "Grouping Active" : "Ungrouped View"}</span>
          </button>
        </div>
      </div>

      {/* Floating View Controller UI */}
      <div className="absolute top-4 left-4 z-[1000] flex bg-white/95 backdrop-blur-md rounded-xl p-1 border border-slate-200 shadow-md">
        <button
          id="map-view-pins"
          onClick={() => setViewMode("pins")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            viewMode === "pins"
              ? "bg-slate-900 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Severity Pins
        </button>
        <button
          id="map-view-heatmap"
          onClick={() => setViewMode("heatmap")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
            viewMode === "heatmap"
              ? "bg-rose-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 hover:text-rose-600"
          }`}
        >
          <Shield className="w-3.5 h-3.5 animate-pulse" />
          Hotspot Heatmap
        </button>
      </div>

      {/* Legend Indicator Overlay */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur-md border border-slate-200 px-3 py-2 rounded-xl text-[11px] font-medium text-slate-600 shadow-md hidden sm:block">
        <p className="font-semibold text-slate-800 text-xs font-display mb-1.5">Hazard Severity Scale</p>
        <div className="flex flex-col gap-1 font-mono text-[10px]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
            <span>1-2 • Minimal / Mild (e.g. Broken Fence)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            <span>3 • Moderate (e.g. Broken Streetlamp)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>4 • High Priority (e.g. Deep Road Pothole)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-800"></span>
            <span>5 • Critical Hazard (e.g. Major Pipeline Burst)</span>
          </div>
        </div>
      </div>

      {/* Inner Map Container */}
      <div ref={containerRef} className="w-full h-full z-10" />
    </div>
  );
}
