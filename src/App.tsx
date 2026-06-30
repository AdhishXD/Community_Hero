import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  AlertCircle,
  MapPin,
  Trophy,
  Flame,
  Plus,
  Sparkles,
  Info,
  ChevronRight,
  ArrowRight,
  CheckCircle,
  Clock,
  User2,
  AlertTriangle,
  Activity,
  ThumbsUp,
  FolderOpen,
  Calendar,
  Lock,
  Globe,
  Compass,
  Zap,
  Menu,
  HeartHandshake,
  Bell,
  Mail,
  X,
  Upload,
  Loader2,
  ShieldCheck
} from "lucide-react";

import { Issue, User } from "./types";
import {
  initializeUser,
  fetchIssues,
  fetchLeaderboard,
  upvoteIssue,
  updateIssueStatus,
  signUpUser,
  logInUser,
  eraseUserAccount
} from "./lib/api";

import ManualLocationModal from "./components/ManualLocationModal";

import MainMap from "./components/MainMap";
import ReportIssueModal from "./components/ReportIssueModal";
import LeaderboardPanel from "./components/LeaderboardPanel";
import StatsPanel from "./components/StatsPanel";
import ProfileModal from "./components/ProfileModal";
import SecurityCompliancePanel from "./components/SecurityCompliancePanel";

// Haversine formula helper for distance checking at module level
export const calculateDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Jurisdiction routing helper
export const getJurisdiction = (lat: number, lng: number) => {
  // Simple bounding box heuristics for Coimbatore / Eachanari first
  if (lat >= 10.7 && lat <= 11.3 && lng >= 76.7 && lng <= 77.3) {
    return {
      city: "Coimbatore",
      state: "Tamil Nadu",
      authority: "Coimbatore Municipal Corporation (CCMC)",
      emailSuffix: "coimbatorecorporation.gov.in"
    };
  }
  // Simple bounding box heuristics for major Indian hubs or fallback
  if (lat >= 12.8 && lat <= 13.1 && lng >= 77.4 && lng <= 77.8) {
    return {
      city: "Bengaluru",
      state: "Karnataka",
      authority: "Bruhat Bengaluru Mahanagara Palike (BBMP)",
      emailSuffix: "bbmp.gov.in"
    };
  }
  if (lat >= 28.4 && lat <= 28.8 && lng >= 76.8 && lng <= 77.4) {
    return {
      city: "Delhi",
      state: "Delhi NCR",
      authority: "Municipal Corporation of Delhi (MCD)",
      emailSuffix: "mcd.nic.in"
    };
  }
  if (lat >= 18.8 && lat <= 19.3 && lng >= 72.7 && lng <= 73.0) {
    return {
      city: "Mumbai",
      state: "Maharashtra",
      authority: "Brihanmumbai Municipal Corporation (BMC)",
      emailSuffix: "mcgm.gov.in"
    };
  }
  if (lat >= 12.9 && lat <= 13.2 && lng >= 80.1 && lng <= 80.3) {
    return {
      city: "Chennai",
      state: "Tamil Nadu",
      authority: "Greater Chennai Corporation (GCC)",
      emailSuffix: "chennaicorporation.gov.in"
    };
  }
  
  if (lat > 20) {
    if (lng > 80) {
      return {
        city: "Kolkata",
        state: "West Bengal",
        authority: "Kolkata Municipal Corporation (KMC)",
        emailSuffix: "kmcgov.in"
      };
    } else {
      return {
        city: "Ahmedabad",
        state: "Gujarat",
        authority: "Ahmedabad Municipal Corporation (AMC)",
        emailSuffix: "ahmedabadcity.gov.in"
      };
    }
  }

  return {
    city: "National District",
    state: "Federal Territory",
    authority: "National Municipal Safety Council (NMSC)",
    emailSuffix: "nmsc.gov.in"
  };
};

