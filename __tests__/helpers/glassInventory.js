// __tests__/helpers/glassInventory.js
//
// Liquid Glass kapsam bekçisinin kaynak tarayıcısı (test değil, yardımcı modül).
// Uygulama kaynağını babel ile ayrıştırır ve cama ÇEVRİLEBİLİR olup hâlâ HAM
// bırakılmış dokunulabilirleri (TouchableOpacity / Pressable) ve ham TextInput'ları
// sayar. Sınıflandırma, toplu dönüştürmede kullanılan kuralların aynısıdır:
//
//   cama aday = stilinde dolgu / çerçeve olan (ya da çözümlenemeyen) bir
//   dokunulabilir ve
//     • içinde görsel / gradyan / karmaşık bileşen yok (kart değil, düğme)
//     • içinde başka dokunulabilir yok
//     • liste satırı (renderItem / *Item, *Row, *Card, *Cell bileşeni) değil
//     • zaten bir camın (Glass*, ComposerBlur) içinde değil
//     • animasyonlu opaklıklı bir atası yok
//     • örtü / arka plan / renk örneği / önizleme değil
//
// Bu kurallar `components/common/useGlassChrome` + `utils/glassChrome` çalışma
// zamanı kararından ayrıdır: orası stilin gerçek değerine bakar, burası kaynağın
// yapısına.
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const ROOT = path.join(__dirname, "..", "..");
const TOUCH = new Set(["TouchableOpacity", "Pressable"]);
const ALL_TOUCH = new Set(["TouchableOpacity", "Pressable", "PressableScale", "GlassTouchable", "GlassPressable"]);
const ICONS = new Set(["Ionicons", "AppIcon", "Feather", "MaterialIcons", "MaterialCommunityIcons", "FontAwesome", "FontAwesome5", "AntDesign", "Entypo", "Octicons", "Icon"]);

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "__tests__"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
}

function sourceFiles() {
  const files = [];
  for (const dir of ["components", "screens"]) walk(path.join(ROOT, dir), files);
  return files.map((file) => ({ file, rel: path.relative(ROOT, file).split(path.sep).join("/") }));
}

const nameOf = (n) =>
  n.type === "JSXIdentifier" ? n.name : n.type === "JSXMemberExpression" ? nameOf(n.object) + "." + n.property.name : "?";

function litValue(node) {
  if (!node) return undefined;
  if (node.type === "NumericLiteral" || node.type === "StringLiteral") return node.value;
  return { dyn: true };
}

function objProps(obj) {
  const out = {};
  for (const prop of obj.properties) {
    if (prop.type === "ObjectProperty" && (prop.key.type === "Identifier" || prop.key.type === "StringLiteral")) {
      out[prop.key.name || prop.key.value] = litValue(prop.value);
    }
  }
  return out;
}

function parse(src) {
  return parser.parse(src, {
    sourceType: "module",
    plugins: ["jsx", "classProperties", "optionalChaining", "nullishCoalescingOperator"],
  });
}

function styleSheets(ast) {
  const sheets = {};
  traverse(ast, {
    VariableDeclarator(p) {
      const init = p.node.init;
      if (
        init && init.type === "CallExpression" && init.callee.type === "MemberExpression" &&
        init.callee.object.name === "StyleSheet" && init.callee.property.name === "create" &&
        init.arguments[0] && init.arguments[0].type === "ObjectExpression"
      ) {
        const map = {};
        for (const prop of init.arguments[0].properties) {
          if (prop.type === "ObjectProperty" && prop.value.type === "ObjectExpression") map[prop.key.name || prop.key.value] = objProps(prop.value);
        }
        sheets[p.node.id.name] = map;
      }
    },
  });
  return sheets;
}

function resolveStyle(expr, sheets) {
  if (!expr) return {};
  if (expr.type === "JSXExpressionContainer") return resolveStyle(expr.expression, sheets);
  if (expr.type === "ObjectExpression") return objProps(expr);
  if (expr.type === "MemberExpression" && expr.object.type === "Identifier" && sheets[expr.object.name]) {
    return sheets[expr.object.name][expr.property.name || expr.property.value] || { __unresolved: true };
  }
  if (expr.type === "ArrayExpression") {
    let merged = {};
    for (const el of expr.elements) if (el) merged = Object.assign(merged, resolveStyle(el, sheets));
    return merged;
  }
  if (expr.type === "ConditionalExpression") {
    return Object.assign({}, resolveStyle(expr.alternate, sheets), resolveStyle(expr.consequent, sheets));
  }
  if (expr.type === "LogicalExpression") return resolveStyle(expr.right, sheets);
  if (expr.type === "ArrowFunctionExpression") {
    return expr.body.type === "BlockStatement" ? { __unresolved: true } : resolveStyle(expr.body, sheets);
  }
  return { __unresolved: true };
}

