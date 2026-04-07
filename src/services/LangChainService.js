class LangChainService {
  /**
   * Turn AIMessage.content (string or multimodal parts) into plain text.
   * @param {string | import("@langchain/core/messages").MessageContent} content
   * @returns {string}
   */
  static normalizeMessageContent(content) {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object" && "text" in part) return part.text ?? "";
          return "";
        })
        .join("");
    }
    return content == null ? "" : String(content);
  }

  /**
   * Parse LLM text that may include prose and ```json ... ``` fences into recipe objects.
   * @param {string | import("@langchain/core/messages").MessageContent} raw
   * @returns {{ recipes: object[], parseError?: string }}
   */
  static parseRecipesFromLlmOutput(raw) {
    const text = LangChainService.normalizeMessageContent(raw).trim();
    if (!text) {
      return { recipes: [], parseError: "Empty model output" };
    }

    let jsonStr = null;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
      jsonStr = fence[1].trim();
    } else {
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start !== -1 && end > start) {
        jsonStr = text.slice(start, end + 1);
      } else {
        jsonStr = text;
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return {
        recipes: [],
        parseError: "Could not parse JSON from model output",
      };
    }

    let list;
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.recipes)) {
      list = parsed.recipes;
    } else {
      return {
        recipes: [],
        parseError: "Expected a JSON array or an object with a recipes array",
      };
    }

    const recipes = list.map((r, i) => ({
      id: r.id ?? `rec_${i + 1}`,
      name: r.name ?? r.title ?? `Recipe ${i + 1}`,
      ingredients: Array.isArray(r.ingredients) ? r.ingredients : [],
      instructions: Array.isArray(r.instructions)
        ? r.instructions
        : Array.isArray(r.steps)
          ? r.steps
          : [],
    }));

    return { recipes };
  }

  /**
   * @param {string} contentType - e.g. image/jpeg
   * @param {string} base64 - raw base64 (no data: prefix)
   * @returns {Promise<{ recipes: object[], parseError?: string }>}
   */
  async generateRecipes(contentType, base64) {
    const path = require("node:path");
    require("dotenv").config({
      path: path.join(__dirname, "../../.env"),
    });

    const { ChatOpenAI } = require("@langchain/openai");
    const { HumanMessage, SystemMessage } = require("@langchain/core/messages");

    const model = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    });

    const mime = contentType || "application/octet-stream";

    const messages = [
      new SystemMessage(
        "You're a helpful assistant that generates recipes based on the ingredients in the image. Use your creativity to generate three recipes. Give me the response in a JSON format with the following fields: name, ingredients, instructions."
      ),
      new HumanMessage({
        content: [
          { type: "text", text: "The ingredients are on this image." },
          {
            type: "image_url",
            image_url: {
              url: `data:${mime};base64,${base64}`,
            },
          },
        ],
      }),
    ];

    const response = await model.invoke(messages);
    const raw = response?.content ?? "";
    return LangChainService.parseRecipesFromLlmOutput(raw);
  }
}

module.exports = LangChainService;
