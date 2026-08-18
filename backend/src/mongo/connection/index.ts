import mongoose from 'mongoose';

let dbUrl = process.env.MONGO_URL;
let mongodb: { getUri: () => string; stop: () => Promise<unknown> } | undefined;

export const connectDB = async () => {
  mongoose.set('strictQuery', false);

  try {
    if (process.env.NODE_ENV === 'test') {
      // Required lazily: mongodb-memory-server is a devDependency and is absent
      // from the production image, which installs with --prod.
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongodb = await MongoMemoryServer.create();
      dbUrl = mongodb.getUri();
      console.log(dbUrl);
    }

    await mongoose.connect(dbUrl as string);
    const mongo = mongoose.connection;
    mongo.on('error', (error) => console.error(error));
  } catch (e) {
    // Rethrow, don't swallow: createAuth() reads mongoose.connection.db right
    // after this resolves. Swallowing let the server "start" with an undefined
    // db, logging success while every request 401s and the deploy went green.
    console.error(e);
    throw e;
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    if (mongodb) {
      await mongodb.stop();
    }
  } catch (err) {
    console.log(err);
  }
};
