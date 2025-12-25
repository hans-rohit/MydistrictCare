import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Create a notification in Firestore
 * @param {Object} notification - The notification object
 * @param {string} notification.recipientId - User ID or 'all' for broadcast
 * @param {string} notification.recipientRole - 'public', 'dept', 'admin', or 'all'
 * @param {string} notification.type - 'status_change', 'verification', 'new_issue', etc.
 * @param {string} notification.title - Notification title
 * @param {string} notification.message - Notification message
 * @param {string} notification.issueId - Related issue/post ID
 * @param {Object} notification.metadata - Additional data (status, department, etc.)
 */
export async function createNotification(notification) {
  try {
    await addDoc(collection(db, "notifications"), {
      ...notification,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Error creating notification:", err);
    throw err;
  }
}

/**
 * Notify user when admin changes status
 * @param {string} userId - User ID to notify
 * @param {string} issueId - Issue ID
 * @param {string} issueTitle - Issue title
 * @param {string} oldStatus - Previous status
 * @param {string} newStatus - New status
 * @param {string} actionNote - Admin's note
 */
export async function notifyUserStatusChange(
  userId,
  issueId,
  issueTitle,
  oldStatus,
  newStatus,
  actionNote
) {
  const statusLabels = {
    pending: "Pending",
    in_progress: "In Progress",
    resolved_pending_verification: "Resolved - Pending Verification",
    resolved_verified: "Resolved & Verified",
    rejected: "Rejected",
  };

  await createNotification({
    recipientId: userId,
    recipientRole: "public",
    type: "status_change",
    title: "Issue Status Updated",
    message: `Your issue "${issueTitle}" status changed to ${
      statusLabels[newStatus] || newStatus
    }${actionNote ? `: ${actionNote}` : ""}`,
    issueId,
    metadata: {
      oldStatus,
      newStatus,
      actionNote,
    },
  });
}

/**
 * Notify admins when user verifies or reopens an issue
 * @param {string} department - Department name
 * @param {string} issueId - Issue ID
 * @param {string} issueTitle - Issue title
 * @param {string} action - 'verified' or 'reopened'
 * @param {string} userName - User's name
 * @param {string} comment - User's comment (for reopened issues)
 */
export async function notifyAdminsVerification(
  department,
  issueId,
  issueTitle,
  action,
  userName,
  comment = ""
) {
  const title =
    action === "verified" ? "Issue Verified by User" : "Issue Reopened by User";
  const message =
    action === "verified"
      ? `${userName} verified the resolution of "${issueTitle}"`
      : `${userName} marked "${issueTitle}" as unresolved${
          comment ? `: ${comment}` : ""
        }`;

  await createNotification({
    recipientId: "all",
    recipientRole: "dept",
    type: "verification",
    title,
    message,
    issueId,
    metadata: {
      department,
      action,
      userName,
      comment,
    },
  });
}

/**
 * Notify department admins about new issue reports
 * @param {string} department - Department name
 * @param {string} issueId - Issue ID
 * @param {string} issueTitle - Issue title
 * @param {string} userName - Reporter's name
 */
export async function notifyAdminsNewIssue(
  department,
  issueId,
  issueTitle,
  userName
) {
  await createNotification({
    recipientId: "all",
    recipientRole: "dept",
    type: "new_issue",
    title: "New Issue Reported",
    message: `${userName} reported: "${issueTitle}"`,
    issueId,
    metadata: {
      department,
      userName,
    },
  });
}

/**
 * Subscribe to notifications for a user
 * @param {string} userId - User ID
 * @param {string} userRole - User role ('public', 'dept', 'admin')
 * @param {function} callback - Callback function to handle notifications
 * @returns {function} Unsubscribe function
 */
export function subscribeToNotifications(userId, userRole, callback) {
  const notificationsRef = collection(db, "notifications");

  let q;
  if (userRole === "public") {
    // Public users see notifications addressed to them
    q = query(
      notificationsRef,
      where("recipientId", "==", userId),
      orderBy("createdAt", "desc")
    );
  } else if (userRole === "dept" || userRole === "admin") {
    // Admins see notifications for their role or addressed to all
    q = query(
      notificationsRef,
      where("recipientRole", "in", [userRole, "all"]),
      orderBy("createdAt", "desc")
    );
  } else {
    return () => {}; // No notifications for unknown roles
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      callback(notifications);
    },
    (error) => {
      console.error("Error subscribing to notifications:", error);
    }
  );
}

/**
 * Mark a notification as read
 * @param {string} notificationId - Notification ID
 */
export async function markNotificationAsRead(notificationId) {
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true,
    });
  } catch (err) {
    console.error("Error marking notification as read:", err);
  }
}
