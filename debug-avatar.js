const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/campus_connect')
.then(async () => {
  console.log('Connected to MongoDB');

  // Find user deadshot
  const user = await User.findOne({ username: 'deadshot' });
  if (user) {
    console.log('Found user deadshot');
    console.log('Avatar type:', user.avatarType);
    console.log('Avatar data exists:', !!user.avatar);
    console.log('Avatar data type:', user.avatar ? typeof user.avatar : 'N/A');

    if (user.avatar) {
      console.log('Avatar content type:', user.avatar.contentType);
      console.log('Avatar data size:', user.avatar.data ? user.avatar.data.length : 'No data buffer');
      console.log('Avatar data type:', user.avatar.data ? typeof user.avatar.data : 'N/A');
    }

    // Test the avatarUrl virtual
    console.log('Avatar URL virtual:', user.avatarUrl);
  } else {
    console.log('User deadshot not found');
  }

  process.exit(0);
})
.catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
