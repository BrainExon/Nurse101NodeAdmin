/**
 * A nodejs express server to mint arweave NFTs using 'ardrive'
 * command line:
 * $`npm start`
 * @type {(function(): function(*, *, *): void)|{}}
 */
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { check, validationResult } = require('express-validator');
require('dotenv').config();
const db = require('simple-node-jsondbv2');
const Nft = require('./models/Nft');
const dbPath = path.join(__dirname, 'toqyn_db');

async function initializeDb (dbPath){
  return await db.dbInit(dbPath);
}

function storeFile(filePath, destDir) {
  console.log(`[storeFile] filePath: ${filePath}`);
  console.log(`[storeFile] destDir: ${destDir}`);
  const fileName = path.basename(filePath);
  const destPath = path.join(destDir, fileName);

  fs.copyFile(filePath, destPath, (err) => {
    if (err) {
      const e = `[storeFile] Error writing file ${filePath} to ${destPath} error: ${JSON.stringify(err)}`;
      console.error(e);
      return {success: false, data: '', error: e}
    }
  });
  console.log(`[storeFile] Successfully wrote file ${filePath} to ${destPath}`);
  return {success: true, data: `${destPath}/${fileName}`, error: ''}
}
const dbQuery = async (key) => {
  console.log(`[dbQuery] key: ${JSON.stringify(key)}`)
  try {
    const response = await db.dbFind(key, {});
    return response;
  } catch (error) {
    console.error('Error in [dbQuery]: ', error);
    throw new Error('Error retrieving ' + key + ' from the database');
  }
}

async function upsertNft(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, data: '', errors: errors.array() });
    }
    const nft = req.body;
    if (!nft) {
      const err = '[upsertNft] null "nft".';
      return res.status(404).json({ success: false, data: '', error: err });
    }
    const existingNft = await db.dbFind('nfts', { nftId: nft.nftId });

    if (Array.isArray(existingNft) && existingNft.length > 0) {
      const updatedNft = { ...existingNft[0], ...nft };
      const updated = await db.dbUpdate('nfts', { nftId: nft.nftId }, updatedNft);
      if (!updated.modified) {
        const err = `[upsertNft] unable to update nft: ${JSON.stringify(nft)}`;
        return res.status(404).json({ success: false, data: '', error: err });
      }
      return res.status(200).json({ success: true, data: updatedNft, error: '' });
    } else {
      console.log(`Attempt to Insert nft...`)
      await db.dbInsert('nfts', nft);
      const results = await db.dbFind('nfts', { nftId: nft.nftId });
      console.log(`[upsertNft] results: ${JSON.stringify(results, null, 2)}`);
      if (!Array.isArray(results) && results.length === 0) {
        const err = `[upsertNft] unable to add nft: ${JSON.stringify(nft)}`;
        return res.status(404).json({ success: false, data: '', error: err });
      }
      return res.status(200).json({ success: true, data: results, error: '' });
    }
  } catch (error) {
    const err = `[upsertNft] Internal Server Error: ${JSON.stringify(error)}`;
    return res.status(500).json({ success: false, data: '', error: `${err}` });
  }
}

async function upsertImage(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, data: '', errors: errors.array() });
    }
    const image = req.body;
    if (!image) {
      const err = '[upsertImage] null "Image".';
      return res.status(404).json({ success: false, data: '', error: err });
    }
    const existingImage = await db.dbFind('images', { imageId: image.imageId });
    if (Array.isArray(existingImage) && existingImage.length > 0) {
      const updatedImage = { ...existingImage[0], ...image };
      const updated = await db.dbUpdate('images', { imageId: image.imageId }, updatedImage);
      if (!updated.modified) {
        const err = '[upsertImage] unable to update image.';
        return res.status(404).json({ success: false, data: '', error: err });
      }
      return res.status(200).json({ success: true, data: updatedImage, error: '' });
    } else {
      console.log(`Attempt to Insert image...`)
      await db.dbInsert('images', image);
      const results = await db.dbFind('images', { imageId: image.imageId });
      console.log(`[upsertImage] results: ${JSON.stringify(results, null, 2)}`);
      if (!Array.isArray(results) && results.length === 0) {
        const err = '[upsertImage] unable to add image.';
        return res.status(404).json({ success: false, data: '', error: err });
      }
      return res.status(200).json({ success: true, data: results, error: '' });
    }
  } catch (error) {
    const err = `[upsertImage] Internal Server Error: ${JSON.stringify(error)}`;
    return res.status(500).json({ success: false, data: '', error: `${err}` });
  }
}

