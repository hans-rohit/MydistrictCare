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
} from "@chakra-ui/react";
import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import PostCard from "../components/PostCard";

export default function Profile() {
  const { user, profile, loading } = useAuth();
  const [userPosts, setUserPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Fetch user's posts
  useEffect(() => {
    if (!user) {
      setLoadingPosts(false);
      return;
    }

    const fetchUserPosts = async () => {
      try {
        setLoadingPosts(true);
        // Query without orderBy to avoid composite index requirement
        const q = query(
          collection(db, "posts"),
          where("createdBy.uid", "==", user.uid)
        );
        const snapshot = await getDocs(q);
        // Sort client-side instead
        const posts = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime; // Descending order (newest first)
          });
        setUserPosts(posts);
      } catch (error) {
        console.error("Error fetching user posts:", error);
      } finally {
        setLoadingPosts(false);
      }
    };

    fetchUserPosts();
  }, [user]);

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

  return (
    <Container
      maxW="container.md"
      py={{ base: 6, md: 10 }}
      px={{ base: 4, md: 6 }}
    >
      <VStack spacing={{ base: 4, md: 6 }} align="stretch">
        <Heading size={{ base: "md", md: "lg" }}>Profile</Heading>

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
              bg="gray.50"
              borderWidth="1px"
              borderColor="gray.100"
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
              bg="gray.50"
              borderWidth="1px"
              borderColor="gray.100"
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
              bg="gray.50"
              borderWidth="1px"
              borderColor="gray.100"
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
                bg="gray.50"
                borderWidth="1px"
                borderColor="gray.100"
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
              bg="gray.50"
              borderWidth="1px"
              borderColor="gray.100"
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
                  colorScheme={isAdmin ? "purple" : isDept ? "orange" : "blue"}
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

        {/* Your Posts Section */}
        <Box mt={6}>
          <Heading size={{ base: "sm", md: "md" }} mb={4}>
            Your Posts
          </Heading>

          {loadingPosts ? (
            <Box textAlign="center" py={8}>
              <Spinner size="lg" color="blue.500" />
              <Text mt={4} color="gray.600">
                Loading your posts...
              </Text>
            </Box>
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
                You haven't reported any issues yet.
              </Text>
            </Box>
          ) : (
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {userPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </SimpleGrid>
          )}
        </Box>
      </VStack>
    </Container>
  );
}
