import {
  Box,
  Image,
  Text,
  Badge,
  HStack,
  VStack,
  Stack,
  Icon,
  Tag,
  TagLabel,
  TagLeftIcon,
  Link,
  IconButton,
  useToast,
  useDisclosure,
  Button,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
} from "@chakra-ui/react";
import {
  CheckCircleIcon,
  TimeIcon,
  InfoIcon,
  ExternalLinkIcon,
  CloseIcon,
  DeleteIcon,
} from "@chakra-ui/icons";
import { MdElectricalServices } from "react-icons/md";
import { FaWater, FaRoad, FaArrowUp, FaArrowDown } from "react-icons/fa";
import { GiSewingString } from "react-icons/gi";
import { googleMapsLink } from "../lib/location";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

const statusColor = {
  pending: "yellow",
  in_progress: "orange",
  resolved: "green",
  rejected: "red",
  deleted: "gray",
};

const statusIcon = {
  pending: TimeIcon,
  in_progress: InfoIcon,
  resolved: CheckCircleIcon,
  rejected: CloseIcon,
  deleted: CloseIcon,
};

function deptIcon(dept) {
  switch (dept) {
    case "Electricity":
      return MdElectricalServices;
    case "Water":
      return FaWater;
    case "Sewage":
      return GiSewingString;
    case "Road":
      return FaRoad;
    default:
      return InfoIcon;
  }
}

