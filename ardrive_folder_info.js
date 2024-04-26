require('dotenv').config();
require('dotenv').config();
const fs = require('fs');
const {
  readJWKFile,
  arDriveFactory,
} = require('ardrive-core-js');
require('dotenv').config();

//read wallet from file
const main = async() => {
  const myWallet = readJWKFile('./jwk_token.json');
  const arDrive = arDriveFactory({ wallet: myWallet })
  const folderID = process.env.AR_ARDRIVE_IMAGES_FOLDER_ID;
  if (!myWallet) {
    console.error(`null wallet`);
    return;
  }
  const getFolders = await arDrive.listPublicFolder({
    folderId: folderID
  })
  console.log(`[test] getFolders: ${JSON.stringify(getFolders, null, 2)}`);
  const driveId = getFolders[0].driveId
  console.log(`[test] driveId: ${JSON.stringify(driveId)}`);

  const LINK_TO_FOLDERS = `https://app.ardrive.io/#/drives/${driveId}/folders/`

  const sorted = getFolders.sort((a, b) => {
    return a.name.localeCompare(b.name)
  })

  console.log(`[test] sorted folders: ${JSON.stringify(sorted, null, 2)}`);
  const foldersId = []

  getFolders.forEach(folder => {
    if (folder) {
      foldersId.push({
        folderName: folder.name,
        folderId: folder.entityId,
      })
    }
  })

  const Files = []
  let getFiles=[];
  let folderName = '';
  let folderId = '';
  if (foldersId && Array.isArray(folderID)) {
    for (let i = 0; i < foldersId.length; i++) {
      folderId = foldersId[i].folderId
      folderName = foldersId[i].folderName
      console.error(`[listPublicFolder] folderName: ${JSON.stringify(folderName)}`);
      console.error(`[listPublicFolder] folderId: ${JSON.stringify(folderId)}`);
      try {
        const contents = await arDrive.listPublicFolder({
          folderId: folderId
        })
        if (contents && Array.isArray(contents)) {
          getFiles.push([...contents])
        }
      } catch(e) {
        console.error(`[listPublicFolder] error: ${JSON.stringify(e.message)}`);
      }
    }
    const filesInformation = [];
    getFiles.sort((a, b) => {
      return a.name.localeCompare(b.name)
    })
    for (let j = 0; j < getFiles.length; j++) {
      const file = getFiles[j]
      filesInformation.push({
        fileName: file.name,
        fileId: file.entityId ?? 'null',
        fileLink:'https://arweave.net/'+file.dataTxId+file.txId,
      })
    }
    Files.push({
      folderName,
      folderLink: LINK_TO_FOLDERS + folderId,
      filesInformation
    })
  }
  fs.writeFileSync(`./output/ardrive_drive_content.json`, JSON.stringify(Files))
}

main().catch((e) => { console.error(`[test] error: ${JSON.stringify(e.message)}`)});
