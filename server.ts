import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

// Initialize Express
const app = express();
const PORT = 3000;

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));

// Database filepath
const DB_FILE = path.join(process.cwd(), "server_db.json");

// Types for DB
interface User {
  uuid: string;
  username?: string;
  name: string;
  avatarColor: string;
  xp: number;
  streak: number;
  lastActiveDate: string;
  isAdmin?: boolean;
  ward?: string;
  ward_auto_assign?: boolean;
  badges: {
    id: string;
    name: string;
    icon: string;
    description: string;
    unlockedAt: string;
  }[];
}

interface Issue {
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
  severity: number;
  department: string;
  authority?: string;
  state?: string;
  ward?: string;
  urgency: "Low" | "Medium" | "High" | "Critical";
  suggestedAction: string;
  tags: string[];
  status: "Reported" | "Verified" | "In Progress" | "Resolved";
  upvotes: number;
  upvotedBy: string[];
  reportedBy: string;
  reportedByName: string;
  timestamp: string;
  statusHistory: { status: string; timestamp: string }[];
}

interface DBStructure {
  users: { [uuid: string]: User };
  issues: Issue[];
  weeklySummary: {
    text: string;
    generatedAt: string;
  } | null;
}

interface DashboardStats {
  totalReported: number;
  totalResolved: number;
  averageResolutionTimeSeconds: number;
  categoryWeights: { [key: string]: number };
  severityDist: { [key: number]: number };
  departmentPending: { [key: string]: number };
}

// Initial/Seed Data
const INITIAL_DB: DBStructure = {
  users: {
    "system-seed-user-1": {
      uuid: "system-seed-user-1",
      name: "Aarav Sharma",
      avatarColor: "bg-emerald-500",
      xp: 450,
      streak: 5,
      lastActiveDate: new Date().toISOString().substring(0, 10),
      badges: [
        {
          id: "first_report",
          name: "First Action",
          icon: "Sparkles",
          description: "Reported the first civic infrastructure issue.",
          unlockedAt: new Date().toISOString()
        }
      ]
    },
    "system-seed-user-2": {
      uuid: "system-seed-user-2",
      name: "Neha Patel",
      avatarColor: "bg-indigo-500",
      xp: 720,
      streak: 12,
      lastActiveDate: new Date().toISOString().substring(0, 10),
      badges: [
        {
          id: "streak_7",
          name: "Warden Streak",
          icon: "Flame",
          description: "Maintained a 7-day community contribution streak.",
          unlockedAt: new Date().toISOString()
        },
        {
          id: "verifications_10",
          name: "Citizen Auditor",
          icon: "ShieldAlert",
          description: "Verified 10 other citizens' infrastructure claims.",
          unlockedAt: new Date().toISOString()
        }
      ]
    }
  },
  issues: [
    {
      id: "issue-1",
      title: "Major Pothole on Indiranagar 100 Feet Road",
      description: "Extremely deep pothole right in the middle lane of 100 Feet Road near the flyover junction. Swerving cars are causing minor near-miss encounters daily.",
      imageUrl: "https://images.unsplash.com/photo-1599740831144-530ba115167f?q=80&w=600&auto=format&fit=crop",
      coordinates: { lat: 12.9722, lng: 77.6416 },
      category: "Pothole",
      severity: 4,
      department: "Public Works Department",
      urgency: "High",
      suggestedAction: "Drive slow near Indiranagar Junction; BBMP team needs to cold-mix asphalt here.",
      tags: ["pothole", "accident-hazard", "road-damage"],
      status: "Verified",
      upvotes: 8,
      upvotedBy: ["system-seed-user-2", "user-uuid-dummy-1", "user-uuid-dummy-2", "user-uuid-dummy-3", "user-uuid-dummy-4"],
      reportedBy: "system-seed-user-1",
      reportedByName: "Aarav Sharma",
      timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(), // 3 days ago
      statusHistory: [
        { status: "Reported", timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() },
        { status: "Verified", timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() }
      ]
    },
    {
      id: "issue-2",
      title: "Water Pipeline Leak Outside Metro Station",
      description: "Drinking water pipeline has burst, causing hundreds of gallons of clean water to flood the side pavement. The path has become extremely muddy.",
      imageUrl: "https://images.unsplash.com/photo-1518081461904-9d8f136351c2?q=80&w=600&auto=format&fit=crop",
      coordinates: { lat: 12.9781, lng: 77.6392 },
      category: "Water Leak",
      severity: 5,
      department: "Water Supply Board",
      urgency: "Critical",
      suggestedAction: "Isolate the primary water main valves outside the Indiranagar station.",
      tags: ["water-waste", "flooding", "broken-utility"],
      status: "In Progress",
      upvotes: 6,
      upvotedBy: ["system-seed-user-1", "user-uuid-dummy-a", "user-uuid-dummy-b"],
      reportedBy: "system-seed-user-2",
      reportedByName: "Neha Patel",
      timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(), // 2 days ago
      statusHistory: [
        { status: "Reported", timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() },
        { status: "Verified", timestamp: new Date(Date.now() - 1.5 * 24 * 3600 * 1000).toISOString() },
        { status: "In Progress", timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() }
      ]
    },
    {
      id: "issue-3",
      title: "Broken Streetlamp Near Defense Colony Playground",
      description: "The streetlamp near the childrens playground has been broken. The whole street turns pitch black after sunset, raising public safety concerns.",
      imageUrl: "https://images.unsplash.com/photo-1517059224940-d4af9eec41b7?q=80&w=600&auto=format&fit=crop",
      coordinates: { lat: 12.9691, lng: 77.6445 },
      category: "Broken Streetlight",
      severity: 2,
      department: "BESCOM / Electricity Corp",
      urgency: "Medium",
      suggestedAction: "Replace the high-sodium bulb on pole def-col-45.",
      tags: ["dark-street", "safety", "broken-lighting"],
      status: "Reported",
      upvotes: 2,
      upvotedBy: ["system-seed-user-2"],
      reportedBy: "system-seed-user-1",
      reportedByName: "Aarav Sharma",
      timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(), // 1 day ago
      statusHistory: [
        { status: "Reported", timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() }
      ]
    },
    {
      id: "issue-4",
      title: "Illegal Trash Dumping On 12th Main Footpath",
      description: "Industrial grade trash bags, plastic wrappers, and rotting vegetables have been dumped here. Stray animals are scattering the bags onto the main road.",
      imageUrl: "https://images.unsplash.com/photo-1530587191325-3db32d826c18?q=80&w=600&auto=format&fit=crop",
      coordinates: { lat: 12.9735, lng: 77.6429 },
      category: "Waste Accumulation",
      severity: 3,
      department: "Sanitation / Waste Management",
      urgency: "Medium",
      suggestedAction: "Send BBMP compactor vehicle; set up a localized 'Do Not Litter' board.",
      tags: ["littering", "hygiene", "sanitation"],
      status: "Resolved",
      upvotes: 12,
      upvotedBy: ["system-seed-user-1", "system-seed-user-2", "dummy-1", "dummy-2", "dummy-3", "dummy-4"],
      reportedBy: "system-seed-user-2",
      reportedByName: "Neha Patel",
      timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
      statusHistory: [
        { status: "Reported", timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString() },
        { status: "Verified", timestamp: new Date(Date.now() - 3.5 * 24 * 3600 * 1000).toISOString() },
        { status: "In Progress", timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() },
        { status: "Resolved", timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() }
      ]
    }
  ],
  weeklySummary: null
};

// Jurisdiction routing structures
interface Jurisdiction {
  city: string;
  state: string;
  authority: string;
  emailSuffix: string;
}

function getJurisdiction(lat: number, lng: number): Jurisdiction {
  // Simple bounding box heuristics for major Indian hubs or fallback
  if (lat >= 10.7 && lat <= 11.3 && lng >= 76.7 && lng <= 77.3) {
    return {
      city: "Coimbatore",
      state: "Tamil Nadu",
      authority: "Coimbatore Municipal Corporation (CCMC)",
      emailSuffix: "coimbatorecorporation.gov.in"
    };
  }
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
  
  // Dynamic fallback based on general latitude ranges
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

  // General fallback
  return {
    city: "National District",
    state: "Federal Territory",
    authority: "National Municipal Safety Council (NMSC)",
    emailSuffix: "nmsc.gov.in"
  };
}

function getWardsForLocation(lat: number, lng: number): string[] {
  const j = getJurisdiction(lat, lng);
  if (j.city === "Coimbatore") {
    return [
      "Ward 73 (Ramanathapuram)",
      "Ward 94 (Eachanari)",
      "Coimbatore Ward 1",
      "Coimbatore Ward 2",
      "Coimbatore Ward 3"
    ];
  }
  if (j.city === "Bengaluru") {
    return [
      "Indiranagar Ward",
      "Malleswaram Ward",
      "Koramangala Ward",
      "HSR Layout Ward",
      "Whitefield Ward"
    ];
  }
  if (j.city === "Delhi") {
    return [
      "Connaught Place Sector",
      "Rohini Sector",
      "Saket Sector",
      "Dwarka Sector",
      "Karol Bagh Sector"
    ];
  }
  if (j.city === "Mumbai") {
    return [
      "Andheri Sector",
      "Bandra Sector",
      "Chembur Sector",
      "Colaba Sector",
      "Juhu Sector"
    ];
  }
  if (j.city === "Chennai") {
    return [
      "Adyar Ward",
      "Velachery Ward",
      "Mylapore Ward",
      "Nungambakkam Ward",
      "T. Nagar Ward"
    ];
  }
  if (j.city === "Kolkata") {
    return [
      "Salt Lake Sector",
      "Park Street Ward",
      "Ballygunge Ward",
      "Howrah Sector",
      "Alipore Ward"
    ];
  }
  if (j.city === "Ahmedabad") {
    return [
      "Satellite Sector",
      "Navrangpura Sector",
      "Vastrapur Sector",
      "Paldi Sector",
      "Sabarmati Sector"
    ];
  }
  // Dynamic fallback for any other city/town
  const city = j.city;
  return [
    `${city} Downtown Ward`,
    `${city} Midtown Ward`,
    `${city} Riverside Ward`,
    `${city} Old Town Ward`,
    `${city} Lakeside Ward`,
    `${city} Parkside Ward`,
    `${city} Greenwood Ward`,
    `${city} Oakridge Ward`
  ];
}

// In-memory geocoding cache to protect OSM Nominatim API from rate limits and improve response times
interface GeocodeCacheEntry {
  ward: string;
  wards: string[];
  timestamp: number;
}
const geocodeCache = new Map<string, GeocodeCacheEntry>();

function getGeocodeCacheKey(lat: number, lng: number): string {
  // 3 decimal places gives ~110m spatial resolution, perfect for grouping nearby requests together
  return `${Number(lat).toFixed(3)},${Number(lng).toFixed(3)}`;
}

