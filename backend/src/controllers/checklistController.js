const Checklist = require('../models/Checklist');

// Smart Suggestions Data
const SUGGESTIONS = {
  General: [
    { title: 'Toothbrush & Paste', category: 'Toiletries' },
    { title: 'Deodorant', category: 'Toiletries' },
    { title: 'Phone Charger', category: 'Electronics' },
    { title: 'Power Bank', category: 'Electronics' },
    { title: 'Underwear & Socks', category: 'Clothing' },
    { title: 'Cash & Cards', category: 'Essentials' },
  ],
  Beach: [
    { title: 'Sunscreen', category: 'Essentials' },
    { title: 'Swimwear', category: 'Clothing' },
    { title: 'Sunglasses', category: 'Essentials' },
    { title: 'Beach Towel', category: 'Essentials' },
    { title: 'Flip Flops', category: 'Clothing' },
    { title: 'Waterproof Phone Case', category: 'Electronics' },
  ],
  Trek: [
    { title: 'Trekking Shoes', category: 'Clothing' },
    { title: 'Reusable Water Bottle', category: 'Essentials' },
    { title: 'Flashlight/Headlamp', category: 'Electronics' },
    { title: 'First Aid Kit', category: 'Essentials' },
    { title: 'Rain Jacket', category: 'Clothing' },
    { title: 'Energy Bars', category: 'Essentials' },
  ],
  International: [
    { title: 'Passport', category: 'Documents' },
    { title: 'Universal Adapter', category: 'Electronics' },
    { title: 'Travel Insurance Documents', category: 'Documents' },
    { title: 'Visa/e-Visa Printouts', category: 'Documents' },
    { title: 'Foreign Currency', category: 'Essentials' },
  ],
  Business: [
    { title: 'Laptop & Charger', category: 'Electronics' },
    { title: 'Formal Attire', category: 'Clothing' },
    { title: 'Business Cards', category: 'Essentials' },
    { title: 'Notebook & Pen', category: 'Essentials' },
  ],
};

// @desc    Get all checklists for a user
// @route   GET /api/checklists
// @access  Private
exports.getChecklists = async (req, res) => {
  try {
    const checklists = await Checklist.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, count: checklists.length, data: checklists });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Create a new checklist
// @route   POST /api/checklists
// @access  Private
exports.createChecklist = async (req, res) => {
  try {
    const { title, tripId, tripType, autoSuggest } = req.body;

    let items = req.body.items || [];

    // Add smart suggestions if requested and list is empty
    if (autoSuggest && items.length === 0 && SUGGESTIONS[tripType]) {
      items = SUGGESTIONS[tripType].map(item => ({ ...item, isCompleted: false }));
    }

    const checklist = await Checklist.create({
      user: req.user._id,
      trip: tripId || null,
      title,
      tripType,
      items,
    });

    res.status(201).json({ success: true, data: checklist });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Get a single checklist
// @route   GET /api/checklists/:id
// @access  Private
exports.getChecklist = async (req, res) => {
  try {
    const checklist = await Checklist.findOne({ _id: req.params.id, user: req.user._id });

    if (!checklist) {
      return res.status(404).json({ success: false, error: 'Checklist not found' });
    }

    res.status(200).json({ success: true, data: checklist });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Update a checklist
// @route   PUT /api/checklists/:id
// @access  Private
exports.updateChecklist = async (req, res) => {
  try {
    let checklist = await Checklist.findOne({ _id: req.params.id, user: req.user._id });

    if (!checklist) {
      return res.status(404).json({ success: false, error: 'Checklist not found' });
    }

    checklist = await Checklist.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, data: checklist });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Duplicate a checklist
// @route   POST /api/checklists/:id/duplicate
// @access  Private
exports.duplicateChecklist = async (req, res) => {
  try {
    const original = await Checklist.findOne({ _id: req.params.id, user: req.user._id });
    if (!original) return res.status(404).json({ success: false, error: 'Checklist not found' });

    const duplicated = await Checklist.create({
      user: req.user._id,
      title: `${original.title} (Copy)`,
      tripType: original.tripType,
      items: original.items.map(item => ({
        title: item.title,
        category: item.category,
        isCompleted: false
      })),
    });

    res.status(201).json({ success: true, data: duplicated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

// @desc    Delete a checklist
// @route   DELETE /api/checklists/:id
// @access  Private
exports.deleteChecklist = async (req, res) => {
  try {
    const checklist = await Checklist.findOne({ _id: req.params.id, user: req.user._id });

    if (!checklist) {
      return res.status(404).json({ success: false, error: 'Checklist not found' });
    }

    await checklist.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// @desc    Toggle a checklist item
// @route   PATCH /api/checklists/:id/toggle-item
// @access  Private
exports.toggleItem = async (req, res) => {
  try {
    const { itemId } = req.body;
    const checklist = await Checklist.findOne({ _id: req.params.id, user: req.user._id });

    if (!checklist) {
      return res.status(404).json({ success: false, error: 'Checklist not found' });
    }

    const item = checklist.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    item.isCompleted = !item.isCompleted;
    await checklist.save();

    res.status(200).json({ success: true, data: checklist });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

