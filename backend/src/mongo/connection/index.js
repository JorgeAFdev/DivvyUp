const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

let dbUrl = process.env.MONGO_URL;
let mongodb;

exports.connectDB = async () => {
  mongoose.set('strictQuery', false);

  try {
    if (process.env.NODE_ENV === 'test') {
      // Required lazily: mongodb-memory-server is a devDependency and is absent
      // from the production image, which installs with --prod.
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongodb = await MongoMemoryServer.create();
      dbUrl = mongodb.getUri();
      console.log(dbUrl);
    }

    await mongoose.connect(dbUrl);
    const mongo = mongoose.connection;
    mongo.on('error', (error) => console.error(error));
  } catch (e) {
    console.log(e);
  }
};

exports.disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    if (mongodb) {
      await mongodb.stop();
    }
  } catch (err) {
    console.log(err);
  }
};
