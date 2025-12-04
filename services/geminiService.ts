import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateBlogContent = async (prompt: string, context?: string): Promise<string> => {
  const client = getClient();
  if (!client) return "Error: API Key missing.";

  try {
    const fullPrompt = `
      You are a sophisticated, helpful writing assistant for a high-end lifestyle blog.
      
      Task: ${prompt}
      
      ${context ? `Context from previous paragraphs: ${context}` : ''}

      Keep the tone elegant, minimal, and engaging. Do not use markdown formatting like **bold** or # headers in the response unless explicitly asked, just return plain text or simple paragraphs.
    `;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: fullPrompt,
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini generation error:", error);
    return "Failed to generate content. Please try again.";
  }
};

export const suggestTitle = async (contentSummary: string): Promise<string> => {
  const client = getClient();
  if (!client) return "";
    
  try {
    const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Generate a catchy, elegant, short blog post title based on this summary: ${contentSummary}. Return ONLY the title text.`,
    });
    return response.text?.trim() || "";
  } catch (e) {
      return "";
  }
}
