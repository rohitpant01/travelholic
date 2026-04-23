require('dotenv').config();
const jwt = require('jsonwebtoken');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');

(async () => {
  await connectDB();

  // Get superadmin
  const admin = await User.findOne({ email: 'rohitpant2815@gmail.com' });
  if (!admin) { console.log('No admin found'); process.exit(1); }

  // Get a regular user (non-admin)
  const normalUser = await User.findOne({ role: 'user' });

  // Generate tokens
  const adminToken = jwt.sign(
    { userId: admin._id, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const userToken = normalUser
    ? jwt.sign({ userId: normalUser._id, role: 'user' }, process.env.JWT_SECRET, { expiresIn: '1h' })
    : 'NO_REGULAR_USER_FOUND';

  console.log('ADMIN_TOKEN=' + adminToken);
  console.log('USER_TOKEN=' + userToken);
  console.log('ADMIN_ROLE=' + admin.role);
  process.exit(0);
})();
