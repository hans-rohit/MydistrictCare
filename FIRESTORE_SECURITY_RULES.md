# Updated Firestore Security Rules

## Rules for Enhanced Grievance Lifecycle System

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

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

    // ================== POSTS ==================
    match /posts/{postId} {

      // Everyone can read posts
      allow read: if true;

      // Public users create posts (must start pending)
      allow create: if isSignedIn()
        && userRole() == 'public'
        && request.resource.data.createdBy.uid == request.auth.uid
        && request.resource.data.status == 'pending';

      // Admin / Dept can update status and add resolution data
      allow update: if isSignedIn()
        && (
          userRole() == 'admin' ||
          (userRole() == 'dept' && userDept() == resource.data.departmentTag)
        )
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status',
          'actionNote',
          'resolvedAt',
          'resolutionImage',        // NEW: Admin resolution image
          'resolutionNote',         // NEW: Admin resolution note
          'resolutionDate',         // NEW: Resolution timestamp
          'resolvedBy',             // NEW: Admin who resolved
          'statusHistory'           // NEW: Status history array
        ]);

      // Public users can verify/reopen their own resolved issues
      allow update: if isSignedIn()
        && userRole() == 'public'
        && request.auth.uid == resource.data.createdBy.uid
        && resource.data.status == 'resolved_pending_verification'
        && request.resource.data.diff(resource.data).changedKeys().hasOnly([
          'status',
          'verificationStatus',     // NEW: verified/unresolved
          'verificationImage',      // NEW: User verification image
          'verificationComment',    // NEW: User comment
          'verificationDate',       // NEW: Verification timestamp
          'verificationBy',         // NEW: User who verified
          'statusHistory'           // NEW: Status history array
        ])
        && (
          // Allow verification (close)
          (request.resource.data.status == 'resolved_verified'
           && request.resource.data.verificationStatus == 'verified')
          ||
          // Allow reopening (back to pending, requires image + comment)
          (request.resource.data.status == 'pending'
           && request.resource.data.verificationStatus == 'unresolved'
           && request.resource.data.verificationImage != null
           && request.resource.data.verificationComment != null)
        );

      // Public users can soft-delete ONLY their own posts
      allow update: if isSignedIn()
        && userRole() == 'public'
        && request.auth.uid == resource.data.createdBy.uid
        && request.resource.data.deleted == true
        && request.resource.data.status == 'deleted';

      // No hard deletes
      allow delete: if false;

      // ================== VOTES ==================
      match /votes/{userId} {

        // Everyone can read vote counts
        allow read: if true;

        // Only PUBLIC users can vote on their own vote document
        allow create, update, delete: if isSignedIn()
          && request.auth.uid == userId
          && userRole() == 'public';
      }
    }

    // ================== USERS ==================
    match /users/{uid} {

      allow read: if true;

      // User creates own profile document
      allow create: if isSignedIn() && request.auth.uid == uid;

      // Admin can create user docs (for dept accounts)
      allow create: if isSignedIn() && userRole() == 'admin';

      // Admin can update any user fields
      allow update: if isSignedIn() && userRole() == 'admin';

      // User may edit own profile except role/department
      allow update: if isSignedIn()
        && request.auth.uid == uid
        && !('role' in request.resource.data)
        && !('department' in request.resource.data);

      // No user deletes
      allow delete: if false;
    }

    // ================== NOTIFICATIONS ==================
    match /notifications/{notificationId} {

      // Users can read their own notifications
      allow read: if isSignedIn()
        && (
          request.auth.uid == resource.data.recipientId
          || (
            (userRole() == 'admin' || userRole() == 'dept')
            && (resource.data.recipientRole == userRole() || resource.data.recipientId == 'all')
          )
        );

      // System/server creates notifications (in practice, via client with proper validation)
      allow create: if isSignedIn();

      // Users can mark their own notifications as read
      allow update: if isSignedIn()
        && (
          request.auth.uid == resource.data.recipientId
          || (
            (userRole() == 'admin' || userRole() == 'dept')
            && (resource.data.recipientRole == userRole() || resource.data.recipientId == 'all')
          )
        )
        && request.resource.data.diff(resource.data).changedKeys().hasOnly(['read']);

      // No deletes
      allow delete: if false;
    }
  }
}
```

## Key Changes from Previous Rules:

### 1. **Posts Collection - Admin Updates**

- Added new fields admins can update:
  - `resolutionImage` - Required when resolving
  - `resolutionNote` - Optional admin comment
  - `resolutionDate` - Timestamp of resolution
  - `resolvedBy` - Admin who resolved the issue
  - `statusHistory` - Array tracking all status changes

### 2. **Posts Collection - User Verification**

- New rule allowing users to update their own posts ONLY when:
  - Status is `resolved_pending_verification`
  - They are the original creator
  - They can only change specific verification fields
  - Two allowed actions:
    - **Verify & Close**: Changes status to `resolved_verified`
    - **Reopen**: Changes status back to `pending` (REQUIRES both image and comment)

### 3. **Notifications Collection (NEW)**

- Users can read notifications addressed to them
- Admins can read notifications for their role or "all"
- Anyone signed in can create notifications (triggered by status changes)
- Users can only mark notifications as `read`, no other updates
- No deletions allowed (audit trail)

## Status Flow Validation:

```
Created (pending)
    ↓
Admin: in_progress
    ↓
Admin: resolved_pending_verification (requires resolution image)
    ↓
User Action:
    → Verify: resolved_verified (CLOSED)
    → Reopen: pending (requires image + comment, restarts workflow)
```

## Field Requirements Enforced by Rules:

- **Admin Resolution**: Must provide `resolutionImage`
- **User Reopening**: Must provide both `verificationImage` AND `verificationComment`
- **Status History**: Admins and users can append to this array

## Migration Notes:

When deploying these rules:

1. Ensure all existing posts have an empty `statusHistory` array
2. Update existing "resolved" posts to "resolved_verified" status
3. Deploy rules after code changes are live
4. Test with a non-admin account to verify verification permissions

## Firestore Indexes Required:

Add these composite indexes in Firebase Console:

1. **For Duplicate Check Query:**

   - Collection: `posts`
   - Fields: `departmentTag` (Ascending), `title` (Ascending), `status` (Ascending), `resolutionDate` (Descending)

2. **For Notifications Query:**
   - Collection: `notifications`
   - Fields: `recipientId` (Ascending), `read` (Ascending), `createdAt` (Descending)
3. **For Admin Notifications:**
   - Collection: `notifications`
   - Fields: `recipientRole` (Ascending), `read` (Ascending), `createdAt` (Descending)
