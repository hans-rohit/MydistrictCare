# Firestore Security Rules Update Required

## Voting Permissions

To enable the voting feature, you need to update your Firestore security rules to allow users to create, read, and delete votes in the `posts/{postId}/votes` subcollection.

Add the following rules to your `firestore.rules` file:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Posts collection
    match /posts/{postId} {
      allow read: if request.auth != null || true;
      allow create: if request.auth != null;
      allow update: if request.auth != null && (
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'actionNote']) ||
        resource.data.createdBy.uid == request.auth.uid
      );
      allow delete: if false; // Soft delete only
      
      // Votes subcollection
      match /votes/{userId} {
        allow read: if true; // Anyone can read vote counts
        allow create: if request.auth != null && 
                       request.auth.uid == userId &&
                       !get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
        allow update: if request.auth != null && 
                       request.auth.uid == userId &&
                       !get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
        allow delete: if request.auth != null && 
                       request.auth.uid == userId &&
                       !get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
      }
    }
    
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Soft Delete Field

Posts should have a `deleted` field (boolean) and `deletedAt` field (timestamp) for soft delete functionality.

## Super-Admin Role

If you want to distinguish super-admin from regular admin, you can:
1. Add a `superAdmin: true` field to the user document, OR
2. Use `role: 'super-admin'` in the user document

Update the rules accordingly to allow super-admin to see deleted posts.

