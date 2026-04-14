const ImageKit = require("imagekit");

const getSanitizedEnv = (key) => {
  const rawValue = process.env[key];

  if (typeof rawValue !== "string") {
    return "";
  }

  return rawValue.trim().replace(/^['"]|['"]$/g, "");
};

const requiredKeys = [
  "IMAGEKIT_PUBLIC_KEY",
  "IMAGEKIT_PRIVATE_KEY",
  "IMAGEKIT_URL_ENDPOINT",
];

const imageKitConfig = {
  publicKey: getSanitizedEnv("IMAGEKIT_PUBLIC_KEY"),
  privateKey: getSanitizedEnv("IMAGEKIT_PRIVATE_KEY"),
  urlEndpoint: getSanitizedEnv("IMAGEKIT_URL_ENDPOINT"),
};

const missingKeys = requiredKeys.filter((key) => {
  if (key === "IMAGEKIT_PUBLIC_KEY") {
    return !imageKitConfig.publicKey;
  }

  if (key === "IMAGEKIT_PRIVATE_KEY") {
    return !imageKitConfig.privateKey;
  }

  return !imageKitConfig.urlEndpoint;
});

if (missingKeys.length > 0) {
  throw new Error(
    `ImageKit configuration is incomplete. Missing: ${missingKeys.join(", ")}`,
  );
}

const imagekit = new ImageKit(imageKitConfig);

module.exports = imagekit;
