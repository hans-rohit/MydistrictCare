import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Container,
  Box,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Image,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  FormControl,
  FormLabel,
  Textarea,
  Input,
  Progress,
  useDisclosure,
  useToast,
  Alert,
  AlertIcon,
  Spinner,
  Link,
  Divider,
} from "@chakra-ui/react";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
import {
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "../../models/firebase";
import { useAuth } from "../../controllers/AuthContext";
import { googleMapsLink } from "../../models/location";
import { notifyAdminsVerification } from "../../models/notifications";

const markerIcon = new L.Icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_FOLDER =
  import.meta.env.VITE_CLOUDINARY_FOLDER || "district-care/verification-images";

const statusColors = {
  pending: "purple",
  in_progress: "orange",
  resolved_pending_verification: "yellow",
  resolved_verified: "green",
  rejected: "red",
};

const statusLabels = {
  pending: "Pending",
  in_progress: "In Progress",
  resolved_pending_verification: "Resolved - Pending Verification",
  resolved_verified: "Resolved & Verified",
  rejected: "Rejected",
};

export default function IssueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, profile } = useAuth();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    isOpen: isVerifyModalOpen,
    onOpen: onVerifyModalOpen,
    onClose: onVerifyModalClose,
  } = useDisclosure();

  const {
    isOpen: isReopenModalOpen,
    onOpen: onReopenModalOpen,
    onClose: onReopenModalClose,
  } = useDisclosure();

  const [verificationComment, setVerificationComment] = useState("");
  const [verificationImage, setVerificationImage] = useState(null);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const verificationFileInputRef = useRef(null);

  useEffect(() => {
    const fetchIssue = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const docRef = doc(db, "posts", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setIssue({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError("Issue not found");
        }
      } catch (err) {
        console.error("Error fetching issue:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchIssue();
  }, [id]);

  const uploadVerificationImage = () => {
    if (!verificationImage)
      return Promise.resolve({ imageURL: "", imageStoragePath: "" });
    return new Promise((resolve, reject) => {
      const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

      const formData = new FormData();
      formData.append("file", verificationImage);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("folder", `${CLOUDINARY_FOLDER}/${user.uid}`);
      formData.append("context", `uid=${user.uid}|email=${user.email}`);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.addEventListener("progress", (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setVerificationProgress(pct);
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

  const handleVerifyAndClose = async () => {
    setIsSubmitting(true);
    try {
      const updateData = {
        status: "resolved_verified",
        verificationStatus: "verified",
        verificationDate: Timestamp.now(),
        verificationBy: {
          uid: user.uid,
          name: profile?.name || "",
        },
      };

      const statusHistoryEntry = {
        timestamp: new Date().toISOString(),
        action: "verified",
        by: {
          uid: user.uid,
          name: profile?.name || "",
          role: "public",
        },
        status: "resolved_verified",
        comment: "User verified the resolution",
      };

      updateData.statusHistory = arrayUnion(statusHistoryEntry);

      await updateDoc(doc(db, "posts", id), updateData);

      try {
        await notifyAdminsVerification(
          issue.departmentTag,
          id,
          issue.title,
          "verified",
          profile?.name || "User",
        );
      } catch (notifErr) {
        console.error("Error sending notification:", notifErr);
      }

      toast({
        title: "Issue Verified",
        description: "Thank you for verifying the resolution!",
        status: "success",
        duration: 3000,
      });

      onVerifyModalClose();

      const docRef = doc(db, "posts", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setIssue({ id: docSnap.id, ...docSnap.data() });
      }
    } catch (err) {
      console.error("Error verifying issue:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to verify issue",
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkUnresolved = async () => {
    if (!verificationImage || !verificationComment.trim()) {
      toast({
        title: "Missing Information",
        description: "Both image and comment are required to reopen the issue.",
        status: "warning",
        duration: 3000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { imageURL, imageStoragePath } = await uploadVerificationImage();

      const updateData = {
        status: "pending",
        verificationStatus: "unresolved",
        verificationImage: imageURL,
        verificationComment: verificationComment.trim(),
        verificationDate: Timestamp.now(),
        verificationBy: {
          uid: user.uid,
          name: profile?.name || "",
        },
      };

      const statusHistoryEntry = {
        timestamp: new Date().toISOString(),
        action: "reopened",
        by: {
          uid: user.uid,
          name: profile?.name || "",
          role: "public",
        },
        status: "pending",
        comment: verificationComment.trim(),
      };

      updateData.statusHistory = arrayUnion(statusHistoryEntry);

      await updateDoc(doc(db, "posts", id), updateData);

      try {
        await notifyAdminsVerification(
          issue.departmentTag,
          id,
          issue.title,
          "reopened",
          profile?.name || "User",
          verificationComment.trim(),
        );
      } catch (notifErr) {
        console.error("Error sending notification:", notifErr);
      }

      toast({
        title: "Issue Reopened",
        description: "The issue has been marked as unresolved and reopened.",
        status: "info",
        duration: 3000,
      });

      onReopenModalClose();
      setVerificationComment("");
      setVerificationImage(null);
      setVerificationProgress(0);

      const docRef = doc(db, "posts", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setIssue({ id: docSnap.id, ...docSnap.data() });
      }
    } catch (err) {
      console.error("Error reopening issue:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to reopen issue",
        status: "error",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerificationImageChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setVerificationImage(file);
      setVerificationProgress(0);
    }
  };

  const handleClearVerificationImage = () => {
    setVerificationImage(null);
    setVerificationProgress(0);
    if (verificationFileInputRef.current) {
      verificationFileInputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <Container maxW="container.lg" py={10}>
        <VStack spacing={4}>
          <Spinner size="xl" />
          <Text>Loading issue details...</Text>
        </VStack>
      </Container>
    );
  }

  if (error || !issue) {
    return (
      <Container maxW="container.lg" py={10}>
        <Alert status="error">
          <AlertIcon />
          {error || "Issue not found"}
        </Alert>
        <Button mt={4} onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Container>
    );
  }

  const isIssueCreator = user && issue?.createdBy?.uid === user.uid;
  const canVerify =
    isIssueCreator && issue?.status === "resolved_pending_verification";
  const mapsUrl = googleMapsLink(issue.lat, issue.lng);

  return (
    <Container maxW="container.lg" py={6}>
      <Button mb={4} onClick={() => navigate(-1)}>
        ← Back
      </Button>

      <VStack spacing={6} align="stretch">
        {}
        <Box bg="white" p={6} borderRadius="lg" borderWidth="1px">
          <HStack justify="space-between" mb={3} flexWrap="wrap">
            <Heading size="lg">{issue.title}</Heading>
            <Badge
              colorScheme={statusColors[issue.status]}
              fontSize="md"
              px={3}
              py={1}
              borderRadius="full"
            >
              {statusLabels[issue.status]}
            </Badge>
          </HStack>
          <HStack spacing={4} fontSize="sm" color="gray.600" flexWrap="wrap">
            <Text>
              <strong>Department:</strong> {issue.departmentTag}
            </Text>
            <Text>
              <strong>Reported by:</strong>{" "}
              {issue.createdBy?.name || "Anonymous"}
            </Text>
            <Text>
              <strong>Date:</strong>{" "}
              {issue.createdAt?.toDate?.()?.toLocaleDateString() || "N/A"}
            </Text>
          </HStack>
        </Box>

        {}
        <Box bg="white" p={6} borderRadius="lg" borderWidth="1px">
          <Heading size="md" mb={4}>
            Location
          </Heading>
          <Box borderRadius="md" overflow="hidden" mb={3}>
            <MapContainer
              center={[issue.lat, issue.lng]}
              zoom={15}
              style={{ height: "300px", width: "100%" }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={[issue.lat, issue.lng]} icon={markerIcon} />
            </MapContainer>
          </Box>
          <Text fontSize="sm" color="gray.600">
            📍 {issue.lat.toFixed(6)}, {issue.lng.toFixed(6)}{" "}
            <Link href={mapsUrl} isExternal color="blue.500">
              Open in Maps
            </Link>
          </Text>
        </Box>

        {}
        <Box bg="white" p={6} borderRadius="lg" borderWidth="1px">
          <Heading size="md" mb={4}>
            Description
          </Heading>
          <Text mb={4}>{issue.description}</Text>

          {issue.imageURL && (
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2}>
                Original Report Image:
              </Text>
              <Image
                src={issue.imageURL}
                alt="Issue"
                borderRadius="md"
                maxH="400px"
                objectFit="contain"
                mb={4}
              />
            </Box>
          )}

          {issue.resolutionImage && (
            <Box>
              <Text
                fontSize="sm"
                fontWeight="semibold"
                mb={2}
                color="green.600"
              >
                Resolution Image (by Admin):
              </Text>
              <Image
                src={issue.resolutionImage}
                alt="Resolution"
                borderRadius="md"
                maxH="400px"
                objectFit="contain"
                mb={2}
              />
              {issue.resolutionNote && (
                <Text fontSize="sm" color="gray.600" fontStyle="italic">
                  Note: {issue.resolutionNote}
                </Text>
              )}
            </Box>
          )}

          {issue.verificationImage && (
            <Box mt={4}>
              <Text fontSize="sm" fontWeight="semibold" mb={2} color="blue.600">
                User Verification Image:
              </Text>
              <Image
                src={issue.verificationImage}
                alt="Verification"
                borderRadius="md"
                maxH="400px"
                objectFit="contain"
                mb={2}
              />
              {issue.verificationComment && (
                <Text fontSize="sm" color="gray.600" fontStyle="italic">
                  Comment: {issue.verificationComment}
                </Text>
              )}
            </Box>
          )}
        </Box>

        {}
        {issue.statusHistory && issue.statusHistory.length > 0 && (
          <Box bg="white" p={6} borderRadius="lg" borderWidth="1px">
            <Heading size="md" mb={4}>
              Status History
            </Heading>
            <VStack align="stretch" spacing={3}>
              {issue.statusHistory.map((entry, idx) => (
                <Box
                  key={idx}
                  pl={4}
                  borderLeftWidth="3px"
                  borderLeftColor="blue.400"
                >
                  <HStack justify="space-between" mb={1}>
                    <Text fontWeight="semibold" fontSize="sm">
                      {entry.action}
                    </Text>
                    <Text fontSize="xs" color="gray.500">
                      {new Date(entry.timestamp).toLocaleString()}
                    </Text>
                  </HStack>
                  <Text fontSize="sm" color="gray.600">
                    by {entry.by?.name || "Unknown"} ({entry.by?.role || "user"}
                    )
                  </Text>
                  {entry.comment && (
                    <Text fontSize="sm" fontStyle="italic" mt={1}>
                      "{entry.comment}"
                    </Text>
                  )}
                  <Badge colorScheme={statusColors[entry.status]} mt={1}>
                    {statusLabels[entry.status] || entry.status}
                  </Badge>
                </Box>
              ))}
            </VStack>
          </Box>
        )}

        {}
        {canVerify && (
          <Box
            bg="yellow.50"
            p={6}
            borderRadius="lg"
            borderWidth="1px"
            borderColor="yellow.300"
          >
            <Heading size="md" mb={3}>
              Verify Resolution
            </Heading>
            <Text mb={4} color="gray.700">
              The admin has marked this issue as resolved. Please verify if the
              issue is actually fixed.
            </Text>
            <HStack spacing={3}>
              <Button colorScheme="green" onClick={onVerifyModalOpen}>
                ✓ Verify & Close
              </Button>
              <Button colorScheme="red" onClick={onReopenModalOpen}>
                ✗ Mark as Unresolved
              </Button>
            </HStack>
          </Box>
        )}
      </VStack>

      {}
      <Modal isOpen={isVerifyModalOpen} onClose={onVerifyModalClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Verify & Close Issue</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text>
              Are you sure the issue has been resolved satisfactorily? This will
              close the issue.
            </Text>
          </ModalBody>
          <ModalFooter>
            <Button variant="outline" mr={3} onClick={onVerifyModalClose}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handleVerifyAndClose}
              isLoading={isSubmitting}
            >
              Yes, Verify & Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {}
      <Modal
        isOpen={isReopenModalOpen}
        onClose={onReopenModalClose}
        closeOnOverlayClick={!isSubmitting}
        closeOnEsc={!isSubmitting}
        size="lg"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Mark as Unresolved</ModalHeader>
          <ModalCloseButton isDisabled={isSubmitting} />
          <ModalBody>
            <VStack spacing={4} align="stretch">
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <Text fontSize="sm">
                  Both <strong>image</strong> and <strong>comment</strong> are
                  required to reopen this issue.
                </Text>
              </Alert>

              <FormControl isRequired>
                <FormLabel>Image (Proof of Unresolved Issue)</FormLabel>
                <HStack spacing={2}>
                  <Input
                    ref={verificationFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleVerificationImageChange}
                    display="none"
                  />
                  <Input
                    readOnly
                    value={
                      verificationImage
                        ? verificationImage.name
                        : "No file chosen"
                    }
                    placeholder="No file chosen"
                    flex={1}
                    isInvalid={!verificationImage}
                  />
                  <Button
                    onClick={() => verificationFileInputRef.current?.click()}
                    isDisabled={!!verificationImage || isSubmitting}
                    colorScheme="blue"
                  >
                    Upload
                  </Button>
                  <Button
                    onClick={handleClearVerificationImage}
                    isDisabled={!verificationImage || isSubmitting}
                    colorScheme="red"
                    variant="outline"
                  >
                    Clear
                  </Button>
                </HStack>
                {verificationProgress > 0 && (
                  <Progress
                    value={verificationProgress}
                    mt={2}
                    colorScheme="blue"
                  />
                )}
              </FormControl>

              <FormControl isRequired>
                <FormLabel>Comment (Explain Why)</FormLabel>
                <Textarea
                  value={verificationComment}
                  onChange={(e) => setVerificationComment(e.target.value)}
                  placeholder="Explain why the issue is still unresolved..."
                  isDisabled={isSubmitting}
                  rows={4}
                  isInvalid={!verificationComment.trim()}
                />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="outline"
              mr={3}
              onClick={onReopenModalClose}
              isDisabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              colorScheme="red"
              onClick={handleMarkUnresolved}
              isLoading={isSubmitting}
              isDisabled={!verificationImage || !verificationComment.trim()}
            >
              Reopen Issue
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}
