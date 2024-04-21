// curl upload a file to arweave chain via ardrive
const { exec } = require('child_process');

// const folderID = prompt("insert the folder id ");
const curlCommand = 'ardrive upload-file --wallet-file jwk_token.json --parent-folder-id "152e2070-d9e1-454b-bc69-2bc5e885637a" --local-path tqy_hello_world.txt --dest-file-name "hello_world_tqy.txt"';
console.log(`cmd: ${curlCommand}`);
exec(curlCommand, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(`[CURL] stdout: ${stdout}`);
});