async function upsertChallenge(req, res) {
  try {
    const challenge = req.body;
    if (!challenge) {
      const err = '[upsertChallenge] Null challenge.';
      return res.status(400).json({ success: false, data: '', error: err });
    }

    const existingChallenge = await db.dbFind('challenges', { chId: challenge.chId });

    if (Array.isArray(existingChallenge) && existingChallenge.length > 0) {
      const updatedChallenge = { ...existingChallenge[0], ...challenge };
      const updated = await db.dbUpdate('challenges', { chId: updatedChallenge.chId }, updatedChallenge);

      if (!updated.modified) {
        const err = '[upsertChallenge] Unable to update challenge.';
        return res.status(400).json({ success: false, data: '', error: err });
      }

      console.log('[upsertChallenge] Existing challenge updated...');
      return res.status(200).json({ success: true, data: updatedChallenge, error: '' });
    } else {
      await db.dbInsert('challenges', challenge);
      const results = await db.dbFind('challenges', { chId: challenge.chId });

      if (!Array.isArray(results) || results.length === 0) {
        const err = '[upsertChallenge] Unable to add challenge.';
        return res.status(400).json({ success: false, data: '', error: err });
      }

      console.log('[upsertChallenge] New challenge inserted...');
      return res.status(200).json({ success: true, data: results, error: '' });
    }
  } catch (error) {
    const err = `[upsertChallenge] Internal Server Error: ${error.message}`;
    return res.status(500).json({ success: false, data: '', error: err });
  }
}

async function upsertUser( req, res) {
  try {
    const user = req.body;
    if (!user) {
      const err = '[upsertUser] null User request parameter.';
      return res.status(400).json({ success: false, data: '', error: err });
    }

    const existingUser = await db.dbFind('users', { phone: user.phone });

    if (Array.isArray(existingUser) && existingUser.length > 0) {
      const updatedUser = { ...existingUser[0], ...user };
      const updated = await db.dbUpdate('users', { phone: updatedUser.phone }, updatedUser);

      if (!updated.modified) {
        const err = '[upsertUser] unable to update user.';
        return res.status(400).json({ success: false, data: '', error: err });
      }

      console.log(`\n------\n[upsertUsers] existing user updated ${JSON.stringify(updatedUser)}\n------\n`);
      return res.status(200).json({ success: true, data: updatedUser, error: '' });
    } else {
      await db.dbInsert('users', user);
      const results = await db.dbFind('users', { phone: user.phone });

      if (!Array.isArray(results) || results.length === 0) {
        const err = '[upsertUser] unable to add user.';
        return res.status(400).json({ success: false, data: '', error: err });
      }

      console.log(`[upsertUsers] new user inserted: ${JSON.stringify(results)}`);
      return res.status(200).json({ success: true, data: results, error: '' });
    }
  } catch (error) {
    const err = `[upsertUser] Internal Server Error: ${error.message}`;
    return res.status(500).json({ success: false, data: '', error: err });
  }
}

async function dbDelete (req, res) {
  const { collection, conditions } = req.body;
  console.log(`[dbDelete] collection: ${JSON.stringify(collection)}`);
  console.log(`[dbDelete] conditions: ${JSON.stringify(conditions)}`);
  try {
    if (!conditions) {
      const err = '[dbDelete] null conditions!';
      console.log(err);
      return res.status(404).json({ success: false, data: '', error: err });
    }

    if (!collection) {
      const err = '[dbDelete] null collection!';
      console.log(err);
      return res.status(404).json({ success: false, data: '', error: err });
    }

    const result = await db.dbDelete(collection, conditions);

    if (!result) {
      const err = `[dbDelete] item: ${JSON.stringify(conditions)} not found in collection: ${collection}!`;
      console.log(err);
      return res.status(404).json({ success: false, data: '', error: err });
    }

    const msg = { deleted: true, ...conditions};
    return res.status(200).json({ success: true, data: msg, error: '' });
  } catch (error) {
    throw new Error(`[dbDelete] Error: ${error.message}`);
  }
}

