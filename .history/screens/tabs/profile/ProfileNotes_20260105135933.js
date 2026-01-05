import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Animated,
} from "react-native";
import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../../../context/LanguageContext";
import { useTheme } from "../../../context/ThemeContext";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { LinearGradient } from "expo-linear-gradient";

import { useProfileScreen } from "../../../context/ProfileScreenContext";
export default function ProfileNotes() {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const {
    message,
    setMessage,
    notes,
    loadingNotes,
    isEditable,
    setIsEditable,
    formatDate,
    modalVisibleNotesAdd,
    modalVisibleNotes,
    setModalVisibleNotesAdd,
    setModalVisibleNotes,
    fetchNotes,
    handleAddNote,
    handleUpdateNote,
    handleDeleteNote,
    selectedNote,
    setSelectedNote,
    setNoteContent,
    noteContent,
    backgroundColorNotes,
    borderColorNotes,
    setBorderColorNotes,
    setBackgroundColorNotes,
  } = useProfileScreen();

  // ...existing code...
  const [scaleValues, setScaleValues] = useState({});

  // Initialize scale values for each note when notes change
  useEffect(() => {
    const newScaleValues = {};
    notes.forEach((note) => {
      newScaleValues[note.id] = new Animated.Value(1);
    });
    setScaleValues(newScaleValues);
  }, [notes]);

  const onPressIn = (noteId) => {
    Animated.timing(scaleValues[noteId], {
      toValue: 0.9,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = (noteId) => {
    Animated.timing(scaleValues[noteId], {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };
  const notesConfigurations = () => {
    const colorPairs = [
      { color: "blue", background: "blueBackground" },
      { color: "green", background: "greenBackground" },
      { color: "red", background: "redBackground" },
      { color: "orange", background: "orangeBackground" },
      { color: "yellow", background: "yellowBackground" },
      { color: "purple", background: "purpleBackground" },
      { color: "pink", background: "pinkBackground" },
      { color: "aqua", background: "aquaBackground" },
      { color: "teal", background: "tealBackground" },
    ];

    return (
      <View
        style={{
          flexDirection: "row",
          gap: 5,
          alignItems: "center",
          justifyContent: "space-around",
          flexWrap: "wrap",
        }}
      >
        {colorPairs.map(({ color, background }) => (
          <TouchableOpacity
            key={color}
            onPress={() => {
              setBorderColorNotes(theme.notesColor[color]);
              setBackgroundColorNotes(theme.notesColor[background]);
            }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: theme.notesColor[color],
                borderWidth:
                  borderColorNotes === theme.notesColor[color] ? 2 : 0,
                borderColor: theme.text.primary,
              }}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  {
    loadingNotes && (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
        {t.profileScreen.Notes.notes}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20 }}
      >
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <TouchableOpacity onPress={() => setModalVisibleNotesAdd(true)}>
            <View
              style={{
                width: 70,
                height: 70,
                padding: 5,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.border,
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: theme.secondary,
              }}
            >
              <FontAwesome6 name="plus" size={24} color={theme.border} />
            </View>
          </TouchableOpacity>
          {notes && notes.length > 0 ? (
            notes.map((note, index) => (
              <View key={note.id}>
                <TouchableOpacity
                  onPressIn={() => onPressIn(note.id)}
                  onPressOut={() => onPressOut(note.id)}
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedNote(note);
                    setNoteContent(note.content);
                    setBorderColorNotes(note.color);
                    setBackgroundColorNotes(note.backgroundColor);
                    setModalVisibleNotes(true);
                  }}
                >
                  <Animated.View
                    style={{
                      width: 120,
                      height: 120,
                      paddingTop: 8,
                      paddingHorizontal: 8,
                      paddingBottom: 12,
                      borderRadius: 12,
                      borderBottomRightRadius: 30,
                      borderWidth: 1,
                      borderColor: note.color,
                      alignItems: "center",
                      //backgroundColor: note.backgroundColor || theme.secondary, // Fallback ekleyelim
                      transform: [{ scale: scaleValues[note.id] || 1 }],
                    }}
                  >
                    <Text
                      style={[{ color: theme.text.secondary }]}
                      numberOfLines={6}
                    >
                      {note.content}
                    </Text>

                    {note.updatedAt == note.createdAt ? (
                      <Text
                        style={[
                          {
                            position: "absolute",
                            bottom: 5,
                            color: theme.text.secondary,
                            fontSize: 8,
                            fontStyle: "italic",
                          },
                        ]}
                      >
                        {`Oluşturuldu: ${formatDate(note.createdAt)}`}
                      </Text>
                    ) : (
                      <Text
                        style={[
                          {
                            position: "absolute",
                            bottom: 5,
                            color: theme.text.secondary,
                            fontSize: 8,
                            fontStyle: "italic",
                          },
                        ]}
                      >
                        {`Düzenlendi: ${formatDate(note.updatedAt)}`}
                      </Text>
                    )}
                  </Animated.View>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={{ color: theme.text.muted, marginLeft: 10 }}>
              {t.profileScreen.noNotes || t.profileScreen.Notes.noNotesAddedYet}
            </Text>
          )}
        </View>
      </ScrollView>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisibleNotesAdd}
        onRequestClose={() => setModalVisibleNotesAdd(false)}
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={["transparent", theme.shadow, theme.shadow]}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
              zIndex: 4,
            }}
          />
          <TouchableOpacity
            onPress={() => setModalVisibleNotesAdd(false)}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
              zIndex: 5,
            }}
          />
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: backgroundColorNotes,
                zIndex: 6,
                shadowColor: theme.shadow,
                borderColor: borderColorNotes,
                borderWidth: 2,
              },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.between,
                  color: theme.text.primary,
                },
              ]}
              multiline
              placeholder={t.ChatModal.placeholder}
              placeholderTextColor={theme.text.muted}
              value={message}
              onChangeText={(text) => setMessage(text)}
            />
            <View
              style={{
                flexDirection: "row",
                gap: 15,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {notesConfigurations()}
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.modalContentSaveButton,
              {
                width: "95%",
                borderBottomLeftRadius: 20,
                borderBottomRightRadius: 20,
                backgroundColor: borderColorNotes,
                zIndex: 6,
                shadowColor: theme.shadow,
                flexDirection: "row",
                gap: 5,
              },
            ]}
            onPress={() => handleAddNote()}
          >
            <Text
              style={[
                styles.input,
                {
                  color: theme.text.primary,
                  fontWeight: "bold",
                },
              ]}
            >
              {t.profileScreen.Notes.notesSave}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisibleNotes}
        onRequestClose={() => {
          setModalVisibleNotes(false);
          setIsEditable(false);
        }}
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={["transparent", theme.shadow, theme.shadow]}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
              zIndex: 4,
            }}
          />
          <TouchableOpacity
            onPress={() => {
              setModalVisibleNotes(false);
              setIsEditable(false);
            }}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              left: 0,
              bottom: 0,
              zIndex: 5,
            }}
          />
          {selectedNote && (
            <>
              <View
                style={[
                  styles.modalContent,
                  {
                    backgroundColor: backgroundColorNotes, // Fallback ekleyelim
                    zIndex: 6,
                    shadowColor: theme.shadow,
                    borderColor: borderColorNotes,
                    borderWidth: 2,
                  },
                ]}
              >
                <TextInput
                  style={[
                    styles.input,
                    {
                      borderColor: theme.between,
                      color: theme.text.primary,
                    },
                  ]}
                  multiline
                  editable={isEditable}
                  placeholder={t.ChatModal.placeholder}
                  placeholderTextColor={theme.text.muted}
                  value={noteContent}
                  onChangeText={(text) => setNoteContent(text)}
                />

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-around",
                  }}
                >
                  <Text
                    style={[
                      {
                        color: theme.text.muted,
                        fontSize: 10,
                      },
                    ]}
                  >
                    {`Oluşturuldu: ${formatDate(selectedNote.createdAt)}`}
                  </Text>
                  {selectedNote.updatedAt !== selectedNote.createdAt && (
                    <Text
                      style={[
                        {
                          color: theme.text.muted,
                          fontSize: 8,
                          fontStyle: "italic",
                        },
                      ]}
                    >
                      {`Düzenlendi: ${formatDate(selectedNote.updatedAt)}`}
                    </Text>
                  )}
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    gap: 15,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <TouchableOpacity onPress={() => setIsEditable(!isEditable)}>
                    <FontAwesome
                      name="pencil-square"
                      size={24}
                      color={isEditable ? theme.colors.green : borderColorNotes}
                    />
                  </TouchableOpacity>

                  {notesConfigurations()}
                </View>
              </View>
              <View style={{ flexDirection: "row", width: "95%" }}>
                <TouchableOpacity
                  style={[
                    styles.modalContentSaveButton,
                    {
                      borderBottomLeftRadius: 20,
                      width: "33.33%",
                      backgroundColor: borderColorNotes,
                      zIndex: 6,
                      shadowColor: theme.shadow,

                      flexDirection: "row",
                      gap: 5,
                    },
                  ]}
                  onPress={() => setIsEditable(!isEditable)}
                >
                  <Text
                    style={[
                      styles.input,
                      {
                        color: theme.text.primary,
                        fontWeight: "bold",
                      },
                    ]}
                  >
                    {t.profileScreen.Notes.notesEdit}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalContentSaveButton,
                    {
                      width: "33.33%",

                      backgroundColor: borderColorNotes,
                      zIndex: 6,
                      shadowColor: theme.shadow,

                      flexDirection: "row",
                      gap: 5,
                    },
                  ]}
                  onPress={() => handleDeleteNote(selectedNote.id)}
                >
                  <Text
                    style={[
                      styles.input,
                      {
                        color: theme.text.primary,
                        fontWeight: "bold",
                      },
                    ]}
                  >
                    {t.profileScreen.Notes.notesDelete}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalContentSaveButton,
                    {
                      width: "33.33%",
                      borderBottomRightRadius: 20,
                      backgroundColor: borderColorNotes,
                      zIndex: 6,
                      shadowColor: theme.shadow,

                      flexDirection: "row",
                      gap: 5,
                    },
                  ]}
                  onPress={() => handleUpdateNote(selectedNote.id)}
                >
                  <Text
                    style={[
                      styles.input,
                      {
                        color: theme.text.primary,
                        fontWeight: "bold",
                      },
                    ]}
                  >
                    {t.profileScreen.Notes.notesSave}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 20,
    textTransform: "uppercase",
  },
  section: { width: "100%", height: 150, marginBottom: 10 },
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  modalContent: {
    width: "95%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    bottom: 10,
    paddingVertical: 10,
    paddingHorizontal: 15,
    gap: 10,
    justifyContent: "center",
    //alignItems: "center",
    elevation: 5, // Android için gölge
    shadowColor: "#000", // iOS için gölge
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  modalContentSaveButton: {
    backgroundColor: "#fff",

    bottom: 10,
    paddingVertical: 0,
    paddingHorizontal: 15,
    gap: 10,
    justifyContent: "center",
    //alignItems: "center",
    elevation: 5, // Android için gölge
    shadowColor: "#000", // iOS için gölge
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  input: {
    maxHeight: 400,
    borderColor: "#ccc",
    borderRadius: 15,
    padding: 5,
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    zIndex: 999,
  },
});
