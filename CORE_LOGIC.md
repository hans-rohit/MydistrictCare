# District Care - Core Logic & Functionality Documentation

**Version:** 1.0  
**Last Updated:** January 10, 2026  
**Tech Stack:** React + Vite, Firebase (Auth, Firestore), Chakra UI, Leaflet Maps, Google Gemini AI

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Database Structure](#4-database-structure)
5. [Authentication System](#5-authentication-system)
6. [Core Features](#6-core-features)
7. [Status Workflow](#7-status-workflow)
8. [Notification System](#8-notification-system)
9. [Voting System](#9-voting-system)
10. [Analytics & Dashboards](#10-analytics--dashboards)
11. [Component Architecture](#11-component-architecture)
12. [Security Rules](#12-security-rules)

---

## 1. Project Overview

**District Care** is a civic grievance management system that connects citizens with government departments to report and track infrastructure issues (Electricity, Water, Sewage, Road problems).

### Key Objectives

- Enable citizens to report civic issues with photos and location
- Track issues through multi-stage resolution workflow
- Provide transparency through public voting and status updates
- Generate analytics for government performance monitoring
- Facilitate two-stage verification (department resolution + citizen verification)

### Technology Choices

- **Frontend:** React 18 with Vite for fast development
- **UI Library:** Chakra UI for consistent, accessible components
- **Backend:** Firebase (serverless)
  - **Authentication:** Firebase Auth for user management
  - **Database:** Cloud Firestore (NoSQL document database)
  - **Storage:** Cloudinary for image uploads
- **Mapping:** Leaflet with OpenStreetMap tiles
- **AI:** Google Gemini AI for chatbot assistance

---

## 2. Architecture

### Application Structure

```
district-care/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Header.jsx       # Navigation bar with auth state
│   │   ├── Footer.jsx       # Footer component
│   │   ├── PostCard.jsx     # Issue card with voting
│   │   ├── IssuesMap.jsx    # Map visualization
│   │   ├── Chatbot.jsx      # AI assistant
│   │   ├── NotificationBell.jsx  # Real-time notifications
│   │   └── PrivateRoute.jsx # Route protection
│   │
│   ├── pages/               # Route pages
│   │   ├── Home.jsx         # Public feed with search/filter
│   │   ├── CreatePost.jsx   # Issue creation form
│   │   ├── IssueDetail.jsx  # Single issue view
│   │   ├── Login.jsx        # User login
│   │   ├── Signup.jsx       # User registration
│   │   ├── Profile.jsx      # User profile & posts
│   │   ├── Dashboard.jsx    # Super-admin analytics
│   │   ├── DashboardDept.jsx # Department dashboard
│   │   ├── DashboardAnalytics.jsx # Dept analytics
│   │   └── Admin.jsx        # User management
│   │
│   ├── context/
│   │   └── AuthContext.jsx  # Global auth state
│   │
│   ├── lib/                 # Utility functions
│   │   ├── gemini.js        # AI chatbot logic
│   │   ├── location.js      # GPS & geocoding
│   │   └── notifications.js # Notification helpers
│   │
│   ├── firebase.js          # Firebase config
│   ├── theme.js             # Chakra UI theme
│   ├── App.jsx              # Routes & layout
│   └── main.jsx             # Entry point
│
├── firestore.rules          # Security rules
├── firestore.indexes.json   # Composite indexes
└── package.json
```

### Data Flow

```
User Action (UI)
    ↓
React Component
    ↓
Firebase SDK Call
    ↓
Firestore Security Rules (Validation)
    ↓
Database Write/Read
    ↓
Real-time Listener (onSnapshot)
    ↓
State Update
    ↓
UI Re-render
```

---

## 3. User Roles & Permissions

### Role Hierarchy

1. **Public Users** (Default)

   - Can create issues
   - Can vote on issues
   - Can verify resolutions
   - Can delete own posts
   - Can view all posts

2. **Department Admins** (dept)

   - All public permissions
   - Can update issue status for assigned department
   - Can add resolution notes and images
   - Can view department-specific analytics
   - Cannot create issues (admin role)

3. **Super Admin** (admin)
   - All permissions
   - Can manage users (create dept admins)
   - Can view all departments' analytics
   - Can see deleted posts
   - Can soft-delete any post

### Permission Matrix

| Action            | Public   | Dept Admin    | Super Admin            |
| ----------------- | -------- | ------------- | ---------------------- |
| Create Issue      | ✅       | ❌            | ❌                     |
| View Issues       | ✅       | ✅            | ✅ (including deleted) |
| Vote on Issues    | ✅       | ❌            | ❌                     |
| Update Status     | ❌       | ✅ (own dept) | ✅ (all)               |
| Delete Own Post   | ✅       | ✅            | ✅                     |
| Delete Any Post   | ❌       | ❌            | ✅                     |
| Verify Resolution | ✅ (own) | ❌            | ❌                     |
| View Analytics    | ❌       | ✅ (own dept) | ✅ (all)               |
| Create Users      | ❌       | ❌            | ✅                     |

---

## 4. Database Structure

### Collections

#### **posts** (Main collection for issues)

```javascript
{
  id: "auto-generated",
  title: "Power Outage",
  description: "Detailed description of issue",
  departmentTag: "Electricity", // Water, Sewage, Road
  lat: 12.9716,
  lng: 77.5946,
  address: "Formatted address string",
  imageURL: "https://cloudinary.com/...",
  imageStoragePath: "district-care/...",
  status: "pending", // Status enum
  createdBy: {
    uid: "firebase-user-id",
    name: "User Name",
    email: "user@example.com"
  },
  createdAt: Timestamp,

  // Admin/Dept fields (optional)
  actionNote: "Working on it",
  resolvedAt: Timestamp,
  resolutionImage: "URL",
  resolutionNote: "Fixed the issue",
  resolutionDate: Timestamp,
  resolvedBy: { uid, name, email },

  // Verification fields (optional)
  verificationImage: "URL",
  verificationNote: "Verified fixed",
  verificationDate: Timestamp,
  verifiedBy: { uid, name },

  // Rejection fields (optional)
  rejectionReason: "Not actually fixed",
  rejectionNote: "Details",

  // Status history
  statusHistory: [
    {
      status: "in_progress",
      changedBy: { uid, name },
      timestamp: "ISO string",
      note: "Started work"
    }
  ],

  // Soft delete
  deleted: false,
  deletedAt: Timestamp,

  // Vote counts (denormalized)
  upvotes: 10,
  downvotes: 2
}
```

**Status Values:**

- `pending` - Newly created, awaiting department action
- `in_progress` - Department working on it
- `resolved_pending_verification` - Department claims fixed, awaiting citizen verification
- `resolved_verified` - Citizen confirmed issue is fixed
- `rejected` - Citizen rejected department's resolution
- `deleted` - Soft deleted by user/admin

#### **posts/{postId}/votes** (Subcollection)

```javascript
{
  id: "user-uid", // Document ID is the voter's UID
  voteType: "up", // "up" or "down"
  userId: "user-uid",
  createdAt: Date
}
```

#### **users**

```javascript
{
  id: "firebase-auth-uid",
  uid: "firebase-auth-uid",
  name: "User Name",
  email: "user@example.com",
  role: "public", // "public", "dept", "admin"
  department: null, // or "Electricity", "Water", etc. (for dept role)
  createdAt: Timestamp
}
```

#### **notifications**

```javascript
{
  id: "auto-generated",
  recipientId: "user-uid", // or "all" for broadcasts
  recipientRole: "public", // "public", "dept", "admin", "all"
  type: "status_change", // "status_change", "verification", "new_issue"
  title: "Issue Status Updated",
  message: "Your issue 'Power Outage' status changed to In Progress",
  issueId: "post-id",
  metadata: {
    oldStatus: "pending",
    newStatus: "in_progress",
    actionNote: "Started work"
  },
  read: false,
  createdAt: Timestamp
}
```

### Firestore Indexes

Required composite indexes (in `firestore.indexes.json`):

1. **notifications by recipientId + createdAt**

   - `recipientId` (Ascending) + `createdAt` (Descending)
   - For user-specific notifications sorted by time

2. **notifications by recipientRole + createdAt**
   - `recipientRole` (Ascending) + `createdAt` (Descending)
   - For role-based notifications (admin/dept)

---

## 5. Authentication System

### Implementation: AuthContext.jsx

**Purpose:** Global authentication state management

**Flow:**

```
App Loads
    ↓
AuthProvider wraps entire app
    ↓
onAuthStateChanged listener activates
    ↓
User logged in?
    ├─ Yes → Fetch user profile from Firestore
    │        ↓
    │        Profile exists?
    │        ├─ Yes → Set profile state
    │        └─ No → Create default profile
    │
    └─ No → Set user & profile to null
```

**State Provided:**

- `user` - Firebase Auth user object (uid, email, displayName)
- `profile` - User document from Firestore (includes role, department)
- `loading` - Boolean indicating auth state is being determined

**Usage in Components:**

```javascript
import { useAuth } from "../context/AuthContext";

function MyComponent() {
  const { user, profile, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" />;

  // Access user data
  const isAdmin = profile?.role === "admin";
}
```

### Login Flow (Login.jsx)

1. User enters email & password
2. Call `signInWithEmailAndPassword(auth, email, password)`
3. Firebase validates credentials
4. `onAuthStateChanged` triggered in AuthContext
5. User profile fetched from Firestore
6. Navigate to home page (auto-redirects based on role)

### Signup Flow (Signup.jsx)

1. User enters name, email, password
2. Call `createUserWithEmailAndPassword(auth, email, password)`
3. Update Firebase Auth display name: `updateProfile(user, { displayName: name })`
4. Create Firestore user document with role='public'
5. Navigate to home page

### User Management (Admin.jsx)

**Creating Department Admins:**

Uses **secondary Firebase Auth app** to avoid logging out current admin:

```javascript
// Create isolated auth instance
const secondaryApp = initializeApp(config, "Secondary");
const secAuth = getAuth(secondaryApp);

// Create user in secondary app
await createUserWithEmailAndPassword(secAuth, email, password);

// Write to Firestore with dept role
await setDoc(doc(db, "users", uid), {
  role: "dept",
  department: "Electricity",
});

// Sign out secondary app
await signOut(secAuth);
```

---

## 6. Core Features

### 6.1 Issue Creation (CreatePost.jsx)

**Workflow:**

```
User clicks "Report Issue"
    ↓
CreatePost page loads
    ↓
Auto-detect GPS location (getCurrentPosition)
    ↓
User fills form:
    - Department (dropdown)
    - Issue Title (predefined or custom)
    - Description (textarea)
    - Image upload (file input)
    - Location (auto-filled or manual entry)
    ↓
Check for nearby duplicates (optional)
    ↓
Validate form (all fields required)
    ↓
Submit:
    1. Upload image to Cloudinary
    2. Create Firestore document in 'posts' collection
    3. Set status = 'pending'
    4. Store createdBy with user info
    ↓
Navigate to home/profile
```

**Key Logic:**

```javascript
// Location Detection
useEffect(() => {
  getCurrentPosition()
    .then(({ lat, lng }) => {
      setCoordinates(lat, lng, {
        status: "Location detected from browser",
      });
    })
    .catch(() => {
      setLocStatus("Could not auto-detect location");
    });
}, []);

// Form Validation
const isFormValid = useMemo(() => {
  return (
    title.trim() !== "" &&
    description.trim() !== "" &&
    departmentTag !== "" &&
    lat !== "" &&
    lng !== "" &&
    file !== null
  );
}, [title, description, departmentTag, lat, lng, file]);

// Image Upload to Cloudinary
const uploadImage = () => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", `district-care/${user.uid}`);

    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`
    );

    xhr.upload.addEventListener("progress", (evt) => {
      if (evt.lengthComputable) {
        const percentage = (evt.loaded / evt.total) * 100;
        setProgress(percentage);
      }
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const response = JSON.parse(xhr.responseText);
        resolve({
          imageURL: response.secure_url,
          imageStoragePath: response.public_id,
        });
      }
    };

    xhr.send(formData);
  });
};

// Submit Issue
const handleSubmit = async (e) => {
  e.preventDefault();
  setSubmitting(true);

  try {
    // Upload image
    const { imageURL, imageStoragePath } = await uploadImage();

    // Create post document
    await addDoc(collection(db, "posts"), {
      title,
      description,
      departmentTag,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      address,
      imageURL,
      imageStoragePath,
      status: "pending",
      createdBy: {
        uid: user.uid,
        name: profile.name,
        email: user.email,
      },
      createdAt: serverTimestamp(),
      deleted: false,
    });

    toast({ title: "Issue reported successfully!" });
    navigate("/profile");
  } catch (err) {
    setError(err.message);
  } finally {
    setSubmitting(false);
  }
};
```

**Predefined Issue Titles:**

Issues are categorized by department with predefined titles:

```javascript
const ISSUE_TITLES = {
  Electricity: [
    "Power Outage",
    "Faulty Streetlight",
    "Damaged Transformer",
    "Electric Pole Issue",
    "Wire Damage",
    "Meter Problem",
    "Other Electricity Issue",
  ],
  Water: [
    "No Water Supply",
    "Low Water Pressure",
    "Pipe Leakage",
    "Water Contamination",
    "Broken Valve",
    "Water Wastage",
    "Other Water Issue",
  ],
  Sewage: [
    "Blocked Drain",
    "Sewage Overflow",
    "Manhole Issue",
    "Foul Smell",
    "Drainage Problem",
    "Sanitation Issue",
    "Other Sewage Issue",
  ],
  Road: [
    "Pothole",
    "Road Damage",
    "Traffic Congestion",
    "Accident",
    "Missing Sign",
    "Street Flooding",
    "Broken Footpath",
    "Other Road Issue",
  ],
};
```

### 6.2 Issue Feed (Home.jsx)

**Features:**

- Infinite scroll pagination (6 posts per page)
- Search by text (title/description)
- Filter by status, department, date range
- Real-time updates via `onSnapshot`
- Map visualization of all issues
- Anonymous display for public users (privacy)

**Key Logic:**

```javascript
// Real-time listener for all posts
useEffect(() => {
  const q = query(collection(db, "posts"));
  const unsub = onSnapshot(q, (snap) => {
    let posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Filter out deleted posts for non-admin
    if (!isSuperAdmin) {
      posts = posts.filter((p) => !p.deleted && p.status !== "deleted");
    }

    setTotalDocs(posts.length);
    setAllPosts(posts); // For map display
  });

  return () => unsub();
}, []);

// Paginated loading
const loadInitial = async () => {
  setIsLoading(true);

  const q = query(
    collection(db, "posts"),
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE * 3) // Fetch extra for smooth scrolling
  );

  const snapshot = await getDocs(q);
  let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Filter for role
  if (!isSuperAdmin) {
    list = list.filter((p) => !p.deleted && p.status !== "deleted");
  }

  const pageList = list.slice(0, PAGE_SIZE);
  setPosts(pageList);
  setLastVisible(snapshot.docs[snapshot.docs.length - 1]);

  setIsLoading(false);
};

// Search with filters
const fetchSearch = async () => {
  let q = query(collection(db, "posts"));
  const constraints = [];

  if (appliedDept) {
    constraints.push(where("departmentTag", "==", appliedDept));
  }

  if (appliedStatus) {
    constraints.push(where("status", "==", appliedStatus));
  }

  if (appliedFrom || appliedTo) {
    // Date filtering in JavaScript after fetch
  }

  q = query(
    collection(db, "posts"),
    ...constraints,
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE * 2)
  );

  const snapshot = await getDocs(q);
  let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Text search in JavaScript
  if (appliedSearch.trim()) {
    const searchLower = appliedSearch.toLowerCase();
    list = list.filter(
      (p) =>
        p.title?.toLowerCase().includes(searchLower) ||
        p.description?.toLowerCase().includes(searchLower)
    );
  }

  setPosts(list.slice(0, PAGE_SIZE));
};
```

**Privacy Protection:**

For non-admin users, creator details are anonymized:

```javascript
const displayName = isAdmin
  ? post?.createdBy?.name || "Unknown"
  : "anonymous user";
```

### 6.3 Issue Detail (IssueDetail.jsx)

**Displays:**

- Full issue information
- Location map with marker
- Status history timeline
- Verification controls (for issue creator)
- Image uploads for verification/rejection

**Verification Workflow (Citizen):**

```javascript
const handleVerify = async () => {
  setIsSubmitting(true);

  try {
    // Upload verification image if provided
    const { imageURL } = verificationImage
      ? await uploadVerificationImage()
      : { imageURL: "" };

    // Update post status
    const updateData = {
      status: "resolved_verified",
      verificationStatus: "verified",
      verificationImage: imageURL,
      verificationNote: verificationComment,
      verificationDate: Timestamp.now(),
      verifiedBy: {
        uid: user.uid,
        name: profile.name,
      },
    };

    // Add to status history
    const statusHistoryEntry = {
      status: "resolved_verified",
      changedBy: { uid: user.uid, name: profile.name },
      timestamp: new Date().toISOString(),
      note: verificationComment,
    };
    updateData.statusHistory = arrayUnion(statusHistoryEntry);

    await updateDoc(doc(db, "posts", issue.id), updateData);

    // Notify admins
    await notifyAdminsVerification(
      issue.departmentTag,
      issue.id,
      issue.title,
      "verified",
      profile.name
    );

    toast({ title: "Issue verified successfully!" });
  } catch (err) {
    toast({ title: "Error", description: err.message });
  } finally {
    setIsSubmitting(false);
  }
};
```

**Rejection/Reopening:**

```javascript
const handleReopen = async () => {
  // Similar to verify but sets status to "pending"
  // Adds rejection reason and note
  // Notifies admins about reopening
};
```

### 6.4 User Profile (Profile.jsx)

**Features:**

- Display user information (name, email, role)
- Edit profile name
- Change password
- View user's posted issues (paginated)
- Toggle between "live" and "deleted" posts
- Delete own posts

**Key Logic:**

```javascript
// Fetch user's posts
useEffect(() => {
  if (!user) return;

  const fetchPosts = async () => {
    const q = query(
      collection(db, "posts"),
      where("createdBy.uid", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );

    const snapshot = await getDocs(q);
    let posts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Filter by active tab
    if (activeTab === "live") {
      posts = posts.filter((p) => !p.deleted);
    } else {
      posts = posts.filter((p) => p.deleted);
    }

    setUserPosts(posts);
  };

  fetchPosts();
}, [user, activeTab]);

// Update name
const handleUpdateName = async () => {
  // Update Firebase Auth
  await updateProfile(user, { displayName: newName });

  // Update Firestore
  await updateDoc(doc(db, "users", user.uid), { name: newName });

  toast({ title: "Name updated successfully!" });
};

// Change password
const handleUpdatePassword = async () => {
  if (newPassword !== confirmPassword) {
    toast({ title: "Passwords don't match" });
    return;
  }

  await updatePassword(user, newPassword);
  toast({ title: "Password updated!" });
};
```

---

## 7. Status Workflow

### Status Diagram

```
[pending] (Initial state when citizen creates issue)
    ↓ (Department admin changes)
[in_progress] (Department working on it)
    ↓ (Department admin marks as resolved)
[resolved_pending_verification] (Awaiting citizen verification)
    ↓
    ├─→ [resolved_verified] (Citizen confirms fix) ✅ FINAL
    └─→ [rejected] → [pending] (Citizen rejects, reopens)
```

### State Transitions

| From Status                   | To Status                     | Who Can Change    | Trigger          |
| ----------------------------- | ----------------------------- | ----------------- | ---------------- |
| pending                       | in_progress                   | Dept Admin        | Start working    |
| pending                       | rejected                      | Dept Admin        | Cannot fix       |
| in_progress                   | resolved_pending_verification | Dept Admin        | Mark as resolved |
| resolved_pending_verification | resolved_verified             | Citizen (creator) | Verify fix       |
| resolved_pending_verification | rejected/pending              | Citizen (creator) | Reject fix       |

### Implementation (DashboardDept.jsx)

**Department Admin Updates Status:**

```javascript
const handleStatusUpdate = async (postId, newStatus, actionNote) => {
  try {
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);
    const post = postSnap.data();

    const updateData = {
      status: newStatus,
      actionNote: actionNote || "",
    };

    if (newStatus === "in_progress") {
      updateData.startedAt = Timestamp.now();
      updateData.startedBy = {
        uid: user.uid,
        name: profile.name,
        email: user.email,
      };
    }

    if (newStatus === "resolved_pending_verification") {
      updateData.resolvedAt = Timestamp.now();
      updateData.resolvedBy = {
        uid: user.uid,
        name: profile.name,
        email: user.email,
      };
    }

    // Add to status history
    const statusHistoryEntry = {
      status: newStatus,
      changedBy: {
        uid: user.uid,
        name: profile.name,
      },
      timestamp: new Date().toISOString(),
      note: actionNote,
    };
    updateData.statusHistory = arrayUnion(statusHistoryEntry);

    await updateDoc(postRef, updateData);

    // Send notification to citizen
    await notifyUserStatusChange(
      post.createdBy.uid,
      postId,
      post.title,
      post.status,
      newStatus,
      actionNote
    );

    toast({ title: "Status updated successfully!" });
  } catch (err) {
    toast({ title: "Error", description: err.message });
  }
};
```

---

## 8. Notification System

### Architecture (lib/notifications.js)

**Types of Notifications:**

1. **status_change** - When admin changes issue status
2. **verification** - When citizen verifies or reopens issue
3. **new_issue** - When new issue created (for admins)

### Notification Creation

```javascript
// Generic notification creator
export async function createNotification(notification) {
  await addDoc(collection(db, "notifications"), {
    ...notification,
    read: false,
    createdAt: serverTimestamp(),
  });
}

// Notify user about status change
export async function notifyUserStatusChange(
  userId,
  issueId,
  issueTitle,
  oldStatus,
  newStatus,
  actionNote
) {
  await createNotification({
    recipientId: userId,
    recipientRole: "public",
    type: "status_change",
    title: "Issue Status Updated",
    message: `Your issue "${issueTitle}" status changed to ${newStatus}${
      actionNote ? `: ${actionNote}` : ""
    }`,
    issueId,
    metadata: { oldStatus, newStatus, actionNote },
  });
}

// Notify admins about verification
export async function notifyAdminsVerification(
  department,
  issueId,
  issueTitle,
  action,
  userName,
  comment = ""
) {
  await createNotification({
    recipientId: "all",
    recipientRole: "dept", // Or "admin"
    type: "verification",
    title: action === "verified" ? "Issue Verified" : "Issue Reopened",
    message: `User ${userName} ${action} issue "${issueTitle}"`,
    issueId,
    metadata: { department, action, comment },
  });
}
```

### Real-time Subscription (NotificationBell.jsx)

```javascript
export function subscribeToNotifications(userId, userRole, callback) {
  let q;

  if (userRole === "public") {
    // Public users see notifications addressed to them
    q = query(
      collection(db, "notifications"),
      where("recipientId", "==", userId),
      orderBy("createdAt", "desc")
    );
  } else if (userRole === "dept" || userRole === "admin") {
    // Admins see notifications for their role or "all"
    q = query(
      collection(db, "notifications"),
      where("recipientRole", "in", [userRole, "all"]),
      orderBy("createdAt", "desc")
    );
  }

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    callback(notifications);
  });
}

// Mark as read
export async function markNotificationAsRead(notificationId) {
  await updateDoc(doc(db, "notifications", notificationId), {
    read: true,
  });
}
```

### UI Component

```javascript
function NotificationBell() {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user || !profile) return;

    const unsubscribe = subscribeToNotifications(
      user.uid,
      profile.role,
      setNotifications
    );

    return () => unsubscribe();
  }, [user, profile]);

  return (
    <Popover>
      <PopoverTrigger>
        <IconButton icon={<BellIcon />}>
          {unreadCount > 0 && <Badge colorScheme="red">{unreadCount}</Badge>}
        </IconButton>
      </PopoverTrigger>
      <PopoverContent>
        {notifications.map((notif) => (
          <Box key={notif.id} onClick={() => markAsRead(notif.id)}>
            <Text fontWeight="bold">{notif.title}</Text>
            <Text>{notif.message}</Text>
          </Box>
        ))}
      </PopoverContent>
    </Popover>
  );
}
```

---

## 9. Voting System

### Architecture

- **Votes stored as subcollection** under each post: `posts/{postId}/votes/{userId}`
- **Document ID = voter's UID** (ensures one vote per user)
- **Denormalized counts** stored in post document for performance

### Implementation (PostCard.jsx)

```javascript
// Load user's existing vote
useEffect(() => {
  if (!user || !post.id) return;

  const checkUserVote = async () => {
    const voteRef = doc(db, "posts", post.id, "votes", user.uid);
    const voteSnap = await getDoc(voteRef);

    if (voteSnap.exists()) {
      setUserVote(voteSnap.data().voteType); // "up" or "down"
    }
  };

  checkUserVote();
}, [user, post.id]);

