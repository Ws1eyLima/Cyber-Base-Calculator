const statusMessage = document.querySelector("#status-message");
const tabButtons = document.querySelectorAll("[data-tool-target]");
const panels = document.querySelectorAll("[data-tool-panel]");

const baseInput = document.querySelector("#base-input");
const baseMode = document.querySelector("#base-mode");
const baseResults = document.querySelector("#base-results");

const networkInput = document.querySelector("#network-input");
const networkResults = document.querySelector("#network-results");

const textInput = document.querySelector("#text-input");
const textMode = document.querySelector("#text-mode");
const textResults = document.querySelector("#text-results");

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: false });

function normalizeInput(value) {
  return value.trim().replace(/\s+/g, "");
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function emptyState(container, message) {
  container.innerHTML = `<p class="empty-state">${message}</p>`;
}

function renderCards(container, items) {
  container.innerHTML = items
    .map(
      (item) => `
        <article class="result-card">
          <span>${item.label}</span>
          <output>${item.value}</output>
          <button type="button" class="copy-btn" data-copy-value="${escapeAttribute(item.value)}">
            Copiar
          </button>
        </article>
      `,
    )
    .join("");
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function cardText(container) {
  return Array.from(container.querySelectorAll(".result-card"))
    .map((card) => {
      const label = card.querySelector("span")?.textContent ?? "";
      const value = card.querySelector("output")?.textContent ?? "";
      return `${label}: ${value}`;
    })
    .join("\n");
}

async function copyText(value) {
  if (!value || value === "-") return;

  try {
    await navigator.clipboard.writeText(value);
    setStatus("Resultado copiado.");
  } catch {
    setStatus("Nao foi possivel copiar automaticamente.", true);
  }
}

function detectBase(value) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) return "ipv4";
  if (/^[0-9a-fA-F]{1,4}(:[0-9a-fA-F]{1,4})+$/.test(value)) return "hextet";
  if (/^0b[01]+$/i.test(value)) return "binary";
  if (/^0x[0-9a-f]+$/i.test(value)) return "hex";
  if (/^[01]+$/.test(value) && value.length >= 8 && value.length % 4 === 0) return "binary";
  if (/^\d+$/.test(value)) return "decimal";
  if (/^[0-9a-f]+$/i.test(value)) return "hex";
  return null;
}

function parseBigInt(value, base) {
  if (base === "decimal") {
    if (!/^\d+$/.test(value)) throw new Error("Decimal aceita apenas digitos de 0 a 9.");
    return BigInt(value);
  }

  if (base === "binary") {
    const cleaned = value.replace(/^0b/i, "");
    if (!/^[01]+$/.test(cleaned)) throw new Error("Binario aceita apenas 0 e 1.");
    return BigInt(`0b${cleaned}`);
  }

  if (base === "hex") {
    const cleaned = value.replace(/^0x/i, "");
    if (!/^[0-9a-f]+$/i.test(cleaned)) {
      throw new Error("Hexadecimal aceita digitos de 0 a 9 e letras de A a F.");
    }
    return BigInt(`0x${cleaned}`);
  }

  throw new Error("Base nao suportada para numero unico.");
}

function convertIpv4(value) {
  const octets = value.split(".").map((octet) => Number(octet));

  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    throw new Error("IPv4 precisa ter quatro octetos entre 0 e 255.");
  }

  return [
    { label: "Decimal", value: octets.join(".") },
    { label: "Binario", value: octets.map((octet) => octet.toString(2).padStart(8, "0")).join(".") },
    { label: "Hexadecimal", value: octets.map((octet) => octet.toString(16).padStart(2, "0")).join(".") },
    {
      label: "Hextet IPv6",
      value: [
        ((octets[0] << 8) | octets[1]).toString(16).padStart(4, "0"),
        ((octets[2] << 8) | octets[3]).toString(16).padStart(4, "0"),
      ].join(":"),
    },
  ];
}

function convertHextets(value) {
  const parts = value.split(":");

  if (parts.some((part) => !/^[0-9a-fA-F]{1,4}$/.test(part))) {
    throw new Error("Cada hextet IPv6 deve ter de 1 a 4 caracteres hexadecimais.");
  }

  const normalized = parts.map((part) => part.padStart(4, "0"));
  const decimalParts = normalized.map((part) => BigInt(`0x${part}`).toString(10));
  const binaryParts = normalized.map((part) =>
    BigInt(`0x${part}`).toString(2).padStart(16, "0"),
  );

  return [
    { label: "Decimal", value: decimalParts.join(":") },
    { label: "Binario", value: binaryParts.join(":") },
    { label: "Hexadecimal", value: normalized.join(":") },
    { label: "Hextet IPv6", value: normalized.join(":") },
  ];
}

