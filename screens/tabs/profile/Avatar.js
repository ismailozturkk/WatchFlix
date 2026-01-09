// src/components/avatar/Avatar.js

import React, { useState } from "react";
import { View, Image, TouchableOpacity, StyleSheet, Text } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { UploadToCloudinary } from "./UploadToCloudinary";

const defaultAvatar = require("../../../assets/avatar/1.png");

const Avatar = () => {
  const [avatarUri, setAvatarUri] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      //  mediaTypes: [ImagePicker.MediaType.Images],

      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setLoading(true);
      const uri = result.assets[0].uri;
      const uploadedUrl = await UploadToCloudinary(uri);
      if (uploadedUrl) {
        setAvatarUri(uploadedUrl);
      }
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
        <Image
          source={avatarUri ? { uri: avatarUri } : defaultAvatar}
          style={styles.avatar}
        />
        <View style={styles.cameraBadge}>
          <Text style={styles.cameraText}>📷</Text>
        </View>
      </TouchableOpacity>
      {loading && <Text style={styles.loadingText}>Yükleniyor...</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { alignItems: "center", marginTop: 20 },
  avatarWrapper: { position: "relative" },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: "#ddd",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#007AFF",
    borderRadius: 20,
    padding: 5,
    borderWidth: 2,
    borderColor: "#fff",
  },
  cameraText: { fontSize: 16, color: "#fff" },
  loadingText: { marginTop: 10, color: "#555" },
});

export default Avatar;
