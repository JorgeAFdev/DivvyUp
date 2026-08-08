// multer.config.js
import multer from 'multer';

// Almacenamiento en memoria para manejar los archivos en buffer
const storage = multer.memoryStorage(); 

const upload = multer({ storage: storage });

export default upload;
