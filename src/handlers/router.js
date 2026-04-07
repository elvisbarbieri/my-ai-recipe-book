const suggestionHandler = require("./suggestionHandler");
const selectedHandler = require("./selectedHandler");

module.exports.handler = async (event) => {
  const path = event?.rawPath || event?.path || "";
  const method = event?.requestContext?.http?.method || event?.httpMethod || "";

  if (method === "POST" && path === "/v1/recipes/suggestions") {
    return suggestionHandler.handler(event);
  }

  if (method === "POST" && path === "/v1/recipes/selected") {
    return selectedHandler.handler(event);
  }

  return {
    statusCode: 404,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "Not found" }),
  };
};

