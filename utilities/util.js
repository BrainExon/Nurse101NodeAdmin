const fs = require('fs');

function cleanString(inputString) {
  return inputString.replace(/\\n\s+/g, '').replace(/\\/g, '');
}

const getEntityIdByType = (data, key, callback) => {
  const folder = data.find(item => item.type === key);
  if (folder) {
    callback(null, folder.entityId);
  } else {
    callback(new Error('Folder not found'), null);
  }
};

const writeFile = (filePath, data, callback) => {
  fs.writeFile(filePath, data, (err) => {
    if (err) {
      callback(err);
    } else {
      callback(null);
    }
  });
};

const readFile = (filePath, callback) => {
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
      callback(err, null);
    } else {
      callback(null, data);
    }
  });
};

const isValidJSON = (input) => {
  try {
    JSON.parse(input);
    return true;
  } catch (error) {
    return false;
  }
};
module.exports = {
  getEntityIdByType,
  writeFile,
  readFile,
  cleanString,
  isValidJSON,
};
