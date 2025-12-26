import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Box, Text, Badge, VStack, Spinner, HStack } from "@chakra-ui/react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom marker icons for different statuses
const createCustomIcon = (color) => {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.3);
      ">
        <div style="
          width: 100%;
          height: 100%;
          border-radius: 50%;
        "></div>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
};

const statusIcons = {
  pending: createCustomIcon("#f093fb"), // Pink/Purple
  in_progress: createCustomIcon("#fa709a"), // Yellow-Orange
  resolved: createCustomIcon("#30cfd0"), // Green
  rejected: createCustomIcon("#ff0844"), // Red
};

// Component to fit map bounds to all markers
function FitBounds({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [positions, map]);

  return null;
}

export default function IssuesMap({ posts }) {
  const [center, setCenter] = useState([12.9716, 77.5946]); // Default to Bangalore
  const [validPosts, setValidPosts] = useState([]);

  useEffect(() => {
    // Filter posts that have valid location data
    const postsWithLocation = posts.filter(
      (post) =>
        post.location?.latitude &&
        post.location?.longitude &&
        !isNaN(post.location.latitude) &&
        !isNaN(post.location.longitude)
    );

    setValidPosts(postsWithLocation);

    // Set center to first valid post or keep default
    if (postsWithLocation.length > 0) {
      const firstPost = postsWithLocation[0];
      setCenter([firstPost.location.latitude, firstPost.location.longitude]);
    }
  }, [posts]);

  const positions = validPosts.map((post) => [
    post.location.latitude,
    post.location.longitude,
  ]);

  const getStatusColor = (status) => {
    const colors = {
      pending: "purple",
      in_progress: "orange",
      resolved: "green",
      rejected: "red",
    };
    return colors[status] || "gray";
  };

  if (validPosts.length === 0) {
    return (
      <Box
        bg="white"
        borderRadius="xl"
        p={8}
        mb={6}
        textAlign="center"
        borderWidth="1px"
        borderColor="gray.200"
      >
        <Text color="gray.500" fontSize="lg">
          📍 No location data available for issues
        </Text>
        <Text color="gray.400" fontSize="sm" mt={2}>
          Issues with location data will appear on the map
        </Text>
      </Box>
    );
  }

  return (
    <Box
      bg="white"
      borderRadius="xl"
      overflow="hidden"
      mb={6}
      boxShadow="lg"
      borderWidth="1px"
      borderColor="gray.200"
    >
      <Box
        bgGradient="linear(to-r, blue.500, teal.400)"
        p={4}
        color="white"
      >
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={0}>
            <Text fontSize="xl" fontWeight="bold">
              📍 Issues Map
            </Text>
            <Text fontSize="sm" opacity={0.9}>
              {validPosts.length} issue{validPosts.length !== 1 ? "s" : ""} with location data
            </Text>
          </VStack>
          <HStack spacing={3} flexWrap="wrap">
            <HStack spacing={1}>
              <Box w={3} h={3} bg="#f093fb" borderRadius="full" />
              <Text fontSize="xs">Pending</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w={3} h={3} bg="#fa709a" borderRadius="full" />
              <Text fontSize="xs">In Progress</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w={3} h={3} bg="#30cfd0" borderRadius="full" />
              <Text fontSize="xs">Resolved</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w={3} h={3} bg="#ff0844" borderRadius="full" />
              <Text fontSize="xs">Rejected</Text>
            </HStack>
          </HStack>
        </HStack>
      </Box>

      <Box h="500px" position="relative">
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {validPosts.map((post) => (
            <Marker
              key={post.id}
              position={[post.location.latitude, post.location.longitude]}
              icon={statusIcons[post.status] || statusIcons.pending}
            >
              <Popup maxWidth={300}>
                <VStack align="start" spacing={2} p={2}>
                  <Text fontWeight="bold" fontSize="md">
                    {post.title}
                  </Text>
                  <Badge colorScheme={getStatusColor(post.status)} fontSize="xs">
                    {post.status?.replace("_", " ").toUpperCase()}
                  </Badge>
                  <Badge colorScheme="blue" fontSize="xs">
                    {post.departmentTag}
                  </Badge>
                  {post.description && (
                    <Text fontSize="sm" color="gray.600" noOfLines={3}>
                      {post.description}
                    </Text>
                  )}
                  {post.location?.address && (
                    <Text fontSize="xs" color="gray.500">
                      📍 {post.location.address}
                    </Text>
                  )}
                </VStack>
              </Popup>
            </Marker>
          ))}

          <FitBounds positions={positions} />
        </MapContainer>
      </Box>
    </Box>
  );
}
