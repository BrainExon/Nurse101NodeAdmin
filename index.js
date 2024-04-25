/**
 * A nodejs express server to mint arweave NFTs using 'ardrive'
 * command line:
 * $`npm start`
 * @type {(function(): function(*, *, *): void)|{}}
 */
const express = require('express');
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { check, validationResult } = require('express-validator');
require('dotenv').config();
const db = require('simple-node-jsondbv2');
const dbPath = path.join(__dirname, 'toqyn_db');

async function initializeDb (dbPath){
  return await db.dbInit(dbPath);
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
};

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

      console.log(`[upsertUsers] existing user updated...`);
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

    const itemToDelete = await db.dbFindOne(collection, conditions);

    if (!itemToDelete) {
      const err = `[dbDelete] item: ${JSON.stringify(conditions)} not found in collection: ${collection}!`;
      console.log(err);
      return res.status(404).json({ success: false, data: '', error: err });
    }

    const result = await db.dbDelete(collection, itemToDelete);

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
};

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
};

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

    return res.status(200).json({ success: true, data: found, error: '' });
  } catch (error) {
    throw new Error(`[dbFindOne] Error: ${error.message}`);
  }
};

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
        res.status(404).json({ success: false, data: '', error: 'File not found' });
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
app.get('/get_file/:filename', getFileByName);
app.post('/upload_files', upload.array('files'), uploadFiles);
//app.post('/add_user', dbAddUser);
app.get('/find_one', dbFindOne);
app.get('/find', dbFind);
app.post('/delete', dbDelete);
app.post('/upsert_image', upsertImage);
app.get('/get_images', async (req, res) => {
  try {
    const images = await dbQuery('images');
    res.status(200).json({ success: true, data: images, error: '' });
  } catch (error) {
    console.error('Error in [dbQuery] endpoint:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});
app.post('/upsert_challenge', upsertChallenge);
app.get('/get_challenges', async (req, res) => {
  try {
    const challenges = await dbQuery('challenges');
    res.status(200).json({ success: true, data: challenges, error: '' });
  } catch (error) {
    console.error('Error in [dbQuery] endpoint:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});

app.post('/upsert_user', upsertUser);
app.get('/get_users', async (req, res) => {
  try {
    const users = await dbQuery('users');
    res.status(200).json({ success: true, data: users, error: '' });
  } catch (error) {
    console.error('Error in [dbQuery] endpoint:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
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
