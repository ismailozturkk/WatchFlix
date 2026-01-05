export const uploadToCloudinary = async (imageUri) => {
  const CLOUD_NAME = "djcnwzzqn";
  const UPLOAD_PRESET = "unsigned_avatar";

  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    type: "image/jpeg",
    name: "upload.jpg",
  });
  formData.append("upload_preset", UPLOAD_PRESET);
  formData.append("folder", "avatars");

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();
    return data.secure_url; // Yüklenen fotoğrafın URL'si
  } catch (error) {
    console.error("Cloudinary yükleme hatası:", error);
    return null;
  }
};
