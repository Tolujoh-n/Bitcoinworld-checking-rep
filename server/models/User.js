const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  walletAddress: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  password: {
    type: String,
    required: false,
    minlength: 6
  },
  avatar: {
    type: String,
    default: ''
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  balance: {
    type: Number,
    default: 1000 // Starting balance
  },
  totalTrades: {
    type: Number,
    default: 0
  },
  successfulTrades: {
    type: Number,
    default: 0
  },
  savedPolls: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Poll'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure at least one of email or walletAddress is provided
userSchema.pre('save', function(next) {
  if (!this.email && !this.walletAddress) {
    return next(new Error('Either email or wallet address is required'));
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate username if not provided
userSchema.pre('save', function(next) {
  if (!this.username) {
    const identifier = this.email || this.walletAddress;
    this.username = `user_${identifier.slice(0, 8)}_${Date.now().toString(36)}`;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
