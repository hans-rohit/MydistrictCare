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
import { db } from "./firebase";

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

export async function notifyUserStatusChange(
  userId,
  issueId,
  issueTitle,
  oldStatus,
  newStatus,
  actionNote,
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

export async function notifyAdminsVerification(
  department,
  issueId,
  issueTitle,
  action,
  userName,
  comment = "",
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

export async function notifyAdminsNewIssue(
  department,
  issueId,
  issueTitle,
  userName,
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

export function subscribeToNotifications(userId, userRole, callback) {
  const notificationsRef = collection(db, "notifications");

  let q;
  if (userRole === "public") {
    q = query(
      notificationsRef,
      where("recipientId", "==", userId),
      orderBy("createdAt", "desc"),
    );
  } else if (userRole === "dept" || userRole === "admin") {
    q = query(
      notificationsRef,
      where("recipientRole", "in", [userRole, "all"]),
      orderBy("createdAt", "desc"),
    );
  } else {
    return () => {};
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
    },
  );
}

export async function markNotificationAsRead(notificationId) {
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true,
    });
  } catch (err) {
    console.error("Error marking notification as read:", err);
  }
}
