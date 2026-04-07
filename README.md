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
- **AI**: OpenAI GPT-4o, Voyage AI embeddings

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- OpenAI API key
- Voyage AI API key (optional, can use OpenAI embeddings)

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
| `OPENAI_API_KEY` | OpenAI API key |
| `VOYAGE_API_KEY` | Voyage AI API key |
| `CLIENT_URL` | Frontend URL for CORS |

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
