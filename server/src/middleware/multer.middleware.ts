import multer from "multer";
import path from "path";


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'src/public');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extname = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extname);
  }
})


const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 10
  },
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf"]
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    }
    else {
      cb(new Error('Invalid file type'));
    }
  }
})


export default upload;