function childInfo(el) {
  const info = { img: 0, other: 0, touch: 0, names: [] };
  const visit = (n) => {
    if (n.type === "JSXExpressionContainer") {
      const e = n.expression;
      [e, e.consequent, e.alternate, e.right].forEach((x) => x && (x.type === "JSXElement" || x.type === "JSXFragment") && visit(x));
      if (e.type === "CallExpression") e.arguments.forEach((a) => a.type === "ArrowFunctionExpression" && (a.body.type === "JSXElement" || a.body.type === "JSXFragment") && visit(a.body));
      return;
    }
    if (n.type === "JSXFragment") return n.children.forEach(visit);
    if (n.type !== "JSXElement") return;
    const nm = nameOf(n.openingElement.name);
    if (ALL_TOUCH.has(nm)) { info.touch++; return; }
    if (nm === "Text" || nm === "AppText" || nm === "Animated.Text" || ICONS.has(nm) || nm === "ActivityIndicator") return;
    if (nm === "View" || nm === "Animated.View") return n.children.forEach(visit);
    if (/Image|Poster|Covers|Avatar|LinearGradient|Lottie|Svg|Skeleton|VideoThumb/.test(nm)) { info.img++; info.names.push(nm); return; }
    info.other++; info.names.push(nm);
  };
  el.children.forEach(visit);
  return info;
}

function listScope(path_) {
  let p = path_.parentPath;
  while (p) {
    const n = p.node;
    if (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression" || n.type === "FunctionDeclaration") {
      const par = p.parent;
      if (par && par.type === "JSXExpressionContainer" && p.parentPath.parent && p.parentPath.parent.type === "JSXAttribute" && /^(renderItem|renderSectionHeader|renderSectionFooter)$/.test(p.parentPath.parent.name.name)) return true;
      if (par && par.type === "VariableDeclarator" && par.id && /^render.*(Item|Row|Card|Cell|Tile)/i.test(par.id.name || "")) return true;
      if (par && par.type === "CallExpression" && par.callee.name === "useCallback" && p.parentPath.parent && p.parentPath.parent.type === "VariableDeclarator" && /^render.*(Item|Row|Card|Cell|Tile)/i.test(p.parentPath.parent.id.name || "")) return true;
      if (n.type === "FunctionDeclaration" && n.id && /(Item|Row|Card|Cell|Tile)$/.test(n.id.name)) return true;
    }
    p = p.parentPath;
  }
  return false;
}

function insideGlass(path_) {
  let p = path_.parentPath;
  while (p) {
    if (p.node.type === "JSXElement") {
      const nm = nameOf(p.node.openingElement.name);
      if (/^(Glass|ComposerBlur|BlurView|AdaptiveBlurView)/.test(nm)) return true;
      for (const c of p.node.children) {
        if (c.type === "JSXElement" && /^(ComposerBlur|GlassField|GlassSurface|GlassBox)$/.test(nameOf(c.openingElement.name))) return true;
      }
    }
    p = p.parentPath;
  }
  return false;
}

function animatedOpacityAncestor(path_, sheets) {
  let p = path_.parentPath;
  while (p) {
    if (p.node.type === "JSXElement") {
      const op = p.node.openingElement;
      if (/Animated|Reanimated/.test(nameOf(op.name))) {
        const sa = op.attributes.find((a) => a.type === "JSXAttribute" && a.name.name === "style");
        const st = resolveStyle(sa && sa.value, sheets);
        if (st.opacity !== undefined && typeof st.opacity === "object") return true;
      }
    }
    p = p.parentPath;
  }
  return false;
}

/** Cama aday olup hâlâ ham TouchableOpacity/Pressable kalan siteler. */
function rawEligibleTouchables(src) {
  const ast = parse(src);
  const sheets = styleSheets(ast);
  const out = [];
  traverse(ast, {
    JSXElement(p) {
      const op = p.node.openingElement;
      const nm = nameOf(op.name);
      if (!TOUCH.has(nm)) return;
      const sa = op.attributes.find((a) => a.type === "JSXAttribute" && a.name.name === "style");
      const st = resolveStyle(sa && sa.value, sheets);
      const text = sa ? src.slice(sa.start, sa.end) : "";
      const chrome =
        (st.backgroundColor !== undefined && st.backgroundColor !== "transparent") ||
        (st.borderWidth !== undefined && st.borderWidth !== 0) ||
        !!st.__unresolved;
      if (!chrome) return;
      if (/absoluteFill|backdrop|overlay|scrim/i.test(text)) return;
      if (/swatch|colorDot|\bdot\b|presetSwatch|toneTile|preview|spoilerCover|Cover\b/i.test(text)) return;
      const info = childInfo(p.node);
      if (info.img || info.touch || info.other > 3) return;
      if (listScope(p) || insideGlass(p) || animatedOpacityAncestor(p, sheets)) return;
      out.push({ line: op.loc.start.line, tag: nm });
    },
  });
  return out;
}

/**
 * Cam bir kabuğun (GlassBox / GlassField / composer camı) İÇİNDE olmayan ham
 * <TextInput> siteleri. `GlassTextInput` zaten kendi camını çizer.
 */
function rawTextInputs(src) {
  const ast = parse(src);
  const out = [];
  traverse(ast, {
    JSXOpeningElement(p) {
      if (nameOf(p.node.name) !== "TextInput") return;
      let glassShell = false;
      let q = p.parentPath;
      while (q) {
        if (q.node.type === "JSXElement") {
          if (/^(GlassBox|GlassField|GlassTextInput)$/.test(nameOf(q.node.openingElement.name))) glassShell = true;
          if (q.node.children.some((c) => c.type === "JSXElement" && /^(ComposerBlur|GlassField|GlassSurface)$/.test(nameOf(c.openingElement.name)))) glassShell = true;
        }
        q = q.parentPath;
      }
      if (!glassShell) out.push({ line: p.node.loc.start.line });
    },
  });
  return out;
}

module.exports = { ROOT, sourceFiles, rawEligibleTouchables, rawTextInputs };
