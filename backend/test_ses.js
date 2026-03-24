require('dotenv').config();
const { sendEmailOTP } = require('./src/utils/email');

async function test() {
  console.log('Testing SES...');
  try {
    const res = await sendEmailOTP('rohitpantrp02@gmail.com', '123456');
    console.log('Test Success:', res);
  } catch (err) {
    console.error('Test Failed:', err.message);
  }
}

test();