function convertSingleNumber(value, base) {
  const number = parseBigInt(value, base);
  const hex = number.toString(16);
  const hextet = hex.padStart(Math.ceil(hex.length / 4) * 4 || 4, "0").match(/.{1,4}/g).join(":");

  return [
    { label: "Decimal", value: number.toString(10) },
    { label: "Binario", value: number.toString(2) },
    { label: "Hexadecimal", value: `0x${hex}` },
    { label: "Hextet IPv6", value: hextet },
  ];
}

function resolveBaseConversion(value, selectedBase) {
  const base = selectedBase === "auto" ? detectBase(value) : selectedBase;

  if (!base) {
    throw new Error("Nao consegui detectar a base. Escolha uma base manualmente.");
  }

  if (base === "ipv4") return convertIpv4(value);
  if (base === "hextet") return convertHextets(value);
  return convertSingleNumber(value, base);
}

function convertBase() {
  const value = normalizeInput(baseInput.value);

  if (!value) {
    emptyState(baseResults, "Digite um numero, IPv4 ou hextet para ver a conversao.");
    setStatus("");
    return;
  }

  try {
    const result = resolveBaseConversion(value, baseMode.value);
    renderCards(baseResults, result);

    const decimalValue = result.find((item) => item.label === "Decimal")?.value ?? "";
    const tooLarge = /^\d+$/.test(decimalValue) && BigInt(decimalValue) > MAX_SAFE_BIGINT;
    setStatus(tooLarge ? "Conversao feita com BigInt para preservar numeros grandes." : "Conversao pronta.");
  } catch (error) {
    emptyState(baseResults, error.message);
    setStatus(error.message, true);
  }
}

function parseIpv4(ip) {
  const parts = ip.split(".");

  if (parts.length !== 4) throw new Error("Use um IPv4 valido, como 192.168.1.10/24.");

  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    throw new Error("Cada octeto IPv4 deve estar entre 0 e 255.");
  }

  return octets.reduce((acc, octet) => ((acc << 8) | octet) >>> 0, 0);
}

function intToIp(value) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
}

function ipToBinary(value) {
  return [24, 16, 8, 0]
    .map((shift) => ((value >>> shift) & 255).toString(2).padStart(8, "0"))
    .join(".");
}

function parseCidr(value) {
  const match = value.trim().match(/^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/);

  if (!match) throw new Error("Formato esperado: IPv4/CIDR, exemplo 192.168.1.10/24.");

  const ip = parseIpv4(match[1]);
  const prefix = Number(match[2]);

  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    throw new Error("O prefixo CIDR deve estar entre 0 e 32.");
  }

  return { ip, prefix };
}

function hostCount(prefix) {
  if (prefix === 32) return "1";
  if (prefix === 31) return "2";
  return String(2 ** (32 - prefix) - 2);
}

function convertNetwork() {
  const value = networkInput.value.trim();

  if (!value) {
    emptyState(networkResults, "Digite um IPv4 com CIDR para calcular a subnet.");
    setStatus("");
    return;
  }

  try {
    const { ip, prefix } = parseCidr(value);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const wildcard = (~mask) >>> 0;
    const network = (ip & mask) >>> 0;
    const broadcast = (network | wildcard) >>> 0;
    const first = prefix >= 31 ? network : (network + 1) >>> 0;
    const last = prefix >= 31 ? broadcast : (broadcast - 1) >>> 0;

    renderCards(networkResults, [
      { label: "IP informado", value: intToIp(ip) },
      { label: "CIDR", value: `/${prefix}` },
      { label: "Mascara", value: intToIp(mask) },
      { label: "Wildcard", value: intToIp(wildcard) },
      { label: "Rede", value: intToIp(network) },
      { label: "Broadcast", value: intToIp(broadcast) },
      { label: "Primeiro host", value: intToIp(first) },
      { label: "Ultimo host", value: intToIp(last) },
      { label: "Hosts uteis", value: hostCount(prefix) },
      { label: "IP binario", value: ipToBinary(ip) },
      { label: "Mascara binaria", value: ipToBinary(mask) },
      { label: "Rede binaria", value: ipToBinary(network) },
    ]);

    setStatus("Subnet calculada.");
  } catch (error) {
    emptyState(networkResults, error.message);
    setStatus(error.message, true);
  }
}

function detectTextMode(value) {
  const trimmed = value.trim();
  const hexCandidate = trimmed.replace(/(?:0x|\\x)/gi, "").replace(/[\s,.-]/g, "");
  const binaryParts = trimmed.split(/[\s,]+/).filter(Boolean);
  const decimalParts = trimmed.split(/[\s,]+/).filter(Boolean);

  if (binaryParts.length > 0 && binaryParts.every((part) => /^[01]{8}$/.test(part))) return "binary";
  if (decimalParts.length > 0 && decimalParts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) {
    return "decimal";
  }
  if (hexCandidate.length >= 2 && hexCandidate.length % 2 === 0 && /^[0-9a-f]+$/i.test(hexCandidate)) {
    return "hex";
  }
  return "ascii";
}

