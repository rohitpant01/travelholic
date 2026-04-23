#!/usr/bin/env node

/**
 * Seed Superadmin Script
 * 
 * Creates the initial superadmin user or promotes an existing user.
 * Run this ONCE in production to bootstrap admin access.
 * 
 * Usage:
 *   node scripts/seedSuperadmin.js --email admin@ekalgo.com --password SecureP@ss123
 *   node scripts/seedSuperadmin.js --promote existing@email.com
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const connectDB = require('../src/config/db');

const args = process.argv.slice(2);

const getArg = (flag) => {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
};

const run = async () => {
  try {
    await connectDB();
    console.log('📦 Connected to MongoDB');

    // Mode 1: Promote existing user
    const promoteEmail = getArg('--promote');
    if (promoteEmail) {
      const user = await User.findOne({ email: promoteEmail.toLowerCase() });
      if (!user) {
        console.error(`❌ No user found with email: ${promoteEmail}`);
        process.exit(1);
      }

      user.role = 'superadmin';
      await user.save({ validateBeforeSave: false });
      console.log(`✅ User "${user.firstName} ${user.lastName}" (${user.email}) promoted to superadmin`);
      process.exit(0);
    }

    // Mode 2: Create new superadmin
    const email = getArg('--email');
    const password = getArg('--password');

    if (!email || !password) {
      console.error('Usage:');
      console.error('  Create new:  node scripts/seedSuperadmin.js --email admin@ekalgo.com --password SecureP@ss123');
      console.error('  Promote:     node scripts/seedSuperadmin.js --promote existing@email.com');
      process.exit(1);
    }

    // Check if already exists
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.role === 'superadmin') {
        console.log(`ℹ️  User ${email} is already a superadmin.`);
      } else {
        existing.role = 'superadmin';
        await existing.save({ validateBeforeSave: false });
        console.log(`✅ Existing user "${existing.firstName}" promoted to superadmin`);
      }
      process.exit(0);
    }

    // Create new superadmin user
    const superadmin = await User.create({
      firstName: 'Super',
      lastName: 'Admin',
      username: `superadmin_${Date.now()}`,
      email: email.toLowerCase(),
      phone: `+91${Date.now().toString().slice(-10)}`,
      password,
      role: 'superadmin',
      isEmailVerified: true,
      isPhoneVerified: true,
      profileComplete: true,
      registrationStep: 9,
    });

    console.log(`✅ Superadmin created successfully!`);
    console.log(`   ID:    ${superadmin._id}`);
    console.log(`   Email: ${superadmin.email}`);
    console.log(`   Role:  ${superadmin.role}`);
    console.log(`\n⚠️  Store credentials securely. Delete this script in production.`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  }
};

run();