// Real-time vote count listeners
useEffect(() => {
  if (!post.id) return;

  const votesRef = collection(db, "posts", post.id, "votes");

  const upvotesQuery = query(votesRef, where("voteType", "==", "up"));
  const downvotesQuery = query(votesRef, where("voteType", "==", "down"));

  const unsubUp = onSnapshot(upvotesQuery, (snap) => {
    setUpvotes(snap.size);
  });

  const unsubDown = onSnapshot(downvotesQuery, (snap) => {
    setDownvotes(snap.size);
  });

  return () => {
    unsubUp();
    unsubDown();
  };
}, [post.id]);

// Handle vote action
const handleVote = async (voteType) => {
  if (!canVote) return; // Only public users can vote

  setIsVoting(true);

  try {
    const voteRef = doc(db, "posts", post.id, "votes", user.uid);
    const voteSnap = await getDoc(voteRef);

    if (voteSnap.exists()) {
      const existingVote = voteSnap.data().voteType;

      if (existingVote === voteType) {
        // Remove vote if clicking same button
        await deleteDoc(voteRef);
        setUserVote(null);
      } else {
        // Change vote type
        await setDoc(voteRef, {
          voteType,
          userId: user.uid,
          createdAt: new Date(),
        });
        setUserVote(voteType);
      }
    } else {
      // New vote
      await setDoc(voteRef, {
        voteType,
        userId: user.uid,
        createdAt: new Date(),
      });
      setUserVote(voteType);
    }
  } catch (err) {
    console.error("Error voting:", err);
    toast({ title: "Error voting", description: err.message });
  } finally {
    setIsVoting(false);
  }
};
```

### Why Subcollection?

**Advantages:**

- Scales to millions of votes
- Each vote is a separate document (can store metadata like timestamp)
- Easy to query votes by user
- Automatic cleanup when post deleted (if using cascade delete)

**Alternative (not used):**

- Store `votedBy` array in post document → limited to 1MB total, not scalable

---

## 10. Analytics & Dashboards

### 10.1 Super Admin Dashboard (Dashboard.jsx)

**Shows:**

- **Overview Stats:**

  - Total issues
  - Pending verification count
  - Verified & closed count
  - Pending count
  - In progress count

- **Charts:**

  - Issues by department (pie chart)
  - Issues by status (bar chart)
  - Reporting trend over time (line chart with department breakdown)
  - Average resolution time per department (bar chart)
  - Recent activity timeline

- **Map:** All issues across all departments

**Key Logic:**

```javascript
const fetchAnalytics = async () => {
  const postsRef = collection(db, "posts");
  let q = query(postsRef);

  // Apply time range filter
  if (timeRange !== "all") {
    const daysAgo = timeRange === "7days" ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);
    q = query(postsRef, where("createdAt", ">=", startDate));
  }

  const snapshot = await getDocs(q);
  const posts = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((post) => !post.deleted);

  // Calculate stats
  const total = posts.length;

  // By Department
  const deptCounts = { Electricity: 0, Water: 0, Sewage: 0, Road: 0 };
  posts.forEach((post) => {
    if (deptCounts.hasOwnProperty(post.departmentTag)) {
      deptCounts[post.departmentTag]++;
    }
  });

  // By Status
  const statusCounts = {
    pending: 0,
    in_progress: 0,
    resolved_pending_verification: 0,
    resolved_verified: 0,
    rejected: 0,
  };
  posts.forEach((post) => {
    if (statusCounts.hasOwnProperty(post.status)) {
      statusCounts[post.status]++;
    }
  });

  // Reporting trend (monthly/weekly/daily based on time range)
  const monthCounts = {};
  posts.forEach((post) => {
    if (post.createdAt?.toDate) {
      const date = post.createdAt.toDate();
      const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

      if (!monthCounts[monthKey]) {
        monthCounts[monthKey] = {
          period: monthKey,
          Electricity: 0,
          Water: 0,
          Sewage: 0,
          Road: 0,
        };
      }
      monthCounts[monthKey][post.departmentTag]++;
    }
  });

  // Average resolution time per department
  const responseTime = Object.keys(deptCounts).map((dept) => {
    const deptPosts = posts.filter((p) => p.departmentTag === dept);
    const resolvedPosts = deptPosts.filter(
      (p) => p.status === "resolved_verified"
    );

    let avgDays = 0;
    if (resolvedPosts.length > 0) {
      const totalDays = resolvedPosts.reduce((sum, post) => {
        if (post.createdAt?.toDate && post.resolvedAt?.toDate) {
          const diffMs = post.resolvedAt.toDate() - post.createdAt.toDate();
          return sum + diffMs / (1000 * 60 * 60 * 24);
        }
        return sum;
      }, 0);
      avgDays = totalDays / resolvedPosts.length;
    }

    return {
      department: dept,
      avgDays: avgDays.toFixed(1),
      resolvedCount: resolvedPosts.length,
      totalCount: deptPosts.length,
    };
  });

  setStats({
    total,
    byDepartment: Object.entries(deptCounts).map(([name, value]) => ({
      name,
      value,
    })),
    byStatus: Object.entries(statusCounts).map(([name, value]) => ({
      name,
      value,
    })),
    byMonth: Object.values(monthCounts).slice(-6),
    responseTime,
  });
};
```

### 10.2 Department Dashboard (DashboardDept.jsx)

**Department-specific view:**

- Only shows issues for assigned department
- Stats: Total, Pending, In Progress, Resolved (pending + verified), Rejected
- Same charts as super admin but filtered
- **Issue management:**
  - Change status
  - Add action notes
  - Upload resolution images
  - Nearby issues detection

**Key Features:**

```javascript
// Filter by department
useEffect(() => {
  if (!dept) return;

  const q = query(collection(db, "posts"), where("departmentTag", "==", dept));

  const unsub = onSnapshot(q, (snap) => {
    const posts = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((p) => !p.deleted);

    setPosts(posts);
    calculateStats(posts);
  });

  return () => unsub();
}, [dept]);

