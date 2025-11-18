import { Box, Container, Text, HStack, VStack, Link, Divider, useColorModeValue } from "@chakra-ui/react";
import { MdHealthAndSafety, MdEmail, MdPhone, MdLocationOn } from "react-icons/md";
import { FaFacebook, FaTwitter, FaInstagram, FaLinkedin } from "react-icons/fa";

export default function Footer() {
  const bgColor = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.700");
  const textColor = useColorModeValue("gray.600", "gray.400");
  const headingColor = useColorModeValue("gray.800", "gray.100");

  return (
    <Box
      as="footer"
      bgGradient="linear(to-br, blue.50, teal.50, purple.50)"
      borderTop="3px solid"
      borderColor="blue.200"
      mt={12}
      py={10}
      position="relative"
      _before={{
        content: '""',
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgGradient: "linear(to-br, rgba(66, 153, 225, 0.05), rgba(56, 178, 172, 0.05))",
        pointerEvents: "none",
      }}
    >
      <Container maxW="container.xl">
        <VStack spacing={8} align="stretch">
          {/* Main Footer Content */}
          <HStack
            spacing={{ base: 4, md: 12 }}
            align="flex-start"
            justify="space-between"
            flexWrap="wrap"
            gap={6}
          >
            {/* Brand Section */}
            <VStack align="flex-start" spacing={3} flex="1" minW="250px">
              <HStack spacing={2}>
                <MdHealthAndSafety style={{ fontSize: "2rem", color: "#2B6CB0" }} />
                <Text
                  fontSize="xl"
                  fontWeight="bold"
                  bgGradient="linear(to-r, blue.600, teal.500)"
                  bgClip="text"
                >
                  District Care
                </Text>
              </HStack>
              <Text fontSize="sm" color={textColor} maxW="300px">
                Empowering communities to report and resolve civic issues efficiently. 
                Making our districts better, one report at a time.
              </Text>
              {/* Social Media Icons */}
              <HStack spacing={3} pt={2}>
                <Link href="#" isExternal>
                  <Box
                    p={2}
                    borderRadius="md"
                    bg="blue.50"
                    _hover={{ bg: "blue.100", transform: "translateY(-2px)" }}
                    transition="all 0.2s"
                  >
                    <FaFacebook style={{ fontSize: "1.2rem", color: "#3b5998" }} />
                  </Box>
                </Link>
                <Link href="#" isExternal>
                  <Box
                    p={2}
                    borderRadius="md"
                    bg="blue.50"
                    _hover={{ bg: "blue.100", transform: "translateY(-2px)" }}
                    transition="all 0.2s"
                  >
                    <FaTwitter style={{ fontSize: "1.2rem", color: "#1DA1F2" }} />
                  </Box>
                </Link>
                <Link href="#" isExternal>
                  <Box
                    p={2}
                    borderRadius="md"
                    bg="pink.50"
                    _hover={{ bg: "pink.100", transform: "translateY(-2px)" }}
                    transition="all 0.2s"
                  >
                    <FaInstagram style={{ fontSize: "1.2rem", color: "#E1306C" }} />
                  </Box>
                </Link>
                <Link href="#" isExternal>
                  <Box
                    p={2}
                    borderRadius="md"
                    bg="blue.50"
                    _hover={{ bg: "blue.100", transform: "translateY(-2px)" }}
                    transition="all 0.2s"
                  >
                    <FaLinkedin style={{ fontSize: "1.2rem", color: "#0077b5" }} />
                  </Box>
                </Link>
              </HStack>
            </VStack>

            {/* Quick Links */}
            <VStack align="flex-start" spacing={3} flex="1" minW="150px">
              <Text fontSize="md" fontWeight="bold" color={headingColor}>
                Quick Links
              </Text>
              <Link href="/" fontSize="sm" color={textColor} _hover={{ color: "blue.500" }}>
                Home
              </Link>
              <Link href="/feed" fontSize="sm" color={textColor} _hover={{ color: "blue.500" }}>
                Feed
              </Link>
              <Link href="/signup" fontSize="sm" color={textColor} _hover={{ color: "blue.500" }}>
                Sign Up
              </Link>
              <Link href="/login" fontSize="sm" color={textColor} _hover={{ color: "blue.500" }}>
                Login
              </Link>
            </VStack>

            {/* Departments */}
            <VStack align="flex-start" spacing={3} flex="1" minW="150px">
              <Text fontSize="md" fontWeight="bold" color={headingColor}>
                Departments
              </Text>
              <Text fontSize="sm" color={textColor}>
                Electricity
              </Text>
              <Text fontSize="sm" color={textColor}>
                Water Supply
              </Text>
              <Text fontSize="sm" color={textColor}>
                Sewage
              </Text>
              <Text fontSize="sm" color={textColor}>
                Road Maintenance
              </Text>
            </VStack>

            {/* Contact Info */}
            <VStack align="flex-start" spacing={3} flex="1" minW="200px">
              <Text fontSize="md" fontWeight="bold" color={headingColor}>
                Contact Us
              </Text>
              <HStack spacing={2}>
                <MdEmail style={{ fontSize: "1rem", color: "#4299E1" }} />
                <Text fontSize="sm" color={textColor}>
                  support@districtcare.com
                </Text>
              </HStack>
              <HStack spacing={2}>
                <MdPhone style={{ fontSize: "1rem", color: "#4299E1" }} />
                <Text fontSize="sm" color={textColor}>
                  +1 (555) 123-4567
                </Text>
              </HStack>
              <HStack spacing={2} align="flex-start">
                <MdLocationOn style={{ fontSize: "1rem", color: "#4299E1", marginTop: "4px" }} />
                <Text fontSize="sm" color={textColor}>
                  123 District Avenue<br />
                  City, State 12345
                </Text>
              </HStack>
            </VStack>
          </HStack>

          <Divider borderColor={borderColor} />

          {/* Bottom Section */}
          <HStack
            justify="space-between"
            flexWrap="wrap"
            gap={4}
            fontSize="sm"
            color={textColor}
          >
            <Text>
              © {new Date().getFullYear()} District Care. All rights reserved.
            </Text>
            <HStack spacing={6} flexWrap="wrap">
              <Link href="#" _hover={{ color: "blue.500" }}>
                Privacy Policy
              </Link>
              <Link href="#" _hover={{ color: "blue.500" }}>
                Terms of Service
              </Link>
              <Link href="#" _hover={{ color: "blue.500" }}>
                Cookie Policy
              </Link>
            </HStack>
          </HStack>
        </VStack>
      </Container>
    </Box>
  );
}
