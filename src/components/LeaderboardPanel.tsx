import { useState, useEffect } from "react";
import { User } from "../types";
import { Award, Flame, ShieldAlert, Sparkles, Trophy, UserCheck, Zap, MapPin, CheckSquare, Layers, HelpCircle, ChevronRight, UserPlus, Shield, Globe, Map } from "lucide-react";
import { fetchWardLeaderboard, checkInLocation, joinWard, WardLeaderboardItem } from "../lib/api";
import { getJurisdiction } from "../App";

interface LeaderboardPanelProps {
  leaderboard: User[];
  currentUser: User | null;
  userLocation: { lat: number; lng: number } | null;
  onUserUpdate?: (updatedUser: User) => void;
  refreshLeaderboard?: () => void;
}

export default function LeaderboardPanel({ leaderboard, currentUser, userLocation, onUserUpdate, refreshLeaderboard }: LeaderboardPanelProps) {
  const [activeTab, setActiveTab] = useState<"citizens" | "wards">("citizens");
  const [competitionLevel, setCompetitionLevel] = useState<"ward" | "city" | "state">("ward");
  const [wardLeaderboard, setWardLeaderboard] = useState<WardLeaderboardItem[]>([]);
  const [loadingWards, setLoadingWards] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [joining, setJoining] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState<string | null>(null);
  
  const [availableWards, setAvailableWards] = useState<string[]>([
    "Indiranagar Ward",
    "Koramangala Ward",
    "HSR Layout Ward",
    "Whitefield Ward",
    "Jayanagar Ward"
  ]);

  const [selectedWardToJoin, setSelectedWardToJoin] = useState(availableWards[0] || "Indiranagar Ward");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (!userLocation) return;
    fetch(`/api/wards?lat=${userLocation.lat}&lng=${userLocation.lng}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.wards && data.wards.length > 0) {
          setAvailableWards(data.wards);
          setSelectedWardToJoin(data.wards[0]);
        }
      })
      .catch((err) => console.error("Error fetching wards from API:", err));
  }, [userLocation?.lat, userLocation?.lng]);

  // Helper to resolve tiers
  const getCitizenTier = (xp: number) => {
    if (xp < 200) return { title: "Newcomer", color: "bg-slate-100 text-slate-700 border-slate-200" };
    if (xp < 500) return { title: "Citizen", color: "bg-[#ecfdf5] text-[#047857] border-[#d1fae5]" };
    if (xp < 1000) return { title: "Warden", color: "bg-[#eff6ff] text-[#1d4ed8] border-[#dbeafe]" };
    if (xp < 2000) return { title: "Guardian", color: "bg-[#f5f3ff] text-[#6d28d9] border-[#ede9fe]" };
    return { title: "Champion", color: "bg-[#fffbeb] text-[#b45309] border-[#fef3c7]" };
  };

  const loadWards = async () => {
    setLoadingWards(true);
    try {
      const data = await fetchWardLeaderboard(userLocation?.lat, userLocation?.lng, currentUser?.uuid);
      setWardLeaderboard(data);
    } catch (err) {
      console.error("Error loading ward leaderboard:", err);
    } finally {
      setLoadingWards(false);
    }
  };

  useEffect(() => {
    loadWards();
  }, [activeTab, currentUser, userLocation]);

  const handleCheckIn = async () => {
    if (!currentUser) return;
    setCheckingIn(true);
    setCheckInStatus("Acquiring citizen coordinates...");

    // Mock geolocation check-in to make sure it always works smoothly inside sandbox environment
    const triggerSuccess = async (lat: number, lng: number) => {
      try {
        setCheckInStatus("Verifying local area cleanliness...");
        const response = await checkInLocation(currentUser.uuid, lat, lng);
        setCheckInStatus(`Successfully checked-in to ${response.ward}! Earned 10 XP.`);
        
        if (onUserUpdate) {
          onUserUpdate(response.user);
        }
        if (refreshLeaderboard) {
          refreshLeaderboard();
        }
        await loadWards();
        setTimeout(() => setCheckInStatus(null), 5000);
      } catch (err: any) {
        setCheckInStatus(`Verification failed: ${err.message}`);
        setTimeout(() => setCheckInStatus(null), 5000);
      } finally {
        setCheckingIn(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          triggerSuccess(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn("Geolocation API unavailable, simulating coordinates inside Indiranagar...", error);
          // Fallback coordinate randomized near Indiranagar
          const mockLat = 12.97189 + (Math.random() - 0.5) * 0.02;
          const mockLng = 77.64115 + (Math.random() - 0.5) * 0.02;
          triggerSuccess(mockLat, mockLng);
        },
        { timeout: 8000 }
      );
    } else {
      const mockLat = 12.97189 + (Math.random() - 0.5) * 0.02;
      const mockLng = 77.64115 + (Math.random() - 0.5) * 0.02;
      triggerSuccess(mockLat, mockLng);
    }
  };

  const handleJoinWard = async (wardName?: string) => {
    if (!currentUser) return;
    const targetWard = wardName || selectedWardToJoin;
    if (!targetWard || !targetWard.trim()) return;
    setJoining(true);
    try {
      const updatedUser = await joinWard(currentUser.uuid, targetWard.trim());
      if (onUserUpdate) {
        onUserUpdate(updatedUser);
      }
      if (refreshLeaderboard) {
        refreshLeaderboard();
      }
      await loadWards();
      setSearchQuery(""); // Clear search query after joining
    } catch (err: any) {
      console.error(`Failed to transfer ward: ${err.message}`);
    } finally {
      setJoining(false);
    }
  };

  // Pre-coded available badges list to show locked vs unlocked
  const ALL_BADGES = [
    {
      id: "first_report",
      name: "First Action",
      icon: Sparkles,
      description: "Reported your first infrastructure hazard inside Community Hero.",
      color: "text-[#b45309] bg-[#fffbeb] border-[#fef3c7]"
    },
    {
      id: "verifications_5",
      name: "Community Auditor",
      icon: ShieldAlert,
      description: "Successfully casted 5 community verification upvotes for local hazard confirmations.",
      color: "text-[#047857] bg-[#ecfdf5] border-[#d1fae5]"
    },
    {
      id: "streak_7",
      name: "Locality Warden",
      icon: Flame,
      description: "Maintained a 7-day municipal contribution streak inside your local districts.",
      color: "text-[#e11d48] bg-[#fff1f2] border-[#ffe4e6]"
    },
    {
      id: "xp_1000",
      name: "Local Guardian",
      icon: Award,
      description: "Accumulated more than 1,000 XP in active community service.",
      color: "text-[#6d28d9] bg-[#f5f3ff] border-[#ede9fe]"
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* 1. Main Leaderboard Rankings */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 font-sans flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Community Honor Board
            </h3>
            <p className="text-xs text-slate-500 font-medium">Earn municipal XP by keeping local streets pristine</p>
          </div>
          
          {/* Tab Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("citizens")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "citizens"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Citizens
            </button>
            <button
              onClick={() => setActiveTab("wards")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "wards"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Wards Competition
            </button>
          </div>
        </div>

        {activeTab === "citizens" ? (
          /* Citizens list */
          <div className="divide-y divide-slate-100">
            {leaderboard.map((user, idx) => {
              const isCurrentUser = user.uuid === currentUser?.uuid;
              const tier = getCitizenTier(user.xp);
              const rank = idx + 1;

              return (
                <div
                  key={user.uuid}
                  className={`flex items-center justify-between py-3.5 px-3 rounded-xl transition-all ${
                    isCurrentUser ? "bg-[#f5f3ff]/40 border border-[#ede9fe]" : "hover:bg-slate-50/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 flex items-center justify-center font-mono font-bold text-xs text-slate-500">
                      {rank === 1 ? (
                        <span className="text-sm">🥇</span>
                      ) : rank === 2 ? (
                        <span className="text-sm">🥈</span>
                      ) : rank === 3 ? (
                        <span className="text-sm">🥉</span>
                      ) : (
                        `#${rank}`
                      )}
                    </div>

                    <div className={`w-8 h-8 rounded-full ${user.avatarColor || "bg-[#c7d2fe]"} flex items-center justify-center text-slate-800 text-xs font-bold font-mono shadow-sm`}>
                      {user.name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <p className={`text-xs font-bold flex items-center gap-1.5 ${isCurrentUser ? "text-[#6d28d9]" : "text-slate-800"}`}>
                        {user.name}
                        {isCurrentUser && (
                          <span className="bg-[#6d28d9] text-white text-[9px] font-sans font-bold px-1.5 py-0.2 rounded">YOU</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${tier.color}`}>
                          {tier.title}
                        </span>
                        {user.ward && (
                          <span className="text-[9px] text-slate-500 font-medium">
                            📍 {user.ward}
                          </span>
                        )}
                        {user.streak > 1 && (
                          <span className="flex items-center gap-0.5 text-[9px] font-mono text-[#e11d48] font-bold">
                            <Flame className="w-3 h-3 fill-[#ffe4e6] inline" /> {user.streak}d streak
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-slate-800 font-mono flex items-center gap-1 justify-end">
                      <Zap className="w-3.5 h-3.5 fill-amber-450 text-amber-500 animate-pulse" />
                      {user.xp} <span className="text-[10px] text-slate-400 font-semibold uppercase">XP</span>
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium font-sans">
                      {user.badges.length} badges unlocked
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Wards Competition List */
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl flex items-start gap-3">
              <Trophy className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-slate-800">Cleanest Neighborhood Challenge</h4>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Neighborhood districts, cities, and states compete weekly based on their **Cleanliness Score** (resolution percentage of issues) and combined citizen efforts. Check-in or resolve issues to lift your standings!
                </p>
              </div>
            </div>

            {/* Competition Level Selector */}
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setCompetitionLevel("ward")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  competitionLevel === "ward"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Ward vs Ward
              </button>
              <button
                type="button"
                onClick={() => setCompetitionLevel("city")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  competitionLevel === "city"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                City vs City
              </button>
              <button
                type="button"
                onClick={() => setCompetitionLevel("state")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  competitionLevel === "state"
                    ? "bg-white text-slate-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                State vs State
              </button>
            </div>

            {loadingWards ? (
              <div className="py-12 text-center text-slate-500 font-medium text-xs">
                Loading municipal scores...
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(() => {
                  // Helper to resolve city and state from ward name
                  const getGeoFromWard = (wardName: string) => {
                    const name = wardName.toLowerCase();
                    if (name.includes("eachanari") || name.includes("kurichi") || name.includes("malumichampatti") || name.includes("othakkalmandapam") || name.includes("sundarapuram") || name.includes("coimbatore")) {
                      return { city: "Coimbatore", state: "Tamil Nadu" };
                    }
                    if (name.includes("indiranagar") || name.includes("malleswaram") || name.includes("koramangala") || name.includes("hsr") || name.includes("whitefield") || name.includes("bengaluru") || name.includes("jayanagar")) {
                      return { city: "Bengaluru", state: "Karnataka" };
                    }
                    if (name.includes("connaught") || name.includes("rohini") || name.includes("saket") || name.includes("dwarka") || name.includes("karol") || name.includes("delhi")) {
                      return { city: "Delhi", state: "Delhi NCR" };
                    }
                    if (name.includes("andheri") || name.includes("bandra") || name.includes("chembur") || name.includes("colaba") || name.includes("juhu") || name.includes("mumbai")) {
                      return { city: "Mumbai", state: "Maharashtra" };
                    }
                    if (name.includes("adyar") || name.includes("velachery") || name.includes("mylapore") || name.includes("nungambakkam") || name.includes("nagar") || name.includes("chennai")) {
                      return { city: "Chennai", state: "Tamil Nadu" };
                    }
                    if (name.includes("salt") || name.includes("park") || name.includes("ballygunge") || name.includes("howrah") || name.includes("alipore") || name.includes("kolkata")) {
                      return { city: "Kolkata", state: "West Bengal" };
                    }
                    if (name.includes("satellite") || name.includes("navrangpura") || name.includes("vastrapur") || name.includes("paldi") || name.includes("sabarmati") || name.includes("ahmedabad")) {
                      return { city: "Ahmedabad", state: "Gujarat" };
                    }
                    return { city: "National District", state: "Federal Territory" };
                  };

                  // Compute City vs City leaderboard
                  const cityMap: Record<string, { cityName: string; stateName: string; totalXP: number; citizenCount: number; checkInCount: number; scores: number[] }> = {};
                  wardLeaderboard.forEach((ward) => {
                    const { city, state } = getGeoFromWard(ward.wardName);
                    if (!cityMap[city]) {
                      cityMap[city] = {
                        cityName: city,
                        stateName: state,
                        totalXP: 0,
                        citizenCount: 0,
                        checkInCount: 0,
                        scores: []
                      };
                    }
                    cityMap[city].totalXP += ward.totalXP || 0;
                    cityMap[city].citizenCount += ward.citizenCount || 0;
                    cityMap[city].checkInCount += ward.checkInCount || 0;
                    cityMap[city].scores.push(ward.cleanlinessScore);
                  });

                  const cityLeaderboard = Object.values(cityMap)
                    .map((city) => {
                      const avgScore = city.scores.length > 0 
                        ? Math.round(city.scores.reduce((sum, s) => sum + s, 0) / city.scores.length)
                        : 80;
                      return {
                        name: city.cityName,
                        subtitle: city.stateName,
                        totalXP: city.totalXP,
                        citizenCount: city.citizenCount,
                        checkInCount: city.checkInCount,
                        cleanlinessScore: avgScore
                      };
                    })
                    .sort((a, b) => b.cleanlinessScore - a.cleanlinessScore || b.totalXP - a.totalXP)
                    .map((item, idx) => ({ ...item, rank: idx + 1 }));

                  // Compute State vs State leaderboard
                  const stateMap: Record<string, { stateName: string; totalXP: number; citizenCount: number; checkInCount: number; scores: number[] }> = {};
                  wardLeaderboard.forEach((ward) => {
                    const { state } = getGeoFromWard(ward.wardName);
                    if (!stateMap[state]) {
                      stateMap[state] = {
                        stateName: state,
                        totalXP: 0,
                        citizenCount: 0,
                        checkInCount: 0,
                        scores: []
                      };
                    }
                    stateMap[state].totalXP += ward.totalXP || 0;
                    stateMap[state].citizenCount += ward.citizenCount || 0;
                    stateMap[state].checkInCount += ward.checkInCount || 0;
                    stateMap[state].scores.push(ward.cleanlinessScore);
                  });

                  const stateLeaderboard = Object.values(stateMap)
                    .map((st) => {
                      const avgScore = st.scores.length > 0 
                        ? Math.round(st.scores.reduce((sum, s) => sum + s, 0) / st.scores.length)
                        : 80;
                      return {
                        name: st.stateName,
                        subtitle: "Federal Region",
                        totalXP: st.totalXP,
                        citizenCount: st.citizenCount,
                        checkInCount: st.checkInCount,
                        cleanlinessScore: avgScore
                      };
                    })
                    .sort((a, b) => b.cleanlinessScore - a.cleanlinessScore || b.totalXP - a.totalXP)
                    .map((item, idx) => ({ ...item, rank: idx + 1 }));

                  const list = competitionLevel === "ward" 
                    ? wardLeaderboard.map(w => ({
                        name: w.wardName,
                        subtitle: getGeoFromWard(w.wardName).city,
                        totalXP: w.totalXP,
                        citizenCount: w.citizenCount,
                        checkInCount: w.checkInCount,
                        cleanlinessScore: w.cleanlinessScore,
                        rank: w.rank,
                        isMy: currentUser?.ward === w.wardName
                      }))
                    : competitionLevel === "city"
                    ? cityLeaderboard.map(c => ({
                        name: c.name,
                        subtitle: c.subtitle,
                        totalXP: c.totalXP,
                        citizenCount: c.citizenCount,
                        checkInCount: c.checkInCount,
                        cleanlinessScore: c.cleanlinessScore,
                        rank: c.rank,
                        isMy: currentUser?.ward ? getGeoFromWard(currentUser.ward).city === c.name : false
                      }))
                    : stateLeaderboard.map(s => ({
                        name: s.name,
                        subtitle: s.subtitle,
                        totalXP: s.totalXP,
                        citizenCount: s.citizenCount,
                        checkInCount: s.checkInCount,
                        cleanlinessScore: s.cleanlinessScore,
                        rank: s.rank,
                        isMy: currentUser?.ward ? getGeoFromWard(currentUser.ward).state === s.name : false
                      }));

                  return list.map((item) => (
                    <div
                      key={item.name}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between py-4 px-3 rounded-xl gap-3 transition-all ${
                        item.isMy ? "bg-indigo-50/40 border border-indigo-100/50" : "hover:bg-slate-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 flex items-center justify-center font-mono font-bold text-xs text-slate-500">
                          {item.rank === 1 ? (
                            <span className="text-sm">🏆</span>
                          ) : item.rank === 2 ? (
                            <span className="text-sm">🥈</span>
                          ) : item.rank === 3 ? (
                            <span className="text-sm">🥉</span>
                          ) : (
                            `#${item.rank}`
                          )}
                        </div>

                        <div>
                          <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                            {item.name}
                            {item.isMy && (
                              <span className="bg-indigo-600 text-white text-[8px] font-sans font-bold px-1.5 py-0.2 rounded uppercase">
                                My {competitionLevel === "ward" ? "Ward" : competitionLevel === "city" ? "City" : "State"}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-medium font-sans">
                            <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">{item.subtitle}</span>
                            <span>👥 {item.citizenCount} contributors</span>
                            <span>📍 {item.checkInCount} check-ins</span>
                            <span>⚡ {item.totalXP} XP</span>
                          </div>
                        </div>
                      </div>

                      {/* Cleanliness Score */}
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-medium block">Cleanliness Score</span>
                          <span className="text-sm font-black text-emerald-600 font-mono">
                            {item.cleanlinessScore}%
                          </span>
                        </div>
                        <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${item.cleanlinessScore}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Controls & Milestones Side Panel */}
      <div className="space-y-6">
        
        {/* Ward Assignment & Check-in Control */}
        {currentUser && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">
                My Sector/Ward Status
              </h3>
              <p className="text-sm font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-indigo-500" />
                {currentUser.ward || "Not assigned"}
              </p>
              <p className="text-[10px] text-slate-500 font-medium mt-1">
                {currentUser.ward_auto_assign !== false 
                  ? "✓ Auto-Assign enabled (based on frequent check-ins)" 
                  : "✓ Manually locked ward designation"}
              </p>
            </div>

            <div className="border-t border-slate-100 pt-3.5 space-y-3">
              {/* Check-In Button */}
              <button
                onClick={handleCheckIn}
                disabled={checkingIn}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <CheckSquare className="w-4 h-4" />
                {checkingIn ? "Verifying..." : "Verify Cleanliness Check-In (+10 XP)"}
              </button>
              
              {checkInStatus && (
                <p className="text-[10px] font-medium font-sans text-center text-slate-600 animate-pulse bg-slate-50 border border-slate-100 rounded-lg p-2">
                  {checkInStatus}
                </p>
              )}

              {/* Manual Join option with search bar and suggestions */}
              <div className="pt-2 border-t border-slate-50 space-y-2 relative">
                <label className="text-[10px] font-bold text-slate-400 block uppercase">
                  Search &amp; Switch Ward manually:
                </label>
                <div className="flex gap-2 relative">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Type neighborhood or ward..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSelectedWardToJoin(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      className="w-full bg-slate-50 text-slate-800 text-xs font-semibold border border-slate-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    {showSuggestions && (
                      <div className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100">
                        {(() => {
                          const filtered = availableWards.filter((w) =>
                            w.toLowerCase().includes(searchQuery.toLowerCase())
                          );
                          if (filtered.length === 0) {
                            return (
                              <div className="p-2 text-[10px] text-slate-400 font-medium">
                                No matching wards. Type to add custom ward!
                              </div>
                            );
                          }
                          return filtered.map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => {
                                setSearchQuery(w);
                                setSelectedWardToJoin(w);
                                setShowSuggestions(false);
                              }}
                              className="w-full text-left p-2 text-xs text-slate-700 hover:bg-slate-50 font-medium transition-all"
                            >
                              {w}
                            </button>
                          ));
                        })()}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleJoinWard(selectedWardToJoin)}
                    disabled={joining || !selectedWardToJoin.trim()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-2 rounded-lg text-xs flex items-center justify-center border border-indigo-600 shadow-sm transition-all cursor-pointer disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200"
                    title="Switch Neighborhood"
                  >
                    <UserPlus className="w-4 h-4" />
                  </button>
                </div>
                {/* Click outside to close suggestions */}
                {showSuggestions && (
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setShowSuggestions(false)}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Milestones / Badges Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-800 font-sans flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#6d28d9]" />
              Milestone Badges
            </h3>
            <p className="text-xs text-slate-500 font-medium">Accumulate action XP to claim dynamic civic badges</p>
          </div>

          {/* Badge List Cards */}
          <div className="space-y-3.5">
            {ALL_BADGES.map((badge) => {
              const IconComponent = badge.icon;
              const hasUnlocked = currentUser?.badges.some((ub) => ub.id === badge.id) || 
                (badge.id === "first_report" && (currentUser?.xp || 0) >= 50);

              return (
                <div
                  key={badge.id}
                  className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                    hasUnlocked
                      ? "bg-slate-50 border-slate-200/80 shadow-sm"
                      : "bg-slate-50/20 border-slate-100 opacity-60 filter grayscale"
                  }`}
                >
                  <div className={`p-2 rounded-lg border ${hasUnlocked ? badge.color : "bg-slate-100 border-slate-200 text-slate-400"}`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-800">{badge.name}</h4>
                      {hasUnlocked ? (
                        <span className="text-[8px] font-sans font-bold bg-[#f5f3ff] border border-[#ede9fe] text-[#6d28d9] px-1.5 py-0.2 rounded uppercase">
                          Active
                        </span>
                      ) : (
                        <span className="text-[8px] font-sans font-semibold bg-slate-100 text-slate-400 px-1.5 py-0.2 rounded uppercase">
                          Locked
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                      {badge.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
