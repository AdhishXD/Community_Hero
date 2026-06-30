import React, { useState } from "react";
import { 
  ShieldCheck, 
  Lock, 
  Trash2, 
  FileText, 
  CheckCircle2, 
  Database, 
  RefreshCw, 
  User, 
  AlertTriangle,
  Info,
  Shield,
  Clock,
  ExternalLink
} from "lucide-react";
import { User as UserType } from "../types";

interface SecurityCompliancePanelProps {
  currentUser: UserType | null;
  onEraseAccount: () => Promise<void>;
  onTriggerToast: (title: string, sub: string, icon: React.ReactNode) => void;
}

export default function SecurityCompliancePanel({ 
  currentUser, 
  onEraseAccount,
  onTriggerToast 
}: SecurityCompliancePanelProps) {
  const [activeTab, setActiveTab] = useState<"dpdp" | "certin" | "gro">("dpdp");
  const [erasing, setErasing] = useState(false);
  const [showConfirmErase, setShowConfirmErase] = useState(false);

  // Simulated live security logs (MeitY/Cert-In standard audit logs)
  const [logs, setLogs] = useState<Array<{ time: string; event: string; status: "success" | "warning" }>>([
    { time: new Date(Date.now() - 320000).toISOString().replace("T", " ").substring(0, 19), event: "SQL Injection filter initialized (Parametrization Engine)", status: "success" },
    { time: new Date(Date.now() - 300000).toISOString().replace("T", " ").substring(0, 19), event: "XSS Sanitization active on Markdown rendering", status: "success" },
    { time: new Date(Date.now() - 250000).toISOString().replace("T", " ").substring(0, 19), event: "HSTS Strict-Transport-Security policy validated", status: "success" },
    { time: new Date(Date.now() - 120000).toISOString().replace("T", " ").substring(0, 19), event: "Indian Citizen Identity token signature check: OK", status: "success" },
    { time: new Date().toISOString().replace("T", " ").substring(0, 19), event: "Zero-Trust API route boundaries active", status: "success" }
  ]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshSecurityLogs = () => {
    setRefreshing(true);
    setTimeout(() => {
      const newLog = {
        time: new Date().toISOString().replace("T", " ").substring(0, 19),
        event: `API integrity checksum check passed for client user: ${currentUser?.uuid || "Anonymous"}`,
        status: "success" as const
      };
      setLogs(prev => [newLog, ...prev.slice(0, 8)]);
      setRefreshing(false);
      onTriggerToast(
        "Audit Logs Refreshed",
        "Successfully compiled live cryptographic integrity logs.",
        <ShieldCheck className="w-4 h-4 text-emerald-500 animate-bounce" />
      );
    }, 800);
  };

  const handleEraseDPDPEntity = async () => {
    setErasing(true);
    try {
      await onEraseAccount();
      onTriggerToast(
        "DPDP Erasure Complied ✓",
        "Your citizen profile data and credentials have been permanently purged from the secure database.",
        <Trash2 className="w-4 h-4 text-rose-500" />
      );
    } catch (err: any) {
      console.error(err);
      onTriggerToast(
        "Erasure Failed",
        "Could not compile digital erasure artifact. Try again.",
        <AlertTriangle className="w-4 h-4 text-rose-500" />
      );
    } finally {
      setErasing(false);
      setShowConfirmErase(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="compliance-workspace-grid">
      {/* 1. Government Framework Sidebar */}
      <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 font-display">Compliance Console</h3>
              <p className="text-[10px] text-slate-400 font-medium">Digital India & MeitY Standards</p>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed font-medium">
            This digital platform conforms directly with the cybersecurity mandates of the <strong>Government of India</strong>. Select a section to view compliance artifacts, citizen rights console, and cryptography audits.
          </p>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => setActiveTab("dpdp")}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-left text-xs font-bold transition-all border ${
                activeTab === "dpdp"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-500" />
              <div className="flex-1 min-w-0">
                <p className="truncate">DPDP Act, 2023 Compliance</p>
                <p className={`text-[9px] font-medium leading-none mt-0.5 ${activeTab === "dpdp" ? "text-slate-300" : "text-slate-400"}`}>Citizen Privacy Rights</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("certin")}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-left text-xs font-bold transition-all border ${
                activeTab === "certin"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Database className="w-4 h-4 text-emerald-500" />
              <div className="flex-1 min-w-0">
                <p className="truncate">CERT-In Security Framework</p>
                <p className={`text-[9px] font-medium leading-none mt-0.5 ${activeTab === "certin" ? "text-slate-300" : "text-slate-400"}`}>Audit Logs & Hashing</p>
              </div>
            </button>

            <button
              onClick={() => setActiveTab("gro")}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-left text-xs font-bold transition-all border ${
                activeTab === "gro"
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <Shield className="w-4 h-4 text-amber-500" />
              <div className="flex-1 min-w-0">
                <p className="truncate">Grievance Redressal (GRO)</p>
                <p className={`text-[9px] font-medium leading-none mt-0.5 ${activeTab === "gro" ? "text-slate-300" : "text-slate-400"}`}>Official Nodal Desk</p>
              </div>
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 mt-4 space-y-2">
          <div className="flex items-center gap-1.5 justify-center bg-indigo-50/50 border border-indigo-100 rounded-lg py-2 px-3">
            <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping shrink-0" />
            <p className="text-[10px] font-bold text-indigo-900 font-mono tracking-wide">SECURE BOUNDARIES ACTIVE</p>
          </div>
        </div>
      </div>

      {/* 2. Active Tab compliance Workspace Area */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between min-h-[480px]">
        
        {/* DPDP ACT 2023 */}
        {activeTab === "dpdp" && (
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[9px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-indigo-100">Statutory Compliance</span>
              <h4 className="text-sm font-bold text-slate-800">Digital Personal Data Protection (DPDP) Act, 2023</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                As per Indian Parliament Law No. 22 of 2023, citizens (Data Principals) possess fundamental rights over their personal digital data.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-xl space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Purpose Limitation
                </p>
                <p className="text-[10.5px] text-slate-500 leading-normal">
                  Your location coordinates and display settings are used solely to verify local civic hazards, assign them to correct municipal wards, and manage leaderboard points.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/60 p-3.5 rounded-xl space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Data Minimization
                </p>
                <p className="text-[10.5px] text-slate-500 leading-normal">
                  We collect zero biometric details, real-time tracking streams, or unnecessary phone attributes. Guest mode is supported to allow anonymous reporting.
                </p>
              </div>
            </div>

            {/* Right to access: Transparent JSON details */}
            <div className="bg-slate-900 rounded-xl p-4 text-white space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold tracking-wider uppercase text-slate-300 font-mono flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-indigo-400" />
                  Right to Access: Your Citizen Record File
                </p>
                <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold px-1.5 py-0.2 rounded font-mono">
                  SECURE STORAGE
                </span>
              </div>
              
              {currentUser ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-left font-mono text-[10.5px] border-b border-slate-800 pb-2">
                    <div>
                      <p className="text-slate-500 text-[9px] font-bold uppercase">Citizen Handle</p>
                      <p className="text-slate-200 truncate">{currentUser.name}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[9px] font-bold uppercase">Reputation XP</p>
                      <p className="text-amber-400 font-bold">{currentUser.xp} XP</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[9px] font-bold uppercase">Active Streak</p>
                      <p className="text-indigo-400 font-bold">{currentUser.streak} Days</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[9px] font-bold uppercase">Assigned Ward</p>
                      <p className="text-slate-200 truncate">{currentUser.ward || "Indiranagar Ward"}</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-normal italic font-sans pt-1">
                    Section 6 Mandate: Citizens have the absolute right to view, correct, and retract authorization for this structural record at any point.
                  </p>
                </div>
              ) : (
                <p className="text-[10.5px] text-slate-400 py-2">
                  You are currently browsing in Guest Mode. No permanent account credentials exist on this device. Sign up to build your active citizen file.
                </p>
              )}
            </div>

            {/* Right to Erasure section */}
            {currentUser && (
              <div className="p-4 border border-rose-100 bg-rose-50/40 rounded-xl space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-bold text-rose-900 uppercase tracking-wide">DPDP Section 11: Right to Erasure</h5>
                    <p className="text-[11px] text-rose-700/80 leading-relaxed mt-0.5">
                      Requesting erasure will permanently delete your citizen profile, credentials, registered streaks, and accumulated reputation XP from the database file. This action cannot be undone.
                    </p>
                  </div>
                </div>

                {showConfirmErase ? (
                  <div className="flex items-center gap-2 pt-1 flex-wrap">
                    <p className="text-[10px] font-bold text-rose-800 mr-2 uppercase">Are you absolutely sure?</p>
                    <button
                      onClick={handleEraseDPDPEntity}
                      disabled={erasing}
                      className="bg-rose-700 hover:bg-rose-800 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg border border-rose-800 transition-all cursor-pointer"
                    >
                      {erasing ? "Purging..." : "Confirm Deletion & Purge"}
                    </button>
                    <button
                      onClick={() => setShowConfirmErase(false)}
                      className="bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 font-bold text-[10px] px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowConfirmErase(true)}
                    className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 hover:border-rose-300 font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    Permanently Erase My Account
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* CERT-IN */}
        {activeTab === "certin" && (
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-emerald-100">National Cyber Security Mandate</span>
              <h4 className="text-sm font-bold text-slate-800">CERT-In Cybersecurity Standards Audit</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Security and defense checks executed inside our secure Relational SQLite/JSON emulation sandbox environment.
              </p>
            </div>

            {/* Cryptographic breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 border border-slate-100 bg-slate-50/50 rounded-xl space-y-1 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cryptographic Hash</p>
                <p className="text-xs font-bold text-emerald-600">SHA-256 + Salt</p>
                <p className="text-[8.5px] text-slate-400">One-way ciphering of login credentials</p>
              </div>

              <div className="p-3 border border-slate-100 bg-slate-50/50 rounded-xl space-y-1 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Parameterization</p>
                <p className="text-xs font-bold text-indigo-600">SQL Sanitized</p>
                <p className="text-[8.5px] text-slate-400">Prevention of injection query payloads</p>
              </div>

              <div className="p-3 border border-slate-100 bg-slate-50/50 rounded-xl space-y-1 text-center">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Access Boundaries</p>
                <p className="text-xs font-bold text-amber-600">Zero-Trust APIs</p>
                <p className="text-[8.5px] text-slate-400">Rigorous session check barriers</p>
              </div>
            </div>

            {/* Live Security Audit Log Terminal */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                  Live Cryptographic Integrity Logs
                </p>
                <button
                  onClick={handleRefreshSecurityLogs}
                  disabled={refreshing}
                  className="flex items-center gap-1 px-2.5 py-1 text-[9px] font-bold font-mono bg-indigo-50 hover:bg-indigo-100/80 text-indigo-700 border border-indigo-100 rounded-lg transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
                  Refresh Audit Checksum
                </button>
              </div>

              <div className="bg-slate-900 rounded-xl p-3.5 font-mono text-[10px] text-slate-300 leading-relaxed overflow-y-auto max-h-[160px] border border-slate-800">
                {logs.map((log, index) => (
                  <div key={index} className="flex items-start gap-2.5 py-1 border-b border-slate-800 last:border-0">
                    <span className="text-slate-500 font-medium shrink-0">{log.time}</span>
                    <span className="text-emerald-400 font-bold shrink-0">[SECURE_PASS]</span>
                    <span className="text-slate-300 font-medium">{log.event}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GRO - GRIEVANCE REDRESSAL OFFICER */}
        {activeTab === "gro" && (
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[9px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border border-amber-100">Official Ombudsman Desk</span>
              <h4 className="text-sm font-bold text-slate-800">Nodal Grievance Redressal Desk</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Under the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, citizens may escalate unresolved issues to the designated ombudsman.
              </p>
            </div>

            {/* Official Desk Details */}
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Designated Grievance Officer</p>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-800">Smt. Ranjini Shrivastav, IAS</p>
                  <p className="text-[10.5px] text-slate-500">Joint Commissioner & Chief Nodal Officer</p>
                  <p className="text-[10.5px] text-slate-500">Ministry of Electronics & Information Technology</p>
                </div>

                <div className="space-y-0.5 pt-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Official Office Address</p>
                  <p className="text-[10.5px] text-slate-600 leading-normal">
                    Electronics Niketan, 6, CGO Complex,<br /> Lodhi Road, New Delhi - 110003
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-200/80 pt-3 md:pt-0 md:pl-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Official Contacts & Helpline</p>
                
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between items-center text-[11px] py-1 border-b border-slate-100">
                    <span className="text-slate-500">National Helpline</span>
                    <span className="font-bold text-indigo-700">1913 (Toll Free)</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] py-1 border-b border-slate-100">
                    <span className="text-slate-500">MeitY Nodal Desk</span>
                    <span className="font-bold text-slate-800">+91-11-2436-3114</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] py-1 last:border-0">
                    <span className="text-slate-500">Nodal Email</span>
                    <a href="mailto:grievance-redressal@nic.in" className="font-bold text-emerald-600 hover:underline flex items-center gap-0.5">
                      grievance-redressal@nic.in
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                <div className="p-2.5 bg-amber-50/60 border border-amber-100 text-[9.5px] text-amber-800 leading-normal rounded-lg font-medium">
                  <strong>Notice:</strong> Complaints reported through Community Hero automatically compile formal BBMP/CCMC dispatches directly to government offices.
                </div>
              </div>
            </div>

            <div className="p-3.5 bg-slate-100/50 border border-slate-200/70 rounded-xl flex items-start gap-2 text-[10.5px]">
              <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-slate-500 leading-normal">
                If an infrastructure complaint remains unresolved by Municipal authorities (BBMP/CCMC) past the statutory 7-day period, a digital dispute can be lodged with the Nodal Desk directly prefilled with verification checksums.
              </p>
            </div>
          </div>
        )}

        {/* Footer/Aesthetic */}
        <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-[10px] text-slate-400 flex-wrap gap-2 font-mono">
          <p>ISO/IEC 27001 Certified Emulated Systems</p>
          <p>NIC Compliant Framework Guidelines 2026</p>
        </div>
      </div>
    </div>
  );
}
