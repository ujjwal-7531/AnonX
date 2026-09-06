require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { performance } = require("perf_hooks");

const API_BASE = process.env.API_BASE || "http://localhost:5000";
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/anonx_db";
const NUM_USERS = 100;
const TOTAL_MESSAGES = 1000;
const CONCURRENCY_LIMIT = 50;

const sampleIV = "a1B2c3D4e5F6";
const sampleCiphertext = "x89Fk2+9aQ==BenchmarkEncryptedE2EEPayload1234567890";

const calculatePercentile = (arr, p) => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

async function runBenchmark() {
  console.log(`\n=================================================`);
  console.log(`🚀 ANONX HIGH-CONCURRENCY LOAD & LATENCY BENCHMARK`);
  console.log(`=================================================`);
  console.log(`👥 Simulated Users : ${NUM_USERS}`);
  console.log(`💬 Total Messages   : ${TOTAL_MESSAGES}`);
  console.log(`⚡ Concurrency      : ${CONCURRENCY_LIMIT} parallel workers`);
  console.log(`🎯 Target API Base  : ${API_BASE}`);
  console.log(`-------------------------------------------------\n`);

  await mongoose.connect(MONGO_URI);
  console.log(`✅ Connected to MongoDB for benchmark data verification`);

  // Step 1: Provision 100 Authenticated Users
  console.log(`\n⏳ Step 1/3: Provisioning & authenticating ${NUM_USERS} concurrent users...`);
  const tStartAuth = performance.now();

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET missing from .env");
  }

  const benchmarkUsers = [];

  for (let i = 0; i < NUM_USERS; i++) {
    const userCode = `BENCH-${1000 + i}`;
    const email = `bench_${i}_${Date.now()}@anonx.bench`;
    
    await mongoose.connection.collection("users").updateOne(
      { userCode },
      {
        $set: {
          email,
          userCode,
          isVerified: true,
          publicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEBenchPublicKeySample==",
          createdAt: new Date(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    const token = jwt.sign({ userCode }, JWT_SECRET, { expiresIn: '7d' });
    benchmarkUsers.push({ userCode, token });
  }

  const tEndAuth = performance.now();
  console.log(`✅ ${NUM_USERS} users provisioned and authenticated in ${(tEndAuth - tStartAuth).toFixed(2)}ms`);

  // Step 2: Establish Conversations
  console.log(`\n⏳ Step 2/3: Establishing search & conversation links between user pairs...`);
  const conversations = [];
  const convLatencies = [];

  const numPairs = NUM_USERS / 2; // 50 pairs
  for (let i = 0; i < numPairs; i++) {
    const userA = benchmarkUsers[i * 2];
    const userB = benchmarkUsers[i * 2 + 1];

    const t0 = performance.now();
    const res = await fetch(`${API_BASE}/users/search/${userB.userCode}`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${userA.token}`,
        "x-benchmark-key": "anonx-bench"
      }
    });
    const data = await res.json();
    const t1 = performance.now();
    convLatencies.push(t1 - t0);

    conversations.push({
      conversationId: data.conversationId,
      senderToken: userA.token,
      senderCode: userA.userCode,
      receiverCode: userB.userCode
    });
  }

  console.log(`✅ ${numPairs} conversation channels established.`);

  // Step 3: High-Concurrency Load Test (1,000 Messages)
  console.log(`\n⏳ Step 3/3: Executing high-concurrency load test (${TOTAL_MESSAGES} E2EE encrypted messages)...`);

  const msgLatencies = [];
  let successfulRequests = 0;
  let failedRequests = 0;

  const sendSingleMessage = async (msgIndex) => {
    const targetConv = conversations[msgIndex % conversations.length];
    const t0 = performance.now();
    try {
      const res = await fetch(`${API_BASE}/messages/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${targetConv.senderToken}`,
          "x-benchmark-key": "anonx-bench"
        },
        body: JSON.stringify({
          conversationId: targetConv.conversationId,
          messageText: `${sampleCiphertext}_${msgIndex}`,
          iv: sampleIV
        })
      });
      const t1 = performance.now();
      if (res.status === 201) {
        successfulRequests++;
        msgLatencies.push(t1 - t0);
      } else {
        failedRequests++;
      }
    } catch (err) {
      failedRequests++;
    }
  };

  const tStartLoad = performance.now();

  // Execute in batches matching CONCURRENCY_LIMIT
  for (let i = 0; i < TOTAL_MESSAGES; i += CONCURRENCY_LIMIT) {
    const batch = [];
    const currentBatchSize = Math.min(CONCURRENCY_LIMIT, TOTAL_MESSAGES - i);
    for (let j = 0; j < currentBatchSize; j++) {
      batch.push(sendSingleMessage(i + j));
    }
    await Promise.all(batch);
  }

  const tEndLoad = performance.now();
  const totalTimeSec = (tEndLoad - tStartLoad) / 1000;
  const requestsPerSec = (successfulRequests / totalTimeSec).toFixed(2);

  // Calculate Metrics
  const avgLatency = msgLatencies.length ? (msgLatencies.reduce((a, b) => a + b, 0) / msgLatencies.length).toFixed(2) : "0";
  const minLatency = Math.min(...msgLatencies).toFixed(2);
  const maxLatency = Math.max(...msgLatencies).toFixed(2);
  const p50 = calculatePercentile(msgLatencies, 50).toFixed(2);
  const p90 = calculatePercentile(msgLatencies, 90).toFixed(2);
  const p95 = calculatePercentile(msgLatencies, 95).toFixed(2);
  const p99 = calculatePercentile(msgLatencies, 99).toFixed(2);

  console.log(`\n=================================================`);
  console.log(`📊 BENCHMARK RESULTS SUMMARY`);
  console.log(`=================================================`);
  console.log(`✅ Successful Requests : ${successfulRequests} / ${TOTAL_MESSAGES} (${((successfulRequests / TOTAL_MESSAGES) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed Requests     : ${failedRequests}`);
  console.log(`⏱️  Total Duration     : ${totalTimeSec.toFixed(2)} seconds`);
  console.log(`⚡ Throughput (RPS)    : ${requestsPerSec} requests/sec`);
  console.log(`-------------------------------------------------`);
  console.log(`📈 LATENCY METRICS:`);
  console.log(`  • Average Latency : ${avgLatency} ms`);
  console.log(`  • Min Latency     : ${minLatency} ms`);
  console.log(`  • Max Latency     : ${maxLatency} ms`);
  console.log(`  • P50 (Median)    : ${p50} ms`);
  console.log(`  • P90             : ${p90} ms`);
  console.log(`  • P95             : ${p95} ms`);
  console.log(`  • P99             : ${p99} ms`);
  console.log(`=================================================\n`);

  // Cleanup benchmark test users & messages
  console.log(`🧹 Cleaning up benchmark temporary data...`);
  await mongoose.connection.collection("users").deleteMany({ userCode: { $regex: /^BENCH-/ } });
  await mongoose.connection.collection("conversations").deleteMany({ userA: { $regex: /^BENCH-/ } });
  await mongoose.connection.collection("messages").deleteMany({ messageText: { $regex: /^x89Fk2\+9aQ==Benchmark/ } });
  await mongoose.disconnect();
  console.log(`✅ Cleanup completed cleanly!\n`);
}

runBenchmark().catch((err) => {
  console.error("Benchmark error:", err);
  mongoose.disconnect();
});
