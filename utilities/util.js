const fs = require('fs');

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

module.exports = {
  getEntityIdByType,
  writeFile,
  readFile
};
