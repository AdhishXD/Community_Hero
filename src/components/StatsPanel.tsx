import { useState, useEffect } from "react";
import { DashboardStats, AISummary } from "../types";
import { fetchStats, fetchAISummary } from "../lib/api";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import {
  Activity,
  Award,
  BarChart3,
  CheckCircle,
  Clock,
  HelpCircle,
  Sparkles,
  Zap,
  RotateCw
} from "lucide-react";

interface StatsPanelProps {
  initialStats: DashboardStats | null;
  resolvedThisWeek: number;
}

export default function StatsPanel({ initialStats, resolvedThisWeek }: StatsPanelProps) {
  const [stats, setStats] = useState<DashboardStats | null>(initialStats);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  // Load stats and summary
  const loadStatsData = async () => {
    try {
      setLoadingStats(true);
      const res = await fetchStats();
      setStats(res.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  const loadSummaryData = async (forceRegen = false) => {
    try {
      setLoadingSummary(true);
      const res = await fetchAISummary();
      setSummary(res.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (!initialStats) {
      loadStatsData();
    }
    loadSummaryData();
  }, []);

  // Format resolution time: seconds -> hours/days
  const formatResolutionTime = (seconds: number) => {
    if (seconds === 0) return "Not available";
    const hours = Math.round(seconds / 3600);
    if (hours < 24) return `${hours} hrs`;
    const days = Math.round(hours / 24);
    return `${days} days`;
  };

  // 1. Format Pie Chart Category Data
  const getCategoryChartData = () => {
    if (!stats || !stats.categoryWeights) return [];
    return Object.entries(stats.categoryWeights).map(([key, val]) => ({
      name: key,
      value: val
    }));
  };

  // Category Colors
  const CATEGORY_COLORS: { [key: string]: string } = {
    "Pothole": "#c7d2fe", // Pastel Periwinkle/Indigo
    "Water Leak": "#bae6fd", // Pastel Sky Blue
    "Broken Streetlight": "#fef08a", // Pastel Amber/Yellow
    "Waste Accumulation": "#fed7aa", // Pastel Orange
    "Damaged Property": "#a7f3d0", // Pastel Mint Green
    "Other": "#e2e8f0" // Pastel Slate
  };

  // 2. Format Severity Bar Chart Data
  const getSeverityChartData = () => {
    if (!stats || !stats.severityDist) return [];
    return Object.entries(stats.severityDist).map(([key, val]) => ({
      name: `Level ${key}`,
      "Active Reports": val,
      severityNum: Number(key)
    }));
  };

  const getSeverityColor = (sev: number) => {
    switch (sev) {
      case 1:
        return "#d1fae5"; // Pastel Mint Green
      case 2:
        return "#a7f3d0"; // Pastel Green
      case 3:
        return "#fef3c7"; // Pastel Yellow
      case 4:
        return "#ffe4e6"; // Pastel Light Rose
      case 5:
      default:
        return "#fecdd3"; // Pastel Dark Rose
    }
  };

  const categoryData = getCategoryChartData();
  const severityData = getSeverityChartData();

  return (
    <div className="space-y-6">
      
      {/* 1. Quick Stats Indicator Board */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2.5 bg-[#f5f3ff] border border-[#ede9fe] rounded-xl text-[#6d28d9]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Total Complaints</p>
            <p className="text-xl font-extrabold text-slate-800 font-mono mt-0.5">{stats?.totalReported || 0}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2.5 bg-[#ecfdf5] border border-[#d1fae5] rounded-xl text-[#047857]">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Resolved This Week</p>
            <p className="text-xl font-extrabold text-slate-800 font-mono mt-0.5">{resolvedThisWeek}</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2.5 bg-[#fff7ed] border border-[#ffedd5] rounded-xl text-[#c2410c]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Avg Resolution Speed</p>
            <p className="text-xl font-extrabold text-slate-800 font-mono mt-0.5">
              {stats ? formatResolutionTime(stats.averageResolutionTimeSeconds) : "72 hrs"}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-3">
          <div className="p-2.5 bg-[#fff1f2] border border-[#ffe4e6] rounded-xl text-[#e11d48] animate-pulse">
            <Zap className="w-5 h-5 fill-[#fecdd3]" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Live Priority Index</p>
            <p className="text-xl font-extrabold text-rose-800 font-mono mt-0.5">HIGH</p>
          </div>
        </div>

      </div>

      {/* 2. Dynamic Gemini weekly AI Synthesis Summary Panel */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#f5f3ff] to-[#ecfdf5] text-slate-800 rounded-2xl p-5 border border-[#ede9fe]/80 shadow-sm">
        {/* Glowing background highlights simulating AI */}
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-[#ede9fe]/40 rounded-full filter blur-2xl"></div>
        <div className="absolute -bottom-12 right-12 w-36 h-36 bg-[#d1fae5]/35 rounded-full filter blur-2xl animate-pulse"></div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex items-center gap-1.5">
              <span className="p-1.5 bg-white/80 border border-slate-100 rounded-lg text-[#6d28d9] shadow-sm">
                <Sparkles className="w-4 h-4 animate-spin text-[#8b5cf6]" style={{ animationDuration: '6s' }} />
              </span>
              <h3 className="text-xs font-bold font-sans uppercase tracking-widest text-[#6d28d9]">
                Weekly Administrative AI Synthesis Summary
              </h3>
            </div>
            {loadingSummary ? (
              <div className="py-2.5 flex items-center gap-2 text-[#6d28d9]/70 text-sm">
                <LoaderSkeleton />
              </div>
            ) : (
              <p className="text-xs sm:text-xs text-slate-700 font-medium leading-relaxed font-sans mt-1">
                "{summary?.text || "Analysing reported databases to compile custom municipal directives..."}"
              </p>
            )}
            <p className="text-[10px] text-slate-400 font-mono">
              Generated {summary?.generatedAt ? new Date(summary.generatedAt).toLocaleString() : "Just now"} • Powered by Gemini 3.5 Flash
            </p>
          </div>

          <button
            onClick={() => loadSummaryData(true)}
            disabled={loadingSummary}
            id="regen-summary-btn"
            className="self-start md:self-center flex items-center gap-1.5 bg-white/90 hover:bg-white text-[#6d28d9] rounded-xl px-3 py-2 text-[10px] font-bold font-sans tracking-wider border border-[#ede9fe] shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loadingSummary ? 'animate-spin' : ''}`} />
            Regen Directives
          </button>
        </div>
      </div>

      {/* 3. Charts Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Pie Chart: Issue Breakdown */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-sans">Categorical Breakdown</h4>
            <BarChart3 className="w-4 h-4 text-slate-400" />
          </div>
          
          <div className="h-[200px] flex items-center justify-center">
            {categoryData.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium font-mono">No incident data recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[entry.name] || CATEGORY_COLORS["Other"]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: '11px', fontFamily: 'sans-serif', borderRadius: '8px' }}
                  />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '10px', fontFamily: 'sans-serif' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bar Chart: Severity Distribution */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-sans">Severity Distribution</h4>
            <Zap className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-[200px]">
            {severityData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
                No severity logs found.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={severityData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                  <Bar dataKey="Active Reports" radius={[4, 4, 0, 0]}>
                    {severityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getSeverityColor(entry.severityNum)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* 4. Municipal Queue Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-sans">Department Queue Capacity</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">Tracks pending active claims inside designated response agencies</p>
        </div>

        <div className="space-y-3.5">
          {stats && Object.keys(stats.departmentPending).length > 0 ? (
            Object.entries(stats.departmentPending).map(([dept, count]) => {
              const countVal = count as number;
              // Calculate percent simple representation
              const values = Object.values(stats.departmentPending) as number[];
              const maxCount = Math.max(...values);
              const percent = maxCount > 0 ? (countVal / maxCount) * 100 : 0;
              
              return (
                <div key={dept} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{dept}</span>
                    <span className="font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {countVal} active
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#c7d2fe] h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-xs font-semibold text-slate-500 font-mono text-center py-4">
              All municipal backlogs are perfectly clean! Green state achieved.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}

function LoaderSkeleton() {
  return (
    <div className="flex flex-col gap-2 w-full animate-pulse">
      <div className="h-3.5 bg-white/10 rounded w-11/12"></div>
      <div className="h-3.5 bg-white/10 rounded w-10/12"></div>
      <div className="h-3.5 bg-white/10 rounded w-9/12"></div>
    </div>
  );
}
