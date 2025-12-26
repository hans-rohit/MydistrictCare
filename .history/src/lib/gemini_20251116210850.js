import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export const generateChatResponse = async (userMessage, postsData) => {
  try {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey || apiKey === "your_api_key_here") {
      throw new Error("Gemini API key is not configured. Please add VITE_GEMINI_API_KEY to your .env file.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

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
  };

  posts.forEach((post) => {
    // Count by department
    const dept = post.departmentTag || "Unknown";
    stats.byDepartment[dept] = (stats.byDepartment[dept] || 0) + 1;

    // Count by status
    const status = post.status || "pending";
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
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
      description: p.description?.substring(0, 100), // First 100 chars
    }));

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

Recent Issues:
${stats.recentIssues
  .map(
    (issue, i) =>
      `${i + 1}. ${issue.department} - ${issue.status} - ${issue.description || "No description"}`
  )
  .join("\n")}
`;
};