// Nearby issues detection
const findNearbyIssues = (currentLat, currentLng, radiusKm = 1) => {
  return posts.filter((post) => {
    if (!post.lat || !post.lng) return false;

    const distance = distanceKm(currentLat, currentLng, post.lat, post.lng);

    return distance <= radiusKm && post.id !== currentPostId;
  });
};

// Haversine distance formula
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

### 10.3 Department Analytics (DashboardAnalytics.jsx)

**Similar to DashboardDept but read-only analytics view** (no issue management)

---

## 11. Component Architecture

### 11.1 PostCard.jsx

**Purpose:** Reusable card component for displaying issues

**Features:**

- Issue image with fallback
- Title, description, status badge
- Department icon and tag
- Vote buttons (upvote/downvote)
- Delete button (for own posts)
- Navigation to issue detail

**Props:**

```javascript
<PostCard
  post={postObject}
  onDelete={handleDelete}
  showAsYou={true} // Show "you" instead of "anonymous"
/>
```

### 11.2 IssuesMap.jsx

**Purpose:** Interactive map showing issue locations

**Features:**

- Custom colored markers based on status
- Marker clustering for overlapping locations
- Popup with issue details
- Auto-fit bounds to show all markers
- Status-based legend

**Implementation:**

```javascript
// Custom marker icons with status colors
const createCustomIcon = (color) => {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <svg width="40" height="50">
        <path d="..." fill="${color}" />
        <circle cx="20" cy="18" r="7" fill="white" />
      </svg>
    `,
    iconSize: [40, 50],
    iconAnchor: [20, 50],
  });
};

