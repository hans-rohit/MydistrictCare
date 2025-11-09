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
        fontWeight="bold"
        p={2}
        borderRadius="md"
        _hover={{ bg: "gray.100" }}
        _active={{ bg: "gray.200" }}
        bg={isActive ? "blue.50" : "transparent"}
        color={isActive ? "blue.600" : "gray.600"}
        onClick={handleClick}
      >
        {children}
      </Link>
    );
  };

  const isAdmin = profile?.role === "admin";
  const isDept = profile?.role === "dept";
  const dept = profile?.department;

  return (
    <Box
      position="sticky"
      top={0}
      zIndex={1000}
      bg="white"
      borderBottom="1px solid"
      borderColor="gray.200"
      mb={4}
      shadow="sm"
      css={{
        '&[data-menu-open="true"]': {
          position: "fixed",
          width: "100%",
        },
      }}
      data-menu-open={isOpen}
    >
      <Flex p={3} align="center" wrap="wrap" gap={2}>
        <Box flex={{ base: "1", md: "1" }}>
          <Heading size="md">
            <Link
              as={RouterLink}
              to="/"
              display="flex"
              alignItems="center"
              gap={0.5}
              bgGradient="linear(to-r, blue.600, teal.500)"
              bgClip="text"
            >
              <MdHealthAndSafety style={{ color: "#2B6CB0" }} />
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
                colorScheme={
                  profile?.role === "admin"
                    ? "purple"
                    : profile?.role === "dept"
                    ? "orange"
                    : "purple"
                }
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
        >
          <NavLink to="/feed">Feed</NavLink>
          {user && <NavLink to="/create">Create</NavLink>}
          {user && <NavLink to="/profile">Profile</NavLink>}

          {isAdmin && (
            <>
              <NavLink to="/dashboard/Electricity">Electricity</NavLink>
              <NavLink to="/dashboard/Water">Water</NavLink>
              <NavLink to="/dashboard/Sewage">Sewage</NavLink>
              <NavLink to="/dashboard/Road">Road</NavLink>
              <NavLink to="/admin">Admin</NavLink>
            </>
          )}

          {isDept && dept && (
            <NavLink to={`/dashboard/${dept}`}>{dept}</NavLink>
          )}
        </HStack>

        {/* Desktop Auth Buttons */}
        <Box
          flex={{ base: "0", md: "1" }}
          display={{ base: "none", md: "flex" }}
          justifyContent="flex-end"
        >
          {user ? (
            <HStack>
              <Badge
                colorScheme={
                  profile?.role === "admin"
                    ? "purple"
                    : profile?.role === "dept"
                    ? "orange"
                    : "purple"
                }
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
                _hover={{
                  bgGradient: "linear(to-r, blue.600, teal.500)",
                }}
              >
                Logout
              </Button>
            </HStack>
          ) : (
            <HStack>
              <Button size="sm" as={RouterLink} to="/login" variant="ghost">
                Login
              </Button>
              <Button size="sm" as={RouterLink} to="/signup" colorScheme="blue">
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
          <VStack spacing={6} align="stretch" p={6} h="100%" w="100%">
            {/* Main Navigation */}
            <VStack spacing={4} align="stretch">
              <NavLink to="/feed">Feed</NavLink>
              {user && <NavLink to="/create">Create</NavLink>}
              {user && <NavLink to="/profile">Profile</NavLink>}
            </VStack>

            {/* Department Links with Separator */}
            {isAdmin && (
              <VStack spacing={4} align="stretch">
                <Box pt={4} borderTop="1px" borderColor="gray.200">
                  <VStack spacing={4} align="stretch">
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
                <Box pt={4} borderTop="1px" borderColor="gray.200">
                  <NavLink to={`/dashboard/${dept}`}>{dept}</NavLink>
                </Box>
              </VStack>
            )}

            {/* Auth Buttons */}
            {user ? (
              <Box mt={3}>
                <Button
                  onClick={handleLogout}
                  bgGradient="linear(to-r, blue.500, teal.400)"
                  color="white"
                  _hover={{ bgGradient: "linear(to-r, blue.600, teal.500)" }}
                  size="md"
                >
                  Logout
                </Button>
              </Box>
            ) : (
              <VStack spacing={4} align="stretch" pt={4}>
                <Button
                  as={RouterLink}
                  to="/login"
                  variant="ghost"
                  size="md"
                  onClick={onClose}
                >
                  Login
                </Button>
                <Button
                  as={RouterLink}
                  to="/signup"
                  colorScheme="blue"
                  size="md"
                  onClick={onClose}
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
