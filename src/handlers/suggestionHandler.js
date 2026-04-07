module.exports.handler = async (event) => {
  const LangChainService = require("../services/LangChainService");
  const { contentType, base64 } = JSON.parse(event.body);

  if (!base64 || typeof base64 !== "string") {
    return {
      statusCode: 400,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        error: "Missing base64 payload",
        expected: {
          contentType: "image/jpeg",
          base64: "<BASE64_ENCODED_BINARY>",
        },
      }),
    };
  }

  const langChainService = new LangChainService();
  const { recipes, parseError } = await langChainService.generateRecipes(
    contentType,
    base64
  );

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      recipes,
      ...(parseError ? { parseError } : {}),
    }),
  };
};
