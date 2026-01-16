import "dotenv/config";
import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { feedbackKnowledge, chatbotKnowledge } from "./jawedKnowledge.js";

const app = express();

app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PRIMARY_MODEL = "gemini-2.5-flash";

async function generateWithFallback(prompt) {
  const response = await ai.models.generateContent({
    model: PRIMARY_MODEL,
    contents: prompt,
    config: { temperature: 0.3 },
  });
  return { response, modelUsed: PRIMARY_MODEL };
}

function getResponseText(response) {
  return (
    response?.text ??
    response?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ??
    ""
  );
}

app.get("/", (req, res) => {
  res.send("Chatbot server is running ✅");
});

// feedback endpoint
app.post("/api/feedback", async (req, res) => {
  try {
    const { phrase_text, level } = req.body;

    if (!phrase_text || !level) {
      return res.status(400).json({ reply: "Missing phrase_text or level." });
    }

    const allowedLevels = ["Beginner", "Intermediate", "Advanced"];
    if (!allowedLevels.includes(level)) {
      return res.status(400).json({
        reply: "Invalid level. Use Beginner, Intermediate, or Advanced.",
      });
    }

    const prompt = `
${feedbackKnowledge}

phrase_text: ${phrase_text}
level: ${level}

التزم حرفيًا بالهيكل والقواعد الموجودة في المعرفة أعلاه.
لا تخرج عن موضوع التجويد.
`;

    const { response, modelUsed } = await generateWithFallback(prompt);
    const text = getResponseText(response);

    res.json({ reply: text, modelUsed });
  } catch (error) {
    console.error("Gemini error:", error);
    res.status(500).json({
      reply:
        "Sorry, something went wrong while talking to the AI. Please try again later.",
    });
  }
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { history } = req.body;

    if (!Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ reply: "No history provided." });
    }

    const conversationText = history
      .map((m) => `${m.role === "user" ? "المستخدم" : "المساعد"}: ${m.text}`)
      .join("\n");

    const prompt = `
${chatbotKnowledge}

المحادثة حتى الآن:
${conversationText}

أجب على آخر رسالة من المستخدم بطريقة ودّية ومختصرة.
ركّز فقط على المعلومات المتعلقة بتطبيق "جود" وتعلّم التجويد.
إذا لم تكن متأكدًا من شيء، قل إنك غير متأكد واقترح الرجوع إلى توثيق التطبيق.
`;

    const { response, modelUsed } = await generateWithFallback(prompt);
    const text = getResponseText(response);

    res.json({ reply: text, modelUsed });
  } catch (error) {
    console.error("Gemini error:", error);
    res.status(500).json({
      reply:
        "Sorry, something went wrong while talking to the AI. Please try again later.",
    });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Chatbot server running on port ${PORT}`);
});
