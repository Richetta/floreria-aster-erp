import bcrypt from 'bcrypt';
async function testMatch() {
  const hash = '$2b$10$rH0zGzJvzJvzJvzJvzJvzOYvzJvzJvzJvzJvzJvzJvzJvzJvzJvz';
  const isMatch = await bcrypt.compare('admin', hash);
  console.log('Match?', isMatch);
}
testMatch();
