import React, { useState } from "react";
import { X, MapPin, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "motion/react";

interface ManualLocationModalProps {
  onClose: () => void;
  onSetLocation: (lat: number, lng: number, ward: string, city: string) => void;
  userUuid?: string;
}

const PRESETS = [
  { label: "Ramanathapuram, Coimbatore", city: "Coimbatore", ward: "Ward 73 (Ramanathapuram)", lat: 10.9972, lng: 76.9936 },
  { label: "Eachanari, Coimbatore", city: "Coimbatore", ward: "Ward 94 (Eachanari)", lat: 10.9333, lng: 76.9691 },
  { label: "Indiranagar, Bengaluru", city: "Bengaluru", ward: "Indiranagar Ward", lat: 12.97189, lng: 77.64115 },
  { label: "Koramangala, Bengaluru", city: "Bengaluru", ward: "Koramangala Ward", lat: 12.9352, lng: 77.6245 },
  { label: "Mylapore, Chennai", city: "Chennai", ward: "Mylapore Ward", lat: 13.0333, lng: 80.2667 },
  { label: "Saket, Delhi", city: "Delhi", ward: "Saket Sector", lat: 28.5224, lng: 77.2159 }
];

export default function ManualLocationModal({ onClose, onSetLocation, userUuid }: ManualLocationModalProps) {
  const [address, setAddress] = useState("");
  const [manualWard, setManualWard] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/location/resolve-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userUuid,
          address: address.trim()
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to geocode location.");
      }

      const data = await response.json();
      
      // If the user specified a custom manual ward, override the resolved one
      const finalWard = manualWard.trim() ? manualWard.trim() : data.ward;

      // If user provided a custom ward, sync it to database
      if (manualWard.trim() && userUuid) {
        await fetch(`/api/users/${userUuid}/join-ward`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ward: manualWard.trim() })
        });
      }

      onSetLocation(data.lat, data.lng, finalWard, data.city);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred while locating.");
    } finally {
      setLoading(false);
    }
  };

  const handlePresetSelect = async (preset: typeof PRESETS[0]) => {
    setLoading(true);
    setError(null);
    try {
      // If userUuid exists, let's join that ward on the database
      if (userUuid) {
        await fetch(`/api/users/${userUuid}/join-ward`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ward: preset.ward })
        });
      }
      onSetLocation(preset.lat, preset.lng, preset.ward, preset.city);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError("Failed to update location to preset.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-600 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-sans">Set Manual Location</h3>
              <p className="text-[10px] text-slate-500 font-medium">Auto-captures real municipal ward boundaries</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all font-semibold text-xs cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-800 font-semibold leading-relaxed">
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Address Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                Where are you located? (Enter Area, City)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramanathapuram, Coimbatore"
                  className="w-full pl-9 pr-4 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-200 focus:border-indigo-500 focus:outline-none bg-slate-50/50 text-slate-800 font-semibold"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3.5" />
              </div>
            </div>

            {/* Custom Ward Override Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Manual Ward Override (Optional)
                </label>
                <span className="text-[9px] font-mono text-indigo-500 font-semibold">Gemini analyzes if empty</span>
              </div>
              <input
                type="text"
                placeholder="e.g. Ward 73 or Ramanathapuram Ward"
                className="w-full px-4 py-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-200 focus:border-indigo-500 focus:outline-none bg-slate-50/50 text-slate-800 font-semibold"
                value={manualWard}
                onChange={(e) => setManualWard(e.target.value)}
              />
            </div>

            {/* Action button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resolving with Gemini AI...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  Analyze & Assign Ward
                </>
              )}
            </button>
          </form>

          {/* Preset Locations */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Quick Preset Neighborhoods
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  disabled={loading}
                  onClick={() => handlePresetSelect(preset)}
                  className="flex flex-col items-start p-2.5 border border-slate-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/20 text-left transition-all cursor-pointer"
                >
                  <span className="text-[10.5px] font-bold text-slate-700 truncate w-full">
                    {preset.label.split(",")[0]}
                  </span>
                  <span className="text-[9px] text-slate-400 font-medium truncate w-full">
                    {preset.city} • {preset.ward}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
