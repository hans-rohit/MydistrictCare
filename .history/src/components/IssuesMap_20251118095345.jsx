import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { Box, Text, Badge, VStack, Spinner, HStack } from "@chakra-ui/react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom marker icons for different statuses with pin shape and hole
const createCustomIcon = (color) => {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="0" dy="2" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <!-- Pin body -->
        <path d="M20 0 C9 0, 0 9, 0 20 C0 35, 20 50, 20 50 C20 50, 40 35, 40 20 C40 9, 31 0, 20 0 Z" 
              fill="${color}" 
              stroke="white" 
              stroke-width="2.5" 
              filter="url(#shadow)"/>
        <!-- Inner white circle hole -->
        <circle cx="20" cy="18" r="7" fill="white" stroke="${color}" stroke-width="1.5"/>
      </svg>
    `,
    iconSize: [40, 50],
    iconAnchor: [20, 50],
    popupAnchor: [0, -50],
  });
};

const statusIcons = {
  pending: createCustomIcon("#d946ef"), // Darker purple/magenta
  in_progress: createCustomIcon("#f59e0b"), // Darker orange
  resolved: createCustomIcon("#10b981"), // Darker green
  rejected: createCustomIcon("#dc2626"), // Darker red
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
      (post) => post.lat && post.lng && !isNaN(post.lat) && !isNaN(post.lng)
    );

    console.log("Total posts received:", posts.length);
    console.log("Posts with valid location:", postsWithLocation.length);
    console.log("Posts by status:", {
      pending: postsWithLocation.filter(p => p.status === 'pending').length,
      in_progress: postsWithLocation.filter(p => p.status === 'in_progress').length,
      resolved: postsWithLocation.filter(p => p.status === 'resolved').length,
      rejected: postsWithLocation.filter(p => p.status === 'rejected').length,
    });

    // Add small random offset to overlapping markers
    const postsWithOffset = postsWithLocation.map((post, index) => {
      // Find if there are other posts with same coordinates
      const duplicates = postsWithLocation.filter(
        (p, i) => i < index && 
        Math.abs(p.lat - post.lat) < 0.0001 && 
        Math.abs(p.lng - post.lng) < 0.0001
      );
      
      if (duplicates.length > 0) {
        // Add small offset in a circular pattern
        const angle = (duplicates.length * 60) * (Math.PI / 180);
        const offsetDistance = 0.0003; // ~30 meters
        return {
          ...post,
          lat: post.lat + offsetDistance * Math.cos(angle),
          lng: post.lng + offsetDistance * Math.sin(angle),
        };
      }
      return post;
    });

    setValidPosts(postsWithOffset);

    // Set center to first valid post or keep default
    if (postsWithOffset.length > 0) {
      const firstPost = postsWithOffset[0];
      setCenter([firstPost.lat, firstPost.lng]);
    }
  }, [posts]);

  const positions = validPosts.map((post) => [post.lat, post.lng]);

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
      mb={8}
      mt={6}
      boxShadow="lg"
      borderWidth="1px"
      borderColor="gray.200"
    >
      <Box bgGradient="linear(to-r, blue.500, teal.400)" p={4} color="white">
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={0}>
            <Text fontSize="xl" fontWeight="bold">
              📍 Issues Map
            </Text>
            <Text fontSize="sm" opacity={0.9}>
              {validPosts.length} issue{validPosts.length !== 1 ? "s" : ""} with
              location data
            </Text>
          </VStack>
          <HStack spacing={3} flexWrap="wrap">
            <HStack spacing={1}>
              <Box w={3} h={3} bg="#d946ef" borderRadius="full" />
              <Text fontSize="xs">Pending</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w={3} h={3} bg="#f59e0b" borderRadius="full" />
              <Text fontSize="xs">In Progress</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w={3} h={3} bg="#10b981" borderRadius="full" />
              <Text fontSize="xs">Resolved</Text>
            </HStack>
            <HStack spacing={1}>
              <Box w={3} h={3} bg="#dc2626" borderRadius="full" />
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
              position={[post.lat, post.lng]}
              icon={statusIcons[post.status] || statusIcons.pending}
            >
              <Popup maxWidth={300}>
                <VStack align="start" spacing={2} p={2}>
                  <Text fontWeight="bold" fontSize="md">
                    {post.title}
                  </Text>
                  <Badge
                    colorScheme={getStatusColor(post.status)}
                    fontSize="xs"
                  >
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
                  <Text fontSize="xs" color="gray.500">
                    📍 {post.lat?.toFixed(6)}, {post.lng?.toFixed(6)}
                  </Text>
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
