// __tests__/helpers/glassPressRoomScan.js
//
// "Basınca büyüyen cam" bekçisinin kaynak tarayıcısı (test değil, yardımcı modül).
// iOS 26 etkileşimli cam (isInteractive) dokununca kendi kutusunun DIŞINA esner;
// kırpan bir kap (ScrollView / FlatList, overflow: "hidden") kenarındaki cam düğmeyi
// o an keser. Taranan iki kural:
//
//   1. Cam düğme içeren YATAY kaydırma satırının içerik kabında üstte ve altta en az
//      GLASS_PRESS_ROOM dolgu var (utils/liquidGlass). Yan kenarlar statik olarak
//      bilinemez (satırın ekran kenarına mı dayandığı yerleşime bağlı); onlara elle
//      bakılır.
//   2. Cam düğmenin KENDİ stilinde koşulsuz `overflow: "hidden"` yok: cam katmanı
//      düğmenin çocuğu, düğme kırparsa basılınca kendi sınırında kesilir.
//
// "Cam düğme" = etkileşimli cam çizen sarmalayıcılar (GLASS_BUTTONS) + kök öğesi
// bunlardan biri olan bileşenler (aynı dosyada tanımlı ya da göreli / @components
// importuyla bulunan; tek bir View sarmalayıcısı atlanır).
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const ROOT = path.join(__dirname, "..", "..");

/** Etkileşimli cam çizen yapı taşları (useGlassChrome / GlassSurface interactive). */
const GLASS_BUTTONS = new Set([
  "GlassTouchable",
  "GlassPressable",
  "GlassIconButton",
  "GlassPillButton",
  "GlassCloseButton",
  "BackButton",
  "PressableScale",
  "ChatCreateFab",
  "AuthPressable",
  "AuthPrimaryButton",
  "AuthSecondaryButton",
  "AuthBackButton",
]);

/** Stil alan ve cam kararını stilden veren sarmalayıcılar (kural 2). */
const STYLED_GLASS = new Set(["GlassTouchable", "GlassPressable", "PressableScale", "AuthPressable"]);

const LIST_RE = /^(Animated\.|Reanimated\.)?(ScrollView|FlatList|SectionList)$/;

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
  return files;
}

const relOf = (file) => path.relative(ROOT, file).split(path.sep).join("/");

const nameOf = (n) =>
  n.type === "JSXIdentifier" ? n.name : n.type === "JSXMemberExpression" ? `${nameOf(n.object)}.${n.property.name}` : "?";

const attrOf = (opening, name) =>
  opening.attributes.find((a) => a.type === "JSXAttribute" && a.name.name === name);

// ── Dosya modeli (önbellekli) ────────────────────────────────────────────────

const cache = new Map();

function load(file, room) {
  if (cache.has(file)) return cache.get(file);
  const src = fs.readFileSync(file, "utf8");
  const ast = parser.parse(src, {
    sourceType: "module",
    plugins: ["jsx", "classProperties", "optionalChaining", "nullishCoalescingOperator"],
  });

  // Üst düzey sayısal sabitler (const CHIP_GAP = 8) — stil ifadelerini hesaplamak için.
  const consts = { GLASS_PRESS_ROOM: room };
  for (const stmt of ast.program.body) {
    const decl = stmt.type === "ExportNamedDeclaration" ? stmt.declaration : stmt;
    if (!decl || decl.type !== "VariableDeclaration") continue;
    for (const d of decl.declarations) {
      if (d.id.type === "Identifier" && d.init) {
        const v = evalNum(d.init, consts);
        if (Number.isFinite(v)) consts[d.id.name] = v;
      }
    }
  }

  const sheets = {};
  const imports = {};
  const components = {}; // ad → kök JSX öğesi
  let defaultExport = null;
  traverse(ast, {
    ImportDeclaration(p) {
      for (const spec of p.node.specifiers) {
        imports[spec.local.name] = {
          source: p.node.source.value,
          imported: spec.type === "ImportDefaultSpecifier" ? "default" : spec.imported?.name,
        };
      }
    },
    VariableDeclarator(p) {
      const init = p.node.init;
      if (
        init &&
        init.type === "CallExpression" &&
        init.callee.type === "MemberExpression" &&
        init.callee.object.name === "StyleSheet" &&
        init.callee.property.name === "create" &&
        init.arguments[0]?.type === "ObjectExpression"
      ) {
        const map = {};
        for (const prop of init.arguments[0].properties) {
          if (prop.type === "ObjectProperty" && prop.value.type === "ObjectExpression") {
            map[prop.key.name || prop.key.value] = prop.value;
          }
        }
        sheets[p.node.id.name] = map;
      }
    },
    "FunctionDeclaration|ArrowFunctionExpression|FunctionExpression"(p) {
      const name = componentName(p);
      if (!name || !/^[A-Z]/.test(name)) return;
      const root = returnedJsx(p.node);
      if (root) components[name] = root;
    },
    ExportDefaultDeclaration(p) {
      const d = p.node.declaration;
      if (d.type === "Identifier") defaultExport = d.name;
      else if ((d.type === "FunctionDeclaration" || d.type === "ClassDeclaration") && d.id) defaultExport = d.id.name;
      else if (d.type === "CallExpression") {
        const arg = d.arguments[0];
        if (arg?.type === "Identifier") defaultExport = arg.name;
        else if (arg?.type === "FunctionExpression" && arg.id) defaultExport = arg.id.name;
      }
    },
  });

  const model = { file, rel: relOf(file), src, ast, consts, sheets, imports, components, defaultExport };
  cache.set(file, model);
  return model;
}

