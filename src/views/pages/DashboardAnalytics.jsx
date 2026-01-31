import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Container,
  Heading,
  Box,
  SimpleGrid,
  Text,
  VStack,
  HStack,
  Spinner,
  useColorModeValue,
  Select,
  Badge,
} from "@chakra-ui/react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  LineChart,
  Line,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { collection, query, getDocs, where } from "firebase/firestore";
import { db } from "../../models/firebase";
import { useAuth } from "../../controllers/AuthContext";

export default function DashboardAnalytics() {
  const { dept: routeDept } = useParams();
  const { profile } = useAuth();
  const dept = routeDept || profile?.department;

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    byStatus: [],
    byMonth: [],
    responseTime: 0,
    avgResolutionDays: 0,
  });
  const [timeRange, setTimeRange] = useState("all");

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  const statusColors = {
    pending: "#f093fb",
    in_progress: "#fa709a",
    resolved_pending_verification: "#f59e0b",
    resolved_verified: "#10b981",
    rejected: "#ff0844",
  };

  const departmentColors = {
    Electricity: "#667eea",
    Water: "#30cfd0",
    Sewage: "#fa709a",
    Road: "#f093fb",
  };

  useEffect(() => {
    if (dept) {
      fetchAnalytics();
    }
  }, [timeRange, dept]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const postsRef = collection(db, "posts");
      const q = query(postsRef, where("departmentTag", "==", dept));

      const snapshot = await getDocs(q);
      let posts = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((post) => !post.deleted);

      if (timeRange !== "all") {
        const now = new Date();
        const daysAgo = timeRange === "7days" ? 7 : 30;
        const startDate = new Date();
        startDate.setDate(now.getDate() - daysAgo);
        startDate.setHours(0, 0, 0, 0);

        posts = posts.filter((post) => {
          if (post.createdAt?.toDate) {
            const postDate = post.createdAt.toDate();
            return postDate >= startDate;
          }
          return false;
        });
      }

      const total = posts.length;

      const statusCounts = {
        pending: 0,
        in_progress: 0,
        resolved_pending_verification: 0,
        resolved_verified: 0,
        rejected: 0,
      };

      posts.forEach((post) => {
        const status = post.status || "pending";
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status]++;
        }
      });

      const byStatus = Object.entries(statusCounts).map(([name, value]) => ({
        name: name.replace(/_/g, " ").toUpperCase(),
        value,
        count: value,
        color: statusColors[name],
      }));

      const monthCounts = {};
      const dayCounts = {};
      const weekCounts = {};
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];

      let byMonth = [];

      if (timeRange === "7days") {
        posts.forEach((post) => {
          if (post.createdAt?.toDate) {
            const date = post.createdAt.toDate();
            const dayKey = `${monthNames[date.getMonth()]} ${date.getDate()}`;

            if (!dayCounts[dayKey]) {
              dayCounts[dayKey] = {
                period: dayKey,
                pending: 0,
                in_progress: 0,
                resolved_pending_verification: 0,
                resolved_verified: 0,
                rejected: 0,
              };
            }
            const status = post.status || "pending";
            if (dayCounts[dayKey].hasOwnProperty(status)) {
              dayCounts[dayKey][status]++;
            }
          }
        });
        byMonth = Object.values(dayCounts).slice(-7);
      } else if (timeRange === "30days") {
        posts.forEach((post) => {
          if (post.createdAt?.toDate) {
            const date = post.createdAt.toDate();
            const weekNum = Math.ceil(date.getDate() / 7);
            const weekKey = `Week ${weekNum} - ${monthNames[date.getMonth()]}`;

            if (!weekCounts[weekKey]) {
              weekCounts[weekKey] = {
                period: weekKey,
                pending: 0,
                in_progress: 0,
                resolved_pending_verification: 0,
                resolved_verified: 0,
                rejected: 0,
              };
            }
            const status = post.status || "pending";
            if (weekCounts[weekKey].hasOwnProperty(status)) {
              weekCounts[weekKey][status]++;
            }
          }
        });
        byMonth = Object.values(weekCounts).slice(-5);
      } else {
        posts.forEach((post) => {
          if (post.createdAt?.toDate) {
            const date = post.createdAt.toDate();
            const monthKey = `${
              monthNames[date.getMonth()]
            } ${date.getFullYear()}`;

            if (!monthCounts[monthKey]) {
              monthCounts[monthKey] = {
                period: monthKey,
                pending: 0,
                in_progress: 0,
                resolved_pending_verification: 0,
                resolved_verified: 0,
                rejected: 0,
              };
            }
            const status = post.status || "pending";
            if (monthCounts[monthKey].hasOwnProperty(status)) {
              monthCounts[monthKey][status]++;
            }
          }
        });
        byMonth = Object.values(monthCounts).slice(-6);
      }

      const resolvedPosts = posts.filter(
        (p) => p.status === "resolved_verified",
      );
      let avgResolutionDays = 0;
      let validCount = 0;

      if (resolvedPosts.length > 0) {
        const totalDays = resolvedPosts.reduce((sum, post) => {
          if (post.createdAt?.toDate && post.resolvedAt?.toDate) {
            const created = post.createdAt.toDate();
            const resolved = post.resolvedAt.toDate();
            const days = Math.floor(
              (resolved - created) / (1000 * 60 * 60 * 24),
            );
            validCount++;
            return sum + Math.max(0, days);
          }
          return sum;
        }, 0);
        avgResolutionDays =
          validCount > 0 ? Math.round(totalDays / validCount) : 0;
      }

      setStats({
        total,
        byStatus,
        byMonth,
        responseTime: avgResolutionDays,
        avgResolutionDays,
        resolved_pending_verification:
          statusCounts.resolved_pending_verification,
        resolved_verified: statusCounts.resolved_verified,
        pending: statusCounts.pending,
        inProgress: statusCounts.in_progress,
        rejected: statusCounts.rejected,
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Container maxW="container.xl" py={8}>
        <VStack spacing={8}>
          <Spinner size="xl" color="blue.500" thickness="4px" />
          <Text>Loading analytics...</Text>
        </VStack>
      </Container>
    );
  }

  return (
    <Container
      maxW="container.xl"
      py={{ base: 4, md: 8 }}
      px={{ base: 3, md: 6 }}
    >
      <VStack spacing={{ base: 4, md: 8 }} align="stretch">
        {}
        <HStack justify="space-between" align="center" wrap="wrap" gap={4}>
          <Heading
            size={{ base: "md", md: "lg", lg: "xl" }}
            bgGradient={`linear(to-r, ${
              departmentColors[dept] || "blue.600"
            }, purple.600)`}
            bgClip="text"
            fontWeight="extrabold"
          >
            {dept} Department Analytics
          </Heading>
          <Select
            w={{ base: "full", sm: "200px" }}
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            size="md"
            borderRadius="lg"
            fontWeight="500"
          >
            <option value="all">All Time</option>
            <option value="30days">Last 30 Days</option>
            <option value="7days">Last 7 Days</option>
          </Select>
        </HStack>

        {}
        <SimpleGrid
          columns={{ base: 1, sm: 2, md: 3, lg: 6 }}
          spacing={{ base: 3, md: 6 }}
        >
          <Box
            p={{ base: 4, md: 6 }}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="lg"
            bgGradient="linear(135deg, #667eea 0%, #764ba2 100%)"
            color="white"
            position="relative"
            overflow="hidden"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "radial-gradient(circle at top right, rgba(255,255,255,0.1), transparent 70%)",
              pointerEvents: "none",
            }}
          >
            <VStack align="start" spacing={2}>
              <Text
                fontSize={{ base: "xs", md: "sm" }}
                textTransform="uppercase"
                opacity={0.9}
                fontWeight="bold"
              >
                Total Issues
              </Text>
              <Text
                fontSize={{ base: "3xl", md: "4xl" }}
                fontWeight="extrabold"
              >
                {stats.total}
              </Text>
            </VStack>
          </Box>

          <Box
            p={{ base: 4, md: 6 }}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="lg"
            bgGradient="linear(135deg, #f59e0b 0%, #d97706 100%)"
            color="white"
            position="relative"
            overflow="hidden"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "radial-gradient(circle at top right, rgba(255,255,255,0.1), transparent 70%)",
              pointerEvents: "none",
            }}
          >
            <VStack align="start" spacing={2}>
              <Text
                fontSize={{ base: "xs", md: "sm" }}
                textTransform="uppercase"
                opacity={0.9}
                fontWeight="bold"
              >
                Pending Verification
              </Text>
              <Text
                fontSize={{ base: "3xl", md: "4xl" }}
                fontWeight="extrabold"
              >
                {stats.resolved_pending_verification || 0}
              </Text>
            </VStack>
          </Box>

          <Box
            p={{ base: 4, md: 6 }}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="lg"
            bgGradient="linear(135deg, #10b981 0%, #059669 100%)"
            color="white"
            position="relative"
            overflow="hidden"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "radial-gradient(circle at top right, rgba(255,255,255,0.1), transparent 70%)",
              pointerEvents: "none",
            }}
          >
            <VStack align="start" spacing={2}>
              <Text
                fontSize={{ base: "xs", md: "sm" }}
                textTransform="uppercase"
                opacity={0.9}
                fontWeight="bold"
              >
                Verified & Closed
              </Text>
              <Text
                fontSize={{ base: "3xl", md: "4xl" }}
                fontWeight="extrabold"
              >
                {stats.resolved_verified || 0}
              </Text>
            </VStack>
          </Box>

          <Box
            p={{ base: 4, md: 6 }}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="lg"
            bgGradient="linear(135deg, #f093fb 0%, #f5576c 100%)"
            color="white"
            position="relative"
            overflow="hidden"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "radial-gradient(circle at top right, rgba(255,255,255,0.1), transparent 70%)",
              pointerEvents: "none",
            }}
          >
            <VStack align="start" spacing={2}>
              <Text
                fontSize={{ base: "xs", md: "sm" }}
                textTransform="uppercase"
                opacity={0.9}
                fontWeight="bold"
              >
                Pending
              </Text>
              <Text
                fontSize={{ base: "3xl", md: "4xl" }}
                fontWeight="extrabold"
              >
                {stats.pending || 0}
              </Text>
            </VStack>
          </Box>

          <Box
            p={{ base: 4, md: 6 }}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="lg"
            bgGradient="linear(135deg, #fa709a 0%, #fee140 100%)"
            color="white"
            position="relative"
            overflow="hidden"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "radial-gradient(circle at top right, rgba(255,255,255,0.1), transparent 70%)",
              pointerEvents: "none",
            }}
          >
            <VStack align="start" spacing={2}>
              <Text
                fontSize={{ base: "xs", md: "sm" }}
                textTransform="uppercase"
                opacity={0.9}
                fontWeight="bold"
              >
                In Progress
              </Text>
              <Text
                fontSize={{ base: "3xl", md: "4xl" }}
                fontWeight="extrabold"
              >
                {stats.inProgress || 0}
              </Text>
            </VStack>
          </Box>

          <Box
            p={{ base: 4, md: 6 }}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="lg"
            bgGradient="linear(135deg, #fa709a 0%, #fee140 100%)"
            color="white"
            position="relative"
            overflow="hidden"
            _before={{
              content: '""',
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "radial-gradient(circle at top right, rgba(255,255,255,0.1), transparent 70%)",
              pointerEvents: "none",
            }}
          >
            <VStack align="start" spacing={2}>
              <Text
                fontSize={{ base: "xs", md: "sm" }}
                textTransform="uppercase"
                opacity={0.9}
                fontWeight="bold"
              >
                Avg Resolution
              </Text>
              <Text
                fontSize={{ base: "3xl", md: "4xl" }}
                fontWeight="extrabold"
              >
                {stats.avgResolutionDays}
                <Text as="span" fontSize={{ base: "sm", md: "md" }} ml={1}>
                  days
                </Text>
              </Text>
            </VStack>
          </Box>
        </SimpleGrid>

        {}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 4, md: 6 }}>
          {}
          <Box
            p={{ base: 4, md: 6 }}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="lg"
            transition="all 0.3s"
            _hover={{ shadow: "xl", transform: "translateY(-4px)" }}
          >
            <Heading
              size={{ base: "sm", md: "md" }}
              mb={4}
              bgGradient="linear(to-r, purple.600, pink.600)"
              bgClip="text"
              fontWeight="bold"
            >
              Status Distribution
            </Heading>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.byStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    percent > 0
                      ? `${name}: ${(percent * 100).toFixed(0)}%`
                      : null
                  }
                  outerRadius={90}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.byStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </Box>

          {}
          <Box
            p={{ base: 4, md: 6 }}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="lg"
            transition="all 0.3s"
            _hover={{ shadow: "xl", transform: "translateY(-4px)" }}
          >
            <Heading
              size={{ base: "sm", md: "md" }}
              mb={4}
              bgGradient="linear(to-r, blue.600, cyan.600)"
              bgClip="text"
              fontWeight="bold"
            >
              Status Breakdown
            </Heading>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.byStatus}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  angle={-15}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #e0e0e0",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                />
                <Legend iconType="circle" />
                <Bar
                  dataKey="value"
                  fill="#667eea"
                  radius={[8, 8, 0, 0]}
                  name="Count"
                />
              </BarChart>
            </ResponsiveContainer>
          </Box>

          {}
          {stats.byMonth.length > 0 && (
            <Box
              p={{ base: 4, md: 6 }}
              bg={bgColor}
              borderRadius="xl"
              borderWidth="1px"
              borderColor={borderColor}
              shadow="lg"
              transition="all 0.3s"
              _hover={{ shadow: "xl", transform: "translateY(-4px)" }}
            >
              <Heading
                size={{ base: "sm", md: "md" }}
                mb={4}
                bgGradient="linear(to-r, green.600, teal.600)"
                bgClip="text"
                fontWeight="bold"
              >
                Performance Overview
              </Heading>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11 }}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend iconType="circle" />
                  <Bar
                    dataKey="resolved_verified"
                    stackId="a"
                    fill="#10b981"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="resolved_pending_verification"
                    stackId="a"
                    fill="#f59e0b"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="in_progress"
                    stackId="a"
                    fill="#fa709a"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="pending"
                    stackId="a"
                    fill="#f093fb"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          )}

          {}
          {stats.byMonth.length > 0 && (
            <Box
              p={{ base: 4, md: 6 }}
              bg={bgColor}
              borderRadius="xl"
              borderWidth="1px"
              borderColor={borderColor}
              shadow="lg"
              transition="all 0.3s"
              _hover={{ shadow: "xl", transform: "translateY(-4px)" }}
            >
              <Heading
                size={{ base: "sm", md: "md" }}
                mb={4}
                bgGradient="linear(to-r, orange.600, red.600)"
                bgClip="text"
                fontWeight="bold"
              >
                Reporting Trend
              </Heading>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.byMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11 }}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend iconType="circle" />
                  <Line
                    type="monotone"
                    dataKey="pending"
                    stroke="#f093fb"
                    strokeWidth={3}
                    name="Pending"
                    dot={{ r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="in_progress"
                    stroke="#fa709a"
                    strokeWidth={3}
                    name="In Progress"
                    dot={{ r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="resolved_pending_verification"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    name="Pending Verification"
                    dot={{ r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="resolved_verified"
                    stroke="#10b981"
                    strokeWidth={3}
                    name="Verified & Closed"
                    dot={{ r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rejected"
                    stroke="#ff0844"
                    strokeWidth={3}
                    name="Rejected"
                    dot={{ r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          )}
        </SimpleGrid>
      </VStack>
    </Container>
  );
}
