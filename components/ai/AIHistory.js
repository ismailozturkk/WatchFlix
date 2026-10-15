// components/ai/AIHistory.js
//
// CineMatch sohbet geçmişi: aranabilir, zamana göre gruplu (bugün/dün/bu hafta/
// daha eski) ve her satırda son cevabın posterleri + son soru önizlemesi.
// "Tümünü sil" geri alınamadığı için satır içi onay ister (CineMatch bir Modal
// içinde olduğundan appAlert iOS'ta görünmez; onay bu yüzden ekranın içinde).

import React, { memo, useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, SectionList, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

import { alpha } from "../../theme/colors";
import {
  conversationPreview,
  filterConversations,
  formatRelativeTime,
  groupConversationsByRecency,
} from "../../services/aiCineInsights";

const SEARCH_MIN_CONVERSATIONS = 5;

const PosterStack = memo(({ posters, getTmdbUrl, theme }) => {
  if (!posters.length) {
    return (
      <View style={[s.iconBox, { backgroundColor: theme.primary }]}>
        <MaterialCommunityIcons name="movie-open-outline" size={20} color={theme.bold} />
      </View>
    );
  }
  return (
    <View style={[s.stack, { width: 30 + (posters.length - 1) * 16 }]}>
      {posters.map((path, index) => (
        <View
          key={`${path}-${index}`}
          style={[s.stackPoster, { left: index * 16, zIndex: posters.length - index, borderColor: theme.secondary, backgroundColor: theme.between }]}
        >
          <Image source={{ uri: getTmdbUrl(path, "poster", 92) }} style={s.stackImg} contentFit="cover" />
        </View>
      ))}
    </View>
  );
});

const Row = memo(({ conversation, isActive, theme, t, language, getTmdbUrl, onOpen, onDelete }) => {
  const preview = useMemo(() => conversationPreview(conversation), [conversation]);
  const count = conversation.messages?.length || 0;
  const when = formatRelativeTime(conversation.updatedAt, language);
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onOpen(conversation)}
      style={[
        s.row,
        { backgroundColor: isActive ? theme.between : theme.secondary, borderColor: isActive ? theme.bold : theme.border },
      ]}
    >
      <PosterStack posters={preview.posters} getTmdbUrl={getTmdbUrl} theme={theme} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[s.title, { color: theme.text.primary }]}>
          {conversation.title}
        </Text>
        {!!preview.lastUser && preview.lastUser !== conversation.title && (
          <Text numberOfLines={1} style={[s.preview, { color: theme.text.secondary }]}>
            {preview.lastUser}
          </Text>
        )}
        <Text style={[s.meta, { color: theme.text.muted }]}>
          {count} {t?.AICineChat?.messagesCount || "mesaj"}
          {when ? ` · ${when}` : ""}
        </Text>
      </View>
      <TouchableOpacity hitSlop={10} onPress={() => onDelete(conversation.id)} style={{ padding: 4 }}>
        <MaterialIcons name="delete-outline" size={20} color={theme.text.muted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

function AIHistory({ theme, t, copy, language, conversations, activeId, getTmdbUrl, onOpen, onDelete, onClearAll }) {
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState(false);

  const filtered = useMemo(() => filterConversations(conversations, query), [conversations, query]);
  const sections = useMemo(
    () =>
      groupConversationsByRecency(filtered).map((group) => ({
        key: group.bucket,
        title: copy.history.buckets[group.bucket],
        data: group.items,
      })),
    [filtered, copy],
  );

  const confirmClear = useCallback(() => {
    setConfirming(false);
    onClearAll();
  }, [onClearAll]);

  if (conversations.length === 0) {
    return (
      <View style={s.empty}>
        <MaterialCommunityIcons name="message-off-outline" size={46} color={theme.text.muted} />
        <Text style={[s.emptyText, { color: theme.text.muted }]}>
          {t?.AICineChat?.noConversations || "Henüz kayıtlı sohbet yok"}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {conversations.length >= SEARCH_MIN_CONVERSATIONS && (
        <View style={[s.search, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
          <Ionicons name="search" size={16} color={theme.text.muted} />
          <TextInput
            style={[s.searchInput, { color: theme.text.primary }]}
            value={query}
            onChangeText={setQuery}
            placeholder={copy.history.search}
            placeholderTextColor={theme.text.muted}
            selectionColor={theme.accent}
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity hitSlop={8} onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={17} color={theme.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {sections.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="search-outline" size={40} color={theme.text.muted} />
          <Text style={[s.emptyText, { color: theme.text.muted }]}>{copy.history.noResults}</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
          renderSectionHeader={({ section }) => (
            <Text style={[s.sectionTitle, { color: theme.text.muted }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <Row
              conversation={item}
              isActive={item.id === activeId}
              theme={theme}
              t={t}
              language={language}
              getTmdbUrl={getTmdbUrl}
              onOpen={onOpen}
              onDelete={onDelete}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListFooterComponent={
            <View style={s.footer}>
              {confirming ? (
                <View style={[s.confirm, { backgroundColor: alpha(theme.colors.red, 0.1), borderColor: alpha(theme.colors.red, 0.35) }]}>
                  <Text style={[s.confirmTitle, { color: theme.text.primary }]}>{copy.history.clearAllTitle}</Text>
                  <Text style={[s.confirmText, { color: theme.text.secondary }]}>{copy.history.clearAllMessage}</Text>
                  <View style={s.confirmRow}>
                    <TouchableOpacity
                      onPress={() => setConfirming(false)}
                      style={[s.confirmBtn, { borderColor: theme.border }]}
                    >
                      <Text style={[s.confirmBtnText, { color: theme.text.secondary }]}>{copy.history.cancel}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={confirmClear}
                      style={[s.confirmBtn, { borderColor: theme.colors.red, backgroundColor: alpha(theme.colors.red, 0.14) }]}
                    >
                      <Text style={[s.confirmBtnText, { color: theme.colors.red }]}>{copy.history.delete}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity onPress={() => setConfirming(true)} style={s.clearLink}>
                  <MaterialCommunityIcons name="delete-sweep-outline" size={18} color={theme.text.muted} />
                  <Text style={[s.clearText, { color: theme.text.muted }]}>{copy.history.clearAll}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

export default memo(AIHistory);

const s = StyleSheet.create({
  empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 10, padding: 30 },
  emptyText: { fontSize: 13, textAlign: "center" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  sectionTitle: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase", marginTop: 16, marginBottom: 8, marginLeft: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, borderWidth: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  stack: { height: 46, justifyContent: "center" },
  stackPoster: { position: "absolute", top: 0, width: 30, height: 45, borderRadius: 6, overflow: "hidden", borderWidth: 1.5 },
  stackImg: { width: "100%", height: "100%" },
  title: { fontSize: 14, fontWeight: "700" },
  preview: { fontSize: 12, marginTop: 2 },
  meta: { fontSize: 11, marginTop: 3 },
  footer: { marginTop: 20, alignItems: "center" },
  clearLink: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10 },
  clearText: { fontSize: 12.5, fontWeight: "600" },
  confirm: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 14 },
  confirmTitle: { fontSize: 14, fontWeight: "800" },
  confirmText: { fontSize: 12, marginTop: 3 },
  confirmRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  confirmBtn: { flex: 1, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  confirmBtnText: { fontSize: 13, fontWeight: "800" },
});
