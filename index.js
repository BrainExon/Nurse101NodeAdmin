const express = require('express');
import {v4 as uuidv4} from 'uuid';
const multer = require('multer');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const {
  readJWKFile,
  arDriveFactory,
  wrapFileOrFolder,
  EID
} = require('ardrive-core-js');
const getFileNameWithoutExtension = async () => {
  const directoryPath = './uploads';

  return new Promise((res, rej) => {
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        const e = `[getFileNameWithoutExtension] Error reading "${directoryPath}"`;
        console.error(e);
        rej({ success: false, data: '', error: JSON.stringify(e) });
      }
      const firstFile = files[0];
      if (!firstFile) {
        const e = `[getFileNameWithoutExtension] first file in directory "${directoryPath}" not found!`;
        console.error(e);
        rej({ success: false, data: '', error: JSON.stringify(e) });
      }
      const fileName = path.parse(firstFile);
      const fileNameWithoutExtension = fileName.name;
      if (!fileNameWithoutExtension) {
        const e = `[getFileNameWithoutExtension] NULL file name without extension "${fileNameWithoutExtension}"!`;
        console.error(e);
        rej({ success: false, data: '', error: JSON.stringify(e) });
      }
      const dateString = Date.now();
      const datedFilename = `${fileNameWithoutExtension}_${dateString}`;
      console.log('[getFileNameWithoutExtension] filename without extension:', fileNameWithoutExtension);
      console.log('[getFileNameWithoutExtension] filename with date string:', datedFilename);
      res({ success: true, data: datedFilename, error: '' });
    });
  });
};

const ARDriveNftMinter = async () => {
  const myWallet = readJWKFile('./jwk_token.json');
  const arDrive = arDriveFactory({ wallet: myWallet });
  if (arDrive) {
    try {
      console.log("\n=========================\n");
      console.log(`get file Name without extension....`)
      console.log("\n=========================\n");
      const fileName = await getFileNameWithoutExtension();
      if (fileName.error) {
        console.error("\n=========================\n");
        console.error(`[getFileNameWithoutExtension] error: ${JSON.stringify(fileName.error)}`);
        console.error("\n=========================\n");
        return {success: false, data: '', error: fileName.error};
      }
      console.log("\n=========================\n");
      console.log(`[ARDriveNftMinter] file name: ${JSON.stringify(fileName.data)}`);
      console.log("\n=========================\n");
      /**
       *  createPublicDrive() response looks something like this:
       *  [
       *   {
       *     "type": "drive",
       *     "metadataTxId": "ArtPzOiagC8cZOOAPOAQDSiS9xlGa_ytqvnre0MNXa0",
       *     "entityId": "3480fed0-db3d-4916-a7f4-215c2e2ceb8b",
       *     "bundledIn": "FpXxGSyt0i7D3w3QjAhYWwLWZSIZVFHrbYBhif9j8B4",
       *     "entityName": "IMG_4540"
       *   },
       *   {
       *     "type": "folder",
       *     "metadataTxId": "B4eV4RUI6S1b-s5YItHWzKZ49DBFmIP8aZxCVQnefEM",
       *     "entityId": "332d92de-55d2-46c1-b146-242c8f9a8882",
       *     "bundledIn": "FpXxGSyt0i7D3w3QjAhYWwLWZSIZVFHrbYBhif9j8B4",
       *     "entityName": "IMG_4540"
       *   },
       *   {
       *     "type": "bundle",
       *     "bundleTxId": "FpXxGSyt0i7D3w3QjAhYWwLWZSIZVFHrbYBhif9j8B4"
       *   }
       * ]
       */
      const createDriveResult = await arDrive.createPublicDrive({driveName: fileName.data});
      if (!createDriveResult.created) {
        const error = `[arDrive.createPublicDrive] create drive failed: ${JSON.stringify(createDriveResult)}`;
        console.error("\n=========================\n");
        console.error(error);
        console.error("\n=========================\n");
        return {success: false, data: '', error: error};
      }

      const newDrive = createDriveResult.created;

      /**
       * @param data
       * @param key
       * @returns {Promise<*|null>}
       */
      //const getEntityIdByType = async (data: any[], key: string) => {
      const getEntityIdByType = async (data, key) => {
        const folder = data.find(item => item.type === key);
        if (folder) {
          return folder.entityId;
        } else {
          return null; // or handle the case where no folder is found
        }
      };

      const newDriveFolderEntityId = await getEntityIdByType(newDrive, 'folder');
      if (!newDriveFolderEntityId) {
        const error = `[getEntityIdByType] NULL Drive Folder Entity ID: ${JSON.stringify(createDriveResult)}`;
        console.error("\n=========================\n");
        console.error(error);
        console.error("\n=========================\n");
        return {success: false, data: '', error: error};

      }

      const destinationFolderId = EID(newDriveFolderEntityId);

      if (!destinationFolderId) {
        const err = `[EID] NULL destinationFolderId!`;
        console.error("\n=========================\n");
        console.log(err);
        console.log("\n=========================\n");
        return {success: false, data: '', error: err};
      }

      const wrappedEntity = wrapFileOrFolder('./uploads');
      const uploadFileResult = await arDrive.uploadAllEntities({
        entitiesToUpload: [{wrappedEntity, destinationFolderId}]
      });
      console.log("\n=========================\n");
      console.log(`[uploadAllEntities] result: ${JSON.stringify(uploadFileResult, null, 2)}`);
      console.log("\n=========================\n");
      return {success: true, data: uploadFileResult, error: ''};
    } catch (e) {
      const err = `[ARDriveNftMinter] Error: ${JSON.stringify(e.message)}`;
      console.error("\n=========================\n");
      console.error(err)
      console.error("\n=========================\n");
      return {success: false, data: '', error: err};
    }
  } else {
    const errMsg = '[ARDriveNftMinter] NULL ARDrive Client!';
    console.error("\n=========================\n");
    console.error(errMsg);
    console.error("\n=========================\n");
    return {success: false, data: '', error: errMsg};
  }
};
const deleteFilesInFolder = async (folderPath) => {
  try {
    const files = await fs.promises.readdir(folderPath);
    await Promise.all(files.map(async (file) => {
      const filePath = path.join(folderPath, file);
      try {
        await fs.promises.unlink(filePath);
        console.log("\n=========================\n");
        console.log('File deleted:', filePath);
        console.log("\n=========================\n");
      } catch (err) {
        console.error("\n=========================\n");
        console.error('Error deleting file:', err);
        console.error("\n=========================\n");
      }
    }));
  } catch (err) {
    console.error("\n=========================\n");
    console.error('Error reading directory:', err);
    console.error("\n=========================\n");
  }
};

