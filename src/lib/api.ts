import { Issue, User, DashboardStats, AISummary } from "../types";

export async function initializeUser(uuid: string, name?: string, avatarColor?: string, lat?: number, lng?: number): Promise<User> {
  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uuid, name, avatarColor, lat, lng })
  });
  if (!res.ok) {
    throw new Error("Failed to initialize citizen profile.");
  }
  const data = await res.json();
  return data.user;
}

export async function fetchLeaderboard(): Promise<User[]> {
  const res = await fetch("/api/users/leaderboard");
  if (!res.ok) {
    throw new Error("Failed to load community leaderboard.");
  }
  const data = await res.json();
  return data.leaderboard;
}

export async function fetchIssues(lat?: number, lng?: number): Promise<Issue[]> {
  const url = lat !== undefined && lng !== undefined
    ? `/api/issues?lat=${lat}&lng=${lng}`
    : "/api/issues";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to load issues registry.");
  }
  const data = await res.json();
  return data.issues;
}

export interface ReportPayload {
  title: string;
  description: string;
  photoData?: string; // Base64
  coordinates: { lat: number; lng: number };
  userUuid: string;
}

export interface ReportResponse {
  issue: Issue;
  gamification: {
    xpEarned: number;
    newTotal: number;
    badgesUnlocked: string[];
  };
  analyzedByAI: boolean;
}

export async function reportIssue(payload: ReportPayload): Promise<ReportResponse> {
  const res = await fetch("/api/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to submit civic report.");
  }
  return await res.json();
}

export interface UpvoteResponse {
  issue: Issue;
  gamification: {
    xpEarned: number;
    newTotal: number;
    badgesUnlocked: string[];
  };
}

export async function upvoteIssue(issueId: string, userUuid: string): Promise<UpvoteResponse> {
  const res = await fetch(`/api/issues/${issueId}/upvote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userUuid })
  });
  if (!res.ok) {
    const errorBody = await res.json();
    throw new Error(errorBody.error || "Failed to upvote/verify issue.");
  }
  return await res.json();
}

export interface StatusUpdateResponse {
  issue: Issue;
  gamificationReporterResult?: {
    reporterUuid: string;
    xpEarned: number;
    newTotal: number;
    badgesUnlocked: string[];
  } | null;
  gamificationOperatorResult?: {
    operatorUuid: string;
    xpEarned: number;
    newTotal: number;
    badgesUnlocked: string[];
  } | null;
  feedback?: string;
}

export async function updateIssueStatus(
  issueId: string,
  status: string,
  operatorUuid?: string,
  resolvedPhoto?: string
): Promise<StatusUpdateResponse> {
  const res = await fetch(`/api/issues/${issueId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, operatorUuid, resolvedPhoto })
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to transition issue status.");
  }
  return await res.json();
}

export interface WardLeaderboardItem {
  wardName: string;
  cleanlinessScore: number;
  totalIssues: number;
  resolvedIssues: number;
  activeIssues: number;
  citizenCount: number;
  totalXP: number;
  checkInCount: number;
  rank: number;
  title: string;
}

export interface CheckInResponse {
  user: User;
  ward: string;
  wasAutoAssigned: boolean;
  xpEarned: number;
  newTotal: number;
  badgesUnlocked: string[];
}

export async function checkInLocation(userUuid: string, lat: number, lng: number): Promise<CheckInResponse> {
  const res = await fetch("/api/check-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userUuid, lat, lng })
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to submit check-in verification.");
  }
  return await res.json();
}

export async function joinWard(userUuid: string, ward: string): Promise<User> {
  const res = await fetch(`/api/users/${userUuid}/join-ward`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ward })
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error || "Failed to join ward.");
  }
  const data = await res.json();
  return data.user;
}

export async function fetchWardLeaderboard(lat?: number, lng?: number, userUuid?: string): Promise<WardLeaderboardItem[]> {
  let url = "/api/wards/leaderboard";
  const params = new URLSearchParams();
  if (lat !== undefined) params.append("lat", lat.toString());
  if (lng !== undefined) params.append("lng", lng.toString());
  if (userUuid) params.append("userUuid", userUuid);
  
  if (params.toString()) {
    url += `?${params.toString()}`;
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Failed to load neighborhood ward leaderboard.");
  }
  const data = await res.json();
  return data.wards;
}

export async function fetchStats(): Promise<{ stats: DashboardStats; resolvedThisWeek: number }> {
  const res = await fetch("/api/stats");
  if (!res.ok) {
    throw new Error("Failed to load dashboard metrics.");
  }
  return await res.json();
}

export async function fetchAISummary(): Promise<{ summary: AISummary; analyzedByAI: boolean }> {
  const res = await fetch("/api/ai-summary");
  if (!res.ok) {
    throw new Error("Failed to generate community synthesis reports.");
  }
  return await res.json();
}

export async function signUpUser(username: string, password: string, name: string, avatarColor?: string, isAdmin?: boolean, lat?: number, lng?: number): Promise<User> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, name, avatarColor, isAdmin, lat, lng })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to sign up.");
  }
  const data = await res.json();
  return data.user;
}

export async function logInUser(username: string, password: string): Promise<User> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to log in.");
  }
  const data = await res.json();
  return data.user;
}

export async function eraseUserAccount(uuid: string): Promise<void> {
  const res = await fetch(`/api/users/${uuid}/erase`, {
    method: "POST",
    headers: { "Content-Type": "application/json" }
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to erase account.");
  }
}
