// cloudinary.config.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    if (!fileBuffer || fileBuffer.length === 0) {
      return reject(new Error('El archivo está vacío'));
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder: 'divvyup/users' },
      (error, result) => {
        if (error) {
          console.error('Error subiendo la imagen a Cloudinary:', error);
          return reject(new Error('Error subiendo la imagen'));
        }

        resolve(result.secure_url);
      }
    );
    stream.end(fileBuffer);  // Pasamos el buffer de la imagen
  });
};

module.exports = uploadToCloudinary;
