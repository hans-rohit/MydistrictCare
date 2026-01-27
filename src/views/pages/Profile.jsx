import { useAuth } from "../../controllers/AuthContext";
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
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Input,
  useDisclosure,
  useToast,
  IconButton,
} from "@chakra-ui/react";
import { EditIcon } from "@chakra-ui/icons";
import { Navigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  limit,
  startAfter,
  doc,
  updateDoc,
} from "firebase/firestore";
import { updateProfile, updatePassword } from "firebase/auth";
import { db } from "../../models/firebase";
import PostCard from "../components/PostCard";

export default function Profile() {
  const { user, profile, loading } = useAuth();
  const [userPosts, setUserPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [activeTab, setActiveTab] = useState("live");
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const loadMoreRef = useRef(null);
  const PAGE_SIZE = 6;

  const {
    isOpen: isNameOpen,
    onOpen: onNameOpen,
    onClose: onNameClose,
  } = useDisclosure();
  const {
    isOpen: isPasswordOpen,
    onOpen: onPasswordOpen,
    onClose: onPasswordClose,
  } = useDisclosure();
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);
  const toast = useToast();

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      toast({
        title: "Error",
        description: "Name cannot be empty",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setUpdating(true);
    try {
      await updateProfile(user, { displayName: newName });

      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, { name: newName });

      toast({
        title: "Success",
        description: "Name updated successfully!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      onNameClose();
      setNewName("");
    } catch (error) {
      console.error("Error updating name:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update name",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setUpdating(true);
    try {
      await updatePassword(user, newPassword);
      toast({
        title: "Success",
        description: "Password updated successfully!",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      onPasswordClose();
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error updating password:", error);
      toast({
        title: "Error",
        description:
          error.message ||
          "Failed to update password. You may need to re-login.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setUpdating(false);
    }
  };

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

      const constraints = [
        where("createdBy.uid", "==", user.uid),
        limit(PAGE_SIZE * 3),
      ];

      if (isLoadMore && lastVisible) {
        constraints.push(startAfter(lastVisible));
      }

      const q = query(collection(db, "posts"), ...constraints);
      const snapshot = await getDocs(q);

      let allPosts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const filtered = allPosts.filter((post) => {
        const isDeleted = post.deleted || post.status === "deleted";
        return activeTab === "deleted" ? isDeleted : !isDeleted;
      });

      filtered.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() || 0;
        const bTime = b.createdAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      if (isLoadMore) {
        setUserPosts((prev) => [...prev, ...filtered]);
      } else {
        setUserPosts(filtered);
      }

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

  useEffect(() => {
    setUserPosts([]);
    setLastVisible(null);
    setHasMore(true);
    fetchUserPosts(false);
  }, [user, activeTab]);

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
      },
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
          color="#2B6CB0"
          fontWeight="extrabold"
        >
          Profile
        </Heading>

        {}
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
                <HStack justify="space-between" align="center">
                  <VStack align="start" spacing={1} flex={1}>
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
                    >
                      {profile?.name || user?.displayName || "Not set"}
                    </Text>
                  </VStack>
                  <IconButton
                    icon={<EditIcon />}
                    size="sm"
                    colorScheme="blue"
                    variant="ghost"
                    onClick={() => {
                      setNewName(profile?.name || user?.displayName || "");
                      onNameOpen();
                    }}
                    aria-label="Edit name"
                  />
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
                <HStack justify="space-between" align="center">
                  <VStack align="start" spacing={1} flex={1}>
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
                  </VStack>
                  <IconButton
                    icon={<EditIcon />}
                    size="sm"
                    colorScheme="green"
                    variant="ghost"
                    onClick={onPasswordOpen}
                    aria-label="Change password"
                  />
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

        {}
        {isPublicUser && (
          <Box mt={6}>
            <Heading
              size={{ base: "md", md: "lg" }}
              mb={4}
              pl={{ base: 4, md: 6 }}
              color="#2B6CB0"
              fontWeight="extrabold"
            >
              Your Posts
            </Heading>

            {}
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

                {}
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

      {}
      <Modal isOpen={isNameOpen} onClose={onNameClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Edit Name</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>New Name</FormLabel>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter your new name"
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onNameClose}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleUpdateName}
              isLoading={updating}
            >
              Update
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {}
      <Modal isOpen={isPasswordOpen} onClose={onPasswordClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Change Password</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={4}>
              <FormControl isRequired>
                <FormLabel>New Password</FormLabel>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Confirm Password</FormLabel>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onPasswordClose}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handleUpdatePassword}
              isLoading={updating}
            >
              Update Password
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}
