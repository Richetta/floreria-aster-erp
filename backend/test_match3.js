import bcrypt from 'bcrypt';
async function testMatch() {
  const hash = '$2b$10$Well8iC7rh8oHXf5qd54CefuFjjd86Rl0DKwxQ4E6s7pYcxcZ9YXi';
  const isMatch = await bcrypt.compare('admin', hash);
  console.log('Match?', isMatch);
}
testMatch();
