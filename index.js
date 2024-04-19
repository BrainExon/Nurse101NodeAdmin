const express = require('express');
const multer = require('multer');
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const Arweave = require('arweave');
const PORT = 5001;
// export declare const developmentUploadServiceURL = "https://upload.ardrive.dev";
// export declare const defaultUploadServiceURL = "https://upload.ardrive.io";

const {
  USD,
  developmentTurboConfiguration,
  defaultTurboConfiguration,
  TurboFactory,
  TurboUnauthenticatedPaymentService,
  WinstonToTokenAmount,
} = require('@ardrive/turbo-sdk/node');
const upload = multer({ dest: 'uploads/' });
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/get_file/:filename', getFileByName);

/**
 * ARDriveNftMinter
 *
 * @returns {Promise<void>}
 * @constructor
 */
const ARDriveNftMinter = async () => {

  /* Fetching aates using an unauthenticated Turbo client. */
  //const turbo = TurboFactory.unauthenticated(defaultTurboConfiguration);
  const turbo = TurboFactory.unauthenticated(developmentTurboConfiguration);
  const rates = await turbo.getFiatRates();
  console.log('Fetched rates:', JSON.stringify(rates, null, 2));

  /* Alternatively instantiate your own clients independently. */
  //url: 'https://payment.ardrive.io',
  const paymentService = new TurboUnauthenticatedPaymentService({
    url: 'https://payment.ardrive.dev'
  });
  const supportedCurrencies = await paymentService.getSupportedCurrencies();
  console.log(
    'Supported currencies:',
    JSON.stringify(supportedCurrencies, null, 2),
  );
  /* authenticate user */
  const jwk = JSON.parse(process.env.ARDRIVE_JWK);
  if (!jwk) {
    const error =`[readFileSync] null JWK Token! "${JSON.stringify(jwk)}"`;
    console.error(error);
    return new Promise((resolve, reject) => { reject(error); });
  }
 console.log(`[readFileSync] JWK TOKEN: "${JSON.stringify(jwk, null, 2)}"`);
  const arweave = new Arweave({});
  const address = await arweave.wallets.jwkToAddress(jwk);

  /* Use the arweave key to create an authenticated turbo client */
  const turboAuthClient = TurboFactory.authenticated({
    privateKey: jwk,
    ...defaultTurboConfiguration,
  });
  /* Fetch the balance for the private key. */
  const balance = await turboAuthClient.getBalance();
  console.log(
    'Balance:',
    JSON.stringify(
      {
        address,
        balance,
      },
      null,
      2,
    ),
  );
  /* Fetch the estimated amount of winc returned for 10 USD (1000 cents). */
  const estimatedWinc = await turboAuthClient.getWincForFiat({
    amount: USD(10),
  });
  console.log('Estimated USD to WINC: ', estimatedWinc);

  /* Post local files to the Turbo service. */
  console.log('Posting raw file to Turbo service...');
  const directoryPath = path.join(__dirname, 'uploads');
  const files = fs.readdirSync(directoryPath);

  let uploadResult = '';
  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const fileSize = fs.statSync(filePath).size;
    try {
        const uploadResult = await turboAuthClient.uploadFile({
          fileStreamFactory: () => fs.createReadStream(filePath),
          fileSizeFactory: () => fileSize,
          signal: AbortSignal.timeout(10_000),
        });
      console.log(`Uploaded file: ${file}`);
        console.log(`\n----\nUpload Result: ${JSON.stringify(uploadResult, null, 2)}\n-----\n`);
    } catch (error) {
      console.error(`Error uploading file ${file}: ${error.message}`);
    }
  }
  /**
   * Tops up a wallet with Credits using tokens.
   * Default token is AR, using Winston as the unit.
   */
  const topUpResult = await turboAuthClient.topUpWithTokens({
    tokenAmount: WinstonToTokenAmount(100_000_000), // 0.0001 AR
  });
  console.log(`\n-----\nTopup Result: ${JSON.stringify(topUpResult, null, 2)}\n-----\n`);
  return new Promise((resolve, reject) => {
    resolve(topUpResult);
  });
};
/**
 * deleteFilesInFolder
 *
 * This function's purpose is rhetorical.
 *
 * @param folderPath
 * @returns {Promise<void>}
 */
const deleteFilesInFolder = async (folderPath) => {
  try {
    const files = await fs.promises.readdir(folderPath);
    await Promise.all(files.map(async (file) => {
      const filePath = path.join(folderPath, file);
      try {
        await fs.promises.unlink(filePath);
        console.log('File deleted:', filePath);
      } catch (err) {
        console.error('Error deleting file:', err);
      }
    }));
  } catch (err) {
    console.error('Error reading directory:', err);
  }
};

/**
 * getFileByName
 *
 * If the filename parameter exists, this function will return that
 * file if it exists, else it will return all files in the upload's
 * directory.
 *
 * @param req
 * @param res
 */
function getFileByName(req, res) {
  const fileName = req.params.filename;
  if (!fileName) {
    fs.readdir('uploads', (err, files) => {
      if (err) {
        res.status(500).json({ success: false, data: 'Error reading directory' });
      } else {
        res.json({ success: true, data: files });
      }
    });
  } else {
    const filePath = `uploads/${fileName}`;
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.status(404).json({ message: 'File not found' });
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        res.json({ success: true, data: data.toString('base64') });
      }
    });
  }
}

app.post('/upload_files', upload.array('files'), uploadFiles);

async function uploadFiles(req, res) {
  console.log(req.body);
  console.log(req);
  const minted = await ARDriveNftMinter();
  const del = await deleteFilesInFolder('./uploads');
  if (!minted) {
    res.json({ success: false, data: 'Uploaded files failed.' });
  }
  res.json({ success: true, data: 'Successfully uploaded files.' });
}

app.use((req, res, next) => {
  console.log('Application starting...');
  console.log('Configuration settings:');
  console.log('Endpoint URLs:');
  app._router.stack.forEach((route) => {
    if (route.route && route.route.path) {
      console.log(route.route.path);
    }
  });
  next();
});

app.listen(PORT, () => {
  console.log(`Server listening on PORT: ${PORT}`);
});
