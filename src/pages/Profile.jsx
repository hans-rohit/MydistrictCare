import { useAuth } from '../context/AuthContext'
import {
  Container,
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Divider,
  Badge,
} from '@chakra-ui/react'
import { Navigate } from 'react-router-dom'

export default function Profile() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <Container maxW="container.md" py={10}>
        <Text>Loading...</Text>
      </Container>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const isAdmin = profile?.role === 'admin'
  const isDept = profile?.role === 'dept'
  const roleDisplay = isDept ? 'dept-admin' : (profile?.role || 'public')

  return (
    <Container maxW="container.md" py={10}>
      <VStack spacing={6} align="stretch">
        <Heading size="lg">Profile</Heading>
        
        <Box
          p={8}
          borderRadius="2xl"
          bg="white"
          boxShadow="0 10px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.05)"
          borderWidth="1px"
          borderColor="gray.200"
          bgGradient="linear(to-br, white, gray.50)"
          position="relative"
          overflow="hidden"
          _before={{
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899)',
          }}
          css={{
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          <VStack spacing={5} align="stretch" mt={2}>
            <Box p={4} borderRadius="lg" bg="gray.50" borderWidth="1px" borderColor="gray.100">
              <HStack justify="space-between" align="center">
                <Text fontSize="sm" fontWeight="bold" color="gray.700" textTransform="uppercase" letterSpacing="wide">
                  Name
                </Text>
                <Text fontSize="lg" fontWeight="semibold" color="gray.900">
                  {profile?.name || user?.displayName || 'Not set'}
                </Text>
              </HStack>
            </Box>
            
            <Box p={4} borderRadius="lg" bg="gray.50" borderWidth="1px" borderColor="gray.100">
              <HStack justify="space-between" align="center">
                <Text fontSize="sm" fontWeight="bold" color="gray.700" textTransform="uppercase" letterSpacing="wide">
                  Email
                </Text>
                <Text fontSize="lg" fontWeight="semibold" color="gray.900">
                  {profile?.email || user?.email || 'Not set'}
                </Text>
              </HStack>
            </Box>
            
            <Box p={4} borderRadius="lg" bg="gray.50" borderWidth="1px" borderColor="gray.100">
              <HStack justify="space-between" align="center">
                <Text fontSize="sm" fontWeight="bold" color="gray.700" textTransform="uppercase" letterSpacing="wide">
                  Password
                </Text>
                <Text fontSize="lg" fontWeight="semibold" color="gray.900" letterSpacing="wider" fontFamily="mono">
                  ••••••••••
                </Text>
              </HStack>
            </Box>
            
            {isDept && profile?.department && (
              <Box p={4} borderRadius="lg" bg="gray.50" borderWidth="1px" borderColor="gray.100">
                <HStack justify="space-between" align="center">
                  <Text fontSize="sm" fontWeight="bold" color="gray.700" textTransform="uppercase" letterSpacing="wide">
                    Department
                  </Text>
                  <Badge colorScheme="orange" fontSize="md" px={3} py={1.5} borderRadius="md">
                    {profile.department}
                  </Badge>
                </HStack>
              </Box>
            )}
            
            <Box p={4} borderRadius="lg" bg="gray.50" borderWidth="1px" borderColor="gray.100">
              <HStack justify="space-between" align="center">
                <Text fontSize="sm" fontWeight="bold" color="gray.700" textTransform="uppercase" letterSpacing="wide">
                  Role
                </Text>
                <Badge 
                  colorScheme={isAdmin ? "purple" : isDept ? "orange" : "blue"} 
                  fontSize="md" 
                  px={3} 
                  py={1.5}
                  textTransform="capitalize"
                  borderRadius="md"
                >
                  {roleDisplay}
                </Badge>
              </HStack>
            </Box>
          </VStack>
        </Box>
      </VStack>
    </Container>
  )
}

