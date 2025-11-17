import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  FormControl,
  FormLabel,
  Input,
  VStack,
  Text,
  Alert,
  AlertIcon,
  Link,
  Heading,
  InputGroup,
  InputLeftElement,
  Icon,
  useColorModeValue,
} from "@chakra-ui/react";
import { EmailIcon, LockIcon } from "@chakra-ui/icons";
import { MdHealthAndSafety } from "react-icons/md";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="md" py={{ base: 8, md: 16 }}>
      <VStack spacing={8} align="stretch">
        {/* Logo and Title */}
        <VStack spacing={3}>
          <Icon as={MdHealthAndSafety} w={12} h={12} color="blue.500" />
          <Heading
            size={{ base: "lg", md: "xl" }}
            bgGradient="linear(to-r, blue.600, teal.500)"
            bgClip="text"
            textAlign="center"
          >
            Welcome Back
          </Heading>
          <Text
            color="gray.600"
            textAlign="center"
            fontSize={{ base: "sm", md: "md" }}
          >
            Sign in to access District Care
          </Text>
        </VStack>

        {/* Login Form */}
        <Box
          p={{ base: 6, md: 8 }}
          bg={bgColor}
          borderRadius="2xl"
          borderWidth="1px"
          borderColor={borderColor}
          boxShadow="xl"
        >
          {error && (
            <Alert status="error" mb={6} borderRadius="md">
              <AlertIcon />
              <Text fontSize="sm">{error}</Text>
            </Alert>
          )}

          <Box as="form" onSubmit={handleSubmit}>
            <VStack spacing={5}>
              <FormControl isRequired>
                <FormLabel fontWeight="semibold" fontSize="sm">
                  Email Address
                </FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <EmailIcon color="gray.400" />
                  </InputLeftElement>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    size="lg"
                    borderRadius="lg"
                  />
                </InputGroup>
              </FormControl>

              <FormControl isRequired>
                <FormLabel fontWeight="semibold" fontSize="sm">
                  Password
                </FormLabel>
                <InputGroup>
                  <InputLeftElement pointerEvents="none">
                    <LockIcon color="gray.400" />
                  </InputLeftElement>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    size="lg"
                    borderRadius="lg"
                  />
                </InputGroup>
              </FormControl>

              <Button
                type="submit"
                colorScheme="blue"
                isLoading={loading}
                w="full"
                size="lg"
                borderRadius="lg"
                bgGradient="linear(to-r, blue.500, teal.400)"
                _hover={{
                  bgGradient: "linear(to-r, blue.600, teal.500)",
                }}
                mt={2}
              >
                Sign In
              </Button>

              <Text fontSize="sm" color="gray.600" textAlign="center">
                Don't have an account?{" "}
                <Link
                  as={RouterLink}
                  to="/signup"
                  color="blue.500"
                  fontWeight="semibold"
                  _hover={{ color: "blue.600", textDecoration: "underline" }}
                >
                  Sign up
                </Link>
              </Text>
            </VStack>
          </Box>
        </Box>
      </VStack>
    </Container>
  );
}
