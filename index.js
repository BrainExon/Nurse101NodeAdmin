/**
 * A nodejs express server to mint arweave NFTs using 'ardrive'
 * command line:
 * $`npm start`
 * @type {(function(): function(*, *, *): void)|{}}
 */
const { v4: uuidv4 } = require('uuid');
const bodyParser = require('body-parser');
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
const nftImage = require("./models/nftImage");
const QRCode = require('qrcode');
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
    return await db.dbFind(key, {});
  } catch (error) {
    console.error('Error in [dbQuery]: ', error);
    throw new Error('Error retrieving ' + key + ' from the database');
  }
}

async function upsertImage(image) {
  try {
    if (!image) {
      const err = '[upsertImage] null "NftImage".';
      return { success: false, data: '', error: err };
    }
    const existingImage = await db.dbFind('nft_images', { imageId: image.imageId });
    if (Array.isArray(existingImage) && existingImage.length > 0) {
      const updatedImage = { ...existingImage[0], ...image };
      updatedImage.version ? updatedImage.version = updatedImage.version + 1 : 1;
      const updated = await db.dbUpdate('nft_images', { imageId: image.imageId }, updatedImage);
      if (!updated.modified) {
        const err = '[upsertImage] unable to update image.';
        return { success: false, data: '', error: err };
      }
      return { success: true, data: updatedImage, error: '' };
    } else {
      image.version = 1;
      await db.dbInsert('nft_images', image);
      const results = await db.dbFind('nft_images', { imageId: image.imageId });
      console.log(`[upsertImage] results: ${JSON.stringify(results, null, 2)}`);
      if (!Array.isArray(results) && results.length === 0) {
        const err = '[upsertImage] unable to add nft image.';
        return { success: false, data: '', error: err };
      }
      return { success: true, data: results, error: '' };
    }
  } catch (error) {
    const err = `[upsertImage] Internal Server Error: ${JSON.stringify(error)}`;
    return { success: false, data: '', error: `${err}` };
  }
}
async function dbUpsertNft(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, data: '', errors: errors.array() });
    }
    const nft = req.body;
    if (!nft) {
      const err = '[dbUpsertNft] null "nft".';
      return res.status(404).json({ success: false, data: '', error: err });
    }
    const existingNft = await db.dbFind('nfts', { nftId: nft.nftId });

    if (Array.isArray(existingNft) && existingNft.length > 0) {
      const updatedNft = { ...existingNft[0], ...nft };
      const updated = await db.dbUpdate('nfts', { nftId: nft.nftId }, updatedNft);
      if (!updated.modified) {
        const err = `[dbUpsertNft] unable to update nft: ${JSON.stringify(nft)}`;
        return res.status(404).json({ success: false, data: '', error: err });
      }
      return res.status(200).json({ success: true, data: updatedNft, error: '' });
    } else {
      console.log(`Attempt to Insert nft...`)
      await db.dbInsert('nfts', nft);
      const results = await db.dbFind('nfts', { nftId: nft.nftId });
      console.log(`[dbUpsertNft] results: ${JSON.stringify(results, null, 2)}`);
      if (!Array.isArray(results) && results.length === 0) {
        const err = `[dbUpsertNft] unable to add nft: ${JSON.stringify(nft)}`;
        return res.status(404).json({ success: false, data: '', error: err });
      }
      return res.status(200).json({ success: true, data: results, error: '' });
    }
  } catch (error) {
    const err = `[dbUpsertNft] Internal Server Error: ${JSON.stringify(error)}`;
    return res.status(500).json({ success: false, data: '', error: `${err}` });
  }
}

async function dbUpsertNftImage(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, data: '', errors: errors.array() });
    }
    const image = req.body;
    if (!image) {
      const err = '[dbUpsertNftImage] null "NftImage".';
      return res.status(404).json({ success: false, data: '', error: err });
    }
    const response = await upsertImage(image);
    if (response.error) {
      return res.status(404).json({ success: false, data: '', error: response.error });
    }
    return res.status(200).json({ success: true, data: response.data, error: '' });
  } catch (error) {
    const err = `[dbUpsertNftImage] Internal Server Error: ${JSON.stringify(error)}`;
    return res.status(500).json({ success: false, data: '', error: `${err}` });
  }
}

