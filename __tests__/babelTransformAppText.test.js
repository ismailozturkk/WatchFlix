// __tests__/babelTransformAppText.test.js
//
// Uygulama fontunun her metne ulaşmasının ön koşulu: derleme sırasında
// react-native Text/TextInput kullanımlarının merkezî tipografi bileşenlerine
// yönlenmesi. Bu dönüşüm sessizce eksik kalabilir — nitekim JSX'teki
// <Animated.Text> uzun süre yakalanmıyordu (JSXMemberExpression ayrı bir düğüm
// türü ve JSX dönüşümü bu eklentiden sonra çalışıyor). Test o boşluğun geri
// gelmesini engeller.
// @babel/core ve eklenti CommonJS: interop yerine doğrudan require.
const babel = require("@babel/core");
const plugin = require("../scripts/babel-transform-app-text");

const derle = (kaynak, dosya = "C:/proje/screens/Ornek.js") =>
  babel.transformSync(kaynak, {
    filename: dosya,
    plugins: [plugin],
    parserOpts: { plugins: ["jsx"] },
    configFile: false,
    babelrc: false,
  }).code;

describe("named import dönüşümü", () => {
  it("Text ve TextInput AppText/AppTextInput'a yönlenir", () => {
    const cikti = derle(`
      import { View, Text, TextInput } from "react-native";
      export default () => <View><Text>a</Text><TextInput /></View>;
    `);
    expect(cikti).toContain('from "@components/typography/AppText"');
    expect(cikti).toContain("AppText as Text");
    expect(cikti).toContain("AppTextInput as TextInput");
    // react-native import'unda artık Text kalmamalı, View kalmalı.
    expect(cikti).toMatch(/import\s*{\s*View\s*}\s*from\s*"react-native"/);
  });

  it("takma adlı import da yakalanır", () => {
    const cikti = derle(`
      import { Text as RNText } from "react-native";
      export default () => <RNText>a</RNText>;
    `);
    expect(cikti).toContain("AppText as RNText");
  });
});

describe("Animated.Text (asıl boşluk)", () => {
  it("JSX içindeki <Animated.Text> yakalanır", () => {
    const cikti = derle(`
      import { Animated, View } from "react-native";
      export default () => <View><Animated.Text style={s.a}>x</Animated.Text></View>;
    `);
    expect(cikti).toContain("AnimatedAppText");
    // Ham Animated.Text hiç kalmamalı — kalırsa o metin font ayarını almaz.
    expect(cikti).not.toMatch(/Animated\.Text/);
  });

  it("JSX içindeki <Reanimated.Text> yakalanır", () => {
    const cikti = derle(`
      import Reanimated from "react-native-reanimated";
      export default () => <Reanimated.Text>x</Reanimated.Text>;
    `);
    expect(cikti).toContain("ReanimatedAppText");
    expect(cikti).not.toMatch(/Reanimated\.Text/);
  });

  it("değer konumundaki Animated.Text de yakalanır", () => {
    const cikti = derle(`
      import { Animated } from "react-native";
      const T = Animated.Text;
      export default T;
    `);
    expect(cikti).toContain("AnimatedAppText");
    expect(cikti).not.toMatch(/Animated\.Text/);
  });

  it("Animated'ın diğer bileşenlerine dokunmaz", () => {
    const cikti = derle(`
      import { Animated } from "react-native";
      export default () => <Animated.View><Animated.Image /></Animated.View>;
    `);
    expect(cikti).toContain("Animated.View");
    expect(cikti).toContain("Animated.Image");
    expect(cikti).not.toContain("@components/typography/AppText");
  });
});

describe("namespace import", () => {
  it("RN.Text ve RN.TextInput yakalanır", () => {
    const cikti = derle(`
      import * as RN from "react-native";
      export default () => <RN.View><RN.Text>a</RN.Text><RN.TextInput /></RN.View>;
    `);
    expect(cikti).toContain("AppText");
    expect(cikti).toContain("AppTextInput");
    expect(cikti).toContain("RN.View");
    expect(cikti).not.toMatch(/RN\.Text/);
  });
});

describe("kapsam dışı bırakılanlar", () => {
  const kaynak = `
    import { Text } from "react-native";
    export default () => <Text>a</Text>;
  `;

  it("node_modules dokunulmadan kalır", () => {
    const cikti = derle(kaynak, "C:/proje/node_modules/paket/index.js");
    expect(cikti).not.toContain("@components/typography/AppText");
  });

  it("AppText'in kendisi dokunulmadan kalır (sonsuz döngü olurdu)", () => {
    const cikti = derle(kaynak, "C:/proje/components/typography/AppText.js");
    expect(cikti).not.toContain("@components/typography/AppText");
  });

  it("metin içermeyen dosyaya import eklenmez", () => {
    const cikti = derle(`
      import { View } from "react-native";
      export default () => <View />;
    `);
    expect(cikti).not.toContain("@components/typography/AppText");
  });
});
