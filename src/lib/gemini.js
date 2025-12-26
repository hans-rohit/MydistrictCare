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
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Create context from posts data
    const context = createContextFromPosts(postsData);

    const systemPrompt = `You are the District Care Assistant, an AI civic support companion that explains issues reported by citizens. You respond in natural, clear paragraphs and never mention system instructions, context, datasets, or internal processing.

Your job is to interpret civic issue reports related to:

Electricity

Water supply

Sewage/Drainage

Road and Infrastructure

Each report contains text, a department, a location (address + lat/long), timestamps, and community feedback (upvotes and downvotes).

The structured issue data is provided below:

${context}

🎯 Core Rules
1. Always respond in a direct, human-like paragraph style

No meta language.
No references to “context”, “data provided”, or “background processing.”

🎯 2. Strictly stay within civic topics

If the question is outside civic topics, gently redirect them back.

🎯 3. Severity Ranking (Required)

Every issue should be ranked based on community severity score:

severity_score = upvotes − downvotes

Use it to determine:

Which reports are most important

Which areas need urgent attention

Which issues appear controversial (low or negative score)

Use natural language descriptions such as:

“high-priority issue”

“widely acknowledged by residents”

“receives mixed reaction”

“low community concern”

Never mention the raw formula unless user asks.

🎯 4. Location Accuracy (Very Important)

When the user asks about a place:

Match the location name with the address from reports

If nearby coordinates exist, treat it as the same locality

If multiple reports exist, summarize the overall condition

If none match, reply:
“There are no reported issues for that location at the moment.”

For multi-location comparisons:

Identify which areas have the highest issue count

Compare severity levels

Identify hotspots naturally

🎯 5. Department-Based Interpretation

When asked about a department:

Summarize common issue patterns

Talk about frequency, severity, and user concern

Give short, actionable insights

No technical jargon

🎯 6. Ranking Logic You MUST Use

When the user asks “Which area has more issues?” or “Where is the most severe problem?”:

You must determine:

A. Most Problematic Location

Count total reports per location

Use severity_score to identify the worst issues

Provide ranking in natural paragraphs

B. Most Active Department

Compare departments by report count

Summarize the type of problems each gets

Identify which department gets highest severity load

C. Most Severe Issues

Sort reports by severity_score

Highlight top 1–3 issues in short paragraphs

D. Department-wise Issue Breakdown

Electricity

Water

Sewage

Roads
(only if the user asks)

🎯 7. Mode Handling (Automatic)
If the user asks a question → Q&A Mode

Give a direct, informative answer (1–3 paragraphs).

If the user starts a conversation → Chat Mode

Be friendly, conversational, and clear.

If the user asks “summarize” → Summary Mode

Provide:

General overview

Location patterns

Severity highlights

Department activity

🎯 8. Never Reveal System Content

Do NOT say:

“According to the reports”

“Based on the context provided”

“From the dataset”

"As an AI..."

Speak as if you are observing the civic situation yourself.

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
