import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  IconButton,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  VStack,
  Text,
  Badge,
  HStack,
  Button,
  Divider,
} from "@chakra-ui/react";
import { BellIcon } from "@chakra-ui/icons";
import { useAuth } from "../../controllers/AuthContext";
import {
  subscribeToNotifications,
  markNotificationAsRead,
} from "../../models/notifications";

export default function NotificationBell() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || !profile?.role) return;

    const unsubscribe = subscribeToNotifications(
      user.uid,
      profile.role,
      (newNotifications) => {
        setNotifications(newNotifications.slice(0, 10));
        setUnreadCount(newNotifications.filter((n) => !n.read).length);
      },
    );

    return unsubscribe;
  }, [user, profile?.role]);

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markNotificationAsRead(notification.id);
    }

    if (notification.issueId) {
      navigate(`/issue/${notification.issueId}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => markNotificationAsRead(n.id)));
  };

  if (!user) return null;

  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <Box position="relative" display="inline-block">
          <IconButton
            icon={<BellIcon />}
            variant="ghost"
            aria-label="Notifications"
            fontSize="20px"
          />
          {unreadCount > 0 && (
            <Badge
              position="absolute"
              top="-1"
              right="-1"
              colorScheme="red"
              borderRadius="full"
              fontSize="xs"
              minW="18px"
              h="18px"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Box>
      </PopoverTrigger>
      <PopoverContent maxW="350px">
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader fontWeight="bold">
          <HStack justify="space-between">
            <Text>Notifications</Text>
            {unreadCount > 0 && (
              <Button size="xs" variant="link" onClick={handleMarkAllAsRead}>
                Mark all as read
              </Button>
            )}
          </HStack>
        </PopoverHeader>
        <PopoverBody maxH="400px" overflowY="auto" p={0}>
          {notifications.length === 0 ? (
            <Box p={4} textAlign="center" color="gray.500">
              <Text fontSize="sm">No notifications yet</Text>
            </Box>
          ) : (
            <VStack spacing={0} align="stretch">
              {notifications.map((notification, idx) => (
                <Box key={notification.id}>
                  <Box
                    p={3}
                    cursor="pointer"
                    bg={notification.read ? "white" : "blue.50"}
                    _hover={{ bg: notification.read ? "gray.50" : "blue.100" }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <HStack align="start" spacing={2}>
                      <Box
                        w="8px"
                        h="8px"
                        borderRadius="full"
                        bg={notification.read ? "transparent" : "blue.500"}
                        mt={1}
                        flexShrink={0}
                      />
                      <VStack align="start" spacing={1} flex={1}>
                        <Text fontSize="sm" fontWeight="semibold">
                          {notification.title}
                        </Text>
                        <Text fontSize="xs" color="gray.600" noOfLines={2}>
                          {notification.message}
                        </Text>
                        <Text fontSize="xs" color="gray.400">
                          {notification.createdAt?.toDate?.()
                            ? new Date(
                                notification.createdAt.toDate(),
                              ).toLocaleString()
                            : "Just now"}
                        </Text>
                      </VStack>
                    </HStack>
                  </Box>
                  {idx < notifications.length - 1 && <Divider />}
                </Box>
              ))}
            </VStack>
          )}
        </PopoverBody>
      </PopoverContent>
    </Popover>
  );
}
