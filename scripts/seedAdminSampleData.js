/* Seed script for creating sample users and posts
   Usage: node scripts/seedAdminSampleData.js
*/
// Allow passing a MongoDB URI via CLI: `--uri "mongodb+srv://..."`
const { connectDB } = require('../config/database');
const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');

const indianNames = [
  'Aarav Sharma','Vivaan Kumar','Arjun Singh','Vihaan Patel','Shaurya Gupta',
  'Anaya Reddy','Mira Iyer','Diya Nair','Ishita Rao','Sneha Kapoor'
];

const sampleUsernames = [
  'aarav_sh','vivaank','arjun_s','vihaanp','shaurya_g',
  'anaya_r','mira_iy','diya_n','ishita_r','sneha_k'
];

const sampleCategories = ['general','events','study','canteen','hostels','lost-found','sports','academics','pgs','staff'];
const sampleTags = ['welcome','helps','notice','food','exam','assignment','sale','lost','found','event'];

function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function pick(arr){ return arr[randInt(0, arr.length-1)]; }

async function run(){
  // If a CLI --uri argument is provided, set it on process.env so connectDB picks it up
  const uriIndex = process.argv.indexOf('--uri');
  if (uriIndex !== -1 && process.argv[uriIndex + 1]) {
    process.env.MONGODB_URI = process.argv[uriIndex + 1];
    console.log('Using MongoDB URI from --uri argument');
  }

  await connectDB();

  // Create users if not present
  const createdUsers = [];
  for(let i=0;i<10;i++){
    const name = indianNames[i];
    const username = sampleUsernames[i];
    const email = `${username}@seed.edu.in`;
    let user = await User.findOne({ email });
    if(!user){
      user = new User({
        name,
        username,
        email,
        password: 'password123',
        isVerified: true,
        avatarSeed: username + '-seed',
        role: 'student',
        campus: 'Main Campus'
      });
      await user.save();
      console.log('Created user', username);
    } else {
      console.log('User exists', username);
    }
    createdUsers.push(user);
  }

  // Create 25 posts distributed among users
  const mediaSamples = [
    // images
    'https://picsum.photos/seed/alpha/900/500',
    'https://picsum.photos/seed/bravo/900/500',
    'https://picsum.photos/seed/charlie/900/500',
    'https://picsum.photos/seed/delta/900/500',
    'https://picsum.photos/seed/echo/900/500',
    // videos (public sample urls)
    'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
    'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_5mb.mp4'
  ];

  const postsToCreate = 25;
  const createdPosts = [];

  for(let i=0;i<postsToCreate;i++){
    const author = createdUsers[randInt(0, createdUsers.length-1)];
    const useMedia = Math.random() < 0.72; // most posts have media
    const isVideo = useMedia && Math.random() < 0.28; // some are videos
    const category = pick(sampleCategories);
    const tags = [ pick(sampleTags), pick(sampleTags) ].filter((v,i,a)=>a.indexOf(v)===i);
    const content = isVideo ? `Check out this clip — ${category} update!` : `Sharing some pics from campus life (#${tags[0]}) — enjoy!`;

    const post = new Post({
      author: author._id,
      category,
      tags,
      content,
      campus: author.campus,
      createdAt: new Date(Date.now() - randInt(0, 14) * 24 * 60 * 60 * 1000 - randInt(0, 23) * 3600000)
    });

    if(useMedia){
      if(isVideo){
        const url = pick(mediaSamples.slice(5));
        post.media.push({ type: 'video', filename: `video-${i}.mp4`, originalName: `video-${i}.mp4`, size: 0, mimetype: 'video/mp4', url });
      } else {
        const url = pick(mediaSamples.slice(0,5)) + `?random=${i}`;
        // images array required structure
        post.images.push({ filename: `img-${i}.jpg`, originalName: `img-${i}.jpg`, size: 0, mimetype: 'image/jpeg', url, storageType: 'local' });
        post.media.push({ type: 'image', filename: `img-${i}.jpg`, originalName: `img-${i}.jpg`, size: 0, mimetype: 'image/jpeg', url });
      }
    }

    await post.save();
    createdPosts.push(post);

    // increment postsCount
    author.stats.postsCount = (author.stats.postsCount || 0) + 1;
    await author.save();

    if(i % 5 === 0) console.log('Created posts', i+1);
  }

  console.log(`Created ${createdUsers.length} users and ${createdPosts.length} posts.`);
  mongoose.connection.close();
}

run().catch(err => { console.error(err); process.exit(1); });
