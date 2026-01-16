import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { jawedKnowledge } from "./jawedKnowledge.js";

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Gemini client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const PRIMARY_MODEL = "gemini-2.5-flash";

async function generateWithFallback(prompt) {
  try {
    const response = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
      config: { temperature: 0.3 },
    });
    return { response, modelUsed: PRIMARY_MODEL };
  } catch (err) {
    console.error("Primary model error:", err?.status, err?.message);
    throw err;
  }
}

// Health check endpoint
app.get("/", (req, res) => {
  res.send("Chatbot server is running ✅");
});

// Chat endpoint
app.post("/api/feedback", async (req, res) => {
  try {
    const { phrase_text, level } = req.body;

    if (!phrase_text || !level) {
      return res.status(400).json({ reply: "Missing phrase_text or level." });
    }

    const prompt = `
${jawedKnowledge}

العبارة: ${phrase_text}

المستوى: ${level}

الآن أجب على آخر رسالة من المستخدم بطريقة ودّية ومختصرة.
ركّز فقط على المعلومات المتعلقة بتطبيق التجويد.
إذا لم تكن متأكدًا من شيء، قل إنك غير متأكد واقترح الرجوع إلى توثيق التطبيق.
`;

    const { response, modelUsed } = await generateWithFallback(prompt);

    const text = response.text;
    res.json({ reply: text, modelUsed });
  } catch (error) {
    console.error("Gemini error (after fallback):", error);
    res.status(500).json({
      reply:
        "Sorry, something went wrong while talking to the AI. Please try again later.",
    });
  }
});

// Start server
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Chatbot server running on port ${PORT}`);
});