const statusIcons = {
  pending: createCustomIcon("#d946ef"),
  in_progress: createCustomIcon("#f59e0b"),
  resolved_pending_verification: createCustomIcon("#eab308"),
  resolved_verified: createCustomIcon("#10b981"),
  rejected: createCustomIcon("#dc2626"),
};

// Offset overlapping markers
const postsWithOffset = postsWithLocation.map((post, index) => {
  const duplicates = postsWithLocation.filter(
    (p, i) =>
      i < index &&
      Math.abs(p.lat - post.lat) < 0.0001 &&
      Math.abs(p.lng - post.lng) < 0.0001
  );

  if (duplicates.length > 0) {
    const offset = 0.0002 * duplicates.length;
    return {
      ...post,
      lat: post.lat + offset,
      lng: post.lng + offset,
    };
  }

  return post;
});
```

### 11.3 Chatbot.jsx

**Purpose:** AI-powered assistant using Google Gemini

**Features:**

- Answers questions about civic issues
- Context-aware responses using posts data
- Floating chat button
- Message history

**Implementation:**

```javascript
// Fetch posts when chatbot opens
useEffect(() => {
  if (isOpen && postsData.length === 0) {
    fetchPostsData();
  }
}, [isOpen]);

const fetchPostsData = async () => {
  const q = query(collection(db, "posts"));
  const snapshot = await getDocs(q);

  const posts = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((post) => !post.deleted);

  setPostsData(posts);
};

