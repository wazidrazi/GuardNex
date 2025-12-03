# GuardNex - Advanced Multilingual Spam Detection Platform

Spam attacks just keep getting smarter. They jump between languages and platforms, trying to sneak past the usual filters. That’s where GuardNex comes in. It’s a spam detection system that handles English, Spanish, and Bangla—and it doesn’t care if the spam lands in texts, emails, or WhatsApp chats.

GuardNex runs on a machine learning setup that uses TF-IDF to pull out the important features from messages. Then it hands those over to a Naive Bayes classifier, which is fast, scales well, and really shines with high-dimensional text data. We trained and tested GuardNex using multilingual datasets that actually capture the messy, real-world ways people write—typos, slang, whatever platform quirks they throw in.

The results speak for themselves: GuardNex nails about 92% accuracy, holding its own or even beating other systems out there. What’s striking is that you don’t need a heavyweight model—combine smart preprocessing with a solid, language-aware approach, and you get strong spam detection across all kinds of channels.

Bottom line, GuardNex gives organizations a straightforward and adaptable way to keep spam under control, no matter the language or platform.

## 🎯 Features

- **Multi-Channel Detection**: Intelligent spam filtering for Email, SMS, and Social Media messages
- **ML-Powered Classification**: Advanced algorithms using TF-IDF vectorization and Naive Bayes for high accuracy
- **Secure Authentication**: JWT-based authentication with role-based access control (RBAC)
- **Admin Dashboard**: Comprehensive management interface for user administration and message analytics
- **Message History**: Complete audit logs of analyzed messages with metadata
- **Responsive Design**: Modern, mobile-first UI with Tailwind CSS
- **Real-Time Processing**: Instant spam detection and classification
- **Scalable Architecture**: Cloud-ready deployment with PostgreSQL backend

## 🏗️ Tech Stack

### Frontend

- **React.js** - Modern UI library with hooks and functional components
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **React Router** - Client-side routing for seamless navigation
- **Axios** - Promise-based HTTP client for API communication
- **Vite** - Next-generation frontend build tool for fast development
- **JWT** - Secure token-based authentication

### Backend

- **Python Flask** - Lightweight, flexible web framework
- **Scikit-learn** - Machine learning library for TF-IDF and Naive Bayes models
- **PostgreSQL** - Robust relational database (via Neon Cloud)
- **PyJWT** - JSON Web Token implementation for secure authentication
- **SQLAlchemy** - ORM for database interactions

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v14+) - [Download](https://nodejs.org/)
- **Python** (v3.8+) - [Download](https://www.python.org/)
- **PostgreSQL** - Local or cloud-based (Neon Cloud recommended)
- **Git** - Version control

### Frontend Setup

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Create environment configuration:**

   ```bash
   # Create .env file
   echo VITE_API_URL=http://localhost:5000/api > .env
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

### Backend Setup

1. **Navigate to backend directory:**

   ```bash
   cd backend
   ```

2. **Create and activate virtual environment:**

   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # macOS/Linux
   python -m venv venv
   source venv/bin/activate
   ```

3. **Install Python dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   Create a `.env` file in the backend directory:

   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/spam_shield
   SECRET_KEY=your-super-secret-key-change-in-production
   FLASK_ENV=development
   PORT=5000
   ```

5. **Initialize database:**
   ```bash
   python app.py
   ```

## 📊 Project Structure

```
GuardNex/
├── src/                    # Frontend React application
│   ├── components/         # Reusable React components
│   ├── pages/             # Page components
│   ├── styles/            # Global styles
│   └── utils/             # Helper functions
├── backend/               # Flask backend application
│   ├── models/            # Database models
│   ├── routes/            # API endpoints
│   ├── ml_models/         # ML models and training scripts
│   ├── datasets/          # Training datasets
│   └── app.py             # Flask entry point
├── public/                # Static assets
├── package.json           # Frontend dependencies
├── vite.config.js         # Vite configuration
└── README.md              # This file
```

## 🔐 Security

- JWT tokens with configurable expiration
- Password hashing with bcrypt
- CORS configuration for secure cross-origin requests
- Input validation and sanitization
- SQL injection protection via SQLAlchemy ORM
- Secure HTTP headers

## 📈 Deployment

### Frontend Deployment (Netlify/Vercel)

1. **Build production bundle:**

   ```bash
   npm run build
   ```

2. **Deploy to Netlify:**

   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   ```

3. **Or deploy to Vercel:**
   ```bash
   npm install -g vercel
   vercel --prod
   ```

### Backend Deployment (Render/Railway)

1. **Push code to GitHub repository**

2. **On Render/Railway:**

   - Connect your GitHub repository
   - Build command: `pip install -r requirements.txt`
   - Start command: `gunicorn app:app`
   - Add environment variables (DATABASE_URL, SECRET_KEY, etc.)

3. **Database Setup:**
   - Create PostgreSQL instance on Neon Cloud
   - Update `DATABASE_URL` in deployment environment

### Environment Configuration for Production

```env
FLASK_ENV=production
DEBUG=False
SECRET_KEY=your-production-secret-key
DATABASE_URL=your-production-db-url
CORS_ORIGINS=https://yourdomain.com
```

## 👤 Default Admin Account

For initial setup and testing:

- **Email:** admin@example.com
- **Password:** admin123

⚠️ **Important:** Change the default password immediately in production!

## 🔧 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Messages

- `POST /api/messages/detect` - Analyze message for spam
- `GET /api/messages/history` - Get user message history
- `DELETE /api/messages/:id` - Delete message record

### Admin

- `GET /api/admin/users` - List all users
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user

## 📝 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues, questions, or suggestions, please open an issue on the GitHub repository.

---

**Last Updated:** November 17, 2025