async function dbFind (req, res) {
  const { collection, conditions } = req.body;
  console.log(`[dbFind] collection: ${JSON.stringify(collection)}`);
  console.log(`[dbFind] conditions: ${JSON.stringify(conditions)}`);
  try {
    if (!conditions) {
      const err = '[dbFind] null conditions!';
      console.log(err);
      return res.status(404).json({ success: false, data: '', error: err });
    }

    if (!collection) {
      const err = '[dbFind] null collection!';
      console.log(err);
      return res.status(404).json({ success: false, data: '', error: err });
    }

    const found = await db.dbFind(collection, conditions);

    if (!found) {
      const err = `[dbFind] item: ${JSON.stringify(conditions)} not found in collection: ${collection}!`;
      console.log(err);
      return res.status(404).json({ success: false, data: '', error: err });
    }

    return res.status(200).json({ success: true, data: found, error: '' });
  } catch (error) {
    throw new Error(`[dbFind] Error: ${error.message}`);
  }
}

async function dbFindOne (req, res) {
  const { collection, conditions } = req.body;
  console.log(`[dbFindOne] collection: ${JSON.stringify(collection)}`);
  console.log(`[dbFindOne] conditions: ${JSON.stringify(conditions)}`);
  try {
    if (!conditions) {
      const err = '[dbFindOne] null conditions!';
      console.log(err);
      return res.status(404).json({ success: false, data: '', error: err });
    }

    if (!collection) {
      const err = '[dbFindOne] null collection!';
      console.log(err);
      return res.status(404).json({ success: false, data: '', error: err });
    }
    const found = await db.dbFindOne(collection, conditions);
    if (!found) {
      const err = `[dbFindOne] item: ${JSON.stringify(conditions)} not found in collection: ${collection}!`;
      console.log(err);
      return res.status(404).json({ success: false, data: '', error: err });
    }
    console.log(`\n------\n[dbFindOne] FOUND: ${JSON.stringify(found)}\n------\n`);
    return res.status(200).json({ success: true, data: found, error: '' });
  } catch (error) {
    throw new Error(`[dbFindOne] Error: ${error.message}`);
  }
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
    const arweave_images_folder_id = process.env.AR_ARDRIVE_IMAGES_FOLDER_ID;
    const ardrive_client = process.env.ARDRIVE_CLIENT;
    const image_path = `${file.destination}${file.originalname}`;
    const command = `${ardrive_client} upload-file --wallet-file ${jwk_token} --parent-folder-id "${arweave_images_folder_id}" --local-path ${image_path} --dest-file-name "${file.filename}"`;
    const response = await ardriveUpload(command);
    console.error(`\n-----\n[mintNft][ardriveUplaod] response: ${JSON.stringify(response, null, 2)}\n------\n`);
    if (response.data) {
      const nft = new Nft({ nftId: uuidv4(), data: response.data });
      const existingNft = await db.dbFind('nfts', { nftId: nft.nftId });
      if (Array.isArray(existingNft) && existingNft.length > 0) {
        const updatedNft = { ...existingNft[0], ...nft };
        const updated = await db.dbUpdate('nfts', { nftId: nft.nftId }, updatedNft);
        if (!updated.modified) {
          console.error( `[mintNft] unable to update nft: ${JSON.stringify(nft)}`);
        }
        console.error( `[mintNft] updated nft: ${JSON.stringify(nft)}`);
      } else {
        console.log(`Attempt to Insert nft...`);
        await db.dbInsert('nfts', nft);
        const results = await db.dbFind('nfts', { nftId: nft.nftId });
        if (!Array.isArray(results) && results.length === 0) {
          console.error(`[mintNft] unable to add nft: ${JSON.stringify(nft)}`);
        }
        console.log(`[mintNft] inserted NFT: ${JSON.stringify(results, null, 2)}`);
      }
    }
    const store = storeFile(image_path, './images_store')
    if (store.error) {
      console.error(`\n-----\n[mintNft][storeFile] error: ${store.error}\n------\n`);
    }
    console.error(`\n-----\n[mintNft] NFT added to DB: ${store.error}\n------\n`);
    // response already formatted: `{success: true, data: data, error: ''}`
    return response;
  } catch (error) {
    console.error('Error in mintNft:', error.message);
    return {success: false, data: '', error: error.message};
  }
}

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
}
const getImagesStore = (req, res) => {
  const filePath = path.join(__dirname, 'images_store', req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.write('File not found');
      res.end();
    } else {
      let contentType;
      if (filePath.endsWith('.jpg')) {
        contentType = 'image/jpeg';
      } else if (filePath.endsWith('.png')) {
        contentType = 'image/png';
      } else if (filePath.endsWith('.txt')) {
        contentType = 'text/plain';
      } else {
        contentType = 'application/octet-stream';
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.write(data);
      res.end();
    }
  });
}

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
        res.status(404).json({ success: false, data: '', error: 'File not found' });
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.json({ success: true, data: data.toString('base64'), error: '' });
      }
    });
  }
}

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
    console.log(`[uploadFiles] success: ${JSON.stringify(minted.data)}`);
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
    // const cleanName = replaceStringByKey(file.originalname, 'rn_image_picker_lib_temp_', '');
    //console.log('[storageLocation] cleanName: ', JSON.stringify(cleanName));
    callback(null, file.originalname);
  }
});

