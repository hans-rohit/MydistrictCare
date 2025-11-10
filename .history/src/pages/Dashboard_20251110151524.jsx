import { useEffect, useState } from "react";
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
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    byDepartment: [],
    byStatus: [],
    byMonth: [],
    recentActivity: [],
    responseTime: [],
  });
  const [timeRange, setTimeRange] = useState("all"); // all, 30days, 7days

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  // Status colors matching the dashboard boxes
  const statusColors = {
    pending: "#f093fb",
    in_progress: "#fa709a",
    resolved: "#30cfd0",
    rejected: "#ff0844",
    deleted: "#868f96",
  };

  const departmentColors = {
    Electricity: "#667eea",
    Water: "#30cfd0",
    Sewage: "#fa709a",
    Road: "#f093fb",
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const postsRef = collection(db, "posts");
      let q = query(postsRef);

      // Apply time range filter
      if (timeRange !== "all") {
        const now = new Date();
        const daysAgo = timeRange === "7days" ? 7 : 30;
        const startDate = new Date(now.setDate(now.getDate() - daysAgo));
        q = query(postsRef, where("createdAt", ">=", startDate));
      }

      const snapshot = await getDocs(q);
      const posts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Calculate statistics
      const total = posts.length;

      // By Department
      const deptCounts = { Electricity: 0, Water: 0, Sewage: 0, Road: 0 };
      posts.forEach((post) => {
        if (
          post.departmentTag &&
          deptCounts.hasOwnProperty(post.departmentTag)
        ) {
          deptCounts[post.departmentTag]++;
        }
      });
      const byDepartment = Object.entries(deptCounts).map(([name, value]) => ({
        name,
        value,
        count: value,
      }));

      // By Status
      const statusCounts = {
        pending: 0,
        in_progress: 0,
        resolved: 0,
        rejected: 0,
        deleted: 0,
      };
      posts.forEach((post) => {
        const status = post.deleted ? "deleted" : post.status || "pending";
        if (statusCounts.hasOwnProperty(status)) {
          statusCounts[status]++;
        }
      });
      const byStatus = Object.entries(statusCounts).map(([name, value]) => ({
        name: name.replace("_", " ").toUpperCase(),
        value,
        count: value,
        color: statusColors[name],
      }));

      // Reporting Trend - Dynamic based on time range with department breakdown
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
        // Show daily trend for last 7 days with department breakdown
        posts.forEach((post) => {
          if (post.createdAt?.toDate && post.departmentTag) {
            const date = post.createdAt.toDate();
            const dayKey = `${monthNames[date.getMonth()]} ${date.getDate()}`;
            
            if (!dayCounts[dayKey]) {
              dayCounts[dayKey] = { period: dayKey, Electricity: 0, Water: 0, Sewage: 0, Road: 0 };
            }
            dayCounts[dayKey][post.departmentTag]++;
          }
        });
        byMonth = Object.values(dayCounts).slice(-7);
      } else if (timeRange === "30days") {
        // Show weekly trend for last 30 days with department breakdown
        posts.forEach((post) => {
          if (post.createdAt?.toDate && post.departmentTag) {
            const date = post.createdAt.toDate();
            const weekNum = Math.ceil(date.getDate() / 7);
            const weekKey = `Week ${weekNum} - ${monthNames[date.getMonth()]}`;
            
            if (!weekCounts[weekKey]) {
              weekCounts[weekKey] = { period: weekKey, Electricity: 0, Water: 0, Sewage: 0, Road: 0 };
            }
            weekCounts[weekKey][post.departmentTag]++;
          }
        });
        byMonth = Object.values(weekCounts).slice(-5);
      } else {
        // Show monthly trend for all time (last 6 months) with department breakdown
        posts.forEach((post) => {
          if (post.createdAt?.toDate && post.departmentTag) {
            const date = post.createdAt.toDate();
            const monthKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
            
            if (!monthCounts[monthKey]) {
              monthCounts[monthKey] = { period: monthKey, Electricity: 0, Water: 0, Sewage: 0, Road: 0 };
            }
            monthCounts[monthKey][post.departmentTag]++;
          }
        });
        byMonth = Object.values(monthCounts).slice(-6);
      }

      // Average Resolution Time - Average days to resolve by department
      const responseTime = Object.keys(deptCounts).map((dept) => {
        const deptPosts = posts.filter((p) => p.departmentTag === dept);
        const resolvedPosts = deptPosts.filter((p) => p.status === "resolved");
        
        let avgDays = 0;
        let validCount = 0;
        let hasIssues = deptPosts.length > 0;
        let hasResolved = resolvedPosts.length > 0;
        
        if (resolvedPosts.length > 0) {
          const totalDays = resolvedPosts.reduce((sum, post) => {
            if (post.createdAt?.toDate && post.resolvedAt?.toDate) {
              const created = post.createdAt.toDate();
              const resolved = post.resolvedAt.toDate();
              const days = Math.floor(
                (resolved - created) / (1000 * 60 * 60 * 24)
              );
              validCount++;
              return sum + Math.max(0, days); // Ensure non-negative
            }
            return sum;
          }, 0);
          avgDays = validCount > 0 ? Math.round(totalDays / validCount) : 0;
        }
        
        return {
          department: dept,
          avgDays: avgDays,
          resolved: resolvedPosts.length,
          hasIssues: hasIssues,
          hasResolved: hasResolved,
        };
      });

      // Recent Activity (resolved vs pending trend by department)
      const recentActivity = Object.keys(deptCounts).map((dept) => {
        const deptPosts = posts.filter((p) => p.departmentTag === dept);
        return {
          department: dept,
          resolved: deptPosts.filter((p) => p.status === "resolved").length,
          pending: deptPosts.filter((p) => p.status === "pending").length,
          in_progress: deptPosts.filter((p) => p.status === "in_progress")
            .length,
        };
      });

      setStats({
        total,
        byDepartment,
        byStatus,
        byMonth,
        recentActivity,
        responseTime,
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
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <Heading
            size={{ base: "lg", md: "xl" }}
            bgGradient="linear(to-r, blue.600, purple.600)"
            bgClip="text"
            fontWeight="extrabold"
          >
            Analytics Dashboard
          </Heading>
          <Select
            w="200px"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="30days">Last 30 Days</option>
            <option value="7days">Last 7 Days</option>
          </Select>
        </HStack>

        {/* Summary Cards */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={6}>
          <Box
            p={6}
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
              <Text fontSize="sm" textTransform="uppercase" opacity={0.9}>
                Total Issues
              </Text>
              <Text fontSize="4xl" fontWeight="extrabold">
                {stats.total}
              </Text>
            </VStack>
          </Box>

          <Box
            p={6}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="lg"
            bgGradient="linear(135deg, #30cfd0 0%, #330867 100%)"
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
              <Text fontSize="sm" textTransform="uppercase" opacity={0.9}>
                Resolved
              </Text>
              <Text fontSize="4xl" fontWeight="extrabold">
                {stats.byStatus.find((s) => s.name === "RESOLVED")?.value || 0}
              </Text>
            </VStack>
          </Box>

          <Box
            p={6}
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
              <Text fontSize="sm" textTransform="uppercase" opacity={0.9}>
                Pending
              </Text>
              <Text fontSize="4xl" fontWeight="extrabold">
                {stats.byStatus.find((s) => s.name === "PENDING")?.value || 0}
              </Text>
            </VStack>
          </Box>

          <Box
            p={6}
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
              <Text fontSize="sm" textTransform="uppercase" opacity={0.9}>
                In Progress
              </Text>
              <Text fontSize="4xl" fontWeight="extrabold">
                {stats.byStatus.find((s) => s.name === "IN_PROGRESS")?.value ||
                  0}
              </Text>
            </VStack>
          </Box>
        </SimpleGrid>

        {/* Charts Row 1 */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
          {/* Department Distribution - Pie Chart */}
          <Box
            p={6}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="md"
          >
            <Heading size="md" mb={4} color="gray.700">
              Issues by Department
            </Heading>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.byDepartment}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats.byDepartment.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={departmentColors[entry.name]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Box>

          {/* Average Resolution Time - Custom Cards */}
          <Box
            p={6}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="md"
          >
            <Heading size="md" mb={4} color="gray.700">
              Average Resolution Time
            </Heading>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
              {stats.responseTime?.map((dept) => (
                <Box
                  key={dept.department}
                  p={4}
                  borderRadius="lg"
                  borderWidth="2px"
                  borderColor={
                    !dept.hasIssues
                      ? "blue.200"
                      : !dept.hasResolved
                      ? "orange.200"
                      : departmentColors[dept.department]
                  }
                  bg={
                    !dept.hasIssues
                      ? "blue.50"
                      : !dept.hasResolved
                      ? "orange.50"
                      : "white"
                  }
                >
                  <VStack align="start" spacing={2}>
                    <HStack justify="space-between" w="100%">
                      <Text fontWeight="bold" fontSize="md" color="gray.700">
                        {dept.department}
                      </Text>
                      {dept.hasIssues && dept.hasResolved && (
                        <Badge
                          colorScheme="green"
                          fontSize="xs"
                          px={2}
                          py={1}
                        >
                          {dept.resolved} Resolved
                        </Badge>
                      )}
                    </HStack>
                    
                    {!dept.hasIssues ? (
                      <HStack spacing={2} w="100%">
                        <Text fontSize="2xl" color="blue.500">
                          🎉
                        </Text>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="sm" fontWeight="semibold" color="blue.600">
                            No Issues Reported
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            Clean slate for this period
                          </Text>
                        </VStack>
                      </HStack>
                    ) : !dept.hasResolved ? (
                      <HStack spacing={2} w="100%">
                        <Text fontSize="2xl" color="orange.500">
                          ⏳
                        </Text>
                        <VStack align="start" spacing={0}>
                          <Text fontSize="sm" fontWeight="semibold" color="orange.600">
                            No Issues Resolved Yet
                          </Text>
                          <Text fontSize="xs" color="gray.500">
                            Pending resolution
                          </Text>
                        </VStack>
                      </HStack>
                    ) : (
                      <HStack justify="space-between" w="100%">
                        <VStack align="start" spacing={0}>
                          <Text fontSize="3xl" fontWeight="extrabold" color={departmentColors[dept.department]}>
                            {dept.avgDays}
                          </Text>
                          <Text fontSize="xs" color="gray.600">
                            avg days
                          </Text>
                        </VStack>
                        <Text fontSize="4xl" opacity={0.3}>
                          ⚡
                        </Text>
                      </HStack>
                    )}
                  </VStack>
                </Box>
              ))}
            </SimpleGrid>
          </Box>
        </SimpleGrid>

        {/* Charts Row 2 */}
        <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
          {/* Monthly Trend - Line Chart */}
          <Box
            p={6}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="md"
          >
            <Heading size="md" mb={4} color="gray.700">
              Monthly Trend
            </Heading>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.byMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#8884d8"
                  strokeWidth={3}
                  name="Issues Reported"
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>

          {/* Department Performance - Stacked Bar Chart */}
          <Box
            p={6}
            bg={bgColor}
            borderRadius="xl"
            borderWidth="1px"
            borderColor={borderColor}
            shadow="md"
          >
            <Heading size="md" mb={4} color="gray.700">
              Department Performance
            </Heading>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.recentActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="department" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="resolved" stackId="a" fill="#30cfd0" />
                <Bar dataKey="in_progress" stackId="a" fill="#fa709a" />
                <Bar dataKey="pending" stackId="a" fill="#f093fb" />
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </SimpleGrid>

        {/* Department Breakdown Table */}
        <Box
          p={6}
          bg={bgColor}
          borderRadius="xl"
          borderWidth="1px"
          borderColor={borderColor}
          shadow="md"
        >
          <Heading size="md" mb={4} color="gray.700">
            Department Summary
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4}>
            {stats.byDepartment.map((dept) => (
              <Box
                key={dept.name}
                p={4}
                borderRadius="lg"
                bg="gray.50"
                borderWidth="1px"
                borderColor="gray.200"
              >
                <Text fontWeight="bold" fontSize="lg" color="gray.700">
                  {dept.name}
                </Text>
                <Text fontSize="3xl" fontWeight="extrabold" color="blue.600">
                  {dept.count}
                </Text>
                <Text fontSize="sm" color="gray.600">
                  total issues
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      </VStack>
    </Container>
  );
}
