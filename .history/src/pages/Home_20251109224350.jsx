import { useEffect, useState, useMemo, useRef } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  limit,
  startAfter,
  getDocs,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  SimpleGrid,
  Container,
  Alert,
  AlertIcon,
  Box,
  Heading,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  HStack,
  Button,
  Divider,
  Icon,
  Skeleton,
  SkeletonText,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Spinner,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { useAuth } from "../context/AuthContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import PostCard from "../components/PostCard";

const PAGE_SIZE = 6;

export default function Home({ showIntro = false }) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();

  // States for base feed
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  // Counts
  const [totalCount, setTotalCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [inProgressCount, setInProgressCount] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);

  // Search/filter states
  const [searchText, setSearchText] = useState(urlSearchParams.get("q") || "");
  const [deptFilter, setDeptFilter] = useState(
    urlSearchParams.get("dept") || ""
  );
  const [statusFilter, setStatusFilter] = useState(
    urlSearchParams.get("status") || ""
  );
  const [fromDate, setFromDate] = useState(urlSearchParams.get("from") || "");
  const [toDate, setToDate] = useState(urlSearchParams.get("to") || "");

  const [appliedSearchText, setAppliedSearchText] = useState("");
  const [appliedDept, setAppliedDept] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  const [isSearchingActive, setIsSearchingActive] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLastVisible, setSearchLastVisible] = useState(null);
  const [searchHasMore, setSearchHasMore] = useState(true);
  const [searchIsFetchingMore, setSearchIsFetchingMore] = useState(false);

  // Intersection Observer ref
  const sentinelRef = useRef(null);

  const isSuperAdmin = profile?.role === "admin";

  // Derived states
  const hasTyped = searchText.trim().length > 0;
  const hasStatusSelected = statusFilter !== "";

  // Calculate counts from posts
  const calculateCounts = (allPosts) => {
    const total = allPosts.length;
    const pending = allPosts.filter((p) => p.status === "pending").length;
    const inProgress = allPosts.filter((p) => p.status === "in_progress")
      .length;
    const resolved = allPosts.filter((p) => p.status === "resolved").length;

    setTotalCount(total);
    setPendingCount(pending);
    setInProgressCount(inProgress);
    setResolvedCount(resolved);
  };

  // Load initial data
  const loadInitial = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Build query
      let q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE * 3)
      );

      const snapshot = await getDocs(q);
      const allDocs = snapshot.docs;

      // Filter on client side
      let filtered = allDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter deleted posts for non-super-admins
      if (!isSuperAdmin) {
        filtered = filtered.filter((post) => !post.deleted);
      }

      // Calculate counts from ALL posts (for base feed)
      const countQuery = query(collection(db, "posts"));
      const countSnapshot = await getDocs(countQuery);
      let countPosts = countSnapshot.docs.map((doc) => doc.data());
      if (!isSuperAdmin) {
        countPosts = countPosts.filter((post) => !post.deleted);
      }
      calculateCounts(countPosts);

      // Take first PAGE_SIZE for display
      const displayPosts = filtered.slice(0, PAGE_SIZE);
      setPosts(displayPosts);

      // Set pagination
      if (displayPosts.length > 0) {
        const lastDoc = allDocs.find(
          (doc) => doc.id === displayPosts[displayPosts.length - 1].id
        );
        setLastVisible(lastDoc);
      }
      setHasMore(filtered.length > PAGE_SIZE);
    } catch (err) {
      console.error("Error loading posts:", err);
      setError("Failed to load posts. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Load next page (base feed)
  const loadNext = async () => {
    if (!hasMore || isFetchingMore || !lastVisible) return;

    try {
      setIsFetchingMore(true);

      const q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc"),
        startAfter(lastVisible),
        limit(PAGE_SIZE * 3)
      );

      const snapshot = await getDocs(q);
      const allDocs = snapshot.docs;

      let filtered = allDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      if (!isSuperAdmin) {
        filtered = filtered.filter((post) => !post.deleted);
      }

      const displayPosts = filtered.slice(0, PAGE_SIZE);

      if (displayPosts.length > 0) {
        setPosts((prev) => [...prev, ...displayPosts]);
        const lastDoc = allDocs.find(
          (doc) => doc.id === displayPosts[displayPosts.length - 1].id
        );
        setLastVisible(lastDoc);
        setHasMore(filtered.length > PAGE_SIZE);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading more posts:", err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  // Fetch search results
  const fetchSearch = async (
    searchQuery,
    dept,
    status,
    from,
    to,
    isInitial = true
  ) => {
    try {
      if (isInitial) {
        setIsLoading(true);
      } else {
        setSearchIsFetchingMore(true);
      }
      setError("");

      // Build base query
      let q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE * 3)
      );

      if (!isInitial && searchLastVisible) {
        q = query(
          collection(db, "posts"),
          orderBy("createdAt", "desc"),
          startAfter(searchLastVisible),
          limit(PAGE_SIZE * 3)
        );
      }

      const snapshot = await getDocs(q);
      const allDocs = snapshot.docs;

      let filtered = allDocs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Client-side filtering
      if (!isSuperAdmin) {
        filtered = filtered.filter((post) => !post.deleted);
      }

      if (dept) {
        filtered = filtered.filter((post) => post.departmentTag === dept);
      }

      if (status) {
        filtered = filtered.filter((post) => post.status === status);
      }

      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filtered = filtered.filter((post) =>
          post.title?.toLowerCase().includes(lowerQuery)
        );
      }

      if (from) {
        const fromTime = new Date(from).getTime();
        filtered = filtered.filter((post) => {
          const postTime = post.createdAt?.toMillis
            ? post.createdAt.toMillis()
            : 0;
          return postTime >= fromTime;
        });
      }

      if (to) {
        const toTime = new Date(to).getTime() + 86400000; // +1 day
        filtered = filtered.filter((post) => {
          const postTime = post.createdAt?.toMillis
            ? post.createdAt.toMillis()
            : 0;
          return postTime <= toTime;
        });
      }

      // Calculate counts from filtered results
      if (isInitial) {
        calculateCounts(filtered);
      }

      const displayPosts = filtered.slice(0, PAGE_SIZE);

      if (isInitial) {
        setSearchResults(displayPosts);
      } else {
        setSearchResults((prev) => [...prev, ...displayPosts]);
      }

      if (displayPosts.length > 0) {
        const lastDoc = allDocs.find(
          (doc) => doc.id === displayPosts[displayPosts.length - 1].id
        );
        setSearchLastVisible(lastDoc);
      }

      setSearchHasMore(filtered.length > PAGE_SIZE);
    } catch (err) {
      console.error("Error searching posts:", err);
      setError("Failed to search posts. Please try again.");
    } finally {
      if (isInitial) {
        setIsLoading(false);
      } else {
        setSearchIsFetchingMore(false);
      }
    }
  };

  // Fetch next search page
  const fetchSearchNext = async () => {
    if (!searchHasMore || searchIsFetchingMore || !searchLastVisible) return;

    await fetchSearch(
      appliedSearchText,
      appliedDept,
      appliedStatus,
      appliedFrom,
      appliedTo,
      false
    );
  };

  // Handle search apply
  const handleApplySearch = () => {
    const params = new URLSearchParams();
    if (searchText.trim()) params.set("q", searchText.trim());
    if (deptFilter) params.set("dept", deptFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    setUrlSearchParams(params);

    setAppliedSearchText(searchText.trim());
    setAppliedDept(deptFilter);
    setAppliedStatus(statusFilter);
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setIsSearchingActive(true);

    fetchSearch(searchText.trim(), deptFilter, statusFilter, fromDate, toDate);
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchText("");
    setDeptFilter("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setAppliedSearchText("");
    setAppliedDept("");
    setAppliedStatus("");
    setAppliedFrom("");
    setAppliedTo("");
    setIsSearchingActive(false);
    setSearchResults([]);
    setSearchLastVisible(null);
    setSearchHasMore(true);
    setUrlSearchParams({});

    loadInitial();
  };

  // Initialize from URL params
  useEffect(() => {
    if (!profile) return;

    const q = urlSearchParams.get("q") || "";
    const dept = urlSearchParams.get("dept") || "";
    const status = urlSearchParams.get("status") || "";
    const from = urlSearchParams.get("from") || "";
    const to = urlSearchParams.get("to") || "";

    if (q || dept || status || from || to) {
      setAppliedSearchText(q);
      setAppliedDept(dept);
      setAppliedStatus(status);
      setAppliedFrom(from);
      setAppliedTo(to);
      setIsSearchingActive(true);
      fetchSearch(q, dept, status, from, to);
    } else {
      loadInitial();
    }
  }, [profile]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (isSearchingActive) {
            fetchSearchNext();
          } else {
            loadNext();
          }
        }
      },
      {
        rootMargin: "200px",
        threshold: 0.25,
      }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => {
      if (sentinelRef.current) {
        observer.unobserve(sentinelRef.current);
      }
    };
  }, [
    isSearchingActive,
    hasMore,
    searchHasMore,
    isFetchingMore,
    searchIsFetchingMore,
    lastVisible,
    searchLastVisible,
  ]);

  const displayPosts = isSearchingActive ? searchResults : posts;
  const displayHasMore = isSearchingActive ? searchHasMore : hasMore;
  const displayIsFetchingMore = isSearchingActive
    ? searchIsFetchingMore
    : isFetchingMore;

  return (
    <Container maxW="container.xl" py={8}>
      {showIntro && (
        <VStack spacing={6} mb={8} align="stretch">
          <Heading size="xl">Public Feed</Heading>
          <Text fontSize="lg" color="gray.600">
            Browse all community reports and issues. Click on any post to view
            details or vote.
          </Text>
        </VStack>
      )}

      {/* Stats */}
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={8}>
        <Stat
          px={4}
          py={3}
          bg="white"
          borderRadius="md"
          boxShadow="sm"
          borderWidth="1px"
        >
          <StatLabel fontSize="sm">Total Reports</StatLabel>
          <StatNumber fontSize="2xl">{totalCount}</StatNumber>
        </Stat>
        <Stat
          px={4}
          py={3}
          bg="white"
          borderRadius="md"
          boxShadow="sm"
          borderWidth="1px"
        >
          <StatLabel fontSize="sm">Pending</StatLabel>
          <StatNumber fontSize="2xl" color="orange.500">
            {pendingCount}
          </StatNumber>
        </Stat>
        <Stat
          px={4}
          py={3}
          bg="white"
          borderRadius="md"
          boxShadow="sm"
          borderWidth="1px"
        >
          <StatLabel fontSize="sm">In Progress</StatLabel>
          <StatNumber fontSize="2xl" color="blue.500">
            {inProgressCount}
          </StatNumber>
        </Stat>
        <Stat
          px={4}
          py={3}
          bg="white"
          borderRadius="md"
          boxShadow="sm"
          borderWidth="1px"
        >
          <StatLabel fontSize="sm">Resolved</StatLabel>
          <StatNumber fontSize="2xl" color="green.500">
            {resolvedCount}
          </StatNumber>
        </Stat>
      </SimpleGrid>

      {/* Search controls for Home feed */}
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
            placeholder="Department (all)"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            bg="white"
            size="md"
            flex={{ base: "1", md: "0 0 auto", lg: "0 0 auto" }}
            minW={{ base: "calc(50% - 6px)", md: "150px", lg: "140px" }}
            maxW={{ base: "calc(50% - 6px)", md: "150px", lg: "140px" }}
            borderRadius="md"
          >
            <option value="Electricity">Electricity</option>
            <option value="Water">Water</option>
            <option value="Sewage">Sewage</option>
            <option value="Road">Road</option>
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
            isDisabled={
              !hasTyped &&
              !hasStatusSelected &&
              !deptFilter &&
              !fromDate &&
              !toDate
            }
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

      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      {isLoading ? (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <Box
              key={`skeleton-${i}`}
              borderWidth="1px"
              borderRadius="md"
              overflow="hidden"
              bg="white"
              p={4}
            >
              <Skeleton height="200px" mb={4} borderRadius="md" />
              <SkeletonText mt="4" noOfLines={4} spacing="4" />
            </Box>
          ))}
        </SimpleGrid>
      ) : displayPosts.length === 0 ? (
        <Box textAlign="center" py={10} color="gray.600">
          <Text fontSize="lg">
            {isSearchingActive
              ? "No posts match your search criteria."
              : "No posts yet."}
          </Text>
        </Box>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            {displayPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </SimpleGrid>

          {/* Sentinel for infinite scroll */}
          {displayHasMore && (
            <Box ref={sentinelRef} py={8} textAlign="center">
              {displayIsFetchingMore && <Spinner size="lg" color="blue.500" />}
            </Box>
          )}

          {!displayHasMore && displayPosts.length > 0 && (
            <Box textAlign="center" py={8}>
              <Text color="gray.500">No more posts to load</Text>
            </Box>
          )}
        </>
      )}
    </Container>
  );
}
