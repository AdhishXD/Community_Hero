# Security Specification & Threat Model for Community Hero

This document defines the security specification and test cases ("Dirty Dozen") used to verify our Zero-Trust Firebase Firestore architecture.

## 1. Data Invariants

- **User Authenticity**: A user document must only be writeable (created or modified) by the authenticated owner whose `request.auth.uid` strictly matches the document ID.
- **Badge Integrity**: Achievement badges can only be awarded to a user's record and are structurally immutable once earned.
- **Identity Integrity**: When reporting or upvoting an issue, the user's payload UUID must strictly match `request.auth.uid`. No citizen can impersonate or report on behalf of another citizen.
- **Status Progression**: Issues can only progress through valid states (`Reported` -> `Verified` -> `In Progress` -> `Resolved`). Once resolved, subsequent modifications to core issue fields are blocked.
- **No Self-Assigned Privileges**: The `isAdmin` field cannot be self-assigned or flipped by standard users; only the system/admin document store can designate administrative rights.
- **Strict Size/Type Limits**: Every string input must have a defined maximum length (e.g., titles <= 100 characters, descriptions <= 1000 characters) to prevent Denial of Wallet storage fatigue.

---

## 2. The "Dirty Dozen" Threat Payloads

Here are 12 hostile payloads designed to compromise Identity, Integrity, and State:

### Payload 1: Identity Hijacking (Spoofing User Profile Creation)
- **Target Collection**: `/users`
- **Goal**: Register a user document with ID `victim_uuid` while authenticated as `attacker_uuid`.
- **Payload**:
```json
{
  "uuid": "victim_uuid",
  "name": "Victim Citizen",
  "xp": 0,
  "streak": 0
}
```

### Payload 2: Privilege Escalation (Self-Promoting to Admin)
- **Target Collection**: `/users`
- **Goal**: Attacker updates their own profile to make themselves an admin.
- **Payload**:
```json
{
  "uuid": "attacker_uuid",
  "name": "Attacker",
  "isAdmin": true
}
```

### Payload 3: XP Injection (Self-Awarding points)
- **Target Collection**: `/users`
- **Goal**: Attacker adds 10,000 XP to their own record.
- **Payload**:
```json
{
  "uuid": "attacker_uuid",
  "xp": 10000
}
```

### Payload 4: Fake Civic Report (Impersonating Reporter)
- **Target Collection**: `/issues`
- **Goal**: Submit an issue with `reportedBy: victim_uuid` to damage their reputational standing.
- **Payload**:
```json
{
  "id": "issue_999",
  "title": "Fake Pothole",
  "description": "Nonsense hazard details",
  "coordinates": { "lat": 12.9716, "lng": 77.5946 },
  "category": "Pothole",
  "status": "Reported",
  "reportedBy": "victim_uuid"
}
```

### Payload 5: Deny of Wallet String Flood (Buffer Overflow)
- **Target Collection**: `/issues`
- **Goal**: Flood the database with an extremely long issue description (e.g. 10MB string).
- **Payload**:
```json
{
  "id": "issue_100",
  "title": "Flood Title",
  "description": "[...10MB String...]",
  "coordinates": { "lat": 12.9716, "lng": 77.5946 },
  "category": "Pothole",
  "status": "Reported",
  "reportedBy": "attacker_uuid"
}
```

### Payload 6: Upvote Inflation (Faking high validation scores)
- **Target Collection**: `/issues`
- **Goal**: An attacker tries to write directly to the `upvotes` count and list, adding 50 upvotes.
- **Payload**:
```json
{
  "upvotes": 50,
  "upvotedBy": ["fake_user1", "fake_user2", "attacker_uuid"]
}
```

### Payload 7: Terminal State Locking Bypass
- **Target Collection**: `/issues`
- **Goal**: Change details of a resolved issue to reverse municipal validation.
- **Payload**:
```json
{
  "status": "Reported",
  "description": "Maliciously modified resolved text"
}
```

### Payload 8: Coordinate Spoofing Check-In
- **Target Collection**: `/checkIns`
- **Goal**: Check in for another user to earn badges on their behalf.
- **Payload**:
```json
{
  "id": "check_99",
  "userUuid": "victim_uuid",
  "lat": 12.97,
  "lng": 77.59,
  "ward": "Indiranagar Ward"
}
```

### Payload 9: Empty/Nonsense Fields (Schema Violation)
- **Target Collection**: `/users`
- **Goal**: Bypass type safety with null or wrong types (e.g., float for streak, array for name).
- **Payload**:
```json
{
  "uuid": "attacker_uuid",
  "name": ["InvalidNameArray"],
  "xp": "not-a-number",
  "streak": 12.34
}
```

### Payload 10: Email Verification Bypass (Spoofing Admin/User Access)
- **Target Collection**: `/users`
- **Goal**: Access system-restricted items by using a payload while `request.auth.token.email_verified` is false.
- **Payload**: Attempts write on user info when unverified.

### Payload 11: Invalid ID Poisoning
- **Target Collection**: `/issues`
- **Goal**: Create an issue using a document ID filled with junk characters and massive length to break indexing.
- **Document ID**: `malicious_id_!@#$%_extremely_long_junk_characters_that_should_be_rejected_by_our_regex_pattern`

### Payload 12: Phantom Status History Insertion
- **Target Collection**: `/issues`
- **Goal**: Inject a fake status history event without proper sequence.
- **Payload**:
```json
{
  "statusHistory": [
    { "status": "Resolved", "timestamp": "2020-01-01T00:00:00Z" }
  ]
}
```

---

## 3. Test Runner Design

Our tests verify that every one of the "Dirty Dozen" payloads results in an explicit `PERMISSION_DENIED` status code. The fortress rules in `firestore.rules` will prevent these vulnerabilities.