const getFileByName = async(req, res) => {
  const fileName = req.params.filename;
  console.log(`[getFileByName]: ${req.params.fileName}`);
  if (!fileName) {
    fs.readdir('uploads', (err, files) => {
      if (err) {
        const er = `[getFileByName] Error reading directory: ${JSON.stringify(req.params.filename)}`;
        console.error("\n=========================\n");
        console.error(er);
        console.error("\n=========================\n");
        res.status(500).json({ success: false, data: '', error: er });
      } else {
        res.json({ success: true, data: files, error: '' });
      }
    });
  } else {
    const filePath = `uploads/${fileName}`;
    fs.readFile(filePath, (err, data) => {
      if (err) {
        const er = '[getFileByName] Error File not found';
        console.error("\n=========================\n");
        console.error(er);
        console.error("\n=========================\n");
        res.status(404).json({ success: false, data: '', message: 'File not found' });
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.json({ success: true, data: data.toString('base64'), error: '' });
      }
    });
  }
}

async function uploadFiles(req, res) {
  const minted = await ARDriveNftMinter();
  await deleteFilesInFolder('./uploads');
  if (minted.error) {
    const er = `[uploadFiles][ARDriveNftMinter] Error: ${JSON.stringify(minted.error)}`;
    console.error("\n=========================\n");
    console.error(er);
    console.error("\n=========================\n");
    return res.json({ success: false, data: '', error: minted.error});
  }
  console.error("\n=========================\n");
  console.error(`[uploadFiles] success!`);
  console.error("\n=========================\n");
  return res.json({ success: true, data: 'Successfully uploaded files.', error: '' });
}

const storageLocation = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, 'uploads/');
  },
  filename: function (req, file, callback) {
    const fileName = file.originalname;
    console.log("\n=========================\n");
    console.log(`[multer][disStorage] fileName: ${JSON.stringify(fileName)}`);
    console.log("\n=========================\n");
    callback(null, file.originalname);
  }
});

const PORT = 5001;
const upload = multer({ storage: storageLocation })
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
//const fileName = await getFileByName();
app.get('/get_file/:filename', getFileByName);
app.post('/upload_files', upload.array('files'), uploadFiles);
app.use((req, res, next) => {
  console.log("\n=========================\n");
  console.log('Application starting...');
  console.log('Endpoint URLs:');
  app._router.stack.forEach((route) => {
    if (route.route && route.route.path) {
      console.log(route.route.path);
    }
  });
  console.log("\n=========================\n");
  next();
});
app.listen(PORT, () => {
  console.log("\n=========================\n");
  console.log(`Server listening on PORT: ${PORT}`);
  console.log("\n=========================\n");
});
