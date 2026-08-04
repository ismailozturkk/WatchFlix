const t = require("@babel/types");

/**
 * Uygulama kaynaklarındaki react-native Text/TextInput kullanımlarını merkezi
 * tipografi bileşenlerine yönlendirir. Böylece yeni ekranlar da tek tek import
 * disiplini gerektirmeden uygulama fontu ayarına otomatik olarak katılır.
 *
 * Kapsanan biçimler:
 *   import { Text, TextInput } from "react-native"      (takma adlı hâli dahil)
 *   import * as RN from "react-native";  RN.Text        (JSX olarak da)
 *   Animated.Text / <Animated.Text>                     (react-native)
 *   Reanimated.Text / <Reanimated.Text>                 (react-native-reanimated)
 *
 * KAPSANMAYAN: node_modules içinde kendi Text'ini çizen kütüphaneler
 * (react-native-calendars, react-native-markdown-display, ...). Onlara font
 * ancak düz bir fontFamily dizesi geçirilerek uygulanır; bunun için
 * components/typography/AppText.js içindeki `useFontFamilyForRole` kullanılır.
 */
module.exports = function transformAppText() {
  return {
    name: "transform-app-text",
    visitor: {
      Program(path, state) {
        const filename = String(state.filename || "").replace(/\\/g, "/");
        if (
          filename.includes("/node_modules/") ||
          filename.endsWith("/components/typography/AppText.js") ||
          filename.endsWith("/scripts/babel-transform-app-text.js")
        ) {
          return;
        }

        const replacements = [];
        let nativeAnimatedLocal = null;
        let reanimatedLocal = null;
        let nativeNamespaceLocal = null;

        for (const statement of path.get("body")) {
          if (!statement.isImportDeclaration()) continue;
          const source = statement.node.source.value;

          if (source === "react-native") {
            const retained = [];
            for (const specifier of statement.node.specifiers) {
              if (
                t.isImportSpecifier(specifier) &&
                t.isIdentifier(specifier.imported, { name: "Text" })
              ) {
                replacements.push({
                  imported: "AppText",
                  local: specifier.local.name,
                });
              } else if (
                t.isImportSpecifier(specifier) &&
                t.isIdentifier(specifier.imported, { name: "TextInput" })
              ) {
                replacements.push({
                  imported: "AppTextInput",
                  local: specifier.local.name,
                });
              } else {
                if (
                  t.isImportSpecifier(specifier) &&
                  t.isIdentifier(specifier.imported, { name: "Animated" })
                ) {
                  nativeAnimatedLocal = specifier.local.name;
                } else if (t.isImportNamespaceSpecifier(specifier)) {
                  nativeNamespaceLocal = specifier.local.name;
                }
                retained.push(specifier);
              }
            }
            statement.node.specifiers = retained;
          }

          if (
            source === "react-native-reanimated" &&
            statement.node.specifiers.some((specifier) =>
              t.isImportDefaultSpecifier(specifier),
            )
          ) {
            reanimatedLocal = statement.node.specifiers.find((specifier) =>
              t.isImportDefaultSpecifier(specifier),
            ).local.name;
          }
        }

        const injected = new Map();
        const localFor = (imported) => {
          if (!injected.has(imported)) {
            injected.set(
              imported,
              path.scope.generateUidIdentifier(imported).name,
            );
          }
          return injected.get(imported);
        };

        // `<nesne>.<özellik>` ikilisinin hangi tipografi bileşenine karşılık
        // geldiğini söyler; eşleşme yoksa null.
        const hedefBileseni = (objectName, propertyName) => {
          if (objectName === nativeNamespaceLocal) {
            if (propertyName === "Text") return "AppText";
            if (propertyName === "TextInput") return "AppTextInput";
            return null;
          }
          if (propertyName !== "Text") return null;
          if (objectName === nativeAnimatedLocal) return "AnimatedAppText";
          if (objectName === reanimatedLocal) return "ReanimatedAppText";
          return null;
        };

        path.traverse({
          // Değer konumundaki kullanım: const X = Animated.Text
          MemberExpression(memberPath) {
            if (
              memberPath.node.computed ||
              !t.isIdentifier(memberPath.node.object) ||
              !t.isIdentifier(memberPath.node.property)
            ) {
              return;
            }
            const imported = hedefBileseni(
              memberPath.node.object.name,
              memberPath.node.property.name,
            );
            if (!imported) return;
            memberPath.replaceWith(t.identifier(localFor(imported)));
          },

          // JSX konumundaki kullanım: <Animated.Text>. AYRI bir düğüm türüdür
          // (JSXMemberExpression); MemberExpression visitor'ı bunu GÖRMEZ ve
          // JSX dönüşümü bu eklentiden SONRA çalıştığı için burada yakalanmazsa
          // metin AppText'e hiç uğramaz.
          JSXMemberExpression(memberPath) {
            if (
              !t.isJSXIdentifier(memberPath.node.object) ||
              !t.isJSXIdentifier(memberPath.node.property)
            ) {
              return;
            }
            const imported = hedefBileseni(
              memberPath.node.object.name,
              memberPath.node.property.name,
            );
            if (!imported) return;
            memberPath.replaceWith(t.jsxIdentifier(localFor(imported)));
          },
        });

        for (const [imported, local] of injected) {
          replacements.push({ imported, local });
        }
        if (replacements.length === 0) return;

        const specifiers = replacements.map(({ imported, local }) =>
          t.importSpecifier(t.identifier(local), t.identifier(imported)),
        );
        path.unshiftContainer(
          "body",
          t.importDeclaration(
            specifiers,
            t.stringLiteral("@components/typography/AppText"),
          ),
        );
      },
    },
  };
};
