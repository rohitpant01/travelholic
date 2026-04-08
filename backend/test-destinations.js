require('dotenv').config();
const { generateDestinations } = require('./src/controllers/aiController');

const req = {
  body: {
    user_interests: "history, local food, peaceful",
    region: "Rajasthan",
    travel_style: "backpacking",
    user_location: "Delhi",
    previous_places: []
  }
};

const res = {
  json: function(data) {
    console.log("SUCCESS! Got data:", JSON.stringify(data, null, 2));
  },
  status: function(code) {
    console.log("STATUS CODE:", code);
    return this;
  }
};

async function test() {
  console.log("Testing generateDestinations...");
  try {
    await generateDestinations(req, res);
  } catch (error) {
    console.error("Test execution failed:", error.stack || error);
  }
}

test();
