import { useEffect, useState, useMemo, useRef } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  startAfter,
  getDocs,
  doc,
  updateDoc,
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
  Badge,
  Skeleton,
  SkeletonText,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  Spinner,
  Textarea,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useDisclosure,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import { useAuth } from "../context/AuthContext";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import PostCard from "../components/PostCard";

const PAGE_SIZE = 6;

export default function DashboardDept() {
  const { dept } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
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
  const [statusFilter, setStatusFilter] = useState(
    urlSearchParams.get("status") || ""
  );
  const [fromDate, setFromDate] = useState(urlSearchParams.get("from") || "");
  const [toDate, setToDate] = useState(urlSearchParams.get("to") || "");

  const [appliedSearchText, setAppliedSearchText] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");

  const [isSearchingActive, setIsSearchingActive] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLastVisible, setSearchLastVisible] = useState(null);
  const [searchHasMore, setSearchHasMore] = useState(true);
  const [searchIsFetchingMore, setSearchIsFetchingMore] = useState(false);

  // User location
  const [userLocation, setUserLocation] = useState(null);

  // Intersection Observer ref
  const sentinelRef = useRef(null);

  // Modal for status update
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [selectedPost, setSelectedPost] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [actionNote, setActionNote] = useState("");

  const isSuperAdmin = profile?.role === "admin";
  const isDeptAdmin =
    profile?.role === "dept" && profile?.department === dept;

  // Derived states
  const hasTyped = searchText.trim().length > 0;
  const hasStatusSelected = statusFilter !== "";

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Location access denied or unavailable", error);
        }
      );
    }
  }, []);

  // Calculate distance
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Add distance to posts
  const postsWithDistance = useMemo(() => {
    if (!userLocation) return posts;
    return posts.map((post) => {
      if (post.location?.lat && post.location?.lng) {
        const dist = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          post.location.lat,
          post.location.lng
        );
        return { ...post, distance: dist.toFixed(1) };
      }
      return { ...post, distance: null };
    });
  }, [posts, userLocation]);

  const searchResultsWithDistance = useMemo(() => {
    if (!userLocation) return searchResults;
    return searchResults.map((post) => {
      if (post.location?.lat && post.location?.lng) {
        const dist = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          post.location.lat,
          post.location.lng
        );
        return { ...post, distance: dist.toFixed(1) };
      }
      return { ...post, distance: null };
    });
  }, [searchResults, userLocation]);

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
        where("departmentTag", "==", dept),
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

      // Calculate counts from ALL posts for this department
      const countQuery = query(
        collection(db, "posts"),
        where("departmentTag", "==", dept)
      );
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
        where("departmentTag", "==", dept),
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
  const fetchSearch = async (searchQuery, status, from, to, isInitial = true) => {
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
        where("departmentTag", "==", dept),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE * 3)
      );

      if (!isInitial && searchLastVisible) {
        q = query(
          collection(db, "posts"),
          where("departmentTag", "==", dept),
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
    if (statusFilter) params.set("status", statusFilter);
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);

    setUrlSearchParams(params);

    setAppliedSearchText(searchText.trim());
    setAppliedStatus(statusFilter);
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setIsSearchingActive(true);

    fetchSearch(searchText.trim(), statusFilter, fromDate, toDate);
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchText("");
    setStatusFilter("");
    setFromDate("");
    setToDate("");
    setAppliedSearchText("");
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
    const status = urlSearchParams.get("status") || "";
    const from = urlSearchParams.get("from") || "";
    const to = urlSearchParams.get("to") || "";

    if (q || status || from || to) {
      setAppliedSearchText(q);
      setAppliedStatus(status);
      setAppliedFrom(from);
      setAppliedTo(to);
      setIsSearchingActive(true);
      fetchSearch(q, status, from, to);
    } else {
      loadInitial();
    }
  }, [dept, profile]);

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

  // Handle status update
  const handleStatusChange = (post) => {
    setSelectedPost(post);
    setNewStatus(post.status);
    setActionNote("");
    onOpen();
  };

  const handleUpdateStatus = async () => {
    if (!selectedPost) return;

    try {
      const postRef = doc(db, "posts", selectedPost.id);
      await updateDoc(postRef, {
        status: newStatus,
        actionNote: actionNote || null,
      });

      toast({
        title: "Status updated",
        description: "Post status has been updated successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });

      onClose();
      // Refresh data
      if (isSearchingActive) {
        fetchSearch(
          appliedSearchText,
          appliedStatus,
          appliedFrom,
          appliedTo
        );
      } else {
        loadInitial();
      }
    } catch (err) {
      console.error("Error updating status:", err);
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  const displayPosts = isSearchingActive
    ? searchResultsWithDistance
    : postsWithDistance;
  const displayHasMore = isSearchingActive ? searchHasMore : hasMore;
  const displayIsFetchingMore = isSearchingActive
    ? searchIsFetchingMore
    : isFetchingMore;

  // Check authorization
  if (!isSuperAdmin && !isDeptAdmin) {
    return (
      <Container maxW="container.xl" py={8}>
        <Alert status="error">
          <AlertIcon />
          You don't have permission to access this dashboard.
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={6} mb={8} align="stretch">
        <Heading size="xl">
          {dept} Department Dashboard
        </Heading>
        <Text fontSize="lg" color="gray.600">
          Manage and monitor all {dept.toLowerCase()} related reports and
          issues.
        </Text>
      </VStack>

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
      ) : displayPosts.length === 0 ? (
        <Box textAlign="center" py={10} color="gray.600">
          <Text>No relevant reports</Text>
        </Box>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            {displayPosts.map((post) => (
              <Box key={post.id} position="relative">
                <PostCard post={post} showDistance={true} />
                {(isSuperAdmin || isDeptAdmin) && (
                  <Button
                    size="sm"
                    colorScheme="blue"
                    onClick={() => handleStatusChange(post)}
                    mt={2}
                    w="100%"
                  >
                    Update Status
                  </Button>
                )}
              </Box>
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

      {/* Status Update Modal */}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Update Post Status</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Box>
                <Text fontWeight="bold" mb={2}>
                  Current Status:{" "}
                  <Badge
                    colorScheme={
                      selectedPost?.status === "pending"
                        ? "orange"
                        : selectedPost?.status === "in_progress"
                        ? "blue"
                        : selectedPost?.status === "resolved"
                        ? "green"
                        : "red"
                    }
                  >
                    {selectedPost?.status}
                  </Badge>
                </Text>
              </Box>
              <Select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </Select>
              <Textarea
                placeholder="Add action note (optional)"
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                rows={4}
              />
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleUpdateStatus}>
              Update
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}