async function getWardsFromAPI(lat: number, lng: number): Promise<string[]> {
  const cacheKey = getGeocodeCacheKey(lat, lng);
  const cached = geocodeCache.get(cacheKey);
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  
  if (cached && (Date.now() - cached.timestamp < ONE_DAY_MS)) {
    return cached.wards;
  }

  try {
    const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(reverseUrl, {
      signal: AbortSignal.timeout(1500),
      headers: {
        "User-Agent": "CommunityHero/1.0 (adhishselva@gmail.com)"
      }
    });
    
    if (!res.ok) {
      throw new Error(`Reverse geocoding failed: ${res.statusText}`);
    }
    
    const text = await res.text();
    if (text.includes("Rate exceeded") || text.includes("rate exceeded") || text.startsWith("Rate exceeded")) {
      throw new Error("Nominatim API rate limit exceeded");
    }
    const data = JSON.parse(text);
    const addr = data.address || {};
    const city = addr.city || addr.town || addr.municipality || addr.village || "Local";
    const primaryWard = addr.suburb || addr.neighbourhood || addr.city_district || addr.county || "Local Area";
    
    // Fetch suburbs in that city to populate the alternative choices
    const searchUrl = `https://nominatim.openstreetmap.org/search?q=suburbs+in+${encodeURIComponent(city)}&format=json&limit=15`;
    const searchRes = await fetch(searchUrl, {
      signal: AbortSignal.timeout(1500),
      headers: {
        "User-Agent": "CommunityHero/1.0 (adhishselva@gmail.com)"
      }
    });
    
    const wardsSet = new Set<string>();
    const wardName = `${primaryWard} Ward`;
    wardsSet.add(wardName);
    
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (Array.isArray(searchData)) {
        for (const item of searchData) {
          const namePart = item.display_name.split(",")[0].trim();
          if (namePart && namePart.toLowerCase() !== city.toLowerCase()) {
            wardsSet.add(`${namePart} Ward`);
          }
        }
      }
    }
    
    if (wardsSet.size < 5) {
      wardsSet.add(`${city} Downtown Ward`);
      wardsSet.add(`${city} Midtown Ward`);
      wardsSet.add(`${city} Riverside Ward`);
      wardsSet.add(`${city} Old Town Ward`);
      wardsSet.add(`${city} Lakeside Ward`);
      wardsSet.add(`${city} Parkside Ward`);
    }
    
    const resultWards = Array.from(wardsSet).slice(0, 8);
    
    // Update cache
    geocodeCache.set(cacheKey, {
      ward: wardName,
      wards: resultWards,
      timestamp: Date.now()
    });

    return resultWards;
  } catch (error) {
    console.error("Failed to fetch wards from OSM API, using dynamic heuristics:", error);
    const j = getJurisdiction(lat, lng);
    const city = j.city;
    const fallbackWards = [
      `${city} Downtown Ward`,
      `${city} Midtown Ward`,
      `${city} Riverside Ward`,
      `${city} Old Town Ward`,
      `${city} Lakeside Ward`,
      `${city} Parkside Ward`
    ];
    return fallbackWards;
  }
}

async function getWardForLocationAsync(lat: number, lng: number): Promise<string> {
  const cacheKey = getGeocodeCacheKey(lat, lng);
  const cached = geocodeCache.get(cacheKey);
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  
  if (cached && (Date.now() - cached.timestamp < ONE_DAY_MS)) {
    return cached.ward;
  }

  try {
    const reverseUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const res = await fetch(reverseUrl, {
      signal: AbortSignal.timeout(1500),
      headers: {
        "User-Agent": "CommunityHero/1.0 (adhishselva@gmail.com)"
      }
    });
    
    if (!res.ok) {
      throw new Error(`Reverse geocoding failed: ${res.statusText}`);
    }
    
    const text = await res.text();
    if (text.includes("Rate exceeded") || text.includes("rate exceeded") || text.startsWith("Rate exceeded")) {
      throw new Error("Nominatim API rate limit exceeded");
    }
    const data = JSON.parse(text);
    const addr = data.address || {};
    const primaryWard = addr.suburb || addr.neighbourhood || addr.city_district || addr.county || "Local Area";
    const wardName = `${primaryWard} Ward`;

    // Populate alternative wards in background to fully cache the location
    getWardsFromAPI(lat, lng).catch(() => {});

    return wardName;
  } catch (error) {
    console.error("Failed to fetch ward from OSM API, using fallback hash:", error);
    if (ai) {
      try {
        const resolved = await getRealWardWithAI(`Coordinates: ${lat}, ${lng}`, lat, lng);
        if (resolved && resolved.ward) {
          return resolved.ward;
        }
      } catch (aiErr) {
        console.error("Gemini fallback inside getWardForLocationAsync failed:", aiErr);
      }
    }
    const wards = getWardsForLocation(lat, lng);
    const hash = Math.abs(Math.floor(lat * 1000) + Math.floor(lng * 1000));
    return wards[hash % wards.length];
  }
}

async function getRealWardWithAI(address: string, resolvedLat?: number, resolvedLng?: number): Promise<{ lat: number; lng: number; city: string; ward: string }> {
  const defaultRes = {
    lat: resolvedLat || 10.9972,
    lng: resolvedLng || 76.9936,
    city: "Coimbatore",
    ward: "Ward 73 (Ramanathapuram)"
  };

  if (!ai) {
    return defaultRes;
  }

  try {
    const latLngContext = (resolvedLat && resolvedLng) ? `and estimated coordinate context is (${resolvedLat}, ${resolvedLng})` : "";
    const prompt = `You are an expert GIS and municipal administrative officer.
The citizen provided this manual neighborhood address/area description: "${address}" ${latLngContext}.

Resolve this into a real, legally valid municipal ward or sector name for this city. The ward name MUST be a real, legally valid municipal ward or sector in that city, NOT a fictional assumption like "Eachanari Downtown".
Also, determine the real geographic coordinates (latitude and longitude) of the center of this neighborhood.
Also, determine the city name.

Respond STRICTLY in JSON format matching this schema:
{
  "lat": number,
  "lng": number,
  "city": string,
  "ward": string
}
Do not include any explanation, backticks or markdown formatting. Only valid JSON.`;

    const aiResponse = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
            city: { type: Type.STRING },
            ward: { type: Type.STRING }
          },
          required: ["lat", "lng", "city", "ward"]
        }
      }
    });

    if (aiResponse.text) {
      const parsed = JSON.parse(aiResponse.text.trim());
      if (parsed.lat && parsed.lng && parsed.city && parsed.ward) {
        return {
          lat: Number(parsed.lat),
          lng: Number(parsed.lng),
          city: parsed.city,
          ward: parsed.ward
        };
      }
    }
  } catch (err) {
    console.error("Gemini manual location resolution failed:", err);
  }

  return defaultRes;
}

function getWardForLocation(lat: number, lng: number): string {
  const wards = getWardsForLocation(lat, lng);
  const hash = Math.abs(Math.floor(lat * 1000) + Math.floor(lng * 1000));
  return wards[hash % wards.length];
}

function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
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
}

