import { useState, useEffect, useRef } from "react";
import {
  Box,
  VStack,
  HStack,
  Input,
  IconButton,
  Text,
  Avatar,
  useColorModeValue,
  Flex,
  Spinner,
  CloseButton,
  Tooltip,
} from "@chakra-ui/react";
import { FiSend, FiMessageCircle } from "react-icons/fi";
import { collection, query, getDocs } from "firebase/firestore";
import { db } from "../../models/firebase";
import { generateChatResponse } from "../../models/gemini";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      content:
        "Hello! I'm your District Care assistant. Ask me about civic issues like electricity, water, sewage, or road problems in your area.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [postsData, setPostsData] = useState([]);
  const messagesEndRef = useRef(null);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const userBubbleBg = useColorModeValue("blue.500", "blue.600");
  const botBubbleBg = useColorModeValue("gray.100", "gray.700");

  useEffect(() => {
    if (isOpen && postsData.length === 0) {
      fetchPostsData();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchPostsData = async () => {
    try {
      const postsRef = collection(db, "posts");
      const q = query(postsRef);
      const snapshot = await getDocs(q);
      const posts = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((post) => !post.deleted);
      setPostsData(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await generateChatResponse(input, postsData);
      const botMessage = {
        role: "bot",
        content: response,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Chatbot error:", error);
      const errorMessage = {
        role: "bot",
        content: `Error: ${
          error.message ||
          "Something went wrong. Please check the console for details."
        }`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {!isOpen && (
        <Tooltip label="Chat with District Care AI" placement="left">
          <IconButton
            icon={<FiMessageCircle size={24} />}
            onClick={() => setIsOpen(true)}
            position="fixed"
            bottom="20px"
            right="20px"
            size="lg"
            colorScheme="blue"
            borderRadius="full"
            boxShadow="lg"
            zIndex={1000}
            w="60px"
            h="60px"
            _hover={{
              transform: "scale(1.1)",
              boxShadow: "xl",
            }}
            transition="all 0.2s"
            aria-label="Open chat"
          />
        </Tooltip>
      )}

      {isOpen && (
        <Box
          position="fixed"
          bottom="20px"
          right="20px"
          w={{ base: "90vw", sm: "400px", md: "450px" }}
          h={{ base: "80vh", md: "600px" }}
          bg={bgColor}
          borderRadius="2xl"
          boxShadow="2xl"
          borderWidth="1px"
          borderColor={borderColor}
          zIndex={1000}
          display="flex"
          flexDirection="column"
          overflow="hidden"
        >
          <HStack
            p={4}
            bg="blue.500"
            color="white"
            borderTopRadius="2xl"
            justify="space-between"
          >
            <HStack spacing={3}>
              <Avatar
                size="sm"
                name="District Care Bot"
                bg="blue.700"
                icon={<FiMessageCircle />}
              />
              <VStack align="start" spacing={0}>
                <Text fontWeight="bold" fontSize="md">
                  District Care AI
                </Text>
                <Text fontSize="xs" opacity={0.9}>
                  Online
                </Text>
              </VStack>
            </HStack>
            <CloseButton onClick={() => setIsOpen(false)} />
          </HStack>

          <VStack
            flex={1}
            overflowY="auto"
            p={4}
            spacing={3}
            align="stretch"
            css={{
              "&::-webkit-scrollbar": {
                width: "4px",
              },
              "&::-webkit-scrollbar-track": {
                background: "transparent",
              },
              "&::-webkit-scrollbar-thumb": {
                background: "#CBD5E0",
                borderRadius: "4px",
              },
            }}
          >
            {messages.map((msg, idx) => (
              <Flex
                key={idx}
                justify={msg.role === "user" ? "flex-end" : "flex-start"}
              >
                <HStack
                  align="start"
                  spacing={2}
                  maxW="80%"
                  flexDirection={msg.role === "user" ? "row-reverse" : "row"}
                >
                  {msg.role === "bot" && (
                    <Avatar
                      size="xs"
                      name="Bot"
                      bg="blue.500"
                      icon={<FiMessageCircle />}
                    />
                  )}
                  <Box
                    bg={msg.role === "user" ? userBubbleBg : botBubbleBg}
                    color={msg.role === "user" ? "white" : "inherit"}
                    px={4}
                    py={2}
                    borderRadius="xl"
                    borderTopLeftRadius={msg.role === "bot" ? "4px" : "xl"}
                    borderTopRightRadius={msg.role === "user" ? "4px" : "xl"}
                  >
                    <Text fontSize="sm" whiteSpace="pre-wrap">
                      {msg.content}
                    </Text>
                    <Text
                      fontSize="xs"
                      opacity={0.7}
                      mt={1}
                      textAlign={msg.role === "user" ? "right" : "left"}
                    >
                      {msg.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </Box>
                </HStack>
              </Flex>
            ))}
            {loading && (
              <Flex justify="flex-start">
                <HStack bg={botBubbleBg} px={4} py={2} borderRadius="xl">
                  <Spinner size="sm" />
                  <Text fontSize="sm">Thinking...</Text>
                </HStack>
              </Flex>
            )}
            <div ref={messagesEndRef} />
          </VStack>

          <HStack p={4} borderTopWidth="1px" borderColor={borderColor}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about civic issues..."
              size="md"
              borderRadius="full"
              disabled={loading}
            />
            <IconButton
              icon={<FiSend />}
              onClick={handleSend}
              colorScheme="blue"
              borderRadius="full"
              isLoading={loading}
              disabled={!input.trim()}
              aria-label="Send message"
            />
          </HStack>
        </Box>
      )}
    </>
  );
}
