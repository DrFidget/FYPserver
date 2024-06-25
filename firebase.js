const admin = require("firebase-admin");
const serviceAccount = require("./keys/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "chitchat-425ea.appspot.com", // Replace with your actual storage bucket URL
});
const firebase_db = admin.firestore();
const firebase_bucket = admin.storage().bucket();

const uploadFile = async (fileName, fileBuffer) => {
  const file = firebase_bucket.file(fileName);
  await file.save(fileBuffer);
  console.log(`File ${fileName} uploaded successfully.`);
  return `gs://${firebase_bucket.name}/${fileName}`;
};

const downloadFile = async (fileName) => {
  const file = firebase_bucket.file(fileName);
  const destination = `./downloads/${fileName}`; // Replace with your desired download path
  await file.download({ destination });
  console.log(`File ${fileName} downloaded successfully.`);
  return destination;
};

module.exports = { firebase_db, firebase_bucket, uploadFile, downloadFile };
