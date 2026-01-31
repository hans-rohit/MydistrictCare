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
import { db } from "../../models/firebase";
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
import { keyframes } from "@emotion/react";
import {
  FaHandsHelping,
  FaMapMarkerAlt,
  FaRegLightbulb,
  FaArrowRight,
} from "react-icons/fa";
import PostCard from "../components/PostCard";
import IssuesMap from "../components/IssuesMap";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../controllers/AuthContext";

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

export default function Home({ showIntro = true }) {
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  const { user, profile, loading } = useAuth();
  const [posts, setPosts] = useState([]);
  const [allPosts, setAllPosts] = useState([]);
  const [error, setError] = useState(null);
  const [totalDocs, setTotalDocs] = useState(0);
  const [counts, setCounts] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    resolved_pending_verification: 0,
    resolved_verified: 0,
    rejected: 0,
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
  const [statusFilter, setStatusFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [appliedDept, setAppliedDept] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const navigate = useNavigate();
  const PAGE_SIZE = 6;
  const isSuperAdmin = profile?.role === "admin";

  const hasTyped = searchText.trim().length > 0;
  const hasStatusSelected = !!statusFilter;
  const hasDeptSelected = !!deptFilter;
  const isSearchingActive =
    appliedSearch.trim().length > 0 ||
    !!appliedStatus ||
    !!appliedDept ||
    !!appliedFrom ||
    !!appliedTo;

  useEffect(() => {
    const q = query(collection(db, "posts"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        let posts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (!isSuperAdmin) {
          posts = posts.filter((p) => !p.deleted && p.status !== "deleted");
        }

        setTotalDocs(posts.length);
        setAllPosts(posts);

        setError(null);
      },
      (err) => setError(err.message),
    );
    return () => unsub();
  }, []);

  const loadInitial = async () => {
    setIsLoading(true);
    setPosts([]);
    setLastVisible(null);
    setHasMore(true);
    try {
      let q = query(
        collection(db, "posts"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE * 3),
      );

      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      const countQuery = query(
        collection(db, "posts"),
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
        resolved_pending_verification: 0,
        resolved_verified: 0,
        rejected: 0,
        deleted: 0,
      };
      allPosts.forEach((p) => {
        if (p?.status && c[p.status] !== undefined) c[p.status]++;
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
    } finally {
      setIsLoading(false);
    }
  };

  const loadNext = async () => {
    if (!lastVisible || isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    try {
      const q = query(
        collection(db, "posts"),
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
        if (!first.isIntersecting) return;

        if (isSearchingActive) {
          if (searchHasMore && !searchIsFetchingMore && !isLoading) {
            fetchSearchNext();
          }
        } else {
          if (hasMore && !isFetchingMore && !isLoading) {
            loadNext();
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
    searchHasMore,
    isFetchingMore,
    searchIsFetchingMore,
    isLoading,
  ]);

  useEffect(() => {}, [totalDocs, PAGE_SIZE]);

  const filteredPosts = useMemo(() => {
    return posts;
  }, [posts]);

  const handleApplySearch = () => {
    const trimmedSearch = searchText.trim();
    setAppliedSearch(trimmedSearch);
    setAppliedStatus(statusFilter);
    setAppliedDept(deptFilter);
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);

    if (trimmedSearch || statusFilter || deptFilter || fromDate || toDate) {
      fetchSearch(trimmedSearch, statusFilter, deptFilter, fromDate, toDate);
    }

    const next = new URLSearchParams(urlSearchParams);
    if (trimmedSearch) next.set("q", trimmedSearch);
    else next.delete("q");
    if (statusFilter) next.set("status", statusFilter);
    else next.delete("status");
    if (deptFilter) next.set("dept", deptFilter);
    else next.delete("dept");
    if (fromDate) next.set("from", fromDate);
    else next.delete("from");
    if (toDate) next.set("to", toDate);
    else next.delete("to");
    setUrlSearchParams(next, { replace: false });
  };

  const handleClearSearch = () => {
    setSearchText("");
    setStatusFilter("");
    setDeptFilter("");
    setAppliedSearch("");
    setAppliedStatus("");
    setAppliedDept("");
    setFromDate("");
    setToDate("");
    setAppliedFrom("");
    setAppliedTo("");
    loadInitial();

    const next = new URLSearchParams(urlSearchParams);
    next.delete("q");
    next.delete("status");
    next.delete("dept");
    next.delete("from");
    next.delete("to");
    setUrlSearchParams(next, { replace: false });
  };

  const fetchSearch = async (keyword, status, dept, fromDate, toDate) => {
    setIsLoading(true);
    setPosts([]);
    setSearchLastVisible(null);
    setSearchHasMore(true);
    try {
      const constraints = [];
      if (dept) constraints.push(whereField("departmentTag", dept));

      let qRef = collection(db, "posts");
      let q = constraints.length
        ? query(
            qRef,
            ...constraints,
            orderBy("createdAt", "desc"),
            limit(PAGE_SIZE * 2),
          )
        : query(qRef, orderBy("createdAt", "desc"), limit(PAGE_SIZE * 2));

      const snapshot = await getDocs(q);
      let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

      let countQuery = constraints.length
        ? query(qRef, ...constraints, orderBy("createdAt", "desc"))
        : query(qRef, orderBy("createdAt", "desc"));
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
        in_progr_pending_verification: 0,
        resolved_verifiedess: 0,
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

      if (pageList.length > 0) {
        const lastShownId = pageList[pageList.length - 1].id;
        const lastDoc =
          snapshot.docs.find((d) => d.id === lastShownId) ||
          snapshot.docs[snapshot.docs.length - 1] ||
          null;
        setSearchLastVisible(lastDoc);
      } else {
        setSearchLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
      }

      setSearchHasMore(snapshot.docs.length > PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSearchNext = async () => {
    if (!searchLastVisible || searchIsFetchingMore || !searchHasMore) return;
    setSearchIsFetchingMore(true);
    try {
      const constraints = [];
      if (appliedDept)
        constraints.push(whereField("departmentTag", appliedDept));

      let qRef = collection(db, "posts");
      let q = constraints.length
        ? query(
            qRef,
            ...constraints,
            orderBy("createdAt", "desc"),
            startAfter(searchLastVisible),
            limit(PAGE_SIZE * 2),
          )
        : query(
            qRef,
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
        const to = appliedTo ? new Date(appliedTo + "T23:59:59.999") : null;
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
        const lastDoc =
          snapshot.docs.find((d) => d.id === lastShownId) ||
          snapshot.docs[snapshot.docs.length - 1] ||
          null;
        setSearchLastVisible(lastDoc);
      } else {
        setSearchLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
      }

      setSearchHasMore(snapshot.docs.length > PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearchIsFetchingMore(false);
    }
  };

  useEffect(() => {
    if (loading) return;

    const qParam = (urlSearchParams.get("q") || "").trim();
    const statusParam = urlSearchParams.get("status") || "";
    const deptParam = urlSearchParams.get("dept") || "";
    const fromParam = urlSearchParams.get("from") || "";
    const toParam = urlSearchParams.get("to") || "";
    if (qParam || statusParam || deptParam || fromParam || toParam) {
      setSearchText(qParam);
      setStatusFilter(statusParam);
      setDeptFilter(deptParam);
      setAppliedSearch(qParam);
      setAppliedStatus(statusParam);
      setAppliedDept(deptParam);
      setFromDate(fromParam);
      setToDate(toParam);
      setAppliedFrom(fromParam);
      setAppliedTo(toParam);
      fetchSearch(qParam, statusParam, deptParam, fromParam, toParam);
    } else {
      loadInitial();
    }
  }, [loading, profile?.role]);

  const whereField = (field, value, isArrayContains = false) => {
    if (isArrayContains) {
      return where(field, "array-contains", value);
    }
    return where(field, "==", value);
  };

  return (
    <Container maxW="container.lg" py={10}>
      {showIntro && (
        <>
          <Box
            bgGradient="linear(to-r, blue.500, teal.400)"
            color="white"
            borderRadius="2xl"
            p={{ base: 6, md: 10 }}
            mb={10}
            textAlign="center"
            boxShadow="none"
            mx="auto"
            maxW={{ base: "100%", md: "container.md" }}
          >
            <Heading size="xl" mb={4}>
              Welcome to District Care
            </Heading>
            <Text fontSize="lg" maxW="700px" mx="auto">
              Empowering citizens and departments to make our districts cleaner,
              safer, and better together.
            </Text>
            {}
            <Button
              mt={6}
              size="lg"
              bgGradient="linear(to-r, blue.600, teal.500)"
              color="white"
              boxShadow="md"
              _hover={{
                bgGradient: "linear(to-r, blue.700, teal.600)",
                transform: "translateY(-1px)",
                animationPlayState: "paused",
                opacity: 1,
              }}
              _active={{
                bgGradient: "linear(to-r, blue.800, teal.700)",
                transform: "translateY(0)",
                animationPlayState: "paused",
                opacity: 1,
              }}
              _focus={{
                boxShadow: "outline",
                animationPlayState: "paused",
                opacity: 1,
              }}
              onClick={() => {
                if (user) {
                  navigate("/create");
                } else {
                  navigate("/login");
                }
              }}
              animation={`${keyframes`
                0%, 100% { opacity: 1; transform: translateY(0); }
                50% { opacity: 0.5; transform: translateY(-2px); }
              `} 1.2s ease-in-out infinite`}
            >
              Report an Issue
            </Button>
          </Box>

          <Box
            bg="white"
            p={6}
            mb={10}
            boxShadow="none"
            mx="auto"
            maxW={{ base: "100%", md: "container.md" }}
          >
            <Heading size="md" mb={3} textAlign="center">
              About District Care
            </Heading>
            <Text
              color="gray.600"
              textAlign={{ base: "justify", md: "center" }}
              fontStyle="italic"
            >
              District Care is a community-driven platform that bridges the gap
              between citizens and local government departments. Users can
              report local issues like road damage, garbage collection, or water
              leakage with photos, descriptions, and locations. Departments can
              track, respond, and resolve these issues in real time, ensuring
              transparency and accountability.
            </Text>
          </Box>

          <VStack spacing={8} mb={10}>
            <Heading size="md">How It Works</Heading>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
              <Box
                textAlign="center"
                p={6}
                bg="gray.50"
                borderRadius="xl"
                boxShadow="none"
                transition="0.3s"
                mx="auto"
              >
                <Icon
                  as={FaMapMarkerAlt}
                  boxSize={10}
                  color="blue.500"
                  mb={3}
                />
                <Heading size="sm" mb={2}>
                  1️⃣ Report an Issue
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  Upload a photo, add details, and share the exact location of
                  the problem.
                </Text>
              </Box>

              <Box
                textAlign="center"
                p={6}
                bg="gray.50"
                borderRadius="xl"
                boxShadow="none"
                transition="0.3s"
                mx="auto"
              >
                <Icon
                  as={FaHandsHelping}
                  boxSize={10}
                  color="teal.500"
                  mb={3}
                />
                <Heading size="sm" mb={2}>
                  2️⃣ Department Action
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  The issue is assigned to the respective department for review
                  and action.
                </Text>
              </Box>

              <Box
                textAlign="center"
                p={6}
                bg="gray.50"
                borderRadius="xl"
                boxShadow="none"
                transition="0.3s"
                mx="auto"
              >
                <Icon
                  as={FaRegLightbulb}
                  boxSize={10}
                  color="orange.400"
                  mb={3}
                />
                <Heading size="sm" mb={2}>
                  3️⃣ Real-time Updates
                </Heading>
                <Text fontSize="sm" color="gray.600">
                  Citizens can track the progress, receive updates, and see when
                  the issue is resolved.
                </Text>
              </Box>
            </SimpleGrid>
          </VStack>

          <Divider mb={4} />
        </>
      )}

      {}
      <IssuesMap posts={allPosts} />

      <HStack justify="space-between" mb={6} align="center" wrap="wrap" gap={2}>
        <Heading size="md">Recent Reports</Heading>
      </HStack>

      {}
      <Box
        display="flex"
        overflowX="auto"
        gap={2}
        mb={5}
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
      </Box>

      {}
      {!showIntro && (
        <VStack align="stretch" spacing={2} mb={4}>
          {}
          <HStack
            spacing={3}
            align="center"
            wrap={{ base: "wrap", md: "wrap", lg: "nowrap" }}
            w="100%"
          >
            <Select
              placeholder="Department (all)"
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setSearchText("");
              }}
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
              placeholder="Issue Type (all)"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              bg="white"
              size="md"
              flex={{ base: "1", md: "0 0 auto", lg: "0 0 auto" }}
              minW={{ base: "calc(50% - 6px)", md: "180px", lg: "180px" }}
              maxW={{ base: "calc(50% - 6px)", md: "180px", lg: "180px" }}
              borderRadius="md"
              isDisabled={!deptFilter}
            >
              {deptFilter &&
                ISSUE_TITLES[deptFilter]?.map((title) => (
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
      )}

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
              <Skeleton height="180px" mb={3} borderRadius="md" />
              <SkeletonText mt="4" noOfLines={3} spacing="4" />
            </Box>
          ))}
        </SimpleGrid>
      ) : (
          isSearchingActive ? filteredPosts.length === 0 : posts.length === 0
        ) ? (
        isSearchingActive ? (
          <Box textAlign="center" py={10} color="gray.600">
            No relavent reports
          </Box>
        ) : (
          <Box textAlign="center" py={10} color="gray.500">
            No reports yet. Be the first to make a difference!
          </Box>
        )
      ) : (
        <>
          {}
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
            {(isSearchingActive ? filteredPosts : posts)
              .slice(0, showIntro && !isSearchingActive ? 6 : undefined)
              .map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  showAsYou={user && post?.createdBy?.uid === user.uid}
                />
              ))}
          </SimpleGrid>

          {}
          {showIntro && !isSearchingActive && posts.length > 6 && (
            <Box textAlign="center" mt={8} mb={6}>
              <Button
                colorScheme="blue"
                size="lg"
                rightIcon={<FaArrowRight />}
                onClick={() => navigate("/feed")}
                px={8}
                py={6}
                fontSize="md"
                fontWeight="semibold"
                boxShadow="md"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "lg",
                }}
                transition="all 0.2s"
              >
                Show More Posts
              </Button>
            </Box>
          )}

          {}
          {!showIntro && (
            <Box ref={loadMoreRef} textAlign="center" py={4} color="gray.600">
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
          )}
        </>
      )}
    </Container>
  );
}