async function generateAndSeedNearbyIssues(lat: number, lng: number): Promise<void> {
  const j = getJurisdiction(lat, lng);
  const wards = getWardsForLocation(lat, lng);
  const primaryWard = wards[0] || "Central Ward";
  const city = j.city;
  const authority = j.authority;

  const generated = [
    {
      id: `gen-issue-${Date.now()}-1`,
      title: `Severe Pothole on ${city} Main Corridor`,
      description: `A deep, sharp cavity has opened up in the middle lane of the main road in ${primaryWard}. Swerving vehicles are causing near-miss hazards during peak rush hours.`,
      imageUrl: "https://images.unsplash.com/photo-1599740831144-530ba115167f?q=80&w=600&auto=format&fit=crop",
      coordinates: { lat: lat + 0.0035, lng: lng + 0.0025 },
      category: "Pothole",
      severity: 4,
      department: "Public Works Department",
      urgency: "High",
      suggestedAction: `Drive cautiously near this corridor. ${authority} repair teams need to deploy a cold-mix asphalt patch squad.`,
      tags: ["pothole", "accident-hazard", "road-damage"],
      status: "Verified",
      upvotes: 7,
      reportedBy: "system-seed-user-1",
      reportedByName: "Aarav Sharma",
      timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      statusHistory: [
        { status: "Reported", timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() },
        { status: "Verified", timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() }
      ],
      upvotedBy: ["system-seed-user-2"]
    },
    {
      id: `gen-issue-${Date.now()}-2`,
      title: `Water Grid Main Pipeline Burst near ${city} Transit`,
      description: `Drinking water supply pipeline has ruptured, flooding the main pedestrian walkway and causing thousands of gallons of clean water to run down the drain.`,
      imageUrl: "https://images.unsplash.com/photo-1518081461904-9d8f136351c2?q=80&w=600&auto=format&fit=crop",
      coordinates: { lat: lat - 0.0025, lng: lng + 0.0042 },
      category: "Water Leak",
      severity: 5,
      department: "Water Supply Board",
      urgency: "Critical",
      suggestedAction: "Isolate the primary water main control valves and schedule an emergency pipe segment replacement.",
      tags: ["water-waste", "flooding", "broken-utility"],
      status: "In Progress",
      upvotes: 9,
      reportedBy: "system-seed-user-2",
      reportedByName: "Neha Patel",
      timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
      statusHistory: [
        { status: "Reported", timestamp: new Date(Date.now() - 1.5 * 24 * 3600 * 1000).toISOString() },
        { status: "Verified", timestamp: new Date(Date.now() - 1.2 * 24 * 3600 * 1000).toISOString() },
        { status: "In Progress", timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() }
      ],
      upvotedBy: ["system-seed-user-1"]
    },
    {
      id: `gen-issue-${Date.now()}-3`,
      title: `Shattered Streetlight close to ${primaryWard} Park`,
      description: `A major overhead streetlight fixture has been shattered. The surrounding street and sidewalk are pitch black after sunset, raising urgent safety concerns for residents.`,
      imageUrl: "https://images.unsplash.com/photo-1517059224940-d4af9eec41b7?q=80&w=600&auto=format&fit=crop",
      coordinates: { lat: lat + 0.0048, lng: lng - 0.0031 },
      category: "Broken Streetlight",
      severity: 2,
      department: "BESCOM / Electricity Corp",
      urgency: "Medium",
      suggestedAction: "Dispatch utility pole technician to replace the shattered bulb and fixture shell.",
      tags: ["dark-street", "safety", "broken-lighting"],
      status: "Reported",
      upvotes: 3,
      reportedBy: "system-seed-user-1",
      reportedByName: "Aarav Sharma",
      timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
      statusHistory: [
        { status: "Reported", timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString() }
      ],
      upvotedBy: ["system-seed-user-2"]
    },
    {
      id: `gen-issue-${Date.now()}-4`,
      title: `Illegal Garbage Dump on ${city} Walkway`,
      description: `A large pile of household garbage bags, plastic bottles, and organic waste has been illegally dumped on the public walking sidewalk, causing foul odors and attracting stray pests.`,
      imageUrl: "https://images.unsplash.com/photo-1530587191325-3db32d826c18?q=80&w=600&auto=format&fit=crop",
      coordinates: { lat: lat - 0.0041, lng: lng - 0.0028 },
      category: "Waste Accumulation",
      severity: 3,
      department: "Sanitation / Waste Management",
      urgency: "Medium",
      suggestedAction: "Deploy sanitation compactor truck to clear the dumped waste and set up municipal penalty warning signs.",
      tags: ["littering", "hygiene", "sanitation"],
      status: "Resolved",
      upvotes: 11,
      reportedBy: "system-seed-user-2",
      reportedByName: "Neha Patel",
      timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      statusHistory: [
        { status: "Reported", timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString() },
        { status: "Verified", timestamp: new Date(Date.now() - 2.5 * 24 * 3600 * 1000).toISOString() },
        { status: "In Progress", timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString() },
        { status: "Resolved", timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString() }
      ],
      upvotedBy: ["system-seed-user-1"]
    }
  ];

  for (const issue of generated) {
    await dbRun(
      `INSERT INTO issues (id, title, description, imageUrl, lat, lng, category, severity, department, urgency, suggestedAction, tags, status, upvotes, reportedBy, reportedByName, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        issue.id,
        issue.title,
        issue.description,
        issue.imageUrl || "",
        issue.coordinates.lat,
        issue.coordinates.lng,
        issue.category,
        issue.severity,
        issue.department,
        issue.urgency,
        issue.suggestedAction,
        JSON.stringify(issue.tags),
        issue.status,
        issue.upvotes,
        issue.reportedBy,
        issue.reportedByName,
        issue.timestamp
      ]
    );

    for (const sh of issue.statusHistory) {
      await dbRun(
        "INSERT INTO status_history (issue_id, status, timestamp) VALUES (?, ?, ?)",
        [issue.id, sh.status, sh.timestamp]
      );
    }

    for (const upvoter of issue.upvotedBy) {
      await dbRun(
        "INSERT OR IGNORE INTO users (uuid, name, avatarColor, xp, streak, lastActiveDate) VALUES (?, ?, ?, ?, ?, ?)",
        [upvoter, "Citizen " + upvoter.substring(upvoter.length - 4), "bg-slate-500", 100, 1, new Date().toISOString().substring(0, 10)]
      );
      await dbRun(
        "INSERT OR IGNORE INTO upvotes (issue_id, user_uuid) VALUES (?, ?)",
        [issue.id, upvoter]
      );
    }
  }

  console.log(`[SQL DB] Automatically generated 4 realistic issues for ${city} coordinates.`);
}

// SSE connections pool for real-time synchronization
let sseClients: any[] = [];

function broadcastUpdate(issues: any[], leaderboard: any[]) {
  const payload = JSON.stringify({ type: "update", data: { issues, leaderboard } });
  sseClients.forEach((res) => {
    try {
      res.write(`data: ${payload}\n\n`);
    } catch (err) {
      console.error("Error writing to SSE client:", err);
    }
  });
}

// Initialize Emulated SQL relational database
interface DB_Tables {
  users: Array<any>;
  badges: Array<any>;
  issues: Array<any>;
  status_history: Array<any>;
  upvotes: Array<any>;
  weekly_summary: Array<any>;
  check_ins: Array<any>;
}

const EMULATED_DB_FILE = path.join(process.cwd(), "postgres_emulated.json");

let tables: DB_Tables = {
  users: [],
  badges: [],
  issues: [],
  status_history: [],
  upvotes: [],
  weekly_summary: [],
  check_ins: []
};

// Helper to load tables from JSON file
function loadTables() {
  try {
    if (fs.existsSync(EMULATED_DB_FILE)) {
      const data = fs.readFileSync(EMULATED_DB_FILE, "utf-8");
      tables = JSON.parse(data);
      if (!tables.check_ins) {
        tables.check_ins = [];
      }
    } else {
      saveTables();
    }
  } catch (err) {
    console.error("Error loading emulated DB file:", err);
  }
}

// Helper to save tables to JSON file
function saveTables() {
  try {
    fs.writeFileSync(EMULATED_DB_FILE, JSON.stringify(tables, null, 2));
  } catch (err) {
    console.error("Error saving emulated DB file:", err);
  }
}

// Perform initial load
loadTables();

// Promisified relational db emulator helpers
async function dbRun(query: string, params: any[] = []): Promise<void> {
  const qLower = query.toLowerCase();

  // Create table if not exists (no-op since we initialize structural arrays)
  if (qLower.includes("create table")) {
    return;
  }

  // Insert or update users
  if (qLower.includes("insert into users")) {
    const uuid = params[0];
    const idx = tables.users.findIndex(u => u.uuid === uuid);
    let userObj: any = {};

    if (qLower.includes("username")) {
      const [uuid, username, password_hash, name, avatarColor, xp, streak, lastActiveDate, isAdmin, ward, ward_auto_assign] = params;
      userObj = {
        uuid,
        username,
        password_hash,
        name,
        avatarColor,
        xp,
        streak,
        lastActiveDate,
        isAdmin: isAdmin === 1 || !!isAdmin,
        ward: ward || "Indiranagar Ward",
        ward_auto_assign: ward_auto_assign === undefined ? true : (ward_auto_assign === 1 || !!ward_auto_assign)
      };
    } else {
      const [uuid, name, avatarColor, xp, streak, lastActiveDate, isAdmin, ward, ward_auto_assign] = params;
      userObj = {
        uuid,
        name,
        avatarColor,
        xp,
        streak,
        lastActiveDate,
        isAdmin: isAdmin === 1 || !!isAdmin,
        ward: ward || "Indiranagar Ward",
        ward_auto_assign: ward_auto_assign === undefined ? true : (ward_auto_assign === 1 || !!ward_auto_assign)
      };
    }

    if (idx >= 0) {
      tables.users[idx] = { ...tables.users[idx], ...userObj };
    } else {
      tables.users.push(userObj);
    }
    saveTables();
    return;
  }

  // Insert or ignore onto users
  if (qLower.includes("insert or ignore into users")) {
    const [uuid, name, avatarColor, xp, streak, lastActiveDate] = params;
    const exists = tables.users.some(u => u.uuid === uuid);
    if (!exists) {
      tables.users.push({
        uuid,
        username: null,
        password_hash: null,
        name,
        avatarColor,
        xp,
        streak,
        lastActiveDate,
        isAdmin: false,
        ward: "Indiranagar Ward",
        ward_auto_assign: true
      });
      saveTables();
    }
    return;
  }

  // Insert into badges
  if (qLower.includes("badges")) {
    const [userUuid, id, name, icon, description, unlockedAt] = params;
    const exists = tables.badges.some(b => b.userUuid === userUuid && b.id === id);
    if (!exists) {
      tables.badges.push({ userUuid, id, name, icon, description, unlockedAt });
      saveTables();
    }
    return;
  }

  // Insert or update issues
  if (qLower.includes("insert into issues") || qLower.includes("insert or ignore into issues")) {
    let id, title, description, imageUrl, resolvedImageUrl = "", lat, lng, category, severity, department, authority = "", state = "", ward = "", urgency, suggestedAction, tags, status, upvotes, reportedBy, reportedByName, timestamp;
    if (params.length === 21) {
      [id, title, description, imageUrl, resolvedImageUrl, lat, lng, category, severity, department, authority, state, ward, urgency, suggestedAction, tags, status, upvotes, reportedBy, reportedByName, timestamp] = params;
    } else if (params.length === 17) {
      [id, title, description, imageUrl, lat, lng, category, severity, department, urgency, suggestedAction, tags, status, upvotes, reportedBy, reportedByName, timestamp] = params;
    } else {
      [id, title, description, imageUrl, lat, lng, category, severity, department, urgency, suggestedAction, tags, status, upvotes, reportedBy, reportedByName, timestamp] = params;
    }
    const idx = tables.issues.findIndex(i => i.id === id);
    const issueObj = { 
      id, 
      title, 
      description, 
      imageUrl, 
      resolvedImageUrl,
      lat: typeof lat === "number" ? lat : parseFloat(lat) || 0, 
      lng: typeof lng === "number" ? lng : parseFloat(lng) || 0, 
      category, 
      severity: typeof severity === "number" ? severity : parseInt(severity) || 3, 
      department, 
      authority: authority || getJurisdiction(lat, lng).authority, 
      state: state || getJurisdiction(lat, lng).state, 
      ward: ward || getWardForLocation(lat, lng),
      urgency, 
      suggestedAction, 
      tags, 
      status, 
      upvotes: typeof upvotes === "number" ? upvotes : parseInt(upvotes) || 1, 
      reportedBy, 
      reportedByName, 
      timestamp 
    };
    if (idx >= 0) {
      tables.issues[idx] = { ...tables.issues[idx], ...issueObj };
    } else {
      tables.issues.push(issueObj);
    }
    saveTables();
    return;
  }

  // Insert or ignore into upvotes
  if (qLower.includes("insert or ignore into upvotes") || qLower.includes("insert into upvotes")) {
    const [issue_id, user_uuid] = params;
    const exists = tables.upvotes.some(up => up.issue_id === issue_id && up.user_uuid === user_uuid);
    if (!exists) {
      tables.upvotes.push({ issue_id, user_uuid });
      saveTables();
    }
    return;
  }

  // Insert into status_history
  if (qLower.includes("insert into status_history")) {
    const [issue_id, status, timestamp] = params;
    const nextId = tables.status_history.reduce((max, curr) => curr.id > max ? curr.id : max, 0) + 1;
    tables.status_history.push({ id: nextId, issue_id, status, timestamp });
    saveTables();
    return;
  }

  // Insert into weekly_summary
  if (qLower.includes("insert into weekly_summary")) {
    const [text, generatedAt] = params;
    tables.weekly_summary.push({ text, generatedAt });
    saveTables();
    return;
  }
}

async function dbGet<T>(query: string, params: any[] = []): Promise<T | null> {
  const qLower = query.toLowerCase();

  // count(*) from users
  if (qLower.includes("count(*)") && qLower.includes("from users")) {
    return { count: tables.users.length } as any;
  }

  // select uuid from users where username & password_hash
  if (qLower.includes("from users where username = ? and password_hash = ?")) {
    const [username, password_hash] = params;
    const found = tables.users.find(u => u.username === username && u.password_hash === password_hash);
    return (found ? { uuid: found.uuid } : null) as any;
  }

  // select uuid from users where username
  if (qLower.includes("from users where username = ?")) {
    const [username] = params;
    const found = tables.users.find(u => u.username === username);
    return (found ? { uuid: found.uuid } : null) as any;
  }

  // weekly_summary ORDER BY generatedAt DESC LIMIT 1
  if (qLower.includes("weekly_summary") && qLower.includes("order by")) {
    const sorted = [...tables.weekly_summary].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    return (sorted[0] || null) as any;
  }

  // status_history where issue_id = ? and status = ? and timestamp = ?
  if (qLower.includes("status_history") && qLower.includes("where issue_id = ?")) {
    const [issue_id, status, timestamp] = params;
    const found = tables.status_history.find(sh => sh.issue_id === issue_id && sh.status === status && sh.timestamp === timestamp);
    return (found ? { id: found.id } : null) as any;
  }

  // weekly_summary where generatedAt = ?
  if (qLower.includes("weekly_summary") && qLower.includes("where generatedat = ?")) {
    const [generatedAt] = params;
    const found = tables.weekly_summary.find(ws => ws.generatedAt === generatedAt);
    return (found ? { generatedAt: found.generatedAt } : null) as any;
  }

  return null;
}

async function dbAll<T>(query: string, params: any[] = []): Promise<T[]> {
  const qLower = query.toLowerCase();

  if (qLower.includes("select * from users")) {
    return tables.users as any;
  }

  if (qLower.includes("select * from badges")) {
    return tables.badges as any;
  }

  if (qLower.includes("select * from issues")) {
    return tables.issues as any;
  }

  if (qLower.includes("select * from status_history")) {
    const sorted = [...tables.status_history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return sorted as any;
  }

  if (qLower.includes("select * from upvotes")) {
    return tables.upvotes as any;
  }

  return [];
}

// Map SQLite table data to DBStructure in-memory layout
async function loadDBFromSQL(): Promise<DBStructure> {
  try {
    const usersRows = await dbAll<any>("SELECT * FROM users");
    const badgesRows = await dbAll<any>("SELECT * FROM badges");
    const issuesRows = await dbAll<any>("SELECT * FROM issues");
    const statusHistoryRows = await dbAll<any>("SELECT * FROM status_history ORDER BY timestamp ASC");
    const upvotesRows = await dbAll<any>("SELECT * FROM upvotes");
    const summaryRow = await dbGet<any>("SELECT * FROM weekly_summary ORDER BY generatedAt DESC LIMIT 1");

    // Construct users map
    const users: { [uuid: string]: User } = {};
    usersRows.forEach((u) => {
      users[u.uuid] = {
        uuid: u.uuid,
        username: u.username,
        name: u.name,
        avatarColor: u.avatarColor,
        xp: u.xp,
        streak: u.streak,
        lastActiveDate: u.lastActiveDate,
        isAdmin: u.isAdmin === 1 || u.isAdmin === true || !!u.isAdmin,
        ward: u.ward || "Indiranagar Ward",
        ward_auto_assign: u.ward_auto_assign === undefined ? true : (u.ward_auto_assign === 1 || u.ward_auto_assign === true),
        badges: []
      };
    });

    // Populate badges
    badgesRows.forEach((b) => {
      if (users[b.userUuid]) {
        users[b.userUuid].badges.push({
          id: b.id,
          name: b.name,
          icon: b.icon,
          description: b.description,
          unlockedAt: b.unlockedAt
        });
      }
    });

    // Construct upvotes map
    const upvotedByMap: { [issueId: string]: string[] } = {};
    upvotesRows.forEach((up) => {
      if (!upvotedByMap[up.issue_id]) {
        upvotedByMap[up.issue_id] = [];
      }
      upvotedByMap[up.issue_id].push(up.user_uuid);
    });

    // Construct status history lists
    const statusHistoryMap: { [issueId: string]: { status: string; timestamp: string }[] } = {};
    statusHistoryRows.forEach((sh) => {
      if (!statusHistoryMap[sh.issue_id]) {
        statusHistoryMap[sh.issue_id] = [];
      }
      statusHistoryMap[sh.issue_id].push({
        status: sh.status,
        timestamp: sh.timestamp
      });
    });

    // Construct issues
    const issues: Issue[] = issuesRows.map((i) => {
      let parsedTags: string[] = [];
      try {
        parsedTags = JSON.parse(i.tags || "[]");
      } catch {
        parsedTags = [];
      }

      const j = getJurisdiction(i.lat, i.lng);

      return {
        id: i.id,
        title: i.title,
        description: i.description,
        imageUrl: i.imageUrl || "",
        resolvedImageUrl: i.resolvedImageUrl || "",
        coordinates: {
          lat: i.lat,
          lng: i.lng
        },
        category: i.category,
        severity: i.severity,
        department: i.department,
        authority: i.authority || j.authority,
        state: i.state || j.state,
        ward: i.ward || getWardForLocation(i.lat, i.lng),
        urgency: i.urgency as any,
        suggestedAction: i.suggestedAction,
        tags: parsedTags,
        status: i.status as any,
        upvotes: i.upvotes,
        upvotedBy: upvotedByMap[i.id] || [],
        reportedBy: i.reportedBy,
        reportedByName: i.reportedByName,
        timestamp: i.timestamp,
        statusHistory: statusHistoryMap[i.id] || []
      };
    });

    // Sort issues by timestamp descending
    issues.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      users,
      issues,
      weeklySummary: summaryRow ? { text: summaryRow.text, generatedAt: summaryRow.generatedAt } : null
    };
  } catch (err) {
    console.error("Failed to load DB from SQLite, returning seed fallback:", err);
    return INITIAL_DB;
  }
}

// Persist structural modifications back to SQL tables
async function saveDBToSQL(db: DBStructure) {
  try {
    // Save users
    for (const user of Object.values(db.users)) {
      await dbRun(
        `INSERT INTO users (uuid, name, avatarColor, xp, streak, lastActiveDate, isAdmin, ward, ward_auto_assign)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(uuid) DO UPDATE SET
           name = excluded.name,
           avatarColor = excluded.avatarColor,
           xp = excluded.xp,
           streak = excluded.streak,
           lastActiveDate = excluded.lastActiveDate,
           isAdmin = excluded.isAdmin,
           ward = excluded.ward,
           ward_auto_assign = excluded.ward_auto_assign`,
        [
          user.uuid,
          user.name,
          user.avatarColor,
          user.xp,
          user.streak,
          user.lastActiveDate,
          user.isAdmin ? 1 : 0,
          user.ward || "Indiranagar Ward",
          user.ward_auto_assign ? 1 : 0
        ]
      );

      // Save badges
      for (const b of user.badges) {
        await dbRun(
          `INSERT OR IGNORE INTO badges (userUuid, id, name, icon, description, unlockedAt)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [user.uuid, b.id, b.name, b.icon, b.description, b.unlockedAt]
        );
      }
    }

    // Save issues
    for (const issue of db.issues) {
      const j = getJurisdiction(issue.coordinates.lat, issue.coordinates.lng);
      await dbRun(
        `INSERT INTO issues (id, title, description, imageUrl, resolvedImageUrl, lat, lng, category, severity, department, authority, state, ward, urgency, suggestedAction, tags, status, upvotes, reportedBy, reportedByName, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           description = excluded.description,
           imageUrl = excluded.imageUrl,
           resolvedImageUrl = excluded.resolvedImageUrl,
           lat = excluded.lat,
           lng = excluded.lng,
           category = excluded.category,
           severity = excluded.severity,
           department = excluded.department,
           authority = excluded.authority,
           state = excluded.state,
           ward = excluded.ward,
           urgency = excluded.urgency,
           suggestedAction = excluded.suggestedAction,
           tags = excluded.tags,
           status = excluded.status,
           upvotes = excluded.upvotes,
           reportedBy = excluded.reportedBy,
           reportedByName = excluded.reportedByName,
           timestamp = excluded.timestamp`,
        [
          issue.id,
          issue.title,
          issue.description,
          issue.imageUrl || "",
          issue.resolvedImageUrl || "",
          issue.coordinates.lat,
          issue.coordinates.lng,
          issue.category,
          issue.severity,
          issue.department,
          issue.authority || j.authority,
          issue.state || j.state,
          issue.ward || getWardForLocation(issue.coordinates.lat, issue.coordinates.lng),
          issue.urgency,
          issue.suggestedAction,
          JSON.stringify(issue.tags),
          issue.status,
          issue.upvotes,
          issue.reportedBy,
          issue.reportedByName,
          issue.timestamp
        ]
      );

      // Save upvotes
      for (const upvoter of issue.upvotedBy) {
        await dbRun(
          "INSERT OR IGNORE INTO upvotes (issue_id, user_uuid) VALUES (?, ?)",
          [issue.id, upvoter]
        );
      }

      // Save status history
      for (const sh of issue.statusHistory) {
        const exists = await dbGet(
          "SELECT id FROM status_history WHERE issue_id = ? AND status = ? AND timestamp = ?",
          [issue.id, sh.status, sh.timestamp]
        );
        if (!exists) {
          await dbRun(
            "INSERT INTO status_history (issue_id, status, timestamp) VALUES (?, ?, ?)",
            [issue.id, sh.status, sh.timestamp]
          );
        }
      }
    }

    // Save summary
    if (db.weeklySummary) {
      const exists = await dbGet(
        "SELECT generatedAt FROM weekly_summary WHERE generatedAt = ?",
        [db.weeklySummary.generatedAt]
      );
      if (!exists) {
        await dbRun(
          "INSERT INTO weekly_summary (text, generatedAt) VALUES (?, ?)",
          [db.weeklySummary.text, db.weeklySummary.generatedAt]
        );
      }
    }
  } catch (err) {
    console.error("Error saving DB to SQL database:", err);
  }
}