async function dbUpsertChallenge(req, res) {
  try {
    const challenge = req.body;
    if (!challenge) {
      const err = '[dbUpsertChallenge] Null challenge.';
      return res.status(400).json({ success: false, data: '', error: err });
    }

    const existingChallenge = await db.dbFind('challenges', { chId: challenge.chId });

    if (Array.isArray(existingChallenge) && existingChallenge.length > 0) {
      const updatedChallenge = { ...existingChallenge[0], ...challenge };
      const updated = await db.dbUpdate('challenges', { chId: updatedChallenge.chId }, updatedChallenge);

      if (!updated.modified) {
        const err = '[dbUpsertChallenge] Unable to update challenge.';
        return res.status(400).json({ success: false, data: '', error: err });
      }

      console.log('[dbUpsertChallenge] Existing challenge updated...');
      return res.status(200).json({ success: true, data: updatedChallenge, error: '' });
    } else {
      await db.dbInsert('challenges', challenge);
      const results = await db.dbFind('challenges', { chId: challenge.chId });

      if (!Array.isArray(results) || results.length === 0) {
        const err = '[dbUpsertChallenge] Unable to add challenge.';
        return res.status(400).json({ success: false, data: '', error: err });
      }

      console.log('[dbUpsertChallenge] New challenge inserted: ', JSON.stringify(challenge));
      return res.status(200).json({ success: true, data: results, error: '' });
    }
  } catch (error) {
    const err = `[dbUpsertChallenge] Internal Server Error: ${error.message}`;
    return res.status(500).json({ success: false, data: '', error: err });
  }
}

async function dbUpsertUserChallenge(req, res) {
  try {
    const userChallenge = req.body;
    if (!userChallenge) {
      const err = '[dbUpsertUserChallenge] Null userChallenge.';
      return res.status(400).json({ success: false, data: '', error: err });
    }

    const existingChallenge = await db.dbFind('user_challenges', { userChallengeId: userChallenge.userChallengeId });

    if (Array.isArray(existingChallenge) && existingChallenge.length > 0) {
      const updatedUserChallenge = { ...existingChallenge[0], ...userChallenge };
      const updated = await db.dbUpdate('user_challenges', {
        userChallengeId: updatedUserChallenge.userChallengeId },
        updatedUserChallenge
      );
      if (!updated.modified) {
        const err = '[dbUpsertUserChallenge] Unable to update user challenge.';
        return res.status(400).json({ success: false, data: '', error: err });
      }
      console.log('[dbUpsertUserChallenge] Existing user challenge updated...');
      return res.status(200).json({ success: true, data: updatedUserChallenge, error: '' });
    } else {
      await db.dbInsert('user_challenges', userChallenge);
      const results = await db.dbFind('user_challenges', { userChallengeId: userChallenge.userChallengeId });

      if (!Array.isArray(results) || results.length === 0) {
        const err = '[dbUpsertUserChallenge] Unable to add user challenge.';
        return res.status(400).json({ success: false, data: '', error: err });
      }

      console.log('[dbUpsertUserChallenge] New user challenge inserted: ', JSON.stringify(userChallenge));
      return res.status(200).json({ success: true, data: results, error: '' });
    }
  } catch (error) {
    const err = `[dbUpsertUserChallenge] Internal Server Error: ${error.message}`;
    return res.status(500).json({ success: false, data: '', error: err });
  }
}

