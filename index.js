const express = require('express');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');
const app = express();
const PORT = 5001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get('/get_file/:filename', getFileByName);
function getFileByName(req, res) {
  const fileName = req.params.filename;
  if (!fileName) {
    fs.readdir('uploads', (err, files) => {
      if (err) {
        res.status(500).json({ message: 'Error reading directory' });
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

app.post('/brainexonapi-d7621/us-central1/upload_files', upload.array('files'), uploadFiles);
function uploadFiles(req, res) {
  console.log(req.body);
  console.log(req);
  res.json({ message: 'Successfully uploaded files' });
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