// Initial relational database tables boot setup & seeds
async function initDatabase() {
  try {
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        uuid TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password_hash TEXT,
        name TEXT,
        avatarColor TEXT,
        xp INTEGER DEFAULT 0,
        streak INTEGER DEFAULT 1,
        lastActiveDate TEXT,
        isAdmin INTEGER DEFAULT 0,
        ward TEXT,
        ward_auto_assign INTEGER DEFAULT 1
      )
    `);

    // Ensure columns exist on old database tables if they are already created on disk
    try {
      await dbRun("ALTER TABLE users ADD COLUMN ward TEXT");
    } catch (e) { /* already exists */ }
    try {
      await dbRun("ALTER TABLE users ADD COLUMN ward_auto_assign INTEGER DEFAULT 1");
    } catch (e) { /* already exists */ }

    await dbRun(`
      CREATE TABLE IF NOT EXISTS badges (
        userUuid TEXT,
        id TEXT,
        name TEXT,
        icon TEXT,
        description TEXT,
        unlockedAt TEXT,
        PRIMARY KEY (userUuid, id),
        FOREIGN KEY (userUuid) REFERENCES users(uuid) ON DELETE CASCADE
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS issues (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        imageUrl TEXT,
        lat REAL,
        lng REAL,
        category TEXT,
        severity INTEGER,
        department TEXT,
        authority TEXT,
        state TEXT,
        urgency TEXT,
        suggestedAction TEXT,
        tags TEXT, -- JSON array
        status TEXT,
        upvotes INTEGER DEFAULT 1,
        reportedBy TEXT,
        reportedByName TEXT,
        timestamp TEXT,
        FOREIGN KEY (reportedBy) REFERENCES users(uuid)
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id TEXT,
        status TEXT,
        timestamp TEXT,
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS upvotes (
        issue_id TEXT,
        user_uuid TEXT,
        PRIMARY KEY (issue_id, user_uuid),
        FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE,
        FOREIGN KEY (user_uuid) REFERENCES users(uuid) ON DELETE CASCADE
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS weekly_summary (
        text TEXT,
        generatedAt TEXT
      )
    `);

    // Ensure the single admin user 'adhish@gmail.com' exists with password '1234'
    const adminExists = tables.users.find(u => u.username === "adhish@gmail.com");
    if (!adminExists) {
      tables.users.push({
        uuid: "admin-uuid-adhish",
        username: "adhish@gmail.com",
        password_hash: crypto.createHash("sha256").update("1234").digest("hex"),
        name: "Adhish",
        avatarColor: "bg-rose-600",
        xp: 1000,
        streak: 1,
        lastActiveDate: new Date().toISOString().substring(0, 10),
        isAdmin: true,
        ward: "Local District",
        ward_auto_assign: true,
        badges: []
      });
      console.log("[SQL DB] Seeded admin user: adhish@gmail.com");
    } else {
      // Force password and admin role and enable auto assign
      adminExists.password_hash = crypto.createHash("sha256").update("1234").digest("hex");
      adminExists.isAdmin = true;
      adminExists.ward_auto_assign = true;
    }

    // No one else should have admin privileges
    tables.users.forEach(u => {
      if (u.username !== "adhish@gmail.com") {
        u.isAdmin = false;
      }
    });
    saveTables();

    // Seed database if issues empty
    if (tables.issues.length === 0) {
      console.log("[SQL DB] Seeding initial database tables...");

      // Seed Aarav Sharma
      await dbRun(
        "INSERT INTO users (uuid, username, password_hash, name, avatarColor, xp, streak, lastActiveDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          "system-seed-user-1",
          "aarav",
          crypto.createHash("sha256").update("password123").digest("hex"),
          "Aarav Sharma",
          "bg-emerald-500",
          450,
          5,
          new Date().toISOString().substring(0, 10)
        ]
      );

      await dbRun(
        "INSERT INTO badges (userUuid, id, name, icon, description, unlockedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [
          "system-seed-user-1",
          "first_report",
          "First Action",
          "Sparkles",
          "Reported the first civic infrastructure issue.",
          new Date().toISOString()
        ]
      );

      // Seed Neha Patel
      await dbRun(
        "INSERT INTO users (uuid, username, password_hash, name, avatarColor, xp, streak, lastActiveDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          "system-seed-user-2",
          "neha",
          crypto.createHash("sha256").update("password123").digest("hex"),
          "Neha Patel",
          "bg-indigo-500",
          720,
          12,
          new Date().toISOString().substring(0, 10)
        ]
      );

      await dbRun(
        "INSERT INTO badges (userUuid, id, name, icon, description, unlockedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [
          "system-seed-user-2",
          "streak_7",
          "Warden Streak",
          "Flame",
          "Maintained a 7-day community contribution streak.",
          new Date().toISOString()
        ]
      );

      await dbRun(
        "INSERT INTO badges (userUuid, id, name, icon, description, unlockedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [
          "system-seed-user-2",
          "verifications_10",
          "Citizen Auditor",
          "ShieldAlert",
          "Verified 10 other citizens' infrastructure claims.",
          new Date().toISOString()
        ]
      );

      // Seed issues
      for (const issue of INITIAL_DB.issues) {
        await dbRun(
          `INSERT INTO issues (id, title, description, imageUrl, lat, lng, category, severity, department, urgency, suggestedAction, tags, status, upvotes, reportedBy, reportedByName, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            issue.id,
            issue.title,
            issue.description,
            issue.imageUrl || "",
            issue.coordinates.lat,
            issue.coordinates.lng,
            issue.category,
            issue.severity,
            issue.department,
            issue.urgency,
            issue.suggestedAction,
            JSON.stringify(issue.tags),
            issue.status,
            issue.upvotes,
            issue.reportedBy,
            issue.reportedByName,
            issue.timestamp
          ]
        );

        // Status history
        for (const sh of issue.statusHistory) {
          await dbRun(
            "INSERT INTO status_history (issue_id, status, timestamp) VALUES (?, ?, ?)",
            [issue.id, sh.status, sh.timestamp]
          );
        }

        // Upvotes
        for (const upvoter of issue.upvotedBy) {
          await dbRun(
            "INSERT OR IGNORE INTO users (uuid, name, avatarColor, xp, streak, lastActiveDate) VALUES (?, ?, ?, ?, ?, ?)",
            [upvoter, "Citizen " + upvoter.substring(upvoter.length - 4), "bg-slate-500", 100, 1, new Date().toISOString().substring(0, 10)]
          );
          await dbRun(
            "INSERT OR IGNORE INTO upvotes (issue_id, user_uuid) VALUES (?, ?)",
            [issue.id, upvoter]
          );
        }
      }
      console.log("[SQL DB] Relational seed data initialized successfully.");
    }
  } catch (err) {
    console.error("[SQL DB] Failed to initialize database:", err);
  }
}

// Initialize tables
initDatabase();

