import { Link as RouterLink, useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Flex,
  Heading,
  Button,
  Link,
  HStack,
  Badge,
  IconButton,
  Collapse,
  VStack,
  useDisclosure,
  useBreakpointValue,
  useColorModeValue,
} from "@chakra-ui/react";
import { HamburgerIcon, CloseIcon } from "@chakra-ui/icons";
import { MdHealthAndSafety } from "react-icons/md";
import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function Header() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, onToggle, onClose } = useDisclosure();
  const isMobile = useBreakpointValue({ base: true, md: false });

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login");
    // close mobile menu if open
    try {
      onClose();
    } catch (e) {
      /* ignore if onClose not available */
    }
  };

  const NavLink = ({ to, children, onClick }) => {
    const isActive = location.pathname === to;
    const handleClick = (e) => {
      if (typeof onClick === "function") onClick(e);
      // close mobile menu when a nav link is clicked on mobile
      if (isMobile) {
        try {
          onClose();
        } catch (err) {
          // ignore
        }
      }
    };

    return (
      <Link
        as={RouterLink}
        to={to}
        fontWeight="600"
        px={3}
        py={2}
        borderRadius="lg"
        transition="all 0.3s"
        _hover={{ 
          bg: isActive ? "blue.100" : "gray.100",
          transform: "translateY(-2px)",
          shadow: "sm"
        }}
        bg={isActive ? "blue.50" : "transparent"}
        color={isActive ? "blue.600" : "gray.700"}
        onClick={handleClick}
      >
        {children}
      </Link>
    );
  };

  const isAdmin = profile?.role === "admin";
  const isDept = profile?.role === "dept";
  const dept = profile?.department;
  
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  return (
    <Box
      position="sticky"
      top={0}
      zIndex={1000}
      bg={bgColor}
      borderBottom="2px solid"
      borderColor={borderColor}
      mb={4}
      shadow="md"
      backdropFilter="blur(10px)"
      css={{
        '&[data-menu-open="true"]': {
          position: "fixed",
          width: "100%",
        },
      }}
      data-menu-open={isOpen}
    >
      <Flex px={4} py={3} align="center" wrap="wrap" gap={2}>
        <Box flex={{ base: "1", md: "1" }}>
          <Heading size="lg" fontWeight="bold">
            <Link
              as={RouterLink}
              to="/"
              display="flex"
              alignItems="center"
              gap={2}
              bgGradient="linear(to-r, blue.600, teal.500)"
              bgClip="text"
              _hover={{ transform: "scale(1.02)", transition: "all 0.2s" }}
            >
              <MdHealthAndSafety style={{ color: "#2B6CB0", fontSize: "1.5rem" }} />
              District Care
            </Link>
          </Heading>
        </Box>

        {/* Mobile Status Badge and Hamburger Menu */}
        {isMobile && (
          <HStack spacing={2}>
            {user && (
              <Badge
                display={{ base: "flex", md: "none" }}
                px={2}
                py={1}
                borderRadius="md"
                fontSize="xs"
                fontWeight="600"
                bgGradient={
                  profile?.role === "admin"
                    ? "linear(to-r, purple.500, pink.500)"
                    : profile?.role === "dept"
                    ? "linear(to-r, orange.500, red.500)"
                    : "linear(to-r, green.500, teal.500)"
                }
                color="white"
                textTransform="capitalize"
              >
                {profile?.role ? `${profile.role}` : "Public"}
              </Badge>
            )}
            <IconButton
              display={{ base: "flex", md: "none" }}
              onClick={onToggle}
              icon={
                isOpen ? (
                  <CloseIcon w={3} h={3} />
                ) : (
                  <HamburgerIcon w={5} h={5} />
                )
              }
              variant="ghost"
              aria-label="Toggle Navigation"
              zIndex={2000}
            />
          </HStack>
        )}

        {/* Desktop Navigation */}
        <HStack
          spacing={4}
          flex="2"
          justifyContent="center"
          display={{ base: "none", md: "flex" }}
          fontFamily="'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        >
          {/* Home - for public and non-logged users */}
          {(!user || profile?.role === "public") && <NavLink to="/">Home</NavLink>}

          {/* Feed - only for public and admin */}
          {(!user ||
            profile?.role === "public" ||
            profile?.role === "admin") && <NavLink to="/feed">Feed</NavLink>}

          {/* Create - only for public users */}
          {user && profile?.role === "public" && (
            <NavLink to="/create">Create</NavLink>
          )}

          {user && <NavLink to="/profile">Profile</NavLink>}

          {isAdmin && (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/dashboard/Electricity">Electricity</NavLink>
              <NavLink to="/dashboard/Water">Water</NavLink>
              <NavLink to="/dashboard/Sewage">Sewage</NavLink>
              <NavLink to="/dashboard/Road">Road</NavLink>
              <NavLink to="/admin">Admin</NavLink>
            </>
          )}

          {isDept && dept && (
            <>
              <NavLink to={`/analytics/${dept}`}>Dashboard</NavLink>
              <NavLink to={`/dashboard/${dept}`}>{dept}</NavLink>
            </>
          )}
        </HStack>

        {/* Desktop Auth Buttons */}
        <Box
          flex={{ base: "0", md: "1" }}
          display={{ base: "none", md: "flex" }}
          justifyContent="flex-end"
        >
          {user ? (
            <HStack spacing={3}>
              <Badge
                px={3}
                py={1}
                borderRadius="lg"
                fontSize="sm"
                fontWeight="600"
                bgGradient={
                  profile?.role === "admin"
                    ? "linear(to-r, purple.500, pink.500)"
                    : profile?.role === "dept"
                    ? "linear(to-r, orange.500, red.500)"
                    : "linear(to-r, green.500, teal.500)"
                }
                color="white"
                textTransform="capitalize"
                shadow="sm"
              >
                {profile?.role
                  ? `${profile.role}${
                      profile?.department ? ` • ${profile.department}` : ""
                    }`
                  : "Public"}
              </Badge>
              <Button
                size="sm"
                onClick={handleLogout}
                bgGradient="linear(to-r, blue.500, teal.400)"
                color="white"
                borderRadius="lg"
                fontWeight="600"
                shadow="sm"
                _hover={{
                  bgGradient: "linear(to-r, blue.600, teal.500)",
                  shadow: "md",
                  transform: "translateY(-1px)"
                }}
                transition="all 0.2s"
              >
                Logout
              </Button>
            </HStack>
          ) : (
            <HStack spacing={3}>
              <Button 
                size="sm" 
                as={RouterLink} 
                to="/login" 
                variant="ghost"
                fontWeight="600"
                borderRadius="lg"
                _hover={{ bg: "gray.100", transform: "translateY(-1px)" }}
                transition="all 0.2s"
              >
                Login
              </Button>
              <Button 
                size="sm" 
                as={RouterLink} 
                to="/signup" 
                bgGradient="linear(to-r, blue.500, teal.400)"
                color="white"
                fontWeight="600"
                borderRadius="lg"
                shadow="sm"
                _hover={{ 
                  bgGradient: "linear(to-r, blue.600, teal.500)",
                  shadow: "md",
                  transform: "translateY(-1px)" 
                }}
                transition="all 0.2s"
              >
                Sign Up
              </Button>
            </HStack>
          )}
        </Box>
      </Flex>

      {/* Mobile Navigation Menu */}
      <Box
        position="fixed"
        top="0"
        left="0"
        right="0"
        bottom="0"
        bg="blackAlpha.600"
        display={{ base: isOpen ? "block" : "none", md: "none" }}
        zIndex={1500}
        onClick={onToggle}
      />
      <Collapse in={isOpen} animateOpacity>
        <Box
          position="fixed"
          top="0"
          right="0"
          bottom="0" /* full vertical height */
          width="50%"
          bg="white"
          display={{ base: "block", md: "none" }}
          zIndex={1999}
          shadow="xl"
          overflowY="auto"
        >
          <VStack 
            spacing={6} 
            align="stretch" 
            p={6} 
            h="100%" 
            w="100%"
            fontFamily="'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
          >
            {/* Main Navigation */}
            <VStack spacing={4} align="stretch">
              {/* Home - for public and non-logged users */}
              {(!user || profile?.role === "public") && (
                <NavLink to="/">Home</NavLink>
              )}

              {/* Feed - only for public and admin */}
              {(!user ||
                profile?.role === "public" ||
                profile?.role === "admin") && (
                <NavLink to="/feed">Feed</NavLink>
              )}

              {/* Create - only for public users */}
              {user && profile?.role === "public" && (
                <NavLink to="/create">Create</NavLink>
              )}

              {user && <NavLink to="/profile">Profile</NavLink>}
            </VStack>

            {/* Department Links with Separator */}
            {isAdmin && (
              <VStack spacing={4} align="stretch">
                <Box pt={4} borderTop="2px" borderColor="gray.200">
                  <VStack spacing={3} align="stretch">
                    <NavLink to="/dashboard">Dashboard</NavLink>
                    <NavLink to="/dashboard/Electricity">Electricity</NavLink>
                    <NavLink to="/dashboard/Water">Water</NavLink>
                    <NavLink to="/dashboard/Sewage">Sewage</NavLink>
                    <NavLink to="/dashboard/Road">Road</NavLink>
                    <NavLink to="/admin">Admin</NavLink>
                  </VStack>
                </Box>
              </VStack>
            )}

            {isDept && dept && (
              <VStack spacing={4} align="stretch">
                <Box pt={4} borderTop="2px" borderColor="gray.200">
                  <VStack spacing={3} align="stretch">
                    <NavLink to={`/analytics/${dept}`}>Dashboard</NavLink>
                    <NavLink to={`/dashboard/${dept}`}>{dept}</NavLink>
                  </VStack>
                </Box>
              </VStack>
            )}

            {/* Auth Buttons */}
            {user ? (
              <Box mt={4} pt={4} borderTop="2px" borderColor="gray.200">
                <Button
                  w="full"
                  onClick={handleLogout}
                  bgGradient="linear(to-r, blue.500, teal.400)"
                  color="white"
                  borderRadius="lg"
                  fontWeight="600"
                  shadow="sm"
                  _hover={{ 
                    bgGradient: "linear(to-r, blue.600, teal.500)",
                    shadow: "md"
                  }}
                  size="md"
                >
                  Logout
                </Button>
              </Box>
            ) : (
              <VStack spacing={3} align="stretch" pt={4} borderTop="2px" borderColor="gray.200">
                <Button
                  as={RouterLink}
                  to="/login"
                  variant="ghost"
                  size="md"
                  borderRadius="lg"
                  fontWeight="600"
                  onClick={onClose}
                  _hover={{ bg: "gray.100" }}
                >
                  Login
                </Button>
                <Button
                  as={RouterLink}
                  to="/signup"
                  bgGradient="linear(to-r, blue.500, teal.400)"
                  color="white"
                  size="md"
                  borderRadius="lg"
                  fontWeight="600"
                  shadow="sm"
                  onClick={onClose}
                  _hover={{ 
                    bgGradient: "linear(to-r, blue.600, teal.500)",
                    shadow: "md"
                  }}
                >
                  Sign Up
                </Button>
              </VStack>
            )}
          </VStack>
        </Box>
      </Collapse>
    </Box>
  );
}
