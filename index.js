const express = require("express");
const fs = require("fs");
const multer = require("multer");
const { GoogleAuth } = require("google-auth-library");
const speech = require("@google-cloud/speech");
const textToSpeech = require("@google-cloud/text-to-speech");
const { Translate } = require("@google-cloud/translate").v2;
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");
require("dotenv").config();

const { uploadFile } = require("./firebase");

const upload = multer({ storage: multer.memoryStorage() });

const decodeAndInitAuth = async () => {
  const encodedFilePath = path.join(__dirname, "./keys/encodedfile.txt");
  const encryptedContent = fs.readFileSync(encodedFilePath, "utf8");
  const decipher = crypto.createDecipher("aes-256-cbc", process.env.SECRET_KEY);
  let decrypted = decipher.update(encryptedContent, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return new GoogleAuth({
    credentials: {
      client_email: "useapis@chitchat-425ea.iam.gserviceaccount.com",
      private_key: decrypted,
    },
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
};

const getAuthClient = async () => {
  const auth = await decodeAndInitAuth();
  return await auth.getClient();
};

const getSpeechClient = async () => {
  const authClient = await getAuthClient();
  return new speech.SpeechClient({ authClient });
};

const getTextToSpeechClient = async () => {
  const authClient = await getAuthClient();
  return new textToSpeech.TextToSpeechClient({ authClient });
};

const getTranslateClient = async () => {
  const authClient = await getAuthClient();
  return new Translate({ authClient });
};

const createApp = (authClient) => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const requestLogger = (req, res, next) => {
    console.log(
      `${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
    );
    next();
  };

  const errorLogger = (err, req, res, next) => {
    console.error(`${new Date().toISOString()} - ${err.stack}`);
    next(err);
  };

  app.use(requestLogger);
  app.use(errorLogger);

  app.post("/transcribe", upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      const audioBytes = req.file.buffer.toString("base64");
      const languageCode = req.body.languageCode || "en-US";

      const audio = { content: audioBytes };
      const config = {
        encoding: "MP3",
        sampleRateHertz: 16000,
        languageCode: languageCode,
      };
      const request = { audio: audio, config: config };

      const speechClient = await getSpeechClient();
      const [response] = await speechClient.recognize(request);
      const transcription = response.results
        .map((result) => result.alternatives[0].transcript)
        .join("\n");

      res.json({ transcription });
    } catch (error) {
      console.error("ERROR:", error);
      res
        .status(500)
        .json({ error: "An error occurred during transcription." });
    }
  });

  app.post("/synthesize", async (req, res) => {
    const { text, languageCode } = req.body;

    try {
      const request = {
        input: { text: text },
        voice: { languageCode: languageCode || "en-US", ssmlGender: "NEUTRAL" },
        audioConfig: { audioEncoding: "MP3" },
      };

      const textToSpeechClient = await getTextToSpeechClient();
      const [response] = await textToSpeechClient.synthesizeSpeech(request);

      res.set("Content-Type", "audio/mp3");
      res.send(response.audioContent);
    } catch (error) {
      console.error("ERROR:", error);
      res
        .status(500)
        .json({ error: "An error occurred during text-to-speech synthesis." });
    }
  });

  app.post("/translate", async (req, res) => {
    try {
      const { text, sourceLanguage, targetLanguage } = req.body;

      if (!text || !sourceLanguage || !targetLanguage) {
        return res.status(400).json({ error: "Missing required parameters." });
      }

      const translateClient = await getTranslateClient();
      const [translation] = await translateClient.translate(text, {
        from: sourceLanguage,
        to: targetLanguage,
      });

      res.json({ translation });
    } catch (error) {
      console.error("ERROR:", error);
      res.status(500).json({ error: "An error occurred during translation." });
    }
  });

  // File upload endpoint
  app.post("/storage/file", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded." });
      }

      const fileName = req.file.originalname;
      const fileBuffer = req.file.buffer;
      const fileUrl = await uploadFile(fileName, fileBuffer);

      res.json({ fileUrl });
    } catch (error) {
      console.error("ERROR:", error);
      res.status(500).json({ error: "An error occurred while uploading." });
    }
  });

  return app;
};

const main = async () => {
  const authClient = await getAuthClient();

  const app = createApp(authClient);
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
};

main();