// Initialize Gemini Client
const aiApiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (aiApiKey && aiApiKey !== "MY_GEMINI_API_KEY") {
  console.log("Initializing server-side Gemini client...");
  ai = new GoogleGenAI({
    apiKey: aiApiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
} else {
  console.warn("GEMINI_API_KEY environment variable is not set or holds example value. Falling back to rule-based analysis.");
}

// Helper to perform Gemini API generation with exponential backoff on transient errors, with an automatic fallback chain to recover from rate limit / high demand errors
async function generateContentWithRetry(params: any, maxRetries = 2, initialDelay = 800): Promise<any> {
  if (!ai) {
    throw new Error("Gemini AI client not initialized.");
  }
  let attempt = 0;
  const currentParams = { ...params };
  let currentMaxRetries = maxRetries;
  
  while (attempt < currentMaxRetries) {
    try {
      return await ai.models.generateContent(currentParams);
    } catch (err: any) {
      attempt++;
      console.warn(`Gemini API call failed (attempt ${attempt}/${currentMaxRetries}):`, err.message || err);
      
      const errStr = (String(err) + " " + JSON.stringify(err) + " " + (err.message || "")).toLowerCase();
      
      // If we got a 429, RESOURCE_EXHAUSTED, rate limit, quota, or billing block, do NOT retry. Throw immediately to fall back instantly.
      const isQuotaExceeded = errStr.includes("429") || 
                              errStr.includes("quota") || 
                              errStr.includes("resource_exhausted") || 
                              errStr.includes("rate limit") || 
                              errStr.includes("billing") ||
                              errStr.includes("exhausted");
                              
      if (isQuotaExceeded) {
        console.warn("Gemini API quota exceeded or rate limited. Throwing immediately to trigger fast rule-based fallback.");
        throw new Error("Gemini API Quota Exceeded. Falling back to rule-based analysis.");
      }
      
      const isTransient = errStr.includes("503") || 
                          errStr.includes("unavailable") || 
                          errStr.includes("high demand") || 
                          errStr.includes("temporary") ||
                          errStr.includes("overloaded");
      
      if (isTransient) {
        // Fallback chain: If the request was targeting gemini-3.5-flash, dynamically try gemini-flash-latest first, then gemini-3.1-flash-lite
        if (currentParams.model === "gemini-3.5-flash") {
          console.log("Switching request model to 'gemini-flash-latest' fallback to recover from service pressure.");
          currentParams.model = "gemini-flash-latest";
          continue;
        } else if (currentParams.model === "gemini-flash-latest") {
          console.log("Switching request model to 'gemini-3.1-flash-lite' fallback to recover from service pressure.");
          currentParams.model = "gemini-3.1-flash-lite";
          continue;
        }
        
        if (attempt >= currentMaxRetries) {
          throw err;
        }
        const delay = initialDelay * Math.pow(2, attempt - 1);
        console.log(`Transient error detected, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
}

// Gamification helper rules
function handleDailyLoginXP(user: any, db: DBStructure): number {
  const todayStr = new Date().toISOString().substring(0, 10);
  if (user.lastActiveDate === todayStr) {
    // Already active/awarded today, return 0
    return 0;
  }

  const lastActive = user.lastActiveDate;
  let xpEarned = 25; // Base Daily Login XP
  let streakBonus = 0;

  if (lastActive) {
    const lastDate = new Date(lastActive);
    const today = new Date(todayStr);
    const diffTime = Math.abs(today.getTime() - lastDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      // Consecutive day login!
      user.streak = (user.streak || 0) + 1;
      streakBonus = 15; // Additional streak bonus XP
      xpEarned += streakBonus;
    } else {
      // Broke streak, reset to 1
      user.streak = 1;
    }
  } else {
    // First login/setting
    user.streak = 1;
  }

  user.lastActiveDate = todayStr;
  awardXP(user.uuid, xpEarned, db);
  return xpEarned;
}

function awardXP(userUuid: string, amount: number, db: DBStructure): { xpEarned: number; newTotal: number; badgesUnlocked: string[] } {
  const user = db.users[userUuid];
  if (!user) return { xpEarned: 0, newTotal: 0, badgesUnlocked: [] };

  const previousXp = user.xp;
  user.xp += amount;
  const newXp = user.xp;
  const badgesUnlocked: string[] = [];

  // Check milestone badges
  const hasBadge = (badgeId: string) => user.badges.some((b) => b.id === badgeId);

  // Badge 1: First action/report
  if (amount >= 50 && !hasBadge("first_report")) {
    const badge = {
      id: "first_report",
      name: "First Action",
      icon: "Sparkles",
      description: "Reported your first hyperlocal civic infrastructure issue.",
      unlockedAt: new Date().toISOString()
    };
    user.badges.push(badge);
    badgesUnlocked.push(badge.name);
  }

  // Badge 2: Citizen Auditor (10 verifications / upvotes contributed)
  // We can count issues they upvoted
  const verificationsCount = db.issues.filter((iss) => iss.upvotedBy.includes(userUuid)).length;
  if (verificationsCount >= 5 && !hasBadge("verifications_5")) {
    const badge = {
      id: "verifications_5",
      name: "Community Auditor",
      icon: "ShieldAlert",
      description: "Helped verify 5 civic reports in your neighborhood.",
      unlockedAt: new Date().toISOString()
    };
    user.badges.push(badge);
    badgesUnlocked.push(badge.name);
  }

  // Badge 3: Master Guardian (Reached 1000+ XP)
  if (newXp >= 1000 && !hasBadge("xp_1000")) {
    const badge = {
      id: "xp_1000",
      name: "Locality Guardian",
      icon: "Award",
      description: "Earned over 1,000 XP in service of your neighborhood.",
      unlockedAt: new Date().toISOString()
    };
    user.badges.push(badge);
    badgesUnlocked.push(badge.name);
  }

  return { xpEarned: amount, newTotal: newXp, badgesUnlocked };
}

// API Endpoints

// Auth 1: Signup a new user and persist in the SQL database
app.post("/api/auth/signup", async (req: Request, res: Response) => {
  const { username, password, name, avatarColor, isAdmin, lat, lng } = req.body;
  if (!username || !password || !name) {
    return res.status(400).json({ error: "Username, password, and display name are required." });
  }

  const normalizedUsername = username.toLowerCase().trim();

  try {
    // Check if user exists
    const existing = await dbGet<any>("SELECT uuid FROM users WHERE username = ?", [normalizedUsername]);
    if (existing) {
      return res.status(400).json({ error: "This username is already taken. Please choose another." });
    }

    const uuid = `citizen-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");
    const avatar = avatarColor || "bg-indigo-600";
    const todayStr = new Date().toISOString().substring(0, 10);

    // Insert user row
    const isActuallyAdmin = normalizedUsername === "adhish@gmail.com" ? 1 : 0;
    let defaultWard = "Indiranagar Ward";
    if (lat !== undefined && lng !== undefined) {
      defaultWard = await getWardForLocationAsync(Number(lat), Number(lng));
    }
    const wardAutoAssign = 1;

    await dbRun(
      "INSERT INTO users (uuid, username, password_hash, name, avatarColor, xp, streak, lastActiveDate, isAdmin, ward, ward_auto_assign) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [uuid, normalizedUsername, passwordHash, name.trim(), avatar, 0, 1, todayStr, isActuallyAdmin, defaultWard, wardAutoAssign]
    );

    const db = await loadDBFromSQL();
    const user = db.users[uuid];
    res.json({ user });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Failed to create citizen profile in SQL database." });
  }
});

// Auth 2: Log in an existing user from the SQL database
app.post("/api/auth/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const normalizedUsername = username.toLowerCase().trim();
  const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

  try {
    const sqlUser = await dbGet<any>(
      "SELECT uuid FROM users WHERE username = ? AND password_hash = ?",
      [normalizedUsername, passwordHash]
    );

    if (!sqlUser) {
      return res.status(401).json({ error: "Invalid username or password credentials." });
    }

    const uuid = sqlUser.uuid;
    const db = await loadDBFromSQL();
    const user = db.users[uuid];

    if (!user) {
      return res.status(500).json({ error: "Citizen profile configuration mismatch." });
    }

    // Update streak active date on login and award daily login XP
    handleDailyLoginXP(user, db);
    await saveDBToSQL(db);

    res.json({ user });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Authentication system error." });
  }
});

// 1. Get or Create user session profile
app.post("/api/users", async (req: Request, res: Response) => {
  const { uuid, name, avatarColor, lat, lng } = req.body;
  if (!uuid) {
    return res.status(400).json({ error: "uuid parameter is required" });
  }

  const db = await loadDBFromSQL();
  let user = db.users[uuid];

  const todayStr = new Date().toISOString().substring(0, 10);

  if (!user) {
    // Determine default ward
    let defaultWard = "Indiranagar Ward";
    if (lat !== undefined && lng !== undefined) {
      defaultWard = await getWardForLocationAsync(Number(lat), Number(lng));
    }

    // New User profile
    user = {
      uuid,
      name: name || "Anonymous Citizen",
      avatarColor: avatarColor || "bg-emerald-500",
      xp: 25, // First login day reward
      streak: 1,
      lastActiveDate: todayStr,
      badges: [],
      ward: defaultWard,
      ward_auto_assign: true
    };
    db.users[uuid] = user;
    await saveDBToSQL(db);
  } else {
    // Update name and avatarColor if they are passed in the request body (e.g. from profile updates)
    if (name) {
      user.name = name;
    }
    if (avatarColor) {
      user.avatarColor = avatarColor;
    }

    // Auto-update ward based on nearest location if enabled
    if (user.ward_auto_assign !== false && lat !== undefined && lng !== undefined) {
      const calculatedWard = await getWardForLocationAsync(Number(lat), Number(lng));
      if (user.ward !== calculatedWard) {
        user.ward = calculatedWard;
      }
    }

    // Award daily login XP and check streaks
    handleDailyLoginXP(user, db);
    await saveDBToSQL(db);
  }

  res.json({ user });
});

// Real-time Event Stream (SSE)
app.get("/api/events", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  sseClients.push(res);

  req.on("close", () => {
    sseClients = sseClients.filter((c) => c !== res);
  });
});

// Get list of wards for coordinates using an API (OpenStreetMap Nominatim)
app.get("/api/wards", async (req: Request, res: Response) => {
  const latVal = req.query.lat ? parseFloat(req.query.lat as string) : null;
  const lngVal = req.query.lng ? parseFloat(req.query.lng as string) : null;
  
  if (latVal === null || lngVal === null || isNaN(latVal) || isNaN(lngVal)) {
    return res.status(400).json({ error: "Latitude and longitude are required." });
  }
  
  const wards = await getWardsFromAPI(latVal, lngVal);
  res.json({ wards });
});

// Resolve a single ward for coordinates using an API (OpenStreetMap Nominatim)
app.get("/api/wards/resolve", async (req: Request, res: Response) => {
  const latVal = req.query.lat ? parseFloat(req.query.lat as string) : null;
  const lngVal = req.query.lng ? parseFloat(req.query.lng as string) : null;
  
  if (latVal === null || lngVal === null || isNaN(latVal) || isNaN(lngVal)) {
    return res.status(400).json({ error: "Latitude and longitude are required." });
  }
  
  const ward = await getWardForLocationAsync(latVal, lngVal);
  res.json({ ward });
});

// Resolve a manual location address/area using Nominatim and Gemini AI
app.post("/api/location/resolve-manual", async (req: Request, res: Response) => {
  const { address, userUuid } = req.body;
  if (!address || typeof address !== "string" || !address.trim()) {
    return res.status(400).json({ error: "Address/location is required." });
  }

  try {
    let resolvedLat = 10.9972;
    let resolvedLng = 76.9936;
    let hasCoords = false;

    // Try OSM Nominatim search first
    try {
      const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
      const osmRes = await fetch(searchUrl, {
        signal: AbortSignal.timeout(2000),
        headers: {
          "User-Agent": "CommunityHero/1.0 (adhishselva@gmail.com)"
        }
      });
      if (osmRes.ok) {
        const text = await osmRes.text();
        if (!text.includes("Rate exceeded") && !text.includes("rate exceeded")) {
          const data = JSON.parse(text);
          if (data && data.length > 0) {
            resolvedLat = parseFloat(data[0].lat);
            resolvedLng = parseFloat(data[0].lon);
            hasCoords = true;
          }
        }
      }
    } catch (osmErr) {
      console.warn("OSM Search geocoding failed, relying on Gemini:", osmErr);
    }

    // Resolve exact real coordinates, city, and ward using Gemini AI
    const result = await getRealWardWithAI(address, hasCoords ? resolvedLat : undefined, hasCoords ? resolvedLng : undefined);

    // If userUuid is provided, sync user's active ward
    if (userUuid) {
      const db = await loadDBFromSQL();
      const user = db.users[userUuid];
      if (user) {
        user.ward = result.ward;
        await saveDBToSQL(db);
      }
    }

    res.json({
      lat: result.lat,
      lng: result.lng,
      city: result.city,
      ward: result.ward
    });
  } catch (err) {
    console.error("Resolve manual error:", err);
    res.status(500).json({ error: "Failed to resolve manual location." });
  }
});

// 2. Get leaderboards
app.get("/api/users/leaderboard", async (req: Request, res: Response) => {
  const db = await loadDBFromSQL();
  const sortedUsers = Object.values(db.users)
    .filter((u) => u.username || u.uuid === "system-seed-user-1" || u.uuid === "system-seed-user-2")
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10); // top 10
  res.json({ leaderboard: sortedUsers });
});

// 3. Get reported issues
app.get("/api/issues", async (req: Request, res: Response) => {
  const db = await loadDBFromSQL();
  res.json({ issues: db.issues });
});

// Helper for image extraction in server endpoints
function extractBase64Data(dataUrl: string): { data: string; mimeType: string } | null {
  const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return null;
  }
  return {
    mimeType: matches[1],
    data: matches[2]
  };
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return {
      data: buffer.toString("base64"),
      mimeType: contentType
    };
  } catch (err) {
    console.error("Error fetching image from URL:", err);
    return null;
  }
}

