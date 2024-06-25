const admin = require("firebase-admin");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
require("dotenv").config();

const getDecodedCradentials = (decodefile) => {
  const encodedFilePath = path.join(__dirname, decodefile);
  const encryptedContent = fs.readFileSync(encodedFilePath, "utf8");

  const decipher = crypto.createDecipher(
    "aes-256-cbc",
    process.env.SECRET_KEY_FIREBASE
  );
  let decrypted = decipher.update(encryptedContent, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted);
};

admin.initializeApp({
  credential: admin.credential.cert(
    getDecodedCradentials("./keys/encodefirebasekey.txt")
  ),
  storageBucket: "chitchat-425ea.appspot.com",
});
const firebase_db = admin.firestore();
const firebase_bucket = admin.storage().bucket();

const uploadFile = async (fileName, fileBuffer) => {
  const folderName = "APIstorage";
  const filePath = `${folderName}/${fileName}`;
  const file = firebase_bucket.file(filePath);

  await file.save(fileBuffer);
  console.log(`File ${filePath} uploaded successfully.`);
  return filePath;
};
module.exports = { firebase_db, firebase_bucket, uploadFile };
