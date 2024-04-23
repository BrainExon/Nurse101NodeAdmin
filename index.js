/**
 * A nodejs express server to mint arweave NFTs using 'ardrive'
 * command line:
 * $`npm start`
 * @type {(function(): function(*, *, *): void)|{}}
 */
// command line: `npm start`
const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function cleanString(inputString) {
  return inputString.replace(/\\n\s+/g, '').replace(/\\/g, '');
}
async function ardriveUpload(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing command: ${error}`);
        reject({ success: false, data: '', error: error });
      } else {
        const jsonResponse = JSON.parse(stdout);
        resolve({ success: true, data: jsonResponse, error: '' });
      }
    });
  });
}

const mintNft = async (req, res) => {
  const file = req.files[0];
  if (!file) {
    console.error('No file uploaded');
    return { success: false, data: '', error: 'No file uploaded' };
  }
  try {
    const file = req.files[0] || 'null';
    const jwk_token = process.env.AR_DRIVE_JWK;
    const arweave_images_folder_id = process.env.AR_ARWEAVE_IMAGES_FOLDER_ID;
    const ardrive_client = process.env.ARDRIVE_CLIENT;
    //const image_path = `${process.env.AR_PROJECT_ROOT}/functions/${file.destination}${file.originalname}`;
    const image_path = `${file.destination}${file.originalname}`;
    const command = `${ardrive_client} upload-file --wallet-file ${jwk_token} --parent-folder-id "${arweave_images_folder_id}" --local-path ${image_path} --dest-file-name "${file.filename}"`;
    return await ardriveUpload(command);
  } catch (error) {
    console.error('Error in mintNft:', error);
    throw error;
  }
};

const deleteFilesInFolder = async (folderPath) => {
  try {
    const files = await fs.promises.readdir(folderPath);
    await Promise.all(files.map(async (file) => {
      const filePath = path.join(folderPath, file);
      try {
        await fs.promises.unlink(filePath);
      } catch (err) {
        console.error('Error deleting file:', err);
        return { success: false, data: '', error: err };
      }
    }));
  } catch (err) {
    console.error('Error reading directory:', err);
    return { success: false, data: '', error: err };
  }
};

const getFileByName = async (req, res) => {
  const fileName = req.params.filename;
  console.log(`[getFileByName]: ${req.params.fileName}`);
  if (!fileName) {
    fs.readdir('uploads', (err, files) => {
      if (err) {
        console.error(`[getFileByName] Error reading directory: ${JSON.stringify(req.params.filename)}`);
        res.status(500).json({ success: false, data: '', error: err });
      } else {
        res.json({ success: true, data: files, error: '' });
      }
    });
  } else {
    const filePath = `uploads/${fileName}`;
    fs.readFile(filePath, (err, data) => {
      if (err) {
        console.error('[getFileByName] Error File not found');
        res.status(404).json({ success: false, data: '', message: 'File not found' });
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.json({ success: true, data: data.toString('base64'), error: '' });
      }
    });
  }
};

async function uploadFiles(req, res) {
  try {
    const minted = await mintNft(req, res);
    if (minted.error) {
      console.error(`[uploadFiles][mintNft] Error: ${JSON.stringify(minted.error)}`);
      const del = await deleteFilesInFolder('./uploads');
      return res.status(404).json({ success: false, data: '', error: minted.error });
    } else {
      const del = await deleteFilesInFolder('./uploads');
    }
    console.error(`[mintNft] success: ${JSON.stringify(minted.data)}`);
    res.format({
      json: function(){
        return res.status(200).json({ success: true, data: minted.data, error: '' });
      }
    });
  } catch (error) {
    console.error('UnhandledPromiseRejection:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
}

const storageLocation = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, 'uploads/');
  },
  filename: function (req, file, callback) {
    callback(null, file.originalname);
  }
});

const PORT = 3030;
const upload = multer({ storage: storageLocation });
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/get_file/:filename', getFileByName);
app.post('/upload_files', upload.array('files'), uploadFiles);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

app.use((req, res, next) => {
  console.log('\n========\nApplication starting\n==========\n');
  next();
});

app.listen(PORT, () => {
  console.log(`\n========\nServer listening on PORT: ${PORT}\n========\n`);
});