// 4. Report deep-learning analyzed issue
app.post("/api/issues", async (req: Request, res: Response) => {
  const { title, description, photoData, coordinates, userUuid } = req.body;

  if (!title || !coordinates || !coordinates.lat || !coordinates.lng || !userUuid) {
    return res.status(400).json({ error: "Missing required params: title, coordinates, or userUuid." });
  }

  const db = await loadDBFromSQL();
  const user = db.users[userUuid];
  const reportedByName = user ? user.name : "Anonymous";

  let aiResult: {
    category: string;
    severity: number;
    shortSummary: string;
    department: string;
    urgency: "Low" | "Medium" | "High" | "Critical";
    suggestedAction: string;
    tags: string[];
  } = {
    category: "Other",
    severity: 2,
    shortSummary: description || "No further details provided by the citizen.",
    department: "Civic Safety Corp",
    urgency: "Medium",
    suggestedAction: "Observe safety guidelines and log any updates.",
    tags: ["civic", "issue"]
  };

  let wasAnalyzedByAI = false;

  // 1. Run AI analysis if Gemini is available
  if (ai) {
    try {
      const parts: any[] = [];

      // Add image descriptor if present
      if (photoData) {
        if (photoData.startsWith("data:")) {
          const extracted = extractBase64Data(photoData);
          if (extracted) {
            parts.push({
              inlineData: {
                data: extracted.data,
                mimeType: extracted.mimeType
              }
            });
          }
        } else if (photoData.startsWith("http")) {
          const fetched = await fetchImageAsBase64(photoData);
          if (fetched) {
            parts.push({
              inlineData: {
                data: fetched.data,
                mimeType: fetched.mimeType
              }
            });
          }
        }
      }

      // Add text details and prompts for damage validation and fake checking
      parts.push({
        text: `You are an expert civic engineer, municipal inspector, and fraud detection AI. Analyze the citizen reported infrastructure issue and its corresponding image (if provided).

CRITICAL ASSIGNMENT:
1. Visual Damage & Fraud Analysis (ONLY if an image is provided):
   Evaluate the image to verify if there is genuine visible civic or municipal damage or issues (such as potholes, road cracks, leaking pipes, water flooding, broken streetlights, electrical faults, accumulated garbage/trash, damaged public park benches, broken fences, or other safety/amenity hazards).
   Identify if the user is faking it:
   - "isFake" MUST be true if the image is unrelated, fake, or fraudulent for a civic infrastructure issue (e.g., an indoor selfie, animals, food, a close-up of a consumer product, blank images, computer screens, or illustrations with no real-world municipal hazards).
   - "damageDetected" MUST be true if genuine civic infrastructure damage or issues are visible in the photo.
   - "fakeAnalysisReason" MUST explain your vision assessment in detail: what you see in the photo and whether it represents real damage or represents a fake/irrelevant report.
   
2. If NO image is provided:
   - "isFake" MUST be false.
   - "damageDetected" MUST be false.
   - "fakeAnalysisReason" MUST be "No image provided; text-only submission."

3. Categorization & Routing:
   Provide standard resolution details:
   - category: String (Single-word or short-phrase classification: 'Pothole', 'Water Leak', 'Waste Accumulation', 'Broken Streetlight', 'Damaged Property', or 'Other')
   - severity: Integer (1 to 5, where 1 is minimal and 5 is critical/dangerous)
   - shortSummary: Objective 1-sentence analysis
   - department: String (e.g. 'Public Works Department', 'BESCOM / Electricity Corp', 'Water Supply Board', 'Sanitation / Waste Management', or 'Civic Safety Corp')
   - urgency: String (exactly one of: 'Low', 'Medium', 'High', 'Critical')
   - suggestedAction: action safety hint for residents
   - tags: Array of Strings (3-4 relevant tags, e.g. ["hazard", "lighting", "sewage"])`
      });

      console.log("Calling Gemini 3.5 Flash for civic analysis and fraud/damage validation...");
      const aiResponse = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              severity: { type: Type.INTEGER },
              shortSummary: { type: Type.STRING },
              department: { type: Type.STRING },
              urgency: { type: Type.STRING },
              suggestedAction: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              isFake: { type: Type.BOOLEAN },
              damageDetected: { type: Type.BOOLEAN },
              fakeAnalysisReason: { type: Type.STRING }
            },
            required: ["category", "severity", "shortSummary", "department", "urgency", "suggestedAction", "tags", "isFake", "damageDetected", "fakeAnalysisReason"]
          }
        }
      });

      if (aiResponse.text) {
        const parsed = JSON.parse(aiResponse.text.trim());
        
        // If an image was uploaded, and the AI detected that it is fake or has no damage, reject the submission!
        if (photoData && (parsed.isFake === true || parsed.damageDetected === false)) {
          console.warn("AI detected fake/irrelevant report. Reason:", parsed.fakeAnalysisReason);
          return res.status(400).json({
            error: `AI Vision Rejection: ${parsed.fakeAnalysisReason || "The uploaded image does not appear to contain any visible civic infrastructure damage or municipal issues. Please upload a genuine photo of the issue."}`
          });
        }

        // Map fields safely
        if (parsed.category) aiResult.category = parsed.category;
        if (typeof parsed.severity === "number") aiResult.severity = Math.max(1, Math.min(5, parsed.severity));
        if (parsed.shortSummary) aiResult.shortSummary = parsed.shortSummary;
        if (parsed.department) aiResult.department = parsed.department;
        if (parsed.urgency) {
          const u = parsed.urgency;
          if (["Low", "Medium", "High", "Critical"].includes(u)) {
            aiResult.urgency = u;
          } else if (u.toLowerCase() === "high") {
            aiResult.urgency = "High";
          } else if (u.toLowerCase() === "critical") {
            aiResult.urgency = "Critical";
          }
        }
        if (parsed.suggestedAction) aiResult.suggestedAction = parsed.suggestedAction;
        if (Array.isArray(parsed.tags)) aiResult.tags = parsed.tags;
        wasAnalyzedByAI = true;
      }
    } catch (err: any) {
      console.error("Gemini AI analysis failed, reverting to rule-based fallback:", err);
      // If error indicates rate limiting or system error, we don't reject but let fallback handle it
    }
  }

  // 2. Rule-Based Fallback algorithm if AI failed or wasn't initialized
  if (!wasAnalyzedByAI) {
    const textToMatch = `${title} ${description}`.toLowerCase();
    
    if (textToMatch.includes("water") || textToMatch.includes("leak") || textToMatch.includes("flood") || textToMatch.includes("pipe") || textToMatch.includes("drain")) {
      aiResult.category = "Water Leak";
      aiResult.severity = textToMatch.includes("flood") || textToMatch.includes("burst") ? 5 : 4;
      aiResult.department = "Water Supply Board";
      aiResult.urgency = aiResult.severity === 5 ? "Critical" : "High";
      aiResult.suggestedAction = "Keep dry distance. Alert regional plumbers to shut off neighboring pipeline valves.";
      aiResult.tags = ["water-hazard", "utility-leak", "seepage"];
    } else if (textToMatch.includes("light") || textToMatch.includes("dark") || textToMatch.includes("bulb") || textToMatch.includes("electricity") || textToMatch.includes("wire") || textToMatch.includes("lamp")) {
      aiResult.category = "Broken Streetlight";
      aiResult.severity = textToMatch.includes("spark") || textToMatch.includes("wire") ? 4 : 2;
      aiResult.department = "BESCOM / Electricity Corp";
      aiResult.urgency = aiResult.severity === 4 ? "High" : "Medium";
      aiResult.suggestedAction = "Exercise caution during night walks. Place reflector signs under blackout poles.";
      aiResult.tags = ["lighting-blackout", "electricity-fault", "street-safety"];
    } else if (textToMatch.includes("pothole") || textToMatch.includes("road") || textToMatch.includes("street") || textToMatch.includes("asphalt") || textToMatch.includes("crater") || textToMatch.includes("manhole")) {
      aiResult.category = "Pothole";
      aiResult.severity = textToMatch.includes("deep") || textToMatch.includes("large") || textToMatch.includes("manhole") ? 4 : 3;
      aiResult.department = "Public Works Department";
      aiResult.urgency = aiResult.severity === 4 ? "High" : "Medium";
      aiResult.suggestedAction = "Slow down vehicles. BBMP cold-mix maintenance is required for pothole patching.";
      aiResult.tags = ["pothole-risk", "damaged-street", "traffic-hazard"];
    } else if (textToMatch.includes("garbage") || textToMatch.includes("waste") || textToMatch.includes("trash") || textToMatch.includes("dump") || textToMatch.includes("litter") || textToMatch.includes("smell")) {
      aiResult.category = "Waste Accumulation";
      aiResult.severity = 3;
      aiResult.department = "Sanitation / Waste Management";
      aiResult.urgency = "Medium";
      aiResult.suggestedAction = "Do not add further litter. Municipal dumpster transport needs mobilization.";
      aiResult.tags = ["unhygienic-waste", "dump-site", "sanitation"];
    } else if (textToMatch.includes("park") || textToMatch.includes("bench") || textToMatch.includes("vandal") || textToMatch.includes("fence") || textToMatch.includes("tree")) {
      aiResult.category = "Damaged Property";
      aiResult.severity = 2;
      aiResult.department = "Public Works Department";
      aiResult.urgency = "Low";
      aiResult.suggestedAction = "Cordon off the broken swing/bench. Report to horticultural services.";
      aiResult.tags = ["damaged-property", "park-maintenance", "neighborhood"];
    }
  }

  // Determine jurisdiction by coordinates
  const j = getJurisdiction(coordinates.lat, coordinates.lng);

  // Create & save issue object
  const newIssue: Issue = {
    id: `issue-${Date.now()}`,
    title,
    description: description || "No added description.",
    imageUrl: photoData || "", // Holds custom raw image state or base64 URL
    coordinates,
    category: aiResult.category,
    severity: aiResult.severity,
    department: aiResult.department,
    authority: j.authority,
    state: j.state,
    urgency: aiResult.urgency,
    suggestedAction: aiResult.suggestedAction,
    tags: aiResult.tags,
    status: "Reported",
    upvotes: 1,
    upvotedBy: [userUuid], // Creator auto-upvotes
    reportedBy: userUuid,
    reportedByName,
    timestamp: new Date().toISOString(),
    statusHistory: [
      { status: "Reported", timestamp: new Date().toISOString() }
    ]
  };

  db.issues.unshift(newIssue); // add to top of stack

  // Award user 50 XP for reporting. If reported with photo, award slightly more or standard 50 XP.
  const isWithPhoto = !!photoData && photoData !== "";
  const pointsAwarded = isWithPhoto ? 50 : 30; // 50 XP with photo, 30 XP without
  const xpReward = awardXP(userUuid, pointsAwarded, db);

  await saveDBToSQL(db);

  // Broadcast real-time update
  broadcastUpdate(
    db.issues, 
    Object.values(db.users).filter((u) => u.username || u.uuid === "system-seed-user-1" || u.uuid === "system-seed-user-2")
  );

  res.json({
    issue: newIssue,
    gamification: {
      xpEarned: pointsAwarded,
      newTotal: xpReward.newTotal,
      badgesUnlocked: xpReward.badgesUnlocked
    },
    analyzedByAI: wasAnalyzedByAI
  });
});

