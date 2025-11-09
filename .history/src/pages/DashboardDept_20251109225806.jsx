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
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
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
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import PostCard from "../components/PostCard";
import {
  getCurrentPosition,
  distanceKm,
  googleMapsLink,
} from "../lib/location";

export default function DashboardDept({ fixedDept }) {
  const params = useParams();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const routeDept = params.dept;
  const { profile } = useAuth();

  // Resolve department: prop > route param > profile
  const dept = fixedDept || routeDept || profile?.department || null;

  const [posts, setPosts] = useState([]);
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
    rejected: 0,
    deleted: 0,
  });
  const [lastVisible, setLastVisible] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const loadMoreRef = useRef(null);

  // Search pagination state
  const [searchLastVisible, setSearchLastVisible] = useState(null);
  const [searchHasMore, setSearchHasMore] = useState(true);
  const [searchIsFetchingMore, setSearchIsFetchingMore] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // '' means all
  const [appliedStatus, setAppliedStatus] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  // Show 6 items per page for department dashboards
  const PAGE_SIZE = 6;
  const toast = useToast();

  const isSuperAdmin = profile?.role === "admin";

  const hasTyped = searchText.trim().length > 0;
  const hasStatusSelected = !!statusFilter;
  const isSearchingActive =
    appliedSearch.trim().length > 0 ||
    !!appliedStatus ||
    !!appliedFrom ||
    !!appliedTo;

  // Get total count of documents (for pagination tracking only)
  useEffect(() => {
    if (!dept) return;
    const q = query(
      collection(db, "posts"),
      where("departmentTag", "==", dept)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let allPosts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Filter out deleted posts for non-super-admin for count purposes
        if (!isSuperAdmin) {
          allPosts = allPosts.filter(
            (p) => !p.deleted && p.status !== "deleted"
          );
        }

        setTotalDocs(allPosts.length);
        // Note: Don't set counts here - they're calculated in loadInitial/fetchSearch
        // to respect active filters
        setError(null);
      },
      (err) => setError(err.message)
    );
    return () => unsub();
  }, [dept, isSuperAdmin]);

  // Fetch paginated data - Load initial and append next pages for infinite scroll
  const loadInitial = async () => {
    if (!dept) return;
    setIsLoading(true);
    setPosts([]);
    setLastVisible(null);
    setHasMore(true);
    try {
      // Fetch for pagination
      let q = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE * 3) // Increased from 2 to 3 to fetch more docs
      );

      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // ALSO fetch ALL posts to recalculate base counts
      const countQuery = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc")
      );
      const countSnapshot = await getDocs(countQuery);
      let allPosts = countSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Filter for display based on role
      if (!isSuperAdmin) {
        list = list.filter((p) => !p.deleted && p.status !== "deleted");
        allPosts = allPosts.filter((p) => !p.deleted && p.status !== "deleted");
      }

      // Recalculate base counts
      const c = {
        total: allPosts.length,
        pending: 0,
        in_progress: 0,
        resolved: 0,
        rejected: 0,
        deleted: 0,
      };
      allPosts.forEach((p) => {
        if (c[p.status] !== undefined) c[p.status]++;
      });
      setCounts(c);

      const pageList = list.slice(0, PAGE_SIZE);
      setPosts(pageList);

      // Set cursor to the doc matching the last shown item
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
        limit(PAGE_SIZE * 3) // Increased from 2 to 3
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

  // Fetch initial page
  // Note: Initial load is handled by the URL initialization useEffect below
  // which checks for URL params and calls either fetchSearch or loadInitial

  // IntersectionObserver to load more when sentinel is visible
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
      { root: null, rootMargin: "200px", threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loadMoreRef,
    isSearchingActive,
    hasMore,
    isFetchingMore,
    searchHasMore,
    searchIsFetchingMore,
    isLoading,
  ]);

  // clamp page when total docs change
  useEffect(() => {
    // No longer needed for infinite scroll
  }, [totalDocs, PAGE_SIZE]);

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

  // Check if a specific post can be edited
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
    // All filtering (status, date, title) is now done in fetchSearch/fetchSearchNext
    // This just returns postsWithDistance as-is
    return postsWithDistance;
  }, [postsWithDistance]);

  const handleApplySearch = () => {
    // Set applied filters FIRST before calling fetchSearch
    const trimmedSearch = searchText.trim();
    setAppliedSearch(trimmedSearch);
    setAppliedStatus(statusFilter);
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);

    if (trimmedSearch || statusFilter || fromDate || toDate) {
      fetchSearch(trimmedSearch, statusFilter, fromDate, toDate);
    }
    // persist to URL
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
    // Reload base/initial reports
    loadInitial();
    // clear URL params
    const next = new URLSearchParams(urlSearchParams);
    next.delete("q");
    next.delete("status");
    next.delete("from");
    next.delete("to");
    setUrlSearchParams(next, { replace: false });
  };

  // Fetch posts matching department and status, then filter title client-side for flexibility
  const fetchSearch = async (keyword, status, fromDate, toDate) => {
    if (!dept) return;
    setIsLoading(true);
    setPosts([]);
    setSearchLastVisible(null);
    setSearchHasMore(true);
    try {
      // Only filter by department to avoid needing composite index
      // Filter by status client-side instead
      const q = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE * 2)
      );
      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // ALSO fetch ALL matching docs for accurate counts (without limit)
      const countQuery = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc")
      );
      const countSnapshot = await getDocs(countQuery);
      let allList = countSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Apply same filters to both list and allList
      const applyFilters = (items) => {
        let filtered = items;

        // Filter by status client-side
        if (status) {
          if (status === "deleted") {
            // Only show deleted posts if super-admin
            if (isSuperAdmin) {
              filtered = filtered.filter(
                (p) => p.deleted || p.status === "deleted"
              );
            } else {
              filtered = []; // Non-admins can't see deleted posts
            }
          } else {
            // Filter by specific status
            filtered = filtered.filter((p) => p.status === status);
            // For non-super-admin, also filter out deleted posts
            if (!isSuperAdmin) {
              filtered = filtered.filter(
                (p) => !p.deleted && p.status !== "deleted"
              );
            }
          }
        } else if (!isSuperAdmin) {
          // No status filter, but still filter out deleted posts for non-admins
          filtered = filtered.filter(
            (p) => !p.deleted && p.status !== "deleted"
          );
        }

        // Apply date range filter client-side
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

        // Apply title/keyword filter client-side
        if (keyword) {
          const ql = keyword.toLowerCase();
          filtered = filtered.filter((p) =>
            (p.title || "").toLowerCase().includes(ql)
          );
        }

        return filtered;
      };

      list = applyFilters(list);
      allList = applyFilters(allList);

      // Calculate counts from ALL filtered results
      const c = {
        total: allList.length,
        pending: 0,
        in_progress: 0,
        resolved: 0,
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

      // Set cursor to the doc matching the last shown item
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

  // Load next page of filtered/searched posts
  const fetchSearchNext = async () => {
    if (!searchLastVisible || searchIsFetchingMore || !searchHasMore) return;
    if (!dept) return;
    setSearchIsFetchingMore(true);
    try {
      // Only filter by department to avoid needing composite index
      const q = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc"),
        startAfter(searchLastVisible),
        limit(PAGE_SIZE * 2)
      );
      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Filter by status client-side
      if (appliedStatus) {
        if (appliedStatus === "deleted") {
          if (isSuperAdmin) {
            list = list.filter((p) => p.deleted || p.status === "deleted");
          } else {
            list = [];
          }
        } else {
          // Filter by specific status
          list = list.filter((p) => p.status === appliedStatus);
          // For non-super-admin, also filter out deleted posts
          if (!isSuperAdmin) {
            list = list.filter((p) => !p.deleted && p.status !== "deleted");
          }
        }
      } else if (!isSuperAdmin) {
        // No status filter, but still filter out deleted posts for non-admins
        list = list.filter((p) => !p.deleted && p.status !== "deleted");
      }

      // Apply date range filter client-side
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

      // Apply title/keyword filter client-side
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

  // Initialize filters from URL on mount and when dept changes (wait for profile)
  useEffect(() => {
    if (!profile) return; // Wait for profile to load

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
      // no filters: load base
      loadInitial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept, profile]); // Run when dept or profile changes

  const handleUpdate = async (postId) => {
    const newStatus = statusMap[postId];
    const actionNote = noteMap[postId] || "";
    if (!newStatus) return;
    try {
      await updateDoc(doc(db, "posts", postId), {
        status: newStatus,
        actionNote,
      });
      toast({ title: "Updated", status: "success", duration: 1500 });
      setStatusMap((prev) => ({ ...prev, [postId]: "" }));
    } catch (err) {
      toast({ title: "Error", description: err.message, status: "error" });
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

      <HStack justify="space-between" mb={4} align="center" wrap="wrap" gap={2}>
        <Heading size="md">{dept || "Dashboard"}</Heading>

        {/* Status summary - centered, labels use gradient text (or purple fallback), counts in black */}
        <HStack spacing={{ base: 3, md: 6 }} align="center">
          <Stat textAlign="center">
            <StatLabel
              bgGradient="linear(to-r, purple.500, purple.700)"
              bgClip="text"
              fontWeight="bold"
            >
              Total
            </StatLabel>
            <StatNumber color="black" fontWeight="semibold">
              {counts.total}
            </StatNumber>
          </Stat>

          <Stat textAlign="center">
            <StatLabel
              bgGradient="linear(to-r, purple.500, purple.700)"
              bgClip="text"
              fontWeight="bold"
            >
              Pending
            </StatLabel>
            <StatNumber color="black" fontWeight="semibold">
              {counts.pending}
            </StatNumber>
          </Stat>

          <Stat textAlign="center">
            <StatLabel
              bgGradient="linear(to-r, purple.500, purple.700)"
              bgClip="text"
              fontWeight="bold"
              whiteSpace="nowrap"
              title="In Progress"
            >
              In Progress
            </StatLabel>
            <StatNumber color="black" fontWeight="semibold">
              {counts.in_progress}
            </StatNumber>
          </Stat>

          <Stat textAlign="center">
            <StatLabel
              bgGradient="linear(to-r, purple.500, purple.700)"
              bgClip="text"
              fontWeight="bold"
            >
              Resolved
            </StatLabel>
            <StatNumber color="black" fontWeight="semibold">
              {counts.resolved}
            </StatNumber>
          </Stat>

          <Stat textAlign="center">
            <StatLabel
              bgGradient="linear(to-r, purple.500, purple.700)"
              bgClip="text"
              fontWeight="bold"
            >
              Rejected
            </StatLabel>
            <StatNumber color="black" fontWeight="semibold">
              {counts.rejected}
            </StatNumber>
          </Stat>

          {isSuperAdmin && (
            <Stat textAlign="center">
              <StatLabel
                bgGradient="linear(to-r, purple.500, purple.700)"
                bgClip="text"
                fontWeight="bold"
              >
                Deleted
              </StatLabel>
              <StatNumber color="black" fontWeight="semibold">
                {counts.deleted}
              </StatNumber>
            </Stat>
          )}
        </HStack>
      </HStack>

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

      {/* Search controls for recent reports */}
      <VStack align="stretch" spacing={2} mb={4}>
        {/* Search bar - full width on mobile, on separate line */}
        <InputGroup w="100%">
          <InputLeftElement pointerEvents="none">
            <SearchIcon color="gray.400" />
          </InputLeftElement>
          <Input
            placeholder="Search reports by title"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            bg="white"
            pl={10}
            size="md"
          />
        </InputGroup>
        {/* All filters on one line for desktop, wrap on mobile */}
        <HStack
          spacing={3}
          align="center"
          wrap={{ base: "wrap", md: "wrap", lg: "nowrap" }}
          w="100%"
        >
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
            <option value="resolved">Resolved</option>
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
          {/* Buttons - full width on mobile, auto on desktop */}
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
                <PostCard post={p} />
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

          {/* Sentinel for infinite scroll */}
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

      {/* loading state handled inline with skeletons above */}
    </Container>
  );
}

// 4) add an notification icon on the navbar near the left-side of user identity(admin, public,etc...). this feature will notify the change in status and action note stated by the admin. Like once the admin reply or make any changes on the user's post it should notify the user on the notification feature. there should be an bell icon with the number of the notification
// the moblie view is perfectly okay, but in desktop view make the search and clear button on the same line to the dropdowns and from and to dates.
// came back
