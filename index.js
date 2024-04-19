// server.js
const express = require('express');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

const app = express();
const PORT = 3005;
//app.use(onlyJson);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/upload_files', upload.array('files'), uploadFiles);

function uploadFiles(req, res) {
  console.log(req.body);
  console.log(req.files);
  res.json({ message: 'Successfully uploaded files' });
}

app.listen(PORT, () => {
  console.log(`Server listening on PORT: ${PORT}`);
});
