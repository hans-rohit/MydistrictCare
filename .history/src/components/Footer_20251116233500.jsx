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
      bg={useColorModeValue("white", "gray.800")}
      borderTop="3px solid"
      borderColor={useColorModeValue("gray.200", "gray.700")}
      mt={12}
      py={10}
      position="relative"
      boxShadow="0 -4px 6px -1px rgba(0, 0, 0, 0.05)"
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
                <Box 
                  p={2} 
                  borderRadius="lg" 
                  bgGradient="linear(to-br, blue.100, teal.100)"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <MdHealthAndSafety style={{ fontSize: "2rem", color: "#2B6CB0" }} />
                </Box>
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
                    borderRadius="lg"
                    bgGradient="linear(to-br, blue.100, blue.200)"
                    _hover={{ 
                      bgGradient: "linear(to-br, blue.200, blue.300)", 
                      transform: "translateY(-2px)",
                      shadow: "md"
                    }}
                    transition="all 0.3s"
                  >
                    <FaFacebook style={{ fontSize: "1.2rem", color: "#3b5998" }} />
                  </Box>
                </Link>
                <Link href="#" isExternal>
                  <Box
                    p={2}
                    borderRadius="lg"
                    bgGradient="linear(to-br, blue.100, cyan.100)"
                    _hover={{ 
                      bgGradient: "linear(to-br, blue.200, cyan.200)", 
                      transform: "translateY(-2px)",
                      shadow: "md"
                    }}
                    transition="all 0.3s"
                  >
                    <FaTwitter style={{ fontSize: "1.2rem", color: "#1DA1F2" }} />
                  </Box>
                </Link>
                <Link href="#" isExternal>
                  <Box
                    p={2}
                    borderRadius="lg"
                    bgGradient="linear(to-br, pink.100, purple.100)"
                    _hover={{ 
                      bgGradient: "linear(to-br, pink.200, purple.200)", 
                      transform: "translateY(-2px)",
                      shadow: "md"
                    }}
                    transition="all 0.3s"
                  >
                    <FaInstagram style={{ fontSize: "1.2rem", color: "#E1306C" }} />
                  </Box>
                </Link>
                <Link href="#" isExternal>
                  <Box
                    p={2}
                    borderRadius="lg"
                    bgGradient="linear(to-br, blue.100, blue.200)"
                    _hover={{ 
                      bgGradient: "linear(to-br, blue.200, blue.300)", 
                      transform: "translateY(-2px)",
                      shadow: "md"
                    }}
                    transition="all 0.3s"
                  >
                    <FaLinkedin style={{ fontSize: "1.2rem", color: "#0077b5" }} />
                  </Box>
                </Link>
              </HStack>
            </VStack>

            {/* Quick Links */}
            <VStack align="flex-start" spacing={3} flex="1" minW="150px">
              <Text 
                fontSize="md" 
                fontWeight="bold" 
                bgGradient="linear(to-r, blue.600, purple.600)"
                bgClip="text"
              >
                Quick Links
              </Text>
              <Link href="/" fontSize="sm" color={textColor} _hover={{ color: "blue.600", transform: "translateX(4px)" }} transition="all 0.2s">
                Home
              </Link>
              <Link href="/feed" fontSize="sm" color={textColor} _hover={{ color: "blue.600", transform: "translateX(4px)" }} transition="all 0.2s">
                Feed
              </Link>
              <Link href="/signup" fontSize="sm" color={textColor} _hover={{ color: "blue.600", transform: "translateX(4px)" }} transition="all 0.2s">
                Sign Up
              </Link>
              <Link href="/login" fontSize="sm" color={textColor} _hover={{ color: "blue.600", transform: "translateX(4px)" }} transition="all 0.2s">
                Login
              </Link>
            </VStack>

            {/* Departments */}
            <VStack align="flex-start" spacing={3} flex="1" minW="150px">
              <Text 
                fontSize="md" 
                fontWeight="bold" 
                bgGradient="linear(to-r, teal.600, green.600)"
                bgClip="text"
              >
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
              <Text 
                fontSize="md" 
                fontWeight="bold" 
                bgGradient="linear(to-r, orange.600, pink.600)"
                bgClip="text"
              >
                Contact Us
              </Text>
              <HStack spacing={2}>
                <Box p={1} borderRadius="md" bg="blue.100">
                  <MdEmail style={{ fontSize: "1rem", color: "#2B6CB0" }} />
                </Box>
                <Text fontSize="sm" color={textColor}>
                  support@districtcare.com
                </Text>
              </HStack>
              <HStack spacing={2}>
                <Box p={1} borderRadius="md" bg="green.100">
                  <MdPhone style={{ fontSize: "1rem", color: "#2F855A" }} />
                </Box>
                <Text fontSize="sm" color={textColor}>
                  +1 (555) 123-4567
                </Text>
              </HStack>
              <HStack spacing={2} align="flex-start">
                <Box p={1} borderRadius="md" bg="purple.100" mt="2px">
                  <MdLocationOn style={{ fontSize: "1rem", color: "#6B46C1" }} />
                </Box>
                <Text fontSize="sm" color={textColor}>
                  123 District Avenue<br />
                  City, State 12345
                </Text>
              </HStack>
            </VStack>
          </HStack>

          <Divider borderColor="blue.200" />

          {/* Bottom Section */}
          <HStack
            justify="space-between"
            flexWrap="wrap"
            gap={4}
            fontSize="sm"
            color={textColor}
          >
            <Text fontWeight="500">
              © {new Date().getFullYear()} District Care. All rights reserved.
            </Text>
            <HStack spacing={6} flexWrap="wrap">
              <Link 
                href="#" 
                _hover={{ color: "blue.600", textDecoration: "underline" }}
                transition="all 0.2s"
              >
                Privacy Policy
              </Link>
              <Link 
                href="#" 
                _hover={{ color: "blue.600", textDecoration: "underline" }}
                transition="all 0.2s"
              >
                Terms of Service
              </Link>
              <Link 
                href="#" 
                _hover={{ color: "blue.600", textDecoration: "underline" }}
                transition="all 0.2s"
              >
                Cookie Policy
              </Link>
            </HStack>
          </HStack>
        </VStack>
      </Container>
    </Box>
  );
}