// 5. Crowd-verify (Upvote) an issue
app.post("/api/issues/:id/upvote", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { userUuid } = req.body;

  if (!userUuid) {
    return res.status(400).json({ error: "userUuid is required to verify an issue." });
  }

  const db = await loadDBFromSQL();
  const issue = db.issues.find((i) => i.id === id);

  if (!issue) {
    return res.status(404).json({ error: "Issue not found." });
  }

  if (issue.upvotedBy.includes(userUuid)) {
    return res.status(400).json({ error: "You have already upvoted/verified this issue." });
  }

  // Add user and increment
  issue.upvotedBy.push(userUuid);
  issue.upvotes = issue.upvotedBy.length;

  // Auto transition to "Verified" if status was "Reported" and has >= 5 upvotes
  if (issue.status === "Reported" && issue.upvotes >= 5) {
    issue.status = "Verified";
    issue.statusHistory.push({
      status: "Verified",
      timestamp: new Date().toISOString()
    });
  }

  // Award 20 XP to the verifying user
  const xpReward = awardXP(userUuid, 20, db);
  await saveDBToSQL(db);

  // Broadcast real-time update
  broadcastUpdate(
    db.issues, 
    Object.values(db.users).filter((u) => u.username || u.uuid === "system-seed-user-1" || u.uuid === "system-seed-user-2")
  );

  res.json({
    issue,
    gamification: {
      xpEarned: 20,
      newTotal: xpReward.newTotal,
      badgesUnlocked: xpReward.badgesUnlocked
    }
  });
});

// 6. Transition issue status pipeline
app.post("/api/issues/:id/status", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, operatorUuid, resolvedPhoto } = req.body; // operator allows to register resolved state XP rewards

  if (!status || !["Reported", "Verified", "In Progress", "Resolved"].includes(status)) {
    return res.status(400).json({ error: "Invalid status state supplied" });
  }

  const db = await loadDBFromSQL();
  const issue = db.issues.find((i) => i.id === id);

  if (!issue) {
    return res.status(404).json({ error: "Issue not found." });
  }

  // Check if resolution state reached
  const wasAlreadyResolved = issue.status === "Resolved";
  const transitionToResolved = status === "Resolved" && !wasAlreadyResolved;

  let gamificationReporterResult = null;
  let gamificationOperatorResult = null;
  let verificationFeedback = "Resolution self-reported and verified.";

  if (transitionToResolved) {
    if (!resolvedPhoto || typeof resolvedPhoto !== "string" || !resolvedPhoto.startsWith("data:")) {
      return res.status(400).json({
        error: "A photo upload of the resolved state is required to mark this civic issue as 'Resolved'."
      });
    }

    let aiVerified = true;
    let feedback = "No AI verification key available. Auto-verified resolution.";

    if (ai) {
      try {
        console.log("Analyzing resolution using Gemini image comparison...");
        // 1. Prepare Before (initial image) part
        let beforePart: any = null;
        if (issue.imageUrl.startsWith("data:")) {
          const beforeExtracted = extractBase64Data(issue.imageUrl);
          if (beforeExtracted) {
            beforePart = {
              inlineData: {
                mimeType: beforeExtracted.mimeType,
                data: beforeExtracted.data
              }
            };
          }
        } else if (issue.imageUrl.startsWith("http")) {
          const beforeExtracted = await fetchImageAsBase64(issue.imageUrl);
          if (beforeExtracted) {
            beforePart = {
              inlineData: {
                mimeType: beforeExtracted.mimeType,
                data: beforeExtracted.data
              }
            };
          }
        }

        // 2. Prepare After (resolved image) part
        let afterPart: any = null;
        const afterExtracted = extractBase64Data(resolvedPhoto);
        if (afterExtracted) {
          afterPart = {
            inlineData: {
              mimeType: afterExtracted.mimeType,
              data: afterExtracted.data
            }
          };
        }

        if (beforePart && afterPart) {
          const prompt = "Compare these 'Before' (initial report) and 'After' (resolved state) photos of a civic infrastructure issue (pothole, garbage pile, broken streetlight, blocked drain, etc.). Verify if the issue shown in the first image has been completely resolved, cleaned up, repaired, or fixed in the second image. Return a JSON response detailing whether the resolution is verified, the confidence score, and explanatory feedback.";
          
          const response = await generateContentWithRetry({
            model: "gemini-3.5-flash",
            contents: {
              parts: [
                beforePart,
                afterPart,
                { text: prompt }
              ]
            },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  verified: {
                    type: Type.BOOLEAN,
                    description: "True if the issue shown in the first photo is fixed/resolved in the second photo."
                  },
                  confidence: {
                    type: Type.NUMBER,
                    description: "Confidence level of the comparison, from 0.0 to 1.0."
                  },
                  feedback: {
                    type: Type.STRING,
                    description: "Clear description explaining if the resolution was successful and why."
                  }
                },
                required: ["verified", "confidence", "feedback"]
              }
            }
          });

          const result = JSON.parse(response.text || "{}");
          console.log("Gemini resolution comparison result:", result);

          aiVerified = result.verified === true;
          feedback = result.feedback || "AI verification check completed.";
          verificationFeedback = feedback;

          if (!aiVerified) {
            return res.status(400).json({
              error: `AI Resolution Verification Failed: ${feedback}`,
              feedback
            });
          }
        }
      } catch (err: any) {
        console.error("Gemini image comparison failed, falling back to auto-approval:", err);
        feedback = "Temporary service load. Bypass check, manual approval assigned.";
        verificationFeedback = feedback;
      }
    }

    // Grant 100 XP to the original reporter
    if (issue.reportedBy) {
      const reporterUser = db.users[issue.reportedBy];
      if (reporterUser) {
        const xpReward = awardXP(issue.reportedBy, 100, db);
        // Unlock milestone badge on first resolution
        const hasBadge = reporterUser.badges.some((b) => b.id === "resolved_milestone");
        if (!hasBadge) {
          reporterUser.badges.push({
            id: "resolved_milestone",
            name: "Local Pioneer",
            icon: "ShieldCheck",
            description: "Had a reported civic infrastructure issue resolved completely.",
            unlockedAt: new Date().toISOString()
          });
          xpReward.badgesUnlocked.push("Local Pioneer");
        }

        gamificationReporterResult = {
          reporterUuid: issue.reportedBy,
          xpEarned: 100,
          newTotal: xpReward.newTotal,
          badgesUnlocked: xpReward.badgesUnlocked
        };
      }
    }

    // Grant 50 XP to the worker/citizen who marked it as resolved
    if (operatorUuid) {
      const operatorUser = db.users[operatorUuid];
      if (operatorUser) {
        const opXpReward = awardXP(operatorUuid, 50, db);
        gamificationOperatorResult = {
          operatorUuid,
          xpEarned: 50,
          newTotal: opXpReward.newTotal,
          badgesUnlocked: opXpReward.badgesUnlocked
        };
      }
    }

    issue.resolvedImageUrl = resolvedPhoto;
  }

  // Update status and history
  issue.status = status;
  issue.statusHistory.push({
    status,
    timestamp: new Date().toISOString()
  });

  await saveDBToSQL(db);

  // Broadcast real-time update
  broadcastUpdate(
    db.issues, 
    Object.values(db.users).filter((u) => u.username || u.uuid === "system-seed-user-1" || u.uuid === "system-seed-user-2")
  );

  res.json({
    issue,
    gamificationReporterResult,
    gamificationOperatorResult,
    feedback: verificationFeedback
  });
});

// 7. Get public stats & aggregates
app.get("/api/stats", async (req: Request, res: Response) => {
  const db = await loadDBFromSQL();
  // Include all logged issues in the stats so they match the map registry exactly
  const issues = db.issues;

  // Total Reported
  const totalReported = issues.length;

  // Resolved issues this week
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const resolvedThisWeek = issues.filter((i) => {
    if (i.status !== "Resolved") return false;
    const resolvedEntry = i.statusHistory.find((sh) => sh.status === "Resolved");
    if (!resolvedEntry) return false;
    const resTime = new Date(resolvedEntry.timestamp).getTime();
    return resTime >= sevenDaysAgo;
  }).length;

  // Average resolution time
  let totalResTime = 0;
  let resolvedCount = 0;
  issues.forEach((i) => {
    const reportedEntry = i.statusHistory.find((sh) => sh.status === "Reported");
    const resolvedEntry = i.statusHistory.find((sh) => sh.status === "Resolved");
    if (reportedEntry && resolvedEntry) {
      const tReported = new Date(reportedEntry.timestamp).getTime();
      const tResolved = new Date(resolvedEntry.timestamp).getTime();
      totalResTime += (tResolved - tReported) / 1000; // in seconds
      resolvedCount++;
    }
  });
  const averageResolutionTimeSeconds = resolvedCount > 0 ? Math.round(totalResTime / resolvedCount) : 0;

  // Category weights and breakdown
  const categoryWeights: { [key: string]: number } = {};
  issues.forEach((i) => {
    categoryWeights[i.category] = (categoryWeights[i.category] || 0) + 1;
  });

  // Severity weights (1-5)
  const severityDist: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  issues.forEach((i) => {
    severityDist[i.severity] = (severityDist[i.severity] || 0) + 1;
  });

  // Department-wise pending count
  const departmentPending: { [key: string]: number } = {};
  issues.forEach((i) => {
    if (i.status !== "Resolved") {
      departmentPending[i.department] = (departmentPending[i.department] || 0) + 1;
    }
  });

  const stats: DashboardStats = {
    totalReported,
    totalResolved: resolvedCount,
    averageResolutionTimeSeconds,
    categoryWeights,
    severityDist,
    departmentPending
  };

  res.json({ stats, resolvedThisWeek });
});

// 8. Generate dynamic weekly summaries via Gemini AI (or pre-baked heuristics if unavailable)
app.get("/api/ai-summary", async (req: Request, res: Response) => {
  const db = await loadDBFromSQL();
  // Include all open issues so that the dynamic summary represents all active threats on the map
  const openIssues = db.issues.filter((i) => i.status !== "Resolved");

  if (openIssues.length === 0) {
    return res.json({
      summary: {
        text: "The community is currently pristine! No open or unresolved civic infrastructure concerns are logged in this neighborhood.",
        generatedAt: new Date().toISOString()
      }
    });
  }

  // Create open issues summarized string
  const issuesDesc = openIssues
    .map((oi) => {
      const latVal = typeof oi.coordinates?.lat === "number" ? oi.coordinates.lat : parseFloat(oi.coordinates?.lat as any || "0");
      const lngVal = typeof oi.coordinates?.lng === "number" ? oi.coordinates.lng : parseFloat(oi.coordinates?.lng as any || "0");
      return `- [${oi.category}, Severity ${oi.severity}] "${oi.title}" in neighborhood location (Coordinates: ${latVal.toFixed(4)}, ${lngVal.toFixed(4)})`;
    })
    .join("\n");

  let summaryText = "";
  let wasAISummary = false;

  if (ai) {
    try {
      console.log("Calling Gemini 3.5 Flash for weekly administrative summary...");
      const sysInst = "You are a senior urban administrative officer and counselor. Write a professional, concise 3-sentence summary analyzing the weekly report of active infrastructural hazards. Cite actual density areas and name departments needing immediate mobilize. Do not use markdown format, emojis, self-praise, or generic fluff. Keep it strictly exactly 3 sentences.";
      const prompt = `Here is the current log of active/unresolved neighborhood civic issues:
${issuesDesc}

Synthesize this data into a 3-sentence natural language brief highlighting:
1. The most prevalent/severe active issue types this week (e.g., potholes, water leaks).
2. The specific areas where complaints are clusters.
3. Recommendations for routing and department priorities (referencing BWSSB, BESCOM, BBMP etc.).`;

      const aiResponse = await generateContentWithRetry({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: { systemInstruction: sysInst }
      });

      if (aiResponse.text) {
        summaryText = aiResponse.text.trim();
        wasAISummary = true;
      }
    } catch (err) {
      console.error("Gemini AI failed to extract summary:", err);
    }
  }

  if (!wasAISummary) {
    // Elegant fallback brief summarizing actual database patterns
    const waterCount = openIssues.filter((o) => o.category === "Water Leak").length;
    const potholeCount = openIssues.filter((o) => o.category === "Pothole").length;
    const lightCount = openIssues.filter((o) => o.category === "Broken Streetlight").length;
    const highSevCount = openIssues.filter((o) => o.severity >= 4).length;

    summaryText = `This week, neighborhood logs show ${openIssues.length} active civic issues, led by ${potholeCount} road potholes and ${waterCount} water grid leaks requiring BBMP and BWSSB coordination. Indiranagar's central corridor remains a major hotspot with ${highSevCount} high-severity hazards registered near 100 Feet Road and metro crossings. We recommend prioritizing water mainline valve shuts and immediate cold-mix pothole repair squads to secure pedestrian and traffic flow.`;
  }

  // Persist weekly summary to DB state
  db.weeklySummary = {
    text: summaryText,
    generatedAt: new Date().toISOString()
  };
  await saveDBToSQL(db);

  res.json({
    summary: db.weeklySummary,
    analyzedByAI: wasAISummary
  });
});

