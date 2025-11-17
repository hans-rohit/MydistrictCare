import { GoogleGenerativeAI } from "@google/generative-ai";

export const generateChatResponse = async (userMessage, postsData) => {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (!apiKey || apiKey === "your_api_key_here") {
      throw new Error(
        "Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file."
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // Create context from posts data
    const context = createContextFromPosts(postsData);

    const systemPrompt = `You are a helpful assistant for District Care, a civic issue reporting platform. 
Your role is to answer questions about issues reported in the system related to:
- Electricity issues
- Water supply problems
- Sewage/drainage issues
- Road maintenance and infrastructure

Based on the following data from our system:
${context}

Guidelines:
1. Only answer questions related to civic issues (electricity, water, sewage, roads)
2. Use the provided data to give accurate statistics and insights
3. Be concise and helpful
4. If asked about something outside your scope, politely redirect to civic issues
5. Provide actionable information when possible
6. When asked about specific locations or place names:
   - Look for reports with matching addresses or nearby coordinates
   - Consider that locations are specified with latitude/longitude and address information
   - Match place names with the address field in the location data
   - Provide location-specific insights based on the reports in that area
7. When analyzing location-based queries (e.g., "How is the road in Podanur?"):
   - Search for the place name in the address/location data
   - Filter reports by that location
   - Summarize the status, issues, and conditions reported for that specific area
   - If multiple reports exist for the same location, provide an overview
8. When asked "which location has more issues" or similar comparative queries:
   - Use the "Top Locations by Issue Count" section provided in the data
   - Analyze and compare issue counts across different locations
   - Identify hotspots and areas with the most problems
   - Provide rankings and specific numbers from the location data
9. ALWAYS use the location data provided - it contains real coordinates and addresses from actual reports

User question: ${userMessage}`;

    const result = await model.generateContent(systemPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating response:", error);
    console.error("Error details:", error.message);
    throw error;
  }
};

// Helper function to create context from posts
const createContextFromPosts = (posts) => {
  if (!posts || posts.length === 0) {
    return "No issues have been reported yet.";
  }

  // Calculate statistics
  const stats = {
    total: posts.length,
    byDepartment: {},
    byStatus: {},
    recentIssues: [],
    locationData: [],
    locationCounts: {},
  };

  posts.forEach((post) => {
    // Count by department
    const dept = post.departmentTag || "Unknown";
    stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;

    // Count by status
    const status = post.status || "pending";
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

    // Collect location data
    if (post.location?.lat && post.location?.lng) {
      const address = post.location.address || "Unknown location";
      stats.locationData.push({
        department: post.departmentTag,
        status: post.status,
        description: post.description?.substring(0, 150),
        latitude: post.location.lat,
        longitude: post.location.lng,
        address: address,
      });

      // Count issues by location
      stats.locationCounts[address] = (stats.locationCounts[address] || 0) + 1;
    }
  });

  // Get recent issues (last 5)
  stats.recentIssues = posts
    .filter((p) => !p.deleted)
    .sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    })
    .slice(0, 5)
    .map((p) => ({
      department: p.departmentTag,
      status: p.status,
      description: p.description?.substring(0, 100),
      location: p.location?.address || "Location not specified",
    }));

  // Sort locations by issue count
  const topLocations = Object.entries(stats.locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return `
Total Issues: ${stats.total}

Issues by Department:
${Object.entries(stats.byDepartment)
  .map(([dept, count]) => `- ${dept}: ${count} issues`)
  .join("\n")}

Issues by Status:
${Object.entries(stats.byStatus)
  .map(([status, count]) => `- ${status}: ${count} issues`)
  .join("\n")}

Top Locations by Issue Count:
${
  topLocations.length > 0
    ? topLocations
        .map(([location, count], i) => `${i + 1}. ${location}: ${count} issues`)
        .join("\n")
    : "No location data available"
}

Recent Issues with Locations:
${stats.recentIssues
  .map(
    (issue, i) =>
      `${i + 1}. ${issue.department} - ${issue.status} - ${issue.location} - ${
        issue.description || "No description"
      }`
  )
  .join("\n")}

Detailed Location Data (${stats.locationData.length} reports with coordinates):
${stats.locationData
  .slice(0, 20)
  .map(
    (loc, i) =>
      `${i + 1}. ${loc.department} - ${loc.status} - Location: ${
        loc.address
      } (Lat: ${loc.latitude.toFixed(4)}, Lng: ${loc.longitude.toFixed(4)}) - ${
        loc.description || "No description"
      }`
  )
  .join("\n")}
${
  stats.locationData.length > 20
    ? `\n... and ${stats.locationData.length - 20} more location-based reports`
    : ""
}

IMPORTANT: You have access to ${
    stats.locationData.length
  } reports with location data. Use this information to answer location-based queries.
`;
};
