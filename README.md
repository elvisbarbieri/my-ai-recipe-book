# Recipe API

Serverless API on **AWS Lambda** (Node.js 20) that accepts a **base64-encoded image** of ingredients, calls **OpenAI** via **LangChain** to suggest recipes, and returns structured JSON.

**User selections** (saving which recipes the user chose—for example to **S3** via a dedicated endpoint) are **not implemented yet** (**TBD**). Only recipe **suggestions** are live today.

---

## Architecture overview

```
Client (image as base64)
        │
        ▼
  API Gateway (HTTP API)  ──or──  serverless-offline :3000
        │
        ▼
  Lambda: function `api`
  handler: src/handlers/suggestionHandler.handler
        │
        └── POST /v1/recipes/suggestions
```

- **One Lambda**, **one HTTP route** — `serverless.yml` points directly at **`suggestionHandler`** (no router).
- **Business logic** for AI lives in `src/services/LangChainService.js`.

### Selections (TBD)

Planned later, not in this repo yet:

- An API for the client to **submit chosen recipe(s)** after the user picks from suggestions.
- **Persistence** (e.g. **S3**), using `S3_BUCKET_NAME` and IAM on the Lambda.
- A route such as `POST /v1/recipes/selected` (name and contract **TBD**).

Until then, the client can keep selections in local state only.

---

## Request flow: suggestions

1. **Client** sends `POST /v1/recipes/suggestions` with JSON body:
   - `contentType` — MIME type of the image (e.g. `image/jpeg`).
   - `base64` — raw base64 of the image bytes (no `data:image/...;base64,` prefix).

2. **`suggestionHandler`** parses the body, validates `base64`, and instantiates `LangChainService`.

3. **`LangChainService.generateRecipes(contentType, base64)`**:
   - Loads secrets from `.env` via **dotenv** (path resolved from the service file so it works under serverless-offline).
   - Builds a **system** message (recipe-generation instructions) and a **human** message with:
     - short text prompt, and
     - an **image** part as a data URL: `data:<mime>;base64,<base64>`.
   - Calls **`ChatOpenAI`** (`@langchain/openai`) and receives natural-language (or semi-structured) output.

4. **`parseRecipesFromLlmOutput`** (static helper on the same class):
   - Normalizes `response.content` (string or multimodal array).
   - Extracts JSON from markdown fences (```` ```json ... ``` ````) or from the first `[` … last `]` slice.
   - Accepts either a **JSON array** of recipes or `{ "recipes": [...] }`.
   - Normalizes each item to:
     - `id` (default `rec_1`, `rec_2`, …)
     - `name` (from `name` or `title`)
     - `ingredients` (array of strings)
     - `instructions` (from `instructions` or `steps`)
   - On failure: returns `recipes: []` and an optional **`parseError`** string.

5. **Response** to the client: `{ "recipes": [...] }` and, if parsing failed, `{ "parseError": "..." }` alongside empty or partial `recipes`.

---

## Configuration

| Variable | Where | Purpose |
|----------|--------|---------|
| `OPENAI_API_KEY` | `.env` (local) / Lambda env (deployed) | OpenAI API key |
| `OPENAI_MODEL` | optional | Defaults to `gpt-4o-mini` in code if unset |
| `S3_BUCKET_NAME` | `serverless.yml` → `provider.environment` | **TBD** — for future “save selections” flow; unused until that feature ships |
| `AWS_REGION` | shell or CI | Region for deploy |

Create a **`.env`** in the project root (never commit it):

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

For **deployed** Lambdas, set the same variables in your CI/CD or AWS console / SSM; `serverless.yml` maps `OPENAI_API_KEY` and `OPENAI_MODEL` from the deployment environment.

---

## Local development

```bash
npm install
npm run offline
```

- **HTTP API** is simulated at **`http://localhost:3000`** (see `custom.serverless-offline.httpPort` in `serverless.yml`).
- **Lambda timeout** is **120 seconds** in `serverless.yml` (useful for slow vision calls).

### Example: suggestions

```bash
curl -s -X POST http://localhost:3000/v1/recipes/suggestions \
  -H "Content-Type: application/json" \
  -d '{"contentType":"image/jpeg","base64":"<BASE64_HERE>"}'
```

### Other scripts

| Script | Command |
|--------|---------|
| Offline | `npm run offline` |
| Deploy | `npm run deploy` |
| Remove stack | `npm run remove` |
| Invoke function locally | `npm run invoke:local` |

---

## Project layout

| Path | Role |
|------|------|
| `serverless.yml` | Service name, provider, Lambda `api`, HTTP route, plugins |
| `src/handlers/suggestionHandler.js` | Lambda entry: validates input, calls `LangChainService`, returns JSON |
| `src/services/LangChainService.js` | OpenAI call + `parseRecipesFromLlmOutput` |

There is **no** `selected` handler or router in the tree; selections are **TBD** (see above).

---

## Tech stack

- **Runtime:** Node.js 20.x  
- **IaC / local dev:** Serverless Framework v4, **serverless-offline**  
- **AI:** `@langchain/openai`, `@langchain/core`  
- **Config:** `dotenv` for local `.env`

---

## Security notes

- Do **not** log raw base64 or API keys.
- Keep `.env` out of version control (see `.gitignore`).
- Rotate keys if they are ever committed or leaked.

---

## License

UNLICENSED (private project).
