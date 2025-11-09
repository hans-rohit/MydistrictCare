import { useEffect, useMemo, useState } from "react";
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
  const [page, setPage] = useState(1);
  const [totalDocs, setTotalDocs] = useState(0);
  const [lastVisible, setLastVisible] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
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

  // Get total count of documents
  useEffect(() => {
    if (!dept) return;
    const q = query(
      collection(db, "posts"),
      where("departmentTag", "==", dept)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setTotalDocs(snap.size);
        setError(null);
      },
      (err) => setError(err.message)
    );
    return () => unsub();
  }, [dept]);

  // Fetch paginated data
  const fetchPage = async (pageNum, cursor = null) => {
    if (!dept) return;
    setIsLoading(true);
    try {
      let q = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE * 2) // Fetch more to account for filtered deleted posts
      );

      if (cursor) {
        q = query(
          collection(db, "posts"),
          where("departmentTag", "==", dept),
          orderBy("createdAt", "desc"),
          startAfter(cursor),
          limit(PAGE_SIZE * 2)
        );
      }

      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Filter out deleted posts unless super-admin viewing all
      if (!isSuperAdmin) {
        list = list.filter((p) => !p.deleted && p.status !== "deleted");
      }

      // Limit to PAGE_SIZE after filtering
      list = list.slice(0, PAGE_SIZE);
      setPosts(list);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
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

  // Fetch initial page
  useEffect(() => {
    fetchPage(1);
  }, [dept]);

  // clamp page when total docs change
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalDocs / PAGE_SIZE));
    if (page > totalPages) setPage(totalPages);
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

  const isSuperAdmin = profile?.role === "admin";

  const counts = useMemo(() => {
    const c = {
      total: posts.length,
      pending: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
      deleted: 0,
    };
    posts.forEach((p) => {
      if (c[p.status] !== undefined) c[p.status]++;
    });
    return c;
  }, [posts]);

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
    const queryText = appliedSearch.trim().toLowerCase();
    let list = postsWithDistance;
    if (appliedStatus) {
      list = list.filter((p) => p.status === appliedStatus);
    }
    if (appliedFrom || appliedTo) {
      // If only "from" is selected: from that date to now
      // If only "to" is selected: from beginning (no lower bound) to that date
      // If both selected: from "from" date to "to" date
      const from = appliedFrom ? new Date(appliedFrom + "T00:00:00") : null;
      const to = appliedTo
        ? new Date(appliedTo + "T23:59:59.999")
        : appliedFrom
        ? new Date()
        : null; // If only "from", upper bound is now
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
    if (!queryText) return list;
    return list.filter((p) =>
      (p.title || "").toLowerCase().includes(queryText)
    );
  }, [postsWithDistance, appliedSearch, appliedStatus, appliedFrom, appliedTo]);

  const hasTyped = searchText.trim().length > 0;
  const hasStatusSelected = !!statusFilter;
  const isSearchingActive =
    appliedSearch.trim().length > 0 ||
    !!appliedStatus ||
    !!appliedFrom ||
    !!appliedTo;

  const handleApplySearch = () => {
    setAppliedSearch(searchText.trim());
    setAppliedStatus(statusFilter);
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    if (searchText.trim() || statusFilter || fromDate || toDate) {
      fetchSearch(searchText.trim(), statusFilter);
      setPage(1);
    }
    // persist to URL
    const next = new URLSearchParams(urlSearchParams);
    if (searchText.trim()) next.set("q", searchText.trim());
    else next.delete("q");
    if (statusFilter) next.set("status", statusFilter);
    else next.delete("status");
    if (fromDate) next.set("from", fromDate);
    else next.delete("from");
    if (toDate) next.set("to", toDate);
    else next.delete("to");
    next.set("p", "1");
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
    setPage(1);
    fetchPage(1);
    // clear URL params
    const next = new URLSearchParams(urlSearchParams);
    next.delete("q");
    next.delete("status");
    next.delete("from");
    next.delete("to");
    next.set("p", "1");
    setUrlSearchParams(next, { replace: false });
  };

  // Fetch posts matching department and status, then filter title client-side for flexibility
  const fetchSearch = async (keyword, status) => {
    if (!dept) return;
    setIsLoading(true);
    try {
      const constraints = [where("departmentTag", "==", dept)];
      if (status && status !== "deleted") {
        constraints.push(where("status", "==", status));
      }
      // Don't filter by title on server - do it client-side for better flexibility
      const q = query(collection(db, "posts"), ...constraints);
      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Filter deleted posts based on status and user role
      if (status === "deleted") {
        // Only show deleted posts if super-admin
        if (isSuperAdmin) {
          list = list.filter((p) => p.deleted || p.status === "deleted");
        } else {
          list = []; // Non-admins can't see deleted posts
        }
      } else if (!isSuperAdmin) {
        // For non-super-admin, filter out deleted posts
        list = list.filter((p) => !p.deleted && p.status !== "deleted");
      }

      setPosts(list);
      setLastVisible(null);
      setError(null);
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

  // Initialize filters from URL on mount and when dept changes
  useEffect(() => {
    const qParam = (urlSearchParams.get("q") || "").trim();
    const statusParam = urlSearchParams.get("status") || "";
    const fromParam = urlSearchParams.get("from") || "";
    const toParam = urlSearchParams.get("to") || "";
    const pageParam = parseInt(urlSearchParams.get("p") || "1", 10) || 1;
    if (qParam || statusParam || fromParam || toParam) {
      setSearchText(qParam);
      setStatusFilter(statusParam);
      setAppliedSearch(qParam);
      setAppliedStatus(statusParam);
      setFromDate(fromParam);
      setToDate(toParam);
      setAppliedFrom(fromParam);
      setAppliedTo(toParam);
      setPage(pageParam);
      fetchSearch(qParam, statusParam);
    } else {
      // no filters: load base
      setPage(pageParam);
      if (pageParam === 1) {
        fetchPage(1);
      } else {
        // Need to fetch previous pages to get to the desired page
        const fetchToPage = async () => {
          let cursor = null;
          for (let i = 1; i < pageParam; i++) {
            let q = query(
              collection(db, "posts"),
              where("departmentTag", "==", dept),
              orderBy("createdAt", "desc"),
              limit(PAGE_SIZE)
            );
            if (cursor) {
              q = query(
                collection(db, "posts"),
                where("departmentTag", "==", dept),
                orderBy("createdAt", "desc"),
                startAfter(cursor),
                limit(PAGE_SIZE)
              );
            }
            const snapshot = await getDocs(q);
            if (snapshot.docs.length > 0) {
              cursor = snapshot.docs[snapshot.docs.length - 1];
            } else {
              break;
            }
          }
          if (cursor) {
            fetchPage(pageParam, cursor);
          } else {
            fetchPage(1);
            setPage(1);
          }
        };
        if (dept) fetchToPage();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept]);

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
        {/* Dropdowns and dates - on same line */}
        <HStack spacing={3} align="center" wrap="wrap">
          <Select
            placeholder="Status (all)"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            bg="white"
            size="md"
            flex={{ base: "1", md: "0 0 auto" }}
            minW={{ base: "calc(50% - 6px)", md: "160px" }}
            maxW={{ base: "calc(50% - 6px)", md: "160px" }}
            borderRadius="md"
          >
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
            {isSuperAdmin && <option value="deleted">Deleted</option>}
          </Select>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            bg="white"
            size="md"
            flex={{ base: "1", md: "0 0 auto" }}
            minW={{ base: "calc(50% - 6px)", md: "150px" }}
            maxW={{ base: "calc(50% - 6px)", md: "150px" }}
            borderRadius="md"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            bg="white"
            size="md"
            flex={{ base: "1", md: "0 0 auto" }}
            minW={{ base: "calc(50% - 6px)", md: "150px" }}
            maxW={{ base: "calc(50% - 6px)", md: "150px" }}
            borderRadius="md"
          />
        </HStack>
        {/* Buttons - on separate line */}
        <HStack spacing={3} w="100%">
          <Button
            colorScheme="blue"
            onClick={handleApplySearch}
            isDisabled={!hasTyped && !hasStatusSelected && !fromDate && !toDate}
            size="md"
            flex="1"
          >
            Search
          </Button>
          <Button
            onClick={handleClearSearch}
            isDisabled={!isSearchingActive}
            colorScheme="red"
            size="md"
            flex="1"
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
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
          {(isSearchingActive
            ? filteredPostsWithDistance.slice(
                (page - 1) * PAGE_SIZE,
                page * PAGE_SIZE
              )
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
      )}

      {/* Truncated Pagination controls */}
      {(!isSearchingActive && totalDocs > PAGE_SIZE) ||
      (isSearchingActive &&
        (filteredPostsWithDistance.length > PAGE_SIZE || page > 1)) ? (
        <HStack spacing={2} justifyContent="center" mt={6}>
          <Button
            size="sm"
            onClick={() => {
              const newPage = Math.max(1, page - 1);
              setPage(newPage);
              if (!isSearchingActive) {
                fetchPage(newPage);
              }
              const next = new URLSearchParams(urlSearchParams);
              next.set("p", String(newPage));
              setUrlSearchParams(next, { replace: false });
            }}
            isDisabled={page === 1 || isLoading}
          >
            Prev
          </Button>

          {(() => {
            const totalPages = isSearchingActive
              ? Math.ceil(filteredPostsWithDistance.length / PAGE_SIZE)
              : Math.ceil(totalDocs / PAGE_SIZE);
            const pageNumbers = [];

            // Always show first page
            if (page > 3) pageNumbers.push(1);
            if (page > 4) pageNumbers.push("...");

            // Show pages around current page
            for (
              let i = Math.max(1, page - 2);
              i <= Math.min(totalPages, page + 2);
              i++
            ) {
              pageNumbers.push(i);
            }

            // Always show last page
            if (page < totalPages - 3) pageNumbers.push("...");
            if (page < totalPages - 2) pageNumbers.push(totalPages);

            return pageNumbers.map((pageNum, index) => {
              if (pageNum === "...") {
                return (
                  <Text key={`ellipsis-${index}`} color="gray.500">
                    ...
                  </Text>
                );
              }
              return (
                <Button
                  key={pageNum}
                  size="sm"
                  variant={pageNum === page ? "solid" : "outline"}
                  colorScheme={pageNum === page ? "blue" : "gray"}
                  onClick={() => {
                    setPage(pageNum);
                    if (!isSearchingActive) fetchPage(pageNum);
                    const next = new URLSearchParams(urlSearchParams);
                    next.set("p", String(pageNum));
                    setUrlSearchParams(next, { replace: false });
                  }}
                  isDisabled={isLoading}
                >
                  {pageNum}
                </Button>
              );
            });
          })()}

          <Button
            size="sm"
            onClick={() => {
              const newPage = page + 1;
              setPage(newPage);
              if (!isSearchingActive) {
                fetchPage(newPage, lastVisible);
              }
              const next = new URLSearchParams(urlSearchParams);
              next.set("p", String(newPage));
              setUrlSearchParams(next, { replace: false });
            }}
            isDisabled={
              isLoading ||
              (!isSearchingActive &&
                page === Math.ceil(totalDocs / PAGE_SIZE)) ||
              (isSearchingActive &&
                page ===
                  Math.ceil(filteredPostsWithDistance.length / PAGE_SIZE))
            }
          >
            Next
          </Button>
        </HStack>
      ) : null}

      {/* loading state handled inline with skeletons above */}
    </Container>
  );
}

// 4) add an notification icon on the navbar near the left-side of user identity(admin, public,etc...). this feature will notify the change in status and action note stated by the admin. Like once the admin reply or make any changes on the user's post it should notify the user on the notification feature. there should be an bell icon with the number of the notification
// the moblie view is perfectly okay, but in desktop view make the search and clear button on the same line to the dropdowns and from and to dates.
