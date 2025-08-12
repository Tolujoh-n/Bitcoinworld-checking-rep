# BitcoinWorld - Prediction Marketplace

BitcoinWorld is a comprehensive prediction marketplace platform built with React, Node.js, Express, and MongoDB. It allows users to create, trade, and participate in prediction markets across various categories including Politics, Crypto, Tech, Sports, and more.

## 🚀 Features

### Core Features
- **Prediction Markets**: Create and trade on future events
- **Real-time Trading**: Live order book and trade execution
- **Multiple Categories**: Politics, Crypto, Tech, Sports, Economy, World, etc.
- **User Authentication**: Email or wallet address login
- **Dark/Light Mode**: Toggle between themes
- **Responsive Design**: Works on desktop and mobile devices

### Trading Features
- **Buy/Sell Orders**: Market and limit orders
- **Order Book**: Real-time bid/ask display
- **Portfolio Management**: Track positions and P&L
- **Trade History**: Complete transaction records
- **Balance Management**: Virtual currency system

### Social Features
- **Comments System**: Discuss polls with other users
- **Save Polls**: Bookmark interesting predictions
- **User Profiles**: Public profiles with trading stats
- **Trending Polls**: Discover popular markets

### Admin Features
- **Poll Management**: Create, edit, and resolve polls
- **User Management**: Monitor and manage users
- **Content Moderation**: Flag and moderate comments
- **Analytics Dashboard**: Platform statistics

## 🛠️ Tech Stack

### Frontend
- **React 18**: Modern React with hooks
- **Tailwind CSS**: Utility-first CSS framework
- **React Query**: Server state management
- **React Router**: Client-side routing
- **Axios**: HTTP client
- **React Icons**: Icon library
- **Framer Motion**: Animations
- **React Hot Toast**: Notifications

### Backend
- **Node.js**: JavaScript runtime
- **Express.js**: Web framework
- **MongoDB**: NoSQL database
- **Mongoose**: MongoDB ODM
- **JWT**: Authentication
- **bcryptjs**: Password hashing
- **Socket.io**: Real-time communication
- **Helmet**: Security middleware

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bitcoinworld
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd server
   npm install
   
   # Install frontend dependencies
   cd ../client
   npm install
   ```

3. **Environment Configuration**
   ```bash
   # Copy environment example
   cd ../server
   cp env.example .env
   ```

   Edit `.env` file:
   ```env
   MONGODB_URI=mongodb://localhost:27017/bitcoinworld
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   PORT=5000
   NODE_ENV=development
   CLIENT_URL=http://localhost:3000
   ```

4. **Start MongoDB**
   ```bash
   # Start MongoDB service
   mongod
   ```

5. **Populate Database**
   ```bash
   cd server
   npm run populate
   ```

6. **Start Development Servers**
   ```bash
   # From root directory
   npm run dev
   ```

   This will start:
   - Backend server on http://localhost:5000
   - Frontend server on http://localhost:3000

## 🗄️ Database Schema

### Users
```javascript
{
  email: String,
  walletAddress: String,
  username: String,
  password: String,
  balance: Number,
  isAdmin: Boolean,
  totalTrades: Number,
  successfulTrades: Number,
  savedPolls: [PollId]
}
```

### Polls
```javascript
{
  title: String,
  description: String,
  category: String,
  subCategory: String,
  options: [{
    text: String,
    percentage: Number,
    totalVolume: Number,
    totalTrades: Number
  }],
  endDate: Date,
  isActive: Boolean,
  isResolved: Boolean,
  totalVolume: Number,
  totalTrades: Number,
  createdBy: UserId
}
```

### Trades
```javascript
{
  poll: PollId,
  user: UserId,
  type: 'buy' | 'sell',
  optionIndex: Number,
  amount: Number,
  price: Number,
  status: 'pending' | 'completed' | 'cancelled',
  orderType: 'market' | 'limit'
}
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/logout` - Logout user

### Polls
- `GET /api/polls` - Get all polls with filters
- `GET /api/polls/:id` - Get single poll
- `POST /api/polls` - Create new poll
- `PUT /api/polls/:id` - Update poll
- `DELETE /api/polls/:id` - Delete poll
- `POST /api/polls/:id/save` - Save/unsave poll
- `GET /api/polls/trending` - Get trending polls
- `GET /api/polls/categories` - Get categories

### Trading
- `POST /api/trades` - Create trade
- `GET /api/trades/poll/:pollId` - Get poll trades
- `GET /api/trades/user` - Get user trades
- `GET /api/trades/orderbook/:pollId/:optionIndex` - Get order book
- `DELETE /api/trades/:id` - Cancel trade

### Comments
- `GET /api/comments/poll/:pollId` - Get poll comments
- `POST /api/comments` - Create comment
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment
- `POST /api/comments/:id/like` - Like comment
- `POST /api/comments/:id/dislike` - Dislike comment

### Admin
- `GET /api/admin/dashboard` - Admin dashboard stats
- `GET /api/admin/polls` - Manage polls
- `PUT /api/admin/polls/:id` - Update poll as admin
- `DELETE /api/admin/polls/:id` - Delete poll as admin
- `POST /api/admin/polls/:id/resolve` - Resolve poll
- `GET /api/admin/users` - Manage users
- `GET /api/admin/trades` - Monitor trades
- `GET /api/admin/comments` - Moderate comments

## 🎨 UI Components

### Layout Components
- `Navbar` - Main navigation with search and auth
- `Footer` - Site footer with links
- `Layout` - Main layout wrapper

### Poll Components
- `PollCard` - Display poll information
- `PollDetail` - Detailed poll view
- `PollForm` - Create/edit poll form
- `TradingPanel` - Buy/sell interface
- `OrderBook` - Real-time order book

### Common Components
- `LoadingSpinner` - Loading indicator
- `AuthModal` - Login/signup modal
- `SearchModal` - Search interface
- `ProtectedRoute` - Route protection

## 🚀 Deployment

### Production Build
```bash
# Build frontend
cd client
npm run build

# Start production server
cd ../server
npm start
```

### Environment Variables (Production)
```env
MONGODB_URI=your-production-mongodb-uri
JWT_SECRET=your-production-jwt-secret
NODE_ENV=production
CLIENT_URL=your-frontend-url
PORT=5000
```

## 📱 Mobile Responsiveness

The application is fully responsive and optimized for:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (320px - 767px)

## 🔒 Security Features

- JWT authentication
- Password hashing with bcrypt
- CORS protection
- Rate limiting
- Input validation
- XSS protection with Helmet
- Secure headers

## 🧪 Testing

```bash
# Run frontend tests
cd client
npm test

# Run backend tests
cd ../server
npm test
```

## 📊 Performance

- Lazy loading of components
- React Query for caching
- Optimized images
- Code splitting
- Bundle optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Contact: support@bitcoinworld.com

## 🗺️ Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced charting
- [ ] Social features (following, notifications)
- [ ] API rate limiting
- [ ] Advanced analytics
- [ ] Multi-language support
- [ ] Blockchain integration
- [ ] Real cryptocurrency trading

---

**BitcoinWorld** - Trade the Future with Confidence
