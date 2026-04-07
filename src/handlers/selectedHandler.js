module.exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      stored: [],
      note: "S3 persistence not implemented yet.",
    }),
  };
};