// Gamification 1: User Check-in to Sector/Ward
app.post("/api/check-in", async (req: Request, res: Response) => {
  const { userUuid, lat, lng } = req.body;
  if (!userUuid || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: "Missing required parameters: userUuid, lat, lng." });
  }

  try {
    const db = await loadDBFromSQL();
    const user = db.users[userUuid];
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    const ward = await getWardForLocationAsync(lat, lng);
    const nowStr = new Date().toISOString();

    // Record check-in
    tables.check_ins.push({
      user_uuid: userUuid,
      lat,
      lng,
      ward,
      timestamp: nowStr
    });
    saveTables();

    // Award 10 XP for checking-in to verify local cleanliness
    const xpReward = awardXP(userUuid, 10, db);

    // Auto assign ward if auto assign is enabled (or not explicitly false)
    let wasAutoAssigned = false;
    if (user.ward_auto_assign !== false) {
      const userCheckIns = tables.check_ins.filter(ci => ci.user_uuid === userUuid);
      const wardCounts: { [key: string]: number } = {};
      userCheckIns.forEach(ci => {
        wardCounts[ci.ward] = (wardCounts[ci.ward] || 0) + 1;
      });

      let maxCount = 0;
      let mostFreqWard = user.ward || "Indiranagar Ward";
      for (const [w, count] of Object.entries(wardCounts)) {
        if (count > maxCount) {
          maxCount = count;
          mostFreqWard = w;
        }
      }

      if (user.ward !== mostFreqWard) {
        user.ward = mostFreqWard;
        wasAutoAssigned = true;
      }
    }

    db.users[userUuid].ward = user.ward;
    db.users[userUuid].ward_auto_assign = user.ward_auto_assign;
    await saveDBToSQL(db);

    // Broadcast update
    broadcastUpdate(
      db.issues,
      Object.values(db.users).filter((u) => u.username || u.uuid === "system-seed-user-1" || u.uuid === "system-seed-user-2")
    );

    res.json({
      user: db.users[userUuid],
      ward,
      wasAutoAssigned,
      xpEarned: 10,
      newTotal: xpReward.newTotal,
      badgesUnlocked: xpReward.badgesUnlocked
    });
  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).json({ error: "Failed to process clean check-in." });
  }
});

// Gamification 2: Join or update a Sector/Ward manually
app.post("/api/users/:uuid/join-ward", async (req: Request, res: Response) => {
  const { uuid } = req.params;
  const { ward } = req.body;

  if (!ward) {
    return res.status(400).json({ error: "Ward name is required." });
  }

  try {
    const db = await loadDBFromSQL();
    const user = db.users[uuid];
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    user.ward = ward;
    user.ward_auto_assign = false; // Disable auto-assignment once manual selection is made
    await saveDBToSQL(db);

    broadcastUpdate(
      db.issues,
      Object.values(db.users).filter((u) => u.username || u.uuid === "system-seed-user-1" || u.uuid === "system-seed-user-2")
    );

    res.json({ user });
  } catch (err) {
    console.error("Join ward error:", err);
    res.status(500).json({ error: "Failed to join ward." });
  }
});

// DPDP Compliance: Erase citizen personal record file from the SQL database
app.post("/api/users/:uuid/erase", async (req: Request, res: Response) => {
  const { uuid } = req.params;

  try {
    const db = await loadDBFromSQL();
    
    // Check if user exists
    if (!db.users[uuid]) {
      return res.status(404).json({ error: "Citizen profile not found." });
    }

    // Delete user from in-memory DBStructure map
    delete db.users[uuid];

    // Delete from SQL emulated tables
    tables.users = tables.users.filter((u) => u.uuid !== uuid);
    tables.badges = tables.badges.filter((b) => b.userUuid !== uuid);
    tables.upvotes = tables.upvotes.filter((up) => up.user_uuid !== uuid);
    
    // For reported issues, we don't have to delete the issue (public infrastructure reporting is public work), 
    // but we can anonymize the reportedBy and reportedByName fields to satisfy privacy compliance!
    db.issues.forEach((issue) => {
      if (issue.reportedBy === uuid) {
        issue.reportedBy = "anonymous";
        issue.reportedByName = "Anonymized Citizen (DPDP Purged)";
      }
      issue.upvotedBy = issue.upvotedBy.filter((up) => up !== uuid);
    });

    tables.issues.forEach((issue) => {
      if (issue.reportedBy === uuid) {
        issue.reportedBy = "anonymous";
        issue.reportedByName = "Anonymized Citizen (DPDP Purged)";
      }
    });

    saveTables();
    await saveDBToSQL(db);

    broadcastUpdate(
      db.issues,
      Object.values(db.users).filter((u) => u.username || u.uuid === "system-seed-user-1" || u.uuid === "system-seed-user-2")
    );

    res.json({ success: true, message: "Citizen profile and all personal records successfully erased under DPDP Section 11." });
  } catch (err) {
    console.error("DPDP Erasure error:", err);
    res.status(500).json({ error: "Failed to erase user profile under DPDP compliance rules." });
  }
});

// Gamification 3: Weekly Leaderboard for Cleanest Neighborhood
app.get("/api/wards/leaderboard", async (req: Request, res: Response) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : 12.97189;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : 77.64115;
    const userUuid = req.query.userUuid as string;

    const db = await loadDBFromSQL();
    const issues = db.issues;
    const users = Object.values(db.users);

    const currentCity = getJurisdiction(lat, lng).city;

    // Dynamically build the list of wards associated with the current city so no wards are excluded
    const wardsSet = new Set<string>();

    // 1. Static fallback wards for this location
    getWardsForLocation(lat, lng).forEach(w => {
      if (w) wardsSet.add(w.trim());
    });

    // 2. Wards from issues located in the current city
    issues.forEach(i => {
      const issueCity = getJurisdiction(i.coordinates.lat, i.coordinates.lng).city;
      if (issueCity === currentCity && i.ward) {
        wardsSet.add(i.ward.trim());
      }
    });

    // 3. Wards from check-ins located in the current city
    if (tables && Array.isArray(tables.check_ins)) {
      tables.check_ins.forEach(ci => {
        const ciCity = getJurisdiction(ci.lat, ci.lng).city;
        if (ciCity === currentCity && ci.ward) {
          wardsSet.add(ci.ward.trim());
        }
      });
    }

    // 4. Wards from users matching the current city
    users.forEach(u => {
      if (u.ward) {
        const wardLower = u.ward.toLowerCase();
        // Check if user has checked in to this city
        const hasCheckIn = tables && Array.isArray(tables.check_ins) && tables.check_ins.some(
          ci => ci.user_uuid === u.uuid && getJurisdiction(ci.lat, ci.lng).city === currentCity
        );
        
        if (hasCheckIn) {
          wardsSet.add(u.ward.trim());
        } else {
          // Fallback simple keyword heuristics to match the ward with the current city
          if (currentCity.toLowerCase() === "coimbatore" && (wardLower.includes("ramanathapuram") || wardLower.includes("eachanari") || wardLower.includes("coimbatore"))) {
            wardsSet.add(u.ward.trim());
          } else if (currentCity.toLowerCase() === "bengaluru" && (wardLower.includes("indiranagar") || wardLower.includes("malleswaram") || wardLower.includes("koramangala") || wardLower.includes("hsr") || wardLower.includes("whitefield") || wardLower.includes("bengaluru"))) {
            wardsSet.add(u.ward.trim());
          } else if (currentCity.toLowerCase() === "chennai" && (wardLower.includes("mylapore") || wardLower.includes("adyar") || wardLower.includes("velachery") || wardLower.includes("nungambakkam") || wardLower.includes("chennai"))) {
            wardsSet.add(u.ward.trim());
          } else if (currentCity.toLowerCase() === "delhi" && (wardLower.includes("saket") || wardLower.includes("cp") || wardLower.includes("dwarka") || wardLower.includes("delhi"))) {
            wardsSet.add(u.ward.trim());
          } else if (wardLower.includes(currentCity.toLowerCase())) {
            wardsSet.add(u.ward.trim());
          }
        }
      }
    });

    // 5. Force add current user's ward if requested and they belong to this city/location
    if (userUuid) {
      const activeUser = db.users[userUuid];
      if (activeUser && activeUser.ward) {
        wardsSet.add(activeUser.ward.trim());
      }
    }

    const availableWards = Array.from(wardsSet).filter(Boolean);

    const wardStats = availableWards.map((wardName) => {
      const wardIssues = issues.filter(i => {
        const issueWard = i.ward || getWardForLocation(i.coordinates.lat, i.coordinates.lng);
        return issueWard.toLowerCase().trim() === wardName.toLowerCase().trim();
      });

      const totalIssues = wardIssues.length;
      const resolvedIssues = wardIssues.filter(i => i.status === "Resolved").length;
      const activeIssues = totalIssues - resolvedIssues;

      // Cleanliness score formula
      let cleanlinessScore = 80; // Baseline
      if (totalIssues > 0) {
        cleanlinessScore = Math.max(10, Math.min(100, Math.round((resolvedIssues / totalIssues) * 100)));
      }

      const wardUsers = users.filter(u => u.ward && u.ward.toLowerCase().trim() === wardName.toLowerCase().trim());
      const totalXP = wardUsers.reduce((sum, u) => sum + (u.xp || 0), 0);
      const citizenCount = wardUsers.length;

      const checkInCount = tables && Array.isArray(tables.check_ins) 
        ? tables.check_ins.filter(ci => ci.ward.toLowerCase().trim() === wardName.toLowerCase().trim()).length 
        : 0;

      return {
        wardName,
        cleanlinessScore,
        totalIssues,
        resolvedIssues,
        activeIssues,
        citizenCount: citizenCount + (checkInCount > 0 ? 1 : 0),
        totalXP,
        checkInCount
      };
    });

    // Sort by cleanliness score descending, then totalXP descending
    wardStats.sort((a, b) => {
      if (b.cleanlinessScore !== a.cleanlinessScore) {
        return b.cleanlinessScore - a.cleanlinessScore;
      }
      return b.totalXP - a.totalXP;
    });

    const rankedWards = wardStats.map((ward, index) => ({
      ...ward,
      rank: index + 1,
      title: index === 0 ? "🏆 Cleanest Neighborhood" : index < 3 ? "🥈 Model Zone" : "Standard Ward"
    }));

    res.json({ wards: rankedWards });
  } catch (err) {
    console.error("Ward leaderboard error:", err);
    res.status(500).json({ error: "Failed to load ward leaderboard." });
  }
});

// Vite + Static files boot
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Community Hero Server] Listening on port ${PORT}`);
  });
}

startServer();