function componentName(p) {
  const n = p.node;
  if (n.type === "FunctionDeclaration" && n.id) return n.id.name;
  if (n.type === "FunctionExpression" && n.id) return n.id.name;
  let q = p.parentPath;
  for (let i = 0; i < 3 && q; i += 1, q = q.parentPath) {
    if (q.node.type === "VariableDeclarator" && q.node.id.type === "Identifier") return q.node.id.name;
  }
  return null;
}

function returnedJsx(fn) {
  const body = fn.body;
  if (!body) return null;
  if (body.type === "JSXElement") return body;
  if (body.type !== "BlockStatement") return null;
  const returns = body.body.filter((s) => s.type === "ReturnStatement" && s.argument);
  const last = returns[returns.length - 1]?.argument;
  return last?.type === "JSXElement" ? last : null;
}

function resolveImport(model, source) {
  let base = null;
  if (source.startsWith(".")) base = path.resolve(path.dirname(model.file), source);
  else if (source.startsWith("@components/")) base = path.join(ROOT, "components", source.slice(12));
  if (!base) return null;
  for (const candidate of [base, `${base}.js`, path.join(base, "index.js")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

// ── Cam düğme mi? ────────────────────────────────────────────────────────────

const glassMemo = new Map();

function isGlassName(model, name, room, depth = 0) {
  if (GLASS_BUTTONS.has(name)) return true;
  if (depth > 6) return false;
  const key = `${model.file}#${name}`;
  if (glassMemo.has(key)) return glassMemo.get(key);
  glassMemo.set(key, false); // döngü koruması
  let result = false;
  if (model.components[name]) {
    let root = model.components[name];
    for (let hop = 0; hop < 2 && root; hop += 1) {
      const rootName = nameOf(root.openingElement.name);
      if (rootName !== name && isGlassName(model, rootName, room, depth + 1)) {
        result = true;
        break;
      }
      const kids = root.children.filter((c) => c.type === "JSXElement");
      root = (rootName === "View" || rootName === "Animated.View") && kids.length === 1 ? kids[0] : null;
    }
  } else if (model.imports[name]) {
    const { source, imported } = model.imports[name];
    const target = resolveImport(model, source);
    if (target) {
      const other = load(target, room);
      const exported = imported === "default" ? other.defaultExport : imported;
      if (exported) result = isGlassName(other, exported, room, depth + 1);
    }
  }
  glassMemo.set(key, result);
  return result;
}

// ── Stil çözümü ──────────────────────────────────────────────────────────────

function evalNum(node, consts) {
  if (!node) return NaN;
  switch (node.type) {
    case "NumericLiteral":
      return node.value;
    case "Identifier":
      return node.name in consts ? consts[node.name] : NaN;
    case "UnaryExpression":
      return node.operator === "-" ? -evalNum(node.argument, consts) : NaN;
    case "BinaryExpression": {
      const a = evalNum(node.left, consts);
      const b = evalNum(node.right, consts);
      if (node.operator === "+") return a + b;
      if (node.operator === "-") return a - b;
      if (node.operator === "*") return a * b;
      if (node.operator === "/") return a / b;
      return NaN;
    }
    default:
      return NaN;
  }
}

function objectProps(obj, consts) {
  const out = {};
  for (const prop of obj.properties) {
    if (prop.type !== "ObjectProperty") continue;
    const key = prop.key.name || prop.key.value;
    if (prop.value.type === "StringLiteral") out[key] = prop.value.value;
    else out[key] = evalNum(prop.value, consts);
  }
  return out;
}

/**
 * Stil ifadesini düz nesneye çözer. `conditional: false` → koşullu parçalar
 * (a && b, a ? b : c) yok sayılır: yalnız HER ZAMAN uygulanan stil.
 */
function resolveStyle(model, expr, { conditional = true } = {}) {
  if (!expr) return {};
  const again = (e) => resolveStyle(model, e, { conditional });
  switch (expr.type) {
    case "JSXExpressionContainer":
      return again(expr.expression);
    case "ObjectExpression":
      return objectProps(expr, model.consts);
    case "MemberExpression": {
      const sheet = expr.object.type === "Identifier" ? model.sheets[expr.object.name] : null;
      const node = sheet?.[expr.property.name || expr.property.value];
      return node ? objectProps(node, model.consts) : {};
    }
    case "ArrayExpression":
      return expr.elements.reduce((acc, el) => (el ? Object.assign(acc, again(el)) : acc), {});
    case "ConditionalExpression":
      return conditional ? Object.assign({}, again(expr.alternate), again(expr.consequent)) : {};
    case "LogicalExpression":
      return conditional ? again(expr.right) : {};
    case "ArrowFunctionExpression":
      return expr.body.type === "BlockStatement" ? {} : again(expr.body);
    default:
      return {};
  }
}

const sidePad = (s, side) => {
  const v = s[`padding${side}`] ?? s.paddingVertical ?? s.padding;
  return Number.isFinite(v) ? v : 0;
};

/** Satırın içerik kabının üst/alt dolgusunun küçüğü. */
function verticalRoom(model, listEl) {
  const cc = resolveStyle(model, attrOf(listEl.openingElement, "contentContainerStyle")?.value);
  let room = Math.min(sidePad(cc, "Top"), sidePad(cc, "Bottom"));
  if (room === 0 && !attrOf(listEl.openingElement, "contentContainerStyle")) {
    // İçerik tek bir View'a sarılmışsa dolgu onda olabilir.
    const kids = listEl.children.filter((c) => c.type === "JSXElement");
    if (kids.length === 1 && nameOf(kids[0].openingElement.name) === "View") {
      const st = resolveStyle(model, attrOf(kids[0].openingElement, "style")?.value);
      room = Math.min(sidePad(st, "Top"), sidePad(st, "Bottom"));
    }
  }
  return room;
}

function isHorizontal(opening) {
  const attr = attrOf(opening, "horizontal");
  if (!attr) return false;
  const expr = attr.value?.expression;
  return !(expr && expr.type === "BooleanLiteral" && expr.value === false);
}

// ── Kurallar ─────────────────────────────────────────────────────────────────

/**
 * Kural 1: cam düğmeli yatay satırlar ve dikey payları.
 * @returns {{rel: string, line: number, room: number}[]}
 */
function horizontalGlassRows(room) {
  const out = [];
  for (const file of sourceFiles()) {
    const model = load(file, room);
    traverse(model.ast, {
      JSXElement(p) {
        const opening = p.node.openingElement;
        if (!LIST_RE.test(nameOf(opening.name)) || !isHorizontal(opening)) return;
        const listNode = p.node;
        let hasGlass = false;
        const visit = {
          JSXElement(inner) {
            if (hasGlass) return inner.stop();
            const innerName = nameOf(inner.node.openingElement.name);
            // İç içe yatay satır kendi başına denetlenir.
            if (inner.node !== listNode && LIST_RE.test(innerName) && isHorizontal(inner.node.openingElement)) {
              inner.skip();
              return;
            }
            if (isGlassName(model, innerName, room)) hasGlass = true;
          },
        };
        p.traverse(visit);
        // renderItem={renderX}: aynı dosyadaki işlevin gövdesi de satırın içeriği.
        const renderItem = attrOf(opening, "renderItem")?.value?.expression;
        if (!hasGlass && renderItem?.type === "Identifier") {
          const binding = p.scope.getBinding(renderItem.name);
          binding?.path.traverse(visit);
        }
        if (!hasGlass) return;
        out.push({ rel: model.rel, line: opening.loc.start.line, room: verticalRoom(model, listNode) });
      },
    });
  }
  return out;
}

/**
 * Kural 2: kendi stilinde koşulsuz overflow:hidden olan cam düğmeler.
 * Dolgusu ve çerçevesi olmayan (camlaşmayan, örn. degrade) düğmeler sayılmaz.
 * @returns {{rel: string, line: number, name: string}[]}
 */
function selfClippingGlassButtons(room) {
  const out = [];
  for (const file of sourceFiles()) {
    const model = load(file, room);
    traverse(model.ast, {
      JSXElement(p) {
        const opening = p.node.openingElement;
        const name = nameOf(opening.name);
        if (!STYLED_GLASS.has(name)) return;
        const glassAttr = attrOf(opening, "glass");
        if (glassAttr?.value?.expression?.type === "BooleanLiteral" && glassAttr.value.expression.value === false) return;
        const styleExpr = attrOf(opening, "style")?.value;
        const always = resolveStyle(model, styleExpr, { conditional: false });
        if (always.overflow !== "hidden") return;
        const any = resolveStyle(model, styleExpr);
        const chrome = any.backgroundColor !== undefined || (Number.isFinite(any.borderWidth) && any.borderWidth > 0);
        if (!chrome) return;
        out.push({ rel: model.rel, line: opening.loc.start.line, name });
      },
    });
  }
  return out;
}

/** Bir dosyanın StyleSheet'indeki bir stilin çözülmüş değerleri. */
function sheetStyle(rel, sheet, key, room) {
  const model = load(path.join(ROOT, rel), room);
  const node = model.sheets[sheet]?.[key];
  return node ? objectProps(node, model.consts) : null;
}

module.exports = { ROOT, horizontalGlassRows, selfClippingGlassButtons, sheetStyle };