async function dbUpsertUser( req, res) {
  try {
    const user = req.body;
    if (!user) {
      const err = '[dbUpsertUser] null User request parameter.';
      return res.status(400).json({ success: false, data: '', error: err });
    }

    const existingUser = await db.dbFind('users', { phone: user.phone });

    if (Array.isArray(existingUser) && existingUser.length > 0) {
      const updatedUser = { ...existingUser[0], ...user };
      const updated = await db.dbUpdate('users', { phone: updatedUser.phone }, updatedUser);

      if (!updated.modified) {
        const err = '[dbUpsertUser] unable to update user.';
        return res.status(400).json({ success: false, data: '', error: err });
      }

      console.log(`\n------\n[dbUpsertUsers] existing user updated ${JSON.stringify(updatedUser)}\n------\n`);
      return res.status(200).json({ success: true, data: updatedUser, error: '' });
    } else {
      await db.dbInsert('users', user);
      const results = await db.dbFind('users', { phone: user.phone });

      if (!Array.isArray(results) || results.length === 0) {
        const err = '[dbUpsertUser] unable to add user.';
        return res.status(400).json({ success: false, data: '', error: err });
      }

      console.log(`[dbUpsertUsers] new user inserted: ${JSON.stringify(results)}`);
      return res.status(200).json({ success: true, data: results, error: '' });
    }
  } catch (error) {
    const err = `[dbUpsertUser] Internal Server Error: ${error.message}`;
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

async function verifyChallenge(req, res) {
  const challenge = req.body.challenge;
  const participant = req.body.participant;
  console.log(`[verifyChallenge] challenge: ${JSON.stringify(challenge)}`);
  const found = `challenge: ${challenge} participant: ${participant}`;
  return res.status(200).json({ success: true, data: found, error: '' });
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

/**
 * create a versioned image on the filesystem
 * @param filename
 * @returns {Promise<unknown>}
 */
async function createVersionedImage(filename) {
  console.log(`[createVersionedImage] filename: ${filename}`);
  const versionRegex = /_v(\d+)\./;
  const match = filename.match(versionRegex);
  console.log(`[createVersionedImage] match: ${match}`);
  let versionNumber = 1;
  if (match) {
    versionNumber = parseInt(match[1]) + 1;
  }
  const fileExtension = path.extname(filename);
  const newFilename = match ? filename.replace(versionRegex, `_v${versionNumber}.`) : `${filename.replace(fileExtension, '')}_v1${fileExtension}`;
  const originalFilePath = path.join(__dirname, 'images_store', filename);
  const versionedFilePath = path.join(__dirname, 'images_store', newFilename);
  return new Promise((resolve, reject) => {
    fs.copyFile(originalFilePath, versionedFilePath, (err) => {
      if (err) {
        reject({ success: false, data: '', error: `[createVersionedImage] unable to create versioned image file: ${versionedFilePath}` });
      } else {
        resolve({ success: true, data: versionedFilePath, error: '' });
      }
    });
  });
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

async function ardrivePinImage(image_path, filename) {
  console.log(`[ardrivePinImage]: image_path: ${image_path}`);
  console.log(`[ardrivePinImage]: file: ${JSON.stringify(filename)}`);
  const jwk_token = process.env.AR_DRIVE_JWK;
  const arweave_images_folder_id = process.env.AR_ARDRIVE_IMAGES_FOLDER_ID;
  const ardrive_client = process.env.ARDRIVE_CLIENT;
  const command = `${ardrive_client} upload-file --wallet-file ${jwk_token} --parent-folder-id "${arweave_images_folder_id}" --local-path ${image_path} --dest-file-name "${filename}"`;
  return await ardriveUpload(command);
}
/**
 * {
 *     "success: true",
 *      "data":{
 *             "_id": "662f0a891ee58d7e03c75650",
 *             "ownerId": "dc6ddf89-37fc-4224-a0d7-5c03ae4353e7",
 *             "nftId": "be9f9847-5342-449b-9d3d-48e32b8305c2",
 *             "created": [
 *                 {
 *                     "type": "file",
 *                     "entityName": "1000000018.jpg",
 *                     "entityId": "0a13c707-303b-4ff1-8a55-343fd4bd270a",
 *                     "dataTxId": "gEUXVeqXH_NNNUl-FrY22U436dBjCqNJ-lMv_m86d34",
 *                     "metadataTxId": "wjwyZlIdHOzR8dJdkqMAvI652GRpGCuk5zpjKrmLq7M",
 *                     "bundledIn": "M1vGVtMkW-SlsAZa5HYFwnbolMOnkQThSkxRTIuCjCM",
 *                     "sourceUri": "file:///Users/chellax/Projects/Express/functions/uploads/1000000018.jpg"
 *                 },
 *                 {
 *                     "type": "bundle",
 *                     "bundleTxId": "M1vGVtMkW-SlsAZa5HYFwnbolMOnkQThSkxRTIuCjCM"
 *                 }
 *             ],
 *             "tips": [
 *                 {
 *                     "recipient": "8s8ABYc_1oDZ553UKXLIzsUie48xc6V88Q1hPtky4C8",
 *                     "txId": "M1vGVtMkW-SlsAZa5HYFwnbolMOnkQThSkxRTIuCjCM",
 *                     "winston": "27753169"
 *                 }
 *             ],
 *             "fees": {
 *                 "M1vGVtMkW-SlsAZa5HYFwnbolMOnkQThSkxRTIuCjCM": "185021129"
 *             }
 *         }
 *     "error": ""
 * }
 */
const mintNft = async (req, res) => {
  const file = req.files[0];
  const formData = req.body;

  console.log(`\n----\n[mintNft] NFT file: ${JSON.stringify(file, null, 2)}`);
  console.log(`\n----\n[mintNft] NFT formData: ${JSON.stringify(formData, null, 2)}`);
  // return { success: true, data: { file:file, formData: formData }, error: 'No file uploaded' };
  if (!file) {
    console.error('No file uploaded');
    return { success: false, data: '', error: 'No file uploaded' };
  }
  if (!formData.ownerId) {
    console.error('No ownerId parameter');
    return { success: false, data: '', error: 'No ownerId parameter' };
  }
  try {
    const file = req.files[0] || 'null';
    const image_path = `${file.destination}${file.originalname}`;
    const response = await ardrivePinImage(image_path, file.filename);
    const newNftId = uuidv4();
    const timestamp = Date.now();
    if (response.data) {
      const nft = new Nft({ date: timestamp, ownerId: formData.ownerId, nftId: newNftId, data: response.data });
      console.log(`\n----\n[mintNft] NEW NFT: ${JSON.stringify(nft, null, 2)}`);
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
    /**
    * this.imageId = imageId;
    * this.nftId = nftId;
    * this.name = name;
    * this.date = date;
    * this.owner = owner;
    * this.url = url;
    * this.version = version;
     */
    const image = new nftImage(
      uuidv4(),
      newNftId,
      file.originalname,
      Date.now(),
      formData.ownerId,
      image_path,
      '',
    );
    const imgResponse = await upsertImage(image);
    if (imgResponse.error) {
      return res.status(404).json({ success: false, data: '', error: imgResponse.error });
    }
    // response already formatted: `{success: true, data: data, error: ''}`
    const found = await db.dbFind('nfts', { nftId: newNftId });
    console.log(`\n----\n[mintNft] found newly minted NFT: ${JSON.stringify(found[0])}\n----\n`);
    return {success: true, data: found[0], error: ''}
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

async function nftMinterizer(req, res) {
  console.log(`[nftMinterizer]...`)
  try {
    const minted = await mintNft(req, res);
    if (minted.error) {
      console.error(`[nftMinterizer][mintNft] Error: ${JSON.stringify(minted.error)}`);
      const del = await deleteFilesInFolder('./uploads');
      return res.status(404).json({ success: false, data: '', error: minted.error });
    } else {
      const del = await deleteFilesInFolder('./uploads');
    }
    console.log(`[nftMinterizer] success: ${JSON.stringify(minted.data)}`);
    res.format({
      json: function(){
        return res.status(200).json({ success: true, data: minted.data, error: '' });
      }
    });
  } catch (error) {
    console.error('[nftMinterizer] UnhandledPromiseRejection:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
}

async function nftVersionMinterizer(req, res) {
  console.log(`[nftVersionMinterizer]...`)
  try {
    const { imagePath, imageType, imageName, ownerId } = req.body;
    console.log(`[nftVersionMinterizer] imagePath: ${imagePath}`);
    console.log(`[nftVersionMinterizer] imageType: ${imageType}`);
    console.log(`[nftVersionMinterizer] imageName: ${imageName}`);
    console.log(`[nftVersionMinterizer] ownerId: ${ownerId}`);
    const response = await ardrivePinImage(imagePath, imageName);
    console.log(`[nftVersionMinterizer] ardrivePinImage repsonse: ${JSON.stringify(response, null, 2)}`);
    const newNftId = uuidv4();
    const timestamp = Date.now();
    if (response.data) {
      const nft = new Nft({ date: timestamp, ownerId: ownerId, nftId: newNftId, data: response.data });
      const existingNft = await db.dbFind('nfts', { nftId: nft.nftId });
      if (Array.isArray(existingNft) && existingNft.length > 0) {
        const updatedNft = { ...existingNft[0], ...nft };
        const updated = await db.dbUpdate('nfts', { nftId: nft.nftId }, updatedNft);
        if (!updated.modified) {
          console.error( `[nftVersionMinterizer] unable to update nft: ${JSON.stringify(nft)}`);
        }
        console.error( `[nftVersionMinterizer] updated nft: ${JSON.stringify(nft)}`);
      } else {
        console.log(`Attempt to Insert nft...`);
        await db.dbInsert('nfts', nft);
        const results = await db.dbFind('nfts', { nftId: nft.nftId });
        if (!Array.isArray(results) && results.length === 0) {
          console.error(`[nftVersionMinterizer] unable to add nft: ${JSON.stringify(nft)}`);
        }
        console.log(`[nftVersionMinterizer] inserted NFT: ${JSON.stringify(results, null, 2)}`);
      }
    }
    const store = storeFile(imagePath, './images_store')
    if (store.error) {
      console.error(`\n-----\n[nftVersionMinterizer][storeFile] error: ${store.error}\n------\n`);
    }
    const image = new nftImage(
      uuidv4(),
      newNftId,
      imageName,
      Date.now(),
      ownerId,
      imagePath,
      '',
    );
    const imgResponse = await upsertImage(image);
    if (imgResponse.error) {
      return res.status(404).json({ success: false, data: '', error: imgResponse.error });
    }
    // response already formatted: `{success: true, data: data, error: ''}`
    const found = await db.dbFind('nfts', { nftId: newNftId });
    console.log(`\n----\n[nftVersionMinterizer] found newly minted NFT\n: ${JSON.stringify(found[0])}\n----\n`);
    res.status(200).json({success: true, data: found[0], error: ''});
  } catch (error) {
    console.error('[nftVersionMinterizer] UnhandledPromiseRejection:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
}



const qrCodeGenerate = async (req, res) => {
  const url = req.body.url;
  const directory = './qrcodes';
  const sanitizedUrl = url.replace(/[^a-zA-Z0-9]/g, ''); // Remove special characters from the URL
  const parsedPath = path.parse(url);
  const filenameWithoutExtension = parsedPath.name;
  const filePath = path.join(directory, `${filenameWithoutExtension}.png`);
  console.log(`QR code filepath: ${filePath}`);

  if (!fs.existsSync(directory)) {
    console.log(`QR code directory ${directory} does not exist.`);
    fs.mkdirSync(directory, { recursive: true });
  }

  try {
    await QRCode.toFile(filePath, url);
    console.log(`QR code ${filePath} generated successfully!`);
    res.status(200).json({ success: true, data: filePath, error: null });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, data: '', error: err });
  }
};

const storageLocation = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, 'uploads/');
  },
  filename: function (req, file, callback) {
    callback(null, file.originalname);
  }
});

const qrcodeStorage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, 'qrcodes/');
  },
  filename: function (req, file, callback) {
    callback(null, file.originalname);
  }
});


const upload = multer({ storage: storageLocation });
const qrcodeUpload = multer({ storage: qrcodeStorage });

const PORT = 3030;
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
//app.use(express.urlencoded({ extended: true }));

/* post */
app.post('/qr_code', qrcodeUpload.none(), qrCodeGenerate);
app.post('/verify', upload.none(), verifyChallenge);
app.post('/find', dbFind);
app.post('/find_one', dbFindOne);
app.post('/upsert_nft_image', dbUpsertNftImage);
app.post('/upsert_user_challenge', dbUpsertUserChallenge);
app.post('/upsert_challenge', dbUpsertChallenge);
app.post('/upsert_nft', dbUpsertNft);
app.post('/upsert_user', dbUpsertUser);
app.post('/mint_nft_version', upload.none(), nftVersionMinterizer);
app.post('/mint_nft', upload.array('files'), nftMinterizer);
app.post('/delete', dbDelete);

/* get */
app.get('/get_file/:filename', getFileByName);
app.get('/get_nft_images', async (req, res) => {
  try {
    const images = await dbQuery('nft_images');
    res.status(200).json({ success: true, data: images, error: '' });
  } catch (error) {
    console.error('Error in /get_images endpoint:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});
app.get('/images_store', async (req, res) => {
  try {
    const images = await dbQuery('images_store');
    res.status(200).json({ success: true, data: images, error: '' });
  } catch (error) {
    console.error('Error in /images_store endpoint:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});
app.get('/get_challenges', async (req, res) => {
  try {
    const challenges = await dbQuery('challenges');
    res.status(200).json({ success: true, data: challenges, error: '' });
  } catch (error) {
    console.error('Error in /get_challenges endpoint:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});
app.get('/get_user_challenges', async (req, res) => {
  try {
    const userChallenges = await dbQuery('user_challenges');
    res.status(200).json({ success: true, data: userChallenges, error: '' });
  } catch (error) {
    console.error('Error in  /get_user_challenges endpoint:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});
app.get('/get_users', async (req, res) => {
  try {
    const users = await dbQuery('users');
    res.status(200).json({ success: true, data: users, error: '' });
  } catch (error) {
    console.error('Error in /get_users endpoint /get_users:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});
app.get('/get_nfts', async (req, res) => {
  try {
    const nfts = await dbQuery('nfts');
    res.status(200).json({ success: true, data: nfts, error: '' });
  } catch (error) {
    console.error('Error in /get_nfts endpoint /get_nfts:', error);
    res.status(500).json({ success: false, data: '', error: 'Internal Server Error' });
  }
});
app.get('/image/:imageName', (req, res) => {
  const imageName = req.params.imageName;
  const imagePath = path.join(__dirname, 'images_store', imageName);

  res.sendFile(imagePath, (err) => {
    if (err) {
      console.error(err);
      res.status(404).send('NftImage not found');
    }
  });
});
app.get('/qrcodes/:imageName', (req, res) => {
  const imageName = req.params.imageName;
  const imagePath = path.join(__dirname, 'qrcodes', imageName);

  res.sendFile(imagePath, (err) => {
    if (err) {
      console.error(err);
      res.status(404).send('QR Code not found');
    }
  });
});
app.get('/version_image', async (req, res) => {
  const { filename } = req.query;
  if (!filename) {
    return res.status(400).json({ success: false, data: '', error: 'Error: Filename parameter is required' });
  }

  try {
    const result = await createVersionedImage(filename);
    console.log(`\n-----\n[createVersionedImage] result: ${JSON.stringify(result)}\n----\n`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, data: '', error: 'Error creating versioned image' });
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
