// server.js
const express = require("express");
const bodyParser = require("body-parser");
const redis = require("redis");

const app = express();
app.use(bodyParser.json());

// Redis client setup
const redisClient = redis.createClient();
redisClient.connect().catch(console.error);

// In-memory DB
let solvesDB = {};

// Root route
app.get("/", (req, res) => {
  res.send("✅ Solved Problems Tracker API with Redis is running...");
});

// POST /solve → Store a solved problem
app.post("/solve", async (req, res) => {
  const { user_id, problem_id, time } = req.body;

  if (!user_id || !problem_id || !time) {
    return res.status(400).json({ error: "Missing fields" });
  }

  if (!solvesDB[user_id]) solvesDB[user_id] = [];
  solvesDB[user_id].push({ problem_id, time });

  // Update Redis cache for this user
  await redisClient.set(`solves:${user_id}`, JSON.stringify(solvesDB[user_id]));

  res.json({ message: "Problem stored successfully!" });
});

// GET /solves/:user_id → Fetch solved problems with count + cache
app.get("/solves/:user_id", async (req, res) => {
  const { user_id } = req.params;

  try {
    // Check Redis cache first
    const cached = await redisClient.get(`solves:${user_id}`);
    if (cached) {
      return res.json({
        source: "cache",
        count: JSON.parse(cached).length,
        solves: JSON.parse(cached),
      });
    }

    // If not in cache, fetch from in-memory DB
    const solves = solvesDB[user_id] || [];

    // Store in Redis
    await redisClient.set(`solves:${user_id}`, JSON.stringify(solves));

    res.json({
      source: "api",
      count: solves.length,
      solves,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`✅ API running on http://localhost:${PORT}`);
});