function bytesFromHex(value) {
  const cleaned = value.replace(/(?:0x|\\x)/gi, "").replace(/[\s,.-]/g, "");
  if (!cleaned || cleaned.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(cleaned)) {
    throw new Error("Hex bytes precisam estar em pares, exemplo: 61 64 6d 69 6e.");
  }

  return cleaned.match(/.{2}/g).map((part) => Number.parseInt(part, 16));
}

function bytesFromBinary(value) {
  const parts = value.split(/[\s,]+/).filter(Boolean);
  if (!parts.length || parts.some((part) => !/^[01]{8}$/.test(part))) {
    throw new Error("Binario deve usar grupos de 8 bits, exemplo: 01100001 01100100.");
  }

  return parts.map((part) => Number.parseInt(part, 2));
}

function bytesFromDecimal(value) {
  const parts = value.split(/[\s,]+/).filter(Boolean);
  if (!parts.length || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
    throw new Error("Decimal bytes devem estar entre 0 e 255, exemplo: 97 100 109.");
  }

  return parts.map((part) => Number(part));
}

function bytesToAscii(bytes) {
  return textDecoder.decode(new Uint8Array(bytes));
}

function convertText() {
  const value = textInput.value.trim();

  if (!value) {
    emptyState(textResults, "Digite texto, hex bytes ou grupos binarios para converter.");
    setStatus("");
    return;
  }

  try {
    const mode = textMode.value === "auto" ? detectTextMode(value) : textMode.value;
    let bytes;

    if (mode === "ascii") bytes = Array.from(textEncoder.encode(value));
    if (mode === "hex") bytes = bytesFromHex(value);
    if (mode === "binary") bytes = bytesFromBinary(value);
    if (mode === "decimal") bytes = bytesFromDecimal(value);

    if (!bytes) throw new Error("Formato de texto nao suportado.");

    renderCards(textResults, [
      { label: "Texto", value: bytesToAscii(bytes) },
      { label: "Hex bytes", value: bytes.map((byte) => byte.toString(16).padStart(2, "0")).join(" ") },
      { label: "Binario", value: bytes.map((byte) => byte.toString(2).padStart(8, "0")).join(" ") },
      { label: "Decimal bytes", value: bytes.join(" ") },
      { label: "Tamanho", value: `${bytes.length} byte${bytes.length === 1 ? "" : "s"}` },
    ]);

    setStatus("Payload convertido.");
  } catch (error) {
    emptyState(textResults, error.message);
    setStatus(error.message, true);
  }
}

function setActiveTool(tool) {
  tabButtons.forEach((button) => {
    const active = button.dataset.toolTarget === tool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  panels.forEach((panel) => {
    const active = panel.dataset.toolPanel === tool;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });

  setStatus("");
}

function clearTool(tool) {
  if (tool === "base") {
    baseInput.value = "";
    baseMode.value = "auto";
    convertBase();
    baseInput.focus();
  }

  if (tool === "network") {
    networkInput.value = "";
    convertNetwork();
    networkInput.focus();
  }

  if (tool === "text") {
    textInput.value = "";
    textMode.value = "auto";
    convertText();
    textInput.focus();
  }
}

tabButtons.forEach((button) => {
  button.addEventListener("click", () => setActiveTool(button.dataset.toolTarget));
});

baseInput.addEventListener("input", convertBase);
baseMode.addEventListener("change", convertBase);
networkInput.addEventListener("input", convertNetwork);
textInput.addEventListener("input", convertText);
textMode.addEventListener("change", convertText);

document.addEventListener("click", (event) => {
  const copyButton = event.target.closest("[data-copy-value]");
  const copyAllButton = event.target.closest("[data-copy-all]");
  const exampleButton = event.target.closest("[data-example-tool]");
  const clearButton = event.target.closest("[data-clear]");

  if (copyButton) copyText(copyButton.dataset.copyValue);

  if (copyAllButton) {
    const container = document.querySelector(`#${copyAllButton.dataset.copyAll}`);
    copyText(cardText(container));
  }

  if (exampleButton) {
    const tool = exampleButton.dataset.exampleTool;
    setActiveTool(tool);

    if (tool === "base") {
      baseInput.value = exampleButton.dataset.example;
      baseMode.value = "auto";
      convertBase();
    }

    if (tool === "network") {
      networkInput.value = exampleButton.dataset.example;
      convertNetwork();
    }

    if (tool === "text") {
      textInput.value = exampleButton.dataset.example;
      textMode.value = "auto";
      convertText();
    }
  }

  if (clearButton) clearTool(clearButton.dataset.clear);
});

emptyState(baseResults, "Digite um numero, IPv4 ou hextet para ver a conversao.");
emptyState(networkResults, "Digite um IPv4 com CIDR para calcular a subnet.");
emptyState(textResults, "Digite texto, hex bytes ou grupos binarios para converter.");
