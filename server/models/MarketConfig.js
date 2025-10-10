const mongoose = require('mongoose');

const marketConfigSchema = new mongoose.Schema(
  {
    paused: {
      type: Boolean,
      default: false,
    },
    lastTx: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MarketConfig', marketConfigSchema);
