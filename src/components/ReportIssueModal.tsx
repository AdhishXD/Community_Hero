import React, { useState, useEffect, useRef } from "react";
import { X, Upload, MapPin, Loader2, Sparkles, AlertTriangle, ShieldCheck, Camera } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ReportPayload, ReportResponse, reportIssue } from "../lib/api";

interface ReportIssueModalProps {
  onClose: () => void;
  onSuccess: (response: ReportResponse) => void;
  currentUserUuid: string;
  userLocation: { lat: number; lng: number } | null;
}

export default function ReportIssueModal({ onClose, onSuccess, currentUserUuid, userLocation }: ReportIssueModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [customPhotoBase64, setCustomPhotoBase64] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>(() => {
    return userLocation || { lat: 12.9716, lng: 77.6416 };
  });
  const [coordsSource, setCoordsSource] = useState<string>(userLocation ? "User Location" : "Default");
  const [loadingCoords, setLoadingCoords] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // 1. Capture Coordinates Silently
  useEffect(() => {
    if (userLocation) {
      setCoords(userLocation);
      setCoordsSource("User Location");
      return;
    }

    if (navigator.geolocation) {
      setLoadingCoords(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          setCoordsSource("Browser GPS");
          setLoadingCoords(false);
        },
        (err) => {
          console.warn("GPS Access declined or failed. Defaulting to general coordinates.");
          // Introduce minor coordinate variation to prevent overlaps on default coords!
          const randomOffsetLat = (Math.random() - 0.5) * 0.008;
          const randomOffsetLng = (Math.random() - 0.5) * 0.008;
          setCoords({ lat: 12.9716 + randomOffsetLat, lng: 77.6416 + randomOffsetLng });
          setLoadingCoords(false);
        },
        { timeout: 6000 }
      );
    }
  }, [userLocation]);

  // 2. Setup Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map centered at current state coords
    const map = L.map(mapContainerRef.current, {
      center: [coords.lat, coords.lng],
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    const customIcon = L.divIcon({
      className: "custom-div-icon",
      html: `<div class="w-8 h-8 flex items-center justify-center bg-violet-600 rounded-full border-2 border-white shadow-lg text-white">
               <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
             </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const marker = L.marker([coords.lat, coords.lng], {
      icon: customIcon,
      draggable: true
    }).addTo(map);

    // Marker drag handler
    marker.on("dragend", () => {
      const position = marker.getLatLng();
      setCoords({ lat: position.lat, lng: position.lng });
      setCoordsSource("Manual Placement");
    });

    // Map click handler
    map.on("click", (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      setCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      setCoordsSource("Manual Placement");
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Sync coords from GPS load
  useEffect(() => {
    if (mapRef.current && markerRef.current && (coordsSource === "Browser GPS" || coordsSource === "User Location")) {
      mapRef.current.setView([coords.lat, coords.lng], 15);
      markerRef.current.setLatLng([coords.lat, coords.lng]);
    }
  }, [coords.lat, coords.lng, coordsSource]);

  // 3. Handle Custom File Upload (Convert to Base64)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setCustomPhotoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 4. Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Please supply an issue title (e.g., 'Flooding in lane 4').");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Extract photo selection
      let photoData = "";
      if (customPhotoBase64) {
        photoData = customPhotoBase64;
      }

      const payload: ReportPayload = {
        title,
        description,
        photoData,
        coordinates: coords,
        userUuid: currentUserUuid
      };

      const response = await reportIssue(payload);
      onSuccess(response);
    } catch (err: any) {
      setError(err.message || "Failed to process dynamic report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#f5f3ff] border border-[#ede9fe] rounded-lg text-[#6d28d9]">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 font-sans">Report Infrastructure Issue</h3>
              <p className="text-[11px] text-slate-500 font-medium">Hyperlocal routing powered by Google Gemini AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
            id="close-report-modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Main Body */}
        <form onSubmit={handleSubmit} className="p-6 max-h-[75vh] overflow-y-auto space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          {/* Title Area */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Issue Headline <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              id="report-input-title"
              placeholder="e.g., Massive pothole near Indiranagar Metro pillars"
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 bg-slate-50/50"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>

          {/* Description Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Additional Details & Description
            </label>
            <textarea
              id="report-input-desc"
              rows={2}
              placeholder="Provide a short description (optional). Mention surrounding streets or visible markers to assist responders."
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 bg-slate-50/50 resize-none text-slate-700"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Map Location Selector */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Location <span className="text-rose-500">*</span>
              </label>
              {loadingCoords ? (
                <span className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                  <Loader2 className="w-3 h-3 animate-spin" /> GPS locating...
                </span>
              ) : (
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase font-mono border ${
                  coordsSource === "Browser GPS" ? "bg-[#ecfdf5] text-[#047857] border-[#d1fae5]" : "bg-[#f5f3ff] text-[#6d28d9] border-[#ede9fe]"
                }`}>
                  {coordsSource}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 leading-tight">
              Click anywhere on the map or drag the pin to manually adjust the issue location.
            </p>
            <div 
              ref={mapContainerRef} 
              className="w-full h-48 rounded-xl overflow-hidden border border-slate-200 shadow-sm z-10"
              style={{ minHeight: "192px" }}
            />
            <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span>Lat: {coords.lat.toFixed(5)}</span>
              <span>Lng: {coords.lng.toFixed(5)}</span>
            </div>
          </div>

          {/* Photo Submission Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Issue Visual (Recommended for +50 XP)
            </label>

            {/* Custom file picker */}
            <div className="relative border-2 border-dashed border-slate-200 hover:border-[#8b5cf6]/50 rounded-xl p-4 transition-colors flex items-center justify-center gap-2 text-slate-500 bg-slate-50/50">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="report-file-picker"
              />
              <Upload className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold text-slate-600">
                {customPhotoBase64 ? "Custom file attached ✓ (Click to change)" : "Upload Custom Photo file from local storage"}
              </span>
            </div>
            {customPhotoBase64 && (
              <div className="relative w-28 h-16 rounded-lg overflow-hidden border border-slate-200 mx-auto mt-2.5">
                <img src={customPhotoBase64} alt="Pre" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setCustomPhotoBase64(null)}
                  className="absolute top-1 right-1 bg-slate-900/80 hover:bg-slate-900 text-white p-0.5 rounded-full"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Modal Footer actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              id="report-submit-btn"
              className="flex items-center gap-2 bg-[#f5f3ff] hover:bg-[#ede9fe] text-[#6d28d9] border border-[#ede9fe] font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm tracking-wide transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#6d28d9]" />
                  Gemini analyzing pipeline...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                  Analyze and Post (+50 XP)
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
