import React, { useState } from "react";
import { User } from "../types";
import { X, User2, Save, Sparkles, CheckCircle2 } from "lucide-react";
import { initializeUser } from "../lib/api";

interface ProfileModalProps {
  currentUser: User;
  onClose: () => void;
  onUpdate: (updatedUser: User) => void;
  onLogout: () => void;
}

const AVATAR_COLORS = [
  { class: "bg-[#a7f3d0]", label: "Mint Green" },
  { class: "bg-[#c7d2fe]", label: "Lavender Periwinkle" },
  { class: "bg-[#fecdd3]", label: "Blush Rose" },
  { class: "bg-[#fef3c7]", label: "Soft Peach" },
  { class: "bg-[#bae6fd]", label: "Sky Blue" },
  { class: "bg-[#fbcfe8]", label: "Cosmic Orchid" },
  { class: "bg-[#ccfbf1]", label: "Teal Spray" },
  { class: "bg-[#e2e8f0]", label: "Soft Slate" }
];

export default function ProfileModal({ currentUser, onClose, onUpdate, onLogout }: ProfileModalProps) {
  const [name, setName] = useState(currentUser.name);
  const [selectedColor, setSelectedColor] = useState(currentUser.avatarColor || "bg-[#a7f3d0]");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      setFeedback(null);
      
      const updated = await initializeUser(currentUser.uuid, name, selectedColor);
      onUpdate(updated);
      setFeedback("Profile customized successfully!");
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error(err);
      setFeedback("Failed to update profile details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <User2 className="w-5 h-5 text-[#6d28d9]" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-sans">Citizen Profile Customization</h3>
              <p className="text-[10px] text-slate-500 font-medium">Syncs across seasons without password required</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {feedback && (
            <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 border ${
              feedback.includes("success") 
                ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Visual Avatar Preview Card */}
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200/60 p-4 rounded-2xl">
            <div className={`w-14 h-14 rounded-full ${selectedColor} flex items-center justify-center text-slate-800 text-xl font-bold font-mono shadow-sm`}>
              {name ? name.charAt(0).toUpperCase() : "?"}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Dynamic Badge Icon</p>
              <h4 className="text-sm font-bold text-slate-800 font-sans">{name || "Anonymous Citizen"}</h4>
              <p className="text-[10px] text-[#6d28d9] font-bold tracking-wider uppercase mt-0.5">
                Level {Math.floor(currentUser.xp / 500) + 1} Warden • {currentUser.xp} XP
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              Display Name / Calling Handle
            </label>
            <input
              type="text"
              required
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-200 focus:border-slate-400 focus:outline-none bg-slate-50/50 text-slate-800 font-semibold"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (feedback) setFeedback(null);
              }}
              placeholder="e.g. Kabir Singh"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
              District Avatar Visual Motif
            </label>
            <div className="grid grid-cols-4 gap-2.5 pt-1">
              {AVATAR_COLORS.map((color) => {
                const isActive = selectedColor === color.class;
                return (
                  <button
                    key={color.class}
                    type="button"
                    onClick={() => {
                      setSelectedColor(color.class);
                      if (feedback) setFeedback(null);
                    }}
                    className={`h-11 rounded-xl flex items-center justify-center shadow-sm relative border-2 ${color.class} ${
                      isActive ? "border-slate-900 ring-2 ring-slate-450" : "border-transparent hover:scale-105 transition-transform cursor-pointer"
                    }`}
                    title={color.label}
                  >
                    {isActive && (
                      <span className="bg-white/95 rounded-full p-0.5 shadow-sm text-slate-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-900" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 rounded-xl transition-all cursor-pointer"
            >
              Log Out
            </button>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 bg-[#f5f3ff] hover:bg-[#ede9fe] text-[#6d28d9] border border-[#ede9fe] px-4.5 py-2.2 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Customize Profile
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
