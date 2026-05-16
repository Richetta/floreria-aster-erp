import bcrypt from 'bcrypt';
async function testMatch() {
  const hash = '$2b$10$rD/vMwS0y4DJiXKfabu1.ezLYHzWvE85.FEMlIuItE8XTh5tYBDAi';
  const isMatch = await bcrypt.compare('admin', hash);
  console.log('Match?', isMatch);
}
testMatch();
