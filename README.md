# Open Journal

AI-powered reflective social journaling platform that connects users based on semantic similarity of their thoughts.

## Features

- 📝 Rich text journaling with Markdown support
- 🧠 AI-powered sentiment analysis and intent classification
- 🔗 Semantic matching to connect users with similar thoughts
- 💡 Problem-Solution matching between users
- 💬 Real-time chat with AI "Social Wingman"
- 🎨 Zen-Social minimalist design

## Tech Stack

- **Frontend**: React, Redux, Tailwind CSS, Socket.io-client
- **Backend**: Node.js, Express.js, Socket.io
- **Database**: MongoDB Atlas (with Vector Search)
- **AI**: Hugging Face Inference API, Ollama (localhost), OpenAI (fallback)

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Hugging Face token (recommended)

### Installation

```bash
# Clone and enter directory
cd open-journal

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your API keys

# Run development servers
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for JWT tokens |
| `AI_PROVIDER` | AI backend: `auto`, `ollama`, `huggingface`, `openai` |
| `HF_TOKEN` | Hugging Face API token |
| `HF_PROVIDER` | Inference provider route (default: `auto`) |
| `HF_INTENT_MODEL` | Intent model (default: `microsoft/deberta-v3-large`) |
| `HF_EMBED_MODEL` | Embedding model (default: `BAAI/bge-large-en-v1.5`) |
| `HF_RERANK_MODEL` | Reranker model (default: `BAAI/bge-reranker-large`) |
| `HF_CHAT_MODEL` | Guide/Mediator model (default: `meta-llama/Meta-Llama-3.1-8B-Instruct`) |
| `HF_CHAT_FALLBACK_MODEL` | Chat fallback model when primary unavailable (default: `Qwen/Qwen2.5-7B-Instruct`) |
| `HF_RERANK_FALLBACK_MODEL` | Rerank fallback model (default: `BAAI/bge-reranker-base`) |
| `HF_ASR_MODEL` | Speech-to-text model (default: `openai/whisper-large-v3`) |
| `HF_ASR_PROVIDER` | ASR provider route (default: `hf-inference`) |
| `OLLAMA_URL` | Local Ollama URL (dev/test localhost AI) |
| `OLLAMA_CHAT_MODEL` | Ollama chat model |
| `OLLAMA_EMBED_MODEL` | Ollama embedding model |
| `OPENAI_API_KEY` | OpenAI key (optional fallback) |
| `CLIENT_URL` | Single frontend URL for CORS (backward compatible) |
| `CLIENT_URLS` | Comma-separated allowed frontend origins for CORS/socket (recommended for prod + www) |

### AI Backend Mode

- Local testing: keep localhost AI via Ollama (`AI_PROVIDER=auto` with Ollama running, or force `AI_PROVIDER=ollama`).
- Deployment with Hugging Face: set `AI_PROVIDER=huggingface` and configure `HF_TOKEN`.
- Fallback order in `auto`: Ollama → Hugging Face → OpenAI.

## Project Structure

```
open-journal/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── store/          # Redux store
│   │   ├── services/       # API services
│   │   └── hooks/          # Custom hooks
│   └── package.json
├── server/                 # Node.js backend
│   ├── config/             # Database config
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Auth, error handling
│   ├── models/             # Mongoose schemas
│   ├── routes/             # API routes
│   ├── services/           # Business logic, AI
│   └── package.json
└── package.json            # Root workspace
```

## License

MIT
