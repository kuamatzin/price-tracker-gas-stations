#!/usr/bin/env node

/**
 * DeepSeek API Test Script
 *
 * This script tests the DeepSeek API connection and Spanish language processing
 *
 * Usage:
 * 1. Set your API key: export DEEPSEEK_API_KEY=your_key_here
 * 2. Run: node test-deepseek.js
 */

const https = require("https");

// Configuration
const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = "api.deepseek.com";
const MODEL = "deepseek-chat";

if (!API_KEY) {
  console.error("❌ Error: DEEPSEEK_API_KEY environment variable not set");
  console.log("Set it with: export DEEPSEEK_API_KEY=your_key_here");
  process.exit(1);
}

// Test messages in Spanish
const testMessages = [
  {
    role: "system",
    content:
      "Eres un asistente experto en análisis de precios de gasolina en México. Responde en español.",
  },
  {
    role: "user",
    content:
      "Analiza este cambio de precio: La gasolina regular subió de $21.50 a $22.30 en Puebla. ¿Es significativo?",
  },
];

// Make API request
function testDeepSeekAPI() {
  const data = JSON.stringify({
    model: MODEL,
    messages: testMessages,
    temperature: 0.7,
    max_tokens: 500,
  });

  const options = {
    hostname: API_URL,
    port: 443,
    path: "/v1/chat/completions",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      "Content-Length": data.length,
    },
  };

  console.log("🚀 Testing DeepSeek API...\n");
  console.log("📝 Sending message:", testMessages[1].content);
  console.log("\n⏳ Waiting for response...\n");

  const req = https.request(options, (res) => {
    let responseData = "";

    res.on("data", (chunk) => {
      responseData += chunk;
    });

    res.on("end", () => {
      try {
        const response = JSON.parse(responseData);

        if (res.statusCode === 200) {
          console.log("✅ Success! API is working\n");
          console.log("🤖 DeepSeek Response:");
          console.log("━".repeat(50));
          console.log(response.choices[0].message.content);
          console.log("━".repeat(50));
          console.log("\n📊 Usage Statistics:");
          console.log(`- Prompt tokens: ${response.usage.prompt_tokens}`);
          console.log(
            `- Completion tokens: ${response.usage.completion_tokens}`,
          );
          console.log(`- Total tokens: ${response.usage.total_tokens}`);

          // Estimate cost (example rates)
          const estimatedCost = (response.usage.total_tokens / 1000) * 0.001;
          console.log(`- Estimated cost: $${estimatedCost.toFixed(6)}`);

          console.log("\n✅ DeepSeek API is configured correctly!");
          console.log("Add this to your .env file:");
          console.log(`DEEPSEEK_API_KEY=${API_KEY.substring(0, 10)}...`);
        } else {
          console.error("❌ Error:", res.statusCode, res.statusMessage);
          console.error("Response:", response);

          if (res.statusCode === 401) {
            console.log("\n🔑 Invalid API key. Please check your key.");
          } else if (res.statusCode === 429) {
            console.log(
              "\n⚠️ Rate limit exceeded. Wait a moment and try again.",
            );
          }
        }
      } catch (error) {
        console.error("❌ Failed to parse response:", error.message);
        console.error("Raw response:", responseData);
      }
    });
  });

  req.on("error", (error) => {
    console.error("❌ Request failed:", error.message);
    console.log("\nTroubleshooting:");
    console.log("1. Check your internet connection");
    console.log("2. Verify the API key is correct");
    console.log("3. Try again in a few moments");
  });

  req.write(data);
  req.end();
}

// Additional test for price analysis
function testPriceAnalysis() {
  const priceAnalysisMessages = [
    {
      role: "system",
      content:
        "Analiza cambios de precios de gasolina y proporciona insights útiles en español.",
    },
    {
      role: "user",
      content: JSON.stringify({
        estacion: "Pemex Centro Puebla",
        cambios: [
          { fecha: "2024-01-15", regular: 21.5, premium: 23.2, diesel: 22.8 },
          { fecha: "2024-01-16", regular: 22.3, premium: 23.2, diesel: 22.8 },
        ],
        pregunta: "¿Cuál es el impacto para un conductor promedio?",
      }),
    },
  ];

  // You can implement this similar to testDeepSeekAPI
  console.log("\n📈 Price analysis test prepared (not executed)");
}

// Run the test
console.log("=".repeat(60));
console.log("DeepSeek API Test for FuelIntel");
console.log("=".repeat(60) + "\n");

testDeepSeekAPI();

// Export for use in other scripts
module.exports = { testDeepSeekAPI, testPriceAnalysis };
