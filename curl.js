// curl upload a file to arweave chain via ardrive
const { exec } = require('child_process');

// const folderID = prompt("insert the folder id ");
// ardrive upload-file --wallet-file jwk_token.json --parent-folder-id "152e2070-d9e1-454b-bc69-2bc5e885637a" --local-path hello_world_toqyn.txt  --dest-file-name "hello_world_toqyn_2.txt"
const curlCommand = `ardrive upload-file --wallet-file jwk_token.json --parent-folder-id "<parent_folder_id" --local-path <image_path> --dest-file-name "<image_filename>"`;
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
