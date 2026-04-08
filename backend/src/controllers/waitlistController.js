const Waitlist = require('../models/Waitlist');

exports.joinWaitlist = async (req, res) => {
  try {
    const { email, source } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if already exists
    const existing = await Waitlist.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(200).json({ message: "You are already on the EkalGo waitlist! 🚀" });
    }

    const entry = new Waitlist({
      email: email.toLowerCase(),
      source: source || 'web_teaser'
    });

    await entry.save();
    
    // Get total count for FOMO
    const total = await Waitlist.countDocuments();

    res.status(201).json({ 
      message: "Welcome to the EkalGo waitlist! 🌍✨",
      totalCount: total + 1200 // Adding baseline FOMO
    });
  } catch (error) {
    console.error("Waitlist Error:", error.message);
    res.status(500).json({ error: "Something went wrong. Please try again later." });
  }
};

exports.getWaitlistCount = async (req, res) => {
  try {
    const count = await Waitlist.countDocuments();
    res.json({ total: count + 1200 });
  } catch (e) {
    res.json({ total: 1200 });
  }
};
