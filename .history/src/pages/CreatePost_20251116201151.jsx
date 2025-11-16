import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Input,
  Select,
  Textarea,
  VStack,
  Progress,
  Alert,
  AlertIcon,
  HStack,
  Text,
  Link,
  useToast,
  SimpleGrid,
} from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIconUrl from "leaflet/dist/images/marker-icon.png";
import markerShadowUrl from "leaflet/dist/images/marker-shadow.png";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { getCurrentPosition, googleMapsLink } from "../lib/location";

const DEFAULT_CENTER = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;
const SELECTED_ZOOM = 15;
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

const markerIcon = new L.Icon({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click: (event) => {
      const { lat, lng } = event.latlng;
      onSelect(lat, lng);
    },
  });
  return null;
}

function MapViewUpdater({ center, zoom }) {
  const map = useMap();

  useEffect(() => {
    if (!center || center.some((coord) => !Number.isFinite(coord))) return;
    map.flyTo(center, zoom, {
      animate: true,
      duration: 0.6,
    });
  }, [center, zoom, map]);

  return null;
}

const DEPARTMENTS = ["Electricity", "Water", "Sewage", "Road"];

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_FOLDER =
  import.meta.env.VITE_CLOUDINARY_FOLDER || "district-care/images";

export default function CreatePost() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [departmentTag, setDepartmentTag] = useState(DEPARTMENTS[0]);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [locStatus, setLocStatus] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const fileInputRef = useRef(null);
  const mapRef = useRef(null);

  const parsedLat = useMemo(() => {
    const value = Number(lat);
    return Number.isFinite(value) ? value : null;
  }, [lat]);

  const parsedLng = useMemo(() => {
    const value = Number(lng);
    return Number.isFinite(value) ? value : null;
  }, [lng]);

  const hasCoordinates = parsedLat != null && parsedLng != null;

  const mapCenter = useMemo(() => {
    if (hasCoordinates) {
      return [parsedLat, parsedLng];
    }
    return DEFAULT_CENTER;
  }, [hasCoordinates, parsedLat, parsedLng]);

  const setCoordinates = useCallback((newLat, newLng, metadata = {}) => {
    const latNum = Number(newLat);
    const lngNum = Number(newLng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return;

    const latStr = latNum.toFixed(6);
    const lngStr = lngNum.toFixed(6);

    setLat(latStr);
    setLng(lngStr);
    setLocStatus(metadata.status ?? "Location updated");
    if (metadata.label !== undefined) {
      setSelectedPlace(metadata.label);
    } else if (metadata.clearLabel) {
      setSelectedPlace("");
    }
    setSearchResults([]);
  }, []);

  // Check if all required fields are filled
  const isFormValid = useMemo(() => {
    return (
      title.trim() !== "" &&
      description.trim() !== "" &&
      departmentTag !== "" &&
      lat !== "" &&
      lng !== ""
    );
  }, [title, description, departmentTag, lat, lng]);

  useEffect(() => {
    getCurrentPosition()
      .then(({ lat, lng }) => {
        setCoordinates(lat, lng, {
          status: "Location detected from browser",
          label: "Detected from browser",
        });
      })
      .catch(() => {
        setLocStatus(
          "Could not auto-detect location. Enter manually or use the controls."
        );
      });
  }, [setCoordinates]);

  useEffect(() => {
    if (!mapRef.current || !hasCoordinates) return;
    mapRef.current.flyTo([parsedLat, parsedLng], SELECTED_ZOOM, {
      animate: true,
      duration: 0.6,
    });
  }, [hasCoordinates, parsedLat, parsedLng]);

  const mapsUrl = googleMapsLink(lat, lng);

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) {
      setError(null);
      setProgress(0);
      setFile(f);
      e.target.value = "";
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleUseMyLocation = async () => {
    setIsLocating(true);
    try {
      const pos = await getCurrentPosition();
      setCoordinates(pos.lat, pos.lng, {
        status: "Location refreshed from browser",
        label: "Detected from browser",
      });
      if (mapRef.current) {
        mapRef.current.flyTo([pos.lat, pos.lng], SELECTED_ZOOM);
      }
    } catch (err) {
      console.error("Use my location failed", err);
      setLocStatus("Unable to fetch location. Check permissions/GPS.");
    } finally {
      setIsLocating(false);
    }
  };

  const handleMapClick = (mapLat, mapLng) => {
    setCoordinates(mapLat, mapLng, {
      status: "Location picked from map",
      clearLabel: true,
    });
  };

  const handleMarkerDrag = (event) => {
    const marker = event.target;
    const { lat: markerLat, lng: markerLng } = marker.getLatLng();
    setCoordinates(markerLat, markerLng, {
      status: "Marker dragged",
      clearLabel: true,
    });
  };

  const fetchSearchResults = useCallback(
    async (query) => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          q: query,
          format: "json",
          addressdetails: "1",
          limit: "5",
        });
        const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
          headers: {
            "Accept-Language": "en",
            "User-Agent":
              "district-care-app/1.0 (contact@districtcare.example)",
          },
        });
        if (!response.ok) {
          throw new Error(`Search failed (${response.status})`);
        }
        const results = await response.json();
        if (!Array.isArray(results) || results.length === 0) {
          setSearchResults([]);
          toast({
            title: "No results found",
            description:
              "Try searching with a more specific address or landmark.",
            status: "warning",
            duration: 4000,
            isClosable: true,
          });
          return;
        }
        const normalized = results
          .map((item) => {
            const latNum = Number(item.lat);
            const lngNum = Number(item.lon);
            if (!Number.isFinite(latNum) || !Number.isFinite(lngNum))
              return null;
            return {
              id: `${item.place_id}`,
              label: item.display_name || item.name || query,
              lat: latNum,
              lng: lngNum,
            };
          })
          .filter(Boolean);
        setSearchResults(normalized);
      } catch (error) {
        console.error("Search failed", error);
        toast({
          title: "Search failed",
          description:
            error.message || "Unable to search for that location right now.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [toast]
  );

  const handleSearch = useCallback(() => {
    const query = searchTerm.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    fetchSearchResults(query);
  }, [fetchSearchResults, searchTerm]);

  useEffect(() => {
    const query = searchTerm.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    const debounce = setTimeout(() => {
      fetchSearchResults(query);
    }, 350);
    return () => clearTimeout(debounce);
  }, [searchTerm, fetchSearchResults]);

  const handleSelectSuggestion = (suggestion) => {
    setSearchTerm(suggestion.label);
    setCoordinates(suggestion.lat, suggestion.lng, {
      status: "Location set from search",
      label: suggestion.label,
    });
    if (mapRef.current) {
      mapRef.current.flyTo([suggestion.lat, suggestion.lng], SELECTED_ZOOM);
    }
    setSearchResults([]);
  };

  const uploadImage = () => {
    if (!file) return Promise.resolve({ imageURL: "", imageStoragePath: "" });
    return new Promise((resolve, reject) => {
      const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("folder", `${CLOUDINARY_FOLDER}/${user.uid}`);
      formData.append("context", `uid=${user.uid}|email=${user.email}`);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.upload.addEventListener("progress", (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setProgress(pct);
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
                    `Cloudinary upload failed (status ${xhr.status})`
                )
              );
            } catch {
              reject(
                new Error(
                  `Cloudinary upload failed (status ${xhr.status}): ${
                    xhr.responseText || "No response"
                  }`
                )
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { imageURL, imageStoragePath } = await uploadImage();
      const titleLower = (title || "").trim().toLowerCase();
      const titleSubstrings = buildTitleSubstrings(titleLower);
      const payload = {
        title,
        description,
        departmentTag,
        lat: Number(lat),
        lng: Number(lng),
        imageURL, // Cloudinary secure URL
        imageStoragePath, // Cloudinary public_id (for future delete/transform)
        status: "pending",
        createdAt: serverTimestamp(),
        createdBy: {
          uid: user.uid,
          name: profile?.name || "",
          email: profile?.email || user.email,
        },
        actionNote: "",
        titleLower,
        titleSubstrings,
      };
      await addDoc(collection(db, "posts"), payload);
      setTitle("");
      setDescription("");
      setFile(null);
      setProgress(0);
      toast({
        title: "Successfully reported",
        description: "Your report has been submitted successfully.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (err) {
      setError(err.message);
      toast({
        title: "Failed to submit report",
        description:
          err.message || "An error occurred while submitting your report.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Build all unique substrings (length 2..30) of the title for Firestore contains-like search
  const buildTitleSubstrings = (t) => {
    const s = (t || "").trim();
    if (!s) return [];
    const minLen = 2;
    const maxLen = 30;
    const set = new Set();
    for (let i = 0; i < s.length; i++) {
      for (let j = i + minLen; j <= Math.min(s.length, i + maxLen); j++) {
        set.add(s.slice(i, j));
      }
    }
    // Also include the full string if shorter than minLen
    if (s.length < minLen) set.add(s);
    return Array.from(set);
  };

  return (
    <Container maxW="container.xl" pb={12}>
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={8} alignItems="start">
        <Box>
          <Box
            position="relative"
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden"
          >
            <Box
              position="absolute"
              top={4}
              left={4}
              right={4}
              zIndex={1000}
              pointerEvents="none"
            >
              <VStack spacing={3} align="stretch">
                <VStack spacing={2} align="stretch" pointerEvents="auto">
                  <HStack
                    spacing={2}
                    bg="white"
                    borderRadius="md"
                    p={2}
                    shadow="sm"
                  >
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearch();
                        }
                      }}
                      placeholder="Search address or place"
                      size="sm"
                    />
                    <Button
                      size="sm"
                      leftIcon={<SearchIcon />}
                      onClick={handleSearch}
                      isLoading={isSearching}
                    >
                      Search
                    </Button>
                  </HStack>
                  {searchResults.length > 0 && (
                    <Box
                      bg="white"
                      borderRadius="md"
                      shadow="sm"
                      maxH="180px"
                      overflowY="auto"
                    >
                      {searchResults.map((result) => (
                        <Box
                          key={result.id}
                          px={3}
                          py={2}
                          _hover={{ bg: "gray.100", cursor: "pointer" }}
                          onClick={() => handleSelectSuggestion(result)}
                        >
                          <Text fontSize="sm" color="gray.800">
                            {result.label}
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            {result.lat.toFixed(6)}, {result.lng.toFixed(6)}
                          </Text>
                        </Box>
                      ))}
                    </Box>
                  )}
                </VStack>

                <HStack
                  spacing={2}
                  bg="white"
                  borderRadius="md"
                  p={2}
                  shadow="sm"
                  justify="space-between"
                  align="center"
                  pointerEvents="auto"
                >
                  <Text fontSize="sm" color="gray.600">
                    {locStatus || "Click the map or search to set a location."}
                  </Text>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleUseMyLocation}
                    isLoading={isLocating}
                  >
                    Use my location
                  </Button>
                </HStack>
              </VStack>
            </Box>

            <MapContainer
              center={mapCenter}
              zoom={hasCoordinates ? SELECTED_ZOOM : DEFAULT_ZOOM}
              style={{ height: "460px", width: "100%" }}
              scrollWheelZoom
              zoomControl={false}
              whenCreated={(mapInstance) => {
                mapRef.current = mapInstance;
                mapInstance.zoomControl.remove();
              }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {hasCoordinates && (
                <Marker
                  position={[parsedLat, parsedLng]}
                  icon={markerIcon}
                  draggable
                  eventHandlers={{
                    dragend: handleMarkerDrag,
                  }}
                />
              )}
              {hasCoordinates && (
                <MapViewUpdater
                  center={[parsedLat, parsedLng]}
                  zoom={SELECTED_ZOOM}
                />
              )}
              <ZoomControl position="bottomright" />
              <MapClickHandler onSelect={handleMapClick} />
            </MapContainer>
          </Box>

          <VStack align="stretch" spacing={2} mt={4}>
            {selectedPlace && (
              <Text fontSize="sm" color="gray.700">
                Selected place: {selectedPlace}
              </Text>
            )}
            <Text fontSize="sm" color="gray.600">
              {locStatus ||
                "Use the map tools or drag the marker to update the coordinates."}
            </Text>
            {hasCoordinates && (
              <Text fontSize="sm" color="gray.600">
                Coordinates: {parsedLat.toFixed(6)}, {parsedLng.toFixed(6)}{" "}
                <Link href={mapsUrl} isExternal color="blue.500">
                  Open in Maps
                </Link>
              </Text>
            )}
          </VStack>
        </Box>

        <Box as="form" onSubmit={handleSubmit}>
          <VStack spacing={4} align="stretch">
            <FormControl isRequired>
              <FormLabel>Title</FormLabel>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Description</FormLabel>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>Department</FormLabel>
              <Select
                value={departmentTag}
                onChange={(e) => setDepartmentTag(e.target.value)}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </FormControl>
            <FormControl>
              <FormLabel>Image (camera or file)</FormLabel>
              <HStack spacing={2}>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  display="none"
                />
                <Input
                  readOnly
                  value={file ? file.name : "No file chosen"}
                  placeholder="No file chosen"
                  flex={1}
                />
                <Button
                  onClick={handleUploadClick}
                  isDisabled={!!file}
                  colorScheme="blue"
                >
                  Upload
                </Button>
                <Button
                  onClick={handleClearFile}
                  isDisabled={!file}
                  colorScheme="red"
                  variant="outline"
                >
                  Clear
                </Button>
              </HStack>
              {progress > 0 && <Progress value={progress} mt={2} />}
            </FormControl>
            <HStack align="start">
              <FormControl isRequired>
                <FormLabel>Latitude</FormLabel>
                <Input
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                />
              </FormControl>
              <FormControl isRequired>
                <FormLabel>Longitude</FormLabel>
                <Input
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                />
              </FormControl>
            </HStack>
            <Text fontSize="sm" color="gray.600">
              These coordinates update automatically when you interact with the
              map.
            </Text>
            <Button
              type="submit"
              colorScheme="blue"
              isLoading={submitting}
              isDisabled={!isFormValid}
            >
              Submit
            </Button>
          </VStack>
        </Box>
      </SimpleGrid>
    </Container>
  );
}