const PORT = 3030;
const upload = multer({ storage: storageLocation });
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* post */
app.post('/find', dbFind);
app.post('/find_one', dbFindOne);
app.post('/upsert_image', upsertImage);
app.post('/upsert_challenge', upsertChallenge);
app.post('/upsert_nft', upsertNft);
app.post('/upsert_user', upsertUser);
app.post('/upload_files', upload.array('files'), uploadFiles);
app.post('/delete', dbDelete);

/* get */
app.get('/get_file/:filename', getFileByName);
app.get('/get_images', async (req, res) => {
  try {
    const images = await dbQuery('images');
    res.status(200).json({ success: true, data: images, error: '' });
  } catch (error) {
    console.error('Error in [dbQuery] endpoint:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});
app.get('/images_store', async (req, res) => {
  try {
    const images = await dbQuery('images_store');
    res.status(200).json({ success: true, data: images, error: '' });
  } catch (error) {
    console.error('Error in [dbQuery] endpoint:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});
app.get('/get_challenges', async (req, res) => {
  try {
    const challenges = await dbQuery('challenges');
    res.status(200).json({ success: true, data: challenges, error: '' });
  } catch (error) {
    console.error('Error in [dbQuery] endpoint:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});
app.get('/get_users', async (req, res) => {
  try {
    const users = await dbQuery('users');
    res.status(200).json({ success: true, data: users, error: '' });
  } catch (error) {
    console.error('Error in [dbQuery] endpoint /get_users:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});
app.get('/get_nfts', async (req, res) => {
  try {
    const nfts = await dbQuery('nfts');
    res.status(200).json({ success: true, data: nfts, error: '' });
  } catch (error) {
    console.error('Error in [dbQuery] endpoint /get_nfts:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});
app.get('/image/:imageName', (req, res) => {
  const imageName = req.params.imageName;
  const imagePath = path.join(__dirname, 'images_store', imageName);

  res.sendFile(imagePath, (err) => {
    if (err) {
      console.error(err);
      res.status(404).send('Image not found');
    }
  });
});
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});
app.use((req, res, next) => {
  console.log('\n========\nApplication starting\n==========\n');
  next();
});

(async () => {
  try {
    await initializeDb(dbPath);
    console.log('Database initialized successfully');
    app.listen(PORT, () => {
      console.log(`\n========\nServer listening on PORT: ${PORT}\n========\n`);
    });
  } catch (error) {
    console.error('Error initializing database:', error);
  }
})();