// Send message to Gemini
const handleSend = async () => {
  const userMessage = { role: "user", content: input };
  setMessages((prev) => [...prev, userMessage]);

  setLoading(true);

  try {
    const response = await generateChatResponse(input, postsData);

    const botMessage = { role: "bot", content: response };
    setMessages((prev) => [...prev, botMessage]);
  } catch (err) {
    setMessages((prev) => [
      ...prev,
      {
        role: "bot",
        content: `Error: ${err.message}`,
      },
    ]);
  } finally {
    setLoading(false);
  }
};
```

**Gemini Integration (lib/gemini.js):**

```javascript
export const generateChatResponse = async (userMessage, postsData) => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  // Create context from posts
  const context = createContextFromPosts(postsData);

  const systemPrompt = `You are the District Care Assistant...
  
  The structured issue data is provided below:
  ${context}
  
  Respond in a helpful, clear manner.`;

  const result = await model.generateContent([
    { text: systemPrompt },
    { text: userMessage },
  ]);

  return result.response.text();
};

function createContextFromPosts(posts) {
  return posts
    .map(
      (post, i) => `
    Issue ${i + 1}:
    - Department: ${post.departmentTag}
    - Title: ${post.title}
    - Status: ${post.status}
    - Location: ${post.address || "Unknown"}
    - Votes: ${post.upvotes || 0} upvotes, ${post.downvotes || 0} downvotes
  `
    )
    .join("\n");
}
```

### 11.4 Header.jsx

**Purpose:** Navigation bar with auth state

**Features:**

- Logo and app name
- Navigation links (Home, Feed, Create, Dashboard)
- User menu with profile/logout
- Notification bell
- Role-based badge (Admin/Dept/Public)
- Mobile responsive menu

**Key Logic:**

```javascript
function Header() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const isDept = profile?.role === "dept";

  return (
    <Box as="header" bg="white" boxShadow="sm">
      <Container maxW="container.xl">
        <Flex justify="space-between" align="center">
          {/* Logo */}
          <Link to="/">
            <Heading size={{ base: "sm", md: "lg" }}>District Care</Heading>
          </Link>

          {/* Desktop Nav */}
          <HStack display={{ base: "none", md: "flex" }}>
            <Link to="/">Home</Link>
            <Link to="/feed">Feed</Link>

            {user && profile?.role === "public" && (
              <Link to="/create-post">Report Issue</Link>
            )}

            {(isAdmin || isDept) && <Link to="/dashboard">Dashboard</Link>}
          </HStack>

          {/* User Menu */}
          {user ? (
            <HStack>
              {/* Role Badge */}
              <Badge
                colorScheme={isAdmin ? "purple" : isDept ? "blue" : "green"}
              >
                {profile?.role?.toUpperCase()}
              </Badge>

              {/* Notification Bell */}
              <NotificationBell />

              {/* Profile Menu */}
              <Menu>
                <MenuButton as={Button}>
                  {profile?.name || user.email}
                </MenuButton>
                <MenuList>
                  <MenuItem onClick={() => navigate("/profile")}>
                    Profile
                  </MenuItem>
                  <MenuItem onClick={() => signOut(auth)}>Logout</MenuItem>
                </MenuList>
              </Menu>
            </HStack>
          ) : (
            <HStack>
              <Button onClick={() => navigate("/login")}>Login</Button>
              <Button onClick={() => navigate("/signup")}>Sign Up</Button>
            </HStack>
          )}
        </Flex>
      </Container>
    </Box>
  );
}
```

### 11.5 PrivateRoute.jsx

**Purpose:** Protect routes that require authentication

**Implementation:**

```javascript
function PrivateRoute({ children, allowedRoles = [] }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <Spinner />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(profile?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Usage in App.jsx
<Route
  path="/dashboard"
  element={
    <PrivateRoute allowedRoles={["admin"]}>
      <Dashboard />
    </PrivateRoute>
  }
/>;
```

---

## 12. Security Rules

### Firestore Security Rules (firestore.rules)

**Key Principles:**

1. **Role-based access control** using custom functions
2. **Field-level validation** with `changedKeys().hasOnly()`
3. **No hard deletes** - only soft deletes allowed
4. **Ownership checks** - users can only modify their own data

**Helper Functions:**

```javascript
function isSignedIn() {
  return request.auth != null;
}

function userDoc(uid) {
  return get(/databases/$(database)/documents/users/$(uid));
}

function userRole() {
  return isSignedIn() ? userDoc(request.auth.uid).data.role : null;
}

function userDept() {
  return isSignedIn() ? userDoc(request.auth.uid).data.department : null;
}
```

**Posts Collection Rules:**

```javascript
match /posts/{postId} {
  // Everyone can read
  allow read: if true;

  // Public users create (must start as pending)
  allow create: if isSignedIn()
    && userRole() == 'public'
    && request.resource.data.createdBy.uid == request.auth.uid
    && request.resource.data.status == 'pending';

  // Admin/Dept can update status
  allow update: if isSignedIn()
    && (
      userRole() == 'admin' ||
      (userRole() == 'dept' && userDept() == resource.data.departmentTag)
    )
    && request.resource.data.diff(resource.data).changedKeys().hasOnly([
      'status', 'actionNote', 'resolvedAt', 'resolutionImage',
      'resolutionNote', 'resolutionDate', 'resolvedBy',
      'verificationImage', 'verificationNote', 'verificationDate',
      'verifiedBy', 'rejectionReason', 'rejectionNote', 'statusHistory'
    ]);

  // Public users can verify their own issues
  allow update: if isSignedIn()
    && userRole() == 'public'
    && request.auth.uid == resource.data.createdBy.uid
    && resource.data.status == 'resolved_pending_verification'
    && request.resource.data.diff(resource.data).changedKeys().hasOnly([
      'status', 'verificationImage', 'verificationNote',
      'verificationDate', 'verifiedBy'
    ]);

  // Admin can soft-delete any post
  allow update: if isSignedIn()
    && userRole() == 'admin'
    && request.resource.data.diff(resource.data).changedKeys().hasOnly([
      'deleted', 'deletedAt', 'status'
    ]);

  // Public users can soft-delete own posts
  allow update: if isSignedIn()
    && userRole() == 'public'
    && request.auth.uid == resource.data.createdBy.uid
    && request.resource.data.diff(resource.data).changedKeys().hasOnly([
      'deleted', 'deletedAt', 'status'
    ]);

  // No hard deletes
  allow delete: if false;
}
```

**Votes Subcollection:**

```javascript
match /votes/{voteId} {
  allow read: if true;
  allow create, update: if isSignedIn() && request.auth.uid == voteId;
  allow delete: if isSignedIn() && request.auth.uid == voteId;
}
```

**Users Collection:**

```javascript
match /users/{userId} {
  // Users read own doc, admins read all
  allow read: if isSignedIn() && request.auth.uid == userId;
  allow read: if isSignedIn() && userRole() == 'admin';

  // New users create own profile (must be public role)
  allow create: if isSignedIn()
    && request.auth.uid == userId
    && request.resource.data.role == 'public';

  // Admin can create any user
  allow create: if isSignedIn() && userRole() == 'admin';

  // Users update own profile, admins update all
  allow update: if isSignedIn()
    && (request.auth.uid == userId || userRole() == 'admin');

  allow delete: if false;
}
```

**Notifications Collection:**

```javascript
match /notifications/{notificationId} {
  // Users read own notifications, admins read role-based
  allow read: if isSignedIn()
    && (
      request.auth.uid == resource.data.recipientId
      || (
        (userRole() == 'admin' || userRole() == 'dept')
        && (resource.data.recipientRole == userRole() || resource.data.recipientRole == 'all')
      )
    );

  // Anyone signed in can create notifications
  allow create: if isSignedIn();

  // Users can mark own notifications as read
  allow update: if isSignedIn()
    && (
      request.auth.uid == resource.data.recipientId
      || (
        (userRole() == 'admin' || userRole() == 'dept')
        && (resource.data.recipientRole == userRole() || resource.data.recipientRole == 'all')
      )
    )
    && request.resource.data.diff(resource.data).changedKeys().hasOnly(['read']);

  allow delete: if false;
}
```

---

## Summary

This District Care application provides a **complete civic grievance management system** with:

✅ **Multi-role system** (Public, Dept Admin, Super Admin)  
✅ **Two-stage verification workflow** (Dept resolution → Citizen verification)  
✅ **Real-time updates** via Firestore listeners  
✅ **Voting system** for community prioritization  
✅ **Notification system** for all stakeholders  
✅ **Analytics dashboards** for performance monitoring  
✅ **Location-based issue mapping**  
✅ **AI-powered chatbot** for assistance  
✅ **Secure role-based access control**  
✅ **Responsive mobile-friendly UI**

The system successfully addresses the core needs of civic issue management while maintaining security, scalability, and user experience.
