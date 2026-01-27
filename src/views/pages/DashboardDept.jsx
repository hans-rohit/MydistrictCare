import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  updateDoc,
  getDocs,
  limit,
  startAfter,
  Timestamp,
  deleteField,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../../models/firebase";
import { useAuth } from "../../controllers/AuthContext";
import {
  Container,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Box,
  Select,
  Textarea,
  Button,
  Input,
  InputGroup,
  InputLeftElement,
  VStack,
  HStack,
  useToast,
  Alert,
  AlertIcon,
  Text,
  Link,
  Skeleton,
  SkeletonText,
  Spinner,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  useDisclosure,
  Progress,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import PostCard from "../components/PostCard";
import IssuesMap from "../components/IssuesMap";
import { notifyUserStatusChange } from "../../models/notifications";
import {
  getCurrentPosition,
  distanceKm,
  googleMapsLink,
} from "../../models/location";

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

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_FOLDER =
  import.meta.env.VITE_CLOUDINARY_FOLDER || "district-care/resolution-images";

export default function DashboardDept({ fixedDept }) {
  const params = useParams();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const routeDept = params.dept;
  const { user, profile, loading } = useAuth();

  const dept = fixedDept || routeDept || profile?.department || null;

  const [posts, setPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [error, setError] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const [noteMap, setNoteMap] = useState({});
  const [myLoc, setMyLoc] = useState(null);
  const [locMsg, setLocMsg] = useState("");
  const [totalDocs, setTotalDocs] = useState(0);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
    resolved_pending_verification: 0,
    resolved_verified: 0,
    rejected: 0,
    deleted: 0,
  });
  const [lastVisible, setLastVisible] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const loadMoreRef = useRef(null);

  const [searchLastVisible, setSearchLastVisible] = useState(null);
  const [searchHasMore, setSearchHasMore] = useState(true);
  const [searchIsFetchingMore, setSearchIsFetchingMore] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  const PAGE_SIZE = 6;
  const toast = useToast();

  const {
    isOpen: isResolutionModalOpen,
    onOpen: onResolutionModalOpen,
    onClose: onResolutionModalClose,
  } = useDisclosure();
  const [resolvingPostId, setResolvingPostId] = useState(null);
  const [resolutionImage, setResolutionImage] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolutionProgress, setResolutionProgress] = useState(0);
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);
  const resolutionFileInputRef = useRef(null);

  const isSuperAdmin = profile?.role === "admin";

  const hasTyped = searchText.trim().length > 0;
  const hasStatusSelected = !!statusFilter;
  const isSearchingActive =
    appliedSearch.trim().length > 0 ||
    !!appliedStatus ||
    !!appliedFrom ||
    !!appliedTo;

  useEffect(() => {
    if (!dept) return;
    const q = query(
      collection(db, "posts"),
      where("departmentTag", "==", dept),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let allPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (!isSuperAdmin) {
          allPosts = allPosts.filter(
            (p) => !p.deleted && p.status !== "deleted",
          );
        }

        setTotalDocs(allPosts.length);
        setAllPosts(allPosts);

        setError(null);
      },
      (err) => setError(err.message),
    );
    return () => unsub();
  }, [dept]);

  const loadInitial = async () => {
    if (!dept) return;
    setIsLoading(true);
    setPosts([]);
    setLastVisible(null);
    setHasMore(true);
    try {
      let q = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE * 3),
      );

      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      const countQuery = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc"),
      );
      const countSnapshot = await getDocs(countQuery);
      let allPosts = countSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (!isSuperAdmin) {
        list = list.filter((p) => !p.deleted && p.status !== "deleted");
        allPosts = allPosts.filter((p) => !p.deleted && p.status !== "deleted");
      }

      const c = {
        total: allPosts.length,
        pending: 0,
        in_progress: 0,
        resolved: 0,
        resolved_pending_verification: 0,
        resolved_verified: 0,
        rejected: 0,
        deleted: 0,
      };
      allPosts.forEach((p) => {
        if (c[p.status] !== undefined) c[p.status]++;
      });
      setCounts(c);

      const pageList = list.slice(0, PAGE_SIZE);
      setPosts(pageList);

      if (pageList.length > 0) {
        const lastShownId = pageList[pageList.length - 1].id;
        const lastDoc =
          snapshot.docs.find((d) => d.id === lastShownId) ||
          snapshot.docs[snapshot.docs.length - 1] ||
          null;
        setLastVisible(lastDoc);
      } else {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
      }

      if (totalDocs > 0) setHasMore(pageList.length < totalDocs);
      else setHasMore(snapshot.docs.length > PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error loading posts",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadNext = async () => {
    if (!dept || !lastVisible || isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    try {
      const q = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(PAGE_SIZE * 3),
      );
      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (!isSuperAdmin) {
        list = list.filter((p) => !p.deleted && p.status !== "deleted");
      }
      const pageList = list.slice(0, PAGE_SIZE);
      setPosts((prev) => {
        const newPosts = [...prev, ...pageList];
        if (totalDocs > 0) setHasMore(newPosts.length < totalDocs);
        else setHasMore(snapshot.docs.length > PAGE_SIZE);
        return newPosts;
      });

      if (pageList.length > 0) {
        const lastShownId = pageList[pageList.length - 1].id;
        const lastDoc =
          snapshot.docs.find((d) => d.id === lastShownId) ||
          snapshot.docs[snapshot.docs.length - 1] ||
          null;
        setLastVisible(lastDoc);
      } else {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
      }
      setError(null);
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error loading more posts",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsFetchingMore(false);
    }
  };

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !isLoading) {
          if (isSearchingActive) {
            if (searchHasMore && !searchIsFetchingMore) {
              fetchSearchNext();
            }
          } else {
            if (hasMore && !isFetchingMore) {
              loadNext();
            }
          }
        }
      },
      { root: null, rootMargin: "200px", threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [
    loadMoreRef,
    isSearchingActive,
    hasMore,
    isFetchingMore,
    searchHasMore,
    searchIsFetchingMore,
    isLoading,
  ]);

  useEffect(() => {}, [totalDocs, PAGE_SIZE]);

  useEffect(() => {
    getCurrentPosition()
      .then((p) => {
        setMyLoc(p);
        setLocMsg("Your location loaded");
      })
      .catch(() => {
        setLocMsg("Location not available");
      });
  }, []);

  const canEditPost = (post) => {
    if (post?.deleted || post?.status === "deleted") return false;
    return (
      profile?.role === "admin" ||
      (profile?.role === "dept" && profile?.department === dept)
    );
  };

  const postsWithDistance = useMemo(() => {
    if (!myLoc) return posts;
    return posts.map((p) => {
      const d = distanceKm(myLoc, { lat: p.lat, lng: p.lng });
      return { ...p, distanceKm: typeof d === "number" ? d : undefined };
    });
  }, [posts, myLoc]);

  const filteredPostsWithDistance = useMemo(() => {
    return postsWithDistance;
  }, [postsWithDistance]);

  const handleApplySearch = () => {
    const trimmedSearch = searchText.trim();
    setAppliedSearch(trimmedSearch);
    setAppliedStatus(statusFilter);
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);

    if (trimmedSearch || statusFilter || fromDate || toDate) {
      fetchSearch(trimmedSearch, statusFilter, fromDate, toDate);
    }

    const next = new URLSearchParams(urlSearchParams);
    if (trimmedSearch) next.set("q", trimmedSearch);
    else next.delete("q");
    if (statusFilter) next.set("status", statusFilter);
    else next.delete("status");
    if (fromDate) next.set("from", fromDate);
    else next.delete("from");
    if (toDate) next.set("to", toDate);
    else next.delete("to");
    setUrlSearchParams(next, { replace: false });
  };

  const handleClearSearch = () => {
    setSearchText("");
    setAppliedSearch("");
    setStatusFilter("");
    setAppliedStatus("");
    setFromDate("");
    setToDate("");
    setAppliedFrom("");
    setAppliedTo("");

    loadInitial();

    const next = new URLSearchParams(urlSearchParams);
    next.delete("q");
    next.delete("status");
    next.delete("from");
    next.delete("to");
    setUrlSearchParams(next, { replace: false });
  };

  const fetchSearch = async (keyword, status, fromDate, toDate) => {
    if (!dept) return;
    setIsLoading(true);
    setPosts([]);
    setSearchLastVisible(null);
    setSearchHasMore(true);
    try {
      const q = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE * 2),
      );
      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      const countQuery = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc"),
      );
      const countSnapshot = await getDocs(countQuery);
      let allList = countSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      const applyFilters = (items) => {
        let filtered = items;

        if (status) {
          if (status === "deleted") {
            if (isSuperAdmin) {
              filtered = filtered.filter(
                (p) => p.deleted || p.status === "deleted",
              );
            } else {
              filtered = [];
            }
          } else {
            filtered = filtered.filter((p) => p.status === status);

            if (!isSuperAdmin) {
              filtered = filtered.filter(
                (p) => !p.deleted && p.status !== "deleted",
              );
            }
          }
        } else if (!isSuperAdmin) {
          filtered = filtered.filter(
            (p) => !p.deleted && p.status !== "deleted",
          );
        }

        if (fromDate || toDate) {
          const from = fromDate ? new Date(fromDate + "T00:00:00") : null;
          const to = toDate
            ? new Date(toDate + "T23:59:59.999")
            : fromDate
              ? new Date()
              : null;
          filtered = filtered.filter((p) => {
            const ts = p.createdAt?.toDate
              ? p.createdAt.toDate()
              : p.createdAt
                ? new Date(p.createdAt)
                : null;
            if (!ts) return false;
            if (from && ts < from) return false;
            if (to && ts > to) return false;
            return true;
          });
        }

        if (keyword) {
          const ql = keyword.toLowerCase();
          filtered = filtered.filter((p) =>
            (p.title || "").toLowerCase().includes(ql),
          );
        }

        return filtered;
      };

      list = applyFilters(list);
      allList = applyFilters(allList);

      const c = {
        total: allList.length,
        pending: 0,
        in_progress: 0,
        resolved: 0,
        resolved_pending_verification: 0,
        resolved_verified: 0,
        rejected: 0,
        deleted: 0,
      };
      allList.forEach((p) => {
        if (p?.status && c[p.status] !== undefined) c[p.status]++;
      });
      setCounts(c);

      const pageList = list.slice(0, PAGE_SIZE);
      setPosts(pageList);
      setLastVisible(null);
      setError(null);

      if (pageList.length > 0) {
        const lastShownId = pageList[pageList.length - 1].id;
        const lastShownDoc = snapshot.docs.find((d) => d.id === lastShownId);
        setSearchLastVisible(lastShownDoc || null);
      } else {
        setSearchLastVisible(null);
      }
      setSearchHasMore(snapshot.docs.length > PAGE_SIZE);
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error running search",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSearchNext = async () => {
    if (!searchLastVisible || searchIsFetchingMore || !searchHasMore) return;
    if (!dept) return;
    setSearchIsFetchingMore(true);
    try {
      const q = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc"),
        startAfter(searchLastVisible),
        limit(PAGE_SIZE * 2),
      );
      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      if (appliedStatus) {
        if (appliedStatus === "deleted") {
          if (isSuperAdmin) {
            list = list.filter((p) => p.deleted || p.status === "deleted");
          } else {
            list = [];
          }
        } else {
          list = list.filter((p) => p.status === appliedStatus);

          if (!isSuperAdmin) {
            list = list.filter((p) => !p.deleted && p.status !== "deleted");
          }
        }
      } else if (!isSuperAdmin) {
        list = list.filter((p) => !p.deleted && p.status !== "deleted");
      }

      if (appliedFrom || appliedTo) {
        const from = appliedFrom ? new Date(appliedFrom + "T00:00:00") : null;
        const to = appliedTo
          ? new Date(appliedTo + "T23:59:59.999")
          : appliedFrom
            ? new Date()
            : null;
        list = list.filter((p) => {
          const ts = p.createdAt?.toDate
            ? p.createdAt.toDate()
            : p.createdAt
              ? new Date(p.createdAt)
              : null;
          if (!ts) return false;
          if (from && ts < from) return false;
          if (to && ts > to) return false;
          return true;
        });
      }

      if (appliedSearch) {
        const ql = appliedSearch.toLowerCase();
        list = list.filter((p) => (p.title || "").toLowerCase().includes(ql));
      }

      const pageList = list.slice(0, PAGE_SIZE);
      setPosts((prev) => [...prev, ...pageList]);

      if (pageList.length > 0) {
        const lastShownId = pageList[pageList.length - 1].id;
        const lastShownDoc = snapshot.docs.find((d) => d.id === lastShownId);
        setSearchLastVisible(lastShownDoc || null);
      }
      setSearchHasMore(snapshot.docs.length > PAGE_SIZE);
    } catch (err) {
      setError(err.message);
      toast({
        title: "Error loading more",
        description: err.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSearchIsFetchingMore(false);
    }
  };

  useEffect(() => {
    if (loading) return;

    const qParam = (urlSearchParams.get("q") || "").trim();
    const statusParam = urlSearchParams.get("status") || "";
    const fromParam = urlSearchParams.get("from") || "";
    const toParam = urlSearchParams.get("to") || "";
    if (qParam || statusParam || fromParam || toParam) {
      setSearchText(qParam);
      setStatusFilter(statusParam);
      setAppliedSearch(qParam);
      setAppliedStatus(statusParam);
      setFromDate(fromParam);
      setToDate(toParam);
      setAppliedFrom(fromParam);
      setAppliedTo(toParam);
      fetchSearch(qParam, statusParam, fromParam, toParam);
    } else {
      loadInitial();
    }
  }, [dept, loading, profile?.role]);

  const handleUpdate = async (postId) => {
    const newStatus = statusMap[postId];
    const actionNote = noteMap[postId] || "";
    if (!newStatus) return;

    if (newStatus === "resolved") {
      setResolvingPostId(postId);
      onResolutionModalOpen();
      return;
    }

    try {
      const post = posts.find((p) => p.id === postId);
      const updateData = {
        status: newStatus,
        actionNote: actionNote.trim(),
      };

      if (newStatus === "resolved") {
        updateData.resolvedAt = Timestamp.now();
      } else if (post?.resolvedAt) {
        updateData.resolvedAt = deleteField();
      }

      const statusHistoryEntry = {
        timestamp: new Date().toISOString(),
        action: `status_changed_to_${newStatus}`,
        by: {
          uid: user.uid,
          name: profile?.name || "",
          role: profile?.role || "admin",
        },
        status: newStatus,
        comment: actionNote.trim() || `Status changed to ${newStatus}`,
      };

      updateData.statusHistory = arrayUnion(statusHistoryEntry);

      await updateDoc(doc(db, "posts", postId), updateData);

      if (post?.createdBy?.uid) {
        try {
          await notifyUserStatusChange(
            post.createdBy.uid,
            postId,
            post.title || "Your issue",
            post.status,
            newStatus,
            actionNote.trim(),
          );
        } catch (notifErr) {
          console.error("Error sending notification:", notifErr);
        }
      }

      toast({ title: "Updated", status: "success", duration: 1500 });
      setStatusMap((prev) => ({ ...prev, [postId]: "" }));
      setNoteMap((prev) => ({ ...prev, [postId]: "" }));
    } catch (err) {
      console.error("Update error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update post",
        status: "error",
        duration: 3000,
      });
    }
  };

  const uploadResolutionImage = () => {
    if (!resolutionImage)
      return Promise.resolve({ imageURL: "", imageStoragePath: "" });
    return new Promise((resolve, reject) => {
      const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

      const formData = new FormData();
      formData.append("file", resolutionImage);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("folder", `${CLOUDINARY_FOLDER}/${user.uid}`);
      formData.append("context", `uid=${user.uid}|email=${user.email}`);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.addEventListener("progress", (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setResolutionProgress(pct);
        }
      });
      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              resolve({
                imageURL: res.secure_url,
                imageStoragePath: res.public_id,
              });
            } catch (e) {
              reject(e);
            }
          } else {
            try {
              const res = JSON.parse(xhr.responseText);
              reject(
                new Error(
                  res.error?.message ||
                    `Cloudinary upload failed (status ${xhr.status})`,
                ),
              );
            } catch {
              reject(
                new Error(
                  `Cloudinary upload failed (status ${xhr.status}): ${
                    xhr.responseText || "No response"
                  }`,
                ),
              );
            }
          }
        }
      };
      xhr.onerror = () =>
        reject(new Error("Network error during Cloudinary upload"));
      xhr.send(formData);
    });
  };

  const handleSubmitResolution = async () => {
    if (!resolutionImage || !resolvingPostId) {
      toast({
        title: "Image Required",
        description: "Please upload a resolution image before submitting.",
        status: "warning",
        duration: 3000,
      });
      return;
    }

    setIsSubmittingResolution(true);
    try {
      const post = posts.find((p) => p.id === resolvingPostId);
      const actionNote = noteMap[resolvingPostId] || "";

      const { imageURL, imageStoragePath } = await uploadResolutionImage();

      const updateData = {
        status: "resolved_pending_verification",
        actionNote: actionNote.trim() || "",
        resolvedAt: Timestamp.now(),
        resolutionImage: imageURL,
        resolutionNote: resolutionNote.trim() || "",
        resolutionDate: Timestamp.now(),
        resolvedBy: {
          uid: user.uid,
          name: profile?.name || user.email || "",
          department: profile?.department || dept || "",
        },
        statusHistory: arrayUnion({
          timestamp: new Date().toISOString(),
          action: "resolved",
          by: {
            uid: user.uid,
            name: profile?.name || user.email || "",
            role: profile?.role || "dept",
          },
          status: "resolved_pending_verification",
          comment:
            resolutionNote.trim() ||
            "Marked as resolved - pending user verification",
        }),
      };

      await updateDoc(doc(db, "posts", resolvingPostId), updateData);

      if (post?.createdBy?.uid) {
        try {
          await notifyUserStatusChange(
            post.createdBy.uid,
            resolvingPostId,
            post.title || "Your issue",
            post.status,
            "resolved_pending_verification",
            resolutionNote.trim() || "Issue resolved - please verify",
          );
        } catch (notifErr) {
          console.error("Error sending notification:", notifErr);
        }
      }

      toast({
        title: "Resolved Successfully",
        description: "Issue marked as resolved. Awaiting user verification.",
        status: "success",
        duration: 3000,
      });

      setStatusMap((prev) => ({ ...prev, [resolvingPostId]: "" }));
      setNoteMap((prev) => ({ ...prev, [resolvingPostId]: "" }));
      onResolutionModalClose();
      setResolvingPostId(null);
      setResolutionImage(null);
      setResolutionNote("");
      setResolutionProgress(0);
    } catch (err) {
      console.error("Resolution error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to submit resolution",
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  const handleResolutionImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setResolutionImage(file);
      setResolutionProgress(0);
    }
  };

  const handleClearResolutionImage = () => {
    setResolutionImage(null);
    setResolutionProgress(0);
    if (resolutionFileInputRef.current) {
      resolutionFileInputRef.current.value = "";
    }
  };

  const handleResolutionModalClose = () => {
    if (!isSubmittingResolution) {
      onResolutionModalClose();
      setResolvingPostId(null);
      setResolutionImage(null);
      setResolutionNote("");
      setResolutionProgress(0);
    }
  };

  return (
    <Container maxW="container.lg" pb={10}>
      {!dept && (
        <Alert status="warning" mb={4}>
          <AlertIcon />
          No department resolved from route or profile.
        </Alert>
      )}

      {}
      <IssuesMap posts={allPosts} />

      <HStack justify="space-between" mb={4} align="center" wrap="wrap" gap={2}>
        <Heading size="md">{dept || "Dashboard"}</Heading>
      </HStack>

      {}
      <Box
        display="flex"
        overflowX="auto"
        gap={2}
        mb={4}
        w="100%"
        css={{
          "&::-webkit-scrollbar": {
            height: "8px",
          },
          "&::-webkit-scrollbar-track": {
            background: "transparent",
          },
          "&::-webkit-scrollbar-thumb": {
            background: "rgba(0,0,0,0.2)",
            borderRadius: "10px",
          },
          "&::-webkit-scrollbar-thumb:hover": {
            background: "rgba(0,0,0,0.3)",
          },
        }}
      >
        <Box
          minW={{ base: "110px", md: "120px" }}
          flex="1"
          p={3}
          borderRadius="xl"
          bgGradient="linear(135deg, #667eea 0%, #764ba2 100%)"
          color="white"
          textAlign="center"
          boxShadow="xl"
          position="relative"
          overflow="hidden"
          transition="all 0.3s ease"
          _hover={{
            transform: "translateY(-4px)",
            boxShadow: "2xl",
          }}
          _before={{
            content: '""',
            position: "absolute",
            top: "-50%",
            right: "-50%",
            width: "200%",
            height: "200%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        >
          <Text
            fontSize="2xs"
            fontWeight="bold"
            mb={1}
            textTransform="uppercase"
            letterSpacing="wide"
            opacity={0.9}
          >
            Total
          </Text>
          <Text
            fontSize="2xl"
            fontWeight="extrabold"
            textShadow="0 2px 10px rgba(0,0,0,0.2)"
          >
            {counts.total}
          </Text>
        </Box>

        <Box
          minW={{ base: "110px", md: "120px" }}
          flex="1"
          p={3}
          borderRadius="xl"
          bgGradient="linear(135deg, #f093fb 0%, #f5576c 100%)"
          color="white"
          textAlign="center"
          boxShadow="xl"
          position="relative"
          overflow="hidden"
          transition="all 0.3s ease"
          _hover={{
            transform: "translateY(-4px)",
            boxShadow: "2xl",
          }}
          _before={{
            content: '""',
            position: "absolute",
            top: "-50%",
            right: "-50%",
            width: "200%",
            height: "200%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        >
          <Text
            fontSize="2xs"
            fontWeight="bold"
            mb={1}
            textTransform="uppercase"
            letterSpacing="wide"
            opacity={0.9}
          >
            Pending
          </Text>
          <Text
            fontSize="2xl"
            fontWeight="extrabold"
            textShadow="0 2px 10px rgba(0,0,0,0.2)"
          >
            {counts.pending}
          </Text>
        </Box>

        <Box
          minW={{ base: "110px", md: "120px" }}
          flex="1"
          p={3}
          borderRadius="xl"
          bgGradient="linear(135deg, #fa709a 0%, #fee140 100%)"
          color="white"
          textAlign="center"
          boxShadow="xl"
          position="relative"
          overflow="hidden"
          transition="all 0.3s ease"
          _hover={{
            transform: "translateY(-4px)",
            boxShadow: "2xl",
          }}
          _before={{
            content: '""',
            position: "absolute",
            top: "-50%",
            right: "-50%",
            width: "200%",
            height: "200%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        >
          <Text
            fontSize="2xs"
            fontWeight="bold"
            mb={1}
            textTransform="uppercase"
            letterSpacing="wide"
            opacity={0.9}
          >
            In Progress
          </Text>
          <Text
            fontSize="2xl"
            fontWeight="extrabold"
            textShadow="0 2px 10px rgba(0,0,0,0.2)"
          >
            {counts.in_progress}
          </Text>
        </Box>

        <Box
          minW={{ base: "110px", md: "120px" }}
          flex="1"
          p={3}
          borderRadius="xl"
          bgGradient="linear(135deg, #f59e0b 0%, #d97706 100%)"
          color="white"
          textAlign="center"
          boxShadow="xl"
          position="relative"
          overflow="hidden"
          transition="all 0.3s ease"
          _hover={{
            transform: "translateY(-4px)",
            boxShadow: "2xl",
          }}
          _before={{
            content: '""',
            position: "absolute",
            top: "-50%",
            right: "-50%",
            width: "200%",
            height: "200%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        >
          <Text
            fontSize="2xs"
            fontWeight="bold"
            mb={1}
            textTransform="uppercase"
            letterSpacing="wide"
            opacity={0.9}
          >
            Pending Verification
          </Text>
          <Text
            fontSize="2xl"
            fontWeight="extrabold"
            textShadow="0 2px 10px rgba(0,0,0,0.2)"
          >
            {counts.resolved_pending_verification}
          </Text>
        </Box>

        <Box
          minW={{ base: "110px", md: "120px" }}
          flex="1"
          p={3}
          borderRadius="xl"
          bgGradient="linear(135deg, #10b981 0%, #059669 100%)"
          color="white"
          textAlign="center"
          boxShadow="xl"
          position="relative"
          overflow="hidden"
          transition="all 0.3s ease"
          _hover={{
            transform: "translateY(-4px)",
            boxShadow: "2xl",
          }}
          _before={{
            content: '""',
            position: "absolute",
            top: "-50%",
            right: "-50%",
            width: "200%",
            height: "200%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        >
          <Text
            fontSize="2xs"
            fontWeight="bold"
            mb={1}
            textTransform="uppercase"
            letterSpacing="wide"
            opacity={0.9}
          >
            Verified & Closed
          </Text>
          <Text
            fontSize="2xl"
            fontWeight="extrabold"
            textShadow="0 2px 10px rgba(0,0,0,0.2)"
          >
            {counts.resolved_verified}
          </Text>
        </Box>

        <Box
          minW={{ base: "110px", md: "120px" }}
          flex="1"
          p={3}
          borderRadius="xl"
          bgGradient="linear(135deg, #ff0844 0%, #ffb199 100%)"
          color="white"
          textAlign="center"
          boxShadow="xl"
          position="relative"
          overflow="hidden"
          transition="all 0.3s ease"
          _hover={{
            transform: "translateY(-4px)",
            boxShadow: "2xl",
          }}
          _before={{
            content: '""',
            position: "absolute",
            top: "-50%",
            right: "-50%",
            width: "200%",
            height: "200%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        >
          <Text
            fontSize="2xs"
            fontWeight="bold"
            mb={1}
            textTransform="uppercase"
            letterSpacing="wide"
            opacity={0.9}
          >
            Rejected
          </Text>
          <Text
            fontSize="2xl"
            fontWeight="extrabold"
            textShadow="0 2px 10px rgba(0,0,0,0.2)"
          >
            {counts.rejected}
          </Text>
        </Box>

        {isSuperAdmin && (
          <Box
            minW={{ base: "110px", md: "120px" }}
            flex="1"
            p={3}
            borderRadius="xl"
            bgGradient="linear(135deg, #868f96 0%, #596164 100%)"
            color="white"
            textAlign="center"
            boxShadow="xl"
            position="relative"
            overflow="hidden"
            transition="all 0.3s ease"
            _hover={{
              transform: "translateY(-4px)",
              boxShadow: "2xl",
            }}
            _before={{
              content: '""',
              position: "absolute",
              top: "-50%",
              right: "-50%",
              width: "200%",
              height: "200%",
              background:
                "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          >
            <Text
              fontSize="2xs"
              fontWeight="bold"
              mb={1}
              textTransform="uppercase"
              letterSpacing="wide"
              opacity={0.9}
            >
              Deleted
            </Text>
            <Text
              fontSize="2xl"
              fontWeight="extrabold"
              textShadow="0 2px 10px rgba(0,0,0,0.2)"
            >
              {counts.deleted}
            </Text>
          </Box>
        )}
      </Box>

      <HStack mb={4} justify="space-between" wrap="wrap" gap={2}>
        <Text fontSize="sm" color="gray.600">
          {locMsg}
        </Text>
        {myLoc && (
          <Text fontSize="sm">
            You: {myLoc.lat.toFixed(4)}, {myLoc.lng.toFixed(4)} ·{" "}
            <Link
              href={googleMapsLink(myLoc.lat, myLoc.lng)}
              isExternal
              color="blue.500"
            >
              Open in Maps
            </Link>
          </Text>
        )}
      </HStack>

      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      {}
      <VStack align="stretch" spacing={2} mb={4}>
        {}
        <HStack
          spacing={3}
          align="center"
          wrap={{ base: "wrap", md: "wrap", lg: "nowrap" }}
          w="100%"
        >
          <Select
            placeholder="Issue Type (all)"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            bg="white"
            size="md"
            flex={{ base: "1", md: "0 0 auto", lg: "0 0 auto" }}
            minW={{ base: "calc(50% - 6px)", md: "180px", lg: "180px" }}
            maxW={{ base: "calc(50% - 6px)", md: "180px", lg: "180px" }}
            borderRadius="md"
          >
            {dept &&
              ISSUE_TITLES[dept]?.map((title) => (
                <option key={title} value={title}>
                  {title}
                </option>
              ))}
          </Select>
          <Select
            placeholder="Status (all)"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            bg="white"
            size="md"
            flex={{ base: "1", md: "0 0 auto", lg: "0 0 auto" }}
            minW={{ base: "calc(50% - 6px)", md: "150px", lg: "140px" }}
            maxW={{ base: "calc(50% - 6px)", md: "150px", lg: "140px" }}
            borderRadius="md"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved_pending_verification">
              Resolved - Pending Verification
            </option>
            <option value="resolved_verified">Verified & Closed</option>
            <option value="rejected">Rejected</option>
            {isSuperAdmin && <option value="deleted">Deleted</option>}
          </Select>
          <HStack
            spacing={2}
            flex={{ base: "1", md: "0 0 auto", lg: "0 0 auto" }}
          >
            <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
              From:
            </Text>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              bg="white"
              size="md"
              minW={{ base: "auto", md: "165px", lg: "165px" }}
              maxW={{ base: "auto", md: "165px", lg: "165px" }}
              borderRadius="md"
            />
          </HStack>
          <HStack
            spacing={2}
            flex={{ base: "1", md: "0 0 auto", lg: "0 0 auto" }}
          >
            <Text fontSize="sm" fontWeight="medium" whiteSpace="nowrap">
              To:
            </Text>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              bg="white"
              size="md"
              minW={{ base: "auto", md: "165px", lg: "165px" }}
              maxW={{ base: "auto", md: "165px", lg: "165px" }}
              borderRadius="md"
            />
          </HStack>
          {}
          <Button
            colorScheme="blue"
            onClick={handleApplySearch}
            isDisabled={!hasTyped && !hasStatusSelected && !fromDate && !toDate}
            size="md"
            flex={{ base: "1", md: "0 0 auto", lg: "0 0 auto" }}
            minW={{ base: "calc(50% - 6px)", md: "110px", lg: "100px" }}
          >
            Search
          </Button>
          <Button
            onClick={handleClearSearch}
            isDisabled={!isSearchingActive}
            colorScheme="red"
            size="md"
            flex={{ base: "1", md: "0 0 auto", lg: "0 0 auto" }}
            minW={{ base: "calc(50% - 6px)", md: "110px", lg: "100px" }}
          >
            Clear filter
          </Button>
        </HStack>
      </VStack>

      {isLoading ? (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <Box
              key={`skeleton-${i}`}
              borderWidth="1px"
              borderRadius="md"
              overflow="hidden"
              bg="white"
              p={4}
            >
              <Skeleton height="160px" mb={3} borderRadius="md" />
              <SkeletonText mt="4" noOfLines={3} spacing="4" />
            </Box>
          ))}
        </SimpleGrid>
      ) : filteredPostsWithDistance.length === 0 ? (
        <Box textAlign="center" py={10} color="gray.600">
          <Text>No relavent reports</Text>
        </Box>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
            {(isSearchingActive
              ? filteredPostsWithDistance
              : filteredPostsWithDistance
            ).map((p) => (
              <Box
                key={p.id}
                borderWidth="1px"
                borderRadius="md"
                overflow="hidden"
                bg="white"
              >
                <PostCard
                  post={p}
                  showAsYou={user && p?.createdBy?.uid === user.uid}
                />
                {canEditPost(p) && (
                  <VStack align="stretch" spacing={3} p={3}>
                    <Select
                      placeholder="Change status"
                      value={statusMap[p.id] || ""}
                      onChange={(e) =>
                        setStatusMap((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                      isDisabled={p.deleted || p.status === "deleted"}
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="rejected">Rejected</option>
                    </Select>
                    <Textarea
                      placeholder="Action note (optional)"
                      value={noteMap[p.id] || ""}
                      onChange={(e) =>
                        setNoteMap((prev) => ({
                          ...prev,
                          [p.id]: e.target.value,
                        }))
                      }
                      isDisabled={p.deleted || p.status === "deleted"}
                    />
                    <Button
                      colorScheme="blue"
                      onClick={() => handleUpdate(p.id)}
                      isDisabled={p.deleted || p.status === "deleted"}
                    >
                      Save
                    </Button>
                  </VStack>
                )}
              </Box>
            ))}
          </SimpleGrid>

          {}
          <Box
            ref={loadMoreRef}
            textAlign="center"
            py={4}
            color="gray.600"
            mt={4}
          >
            {isSearchingActive ? (
              searchIsFetchingMore ? (
                <HStack justify="center">
                  <Spinner size="sm" />
                  <Text>Loading more...</Text>
                </HStack>
              ) : searchHasMore ? (
                <Text>Scroll to load more</Text>
              ) : (
                <Text>No more reports</Text>
              )
            ) : isFetchingMore ? (
              <HStack justify="center">
                <Spinner size="sm" />
                <Text>Loading more...</Text>
              </HStack>
            ) : hasMore ? (
              <Text>Scroll to load more</Text>
            ) : (
              <Text>No more reports</Text>
            )}
          </Box>
        </>
      )}

      {}

      {}
      <Modal
        isOpen={isResolutionModalOpen}
        onClose={handleResolutionModalClose}
        closeOnOverlayClick={!isSubmittingResolution}
        closeOnEsc={!isSubmittingResolution}
        size="lg"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Mark Issue as Resolved</ModalHeader>
          <ModalCloseButton isDisabled={isSubmittingResolution} />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <Text fontSize="sm">
                  Upload a photo showing the resolved issue. This image is
                  <strong> required</strong> for verification.
                </Text>
              </Alert>

              <FormControl isRequired>
                <FormLabel>Resolution Image</FormLabel>
                <HStack spacing={2}>
                  <Input
                    ref={resolutionFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleResolutionImageChange}
                    display="none"
                  />
                  <Input
                    readOnly
                    value={
                      resolutionImage ? resolutionImage.name : "No file chosen"
                    }
                    placeholder="No file chosen"
                    flex={1}
                    isInvalid={!resolutionImage}
                  />
                  <Button
                    onClick={() => resolutionFileInputRef.current?.click()}
                    isDisabled={!!resolutionImage || isSubmittingResolution}
                    colorScheme="blue"
                  >
                    Upload
                  </Button>
                  <Button
                    onClick={handleClearResolutionImage}
                    isDisabled={!resolutionImage || isSubmittingResolution}
                    colorScheme="red"
                    variant="outline"
                  >
                    Clear
                  </Button>
                </HStack>
                {resolutionProgress > 0 && (
                  <Progress
                    value={resolutionProgress}
                    mt={2}
                    colorScheme="blue"
                  />
                )}
              </FormControl>

              <FormControl>
                <FormLabel>Resolution Note (Optional)</FormLabel>
                <Textarea
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Add any notes about the resolution..."
                  isDisabled={isSubmittingResolution}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              mr={3}
              onClick={handleResolutionModalClose}
              isDisabled={isSubmittingResolution}
            >
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleSubmitResolution}
              isLoading={isSubmittingResolution}
              isDisabled={!resolutionImage}
            >
              Submit Resolution
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}
