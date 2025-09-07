const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/campus_connect')
.then(async () => {
  console.log('Connected to MongoDB');

  // Find user deadshot
  const user = await User.findOne({ username: 'deadshot' });
  if (user) {
    console.log('Found user deadshot');
    console.log('Current avatar type:', user.avatarType);
    console.log('Current avatar data:', user.avatar ? 'Present' : 'Not present');

    // If user has upload type but no avatar data, fix it
    if (user.avatarType === 'upload' && !user.avatar) {
      console.log('Fixing avatar for user deadshot...');

      // Generate a random API avatar instead since upload data is lost
      const crypto = require('crypto');
      const newSeed = crypto.randomBytes(8).toString('hex');

      await User.findByIdAndUpdate(user._id, {
        avatarType: 'api',
        avatarSeed: newSeed,
        $unset: { avatar: 1 }  // Remove the old avatar field
      });

      console.log('Fixed! User now has API avatar with seed:', newSeed);
    } else {
      console.log('User avatar is already in correct state');
    }
  } else {
    console.log('User deadshot not found');
  }

  process.exit(0);
})
.catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
