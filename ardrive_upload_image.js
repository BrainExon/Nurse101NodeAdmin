const express = require('express');
const multer = require('multer');
require('dotenv').config();
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const {
  readJWKFile,
  arDriveFactory,
  wrapFileOrFolder,
  EID
} = require('ardrive-core-js');
require('dotenv').config();
const ps = require('prompt-sync');
const prompt = ps()

//read wallet from file
const main = async() => {
  const myWallet = readJWKFile('./jwk_token.json');
  const arDrive = arDriveFactory({ wallet: myWallet })
  const folderID = process.env.ARDRIVE_IMAGES_FOLDER_ID;
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
  if (foldersId && Array.isArray(folderID)) {
    for (let i = 0; i < foldersId.length; i++) {
      const folderId = foldersId[i].folderId
      const folderName = foldersId[i].folderName
      console.error(`[listPublicFolder] error: ${JSON.stringify(e.message)}`);
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

    //create an array for eachFoldername
    const filesInformation = []

    // Format here
    getFiles.sort((a, b) => {
      return a.name.localeCompare(b.name)
    })

    for (let j = 0; j < getFiles.length; j++) {
      const file = getFiles[j]
      filesInformation.push({
        fileName: file.name,
        //fileId: file.fileId?.entityId ?? 'null',
        fileId: file.entityId ?? 'null',
        //fileLink:'https://arweave.net/'+file.dataTxId.transactionId
        fileLink:'https://arweave.net/'+file.dataTxId+file.txId,
      })
    }

    Files.push({
      folderName,
      folderLink: LINK_TO_FOLDERS + folderId,
      filesInformation
    })

  }
  fs.writeFileSync(`ardrive_drive_content.json`, JSON.stringify(Files))
}

main().catch((e) => { console.error(`[test] error: ${JSON.stringify(e.message)}`)});
