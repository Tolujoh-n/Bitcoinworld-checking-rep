const express = require("express");
const axios = require("axios");
const router = express.Router();

// Proxy endpoint for Hiro Stacks API transaction status
// GET /api/stacks/tx/:txId
router.get("/tx/:txId", async (req, res) => {
  const { txId } = req.params;
  try {
    const hiroUrl = `https://api.testnet.hiro.so/extended/v1/tx/${txId}`;
    const response = await axios.get(hiroUrl);
    res.status(200).json(response.data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({
      message: "Failed to fetch transaction status from Hiro API",
      error: err.message,
    });
  }
});

module.exports = router;
