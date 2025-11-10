import { useAuth } from "../context/AuthContext";
import {
  Container,
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Divider,
  Badge,
  SimpleGrid,
  Spinner,
  Button,
  Skeleton,
  SkeletonText,
} from "@chakra-ui/react";
import { Navigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  startAfter,
} from "firebase/firestore";
import { db } from "../firebase";
import PostCard from "../components/PostCard";

export default function Profile() {
  const { user, profile, loading } = useAuth();
  const [userPosts, setUserPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [activeTab, setActiveTab] = useState("live"); // 'live' or 'deleted'
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const loadMoreRef = useRef(null);
  const PAGE_SIZE = 6;

  // Fetch user's posts with pagination
  const fetchUserPosts = async (isLoadMore = false) => {
    if (!user) {
      setLoadingPosts(false);
      return;
    }

    try {
      if (!isLoadMore) {
        setLoadingPosts(true);
      } else {
        setIsFetchingMore(true);
      }

      // Build query based on active tab
      const constraints = [
        where("createdBy.uid", "==", user.uid),
        limit(PAGE_SIZE * 3), // Overfetch for client-side filtering
      ];

      if (isLoadMore && lastVisible) {
        constraints.push(startAfter(lastVisible));
      }

      const q = query(collection(db, "posts"), ...constraints);
      const snapshot = await getDocs(q);

      // Get all posts and sort client-side
      let allPosts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Filter based on tab (live or deleted)
      const filtered = allPosts.filter((post) => {
        const isDeleted = post.deleted || post.status === "deleted";
        return activeTab === "deleted" ? isDeleted : !isDeleted;
      });

      // Sort by creation date (newest first)
      filtered.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      // Update posts
      if (isLoadMore) {
        setUserPosts((prev) => [...prev, ...filtered]);
      } else {
        setUserPosts(filtered);
      }

      // Update pagination
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE * 3);
    } catch (error) {
      console.error("Error fetching user posts:", error);
    } finally {
      setLoadingPosts(false);
      setIsFetchingMore(false);
    }
  };

  // Initial fetch and tab change
  useEffect(() => {
    setUserPosts([]);
    setLastVisible(null);
    setHasMore(true);
    fetchUserPosts(false);
  }, [user, activeTab]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || isFetchingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingMore) {
          fetchUserPosts(true);
        }
      },
      {
        rootMargin: "200px",
        threshold: 0.25,
      }
    );

    observer.observe(loadMoreRef.current);

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [hasMore, isFetchingMore, lastVisible, activeTab]);

  if (loading) {
    return (
      <Container maxW="container.md" py={10}>
        <Text>Loading...</Text>
      </Container>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAdmin = profile?.role === "admin";
  const isDept = profile?.role === "dept";
  const roleDisplay = isDept ? "dept-admin" : profile?.role || "public";
  const isPublicUser = profile?.role === "public" || !profile?.role;

  return (
    <Container
      maxW="container.xl"
      py={{ base: 6, md: 10 }}
      px={{ base: 4, md: 6 }}
    >
      <VStack spacing={{ base: 6, md: 8 }} align="stretch">
        <Heading 
          size={{ base: "md", md: "lg" }} 
          pl={{ base: 4, md: 6 }}
          bgGradient="linear(to-r, #3B82F6, #8B5CF6, #EC4899)"
          bgClip="text"
        >
          Profile
        </Heading>

        {/* Profile Details - Centered with max width */}
        <Container maxW="container.md" px={0}>
          <Box
            p={{ base: 4, md: 8 }}
            borderRadius="2xl"
            bg="white"
            boxShadow="0 10px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)"
            borderWidth="1px"
            borderColor="gray.200"
            bgGradient="linear(to-br, white, gray.50)"
            position="relative"
            overflow="hidden"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: "4px",
              background: "linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899)",
            }}
            css={{
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
          >
            <VStack spacing={{ base: 3, md: 5 }} align="stretch" mt={2}>
              <Box
                p={{ base: 3, md: 4 }}
                borderRadius="lg"
                bgGradient="linear(to-r, blue.50, cyan.50)"
                borderWidth="1px"
                borderColor="blue.100"
                transition="all 0.3s ease"
                _hover={{
                  borderColor: "blue.300",
                  boxShadow: "md",
                  transform: "translateY(-2px)",
                }}
              >
                <HStack
                  justify="space-between"
                  align={{ base: "flex-start", md: "center" }}
                  flexDirection={{ base: "column", md: "row" }}
                  spacing={{ base: 2, md: 0 }}
                >
                  <Text
                    fontSize={{ base: "xs", md: "sm" }}
                    fontWeight="bold"
                    color="gray.700"
                    textTransform="uppercase"
                    letterSpacing="wide"
                  >
                    Name
                  </Text>
                  <Text
                    fontSize={{ base: "md", md: "lg" }}
                    fontWeight="semibold"
                    color="gray.900"
                    wordBreak="break-word"
                    textAlign={{ base: "left", md: "right" }}
                  >
                    {profile?.name || user?.displayName || "Not set"}
                  </Text>
                </HStack>
              </Box>

              <Box
                p={{ base: 3, md: 4 }}
                borderRadius="lg"
                bgGradient="linear(to-r, purple.50, pink.50)"
                borderWidth="1px"
                borderColor="purple.100"
                transition="all 0.3s ease"
                _hover={{
                  borderColor: "purple.300",
                  boxShadow: "md",
                  transform: "translateY(-2px)",
                }}
              >
                <HStack
                  justify="space-between"
                  align={{ base: "flex-start", md: "center" }}
                  flexDirection={{ base: "column", md: "row" }}
                  spacing={{ base: 2, md: 0 }}
                >
                  <Text
                    fontSize={{ base: "xs", md: "sm" }}
                    fontWeight="bold"
                    color="gray.700"
                    textTransform="uppercase"
                    letterSpacing="wide"
                  >
                    Email
                  </Text>
                  <Text
                    fontSize={{ base: "sm", md: "lg" }}
                    fontWeight="semibold"
                    color="gray.900"
                    wordBreak="break-word"
                    textAlign={{ base: "left", md: "right" }}
                  >
                    {profile?.email || user?.email || "Not set"}
                  </Text>
                </HStack>
              </Box>

              <Box
                p={{ base: 3, md: 4 }}
                borderRadius="lg"
                bgGradient="linear(to-r, green.50, teal.50)"
                borderWidth="1px"
                borderColor="green.100"
                transition="all 0.3s ease"
                _hover={{
                  borderColor: "green.300",
                  boxShadow: "md",
                  transform: "translateY(-2px)",
                }}
              >
                <HStack
                  justify="space-between"
                  align={{ base: "flex-start", md: "center" }}
                  flexDirection={{ base: "column", md: "row" }}
                  spacing={{ base: 2, md: 0 }}
                >
                  <Text
                    fontSize={{ base: "xs", md: "sm" }}
                    fontWeight="bold"
                    color="gray.700"
                    textTransform="uppercase"
                    letterSpacing="wide"
                  >
                    Password
                  </Text>
                  <Text
                    fontSize={{ base: "md", md: "lg" }}
                    fontWeight="semibold"
                    color="gray.900"
                    letterSpacing="wider"
                    fontFamily="mono"
                  >
                    ••••••••••
                  </Text>
                </HStack>
              </Box>

              {isDept && profile?.department && (
                <Box
                  p={{ base: 3, md: 4 }}
                  borderRadius="lg"
                  bgGradient="linear(to-r, orange.50, yellow.50)"
                  borderWidth="1px"
                  borderColor="orange.100"
                  transition="all 0.3s ease"
                  _hover={{
                    borderColor: "orange.300",
                    boxShadow: "md",
                    transform: "translateY(-2px)",
                  }}
                >
                  <HStack
                    justify="space-between"
                    align={{ base: "flex-start", md: "center" }}
                    flexDirection={{ base: "column", md: "row" }}
                    spacing={{ base: 2, md: 0 }}
                  >
                    <Text
                      fontSize={{ base: "xs", md: "sm" }}
                      fontWeight="bold"
                      color="gray.700"
                      textTransform="uppercase"
                      letterSpacing="wide"
                    >
                      Department
                    </Text>
                    <Badge
                      colorScheme="orange"
                      fontSize={{ base: "sm", md: "md" }}
                      px={{ base: 2, md: 3 }}
                      py={{ base: 1, md: 1.5 }}
                      borderRadius="md"
                    >
                      {profile.department}
                    </Badge>
                  </HStack>
                </Box>
              )}

              <Box
                p={{ base: 3, md: 4 }}
                borderRadius="lg"
                bgGradient="linear(to-r, indigo.50, purple.50)"
                borderWidth="1px"
                borderColor="indigo.100"
                transition="all 0.3s ease"
                _hover={{
                  borderColor: "indigo.300",
                  boxShadow: "md",
                  transform: "translateY(-2px)",
                }}
              >
                <HStack
                  justify="space-between"
                  align={{ base: "flex-start", md: "center" }}
                  flexDirection={{ base: "column", md: "row" }}
                  spacing={{ base: 2, md: 0 }}
                >
                  <Text
                    fontSize={{ base: "xs", md: "sm" }}
                    fontWeight="bold"
                    color="gray.700"
                    textTransform="uppercase"
                    letterSpacing="wide"
                  >
                    Role
                  </Text>
                  <Badge
                    colorScheme={
                      isAdmin ? "purple" : isDept ? "orange" : "blue"
                    }
                    fontSize={{ base: "sm", md: "md" }}
                    px={{ base: 2, md: 3 }}
                    py={{ base: 1, md: 1.5 }}
                    textTransform="capitalize"
                    borderRadius="md"
                  >
                    {roleDisplay}
                  </Badge>
                </HStack>
              </Box>
            </VStack>
          </Box>
        </Container>

        {/* Your Posts Section - Only for Public Users */}
        {isPublicUser && (
          <Box mt={6}>
            <Heading
              size={{ base: "md", md: "lg" }}
              mb={4}
              pl={{ base: 4, md: 6 }}
            >
              Your Posts
            </Heading>

            {/* Tab Buttons */}
            <HStack justify="center" spacing={4} mb={6}>
              <Button
                colorScheme={activeTab === "live" ? "blue" : "gray"}
                variant={activeTab === "live" ? "solid" : "outline"}
                onClick={() => setActiveTab("live")}
                size={{ base: "sm", md: "md" }}
              >
                Live
              </Button>
              <Button
                colorScheme={activeTab === "deleted" ? "red" : "gray"}
                variant={activeTab === "deleted" ? "solid" : "outline"}
                onClick={() => setActiveTab("deleted")}
                size={{ base: "sm", md: "md" }}
              >
                Deleted
              </Button>
            </HStack>

            {loadingPosts ? (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
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
            ) : userPosts.length === 0 ? (
              <Box
                p={{ base: 6, md: 8 }}
                borderRadius="lg"
                bg="white"
                borderWidth="1px"
                borderColor="gray.200"
                textAlign="center"
              >
                <Text fontSize={{ base: "md", md: "lg" }} color="gray.600">
                  No posts yet
                </Text>
                <Text fontSize="sm" color="gray.500" mt={2}>
                  {activeTab === "live"
                    ? "You haven't reported any issues yet."
                    : "You don't have any deleted posts."}
                </Text>
              </Box>
            ) : (
              <>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                  {userPosts.map((post) => (
                    <PostCard key={post.id} post={post} showAsYou={true} />
                  ))}
                </SimpleGrid>

                {/* Infinite scroll sentinel */}
                {hasMore && (
                  <Box ref={loadMoreRef} py={8} textAlign="center">
                    {isFetchingMore && (
                      <>
                        <Spinner size="md" color="blue.500" />
                        <Text mt={2} fontSize="sm" color="gray.600">
                          Loading more posts...
                        </Text>
                      </>
                    )}
                  </Box>
                )}

                {!hasMore && userPosts.length > 0 && (
                  <Box py={4} textAlign="center">
                    <Text fontSize="sm" color="gray.500">
                      No more posts to load
                    </Text>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
      </VStack>
    </Container>
  );
}