export default function App() {
  // Navigation: "map" | "impact" | "leaderboard" | "security"
  const [activeTab, setActiveTab] = useState<"map" | "impact" | "leaderboard" | "security">("map");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [leaderboard, setLeaderboard] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Modals & States
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showManualLocationModal, setShowManualLocationModal] = useState(false);
  const [welcomeName, setWelcomeName] = useState("");
  const [welcomeColor, setWelcomeColor] = useState("bg-emerald-500");
  const [authMode, setAuthMode] = useState<"login" | "signup">("signup");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [signUpAsAdmin, setSignUpAsAdmin] = useState(false);

  // Issue Resolution States
  const [resolvingPhotoBase64, setResolvingPhotoBase64] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  // Admin Simulator state
  const [isAdminMode, setIsAdminMode] = useState(false);
  useEffect(() => {
    setIsAdminMode(currentUser?.isAdmin || false);
  }, [currentUser]);
  const [mapViewMode, setMapViewMode] = useState<"pins" | "heatmap">("pins");

  const [resolvedWard, setResolvedWard] = useState<string>("Local District");

  // Geolocation and Proximity States
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!userLocation) return;
    if (!fetchingLocation) {
      setFetchingLocation(userLocation);
      return;
    }
    const dist = calculateDistanceInKm(userLocation.lat, userLocation.lng, fetchingLocation.lat, fetchingLocation.lng);
    if (dist > 0.2) { // 200 meters step threshold to protect API rate limits
      setFetchingLocation(userLocation);
    }
  }, [userLocation, fetchingLocation]);

  useEffect(() => {
    if (!fetchingLocation) return;
    fetch(`/api/wards/resolve?lat=${fetchingLocation.lat}&lng=${fetchingLocation.lng}`)
      .then(res => res.json())
      .then(data => {
        if (data.ward) {
          setResolvedWard(data.ward);
        }
      })
      .catch(err => console.error("Error resolving ward:", err));
  }, [fetchingLocation?.lat, fetchingLocation?.lng]);
  const [visibleMapBounds, setVisibleMapBounds] = useState<{
    northEast: { lat: number; lng: number };
    southWest: { lat: number; lng: number };
  } | null>(null);
  const [proximityFilter, setProximityFilter] = useState<number | "all">("all");
  const [isUsingGPS, setIsUsingGPS] = useState(false);
  const [guestUuid, setGuestUuid] = useState<string>(() => {
    let gUuid = localStorage.getItem("community_hero_guest_uuid");
    if (!gUuid) {
      gUuid = `guest-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      localStorage.setItem("community_hero_guest_uuid", gUuid);
    }
    return gUuid;
  });

  // Notifications
  const [toast, setToast] = useState<{ message: string; subMessage?: string; icon?: React.ReactNode } | null>(null);
  const [loading, setLoading] = useState(true);

  // Notification States & Helpers
  const [showNotifications, setShowNotifications] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("read_notifications") || "[]");
    } catch {
      return [];
    }
  });

  // Computed notification logs from issues the user interacted with (reported or upvoted)
  const getNotifications = () => {
    if (!currentUser) return [];
    
    // Relevant issues are those reported by the user or upvoted by the user
    const userIssues = issues.filter(
      (iss) => iss.reportedBy === currentUser.uuid || iss.upvotedBy.includes(currentUser.uuid)
    );

    const list: { id: string; issueId: string; title: string; body: string; timestamp: string; status: string; isRead: boolean }[] = [];
    
    userIssues.forEach((iss) => {
      iss.statusHistory.forEach((history) => {
        // Build a unique notification ID based on issue key and status key
        const notifId = `${iss.id}-${history.status}-${new Date(history.timestamp).getTime()}`;
        const isRead = readNotifications.includes(notifId);
        
        list.push({
          id: notifId,
          issueId: iss.id,
          title: `Status: ${history.status}`,
          body: `"${iss.title}" status changed to ${history.status}.`,
          timestamp: history.timestamp,
          status: history.status,
          isRead
        });
      });
    });

    // Sort to show newest first
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const markAllNotificationsAsRead = () => {
    const allNotifs = getNotifications();
    const updated = Array.from(new Set([...readNotifications, ...allNotifs.map(n => n.id)]));
    setReadNotifications(updated);
    localStorage.setItem("read_notifications", JSON.stringify(updated));
  };

  const handleNotificationClick = (notif: any) => {
    if (!readNotifications.includes(notif.id)) {
      const updated = [...readNotifications, notif.id];
      setReadNotifications(updated);
      localStorage.setItem("read_notifications", JSON.stringify(updated));
    }
    
    const matchingIssue = issues.find(i => i.id === notif.issueId);
    if (matchingIssue) {
      setSelectedIssue(matchingIssue);
      setActiveTab("map");
    }
    setShowNotifications(false);
  };

  // Helper to generate mailto dispatch prefilled template
  const getEmailMailtoLink = (issue: Issue) => {
    const j = getJurisdiction(issue.coordinates.lat, issue.coordinates.lng);
    const departmentEmail = `${issue.department.toLowerCase().replace(/[^a-z]/g, "")}@${j.emailSuffix}`;
    const subject = encodeURIComponent(`[Community Hero Dispatch] Action Required: ${issue.category} Hazard (ID: ${issue.id})`);
    
    const bodyText = `To: ${j.authority} Representative
Subject: Civic Incident Dispatch Notification (ID: ${issue.id})

Respected Officer/Department Head,

This is a certified local infrastructure hazard notification dispatched on behalf of the ${j.city} Citizen Registry (${j.state}) via the Community Hero verification framework. 

Active citizens have audited, and confirmed the public hazard detailed below. We request the immediate deployment of a repair squad to inspect and clear the issue.

INCIDENT METADATA:
-------------------------------------------
• Incident Description: ${issue.title}
• Hazard Category: ${issue.category}
• Confirmed Severity Rating: ${issue.severity}/5
• Assigned Urgency: ${issue.urgency}
• Dispatched Department: ${issue.department}
• Regional Jurisdiction: ${j.authority} (${j.state})

GEOLOCATION SPECIFICATIONS:
-------------------------------------------
• Latitude Position: ${issue.coordinates.lat}
• Longitude Position: ${issue.coordinates.lng}
• Live Navigation Coordinates: https://www.google.com/maps/search/?api=1&query=${issue.coordinates.lat},${issue.coordinates.lng}

CITIZEN STATEMENT & PROOF:
${issue.description}

PROPOSED SAFETY FIX:
${issue.suggestedAction}

PHOTOGRAPHIC EVIDENCE ATTACHMENT:
${issue.imageUrl ? `• Live Proof Link: ${issue.imageUrl}` : "• No live photo proof provided."}

Please find the details listed above as credible evidence. Kindly respond with dispatch timeline confirmation coordinates.

Respectfully,
${j.city} Community Hero Network
(Reference Identifier: ${issue.id})
`;
    
    return `mailto:${departmentEmail}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
  };

  // Periodic polling hook to refresh data across devices frequently (every 5 seconds)
  useEffect(() => {
    if (showWelcomeScreen) return;

    const interval = setInterval(async () => {
      try {
        const issuesData = await fetchIssues(fetchingLocation?.lat ?? undefined, fetchingLocation?.lng ?? undefined);
        setIssues(issuesData);

        // Also update details panel if selected issue is updated on server
        if (selectedIssue) {
          const freshSelected = issuesData.find((i) => i.id === selectedIssue.id);
          if (freshSelected) {
            setSelectedIssue(freshSelected);
          }
        }

        // Also update leaderboard status
        const lbData = await fetchLeaderboard();
        setLeaderboard(lbData);

        // Also refresh user's profile to align XP changes if an issue they upvoted/reported changed status
        if (currentUser) {
          const refreshedUserObj = await initializeUser(
            currentUser.uuid,
            undefined,
            undefined
          );
          setCurrentUser(refreshedUserObj);
        }
      } catch (err: any) {
        if (err && (err.name === "TypeError" || err.message === "Failed to fetch" || String(err).includes("Failed to fetch"))) {
          console.warn("Device sync periodic refresh temporarily offline (server restarting/reconnecting):", err.message || err);
        } else {
          console.error("Device sync periodic refresh failed:", err);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [currentUser, showWelcomeScreen, selectedIssue, fetchingLocation?.lat, fetchingLocation?.lng]);

  // Fetch issues immediately when fetchingLocation is first resolved or updated
  useEffect(() => {
    if (!fetchingLocation) return;
    const loadIssuesForLocation = async () => {
      try {
        const issuesData = await fetchIssues(fetchingLocation.lat, fetchingLocation.lng);
        setIssues(issuesData);
      } catch (err) {
        console.error("Failed to load issues for location:", err);
      }
    };
    loadIssuesForLocation();
  }, [fetchingLocation?.lat, fetchingLocation?.lng]);

  // Real-time Database Stream (SSE) for instant cross-device updates
  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.issues) {
          setIssues(payload.issues);
          if (selectedIssue) {
            const freshSelected = payload.issues.find((i: Issue) => i.id === selectedIssue.id);
            if (freshSelected) {
              setSelectedIssue(freshSelected);
            }
          }
        }
        if (payload.users) {
          setLeaderboard(payload.users);
          if (currentUser) {
            const freshUser = payload.users.find((u: User) => u.uuid === currentUser.uuid);
            if (freshUser) {
              setCurrentUser(freshUser);
            }
          }
        }
      } catch (err) {
        console.error("Error parsing real-time broadcast payload:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn("SSE disconnected, relying on periodic fallback polling. Error:", err);
    };

    return () => {
      eventSource.close();
    };
  }, [currentUser, selectedIssue]);

  // Auto-update ward based on current location if user has auto-assign enabled
  useEffect(() => {
    let active = true;
    if (currentUser && fetchingLocation && currentUser.ward_auto_assign !== false) {
      const updateWardOnLocation = async () => {
        try {
          const updatedUser = await initializeUser(
            currentUser.uuid,
            undefined,
            undefined,
            fetchingLocation.lat,
            fetchingLocation.lng
          );
          if (active && updatedUser && updatedUser.ward !== currentUser.ward) {
            setCurrentUser(updatedUser);
            triggerToast(
              "Local Boundary Updated",
              `Automatically updated your ward to ${updatedUser.ward} based on your nearest physical location.`,
              <Compass className="w-4 h-4 text-indigo-500" />
            );
          }
        } catch (err) {
          console.error("Auto ward update failed:", err);
        }
      };
      updateWardOnLocation();
    }
    return () => {
      active = false;
    };
  }, [fetchingLocation?.lat, fetchingLocation?.lng, currentUser?.uuid]);

  // 1. Check Local Auth & Load Initial Registry
  useEffect(() => {
    async function bootApp() {
      try {
        setLoading(true);
        // Load Issues
        const issuesData = await fetchIssues();
        setIssues(issuesData);

        // Load Leaderboards
        const lbData = await fetchLeaderboard();
        setLeaderboard(lbData);

        // Check local UUID
        let localUuid = localStorage.getItem("community_hero_uuid");
        if (!localUuid) {
          // New visitor, show welcome flow (can close to browse as guest)
          setShowWelcomeScreen(true);
          setLoading(false);
        } else {
          // Exists, sync with db
          const userObj = await initializeUser(localUuid);
          setCurrentUser(userObj);
          setLoading(false);
        }
      } catch (err) {
        console.error("Boot failure, loading fallback local representation:", err);
        setLoading(false);
      }
    }
    bootApp();
  }, []);

  // Show temporary toast
  const triggerToast = (message: string, subMessage?: string, icon?: React.ReactNode) => {
    setToast({ message, subMessage, icon });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  // 2. Submit Welcome Profile Sync (Signup or Login)
  const handleWelcomeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const uName = authUsername.trim();
    if (!uName) {
      setAuthError("Username is required.");
      return;
    }
    if (!authPassword) {
      setAuthError("Password is required.");
      return;
    }
    if (authMode === "signup" && !welcomeName.trim()) {
      setAuthError("Display name is required.");
      return;
    }

    try {
      setLoading(true);
      let userObj;
      if (authMode === "signup") {
        userObj = await signUpUser(
          uName,
          authPassword,
          welcomeName.trim(),
          welcomeColor,
          signUpAsAdmin,
          userLocation?.lat,
          userLocation?.lng
        );
      } else {
        userObj = await logInUser(uName, authPassword);
      }

      setCurrentUser(userObj);
      localStorage.setItem("community_hero_uuid", userObj.uuid);
      setShowWelcomeScreen(false);

      // Load Leaderboard
      const lbData = await fetchLeaderboard();
      setLeaderboard(lbData);
      
      triggerToast(
        `Welcome to Community Hero, ${userObj.name}!`,
        authMode === "signup" ? "Account created successfully" : "Logged in successfully",
        <Sparkles className="w-5 h-5 text-amber-500" />
      );
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Authentication process failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Issue Reported Success callback
  const handleReportSuccess = (res: any) => {
    setShowReportModal(false);
    // Unshift/Insert reported issue
    const updatedIssues = [res.issue, ...issues];
    setIssues(updatedIssues);
    setSelectedIssue(res.issue); // Automatically inspect active reported

    // Sync current logged User state (increasing XP etc)
    if (currentUser && currentUser.uuid === res.issue.reportedBy) {
      setCurrentUser({
        ...currentUser,
        xp: res.gamification.newTotal,
        badges: [
          ...currentUser.badges,
          ...res.gamification.badgesUnlocked.map((bName: string) => ({
            id: `badge-${Date.now()}`,
            name: bName,
            icon: "Sparkles",
            description: "Unlocked during infrastructure report contribution.",
            unlockedAt: new Date().toISOString()
          }))
        ]
      });

      // Reload global leaderboard ranks
      fetchLeaderboard().then((data) => setLeaderboard(data));
    }

    triggerToast(
      `Issue Reported: ${res.issue.category}!`,
      `Verified +${res.gamification.xpEarned} XP awarded to your Citizen Profile.`,
      <CheckCircle className="w-5 h-5 text-emerald-500" />
    );
  };

  // 4. Handle Verification (Upvote) Issue
  const handleUpvote = async (issueId: string) => {
    const activeUuid = currentUser ? currentUser.uuid : guestUuid;
    try {
      const res = await upvoteIssue(issueId, activeUuid);
      
      // Update issues locally
      const updatedIssues = issues.map((i) => {
        if (i.id === issueId) return res.issue;
        return i;
      });
      setIssues(updatedIssues);
      setSelectedIssue(res.issue);

      // If user is logged in, update current user XP
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          xp: res.gamification.newTotal,
          badges: [
            ...currentUser.badges,
            ...res.gamification.badgesUnlocked.map((bName: string) => ({
              id: `badge-${Date.now()}`,
              name: bName,
              icon: "ShieldAlert",
              description: "Awarded for helping audit local civic threats.",
              unlockedAt: new Date().toISOString()
            }))
          ]
        });
      }

      // Update local leaderboard
      const lbData = await fetchLeaderboard();
      setLeaderboard(lbData);

      triggerToast(
        "Verification Confirmed!",
        currentUser
          ? "Casted neighborhood vote. Verified +20 XP awarded."
          : "Casted guest vote. Sign up to start earning citizen XP!",
        <ThumbsUp className="w-5 h-5 text-indigo-600 fill-indigo-100" />
      );
    } catch (err: any) {
      triggerToast("Verification Failed", err.message || "Failed to process verification.", <AlertCircle className="w-4 h-4 text-rose-500" />);
    }
  };

  // 5. Hard Admin Override Stage Transitions for Playground grading
  const handleAdminStatusOverride = async (issueId: string, newStatus: string) => {
    try {
      const res = await updateIssueStatus(issueId, newStatus);
      
      // Sync local Issues
      const updatedIssues = issues.map((i) => {
        if (i.id === issueId) return res.issue;
        return i;
      });
      setIssues(updatedIssues);
      setSelectedIssue(res.issue);

      // If resolving state resulted in reporter rewards, notify!
      if (res.gamificationReporterResult) {
        const reward = res.gamificationReporterResult;
        triggerToast(
          "Municipal Action Completed!",
          `Issue marked Resolved. +100 XP awarded to Original Reporter.`,
          <Shield className="w-5 h-5 text-indigo-600 animate-bounce" />
        );

        // If current user is also the reporter, sync XP
        if (currentUser && currentUser.uuid === reward.reporterUuid) {
          setCurrentUser({
            ...currentUser,
            xp: reward.newTotal,
            badges: [
              ...currentUser.badges,
              ...reward.badgesUnlocked.map((bName: string) => ({
                id: `badge-${Date.now()}`,
                name: bName,
                icon: "ShieldCheck",
                description: "Awarded after reported infrastructure hazard receives civic closure.",
                unlockedAt: new Date().toISOString()
              }))
            ]
          });
        }
      } else {
        triggerToast(
          `Pipeline Changed to: ${newStatus}`,
          "Progress updated in public database.",
          <ChevronRight className="w-5 h-5 text-indigo-600" />
        );
      }

      // Sync leaderboard
      const lbData = await fetchLeaderboard();
      setLeaderboard(lbData);
    } catch (err: any) {
      alert(err.message || "Failed to process status override.");
    }
  };

  // Resolve issue with photo and Gemini verification
  const handleMarkIssueAsResolved = async (issueId: string) => {
    if (!currentUser) {
      setResolutionError("Please sign up or log in to resolve community issues and earn citizen rewards.");
      return;
    }
    if (!resolvingPhotoBase64) {
      setResolutionError("An image upload of the resolved/repaired state is required.");
      return;
    }

    setIsResolving(true);
    setResolutionError(null);

    try {
      const res = await updateIssueStatus(issueId, "Resolved", currentUser.uuid, resolvingPhotoBase64);
      
      // Update issues in local state
      const updatedIssues = issues.map((i) => {
        if (i.id === issueId) return res.issue;
        return i;
      });
      setIssues(updatedIssues);
      setSelectedIssue(res.issue);

      // Clean up inputs
      setResolvingPhotoBase64(null);

      // Trigger success notifications and gamification toasts!
      let subMsg = "Issue marked Resolved completely.";
      if (res.gamificationOperatorResult) {
        subMsg += ` Earned +50 XP for resolving!`;
        // Award to current resolver
        const opRes = res.gamificationOperatorResult;
        setCurrentUser(prev => prev ? {
          ...prev,
          xp: opRes.newTotal,
          badges: [
            ...prev.badges,
            ...opRes.badgesUnlocked.map((bName: string) => ({
              id: `badge-${Date.now()}`,
              name: bName,
              icon: "ShieldCheck",
              description: "Awarded after reported infrastructure hazard receives civic closure.",
              unlockedAt: new Date().toISOString()
            }))
          ]
        } : null);
      }

      if (res.gamificationReporterResult) {
        subMsg += ` Reporter received +100 XP.`;
      }

      triggerToast(
        "AI Verification Approved! ✓",
        subMsg,
        <ShieldCheck className="w-5 h-5 text-emerald-600 animate-bounce" />
      );

      // Reload leaderboard
      const lbData = await fetchLeaderboard();
      setLeaderboard(lbData);
    } catch (err: any) {
      setResolutionError(err.message || "Failed to verify and resolve this issue.");
    } finally {
      setIsResolving(false);
    }
  };

  // Profile Sync update callback
  const handleProfileUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    // Reload ranks
    fetchLeaderboard().then((data) => setLeaderboard(data));
  };

  // Haversine formula helper for hyperlocal distance checks
  const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  // Persist user location to localStorage to recover from browser geolocation blocks
  useEffect(() => {
    if (userLocation) {
      localStorage.setItem("community_hero_lat", userLocation.lat.toString());
      localStorage.setItem("community_hero_lng", userLocation.lng.toString());
    }
  }, [userLocation]);

  // Auto-acquire and continuously watch user's current GPS location to keep the website always synced
  useEffect(() => {
    const loadSavedOrPromptManual = () => {
      const savedLat = localStorage.getItem("community_hero_lat");
      const savedLng = localStorage.getItem("community_hero_lng");
      if (savedLat && savedLng) {
        setUserLocation({ lat: parseFloat(savedLat), lng: parseFloat(savedLng) });
        setIsUsingGPS(false);
      } else {
        // Coimbatore as standard start point for India instead of Bengaluru if no saved, but prompt immediately
        setUserLocation({ lat: 10.9972, lng: 76.9936 });
        setIsUsingGPS(false);
        setShowManualLocationModal(true);
      }
    };

    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported by this browser.");
      loadSavedOrPromptManual();
      return;
    }

    // First immediate capture
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setIsUsingGPS(true);
        triggerToast("GPS Sync Active", "The website is continuously synced with your GPS location.", <Compass className="w-4 h-4 text-emerald-600 animate-spin" />);
      },
      (err) => {
        console.warn("Initial GPS capture failed/denied:", err);
        loadSavedOrPromptManual();
        setShowManualLocationModal(true);
        triggerToast(
          "Location Access Denied",
          "Please set your location manually to view local wards correctly.",
          <MapPin className="w-4 h-4 text-rose-500" />
        );
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );

    // Watch position to keep always synced in real-time
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setIsUsingGPS(true);
      },
      (err) => {
        console.warn("Continuous GPS watch error:", err);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Tiers Helper for profile cards
  const getCitizenTier = (xp: number) => {
    if (xp < 200) return { title: "Newcomer", badge: "bg-slate-100 text-slate-700" };
    if (xp < 500) return { title: "Citizen", badge: "bg-green-100 text-green-800" };
    if (xp < 1000) return { title: "Warden", badge: "bg-blue-100 text-blue-800" };
    if (xp < 2000) return { title: "Guardian", badge: "bg-indigo-100 text-indigo-800" };
    return { title: "Champion", badge: "bg-amber-100 text-amber-800" };
  };

  // Loading Splash Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3 font-sans">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-indigo-100 animate-ping opacity-60"></div>
          <HeartHandshake className="w-12 h-12 text-indigo-600 relative animate-pulse" />
        </div>
        <div className="text-center mt-2">
          <h2 className="text-base font-bold text-slate-800 font-display">Community Hero</h2>
          <p className="text-[11px] text-slate-400 font-medium font-mono">Initializing civic networks...</p>
        </div>
      </div>
    );
  }

  // 1. Welcome Setup Dialog
  if (showWelcomeScreen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-emerald-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden p-8 space-y-6 relative"
        >
          {/* Close button for Guest exploration */}
          <button
            onClick={() => {
              setShowWelcomeScreen(false);
              setAuthError(null);
            }}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all cursor-pointer"
            title="Continue as Guest"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100">
              <HeartHandshake className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 font-display tracking-tight">Community Hero</h1>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed mt-1">
                Hyperlocal civic registry enabling neighbours to file, verify, and resolve municipal hazards.
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/40">
            <button
              type="button"
              onClick={() => {
                setAuthMode("signup");
                setAuthError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                authMode === "signup"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Citizen Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                authMode === "login"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Citizen Log In
            </button>
          </div>

          {/* Validation Error Banner */}
          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-800 font-semibold leading-relaxed">
                {authError}
              </p>
            </div>
          )}

          <form onSubmit={handleWelcomeSubmit} className="space-y-4">
            {/* Username/Email/Mobile Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-display">
                Mobile Number or Email Address
              </label>
              <input
                required
                type="text"
                placeholder="e.g. +91 9876543210 or name@example.com"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                maxLength={40}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 bg-slate-50/50 text-xs font-semibold text-slate-800"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-display">
                Password
              </label>
              <div className="relative">
                <input
                  required
                  type="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 bg-slate-50/50 text-xs font-semibold text-slate-800"
                />
                <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5" />
              </div>
            </div>

            {/* Fields specifically for Signup */}
            {authMode === "signup" && (
              <>
                {/* Display Name Input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-display">
                    Display Name / Full Name
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Aarav Sharma"
                    value={welcomeName}
                    onChange={(e) => setWelcomeName(e.target.value)}
                    maxLength={25}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 bg-slate-50/50 text-xs font-semibold text-slate-800"
                  />
                </div>

                {/* Avatar Visual Theme Color Picker */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider font-display">
                    Select Avatar Color
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { class: "bg-emerald-500", label: "Emerald" },
                      { class: "bg-indigo-600", label: "Midnight" },
                      { class: "bg-rose-500", label: "Rose" },
                      { class: "bg-amber-500", label: "Solar" }
                    ].map((col) => {
                      const isActive = welcomeColor === col.class;
                      return (
                        <button
                          key={col.class}
                          type="button"
                          onClick={() => setWelcomeColor(col.class)}
                          className={`h-9 rounded-xl ${col.class} relative flex items-center justify-center border-2 shadow-sm ${
                            isActive ? "border-slate-800 ring-2 ring-slate-300" : "border-transparent"
                          }`}
                          title={col.label}
                        >
                          {isActive && (
                            <span className="bg-white rounded-full p-0.5 text-slate-900 shadow-sm">
                              <CheckCircle className="w-3 h-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Submission button */}
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 font-bold text-white py-3 rounded-2xl text-xs tracking-wider uppercase shadow-md hover:shadow-lg transition-all cursor-pointer mt-2"
            >
              {authMode === "signup" ? "Create Citizen Account" : "Access Citizen Registry"}
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Continue as Guest Button */}
            <button
              type="button"
              onClick={() => {
                setShowWelcomeScreen(false);
                setAuthError(null);
              }}
              className="w-full flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-2xl text-xs tracking-wide transition-all cursor-pointer"
            >
              <span>Explore as Guest (View-Only)</span>
            </button>
          </form>

          {/* Secure SQL persistent statement */}
          <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-600 leading-relaxed font-semibold">
              All credentials are encrypted and stored inside the secure PostgreSQL-emulated relational database.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Calculate resolution rates for header widget
  const reportedCount = issues.length;
  const resolvedCount = issues.filter((i) => i.status === "Resolved").length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased flex flex-col">
      
      {/* 2. Top Navigation header */}
      <header className="sticky top-0 z-[1050] bg-white border-b border-zinc-200 px-4 md:px-8 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8.5 h-8.5 rounded-lg bg-[#ecfdf5] border border-[#d1fae5] flex items-center justify-center shadow-sm">
            <HeartHandshake className="w-5 h-5 text-[#047857]" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-wider text-zinc-800 uppercase font-sans">Community Hero</h1>
            <button
              onClick={() => setShowManualLocationModal(true)}
              className="flex items-center gap-1 text-[9px] font-bold text-[#047857] hover:text-[#065f46] font-sans tracking-widest uppercase text-left transition-all cursor-pointer"
              title="Click to change location manually"
            >
              <span>{currentUser?.ward || resolvedWard} Registry</span>
              <MapPin className="w-2.5 h-2.5 animate-pulse text-[#059669]" />
            </button>
          </div>
        </div>

        {/* Global Stats bar */}
        <div className="hidden lg:flex items-center gap-6 text-[10px] font-bold uppercase tracking-wider font-mono">
          <div className="flex items-center gap-1.5 text-zinc-500">
            <Activity className="w-3.5 h-3.5" />
            Claims: <span className="text-zinc-900 font-black">{reportedCount}</span>
          </div>
          <div className="flex items-center gap-1.5 text-zinc-500">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            Resolved: <span className="text-emerald-800 font-black">{resolvedCount}</span>
          </div>
        </div>

        {/* Notification Bell and Active Profile Action Blocks */}
        {currentUser ? (
          <div className="flex items-center gap-3">
            
            {/* Notification Bell Dropdown Panel */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2.5 rounded-full border border-zinc-200 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-900 transition-all cursor-pointer bg-white"
                id="notification-bell-btn"
                title="Municipal Updates"
              >
                <Bell className="w-4 h-4" />
                {getNotifications().filter(n => !n.isRead).length > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-zinc-900 text-white border border-white rounded-full text-[8px] font-black flex items-center justify-center font-mono">
                    {getNotifications().filter(n => !n.isRead).length}
                  </span>
                )}
              </button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div onClick={() => setShowNotifications(false)} className="fixed inset-0 z-[1090]" id="notif-backdrop" />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-80 bg-white border border-zinc-200 shadow-xl rounded-xl p-4 z-[1100]"
                      id="notifications-dropdown"
                    >
                      <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5 mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-zinc-700 font-bold" />
                          <h4 className="text-xs font-bold text-zinc-800 font-mono uppercase tracking-wide">Status Activity Log</h4>
                        </div>
                        {getNotifications().some(n => !n.isRead) && (
                          <button
                            onClick={markAllNotificationsAsRead}
                            className="text-[9px] font-bold text-zinc-900 hover:underline font-sans uppercase bg-zinc-100 px-2.5 py-0.8 rounded-md transition-all"
                            id="notif-mark-read-btn"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-64 overflow-y-auto divide-y divide-zinc-50 space-y-1 pr-1" id="notifications-list">
                        {getNotifications().length === 0 ? (
                          <div className="text-center py-6 text-zinc-400">
                            <p className="text-[10px] font-bold font-sans">No recent status updates</p>
                            <p className="text-[9px] font-medium text-zinc-400 mt-1">Interacted or reported items display municipal status updates here.</p>
                          </div>
                        ) : (
                          getNotifications().map((notif) => (
                            <button
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`w-full text-left p-2.5 rounded-xl hover:bg-zinc-50 transition-colors flex items-start justify-between gap-2 border border-transparent ${
                                !notif.isRead ? "bg-zinc-50/75 border-l-2 border-zinc-900" : ""
                              }`}
                              id={`notif-item-${notif.id}`}
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className={`text-[8px] font-bold uppercase px-1.5 py-0.3 rounded font-mono ${
                                    notif.status === "Resolved" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                    notif.status === "In Progress" ? "bg-zinc-100 text-zinc-800 border border-zinc-200" : "bg-neutral-50 text-neutral-600"
                                  }`}>
                                    {notif.status}
                                  </span>
                                  <span className="text-[8px] text-zinc-400 font-mono">
                                    {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-700 font-semibold leading-relaxed">
                                  {notif.body}
                                </p>
                              </div>
                              {!notif.isRead && (
                                <span className="w-1.5 h-1.5 bg-zinc-900 rounded-full shrink-0 mt-1.5" />
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Active Profile Info Widget */}
            <button
              onClick={() => setShowProfileModal(true)}
              id="user-profile-badge"
              className="flex items-center gap-2 bg-[#f8fafc] border border-slate-200 p-1.5 pr-3.5 rounded-xl transition-all hover:bg-slate-150 text-left cursor-pointer"
            >
              <div className={`w-7 h-7 rounded-md ${currentUser.avatarColor || "bg-[#c7d2fe]"} text-slate-800 flex items-center justify-center text-xs font-bold font-sans`}>
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] font-sans font-bold text-slate-800 truncate max-w-[120px] leading-tight uppercase">
                  {currentUser.name}
                </p>
                <p className="text-[9px] text-slate-500 font-sans font-semibold tracking-wide mt-0.5">
                  {getCitizenTier(currentUser.xp).title} • {currentUser.xp} XP
                </p>
              </div>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setAuthMode("login");
                setShowWelcomeScreen(true);
              }}
              id="header-login-btn"
              className="flex items-center gap-1.5 border border-[#ede9fe] text-[#6d28d9] bg-[#f5f3ff] hover:bg-[#ede9fe] font-bold px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer"
            >
              <User2 className="w-3.5 h-3.5" />
              Citizen Access
            </button>
          </div>
        )}
      </header>

      {/* 3. Sub-header Navigation Tabs */}
      <nav className="bg-white border-b border-slate-200 px-4 md:px-8 py-2.5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            id="tab-map"
            onClick={() => setActiveTab("map")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${
              activeTab === "map"
                ? "bg-white text-[#6d28d9] shadow-sm border border-slate-200/50"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Interactive Map
          </button>
          
          <button
            id="tab-impact"
            onClick={() => setActiveTab("impact")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${
              activeTab === "impact"
                ? "bg-white text-[#6d28d9] shadow-sm border border-slate-200/50"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Impact Dashboard
          </button>

          <button
            id="tab-leaderboard"
            onClick={() => setActiveTab("leaderboard")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${
              activeTab === "leaderboard"
                ? "bg-white text-[#6d28d9] shadow-sm border border-slate-200/50"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Leaderboards
          </button>

          <button
            id="tab-security"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wide transition-all ${
              activeTab === "security"
                ? "bg-white text-[#6d28d9] shadow-sm border border-slate-200/50"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Gov Security & Trust
          </button>
        </div>

        {/* Global FAB Trigger */}
        <div className="flex items-center gap-3">
          {currentUser?.isAdmin ? (
            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl text-[10.5px] font-bold uppercase tracking-wide">
              <Shield className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
              <span>Admin Portal Active</span>
            </div>
          ) : (
            <button
              onClick={() => {
                setAuthMode("login");
                setShowWelcomeScreen(true);
              }}
              className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-3 py-1.5 rounded-xl text-[10.5px] font-bold uppercase tracking-wide cursor-pointer transition-all"
              id="admin-portal-login-trigger"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Admin Sign-In</span>
            </button>
          )}

          <button
            onClick={() => setShowReportModal(true)}
            id="report-issue-fab"
            className="flex items-center gap-1 bg-[#f5f3ff] hover:bg-[#ede9fe] text-[#6d28d9] border border-[#ede9fe] font-bold px-4 py-2 rounded-xl text-xs shadow-sm tracking-wide transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#8b5cf6] animate-pulse" />
            Report Issue
          </button>
        </div>
      </nav>

      {/* 4. Main Workspace (Grid layout depending on Tab) */}
      <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
        
        {/* Workspace views inside tabs */}
        <AnimatePresence mode="wait">
          {activeTab === "map" && (() => {
            const userCity = userLocation ? getJurisdiction(userLocation.lat, userLocation.lng).city : null;
            const filteredIssues = issues.filter((issue) => {
              // 1. Must be in the user's focal area (same city/jurisdiction region)
              if (userCity && proximityFilter !== "all") {
                const issueCity = getJurisdiction(issue.coordinates.lat, issue.coordinates.lng).city;
                if (issueCity !== userCity) return false;
              }
              
              // 2. Proximity filter
              if (proximityFilter !== "all" && userLocation) {
                const dist = getDistanceInKm(
                  userLocation.lat,
                  userLocation.lng,
                  issue.coordinates.lat,
                  issue.coordinates.lng
                );
                return dist <= proximityFilter;
              }
              return true;
            });

            const isCoordinateInBounds = (lat: number, lng: number) => {
              if (!visibleMapBounds) return true;
              const { northEast, southWest } = visibleMapBounds;
              const inLat = lat >= Math.min(southWest.lat, northEast.lat) && lat <= Math.max(southWest.lat, northEast.lat);
              const inLng = lng >= Math.min(southWest.lng, northEast.lng) && lng <= Math.max(southWest.lng, northEast.lng);
              return inLat && inLng;
            };

            const mapBoundedIssues = filteredIssues.filter((iss) =>
              isCoordinateInBounds(iss.coordinates.lat, iss.coordinates.lng)
            );

            return (
              <motion.div
                key="map-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-6"
              >
              
              {/* Map rendering canvas container */}
              <div className="lg:col-span-2 flex flex-col gap-4">
                <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100/90 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                    <h3 className="text-xs font-bold text-slate-800 font-display">Active Municipal Grid View</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#6d28d9] font-mono uppercase bg-indigo-50 px-2.5 py-0.5 rounded">
                      {userLocation ? `${getJurisdiction(userLocation.lat, userLocation.lng).city} Region` : "Local Grid"}
                    </span>
                    <button
                      onClick={() => setShowManualLocationModal(true)}
                      className="text-[9px] font-bold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/50 px-2 py-0.5 rounded transition-all cursor-pointer border border-slate-200/60"
                    >
                      Change
                    </button>
                  </div>
                </div>

                <div className="h-[350px] md:h-[500px] w-full">
                  <MainMap
                    issues={filteredIssues}
                    selectedIssue={selectedIssue}
                    onSelectIssue={setSelectedIssue}
                    viewMode={mapViewMode}
                    setViewMode={setMapViewMode}
                    userLocation={userLocation}
                    proximityFilter={proximityFilter}
                    onUpdateUserLocation={(lat, lng) => {
                      setUserLocation({ lat, lng });
                      setIsUsingGPS(false);
                      triggerToast("Center Focal Point Repositioned", "Recalculating proximity indexes relative to selected coordinates.", <Compass className="w-4 h-4 text-indigo-500" />);
                    }}
                    onBoundsChange={setVisibleMapBounds}
                  />
                </div>
              </div>

              {/* Claims Explorer Panel Column & selected detail sidebar */}
              <div className="space-y-4">
                
                {/* 1. If issue is selected: Show Detail Card */}
                {selectedIssue ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full animate-in slide-in-from-right duration-200">
                    
                    {/* Header bar showing categorization */}
                    <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                      <div>
                        <span className="font-mono text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.8 rounded-full uppercase tracking-wider">
                          {selectedIssue.category}
                        </span>
                        <p className="text-[10px] text-slate-400 font-bold font-mono mt-0.5 uppercase tracking-wide">
                          ID: {selectedIssue.id}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedIssue(null)}
                        className="text-xs font-extrabold text-slate-400 hover:text-slate-600 font-mono uppercase hover:bg-slate-100 p-1.5 rounded-lg transition-all"
                      >
                        Close ×
                      </button>
                    </div>

                    {/* Image visual, placeholder standard rendering */}
                    {selectedIssue.imageUrl && (
                      <div className="h-40 relative overflow-hidden bg-slate-900">
                        <img
                          src={selectedIssue.imageUrl}
                          alt={selectedIssue.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 right-3 bg-slate-950/75 border border-white/20 text-white rounded-xl px-2.5 py-0.8 text-[10px] font-bold font-mono uppercase tracking-wide">
                          Verified Photo
                        </div>
                      </div>
                    )}

                    {/* Content Detail Panel */}
                    <div className="p-5 space-y-4.5 flex-1 overflow-y-auto">
                      <div className="space-y-1.5">
                        <h3 className="text-sm font-extrabold text-slate-800 leading-snug font-display">
                          {selectedIssue.title}
                        </h3>
                        <p className="text-xs text-slate-600 leading-relaxed font-sans">{selectedIssue.description}</p>
                      </div>

                      {/* AI analysis stats badges */}
                      <div className="grid grid-cols-2 gap-2.5 pt-1 font-mono text-[10px]">
                        
                        <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl">
                          <p className="text-slate-400 font-bold leading-none uppercase text-[8px] tracking-wider mb-1">Severity Rating</p>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-black">{selectedIssue.severity}/5</span>
                            <div className="flex gap-0.5 ml-0.5">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <span
                                  key={idx}
                                  className={`w-2 h-2 rounded-full ${
                                    idx < selectedIssue.severity ? "bg-rose-500 animate-pulse" : "bg-slate-200"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl">
                          <p className="text-slate-400 font-bold leading-none uppercase text-[8px] tracking-wider mb-1">Municipal Urgency</p>
                          <span className={`font-bold ${
                            selectedIssue.urgency === "Critical" ? "text-rose-700" :
                            selectedIssue.urgency === "High" ? "text-orange-600" : "text-amber-500"
                          }`}>{selectedIssue.urgency}</span>
                        </div>

                        <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl col-span-2">
                          <p className="text-slate-400 font-bold leading-none uppercase text-[8px] tracking-wider mb-1">Route Dispatch Department</p>
                          <span className="text-slate-800 font-bold">{selectedIssue.department}</span>
                        </div>

                        {/* Dynamic regional authority based on location coordinates */}
                        <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl col-span-2">
                          <p className="text-slate-400 font-bold leading-none uppercase text-[8px] tracking-wider mb-1">Regional Authority</p>
                          <span className="text-slate-800 font-bold truncate block">
                            {selectedIssue.authority || getJurisdiction(selectedIssue.coordinates.lat, selectedIssue.coordinates.lng).authority}
                          </span>
                        </div>

                        <div className="bg-slate-50 border border-slate-200/60 p-2.5 rounded-xl col-span-2">
                          <p className="text-slate-400 font-bold leading-none uppercase text-[8px] tracking-wider mb-1">State Jurisdiction</p>
                          <span className="text-slate-800 font-bold">
                            {selectedIssue.state || getJurisdiction(selectedIssue.coordinates.lat, selectedIssue.coordinates.lng).state}
                          </span>
                        </div>

                      </div>

                      {/* Suggested actionable directive */}
                      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-slate-800 uppercase tracking-widest font-display">Suggested Safety Action</p>
                          <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">{selectedIssue.suggestedAction}</p>
                        </div>
                      </div>

                      {/* Crowdsourcing Verification section */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
                        <div className="text-slate-500 text-[10px] font-semibold flex items-center gap-1 font-mono">
                          <ThumbsUp className="w-3.5 h-3.5 text-indigo-600 fill-indigo-100" />
                          <span>{selectedIssue.upvotes} Citizens confirmed</span>
                        </div>

                        {(() => {
                          const activeUuid = currentUser ? currentUser.uuid : guestUuid;
                          const hasUpvoted = selectedIssue.upvotedBy.includes(activeUuid);
                          const isReporter = selectedIssue.reportedBy === activeUuid;
                          return (
                            <button
                              id="verify-upvote-btn"
                              disabled={hasUpvoted || isReporter}
                              onClick={() => handleUpvote(selectedIssue.id)}
                              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold px-3.5 py-1.5 rounded-lg text-[10px] transition-all flex items-center gap-1 uppercase font-display cursor-pointer"
                            >
                              {hasUpvoted ? (
                                "Already Audited ✓"
                              ) : isReporter ? (
                                "Your Reported Issue"
                              ) : (
                                <>
                                  <Sparkles className="w-3 h-3 text-amber-300" />
                                  Verify Claim {currentUser ? "(+20 XP)" : ""}
                                </>
                              )}
                            </button>
                          );
                        })()}
                      </div>

                      {/* One-click Corporate Proof Dispatch Option */}
                      <div className="pt-3 border-t border-zinc-100 space-y-2">
                        <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest font-mono">Official Corporate Dispatch</p>
                        <a
                          href={getEmailMailtoLink(selectedIssue)}
                          id="corporation-email-dispatch-btn"
                          className="w-full flex items-center justify-center gap-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl py-2.5 text-xs font-bold leading-none border border-black shadow-sm transition-all text-center cursor-pointer"
                        >
                          <Mail className="w-4 h-4 text-emerald-400" />
                          <span>Dispatch Email Proof to Corporation</span>
                        </a>
                        <p className="text-[9px] text-zinc-400 text-center leading-relaxed font-sans">
                          Generates an official BBMP compliant dispatch layout prefilled with live verification credentials, and photograph proof URLs.
                        </p>
                      </div>

                      {/* Worker or Citizen "Resolve Issue" Verification Section */}
                      {selectedIssue.status !== "Resolved" ? (
                        <div className="pt-3.5 border-t border-slate-100 space-y-3">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                            🔧 Resolve This Issue
                          </p>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            Have you fixed this issue? Upload an image of the fixed state to trigger Gemini auto-resolution verification.
                          </p>
                          
                          {/* Drag & Drop File Container */}
                          <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const file = e.dataTransfer.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setResolvingPhotoBase64(reader.result as string);
                                reader.readAsDataURL(file);
                              }
                            }}
                            onClick={() => document.getElementById("resolved-photo-input")?.click()}
                            className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/10 rounded-xl p-4 text-center cursor-pointer transition-all space-y-2 group"
                          >
                            <input
                              type="file"
                              id="resolved-photo-input"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => setResolvingPhotoBase64(reader.result as string);
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                            {resolvingPhotoBase64 ? (
                              <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                                <img
                                  src={resolvingPhotoBase64}
                                  alt="Resolved Proof preview"
                                  className="mx-auto max-h-32 object-cover rounded-lg border border-slate-250 shadow-sm"
                                />
                                <button
                                  type="button"
                                  onClick={() => setResolvingPhotoBase64(null)}
                                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 underline"
                                >
                                  Clear Image
                                </button>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <Upload className="w-5 h-5 text-slate-400 mx-auto group-hover:text-indigo-500 transition-colors" />
                                <p className="text-xs font-bold text-slate-600 group-hover:text-indigo-600">
                                  Drag resolved photograph here, or click to browse
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  Supports JPG, PNG formats
                                </p>
                              </div>
                            )}
                          </div>

                          {resolutionError && (
                            <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-medium text-rose-700">
                              ⚠️ {resolutionError}
                            </div>
                          )}

                          <button
                            onClick={() => handleMarkIssueAsResolved(selectedIssue.id)}
                            disabled={isResolving || !resolvingPhotoBase64}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold rounded-xl py-2.5 text-xs tracking-wider uppercase shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {isResolving ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Verifying with Gemini AI...</span>
                              </>
                            ) : (
                              <span>Verify Resolution (+50 XP)</span>
                            )}
                          </button>
                        </div>
                      ) : (
                        /* If resolved, show before/after compare gallery side by side */
                        selectedIssue.resolvedImageUrl && (
                          <div className="pt-3.5 border-t border-slate-100 space-y-2.5">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                              📸 Resolution Proof Checklist
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-[9px] text-slate-400 font-bold block mb-1">BEFORE (REPORTED)</span>
                                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                                  <img
                                    src={selectedIssue.imageUrl}
                                    alt="Before report"
                                    className="w-full h-24 object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              </div>
                              <div>
                                <span className="text-[9px] text-emerald-600 font-bold block mb-1">AFTER (RESOLVED)</span>
                                <div className="border border-emerald-200 rounded-lg overflow-hidden bg-emerald-50">
                                  <img
                                    src={selectedIssue.resolvedImageUrl}
                                    alt="After resolved"
                                    className="w-full h-24 object-cover"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2.5 flex items-start gap-2">
                              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                              <div className="text-[10px] text-emerald-800 leading-normal font-medium">
                                <strong>Gemini Verification Active:</strong> Resolution photos match hazard cleanup standards. XP rewards dispatched to original reporter and operator.
                              </div>
                            </div>
                          </div>
                        )
                      )}

                      {/* Pipeline Stage Tracker */}
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono mb-2.5">Pipeline Status Log</p>
                        <div className="grid grid-cols-4 gap-1 text-[9px] font-mono font-bold text-center">
                          {["Reported", "Verified", "In Progress", "Resolved"].map((st) => {
                            const reached = selectedIssue.statusHistory.some((sh) => sh.status === st);
                            const isActive = selectedIssue.status === st;

                            return (
                              <div
                                key={st}
                                className={`rounded p-1.5 border transition-all ${
                                  isActive
                                    ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                                    : reached
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                    : "bg-slate-50 border-slate-100 text-slate-400"
                                }`}
                              >
                                {st}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Admin Override playground controllers */}
                      {isAdminMode && (
                        <div className="pt-3.5 border-t border-rose-100 bg-rose-50/50 -mx-5 -mb-5 p-5 mt-4 text-center">
                          <p className="text-[9px] font-mono font-bold text-rose-700 tracking-wider uppercase mb-2">
                            📋 Admin Simulator Controller override
                          </p>
                          <div className="flex gap-1.5 justify-center flex-wrap">
                            {["Reported", "Verified", "In Progress", "Resolved"].map((st) => {
                              const isCurrent = selectedIssue.status === st;
                              return (
                                <button
                                  key={st}
                                  id={`admin-btn-${st.toLowerCase().replace(" ", "-")}`}
                                  disabled={isCurrent}
                                  onClick={() => handleAdminStatusOverride(selectedIssue.id, st)}
                                  className={`px-2.5 py-1 text-[9px] font-mono font-bold border rounded transition-all ${
                                    isCurrent 
                                      ? "bg-rose-700 text-white border-rose-700" 
                                      : "bg-white text-rose-800 border-rose-200 hover:bg-rose-100/50"
                                  }`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                          {selectedIssue.status !== "Resolved" && (
                            <p className="text-[8px] text-rose-500 font-medium font-sans mt-2.5 leading-tight">
                              Marking "Resolved" will automatically trigger +100 XP rewards to reporter handle! (Warden Sync demo)
                            </p>
                          )}
                        </div>
                      )}

                    </div>

                  </div>
                ) : (
                  /* empty state, list outstanding challenges with hyperlocal controls */
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col gap-4.5 min-h-[500px]">
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 font-display">Hyperlocal Hazard Grid</h3>
                      <p className="text-[11px] text-slate-400">Manage, sort, and narrow down active reports by distance and coordinates</p>
                    </div>

                    {/* Proximity Distance and Focal Location Control */}
                    <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Compass className="w-3.5 h-3.5 text-[#6d28d9] animate-spin shrink-0" style={{ animationDuration: '8s' }} />
                          <h4 className="text-[10px] font-bold text-slate-800 font-sans uppercase tracking-wider truncate">Focal Center (GPS Live)</h4>
                        </div>
                        
                        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shadow-sm select-none">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                          Always Synced
                        </span>
                      </div>

                      {/* Proximity filter options control */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-200/50">
                        <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold font-sans uppercase">
                          <span>Focus Filter Radius</span>
                          <span className="text-[#6d28d9]">{proximityFilter === "all" ? "SHOWING ALL OUTSTANDING" : `${proximityFilter} KM RADIUS ACTIVE`}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          {["all", 1.0, 2.0, 5.0].map((filt) => {
                            const isActive = proximityFilter === filt;
                            return (
                              <button
                                key={filt}
                                type="button"
                                onClick={() => {
                                  setProximityFilter(filt as any);
                                  triggerToast(filt === "all" ? "District View" : `Local Boundary Filtered`, filt === "all" ? "Displaying all registered issues." : `Narrowing viewport scope context to issues within ${filt} km.`, <Shield className="w-4 h-4 text-emerald-500" />);
                                }}
                                className={`py-1 rounded-md text-[10px] font-bold font-sans transition-all cursor-pointer border ${
                                  isActive
                                    ? "bg-[#f5f3ff] text-[#6d28d9] border-[#ede9fe] shadow-sm"
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                                }`}
                                id={`proximity-pill-${filt}`}
                              >
                                {filt === "all" ? "All Grid" : `${filt} km`}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Filtered list rendering */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div className="divide-y divide-slate-100 max-h-[220px] overflow-y-auto pr-1">
                        {mapBoundedIssues.length === 0 ? (
                          <div className="text-center py-6">
                            <FolderOpen className="w-8 h-8 text-slate-300 mx-auto" />
                            <p className="text-xs text-slate-400 font-bold mt-2">No local hazards here!</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 px-3 leading-relaxed">
                              No hazards reported in this focus bounds area. Pan or zoom the map to find nearby issues.
                            </p>
                            {filteredIssues.length > 0 && (
                              <button
                                id="zoom-to-nearest-issue-btn"
                                type="button"
                                onClick={() => {
                                  if (userLocation) {
                                    const sortedByDist = [...filteredIssues].sort((a, b) => {
                                      const distA = getDistanceInKm(userLocation.lat, userLocation.lng, a.coordinates.lat, a.coordinates.lng);
                                      const distB = getDistanceInKm(userLocation.lat, userLocation.lng, b.coordinates.lat, b.coordinates.lng);
                                      return distA - distB;
                                    });
                                    setSelectedIssue(sortedByDist[0]);
                                  } else {
                                    setSelectedIssue(filteredIssues[0]);
                                  }
                                }}
                                className="mt-3 bg-[#f5f3ff] hover:bg-[#ede9fe] border border-[#ede9fe] text-[#6d28d9] font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all cursor-pointer"
                              >
                                Pan Map to Nearest Issue ({filteredIssues.length} Active in DB)
                              </button>
                            )}
                          </div>
                        ) : (
                          mapBoundedIssues.map((iss) => (
                            <button
                              key={iss.id}
                              id={`select-issue-${iss.id}`}
                              onClick={() => setSelectedIssue(iss)}
                              className="w-full text-left py-2.5 px-2 rounded-xl hover:bg-indigo-50/50 hover:text-indigo-900 transition-all flex items-center justify-between gap-3 text-xs border border-transparent hover:border-slate-100 mt-1"
                            >
                              <div className="space-y-0.5 min-w-0 flex-1">
                                <p className="font-bold text-slate-800 hover:text-indigo-900 truncate leading-snug">{iss.title}</p>
                                <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-bold font-mono select-none">
                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-md font-sans uppercase text-[8px]">{iss.category}</span>
                                  <span>•</span>
                                  <span>Severity {iss.severity}</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1.5 shrink-0">
                                {userLocation && (
                                  (() => {
                                    const dist = getDistanceInKm(userLocation.lat, userLocation.lng, iss.coordinates.lat, iss.coordinates.lng);
                                    return (
                                      <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50/90 border border-indigo-100/60 px-1.5 py-0.5 rounded-lg font-mono">
                                        {dist.toFixed(2)} km
                                      </span>
                                    );
                                  })()
                                )}
                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-indigo-50/50 border border-indigo-100/40 rounded-xl flex items-start gap-2 text-[10px]">
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <p className="text-indigo-900/80 leading-relaxed font-semibold">
                        Tap "Report Issue" to file a new infrastructure claim. Gemini scans photo uploads to categorize and routing Municipal teams instantly.
                      </p>
                    </div>

                  </div>
                )}

              </div>

            </motion.div>
          );
          })()}

          {activeTab === "impact" && (
            <motion.div
              key="impact-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <StatsPanel
                initialStats={null}
                resolvedThisWeek={issues.filter((i) => i.status === "Resolved").length}
              />
            </motion.div>
          )}

          {activeTab === "leaderboard" && (
            <motion.div
              key="leaderboard-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <LeaderboardPanel
                leaderboard={leaderboard}
                currentUser={currentUser}
                userLocation={fetchingLocation || userLocation}
                onUserUpdate={(updatedUser) => {
                  setCurrentUser(updatedUser);
                }}
                refreshLeaderboard={async () => {
                  const lbData = await fetchLeaderboard();
                  setLeaderboard(lbData);
                }}
              />
            </motion.div>
          )}

          {activeTab === "security" && (
            <motion.div
              key="security-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <SecurityCompliancePanel
                currentUser={currentUser}
                onEraseAccount={async () => {
                  if (currentUser) {
                    await eraseUserAccount(currentUser.uuid);
                    localStorage.removeItem("community_hero_uuid");
                    setCurrentUser(null);
                  }
                }}
                onTriggerToast={(title, sub, icon) => {
                  triggerToast(title, sub, icon);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </main>

      {/* 5. Footer and status */}
      <footer className="bg-white border-t border-slate-200/80 py-4 px-4 text-center text-[10px] text-slate-400 font-mono">
        <p>© 2026 Community Hero Inc. Dedicated to cleaner, safer neighborhood streets.</p>
        <p className="mt-1">
          Active Citizen Auth Identity: {currentUser?.uuid || "Guest Mode"} • Location Services Status: Active Green
        </p>
      </footer>

      {/* 6. Modals Mounting */}
      {showReportModal && currentUser && (
        <ReportIssueModal
          onClose={() => setShowReportModal(false)}
          onSuccess={handleReportSuccess}
          currentUserUuid={currentUser.uuid}
          userLocation={userLocation}
        />
      )}

      {showProfileModal && currentUser && (
        <ProfileModal
          currentUser={currentUser}
          onClose={() => setShowProfileModal(false)}
          onUpdate={handleProfileUpdate}
          onLogout={() => {
            localStorage.removeItem("community_hero_uuid");
            setCurrentUser(null);
            setShowProfileModal(false);
            triggerToast(
              "Logged Out Successfully",
              "You are now browsing as an anonymous guest.",
              <CheckCircle className="w-4 h-4 text-amber-500" />
            );
          }}
        />
      )}

      {showManualLocationModal && (
        <ManualLocationModal
          onClose={() => setShowManualLocationModal(false)}
          userUuid={currentUser?.uuid}
          onSetLocation={(lat, lng, ward, city) => {
            setUserLocation({ lat, lng });
            setIsUsingGPS(false);
            if (currentUser) {
              setCurrentUser((prev) => (prev ? { ...prev, ward } : null));
            }
            triggerToast(
              "Location Calibrated Successfully ✓",
              `Active boundary updated to ${ward} (${city}).`,
              <CheckCircle className="w-4 h-4 text-emerald-500 animate-bounce" />
            );
          }}
        />
      )}

      {/* 7. Toast Alerts Notifications HUD */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 35, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[2000] bg-slate-900 text-white rounded-2xl p-4 shadow-xl border border-slate-800 max-w-sm flex items-start gap-3"
          >
            {toast.icon && <div className="shrink-0 mt-0.5">{toast.icon}</div>}
            <div>
              <p className="text-xs font-bold leading-snug">{toast.message}</p>
              {toast.subMessage && (
                <p className="text-[10px] text-slate-400 font-medium font-sans mt-0.5 leading-relaxed">{toast.subMessage}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
