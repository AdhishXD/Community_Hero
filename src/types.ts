export interface StatusHistoryEntry {
  status: 'Reported' | 'Verified' | 'In Progress' | 'Resolved';
  timestamp: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  resolvedImageUrl?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  category: string;
  severity: number; // 1-5
  department: string;
  authority?: string;
  state?: string;
  ward?: string;
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  suggestedAction: string;
  tags: string[];
  status: 'Reported' | 'Verified' | 'In Progress' | 'Resolved';
  upvotes: number;
  upvotedBy: string[]; // List of user UUIDs
  reportedBy: string; // User UUID
  reportedByName: string;
  timestamp: string;
  statusHistory: StatusHistoryEntry[];
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockedAt: string;
}

export interface User {
  uuid: string;
  name: string;
  avatarColor: string; // Tailwind color class, e.g. "bg-emerald-500"
  xp: number;
  streak: number;
  lastActiveDate?: string;
  badges: Badge[];
  isAdmin?: boolean;
  ward?: string;
  ward_auto_assign?: boolean;
}

export interface AISummary {
  text: string;
  generatedAt: string;
}

export interface DashboardStats {
  totalReported: number;
  totalResolved: number;
  averageResolutionTimeSeconds: number; // in seconds
  categoryWeights: { [key: string]: number };
  severityDist: { [key: number]: number };
  departmentPending: { [key: string]: number };
}
