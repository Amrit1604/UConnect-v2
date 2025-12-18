const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const { getFileStream, saveBufferToGridFS } = require('./gridfs');

/**
 * Transcode a GridFS-stored file (by id) to mp4 using ffmpeg CLI.
 * Returns the new GridFS ObjectId for the mp4 file or throws.
 */
async function transcodeGridFsToMp4(gridFsId, options = {}) {
  if (!gridFsId) throw new Error('gridFsId required');

  // Ensure ffmpeg is available
  try {
    await checkFfmpeg();
  } catch (e) {
    throw new Error('ffmpeg not available on PATH: ' + e.message);
  }

  // Create temp files
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uconnect-transcode-'));
  const inFile = path.join(tmpDir, 'infile');
  const outFile = path.join(tmpDir, 'out.mp4');

  // Download GridFS file into infile
  await new Promise((resolve, reject) => {
    const stream = getFileStream(gridFsId);
    const ws = fs.createWriteStream(inFile);
    stream.on('error', (err) => reject(err));
    ws.on('error', (err) => reject(err));
    ws.on('finish', () => resolve());
    stream.pipe(ws);
  });

  // Run ffmpeg to transcode to mp4 (H.264 AAC)
  await new Promise((resolve, reject) => {
    // Example ffmpeg args: -i infile -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k out.mp4
    const args = ['-y', '-i', inFile, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '128k', outFile];
    const ff = spawn('ffmpeg', args, { stdio: 'inherit' });
    ff.on('error', (err) => reject(err));
    ff.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error('ffmpeg exited with code ' + code));
    });
  });

  // Read outFile into buffer
  const buffer = fs.readFileSync(outFile);

  // Save buffer to GridFS (bucket 'videos')
  const filename = (options.originalName ? path.parse(options.originalName).name : 'transcoded') + '.mp4';
  const gridId = await saveBufferToGridFS(buffer, filename, { originalName: filename, transcodedFrom: gridFsId }, 'videos');

  // Cleanup
  try { fs.unlinkSync(inFile); } catch(e){}
  try { fs.unlinkSync(outFile); } catch(e){}
  try { fs.rmdirSync(tmpDir); } catch(e){}

  return gridId;
}

function checkFfmpeg() {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-version']);
    p.on('error', (err) => reject(err));
    p.on('exit', (code) => {
      if (code === 0) resolve(); else reject(new Error('ffmpeg not found'));
    });
  });
}

module.exports = { transcodeGridFsToMp4 };