export default function PostCard({ post, onDelete, showAsYou = false }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const IconComp = statusIcon[post.status] || InfoIcon;
  const DeptIcon = deptIcon(post.departmentTag);
  const mapsUrl = googleMapsLink(post.lat, post.lng);
  const isAdmin = profile?.role === "admin";
  const isSuperAdmin = profile?.role === "admin"; // Admin is super-admin
  const { isOpen, onOpen, onClose } = useDisclosure();
  const cancelRef = useRef();
  const [isDeleting, setIsDeleting] = useState(false);

  // Vote state
  const [upvotes, setUpvotes] = useState(post.upvotes || 0);
  const [downvotes, setDownvotes] = useState(post.downvotes || 0);
  const [userVote, setUserVote] = useState(null); // 'up', 'down', or null
  const [isVoting, setIsVoting] = useState(false);

  // Check if user is admin (admins can't vote)
  const canVote = user && profile?.role === "public";

  // Check if user can delete (only public users can delete their own posts)
  const canDelete =
    user &&
    profile?.role === "public" &&
    post?.createdBy?.uid === user.uid &&
    !post?.deleted;

  // Load user's vote
  useEffect(() => {
    if (user && post.id) {
      const checkUserVote = async () => {
        try {
          const voteRef = doc(db, "posts", post.id, "votes", user.uid);
          const voteSnap = await getDoc(voteRef);
          if (voteSnap.exists()) {
            setUserVote(voteSnap.data().voteType);
          }
        } catch (err) {
          console.error("Error checking vote:", err);
        }
      };
      checkUserVote();
    }
  }, [user, post.id]);

  // Load vote counts in real-time
  useEffect(() => {
    if (!post.id) return;

    const votesRef = collection(db, "posts", post.id, "votes");
    const upvotesQuery = query(votesRef, where("voteType", "==", "up"));
    const downvotesQuery = query(votesRef, where("voteType", "==", "down"));

    const unsubUp = onSnapshot(
      upvotesQuery,
      (snap) => {
        setUpvotes(snap.size);
      },
      (err) => {
        console.error("Error loading upvotes:", err);
      }
    );

    const unsubDown = onSnapshot(
      downvotesQuery,
      (snap) => {
        setDownvotes(snap.size);
      },
      (err) => {
        console.error("Error loading downvotes:", err);
      }
    );

    return () => {
      unsubUp();
      unsubDown();
    };
  }, [post.id]);

  const handleVote = async (voteType) => {
    if (!canVote || isVoting || !user) {
      if (!user) {
        toast({
          title: "Please login to vote",
          status: "info",
          duration: 2000,
          isClosable: true,
        });
      }
      return;
    }

    setIsVoting(true);
    try {
      const voteRef = doc(db, "posts", post.id, "votes", user.uid);
      const voteSnap = await getDoc(voteRef);

      if (voteSnap.exists()) {
        const existingVote = voteSnap.data().voteType;
        if (existingVote === voteType) {
          // Remove vote if clicking the same vote again
          await deleteDoc(voteRef);
          setUserVote(null);
        } else {
          // Change vote
          await setDoc(voteRef, {
            voteType,
            userId: user.uid,
            createdAt: new Date(),
          });
          setUserVote(voteType);
        }
      } else {
        // New vote
        await setDoc(voteRef, {
          voteType,
          userId: user.uid,
          createdAt: new Date(),
        });
        setUserVote(voteType);
      }
    } catch (err) {
      console.error("Error voting:", err);
      toast({
        title: "Error voting",
        description: err.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsVoting(false);
    }
  };

  // Show anonymous user for non-admins, "you" if showAsYou is true
  const displayName = showAsYou
    ? "you"
    : isAdmin
    ? post?.createdBy?.name || post?.createdBy?.email || "Unknown"
    : "anonymous user";

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const postRef = doc(db, "posts", post.id);
      await updateDoc(postRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
        status: "deleted",
      });
      toast({
        title: "Post deleted",
        description: "Your post has been deleted successfully.",
        status: "success",
        duration: 3000,
        isClosable: true,
      });
      onClose();
      if (onDelete) {
        onDelete(post.id);
      }
    } catch (err) {
      console.error("Error deleting post:", err);
      toast({
        title: "Error deleting post",
        description: err.message,
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const isDeleted = post?.deleted || post?.status === "deleted";
  const opacity = isDeleted && isSuperAdmin ? 0.5 : 1;
  const pointerEvents = isDeleted && isSuperAdmin ? "none" : "auto";

  return (
    <>
      <Box
        borderWidth="1px"
        borderRadius="md"
        overflow="hidden"
        bg="white"
        opacity={opacity}
        position="relative"
        pointerEvents={pointerEvents}
        filter={isDeleted && isSuperAdmin ? "grayscale(50%)" : "none"}
      >
        {isDeleted && isSuperAdmin && (
          <Box
            position="absolute"
            top={2}
            right={2}
            bg="red.500"
            color="white"
            px={2}
            py={1}
            borderRadius="md"
            fontSize="xs"
            fontWeight="bold"
            zIndex={10}
          >
            DELETED
          </Box>
        )}
        {post.imageURL && (
          <Image
            src={post.imageURL}
            alt={post.title}
            objectFit="cover"
            w="100%"
            maxH="280px"
          />
        )}
        <Stack p={4} spacing={2}>
          <HStack justify="space-between">
            <Text fontWeight="bold">{post.title}</Text>
            <Badge
              colorScheme={statusColor[post.status] || "gray"}
              textTransform="capitalize"
              display="flex"
              alignItems="center"
              gap={1}
            >
              <Icon as={IconComp} />
              {post.status.replace("_", " ")}
            </Badge>
          </HStack>
          <Text fontSize="sm" color="gray.700">
            {post.description}
          </Text>
          <HStack spacing={3} wrap="wrap">
            <Tag size="sm" colorScheme="blue">
              <TagLeftIcon as={DeptIcon} />
              <TagLabel>{post.departmentTag}</TagLabel>
            </Tag>
            <Badge>
              {post.lat?.toFixed ? post.lat.toFixed(4) : post.lat},{" "}
              {post.lng?.toFixed ? post.lng.toFixed(4) : post.lng}
            </Badge>
            <Link
              href={mapsUrl}
              isExternal
              fontSize="sm"
              color="blue.500"
              display="inline-flex"
              alignItems="center"
              gap={1}
            >
              Open in Maps <ExternalLinkIcon mx="2px" />
            </Link>
            {typeof post.distanceKm === "number" && (
              <Badge colorScheme="purple">
                {post.distanceKm.toFixed(2)} km away
              </Badge>
            )}
          </HStack>
          <VStack align="start" spacing={0}>
            <Text fontSize="xs" color="gray.500">
              By: {displayName}
            </Text>
            {post?.actionNote && (
              <Text fontSize="xs" color="gray.600">
                Note: {post.actionNote}
              </Text>
            )}
            <HStack justify="space-between" w="100%">
              {post?.createdAt?.toDate ? (
                <Text fontSize="xs" color="gray.500">
                  On: {post.createdAt.toDate().toLocaleString()}
                </Text>
              ) : (
                <Text fontSize="xs" color="gray.500">
                  On: N/A
                </Text>
              )}
              <HStack spacing={1}>
                {canDelete && (
                  <IconButton
                    icon={<DeleteIcon />}
                    size="xs"
                    variant="ghost"
                    aria-label="Delete post"
                    onClick={onOpen}
                    color="red.500"
                    _hover={{ bg: "red.50", color: "red.600" }}
                  />
                )}
                {canVote && (
                  <>
                    <IconButton
                      icon={<FaArrowUp />}
                      size="xs"
                      variant="outline"
                      aria-label="Upvote"
                      onClick={() => handleVote("up")}
                      isDisabled={isVoting || isDeleted}
                      color={userVote === "up" ? "#FFD700" : "gray.500"}
                      borderColor={userVote === "up" ? "#FFD700" : "gray.300"}
                      bg={userVote === "up" ? "#FFF8DC" : "transparent"}
                      _hover={{
                        borderColor: userVote === "up" ? "#FFA500" : "gray.400",
                        bg: userVote === "up" ? "#FFFACD" : "gray.50",
                      }}
                    />
                    <Text
                      fontSize="xs"
                      color="gray.500"
                      minW="20px"
                      textAlign="center"
                    >
                      {upvotes}
                    </Text>
                    <IconButton
                      icon={<FaArrowDown />}
                      size="xs"
                      variant="outline"
                      aria-label="Downvote"
                      onClick={() => handleVote("down")}
                      isDisabled={isVoting || isDeleted}
                      color={userVote === "down" ? "#FFD700" : "gray.500"}
                      borderColor={userVote === "down" ? "#FFD700" : "gray.300"}
                      bg={userVote === "down" ? "#FFF8DC" : "transparent"}
                      _hover={{
                        borderColor:
                          userVote === "down" ? "#FFA500" : "gray.400",
                        bg: userVote === "down" ? "#FFFACD" : "gray.50",
                      }}
                    />
                    <Text
                      fontSize="xs"
                      color="gray.500"
                      minW="20px"
                      textAlign="center"
                    >
                      {downvotes}
                    </Text>
                  </>
                )}
                {!canVote && (
                  <>
                    <Icon as={FaArrowUp} color="gray.400" />
                    <Text fontSize="xs" color="gray.500">
                      {upvotes}
                    </Text>
                    <Icon as={FaArrowDown} color="gray.400" />
                    <Text fontSize="xs" color="gray.500">
                      {downvotes}
                    </Text>
                  </>
                )}
              </HStack>
            </HStack>
          </VStack>
        </Stack>
      </Box>

      <AlertDialog
        isOpen={isOpen}
        leastDestructiveRef={cancelRef}
        onClose={onClose}
      >
        <AlertDialogOverlay>
          <AlertDialogContent>
            <AlertDialogHeader fontSize="lg" fontWeight="bold">
              Delete Post
            </AlertDialogHeader>

            <AlertDialogBody>
              Are you sure you want to delete this post? This action cannot be
              undone.
            </AlertDialogBody>

            <AlertDialogFooter>
              <Button ref={cancelRef} onClick={onClose}>
                Cancel
              </Button>
              <Button
                colorScheme="red"
                onClick={handleDelete}
                ml={3}
                isLoading={isDeleting}
              >
                Delete
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
