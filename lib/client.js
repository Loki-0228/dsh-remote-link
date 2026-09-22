window.__ModuleLoader__.load({
	id: "@loki-0228/dsh-remote-link",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  LanAccess: () => LanAccess,
  PairPanel: () => PairPanel,
  STYLE_TEXT: () => STYLE_TEXT,
  SettingsForm: () => SettingsForm,
  apply: () => apply,
  ensureStyles: () => ensureStyles,
  inject: () => inject,
  installWorkspaceHeaderTrigger: () => installWorkspaceHeaderTrigger
});
module.exports = __toCommonJS(index_exports);
var import_react5 = require("react");
var import_react_dom = require("react-dom");
var import_client = require("react-dom/client");

// src/client/PairPanel.tsx
var import_react2 = require("react");

// vendor/qrcode.react/lib/esm/index.js
var import_react = __toESM(require("react"), 1);
var __defProp2 = Object.defineProperty;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp2 = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp2.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __objRest = (source, exclude) => {
  var target = {};
  for (var prop in source)
    if (__hasOwnProp2.call(source, prop) && exclude.indexOf(prop) < 0)
      target[prop] = source[prop];
  if (source != null && __getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(source)) {
      if (exclude.indexOf(prop) < 0 && __propIsEnum.call(source, prop))
        target[prop] = source[prop];
    }
  return target;
};
var qrcodegen;
((qrcodegen2) => {
  const _QrCode = class _QrCode2 {
    /*-- Constructor (low level) and fields --*/
    // Creates a new QR Code with the given version number,
    // error correction level, data codeword bytes, and mask number.
    // This is a low-level API that most users should not use directly.
    // A mid-level API is the encodeSegments() function.
    constructor(version, errorCorrectionLevel, dataCodewords, msk) {
      this.version = version;
      this.errorCorrectionLevel = errorCorrectionLevel;
      this.modules = [];
      this.isFunction = [];
      if (version < _QrCode2.MIN_VERSION || version > _QrCode2.MAX_VERSION)
        throw new RangeError("Version value out of range");
      if (msk < -1 || msk > 7)
        throw new RangeError("Mask value out of range");
      this.size = version * 4 + 17;
      let row = [];
      for (let i = 0; i < this.size; i++)
        row.push(false);
      for (let i = 0; i < this.size; i++) {
        this.modules.push(row.slice());
        this.isFunction.push(row.slice());
      }
      this.drawFunctionPatterns();
      const allCodewords = this.addEccAndInterleave(dataCodewords);
      this.drawCodewords(allCodewords);
      if (msk == -1) {
        let minPenalty = 1e9;
        for (let i = 0; i < 8; i++) {
          this.applyMask(i);
          this.drawFormatBits(i);
          const penalty = this.getPenaltyScore();
          if (penalty < minPenalty) {
            msk = i;
            minPenalty = penalty;
          }
          this.applyMask(i);
        }
      }
      assert(0 <= msk && msk <= 7);
      this.mask = msk;
      this.applyMask(msk);
      this.drawFormatBits(msk);
      this.isFunction = [];
    }
    /*-- Static factory functions (high level) --*/
    // Returns a QR Code representing the given Unicode text string at the given error correction level.
    // As a conservative upper bound, this function is guaranteed to succeed for strings that have 738 or fewer
    // Unicode code points (not UTF-16 code units) if the low error correction level is used. The smallest possible
    // QR Code version is automatically chosen for the output. The ECC level of the result may be higher than the
    // ecl argument if it can be done without increasing the version.
    static encodeText(text, ecl) {
      const segs = qrcodegen2.QrSegment.makeSegments(text);
      return _QrCode2.encodeSegments(segs, ecl);
    }
    // Returns a QR Code representing the given binary data at the given error correction level.
    // This function always encodes using the binary segment mode, not any text mode. The maximum number of
    // bytes allowed is 2953. The smallest possible QR Code version is automatically chosen for the output.
    // The ECC level of the result may be higher than the ecl argument if it can be done without increasing the version.
    static encodeBinary(data, ecl) {
      const seg = qrcodegen2.QrSegment.makeBytes(data);
      return _QrCode2.encodeSegments([seg], ecl);
    }
    /*-- Static factory functions (mid level) --*/
    // Returns a QR Code representing the given segments with the given encoding parameters.
    // The smallest possible QR Code version within the given range is automatically
    // chosen for the output. Iff boostEcl is true, then the ECC level of the result
    // may be higher than the ecl argument if it can be done without increasing the
    // version. The mask number is either between 0 to 7 (inclusive) to force that
    // mask, or -1 to automatically choose an appropriate mask (which may be slow).
    // This function allows the user to create a custom sequence of segments that switches
    // between modes (such as alphanumeric and byte) to encode text in less space.
    // This is a mid-level API; the high-level API is encodeText() and encodeBinary().
    static encodeSegments(segs, ecl, minVersion = 1, maxVersion = 40, mask = -1, boostEcl = true) {
      if (!(_QrCode2.MIN_VERSION <= minVersion && minVersion <= maxVersion && maxVersion <= _QrCode2.MAX_VERSION) || mask < -1 || mask > 7)
        throw new RangeError("Invalid value");
      let version;
      let dataUsedBits;
      for (version = minVersion; ; version++) {
        const dataCapacityBits2 = _QrCode2.getNumDataCodewords(version, ecl) * 8;
        const usedBits = QrSegment.getTotalBits(segs, version);
        if (usedBits <= dataCapacityBits2) {
          dataUsedBits = usedBits;
          break;
        }
        if (version >= maxVersion)
          throw new RangeError("Data too long");
      }
      for (const newEcl of [_QrCode2.Ecc.MEDIUM, _QrCode2.Ecc.QUARTILE, _QrCode2.Ecc.HIGH]) {
        if (boostEcl && dataUsedBits <= _QrCode2.getNumDataCodewords(version, newEcl) * 8)
          ecl = newEcl;
      }
      let bb = [];
      for (const seg of segs) {
        appendBits(seg.mode.modeBits, 4, bb);
        appendBits(seg.numChars, seg.mode.numCharCountBits(version), bb);
        for (const b of seg.getData())
          bb.push(b);
      }
      assert(bb.length == dataUsedBits);
      const dataCapacityBits = _QrCode2.getNumDataCodewords(version, ecl) * 8;
      assert(bb.length <= dataCapacityBits);
      appendBits(0, Math.min(4, dataCapacityBits - bb.length), bb);
      appendBits(0, (8 - bb.length % 8) % 8, bb);
      assert(bb.length % 8 == 0);
      for (let padByte = 236; bb.length < dataCapacityBits; padByte ^= 236 ^ 17)
        appendBits(padByte, 8, bb);
      let dataCodewords = [];
      while (dataCodewords.length * 8 < bb.length)
        dataCodewords.push(0);
      bb.forEach((b, i) => dataCodewords[i >>> 3] |= b << 7 - (i & 7));
      return new _QrCode2(version, ecl, dataCodewords, mask);
    }
    /*-- Accessor methods --*/
    // Returns the color of the module (pixel) at the given coordinates, which is false
    // for light or true for dark. The top left corner has the coordinates (x=0, y=0).
    // If the given coordinates are out of bounds, then false (light) is returned.
    getModule(x, y) {
      return 0 <= x && x < this.size && 0 <= y && y < this.size && this.modules[y][x];
    }
    // Modified to expose modules for easy access
    getModules() {
      return this.modules;
    }
    /*-- Private helper methods for constructor: Drawing function modules --*/
    // Reads this object's version field, and draws and marks all function modules.
    drawFunctionPatterns() {
      for (let i = 0; i < this.size; i++) {
        this.setFunctionModule(6, i, i % 2 == 0);
        this.setFunctionModule(i, 6, i % 2 == 0);
      }
      this.drawFinderPattern(3, 3);
      this.drawFinderPattern(this.size - 4, 3);
      this.drawFinderPattern(3, this.size - 4);
      const alignPatPos = this.getAlignmentPatternPositions();
      const numAlign = alignPatPos.length;
      for (let i = 0; i < numAlign; i++) {
        for (let j = 0; j < numAlign; j++) {
          if (!(i == 0 && j == 0 || i == 0 && j == numAlign - 1 || i == numAlign - 1 && j == 0))
            this.drawAlignmentPattern(alignPatPos[i], alignPatPos[j]);
        }
      }
      this.drawFormatBits(0);
      this.drawVersion();
    }
    // Draws two copies of the format bits (with its own error correction code)
    // based on the given mask and this object's error correction level field.
    drawFormatBits(mask) {
      const data = this.errorCorrectionLevel.formatBits << 3 | mask;
      let rem = data;
      for (let i = 0; i < 10; i++)
        rem = rem << 1 ^ (rem >>> 9) * 1335;
      const bits = (data << 10 | rem) ^ 21522;
      assert(bits >>> 15 == 0);
      for (let i = 0; i <= 5; i++)
        this.setFunctionModule(8, i, getBit(bits, i));
      this.setFunctionModule(8, 7, getBit(bits, 6));
      this.setFunctionModule(8, 8, getBit(bits, 7));
      this.setFunctionModule(7, 8, getBit(bits, 8));
      for (let i = 9; i < 15; i++)
        this.setFunctionModule(14 - i, 8, getBit(bits, i));
      for (let i = 0; i < 8; i++)
        this.setFunctionModule(this.size - 1 - i, 8, getBit(bits, i));
      for (let i = 8; i < 15; i++)
        this.setFunctionModule(8, this.size - 15 + i, getBit(bits, i));
      this.setFunctionModule(8, this.size - 8, true);
    }
    // Draws two copies of the version bits (with its own error correction code),
    // based on this object's version field, iff 7 <= version <= 40.
    drawVersion() {
      if (this.version < 7)
        return;
      let rem = this.version;
      for (let i = 0; i < 12; i++)
        rem = rem << 1 ^ (rem >>> 11) * 7973;
      const bits = this.version << 12 | rem;
      assert(bits >>> 18 == 0);
      for (let i = 0; i < 18; i++) {
        const color = getBit(bits, i);
        const a = this.size - 11 + i % 3;
        const b = Math.floor(i / 3);
        this.setFunctionModule(a, b, color);
        this.setFunctionModule(b, a, color);
      }
    }
    // Draws a 9*9 finder pattern including the border separator,
    // with the center module at (x, y). Modules can be out of bounds.
    drawFinderPattern(x, y) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          const xx = x + dx;
          const yy = y + dy;
          if (0 <= xx && xx < this.size && 0 <= yy && yy < this.size)
            this.setFunctionModule(xx, yy, dist != 2 && dist != 4);
        }
      }
    }
    // Draws a 5*5 alignment pattern, with the center module
    // at (x, y). All modules must be in bounds.
    drawAlignmentPattern(x, y) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++)
          this.setFunctionModule(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) != 1);
      }
    }
    // Sets the color of a module and marks it as a function module.
    // Only used by the constructor. Coordinates must be in bounds.
    setFunctionModule(x, y, isDark) {
      this.modules[y][x] = isDark;
      this.isFunction[y][x] = true;
    }
    /*-- Private helper methods for constructor: Codewords and masking --*/
    // Returns a new byte string representing the given data with the appropriate error correction
    // codewords appended to it, based on this object's version and error correction level.
    addEccAndInterleave(data) {
      const ver = this.version;
      const ecl = this.errorCorrectionLevel;
      if (data.length != _QrCode2.getNumDataCodewords(ver, ecl))
        throw new RangeError("Invalid argument");
      const numBlocks = _QrCode2.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
      const blockEccLen = _QrCode2.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver];
      const rawCodewords = Math.floor(_QrCode2.getNumRawDataModules(ver) / 8);
      const numShortBlocks = numBlocks - rawCodewords % numBlocks;
      const shortBlockLen = Math.floor(rawCodewords / numBlocks);
      let blocks = [];
      const rsDiv = _QrCode2.reedSolomonComputeDivisor(blockEccLen);
      for (let i = 0, k = 0; i < numBlocks; i++) {
        let dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
        k += dat.length;
        const ecc = _QrCode2.reedSolomonComputeRemainder(dat, rsDiv);
        if (i < numShortBlocks)
          dat.push(0);
        blocks.push(dat.concat(ecc));
      }
      let result = [];
      for (let i = 0; i < blocks[0].length; i++) {
        blocks.forEach((block, j) => {
          if (i != shortBlockLen - blockEccLen || j >= numShortBlocks)
            result.push(block[i]);
        });
      }
      assert(result.length == rawCodewords);
      return result;
    }
    // Draws the given sequence of 8-bit codewords (data and error correction) onto the entire
    // data area of this QR Code. Function modules need to be marked off before this is called.
    drawCodewords(data) {
      if (data.length != Math.floor(_QrCode2.getNumRawDataModules(this.version) / 8))
        throw new RangeError("Invalid argument");
      let i = 0;
      for (let right = this.size - 1; right >= 1; right -= 2) {
        if (right == 6)
          right = 5;
        for (let vert = 0; vert < this.size; vert++) {
          for (let j = 0; j < 2; j++) {
            const x = right - j;
            const upward = (right + 1 & 2) == 0;
            const y = upward ? this.size - 1 - vert : vert;
            if (!this.isFunction[y][x] && i < data.length * 8) {
              this.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
              i++;
            }
          }
        }
      }
      assert(i == data.length * 8);
    }
    // XORs the codeword modules in this QR Code with the given mask pattern.
    // The function modules must be marked and the codeword bits must be drawn
    // before masking. Due to the arithmetic of XOR, calling applyMask() with
    // the same mask value a second time will undo the mask. A final well-formed
    // QR Code needs exactly one (not zero, two, etc.) mask applied.
    applyMask(mask) {
      if (mask < 0 || mask > 7)
        throw new RangeError("Mask value out of range");
      for (let y = 0; y < this.size; y++) {
        for (let x = 0; x < this.size; x++) {
          let invert;
          switch (mask) {
            case 0:
              invert = (x + y) % 2 == 0;
              break;
            case 1:
              invert = y % 2 == 0;
              break;
            case 2:
              invert = x % 3 == 0;
              break;
            case 3:
              invert = (x + y) % 3 == 0;
              break;
            case 4:
              invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 == 0;
              break;
            case 5:
              invert = x * y % 2 + x * y % 3 == 0;
              break;
            case 6:
              invert = (x * y % 2 + x * y % 3) % 2 == 0;
              break;
            case 7:
              invert = ((x + y) % 2 + x * y % 3) % 2 == 0;
              break;
            default:
              throw new Error("Unreachable");
          }
          if (!this.isFunction[y][x] && invert)
            this.modules[y][x] = !this.modules[y][x];
        }
      }
    }
    // Calculates and returns the penalty score based on state of this QR Code's current modules.
    // This is used by the automatic mask choice algorithm to find the mask pattern that yields the lowest score.
    getPenaltyScore() {
      let result = 0;
      for (let y = 0; y < this.size; y++) {
        let runColor = false;
        let runX = 0;
        let runHistory = [0, 0, 0, 0, 0, 0, 0];
        for (let x = 0; x < this.size; x++) {
          if (this.modules[y][x] == runColor) {
            runX++;
            if (runX == 5)
              result += _QrCode2.PENALTY_N1;
            else if (runX > 5)
              result++;
          } else {
            this.finderPenaltyAddHistory(runX, runHistory);
            if (!runColor)
              result += this.finderPenaltyCountPatterns(runHistory) * _QrCode2.PENALTY_N3;
            runColor = this.modules[y][x];
            runX = 1;
          }
        }
        result += this.finderPenaltyTerminateAndCount(runColor, runX, runHistory) * _QrCode2.PENALTY_N3;
      }
      for (let x = 0; x < this.size; x++) {
        let runColor = false;
        let runY = 0;
        let runHistory = [0, 0, 0, 0, 0, 0, 0];
        for (let y = 0; y < this.size; y++) {
          if (this.modules[y][x] == runColor) {
            runY++;
            if (runY == 5)
              result += _QrCode2.PENALTY_N1;
            else if (runY > 5)
              result++;
          } else {
            this.finderPenaltyAddHistory(runY, runHistory);
            if (!runColor)
              result += this.finderPenaltyCountPatterns(runHistory) * _QrCode2.PENALTY_N3;
            runColor = this.modules[y][x];
            runY = 1;
          }
        }
        result += this.finderPenaltyTerminateAndCount(runColor, runY, runHistory) * _QrCode2.PENALTY_N3;
      }
      for (let y = 0; y < this.size - 1; y++) {
        for (let x = 0; x < this.size - 1; x++) {
          const color = this.modules[y][x];
          if (color == this.modules[y][x + 1] && color == this.modules[y + 1][x] && color == this.modules[y + 1][x + 1])
            result += _QrCode2.PENALTY_N2;
        }
      }
      let dark = 0;
      for (const row of this.modules)
        dark = row.reduce((sum, color) => sum + (color ? 1 : 0), dark);
      const total = this.size * this.size;
      const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
      assert(0 <= k && k <= 9);
      result += k * _QrCode2.PENALTY_N4;
      assert(0 <= result && result <= 2568888);
      return result;
    }
    /*-- Private helper functions --*/
    // Returns an ascending list of positions of alignment patterns for this version number.
    // Each position is in the range [0,177), and are used on both the x and y axes.
    // This could be implemented as lookup table of 40 variable-length lists of integers.
    getAlignmentPatternPositions() {
      if (this.version == 1)
        return [];
      else {
        const numAlign = Math.floor(this.version / 7) + 2;
        const step = this.version == 32 ? 26 : Math.ceil((this.version * 4 + 4) / (numAlign * 2 - 2)) * 2;
        let result = [6];
        for (let pos = this.size - 7; result.length < numAlign; pos -= step)
          result.splice(1, 0, pos);
        return result;
      }
    }
    // Returns the number of data bits that can be stored in a QR Code of the given version number, after
    // all function modules are excluded. This includes remainder bits, so it might not be a multiple of 8.
    // The result is in the range [208, 29648]. This could be implemented as a 40-entry lookup table.
    static getNumRawDataModules(ver) {
      if (ver < _QrCode2.MIN_VERSION || ver > _QrCode2.MAX_VERSION)
        throw new RangeError("Version number out of range");
      let result = (16 * ver + 128) * ver + 64;
      if (ver >= 2) {
        const numAlign = Math.floor(ver / 7) + 2;
        result -= (25 * numAlign - 10) * numAlign - 55;
        if (ver >= 7)
          result -= 36;
      }
      assert(208 <= result && result <= 29648);
      return result;
    }
    // Returns the number of 8-bit data (i.e. not error correction) codewords contained in any
    // QR Code of the given version number and error correction level, with remainder bits discarded.
    // This stateless pure function could be implemented as a (40*4)-cell lookup table.
    static getNumDataCodewords(ver, ecl) {
      return Math.floor(_QrCode2.getNumRawDataModules(ver) / 8) - _QrCode2.ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][ver] * _QrCode2.NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][ver];
    }
    // Returns a Reed-Solomon ECC generator polynomial for the given degree. This could be
    // implemented as a lookup table over all possible parameter values, instead of as an algorithm.
    static reedSolomonComputeDivisor(degree) {
      if (degree < 1 || degree > 255)
        throw new RangeError("Degree out of range");
      let result = [];
      for (let i = 0; i < degree - 1; i++)
        result.push(0);
      result.push(1);
      let root = 1;
      for (let i = 0; i < degree; i++) {
        for (let j = 0; j < result.length; j++) {
          result[j] = _QrCode2.reedSolomonMultiply(result[j], root);
          if (j + 1 < result.length)
            result[j] ^= result[j + 1];
        }
        root = _QrCode2.reedSolomonMultiply(root, 2);
      }
      return result;
    }
    // Returns the Reed-Solomon error correction codeword for the given data and divisor polynomials.
    static reedSolomonComputeRemainder(data, divisor) {
      let result = divisor.map((_) => 0);
      for (const b of data) {
        const factor = b ^ result.shift();
        result.push(0);
        divisor.forEach((coef, i) => result[i] ^= _QrCode2.reedSolomonMultiply(coef, factor));
      }
      return result;
    }
    // Returns the product of the two given field elements modulo GF(2^8/0x11D). The arguments and result
    // are unsigned 8-bit integers. This could be implemented as a lookup table of 256*256 entries of uint8.
    static reedSolomonMultiply(x, y) {
      if (x >>> 8 != 0 || y >>> 8 != 0)
        throw new RangeError("Byte out of range");
      let z = 0;
      for (let i = 7; i >= 0; i--) {
        z = z << 1 ^ (z >>> 7) * 285;
        z ^= (y >>> i & 1) * x;
      }
      assert(z >>> 8 == 0);
      return z;
    }
    // Can only be called immediately after a light run is added, and
    // returns either 0, 1, or 2. A helper function for getPenaltyScore().
    finderPenaltyCountPatterns(runHistory) {
      const n = runHistory[1];
      assert(n <= this.size * 3);
      const core = n > 0 && runHistory[2] == n && runHistory[3] == n * 3 && runHistory[4] == n && runHistory[5] == n;
      return (core && runHistory[0] >= n * 4 && runHistory[6] >= n ? 1 : 0) + (core && runHistory[6] >= n * 4 && runHistory[0] >= n ? 1 : 0);
    }
    // Must be called at the end of a line (row or column) of modules. A helper function for getPenaltyScore().
    finderPenaltyTerminateAndCount(currentRunColor, currentRunLength, runHistory) {
      if (currentRunColor) {
        this.finderPenaltyAddHistory(currentRunLength, runHistory);
        currentRunLength = 0;
      }
      currentRunLength += this.size;
      this.finderPenaltyAddHistory(currentRunLength, runHistory);
      return this.finderPenaltyCountPatterns(runHistory);
    }
    // Pushes the given value to the front and drops the last value. A helper function for getPenaltyScore().
    finderPenaltyAddHistory(currentRunLength, runHistory) {
      if (runHistory[0] == 0)
        currentRunLength += this.size;
      runHistory.pop();
      runHistory.unshift(currentRunLength);
    }
  };
  _QrCode.MIN_VERSION = 1;
  _QrCode.MAX_VERSION = 40;
  _QrCode.PENALTY_N1 = 3;
  _QrCode.PENALTY_N2 = 3;
  _QrCode.PENALTY_N3 = 40;
  _QrCode.PENALTY_N4 = 10;
  _QrCode.ECC_CODEWORDS_PER_BLOCK = [
    // Version: (note that index 0 is for padding, and is set to an illegal value)
    //0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    // Low
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    // Medium
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    // Quartile
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
    // High
  ];
  _QrCode.NUM_ERROR_CORRECTION_BLOCKS = [
    // Version: (note that index 0 is for padding, and is set to an illegal value)
    //0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40    Error correction level
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    // Low
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    // Medium
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    // Quartile
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
    // High
  ];
  let QrCode = _QrCode;
  qrcodegen2.QrCode = _QrCode;
  function appendBits(val, len, bb) {
    if (len < 0 || len > 31 || val >>> len != 0)
      throw new RangeError("Value out of range");
    for (let i = len - 1; i >= 0; i--)
      bb.push(val >>> i & 1);
  }
  function getBit(x, i) {
    return (x >>> i & 1) != 0;
  }
  function assert(cond) {
    if (!cond)
      throw new Error("Assertion error");
  }
  const _QrSegment = class _QrSegment2 {
    /*-- Constructor (low level) and fields --*/
    // Creates a new QR Code segment with the given attributes and data.
    // The character count (numChars) must agree with the mode and the bit buffer length,
    // but the constraint isn't checked. The given bit buffer is cloned and stored.
    constructor(mode, numChars, bitData) {
      this.mode = mode;
      this.numChars = numChars;
      this.bitData = bitData;
      if (numChars < 0)
        throw new RangeError("Invalid argument");
      this.bitData = bitData.slice();
    }
    /*-- Static factory functions (mid level) --*/
    // Returns a segment representing the given binary data encoded in
    // byte mode. All input byte arrays are acceptable. Any text string
    // can be converted to UTF-8 bytes and encoded as a byte mode segment.
    static makeBytes(data) {
      let bb = [];
      for (const b of data)
        appendBits(b, 8, bb);
      return new _QrSegment2(_QrSegment2.Mode.BYTE, data.length, bb);
    }
    // Returns a segment representing the given string of decimal digits encoded in numeric mode.
    static makeNumeric(digits) {
      if (!_QrSegment2.isNumeric(digits))
        throw new RangeError("String contains non-numeric characters");
      let bb = [];
      for (let i = 0; i < digits.length; ) {
        const n = Math.min(digits.length - i, 3);
        appendBits(parseInt(digits.substring(i, i + n), 10), n * 3 + 1, bb);
        i += n;
      }
      return new _QrSegment2(_QrSegment2.Mode.NUMERIC, digits.length, bb);
    }
    // Returns a segment representing the given text string encoded in alphanumeric mode.
    // The characters allowed are: 0 to 9, A to Z (uppercase only), space,
    // dollar, percent, asterisk, plus, hyphen, period, slash, colon.
    static makeAlphanumeric(text) {
      if (!_QrSegment2.isAlphanumeric(text))
        throw new RangeError("String contains unencodable characters in alphanumeric mode");
      let bb = [];
      let i;
      for (i = 0; i + 2 <= text.length; i += 2) {
        let temp = _QrSegment2.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45;
        temp += _QrSegment2.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
        appendBits(temp, 11, bb);
      }
      if (i < text.length)
        appendBits(_QrSegment2.ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6, bb);
      return new _QrSegment2(_QrSegment2.Mode.ALPHANUMERIC, text.length, bb);
    }
    // Returns a new mutable list of zero or more segments to represent the given Unicode text string.
    // The result may use various segment modes and switch modes to optimize the length of the bit stream.
    static makeSegments(text) {
      if (text == "")
        return [];
      else if (_QrSegment2.isNumeric(text))
        return [_QrSegment2.makeNumeric(text)];
      else if (_QrSegment2.isAlphanumeric(text))
        return [_QrSegment2.makeAlphanumeric(text)];
      else
        return [_QrSegment2.makeBytes(_QrSegment2.toUtf8ByteArray(text))];
    }
    // Returns a segment representing an Extended Channel Interpretation
    // (ECI) designator with the given assignment value.
    static makeEci(assignVal) {
      let bb = [];
      if (assignVal < 0)
        throw new RangeError("ECI assignment value out of range");
      else if (assignVal < 1 << 7)
        appendBits(assignVal, 8, bb);
      else if (assignVal < 1 << 14) {
        appendBits(2, 2, bb);
        appendBits(assignVal, 14, bb);
      } else if (assignVal < 1e6) {
        appendBits(6, 3, bb);
        appendBits(assignVal, 21, bb);
      } else
        throw new RangeError("ECI assignment value out of range");
      return new _QrSegment2(_QrSegment2.Mode.ECI, 0, bb);
    }
    // Tests whether the given string can be encoded as a segment in numeric mode.
    // A string is encodable iff each character is in the range 0 to 9.
    static isNumeric(text) {
      return _QrSegment2.NUMERIC_REGEX.test(text);
    }
    // Tests whether the given string can be encoded as a segment in alphanumeric mode.
    // A string is encodable iff each character is in the following set: 0 to 9, A to Z
    // (uppercase only), space, dollar, percent, asterisk, plus, hyphen, period, slash, colon.
    static isAlphanumeric(text) {
      return _QrSegment2.ALPHANUMERIC_REGEX.test(text);
    }
    /*-- Methods --*/
    // Returns a new copy of the data bits of this segment.
    getData() {
      return this.bitData.slice();
    }
    // (Package-private) Calculates and returns the number of bits needed to encode the given segments at
    // the given version. The result is infinity if a segment has too many characters to fit its length field.
    static getTotalBits(segs, version) {
      let result = 0;
      for (const seg of segs) {
        const ccbits = seg.mode.numCharCountBits(version);
        if (seg.numChars >= 1 << ccbits)
          return Infinity;
        result += 4 + ccbits + seg.bitData.length;
      }
      return result;
    }
    // Returns a new array of bytes representing the given string encoded in UTF-8.
    static toUtf8ByteArray(str) {
      str = encodeURI(str);
      let result = [];
      for (let i = 0; i < str.length; i++) {
        if (str.charAt(i) != "%")
          result.push(str.charCodeAt(i));
        else {
          result.push(parseInt(str.substring(i + 1, i + 3), 16));
          i += 2;
        }
      }
      return result;
    }
  };
  _QrSegment.NUMERIC_REGEX = /^[0-9]*$/;
  _QrSegment.ALPHANUMERIC_REGEX = /^[A-Z0-9 $%*+.\/:-]*$/;
  _QrSegment.ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
  let QrSegment = _QrSegment;
  qrcodegen2.QrSegment = _QrSegment;
})(qrcodegen || (qrcodegen = {}));
((qrcodegen2) => {
  let QrCode;
  ((QrCode2) => {
    const _Ecc = class _Ecc {
      // The QR Code can tolerate about 30% erroneous codewords
      /*-- Constructor and fields --*/
      constructor(ordinal, formatBits) {
        this.ordinal = ordinal;
        this.formatBits = formatBits;
      }
    };
    _Ecc.LOW = new _Ecc(0, 1);
    _Ecc.MEDIUM = new _Ecc(1, 0);
    _Ecc.QUARTILE = new _Ecc(2, 3);
    _Ecc.HIGH = new _Ecc(3, 2);
    let Ecc = _Ecc;
    QrCode2.Ecc = _Ecc;
  })(QrCode = qrcodegen2.QrCode || (qrcodegen2.QrCode = {}));
})(qrcodegen || (qrcodegen = {}));
((qrcodegen2) => {
  let QrSegment;
  ((QrSegment2) => {
    const _Mode = class _Mode {
      /*-- Constructor and fields --*/
      constructor(modeBits, numBitsCharCount) {
        this.modeBits = modeBits;
        this.numBitsCharCount = numBitsCharCount;
      }
      /*-- Method --*/
      // (Package-private) Returns the bit width of the character count field for a segment in
      // this mode in a QR Code at the given version number. The result is in the range [0, 16].
      numCharCountBits(ver) {
        return this.numBitsCharCount[Math.floor((ver + 7) / 17)];
      }
    };
    _Mode.NUMERIC = new _Mode(1, [10, 12, 14]);
    _Mode.ALPHANUMERIC = new _Mode(2, [9, 11, 13]);
    _Mode.BYTE = new _Mode(4, [8, 16, 16]);
    _Mode.KANJI = new _Mode(8, [8, 10, 12]);
    _Mode.ECI = new _Mode(7, [0, 0, 0]);
    let Mode = _Mode;
    QrSegment2.Mode = _Mode;
  })(QrSegment = qrcodegen2.QrSegment || (qrcodegen2.QrSegment = {}));
})(qrcodegen || (qrcodegen = {}));
var qrcodegen_default = qrcodegen;
var ERROR_LEVEL_MAP = {
  L: qrcodegen_default.QrCode.Ecc.LOW,
  M: qrcodegen_default.QrCode.Ecc.MEDIUM,
  Q: qrcodegen_default.QrCode.Ecc.QUARTILE,
  H: qrcodegen_default.QrCode.Ecc.HIGH
};
var DEFAULT_SIZE = 128;
var DEFAULT_LEVEL = "L";
var DEFAULT_BGCOLOR = "#FFFFFF";
var DEFAULT_FGCOLOR = "#000000";
var DEFAULT_INCLUDEMARGIN = false;
var DEFAULT_MINVERSION = 1;
var SPEC_MARGIN_SIZE = 4;
var DEFAULT_MARGIN_SIZE = 0;
var DEFAULT_IMG_SCALE = 0.1;
function generatePath(modules, margin = 0) {
  const ops = [];
  modules.forEach(function(row, y) {
    let start = null;
    row.forEach(function(cell, x) {
      if (!cell && start !== null) {
        ops.push(
          `M${start + margin} ${y + margin}h${x - start}v1H${start + margin}z`
        );
        start = null;
        return;
      }
      if (x === row.length - 1) {
        if (!cell) {
          return;
        }
        if (start === null) {
          ops.push(`M${x + margin},${y + margin} h1v1H${x + margin}z`);
        } else {
          ops.push(
            `M${start + margin},${y + margin} h${x + 1 - start}v1H${start + margin}z`
          );
        }
        return;
      }
      if (cell && start === null) {
        start = x;
      }
    });
  });
  return ops.join("");
}
function excavateModules(modules, excavation) {
  return modules.slice().map((row, y) => {
    if (y < excavation.y || y >= excavation.y + excavation.h) {
      return row;
    }
    return row.map((cell, x) => {
      if (x < excavation.x || x >= excavation.x + excavation.w) {
        return cell;
      }
      return false;
    });
  });
}
function getImageSettings(cells, size, margin, imageSettings) {
  if (imageSettings == null) {
    return null;
  }
  const numCells = cells.length + margin * 2;
  const defaultSize = Math.floor(size * DEFAULT_IMG_SCALE);
  const scale = numCells / size;
  const w = (imageSettings.width || defaultSize) * scale;
  const h5 = (imageSettings.height || defaultSize) * scale;
  const x = imageSettings.x == null ? cells.length / 2 - w / 2 : imageSettings.x * scale;
  const y = imageSettings.y == null ? cells.length / 2 - h5 / 2 : imageSettings.y * scale;
  const opacity = imageSettings.opacity == null ? 1 : imageSettings.opacity;
  let excavation = null;
  if (imageSettings.excavate) {
    let floorX = Math.floor(x);
    let floorY = Math.floor(y);
    let ceilW = Math.ceil(w + x - floorX);
    let ceilH = Math.ceil(h5 + y - floorY);
    excavation = { x: floorX, y: floorY, w: ceilW, h: ceilH };
  }
  const crossOrigin = imageSettings.crossOrigin;
  return { x, y, h: h5, w, excavation, opacity, crossOrigin };
}
function getMarginSize(includeMargin, marginSize) {
  if (marginSize != null) {
    return Math.max(Math.floor(marginSize), 0);
  }
  return includeMargin ? SPEC_MARGIN_SIZE : DEFAULT_MARGIN_SIZE;
}
function useQRCode({
  value,
  level,
  minVersion,
  includeMargin,
  marginSize,
  imageSettings,
  size,
  boostLevel
}) {
  let qrcode = import_react.default.useMemo(() => {
    const values = Array.isArray(value) ? value : [value];
    const segments = values.reduce((accum, v) => {
      accum.push(...qrcodegen_default.QrSegment.makeSegments(v));
      return accum;
    }, []);
    return qrcodegen_default.QrCode.encodeSegments(
      segments,
      ERROR_LEVEL_MAP[level],
      minVersion,
      void 0,
      void 0,
      boostLevel
    );
  }, [value, level, minVersion, boostLevel]);
  const { cells, margin, numCells, calculatedImageSettings } = import_react.default.useMemo(() => {
    let cells2 = qrcode.getModules();
    const margin2 = getMarginSize(includeMargin, marginSize);
    const numCells2 = cells2.length + margin2 * 2;
    const calculatedImageSettings2 = getImageSettings(
      cells2,
      size,
      margin2,
      imageSettings
    );
    return {
      cells: cells2,
      margin: margin2,
      numCells: numCells2,
      calculatedImageSettings: calculatedImageSettings2
    };
  }, [qrcode, size, imageSettings, includeMargin, marginSize]);
  return {
    qrcode,
    margin,
    cells,
    numCells,
    calculatedImageSettings
  };
}
var SUPPORTS_PATH2D = (function() {
  try {
    new Path2D().addPath(new Path2D());
  } catch (e) {
    return false;
  }
  return true;
})();
var QRCodeCanvas = import_react.default.forwardRef(
  function QRCodeCanvas2(props, forwardedRef) {
    const _a = props, {
      value,
      size = DEFAULT_SIZE,
      level = DEFAULT_LEVEL,
      bgColor = DEFAULT_BGCOLOR,
      fgColor = DEFAULT_FGCOLOR,
      includeMargin = DEFAULT_INCLUDEMARGIN,
      minVersion = DEFAULT_MINVERSION,
      boostLevel,
      marginSize,
      imageSettings
    } = _a, extraProps = __objRest(_a, [
      "value",
      "size",
      "level",
      "bgColor",
      "fgColor",
      "includeMargin",
      "minVersion",
      "boostLevel",
      "marginSize",
      "imageSettings"
    ]);
    const _b = extraProps, { style } = _b, otherProps = __objRest(_b, ["style"]);
    const imgSrc = imageSettings == null ? void 0 : imageSettings.src;
    const _canvas = import_react.default.useRef(null);
    const _image = import_react.default.useRef(null);
    const setCanvasRef = import_react.default.useCallback(
      (node) => {
        _canvas.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );
    const [isImgLoaded, setIsImageLoaded] = import_react.default.useState(false);
    const { margin, cells, numCells, calculatedImageSettings } = useQRCode({
      value,
      level,
      minVersion,
      boostLevel,
      includeMargin,
      marginSize,
      imageSettings,
      size
    });
    import_react.default.useEffect(() => {
      if (_canvas.current != null) {
        const canvas = _canvas.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return;
        }
        let cellsToDraw = cells;
        const image = _image.current;
        const haveImageToRender = calculatedImageSettings != null && image !== null && image.complete && image.naturalHeight !== 0 && image.naturalWidth !== 0;
        if (haveImageToRender) {
          if (calculatedImageSettings.excavation != null) {
            cellsToDraw = excavateModules(
              cells,
              calculatedImageSettings.excavation
            );
          }
        }
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.height = canvas.width = size * pixelRatio;
        const scale = size / numCells * pixelRatio;
        ctx.scale(scale, scale);
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, numCells, numCells);
        ctx.fillStyle = fgColor;
        if (SUPPORTS_PATH2D) {
          ctx.fill(new Path2D(generatePath(cellsToDraw, margin)));
        } else {
          cells.forEach(function(row, rdx) {
            row.forEach(function(cell, cdx) {
              if (cell) {
                ctx.fillRect(cdx + margin, rdx + margin, 1, 1);
              }
            });
          });
        }
        if (calculatedImageSettings) {
          ctx.globalAlpha = calculatedImageSettings.opacity;
        }
        if (haveImageToRender) {
          ctx.drawImage(
            image,
            calculatedImageSettings.x + margin,
            calculatedImageSettings.y + margin,
            calculatedImageSettings.w,
            calculatedImageSettings.h
          );
        }
      }
    });
    import_react.default.useEffect(() => {
      setIsImageLoaded(false);
    }, [imgSrc]);
    const canvasStyle = __spreadValues({ height: size, width: size }, style);
    let img = null;
    if (imgSrc != null) {
      img = /* @__PURE__ */ import_react.default.createElement(
        "img",
        {
          src: imgSrc,
          key: imgSrc,
          style: { display: "none" },
          onLoad: () => {
            setIsImageLoaded(true);
          },
          ref: _image,
          crossOrigin: calculatedImageSettings == null ? void 0 : calculatedImageSettings.crossOrigin
        }
      );
    }
    return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, /* @__PURE__ */ import_react.default.createElement(
      "canvas",
      __spreadValues({
        style: canvasStyle,
        height: size,
        width: size,
        ref: setCanvasRef,
        role: "img"
      }, otherProps)
    ), img);
  }
);
QRCodeCanvas.displayName = "QRCodeCanvas";
var QRCodeSVG = import_react.default.forwardRef(
  function QRCodeSVG2(props, forwardedRef) {
    const _a = props, {
      value,
      size = DEFAULT_SIZE,
      level = DEFAULT_LEVEL,
      bgColor = DEFAULT_BGCOLOR,
      fgColor = DEFAULT_FGCOLOR,
      includeMargin = DEFAULT_INCLUDEMARGIN,
      minVersion = DEFAULT_MINVERSION,
      boostLevel,
      title,
      marginSize,
      imageSettings
    } = _a, otherProps = __objRest(_a, [
      "value",
      "size",
      "level",
      "bgColor",
      "fgColor",
      "includeMargin",
      "minVersion",
      "boostLevel",
      "title",
      "marginSize",
      "imageSettings"
    ]);
    const { margin, cells, numCells, calculatedImageSettings } = useQRCode({
      value,
      level,
      minVersion,
      boostLevel,
      includeMargin,
      marginSize,
      imageSettings,
      size
    });
    let cellsToDraw = cells;
    let image = null;
    if (imageSettings != null && calculatedImageSettings != null) {
      if (calculatedImageSettings.excavation != null) {
        cellsToDraw = excavateModules(
          cells,
          calculatedImageSettings.excavation
        );
      }
      image = /* @__PURE__ */ import_react.default.createElement(
        "image",
        {
          href: imageSettings.src,
          height: calculatedImageSettings.h,
          width: calculatedImageSettings.w,
          x: calculatedImageSettings.x + margin,
          y: calculatedImageSettings.y + margin,
          preserveAspectRatio: "none",
          opacity: calculatedImageSettings.opacity,
          crossOrigin: calculatedImageSettings.crossOrigin
        }
      );
    }
    const fgPath = generatePath(cellsToDraw, margin);
    return /* @__PURE__ */ import_react.default.createElement(
      "svg",
      __spreadValues({
        height: size,
        width: size,
        viewBox: `0 0 ${numCells} ${numCells}`,
        ref: forwardedRef,
        role: "img"
      }, otherProps),
      !!title && /* @__PURE__ */ import_react.default.createElement("title", null, title),
      /* @__PURE__ */ import_react.default.createElement(
        "path",
        {
          fill: bgColor,
          d: `M0,0 h${numCells}v${numCells}H0z`,
          shapeRendering: "crispEdges"
        }
      ),
      /* @__PURE__ */ import_react.default.createElement("path", { fill: fgColor, d: fgPath, shapeRendering: "crispEdges" }),
      image
    );
  }
);
QRCodeSVG.displayName = "QRCodeSVG";

// src/remote-methods.ts
var REMOTE_PREFIX = "/remote";
var REMOTE_VIEWER_PATH = "/files";
var REMOTE_API_PREFIX = `${REMOTE_PREFIX}/api`;
var REMOTE_API_PATHS = {
  mux: `${REMOTE_API_PREFIX}/remote.mux`
};
var REMOTE_UPGRADE_PATHS = [
  REMOTE_API_PATHS.mux,
  `${REMOTE_PREFIX}/sidebar/ws/terminal`,
  `${REMOTE_PREFIX}/sidebar/ws/agent-terminals`,
  `${REMOTE_API_PREFIX}/dsh-ssh/terminal`
];
var WEB_UI_SETTINGS_BRIDGE_PATH = "/api/dsh-web-ui-settings";
var REMOTE_DEVICE_HEADER = "x-dsh-remote-device";
var REMOTE_DEVICE_QUERY = "device";
var REMOTE_DEVICE_STORAGE_KEY = "dsh-remote-device";
var REMOTE_CHANNEL_BOOT_GLOBAL = "__DSH_REMOTE_LINK_BOOT__";
var REMOTE_CHANNEL_RULES = {
  remotePrefix: REMOTE_PREFIX,
  apiPrefix: "/api/",
  pairPrefix: "/api/pair/",
  updatePrefix: "/api/update/",
  settingsBridgePrefix: WEB_UI_SETTINGS_BRIDGE_PATH,
  sidebarPrefix: "/sidebar/",
  gitPrefix: "/git/",
  wsPaths: [
    "/api/remote.mux",
    "/sidebar/ws/terminal",
    "/sidebar/ws/agent-terminals",
    "/api/dsh-ssh/terminal"
  ],
  deviceHeader: REMOTE_DEVICE_HEADER,
  deviceKey: REMOTE_DEVICE_STORAGE_KEY,
  deviceQuery: REMOTE_DEVICE_QUERY
};

// src/client/pair-api.ts
async function issuePair(address) {
  const response = await fetch("/api/pair/issue", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...address !== void 0 ? { address } : {}
    })
  });
  if (!response.ok) {
    if (response.status === 409) return { ok: false, code: "lan-required" };
    if (response.status === 403) return { ok: false, code: "forbidden" };
    if (response.status === 400) return { ok: false, code: "unknown-address" };
    throw new Error(`remote-web-ui: issue failed with ${String(response.status)}`);
  }
  return await response.json();
}
async function stopPair() {
  const response = await fetch("/api/pair/stop", { method: "POST" });
  if (!response.ok) throw new Error(`remote-web-ui: stop failed with ${String(response.status)}`);
}
async function revokePair(deviceId) {
  const response = await fetch("/api/pair/revoke", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId })
  });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(`remote-web-ui: revoke failed with ${String(response.status)}`);
}
async function readLanBindStatus() {
  const response = await fetch("/api/pair/lan-bind");
  if (!response.ok) throw new Error(`dsh-remote-link: lan-bind status failed with ${String(response.status)}`);
  return await response.json();
}
function canControlLanBind(hostname = window.location.hostname) {
  if (hostname === "localhost" || hostname === "::1" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function formatClock(epochMs) {
  const date = new Date(epochMs);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
function formatLastSeen(epochMs) {
  const date = new Date(epochMs);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day} ${formatClock(epochMs)}`;
}
async function copyText(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard !== void 0) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
    }
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

// src/client/device-name.ts
function deviceNameFromUserAgent(userAgent) {
  if (userAgent === void 0 || userAgent.trim() === "") return void 0;
  const os = /Windows NT/i.test(userAgent) ? "Windows" : /Android/i.test(userAgent) ? "Android" : /iPhone|iPad|iPod/i.test(userAgent) ? "iOS" : /Macintosh|Mac OS X/i.test(userAgent) ? "macOS" : /Linux/i.test(userAgent) ? "Linux" : void 0;
  const browser = /Edg(?:A|iOS)?\//i.test(userAgent) ? "Edge" : /(?:OPR|Opera)\//i.test(userAgent) ? "Opera" : /(?:Chrome|CriOS)\//i.test(userAgent) ? "Chrome" : /(?:Firefox|FxiOS)\//i.test(userAgent) ? "Firefox" : /Safari\//i.test(userAgent) && /Version\//i.test(userAgent) ? "Safari" : void 0;
  if (os !== void 0 && browser !== void 0) return `${os} \xB7 ${browser}`;
  return os ?? browser;
}

// src/client/PairPanel.tsx
var STYLE_ID = "dsh-remote-link-styles";
var STYLE_TEXT = `
.rl-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center}
.rl-mask{position:absolute;inset:0;background:var(--dsw-alias-bg-mask-3,rgba(0,0,0,.45))}
.rl-panel{position:relative;z-index:1;width:min(440px,calc(100vw - 24px));max-height:calc(100vh - 48px);overflow:auto;
background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,inherit);
border:1px solid var(--dsw-alias-border-l3,#d8d8d8);border-radius:12px;padding:16px;
box-shadow:0 12px 40px var(--dsw-alias-bg-mask-drop,rgba(0,0,0,.28));font:inherit}
.rl-header{display:flex;align-items:flex-start;gap:12px}
.rl-heading{flex:1;min-width:0}
.rl-title{margin:0;font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}
.rl-subtitle{margin:2px 0 0;font-size:12px;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-close{border:0;background:transparent;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;font-size:16px;
line-height:1;padding:4px;border-radius:6px}
.rl-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}
.rl-banner{margin-top:12px;padding:10px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(180,120,0,.14));
border:1px solid var(--dsw-alias-border-l2,transparent);font-size:12px;line-height:1.6}
.rl-bannerTitle{margin:0;font-weight:600;color:var(--dsw-alias-label-primary,inherit)}
.rl-bannerHint{margin:4px 0 0;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-card{margin-top:14px;padding:12px;border:1px solid var(--dsw-alias-border-l4,#d8d8d8);border-radius:10px;
background:var(--dsw-alias-bg-layer-2,transparent)}
.rl-cardHeader{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px;
color:var(--dsw-alias-label-secondary,inherit)}
.rl-badges{display:flex;gap:6px;flex-wrap:wrap}
.rl-badge{padding:1px 8px;border-radius:999px;font-size:11px;background:var(--dsw-alias-bg-mask-2,rgba(127,127,127,.18));
color:var(--dsw-alias-label-secondary,inherit)}
.rl-badge-connected{background:var(--dsw-alias-state-business-primary,rgba(30,150,80,.85));
color:var(--dsw-alias-label-primary-foreground,#fff)}
.rl-badge-waiting{background:var(--dsw-alias-button-info-fill,rgba(40,120,220,.85));
color:var(--dsw-alias-label-primary-foreground,#fff)}
.rl-badge-stopped,.rl-badge-disconnected{background:var(--dsw-alias-state-error-primary,rgba(150,60,60,.85));
color:var(--dsw-alias-label-primary-foreground,#fff)}
.rl-qrWrap{display:flex;justify-content:center;padding:12px 0 6px}
/* \u4E8C\u7EF4\u7801\u5FC5\u987B\u59CB\u7EC8\u767D\u5E95\u6DF1\u7801\uFF1A\u8DDF\u7740\u6697\u8272\u4E3B\u9898\u53CD\u8272\u4F1A\u5BFC\u81F4\u626B\u4E0D\u51FA\u6765\u3002 */
.rl-qr{background:#fff;padding:6px;border-radius:8px}
.rl-expiry{margin:0;text-align:center;font-size:12px;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-expired{margin:0;text-align:center;font-size:12px;color:var(--dsw-alias-state-error-primary,#c0392b)}
.rl-hint{margin:10px 0 0;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-pairLinks{margin-top:8px;display:flex;flex-direction:column;gap:6px}
.rl-pairLinkRow{display:flex;align-items:center;gap:8px}
.rl-pairLinkText{flex:1;min-width:0}
.rl-pairLinkLabel{display:block;font-size:11px;color:var(--dsw-alias-label-caption,inherit)}
.rl-link{display:block;font-size:11px;word-break:break-all;color:var(--dsw-alias-label-secondary,inherit);
background:var(--dsw-alias-markdown-inline-code,rgba(127,127,127,.12));padding:2px 4px;border-radius:4px}
.rl-copyLink{flex:0 0 auto;font-size:12px;padding:4px 10px;border-radius:6px;
border:1px solid var(--dsw-alias-border-l3,#d8d8d8);background:var(--dsw-alias-button-elevated-fill,transparent);
color:var(--dsw-alias-label-primary,inherit);cursor:pointer}
.rl-copyLink:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.rl-note{margin:10px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-failed{margin:10px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary,#c0392b)}
.rl-addresses{margin:14px 0 0;padding:8px 10px;border:1px solid var(--dsw-alias-border-l4,#d8d8d8);
border-radius:8px;font-size:12px;color:var(--dsw-alias-label-secondary,inherit)}
.rl-addresses legend{padding:0 4px;font-size:11px;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-address{display:flex;align-items:center;gap:6px;padding:3px 0}
.rl-addressValue{font-size:11px;color:var(--dsw-alias-label-secondary,inherit)}
.rl-addressWarn{font-size:10px;color:var(--dsw-alias-state-error-primary,#c0392b);border:1px solid currentColor;
border-radius:4px;padding:0 4px;line-height:14px}
.rl-actions{display:flex;gap:8px;margin-top:14px}
.rl-action{flex:1;padding:7px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l3,#d8d8d8);
background:var(--dsw-alias-button-elevated-fill,transparent);color:var(--dsw-alias-label-primary,inherit);
cursor:pointer;font-size:12px}
.rl-action:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.rl-devices{margin-top:16px}
.rl-devicesTitle{margin:0 0 6px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,inherit)}
.rl-devicesEmpty{margin:0;font-size:12px;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-deviceList{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.rl-deviceRow{display:flex;align-items:center;gap:8px;font-size:12px}
.rl-deviceMeta{flex:1;min-width:0;display:flex;flex-wrap:wrap;gap:6px;align-items:baseline}
.rl-deviceName{font-weight:600;color:var(--dsw-alias-label-primary,inherit)}
.rl-devicePresence{font-size:11px;color:var(--dsw-alias-label-secondary,inherit)}
.rl-deviceOnline{color:var(--dsw-alias-state-business-primary,#1e9650)}
.rl-deviceOffline{color:var(--dsw-alias-label-dimmed,inherit)}
.rl-deviceSeen{font-size:11px;color:var(--dsw-alias-label-caption,inherit)}
.rl-deviceRevoke{border:1px solid var(--dsw-alias-border-l3,#d8d8d8);background:var(--dsw-alias-button-elevated-fill,transparent);
color:var(--dsw-alias-label-secondary,inherit);border-radius:6px;padding:3px 8px;font-size:11px;cursor:pointer}
.rl-deviceRevoke:hover{background:var(--dsw-alias-interactive-bg-hover-danger,rgba(180,60,60,.16))}
/* \u5C40\u57DF\u7F51\u7ED1\u5B9A\u5757\uFF1A\u4E00\u7EA7\u63A7\u4EF6\uFF08\u4E0D\u5728\u9AD8\u7EA7\u6298\u53E0\u91CC\uFF09\uFF0C\u4E0E\u96A7\u9053\u5757\u540C\u4E00\u5957\u4E3B\u9898\u4EE4\u724C\u3002 */
.rl-lan{margin-top:14px;padding:12px;border:1px solid var(--dsw-alias-border-l4,#d8d8d8);border-radius:10px;
background:var(--dsw-alias-bg-layer-2,transparent);font-size:12px}
.rl-lanAddress{display:flex;align-items:center;gap:8px;margin-top:6px}
/* \u96A7\u9053\u914D\u7F6E\u5757\uFF1A\u5E38\u663E\u3001\u7D27\u8DDF\u6807\u9898\uFF0C\u6837\u5F0F\u4E0E\u4E0A\u9762\u7684\u4E00\u81F4\uFF08\u5168\u90E8\u8D70\u4E3B\u9898\u4EE4\u724C\uFF09\u3002 */
.rl-settings{margin-top:14px;padding:12px;border:1px solid var(--dsw-alias-border-l4,#d8d8d8);border-radius:10px;
background:var(--dsw-alias-bg-layer-2,transparent);font-size:12px}
.rl-settingsTitle{margin:0;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary,inherit)}
.rl-settingsBody{border:0;margin:0;padding:0;min-width:0}
.rl-settingsBody:disabled{opacity:.6}
.rl-advanced{margin-top:10px;border-top:1px solid var(--dsw-alias-border-l4,#d8d8d8);padding-top:8px}
.rl-advanced summary{cursor:pointer;font-size:11px;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-field{display:flex;flex-direction:column;gap:3px;margin-top:8px}
.rl-field label{font-size:11px;color:var(--dsw-alias-label-tertiary,inherit)}
.rl-field input{font:inherit;font-size:12px;padding:4px 6px;border-radius:6px;
border:1px solid var(--dsw-alias-border-l3,#d8d8d8);background:var(--dsw-alias-bg-layer-1,transparent);
color:var(--dsw-alias-label-primary,inherit)}
.rl-field input::placeholder{color:var(--dsw-alias-label-dimmed,inherit)}
.rl-field input:focus{outline:none;border-color:var(--dsw-alias-brand-primary,#4b8bf5)}
/* \u53EA\u5199\u51ED\u636E\u884C\uFF08\u8BBF\u95EE\u5BC6\u94A5\uFF09\uFF1A\u503C\u4E0D\u56DE\u663E\uFF0C\u6240\u4EE5\u8349\u7A3F\u7559\u5728\u8F93\u5165\u6846\u91CC\u3001\u9760\u6309\u94AE\u663E\u5F0F\u63D0\u4EA4\u3002 */
.rl-secretRow{display:flex;align-items:center;gap:6px;margin-top:3px}
.rl-secretRow input{flex:1;min-width:0}
.rl-secretAction{flex:0 0 auto;font:inherit;font-size:11px;padding:4px 8px;border-radius:6px;cursor:pointer;
border:1px solid var(--dsw-alias-border-l3,#d8d8d8);background:var(--dsw-alias-button-elevated-fill,transparent);
color:var(--dsw-alias-label-secondary,inherit)}
.rl-secretAction:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}
.rl-secretAction:disabled{cursor:default;opacity:.5}
.rl-secretSaved{color:var(--dsw-alias-state-business-primary,#1e9650)}
.rl-fieldRow{display:flex;align-items:center;gap:6px;margin-top:8px;color:var(--dsw-alias-label-secondary,inherit)}
.rl-fieldRow input{accent-color:var(--dsw-alias-brand-primary,#4b8bf5)}
.rl-trigger{border:0;background:transparent;color:var(--dsw-alias-label-secondary,inherit);cursor:pointer;
padding:4px;border-radius:6px;line-height:0}
.rl-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.16))}
/* \u6CE8\u5165\u5230\u4FA7\u8FB9\u680F\u300C\u5DE5\u4F5C\u533A\u300D\u6807\u9898\u53F3\u4FA7\u52A8\u4F5C\u533A\u65F6\u7684\u5F62\u6001\uFF1A\u4E0E\u540C\u6392\u56FE\u6807\u6309\u94AE\u540C\u5C3A\u5BF8\uFF0828px \u5706\u5F62\uFF09\u3002 */
.rl-trigger-host{display:inline-flex;align-items:center;flex:none;max-width:28px;overflow:hidden;
transition:max-width .18s var(--ds-ease-in-out),opacity .12s var(--ds-ease-in-out)}
/*
 * \u52A8\u4F5C\u533A\u81EA\u5DF1\u5E26 max-width:60px + overflow:hidden\uFF0C\u800C 60px \u6B63\u597D\u53EA\u88C5\u5F97\u4E0B\u539F\u6765\u7684\u4E24\u4E2A
 * 28px \u56FE\u6807\uFF0828 + 4 + 28\uFF09\uFF1A\u591A\u51FA\u7B2C\u4E09\u4E2A\u5C31\u4F1A\u88AB\u88C1\u6389\u6700\u53F3\u8FB9\u90A3\u4E2A\uFF08\u6587\u4EF6\u5939/\u6DFB\u52A0\u5DE5\u4F5C\u533A\uFF09\u3002
 * \u6240\u4EE5\u63D2\u8FDB\u8FD9\u4E00\u884C\u65F6\uFF0C\u628A\u5BB9\u5668\u7684\u5BBD\u5EA6\u4E0A\u9650\u4E00\u8D77\u653E\u5F00\u2014\u2014\u4E09\u4E2A\u56FE\u6807 28*3 + 4*2 = 92\uFF0C\u7559 96\u3002
 * \u7C7B\u540D\u7531 installWorkspaceHeaderTrigger \u6302\u4E0A/\u6458\u6389\uFF0C\u8DDF\u7740\u6CE8\u5165\u8D70\u3002
 */
[class*="_headerActions"].rl-header-actions{max-width:96px}
/* \u8BE5\u52A8\u4F5C\u533A\u5728\u641C\u7D22\u6846\u5C55\u5F00\u65F6\u4F1A\u6536\u7F29\uFF08\u7236\u7EA7 class \u53D8\u4E3A *Hidden\uFF09\uFF1B\u5BBF\u4E3B\u540C\u6B65\u6536\u655B\uFF0C
   \u5426\u5219\u5B83\u4F1A\u9876\u4E0A\u641C\u7D22\u6846\u3001\u628A\u90A3\u4E00\u884C\u6324\u53D8\u5F62\u3002 */
[class*="_headerActionsHidden"] .rl-trigger-host{max-width:0;opacity:0;pointer-events:none}
.rl-trigger-host .rl-trigger{width:28px;height:28px;padding:0;border-radius:50%;
display:inline-flex;align-items:center;justify-content:center}
.rl-trigger-host .rl-trigger:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.16))}
`;
function ensureStyles(doc = document) {
  if (doc.getElementById(STYLE_ID) !== null) return;
  const style = doc.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE_TEXT;
  doc.head.appendChild(style);
}
function viewerUrlOf(state) {
  try {
    return new URL(REMOTE_VIEWER_PATH, state.url).toString();
  } catch {
    return void 0;
  }
}
function statusOf(t, state) {
  switch (state.phase) {
    case "connected":
      return { text: t("status.connected", { n: state.onlineCount }), tone: "connected" };
    case "disconnected":
      return { text: t("status.disconnected"), tone: "disconnected" };
    case "stopped":
      return { text: t("status.stopped"), tone: "stopped" };
    case "lan-required":
      return { text: t("status.lanRequired"), tone: "stopped" };
    case "waiting":
      return { text: t("status.waiting"), tone: "waiting" };
  }
}
function tunnelNote(t, tunnel) {
  if (tunnel === void 0 || tunnel.state === "running") return null;
  if (tunnel.state === "failed") {
    return (0, import_react2.createElement)("p", { className: "rl-failed", role: "status" }, t("tunnel.failed", { error: tunnel.error ?? t("tunnel.unknownError") }));
  }
  return (0, import_react2.createElement)("p", { className: "rl-note", role: "status" }, t("tunnel.starting"));
}
function PairPanel(props) {
  const { t, state } = props;
  return (0, import_react2.createElement)(
    "div",
    { className: "rl-panel", role: "dialog", "aria-modal": "true", "aria-label": t("title") },
    (0, import_react2.createElement)(
      "div",
      { className: "rl-header" },
      (0, import_react2.createElement)(
        "div",
        { className: "rl-heading" },
        (0, import_react2.createElement)("h2", { className: "rl-title" }, t("title")),
        (0, import_react2.createElement)("p", { className: "rl-subtitle" }, t("subtitle"))
      ),
      (0, import_react2.createElement)("button", { type: "button", className: "rl-close", "aria-label": t("close.label"), onClick: props.onClose }, "\u2715")
    ),
    // 隧道配置紧跟标题：它是「二维码能不能给远程用」的唯一开关，
    // 不能藏在折叠区里（外层也刻意不折叠，只把 frpcPath 等冷门项收进“高级”）。
    props.settings ?? null,
    state.kind === "lan-required" ? (0, import_react2.createElement)(
      "div",
      { className: "rl-banner", role: "alert" },
      (0, import_react2.createElement)("p", { className: "rl-bannerTitle" }, t("status.lanRequired")),
      (0, import_react2.createElement)("p", { className: "rl-bannerHint" }, t("status.lanRequiredHint")),
      tunnelNote(t, state.tunnel)
    ) : state.kind === "loopback-required" ? (0, import_react2.createElement)(
      "div",
      { className: "rl-banner", role: "alert" },
      (0, import_react2.createElement)("p", { className: "rl-bannerTitle" }, t("status.loopbackRequired")),
      (0, import_react2.createElement)("p", { className: "rl-bannerHint" }, t("status.loopbackRequiredHint"))
    ) : state.kind === "unreachable" ? (0, import_react2.createElement)(
      "div",
      { className: "rl-banner", role: "alert" },
      (0, import_react2.createElement)("p", { className: "rl-bannerTitle" }, t("status.unreachable")),
      (0, import_react2.createElement)("p", { className: "rl-bannerHint" }, t("status.unreachableHint"))
    ) : renderReady(props, state)
  );
}
function renderReady(props, state) {
  const { t } = props;
  const status = statusOf(t, state);
  const viewerUrl = viewerUrlOf(state);
  return (0, import_react2.createElement)(
    "div",
    null,
    (0, import_react2.createElement)(
      "div",
      { className: "rl-card" },
      (0, import_react2.createElement)(
        "div",
        { className: "rl-cardHeader" },
        (0, import_react2.createElement)("span", { className: "rl-cardTitle" }, t("card.title")),
        (0, import_react2.createElement)(
          "span",
          { className: "rl-badges" },
          state.public ? (0, import_react2.createElement)("span", { className: "rl-badge" }, t("public.badge")) : null,
          (0, import_react2.createElement)("span", { className: `rl-badge rl-badge-${status.tone}` }, status.text)
        )
      ),
      (0, import_react2.createElement)(
        "div",
        { className: "rl-qrWrap" },
        (0, import_react2.createElement)(QRCodeSVG, { value: state.url, size: 184, level: "M", marginSize: 1, className: "rl-qr" })
      ),
      state.expired ? (0, import_react2.createElement)("p", { className: "rl-expired" }, t("pair.expired")) : (0, import_react2.createElement)("p", { className: "rl-expiry" }, t("pair.expires", { time: formatClock(state.expiresAt) }))
    ),
    (0, import_react2.createElement)("p", { className: "rl-hint" }, state.public ? t("pair.publicHint") : t("pair.hint")),
    (0, import_react2.createElement)(
      "div",
      { className: "rl-pairLinks" },
      (0, import_react2.createElement)(
        "div",
        { className: "rl-pairLinkRow" },
        (0, import_react2.createElement)(
          "div",
          { className: "rl-pairLinkText" },
          (0, import_react2.createElement)("span", { className: "rl-pairLinkLabel" }, t("pair.linkLabel")),
          (0, import_react2.createElement)("code", { className: "rl-link", title: state.url }, state.url)
        ),
        (0, import_react2.createElement)(
          "button",
          { type: "button", className: "rl-copyLink", onClick: () => {
            props.onCopy(state.url);
          } },
          props.copied ? t("action.copied") : t("action.copyLink")
        )
      ),
      state.token !== void 0 && state.token !== "" ? (0, import_react2.createElement)(
        "div",
        { className: "rl-pairLinkRow" },
        (0, import_react2.createElement)(
          "div",
          { className: "rl-pairLinkText" },
          (0, import_react2.createElement)("span", { className: "rl-pairLinkLabel" }, t("pair.tokenLabel")),
          (0, import_react2.createElement)("code", { className: "rl-link", title: state.token }, state.token)
        ),
        (0, import_react2.createElement)(
          "button",
          { type: "button", className: "rl-copyLink", onClick: () => {
            props.onCopyToken(state.token ?? "");
          } },
          props.copiedToken ? t("action.copiedToken") : t("action.copyToken")
        )
      ) : null,
      // The read-only viewer rides the same origin as the QR link, so a phone
      // that can open the pairing link can open `/files` — and nothing else.
      viewerUrl !== void 0 ? (0, import_react2.createElement)(
        "div",
        { className: "rl-pairLinkRow" },
        (0, import_react2.createElement)(
          "div",
          { className: "rl-pairLinkText" },
          (0, import_react2.createElement)("span", { className: "rl-pairLinkLabel" }, t("viewer.label")),
          (0, import_react2.createElement)("code", { className: "rl-link", title: viewerUrl }, viewerUrl)
        ),
        (0, import_react2.createElement)(
          "button",
          { type: "button", className: "rl-copyLink", onClick: () => {
            props.onCopyViewer(viewerUrl);
          } },
          props.copiedViewer ? t("action.copied") : t("action.copyLink")
        )
      ) : null
    ),
    (0, import_react2.createElement)("p", { className: "rl-note" }, t("pair.oneTimeHint")),
    state.phase === "stopped" ? (0, import_react2.createElement)("p", { className: "rl-note" }, t("stopped.hint")) : null,
    tunnelNote(t, state.tunnel),
    state.publicBaseUrl !== void 0 || state.lanAddresses.length > 1 ? (0, import_react2.createElement)(
      "fieldset",
      { className: "rl-addresses" },
      (0, import_react2.createElement)("legend", null, t("address.label")),
      state.publicBaseUrl !== void 0 ? (0, import_react2.createElement)(
        "label",
        { className: "rl-address", key: "public" },
        (0, import_react2.createElement)("input", {
          type: "radio",
          name: "rl-address",
          checked: state.public,
          onChange: () => {
            props.onPickPublic();
          }
        }),
        (0, import_react2.createElement)("span", null, t("address.public")),
        (0, import_react2.createElement)("code", { className: "rl-addressValue" }, state.publicBaseUrl)
      ) : null,
      ...state.lanAddresses.map((address) => (0, import_react2.createElement)(
        "label",
        { className: "rl-address", key: address },
        (0, import_react2.createElement)("input", {
          type: "radio",
          name: "rl-address",
          checked: !state.public && address === state.address,
          onChange: () => {
            props.onPickAddress(address);
          }
        }),
        (0, import_react2.createElement)("span", null, t("address.lan")),
        (0, import_react2.createElement)("code", { className: "rl-addressValue" }, address),
        // 虚拟网卡（Hyper-V/WSL/VPN）同样“Up、非 loopback”，却从局域网连不上：
        // 选它就是扫码连不上的常见原因，所以明确标出来。
        state.lanVirtualAddresses?.includes(address) === true ? (0, import_react2.createElement)("span", { className: "rl-addressWarn" }, t("address.virtual")) : null
      ))
    ) : null,
    (0, import_react2.createElement)(
      "div",
      { className: "rl-actions" },
      (0, import_react2.createElement)("button", { type: "button", className: "rl-action", onClick: props.onStop }, t("action.stop")),
      (0, import_react2.createElement)("button", { type: "button", className: "rl-action", onClick: props.onRefresh }, t("action.refresh"))
    ),
    (0, import_react2.createElement)(
      "section",
      { className: "rl-devices", "aria-label": t("devices.title") },
      (0, import_react2.createElement)("h3", { className: "rl-devicesTitle" }, t("devices.title")),
      state.devices.length === 0 ? (0, import_react2.createElement)("p", { className: "rl-devicesEmpty" }, t("devices.empty")) : (0, import_react2.createElement)(
        "ul",
        { className: "rl-deviceList" },
        ...state.devices.map((device) => (0, import_react2.createElement)(
          "li",
          { className: "rl-deviceRow", key: device.id },
          (0, import_react2.createElement)(
            "div",
            { className: "rl-deviceMeta" },
            (0, import_react2.createElement)("span", { className: "rl-deviceName" }, deviceNameFromUserAgent(device.userAgent) ?? t("devices.unknown")),
            (0, import_react2.createElement)(
              "span",
              { className: `rl-devicePresence ${device.online ? "rl-deviceOnline" : "rl-deviceOffline"}` },
              device.online ? t("devices.online") : t("devices.offline")
            ),
            (0, import_react2.createElement)("span", { className: "rl-deviceSeen" }, t("devices.lastSeen", { time: formatLastSeen(device.lastSeenAt) }))
          ),
          (0, import_react2.createElement)("button", {
            type: "button",
            className: "rl-deviceRevoke",
            "aria-label": t("devices.revoke.label"),
            onClick: () => {
              props.onRevoke(device.id);
            }
          }, t("devices.revoke"))
        ))
      )
    )
  );
}

// src/client/SettingsForm.tsx
var import_react3 = require("react");
function Field({ label, value, placeholder, onChange }) {
  return (0, import_react3.createElement)(
    "div",
    { className: "rl-field" },
    (0, import_react3.createElement)("label", null, label),
    (0, import_react3.createElement)("input", {
      type: "text",
      value,
      ...placeholder !== void 0 ? { placeholder } : {},
      onChange: (event) => {
        onChange(event.target.value);
      }
    })
  );
}
function Toggle({ label, checked, onChange }) {
  return (0, import_react3.createElement)(
    "label",
    { className: "rl-fieldRow" },
    (0, import_react3.createElement)("input", {
      type: "checkbox",
      checked,
      onChange: (event) => {
        onChange(event.target.checked);
      }
    }),
    (0, import_react3.createElement)("span", null, label)
  );
}
function SecretField(props) {
  const [draft, setDraft] = (0, import_react3.useState)("");
  const [note, setNote] = (0, import_react3.useState)("idle");
  const pending = (0, import_react3.useRef)("");
  const sink = (0, import_react3.useRef)(props.onSave);
  sink.current = props.onSave;
  (0, import_react3.useEffect)(() => () => {
    const text = pending.current.trim();
    if (text !== "") sink.current(text);
  }, []);
  const commit = () => {
    const text = draft.trim();
    if (text === "") return;
    pending.current = "";
    setDraft("");
    setNote("saved");
    props.onSave(text);
  };
  const drop = () => {
    pending.current = "";
    setDraft("");
    setNote("cleared");
    props.onClear();
  };
  const hold = { onMouseDown: (event) => {
    event.preventDefault?.();
  } };
  const noteText = note === "saved" ? props.savedNote : note === "cleared" ? props.clearedNote : props.hint;
  return (0, import_react3.createElement)(
    "div",
    { className: "rl-field" },
    (0, import_react3.createElement)("label", null, props.label),
    (0, import_react3.createElement)(
      "div",
      { className: "rl-secretRow" },
      (0, import_react3.createElement)("input", {
        type: "password",
        value: draft,
        autoComplete: "off",
        ...props.placeholder !== void 0 ? { placeholder: props.placeholder } : {},
        disabled: props.disabled,
        onChange: (event) => {
          pending.current = event.target.value;
          setNote("idle");
          setDraft(event.target.value);
        },
        onBlur: () => {
          commit();
        },
        onKeyDown: (event) => {
          if (event.key === "Enter") commit();
        }
      }),
      (0, import_react3.createElement)("button", {
        ...hold,
        type: "button",
        className: "rl-secretAction",
        disabled: props.disabled || draft.trim() === "",
        onClick: () => {
          commit();
        }
      }, props.saveLabel),
      (0, import_react3.createElement)("button", {
        ...hold,
        type: "button",
        className: "rl-secretAction",
        disabled: props.disabled,
        onClick: () => {
          drop();
        }
      }, props.clearLabel)
    ),
    (0, import_react3.createElement)("p", { className: note === "saved" ? "rl-note rl-secretSaved" : "rl-note", role: "status" }, noteText)
  );
}
function SettingsForm({ t, snapshot, save, clear }) {
  const value = snapshot.value ?? {};
  const disabled = snapshot.status !== "ready" || !snapshot.writable;
  const text = (field) => {
    const raw = value[field];
    return typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
  };
  const write = (field, next) => {
    if (next === "") clear(field);
    else save(field, next);
  };
  return (0, import_react3.createElement)(
    "section",
    { className: "rl-settings", "aria-label": t("settings.title") },
    (0, import_react3.createElement)("h3", { className: "rl-settingsTitle" }, t("settings.title")),
    (0, import_react3.createElement)("p", { className: "rl-note" }, t("settings.subtitle")),
    snapshot.status !== "ready" ? (0, import_react3.createElement)("p", { className: "rl-note" }, t("settings.unavailable")) : null,
    !snapshot.writable && snapshot.status === "ready" ? (0, import_react3.createElement)("p", { className: "rl-note" }, t("settings.readonly")) : null,
    (0, import_react3.createElement)(
      "fieldset",
      { disabled, className: "rl-settingsBody" },
      (0, import_react3.createElement)(Toggle, {
        label: t("settings.tunnelEnabled"),
        checked: value.tunnelEnabled === true,
        onChange: (next) => {
          save("tunnelEnabled", next);
        }
      }),
      (0, import_react3.createElement)(SecretField, {
        label: t("settings.frpcToken"),
        placeholder: t("settings.frpcTokenPlaceholder"),
        hint: t("settings.frpcTokenHint"),
        savedNote: t("settings.frpcTokenSaved"),
        clearedNote: t("settings.frpcTokenCleared"),
        saveLabel: t("settings.frpcTokenSave"),
        clearLabel: t("settings.frpcTokenClear"),
        disabled,
        onSave: (next) => {
          save("frpcToken", next);
        },
        onClear: () => {
          clear("frpcToken");
        }
      }),
      (0, import_react3.createElement)(Field, {
        label: t("settings.frpcTunnelIds"),
        value: text("frpcTunnelIds"),
        placeholder: t("settings.frpcTunnelIdsHint"),
        onChange: (next) => {
          write("frpcTunnelIds", next.trim());
        }
      }),
      (0, import_react3.createElement)(Field, {
        label: t("settings.frpcPublicBaseUrl"),
        value: text("frpcPublicBaseUrl"),
        placeholder: "http://example.com:12345",
        onChange: (next) => {
          write("frpcPublicBaseUrl", next.trim());
        }
      }),
      (0, import_react3.createElement)(
        "details",
        { className: "rl-advanced" },
        (0, import_react3.createElement)("summary", null, t("settings.advanced")),
        (0, import_react3.createElement)(Field, {
          label: t("settings.frpcPath"),
          value: text("frpcPath"),
          placeholder: "<\u63D2\u4EF6>/bin/frpc.exe",
          onChange: (next) => {
            write("frpcPath", next.trim());
          }
        }),
        (0, import_react3.createElement)(Toggle, {
          label: t("settings.frpcManageProcess"),
          checked: value.frpcManageProcess !== false,
          onChange: (next) => {
            save("frpcManageProcess", next);
          }
        }),
        (0, import_react3.createElement)(Toggle, {
          label: t("settings.requirePairingForLan"),
          checked: value.requirePairingForLan !== false,
          onChange: (next) => {
            save("requirePairingForLan", next);
          }
        }),
        // The panel is the only settings surface this namespace has (no card
        // claims it on Settings → Plugins), so the namespaces this form does
        // not show (token lifetime, device cap, trusted hosts, …) are named
        // with the document that holds them rather than a page that is empty.
        (0, import_react3.createElement)("p", { className: "rl-note" }, t("settings.hostPageHint"))
      )
    ),
    (0, import_react3.createElement)("p", { className: "rl-note" }, t("settings.hint"))
  );
}

// src/client/LanAccess.tsx
var import_react4 = require("react");
function LanAccess({ t, frame, controllable, setting, onToggle, onCopy, copied }) {
  const bound = frame?.bindHost === "0.0.0.0";
  const pending = frame?.pendingRestart === true;
  const url = frame?.lanUrls?.[0];
  const firewallNote = frame?.firewall?.managed === true && frame.firewall.ok === false ? t("lan.firewallBlocked") : null;
  const statusLine = !controllable ? t("lan.remoteView") : bound ? t("lan.boundOn", { port: frame?.port ?? "" }) : t("lan.boundOff");
  return (0, import_react4.createElement)(
    "section",
    { className: "rl-lan", "aria-label": t("lan.title") },
    (0, import_react4.createElement)("h3", { className: "rl-settingsTitle" }, t("lan.title")),
    (0, import_react4.createElement)("p", { className: "rl-note" }, t("lan.subtitle")),
    controllable ? (0, import_react4.createElement)(
      "label",
      { className: "rl-fieldRow" },
      (0, import_react4.createElement)("input", {
        type: "checkbox",
        checked: setting === true,
        onChange: (event) => {
          onToggle(event.target.checked);
        }
      }),
      (0, import_react4.createElement)("span", null, t("lan.toggle"))
    ) : null,
    (0, import_react4.createElement)("p", { className: "rl-note", role: "status" }, statusLine),
    bound && url !== void 0 ? (0, import_react4.createElement)(
      "div",
      { className: "rl-lanAddress" },
      (0, import_react4.createElement)("code", { className: "rl-link", title: url }, url),
      (0, import_react4.createElement)(
        "button",
        { type: "button", className: "rl-copyLink", onClick: () => {
          onCopy(url);
        } },
        copied ? t("action.copied") : t("action.copyLink")
      )
    ) : null,
    pending ? (0, import_react4.createElement)("p", { className: "rl-failed", role: "alert" }, t("lan.pendingRestart")) : null,
    firewallNote !== null ? (0, import_react4.createElement)("p", { className: "rl-failed", role: "alert" }, firewallNote) : null
  );
}

// src/client/remote-channel.ts
var RULES = REMOTE_CHANNEL_RULES;
function remoteChannelRequired(hostname, snapshot, hostPairingPolicy) {
  if (isLoopbackHostname(hostname)) return false;
  if (snapshot.status === "ready") {
    return (snapshot.value?.enabled ?? true) && (snapshot.value?.requirePairingForLan ?? true);
  }
  return hostPairingPolicy !== false;
}
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "::1") return true;
  const parts = hostname.split(".");
  return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function shouldRewriteFetchPath(pathname) {
  if (pathname.startsWith(RULES.pairPrefix)) return false;
  if (pathname.startsWith(RULES.updatePrefix)) return false;
  if (pathname === RULES.settingsBridgePrefix || pathname.startsWith(`${RULES.settingsBridgePrefix}/`)) return false;
  if (pathname.startsWith(RULES.apiPrefix)) return true;
  if (pathname.startsWith(RULES.sidebarPrefix) || pathname === "/sidebar") return true;
  if (pathname.startsWith(RULES.gitPrefix) || pathname === "/git") return true;
  if (pathname.startsWith(RULES.petPrefix) || pathname === "/pet") return true;
  return false;
}
function shouldRewriteWsPath(pathname) {
  return RULES.wsPaths.includes(pathname);
}
function rewritePath(pathname) {
  return `${REMOTE_PREFIX}${pathname}`;
}
function rewriteRawUrl(raw, baseHref, origin) {
  let url;
  try {
    url = new URL(raw, baseHref);
  } catch {
    return raw;
  }
  if (url.origin !== origin) return raw;
  if (!shouldRewriteFetchPath(url.pathname)) return raw;
  url.pathname = rewritePath(url.pathname);
  if (raw.startsWith("/") && !raw.startsWith("//")) {
    return `${url.pathname}${url.search}${url.hash}`;
  }
  return url.href;
}
function readStoredDevice(window2) {
  try {
    const session = window2.sessionStorage?.getItem(RULES.deviceKey) ?? null;
    if (session !== null) return session;
  } catch {
  }
  try {
    return window2.localStorage?.getItem(RULES.deviceKey) ?? null;
  } catch {
    return null;
  }
}
function unpairedCodeOf(value) {
  if (typeof value !== "object" || value === null) return void 0;
  const record = value;
  const nested = record.result;
  if (typeof nested === "object" && nested !== null) {
    const error2 = nested.error;
    if (typeof error2 === "object" && error2 !== null && typeof error2.code === "string") {
      return error2.code;
    }
  }
  const error = record.error;
  if (typeof error === "object" && error !== null && typeof error.code === "string") {
    return error.code;
  }
  return void 0;
}
async function isUnpairedDenied(response) {
  if (response.status !== 403) return false;
  try {
    return unpairedCodeOf(await response.json()) === "unpaired";
  } catch {
    return false;
  }
}
function patchSrcAccessor(ctor, rewrite) {
  if (ctor === void 0) return () => {
  };
  const descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, "src");
  if (descriptor === void 0 || descriptor.configurable === false) return () => {
  };
  if (descriptor.set === void 0) return () => {
  };
  const originalSet = descriptor.set;
  const originalGet = descriptor.get;
  Object.defineProperty(ctor.prototype, "src", {
    configurable: true,
    enumerable: descriptor.enumerable ?? true,
    get: originalGet,
    set(value) {
      originalSet.call(this, rewrite(String(value)));
    }
  });
  return () => {
    Object.defineProperty(ctor.prototype, "src", descriptor);
  };
}
function installRemoteChannel(window2, options = {}) {
  const originalFetch = window2.fetch;
  const OriginalWebSocket = window2.WebSocket;
  const OriginalEventSource = window2.EventSource;
  const sameOrigin = (url) => url.origin === window2.location.origin;
  const rewrite = (raw) => rewriteRawUrl(raw, window2.location.href, window2.location.origin);
  const device = readStoredDevice(window2);
  const attach = (init) => {
    if (device === null) return init;
    const headers = init?.headers;
    if (typeof Headers !== "undefined" && headers instanceof Headers) {
      try {
        headers.set(RULES.deviceHeader, device);
      } catch {
      }
      return init;
    }
    if (typeof headers === "object" && headers !== null) {
      return { ...init, headers: { ...headers, [RULES.deviceHeader]: device } };
    }
    return init;
  };
  const withDeviceQuery = (url) => {
    if (device !== null) url.searchParams.set(RULES.deviceQuery, device);
    return url;
  };
  const patchedFetch = (input, init) => {
    const url = new URL(
      typeof input === "string" || input instanceof URL ? input.toString() : input.url,
      window2.location.href
    );
    if (sameOrigin(url) && shouldRewriteFetchPath(url.pathname)) {
      const rewritten = new URL(url);
      rewritten.pathname = rewritePath(url.pathname);
      const next = typeof input === "string" || input instanceof URL ? rewritten.toString() : new Request(rewritten, input);
      return Promise.resolve(originalFetch.call(window2, next, attach(init))).then(async (response) => {
        if (await isUnpairedDenied(response.clone())) options.onUnpaired?.();
        else options.onPaired?.();
        return response;
      });
    }
    return originalFetch.call(window2, input, init);
  };
  class PatchedWebSocket extends OriginalWebSocket {
    constructor(url, protocols) {
      const parsed = new URL(url.toString(), window2.location.href);
      const wsOrigin = parsed.protocol === "wss:" ? `https://${parsed.host}` : parsed.protocol === "ws:" ? `http://${parsed.host}` : "";
      if (wsOrigin !== "" && wsOrigin === window2.location.origin && shouldRewriteWsPath(parsed.pathname)) {
        const rewritten = new URL(parsed);
        rewritten.pathname = rewritePath(parsed.pathname);
        super(withDeviceQuery(rewritten), protocols);
        return;
      }
      super(url, protocols);
    }
  }
  const restoreSrc = [
    patchSrcAccessor(window2.HTMLImageElement, rewrite),
    patchSrcAccessor(window2.HTMLScriptElement, rewrite),
    patchSrcAccessor(window2.HTMLIFrameElement, rewrite)
  ];
  window2.fetch = patchedFetch;
  window2.WebSocket = PatchedWebSocket;
  if (OriginalEventSource !== void 0) {
    class PatchedEventSource extends OriginalEventSource {
      constructor(url, eventSourceInitDict) {
        const parsed = new URL(url.toString(), window2.location.href);
        if (sameOrigin(parsed) && shouldRewriteFetchPath(parsed.pathname)) {
          const rewritten = new URL(parsed);
          rewritten.pathname = rewritePath(parsed.pathname);
          super(withDeviceQuery(rewritten), eventSourceInitDict);
          return;
        }
        super(url, eventSourceInitDict);
      }
    }
    window2.EventSource = PatchedEventSource;
  }
  return () => {
    window2.fetch = originalFetch;
    window2.WebSocket = OriginalWebSocket;
    if (OriginalEventSource !== void 0) window2.EventSource = OriginalEventSource;
    for (const restore of restoreSrc) restore();
  };
}
function channelTransition(active, installed) {
  if (active && !installed) return "install";
  if (!active && installed) return "retire";
  return "none";
}

// src/client/index.ts
var NS = "remote-link";
var REMOTE_LINK_NS = "remote-link";
var HEARTBEAT_INTERVAL_MS = 1e4;
var PAIR_FAILED_MARKER = "dsh-remote-link-pair-failed";
var inject = ["slots", "locale", "connection", "settingsScope"];
var zh = {
  "entry.label": "\u8FDC\u7A0B\u94FE\u63A5\uFF08\u626B\u7801\u914D\u5BF9\uFF09",
  "title": "\u8FDC\u7A0B\u94FE\u63A5",
  "subtitle": "\u7528\u53E6\u4E00\u53F0\u8BBE\u5907\u626B\u7801\u6216\u6253\u5F00\u94FE\u63A5\uFF0C\u5373\u53EF\u8FDB\u5165\u540C\u4E00\u4E2A Web GUI\u3002",
  "close.label": "\u5173\u95ED",
  "status.lanRequired": "\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u7684\u8BBF\u95EE\u5730\u5740",
  "status.lanRequiredHint": "\u8BF7\u5728\u8BBE\u7F6E\u91CC\u5F00\u542F SakuraFrp \u96A7\u9053\uFF0C\u6216\u7528 --host 0.0.0.0 \u5141\u8BB8\u5C40\u57DF\u7F51\u8BBF\u95EE\u540E\u91CD\u8BD5\u3002",
  "status.loopbackRequired": "\u8BF7\u5728\u684C\u9762\u7AEF\uFF08127.0.0.1\uFF09\u6253\u5F00\u672C\u9762\u677F",
  "status.loopbackRequiredHint": "\u914D\u5BF9\u5C5E\u4E8E\u672C\u673A\u63A7\u5236\u9762\uFF0C\u53EA\u80FD\u4ECE\u672C\u673A\u6253\u5F00\uFF1B\u8FDC\u7A0B\u8BBE\u5907\u8BF7\u76F4\u63A5\u8BBF\u95EE\u5DF2\u914D\u5BF9\u94FE\u63A5\u3002",
  "status.unreachable": "\u65E0\u6CD5\u8FDE\u63A5\u5230 host",
  "status.unreachableHint": "\u8BF7\u786E\u8BA4 dsh web \u4ECD\u5728\u8FD0\u884C\uFF0C\u7136\u540E\u91CD\u8BD5\u3002",
  "status.connected": "\u5DF2\u8FDE\u63A5\uFF08{n} \u53F0\u5728\u7EBF\uFF09",
  "status.disconnected": "\u8BBE\u5907\u5DF2\u79BB\u7EBF",
  "status.stopped": "\u5DF2\u505C\u6B62",
  "status.waiting": "\u7B49\u5F85\u626B\u7801",
  "card.title": "\u914D\u5BF9\u4E8C\u7EF4\u7801",
  "public.badge": "\u96A7\u9053",
  "pair.expired": "\u4E8C\u7EF4\u7801\u5DF2\u8FC7\u671F\uFF0C\u70B9\u201C\u5237\u65B0\u201D\u751F\u6210\u65B0\u7684\u3002",
  "pair.expires": "\u6709\u6548\u671F\u81F3 {time}",
  "pair.hint": "\u7528\u624B\u673A\u626B\u4E0A\u9762\u7684\u4E8C\u7EF4\u7801\uFF0C\u6216\u76F4\u63A5\u6253\u5F00\u4E0B\u9762\u8FD9\u6761\u94FE\u63A5\u3002",
  "pair.publicHint": "\u8FD9\u6761\u94FE\u63A5\u8D70 SakuraFrp \u96A7\u9053\uFF0C\u624B\u673A\u5728\u4EFB\u610F\u7F51\u7EDC\u626B\u7801\u5373\u53EF\u8FDC\u7A0B\u8FDB\u5165\uFF1B\u96A7\u9053\u5730\u5740\u5C31\u662F\u4E0A\u9762\u4E8C\u7EF4\u7801\u91CC\u7684\u5730\u5740\u3002",
  "pair.linkLabel": "\u8BBF\u95EE\u94FE\u63A5",
  "pair.tokenLabel": "\u914D\u5BF9\u4EE4\u724C",
  "viewer.label": "\u53EA\u8BFB\u6587\u4EF6\u67E5\u770B\u5668",
  "pair.oneTimeHint": "\u4E00\u6B21\u53EA\u4FDD\u7559\u4E00\u4E2A\u6709\u6548\u4EE4\u724C\uFF1B\u5237\u65B0\u4E8C\u7EF4\u7801\u4F1A\u8BA9\u4E0A\u4E00\u6761\u94FE\u63A5\u7ACB\u5373\u5931\u6548\u3002",
  "action.copyLink": "\u590D\u5236\u94FE\u63A5",
  "action.copied": "\u5DF2\u590D\u5236",
  "action.copyToken": "\u590D\u5236\u4EE4\u724C",
  "action.copiedToken": "\u5DF2\u590D\u5236",
  "action.stop": "\u505C\u6B62\u5E76\u64A4\u9500",
  "action.refresh": "\u5237\u65B0\u4E8C\u7EF4\u7801",
  "stopped.hint": "\u8FDC\u7A0B\u8BBF\u95EE\u5DF2\u505C\u6B62\uFF1B\u70B9\u201C\u5237\u65B0\u4E8C\u7EF4\u7801\u201D\u91CD\u65B0\u5F00\u542F\u3002",
  "devices.title": "\u5DF2\u6388\u6743\u8BBE\u5907",
  "devices.empty": "\u6682\u65E0\u5DF2\u914D\u5BF9\u8BBE\u5907\u3002",
  "devices.unknown": "\u672A\u77E5\u8BBE\u5907",
  "devices.online": "\u5728\u7EBF",
  "devices.offline": "\u79BB\u7EBF",
  "devices.lastSeen": "\u6700\u8FD1\u6D3B\u52A8 {time}",
  "devices.revoke": "\u64A4\u9500",
  "devices.revoke.label": "\u64A4\u9500\u8BE5\u8BBE\u5907\u7684\u8BBF\u95EE",
  "address.label": "\u4E8C\u7EF4\u7801\u4F7F\u7528\u7684\u5730\u5740",
  "address.public": "\u96A7\u9053\u5730\u5740",
  "address.lan": "\u5C40\u57DF\u7F51",
  "address.virtual": "\u865A\u62DF\u7F51\u5361\uFF0C\u4E00\u822C\u8FDE\u4E0D\u4E0A",
  "lan.title": "\u5C40\u57DF\u7F51\u8BBF\u95EE",
  "lan.subtitle": "\u5173\u6389\u65F6\u53EA\u7ED1 127.0.0.1\uFF0C\u5C40\u57DF\u7F51\u8BBE\u5907\u8FDE\u4E0D\u4E0A\u3002",
  "lan.toggle": "\u5141\u8BB8\u5C40\u57DF\u7F51\u8BBE\u5907\u8FDE\u63A5\uFF08\u5199\u914D\u7F6E\uFF0C\u91CD\u542F\u751F\u6548\uFF09",
  "lan.boundOn": "\u5F53\u524D\u7ED1\u5B9A: \u6240\u6709\u7F51\u5361\uFF080.0.0.0\uFF09\uFF0C\u7AEF\u53E3 {port} \u2014\u2014 \u5C40\u57DF\u7F51\u53EF\u8BBF\u95EE",
  "lan.boundOff": "\u5F53\u524D\u7ED1\u5B9A: \u4EC5\u672C\u673A\uFF08127.0.0.1\uFF09\u2014\u2014 \u5C40\u57DF\u7F51\u4E0D\u53EF\u8BBF\u95EE",
  "lan.remoteView": "\u5F53\u524D\u7ED1\u5B9A: \u6240\u6709\u7F51\u5361\uFF08\u4F60\u6B63\u4ECE\u5176\u5B83\u8BBE\u5907\u6253\u5F00\u672C\u9875\uFF09",
  "lan.pendingRestart": "\u914D\u7F6E\u5DF2\u6539\uFF0C\u91CD\u542F dsh web \u540E\u751F\u6548\u3002",
  "lan.firewallBlocked": "\u9632\u706B\u5899\u7F3A\u8BE5\u7AEF\u53E3\u7684\u653E\u884C\u89C4\u5219\uFF08\u9700\u7BA1\u7406\u5458\uFF09\uFF0C\u5C40\u57DF\u7F51\u8BBE\u5907\u53EF\u80FD\u8FDE\u4E0D\u4E0A\u3002",
  "tunnel.starting": "SakuraFrp \u96A7\u9053\u542F\u52A8\u4E2D\u2026",
  "tunnel.failed": "SakuraFrp \u96A7\u9053\u5931\u8D25\uFF1A{error}",
  "tunnel.unknownError": "\u672A\u77E5\u9519\u8BEF",
  "settings.title": "SakuraFrp \u96A7\u9053",
  "settings.subtitle": "\u586B\u5BC6\u94A5\u5E76\u5F00\u542F\uFF1A\u63D2\u4EF6\u81EA\u52A8\u62C9\u8D77 frpc\uFF0C\u4E8C\u7EF4\u7801\u6539\u7528\u516C\u7F51\u5730\u5740\u3002",
  "settings.tunnelEnabled": "\u5F00\u542F\u96A7\u9053\uFF08\u8FDC\u7A0B\u6A21\u5F0F\uFF09",
  "settings.frpcToken": "\u8BBF\u95EE\u5BC6\u94A5",
  "settings.frpcTokenPlaceholder": "token \u6216 token:\u96A7\u9053ID",
  "settings.frpcTokenHint": "\u53EA\u5199\u4E0D\u8BFB\uFF1A\u4FDD\u5B58\u540E\u4E0D\u56DE\u663E\uFF0C\u7559\u7A7A\u4E0D\u6E05\u9664\u3002",
  "settings.frpcTokenSave": "\u4FDD\u5B58",
  "settings.frpcTokenClear": "\u6E05\u9664",
  "settings.frpcTokenSaved": "\u5DF2\u4FDD\u5B58\uFF08\u4E0D\u56DE\u663E\uFF09",
  "settings.frpcTokenCleared": "\u5DF2\u6E05\u9664",
  "settings.frpcTunnelIds": "\u96A7\u9053 ID",
  "settings.frpcTunnelIdsHint": "\u9017\u53F7\u5206\u9694\uFF1B\u7559\u7A7A\u7528 token \u81EA\u5E26",
  "settings.frpcPath": "frpc \u8DEF\u5F84",
  "settings.frpcPublicBaseUrl": "\u516C\u7F51\u5730\u5740\uFF08\u515C\u5E95\uFF09",
  "settings.frpcPublicBaseUrlHint": "\u65E5\u5FD7\u91CC\u89E3\u6790\u4E0D\u5230\u5730\u5740\u65F6\u7528",
  "settings.frpcManageProcess": "\u6258\u7BA1 frpc \u8FDB\u7A0B",
  "settings.requirePairingForLan": "\u975E\u672C\u673A\u8BBF\u95EE\u9700\u914D\u5BF9",
  "settings.lanBind": "\u5141\u8BB8\u5C40\u57DF\u7F51\u8BBF\u95EE\uFF08\u5199\u914D\u7F6E\uFF0C\u91CD\u542F\u751F\u6548\uFF09",
  "settings.hint": "\u5BC6\u94A5\u4E0E\u96A7\u9053 ID \u6765\u81EA natfrp.com\u3002",
  "settings.advanced": "\u9AD8\u7EA7",
  "settings.hostPageHint": "\u5176\u4F59\u9879\uFF08\u4EE4\u724C\u6709\u6548\u671F\u3001\u8BBE\u5907\u4E0A\u9650\u7B49\uFF09\u5728 settings.yaml \u7684 remote-link \u6BB5\u3002",
  "settings.loading": "\u8BFB\u53D6\u8BBE\u7F6E\u2026",
  "settings.unavailable": "\u8FDC\u7A0B\u9875\u9762\u4E0D\u80FD\u6539\u8BBE\u7F6E\uFF1B\u8BF7\u5728\u684C\u9762\u7AEF\uFF08127.0.0.1\uFF09\u6253\u5F00\u672C\u9762\u677F\u3002",
  "settings.readonly": "\u5F53\u524D\u4E0D\u63A5\u53D7\u8BBE\u7F6E\u5199\u5165\u3002",
  "fence.title": "\u6B64\u8BBE\u5907\u5C1A\u672A\u914D\u5BF9",
  "fence.body": "\u8BF7\u7528\u684C\u9762\u7AEF\u201C\u8FDC\u7A0B\u94FE\u63A5\u201D\u9762\u677F\u91CD\u65B0\u751F\u6210\u4E8C\u7EF4\u7801\u5E76\u626B\u7801\uFF1B\u91CD\u65B0\u914D\u5BF9\u540E\u672C\u9875\u5373\u53EF\u6B63\u5E38\u4F7F\u7528\u3002",
  "fence.retry": "\u91CD\u65B0\u8F7D\u5165",
  "pairFailed.title": "\u914D\u5BF9\u5931\u8D25",
  "pairFailed.body": "\u94FE\u63A5\u53EF\u80FD\u5DF2\u8FC7\u671F\u6216\u88AB\u66FF\u6362\uFF0C\u8BF7\u5728\u684C\u9762\u7AEF\u5237\u65B0\u4E8C\u7EF4\u7801\u540E\u91CD\u8BD5\u3002",
  "pairFailed.close": "\u77E5\u9053\u4E86"
};
var en = {
  "entry.label": "Remote link (scan to pair)",
  "title": "Remote link",
  "subtitle": "Scan the code or open the link on another device to enter this same Web GUI.",
  "close.label": "Close",
  "status.lanRequired": "No reachable address yet",
  "status.lanRequiredHint": "Turn the SakuraFrp tunnel on in settings, or start dsh web with --host 0.0.0.0 for LAN access.",
  "status.loopbackRequired": "Open this panel on the desktop (127.0.0.1)",
  "status.loopbackRequiredHint": "Pairing is a local control plane; remote devices use an already-paired link.",
  "status.unreachable": "Cannot reach the host",
  "status.unreachableHint": "Check that dsh web is still running, then retry.",
  "status.connected": "Connected ({n} online)",
  "status.disconnected": "Devices offline",
  "status.stopped": "Stopped",
  "status.waiting": "Waiting for a scan",
  "card.title": "Pairing QR",
  "public.badge": "Tunnel",
  "pair.expired": "This QR expired \u2014 press Refresh for a new one.",
  "pair.expires": "Valid until {time}",
  "pair.hint": "Scan the code with a phone, or open the link below.",
  "pair.publicHint": "This link rides the SakuraFrp tunnel, so any network can open it.",
  "pair.linkLabel": "Link",
  "pair.tokenLabel": "Pairing token",
  "viewer.label": "Read-only file viewer",
  "pair.oneTimeHint": "One token is live at a time; refreshing the QR invalidates the previous link.",
  "action.copyLink": "Copy link",
  "action.copied": "Copied",
  "action.copyToken": "Copy token",
  "action.copiedToken": "Copied",
  "action.stop": "Stop and revoke",
  "action.refresh": "Refresh QR",
  "stopped.hint": "Remote access is stopped; press Refresh QR to re-arm it.",
  "devices.title": "Authorized devices",
  "devices.empty": "No paired device yet.",
  "devices.unknown": "Unknown device",
  "devices.online": "online",
  "devices.offline": "offline",
  "devices.lastSeen": "last seen {time}",
  "devices.revoke": "Revoke",
  "devices.revoke.label": "Revoke this device",
  "address.label": "Address the QR uses",
  "address.public": "Tunnel",
  "address.lan": "LAN",
  "address.virtual": "virtual adapter (usually unreachable)",
  "lan.title": "LAN access",
  "lan.subtitle": "Off binds 127.0.0.1 only \u2014 no LAN device can connect.",
  "lan.toggle": "Allow LAN devices (writes config; restart applies it)",
  "lan.boundOn": "Bound to: all interfaces (0.0.0.0), port {port} \u2014 reachable on the LAN",
  "lan.boundOff": "Bound to: loopback only (127.0.0.1) \u2014 not reachable on the LAN",
  "lan.remoteView": "Bound to: all interfaces (you opened this page from another device)",
  "lan.pendingRestart": "Config changed \u2014 restart dsh web to apply it.",
  "lan.firewallBlocked": "No firewall allow rule for this port yet (needs admin); LAN devices may fail to connect.",
  "tunnel.starting": "SakuraFrp tunnel is starting\u2026",
  "tunnel.failed": "SakuraFrp tunnel failed: {error}",
  "tunnel.unknownError": "unknown error",
  "settings.title": "SakuraFrp tunnel",
  "settings.subtitle": "Token in, tunnel on: frpc starts and the QR uses the public address.",
  "settings.tunnelEnabled": "Enable tunnel (remote mode)",
  "settings.frpcToken": "Access token",
  "settings.frpcTokenPlaceholder": "token or token:tunnelId",
  "settings.frpcTokenHint": "Write-only: never shown again; empty keeps it.",
  "settings.frpcTokenSave": "Save",
  "settings.frpcTokenClear": "Clear",
  "settings.frpcTokenSaved": "Saved (not shown again)",
  "settings.frpcTokenCleared": "Cleared",
  "settings.frpcTunnelIds": "Tunnel id(s)",
  "settings.frpcTunnelIdsHint": "comma-separated; empty uses the token",
  "settings.frpcPath": "frpc path",
  "settings.frpcPublicBaseUrl": "Public URL (fallback)",
  "settings.frpcPublicBaseUrlHint": "used when the log has no address",
  "settings.frpcManageProcess": "Manage the frpc process",
  "settings.requirePairingForLan": "Non-local access needs pairing",
  "settings.lanBind": "Allow LAN access (writes config; restart)",
  "settings.hint": "Token and tunnel id come from natfrp.com.",
  "settings.advanced": "Advanced",
  "settings.hostPageHint": "Everything else (token lifetime, device cap, \u2026) is in the remote-link section of settings.yaml.",
  "settings.loading": "Reading settings\u2026",
  "settings.unavailable": "Remote pages cannot write settings \u2014 open this panel on the desktop (127.0.0.1).",
  "settings.readonly": "Settings writes are refused right now.",
  "fence.title": "This device is not paired",
  "fence.body": "Open the Remote link panel on the desktop, refresh the QR, and scan again.",
  "fence.retry": "Reload",
  "pairFailed.title": "Pairing failed",
  "pairFailed.body": "The link may have expired or been replaced. Refresh the QR on the desktop and try again.",
  "pairFailed.close": "Dismiss"
};
function translate(dict, key, params) {
  const template = dict[key] ?? en[key] ?? key;
  if (params === void 0) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = params[name];
    return value === void 0 ? match : String(value);
  });
}
function LinkGlyph({ size = 16 }) {
  return (0, import_react5.createElement)(
    "svg",
    { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true" },
    (0, import_react5.createElement)("path", {
      d: "M6.4 9.6a3 3 0 0 1 0-4.2l1.4-1.4a3 3 0 0 1 4.2 4.2l-.7.7M9.6 6.4a3 3 0 0 1 0 4.2l-1.4 1.4a3 3 0 0 1-4.2-4.2l.7-.7",
      stroke: "currentColor",
      "stroke-width": "1.5",
      "stroke-linecap": "round"
    })
  );
}
function FenceNotice({ t, onRetry }) {
  return (0, import_react5.createElement)(
    "div",
    { className: "rl-overlay" },
    (0, import_react5.createElement)("div", { className: "rl-mask" }),
    (0, import_react5.createElement)(
      "div",
      { className: "rl-panel", role: "alertdialog" },
      (0, import_react5.createElement)("h2", { className: "rl-title" }, t("fence.title")),
      (0, import_react5.createElement)("p", { className: "rl-hint" }, t("fence.body")),
      (0, import_react5.createElement)(
        "div",
        { className: "rl-actions" },
        (0, import_react5.createElement)("button", { type: "button", className: "rl-action", onClick: onRetry }, t("fence.retry"))
      )
    )
  );
}
function RemoteLinkEntry({ wide, t }) {
  const [open, setOpen] = (0, import_react5.useState)(false);
  const [state, setState] = (0, import_react5.useState)({ kind: "lan-required" });
  const stateRef = (0, import_react5.useRef)(state);
  (0, import_react5.useEffect)(() => {
    stateRef.current = state;
  }, [state]);
  const [copied, setCopied] = (0, import_react5.useState)(false);
  const [copiedToken, setCopiedToken] = (0, import_react5.useState)(false);
  const [copiedAddress, setCopiedAddress] = (0, import_react5.useState)(false);
  const [copiedViewer, setCopiedViewer] = (0, import_react5.useState)(false);
  const [lanBindFrame, setLanBindFrame] = (0, import_react5.useState)(void 0);
  const eventSource = (0, import_react5.useRef)(void 0);
  const openSeq = (0, import_react5.useRef)(0);
  const triggerRef = (0, import_react5.useRef)(null);
  const [scope, setScope] = (0, import_react5.useState)(void 0);
  const [snapshot, setSnapshot] = (0, import_react5.useState)(void 0);
  const closeEventSource = (0, import_react5.useCallback)(() => {
    eventSource.current?.close();
    eventSource.current = void 0;
  }, []);
  const mint = (0, import_react5.useCallback)(async (address) => {
    let result;
    try {
      result = await issuePair(address);
    } catch {
      return { kind: "unreachable" };
    }
    if (!result.ok) {
      if (result.code === "forbidden") return { kind: "loopback-required" };
      if (result.code === "unknown-address") return { kind: "unreachable" };
      return { kind: "lan-required" };
    }
    const publicBaseUrl = result.publicBaseUrl;
    return {
      kind: "ready",
      url: result.url,
      token: result.token,
      expiresAt: result.expiresAt,
      expired: Date.now() > result.expiresAt,
      phase: "waiting",
      deviceCount: 0,
      onlineCount: 0,
      devices: [],
      public: publicBaseUrl !== void 0 && result.url.startsWith(publicBaseUrl),
      ...publicBaseUrl !== void 0 ? { publicBaseUrl } : {},
      address: address ?? result.lanAddresses[0] ?? "",
      lanAddresses: result.lanAddresses,
      ...result.lanVirtualAddresses !== void 0 ? { lanVirtualAddresses: result.lanVirtualAddresses } : {}
    };
  }, []);
  const openPanel = (0, import_react5.useCallback)(async () => {
    const seq = ++openSeq.current;
    setOpen(true);
    const next = await mint();
    if (seq !== openSeq.current) return;
    setState(next);
    if (next.kind !== "ready" && next.kind !== "lan-required") return;
    const source = new EventSource("/api/pair/events");
    eventSource.current = source;
    source.onmessage = (event) => {
      try {
        const frame = JSON.parse(event.data);
        if (frame.type !== "state") return;
        const previous = stateRef.current;
        if (previous.kind === "lan-required" && frame.tunnel?.state === "running" && previous.tunnel?.state !== "running") {
          void mint().then(setState);
          return;
        }
        setState((currentState) => mergeFrame(currentState, frame));
      } catch {
      }
    };
  }, [mint]);
  const closePanel = (0, import_react5.useCallback)(() => {
    openSeq.current += 1;
    closeEventSource();
    setOpen(false);
  }, [closeEventSource]);
  (0, import_react5.useEffect)(() => {
    if (!open || !canControlLanBind()) return;
    let cancelled = false;
    void readLanBindStatus().then((frame) => {
      if (!cancelled) setLanBindFrame(frame);
    }).catch(() => {
      if (!cancelled) setLanBindFrame(void 0);
    });
    return () => {
      cancelled = true;
    };
  }, [open, snapshot?.value?.lanBind]);
  const handleLanToggle = (0, import_react5.useCallback)((next) => {
    void scope?.set("lanBind", next).catch(() => {
    });
  }, [scope]);
  const handleCopyAddress = (0, import_react5.useCallback)((url) => {
    void copyText(url).then((ok) => {
      if (!ok) return;
      setCopiedAddress(true);
      window.setTimeout(() => {
        setCopiedAddress(false);
      }, 1500);
    });
  }, []);
  (0, import_react5.useEffect)(() => {
    if (state.kind !== "ready" || state.expired) return;
    const delay = state.expiresAt - Date.now();
    if (delay <= 0) {
      setState((previous) => previous.kind === "ready" ? { ...previous, expired: true } : previous);
      return;
    }
    const timer = window.setTimeout(() => {
      setState((previous) => previous.kind === "ready" ? { ...previous, expired: true } : previous);
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state]);
  (0, import_react5.useEffect)(() => closeEventSource, [closeEventSource]);
  (0, import_react5.useEffect)(() => installWorkspaceHeaderTrigger(triggerRef.current), []);
  (0, import_react5.useEffect)(() => {
    const bound = settingsScope();
    if (bound === void 0) return;
    setScope(bound);
    const sync = () => {
      setSnapshot(bound.getSnapshot());
    };
    sync();
    return bound.subscribe(sync);
  }, [open]);
  const handleStop = (0, import_react5.useCallback)(() => {
    void stopPair().catch(() => {
    });
    setState((previous) => previous.kind === "ready" ? { ...previous, phase: "stopped", devices: [] } : previous);
  }, []);
  const handleRevoke = (0, import_react5.useCallback)((deviceId) => {
    void revokePair(deviceId).catch(() => {
    });
    setState((previous) => previous.kind === "ready" ? { ...previous, devices: previous.devices.filter((device) => device.id !== deviceId) } : previous);
  }, []);
  const handleCopy = (0, import_react5.useCallback)((url) => {
    void copyText(url).then((ok) => {
      if (!ok) return;
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    });
  }, []);
  const handleCopyToken = (0, import_react5.useCallback)((token) => {
    void copyText(token).then((ok) => {
      if (!ok) return;
      setCopiedToken(true);
      window.setTimeout(() => {
        setCopiedToken(false);
      }, 1500);
    });
  }, []);
  const handleCopyViewer = (0, import_react5.useCallback)((url) => {
    void copyText(url).then((ok) => {
      if (!ok) return;
      setCopiedViewer(true);
      window.setTimeout(() => {
        setCopiedViewer(false);
      }, 1500);
    });
  }, []);
  const localT = (0, import_react5.useMemo)(() => (key, params) => {
    try {
      return t(key, params);
    } catch {
      return translate(zh, key, params);
    }
  }, [t]);
  return (0, import_react5.createElement)(
    "div",
    null,
    (0, import_react5.createElement)(
      "div",
      { className: "rl-trigger-host", ref: triggerRef, "data-dsh-remote-link-trigger": "" },
      (0, import_react5.createElement)("button", {
        type: "button",
        className: "rl-trigger",
        "aria-label": localT("entry.label"),
        "aria-expanded": open,
        title: localT("entry.label"),
        onClick: () => {
          void openPanel();
        }
      }, (0, import_react5.createElement)(LinkGlyph, { size: 16 }))
    ),
    open ? (0, import_react_dom.createPortal)((0, import_react5.createElement)(
      "div",
      { className: "rl-overlay" },
      (0, import_react5.createElement)("div", { className: "rl-mask", "aria-hidden": "true", onClick: closePanel }),
      (0, import_react5.createElement)(PairPanel, {
        t: localT,
        state,
        copied,
        copiedToken,
        copiedViewer,
        // The LAN-bind control and the tunnel form ride the panel body
        // (directly under the header, above the QR): the LAN switch is a
        // first-class control — without it the exposure can only be changed
        // by editing the profile patch by hand — and the tunnel form owns
        // the settings scope, which lives here.
        settings: (0, import_react5.createElement)(
          "div",
          null,
          (0, import_react5.createElement)(LanAccess, {
            t: localT,
            ...lanBindFrame !== void 0 ? { frame: lanBindFrame } : {},
            controllable: canControlLanBind(),
            setting: snapshot?.value?.lanBind,
            onToggle: handleLanToggle,
            onCopy: handleCopyAddress,
            copied: copiedAddress
          }),
          snapshot !== void 0 ? (0, import_react5.createElement)(SettingsForm, {
            t: localT,
            snapshot,
            save: (field, value) => {
              void scope?.set(field, value).catch(() => {
              });
            },
            clear: (field) => {
              void scope?.unset(field).catch(() => {
              });
            }
          }) : (0, import_react5.createElement)(
            "section",
            { className: "rl-settings" },
            (0, import_react5.createElement)("h3", { className: "rl-settingsTitle" }, localT("settings.title")),
            (0, import_react5.createElement)("p", { className: "rl-note" }, localT("settings.loading"))
          )
        ),
        onClose: closePanel,
        onStop: handleStop,
        onRefresh: () => {
          void mint().then(setState);
        },
        onCopy: handleCopy,
        onCopyToken: handleCopyToken,
        onCopyViewer: handleCopyViewer,
        onPickAddress: (address) => {
          void mint(address).then(setState);
        },
        onPickPublic: () => {
          void mint().then(setState);
        },
        onRevoke: handleRevoke
      })
    ), document.body) : null
  );
}
var HEADER_ACTIONS_ACTIVE_SELECTOR = '[class*="_headerActions"]:not([class*="_headerActionsHidden"])';
var HEADER_ACTIONS_CLASS = "rl-header-actions";
function installWorkspaceHeaderTrigger(host) {
  if (host === null || typeof document === "undefined") return () => {
  };
  let observer;
  let claimed = null;
  const place = () => {
    const target = document.querySelector(HEADER_ACTIONS_ACTIVE_SELECTOR);
    if (target === null) return;
    if (claimed !== null && claimed !== target) claimed.classList.remove(HEADER_ACTIONS_CLASS);
    if (target.firstElementChild !== host || !host.classList.contains("rl-in-header")) {
      target.insertBefore(host, target.firstChild);
      host.classList.add("rl-in-header");
    }
    if (!target.classList.contains(HEADER_ACTIONS_CLASS)) target.classList.add(HEADER_ACTIONS_CLASS);
    claimed = target;
  };
  place();
  observer = new MutationObserver(() => {
    place();
  });
  try {
    observer.observe(document.body, { childList: true, subtree: true });
  } catch {
    observer = void 0;
  }
  return () => {
    try {
      observer?.disconnect();
    } catch {
    }
    try {
      claimed?.classList.remove(HEADER_ACTIONS_CLASS);
    } catch {
    }
    claimed = null;
  };
}
function mergeFrame(state, frame) {
  if (state.kind === "lan-required") {
    return { ...state, ...frame.tunnel !== void 0 ? { tunnel: frame.tunnel } : {} };
  }
  if (state.kind !== "ready") return state;
  return {
    ...state,
    phase: frame.phase,
    deviceCount: frame.deviceCount,
    onlineCount: frame.onlineCount,
    devices: frame.devices ?? [],
    ...frame.tunnel !== void 0 ? { tunnel: frame.tunnel } : {}
  };
}
var settingsScope = () => void 0;
function runPairBootFlow() {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("pair");
  if (token === null || token === "") return;
  void (async () => {
    let ok = false;
    try {
      const response = await fetch("/api/pair/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token })
      });
      ok = response.ok;
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        sessionStorage.setItem(PAIR_FAILED_MARKER, "failed");
      } catch {
      }
    }
    url.searchParams.delete("pair");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    if (ok) window.location.reload();
  })();
}
function apply(ctx) {
  if (typeof document !== "undefined") ensureStyles(document);
  ctx.effect(() => {
    try {
      return ctx.locale.register(NS, { zh, en });
    } catch {
      return () => {
      };
    }
  }, "dsh-remote-link: dictionaries");
  const t = (() => {
    try {
      return ctx.locale.bind(NS);
    } catch {
      return ((key, params) => translate(zh, key, params));
    }
  })();
  let boundScope;
  settingsScope = () => {
    if (boundScope !== void 0) return boundScope;
    const binder = ctx.get("settingsScope") ?? ctx.get("webUiSettings");
    if (binder === void 0 || typeof binder.bind !== "function") return void 0;
    try {
      boundScope = binder.bind({ namespace: REMOTE_LINK_NS });
    } catch {
      boundScope = void 0;
    }
    return boundScope;
  };
  ctx.effect(() => {
    const connection = ctx.get("connection");
    const loopback = connection?.isLoopback ?? isLoopbackHostname(window.location.hostname);
    runPairBootFlow();
    if (loopback) return () => {
    };
    const timer = window.setInterval(() => {
      void fetch("/api/pair/heartbeat", { method: "POST" }).catch(() => {
      });
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, "dsh-remote-link: pair flow + heartbeats");
  let disposeChannel;
  let hostPairingPolicy;
  let unpairedWhilePolicyPending = false;
  let fenceNotice;
  const showFenceNotice = () => {
    if (fenceNotice !== void 0) return;
    const node = document.createElement("div");
    document.body.appendChild(node);
    const root = (0, import_client.createRoot)(node);
    root.render((0, import_react5.createElement)(FenceNotice, { t, onRetry: () => {
      window.location.reload();
    } }));
    fenceNotice = { unmount: () => {
      root.unmount();
      node.remove();
    } };
  };
  const hideFenceNotice = () => {
    fenceNotice?.unmount();
    fenceNotice = void 0;
  };
  const handleUnpaired = () => {
    if (hostPairingPolicy === void 0 && settingsStatus() !== "ready") {
      unpairedWhilePolicyPending = true;
      return;
    }
    showFenceNotice();
  };
  const settingsStatus = () => {
    const scope = ctx.get("settingsScope");
    return scope?.getSnapshot?.().status ?? "unavailable";
  };
  const settingsValue = () => {
    const scope = ctx.get("settingsScope");
    return scope?.getSnapshot?.().value;
  };
  const channelActive = () => remoteChannelRequired(
    window.location.hostname,
    { status: settingsStatus(), ...settingsValue() !== void 0 ? { value: settingsValue() } : {} },
    hostPairingPolicy
  );
  const bootSeat = () => window[REMOTE_CHANNEL_BOOT_GLOBAL];
  const syncChannel = () => {
    const transition = channelTransition(channelActive(), disposeChannel !== void 0);
    if (transition === "install") {
      const seat = bootSeat();
      if (seat !== void 0) {
        seat.onUnpaired = handleUnpaired;
        seat.onPaired = hideFenceNotice;
        if (seat.pendingUnpaired) {
          seat.pendingUnpaired = false;
          handleUnpaired();
        }
        disposeChannel = ctx.effect(() => () => {
          seat.onUnpaired = null;
          seat.onPaired = null;
        }, "dsh-remote-link: remote channel (boot patch)");
      } else {
        disposeChannel = ctx.effect(
          () => installRemoteChannel(window, { onUnpaired: handleUnpaired, onPaired: hideFenceNotice }),
          "dsh-remote-link: remote channel"
        );
      }
    } else if (transition === "retire" && disposeChannel !== void 0) {
      disposeChannel();
      disposeChannel = void 0;
      bootSeat()?.restore();
      hideFenceNotice();
    } else if (transition === "none" && !channelActive()) {
      bootSeat()?.restore();
    }
  };
  syncChannel();
  try {
    const scope = ctx.get("settingsScope");
    scope?.subscribe?.(syncChannel);
  } catch {
  }
  if (!isLoopbackHostname(window.location.hostname) && settingsStatus() !== "ready") {
    void fetch("/api/pair/status").then(async (response) => {
      const body = await response.json();
      return body;
    }).then((policy) => {
      hostPairingPolicy = policy.requirePairingForLan;
      syncChannel();
      if (hostPairingPolicy && unpairedWhilePolicyPending) showFenceNotice();
      unpairedWhilePolicyPending = false;
    }).catch(() => {
      hostPairingPolicy = true;
      syncChannel();
      if (unpairedWhilePolicyPending) showFenceNotice();
      unpairedWhilePolicyPending = false;
    });
  }
  ctx.slots.inject("sidebar.footer.action", () => {
    try {
      return ctx.slots.register({ name: "sidebar.footer.action", id: "remote-link", locale: NS }, RemoteLinkEntry);
    } catch {
      return () => {
      };
    }
  });
  ctx.effect(() => {
    const timer = window.setTimeout(() => {
      let marker = null;
      try {
        marker = sessionStorage.getItem(PAIR_FAILED_MARKER);
      } catch {
        marker = null;
      }
      if (marker === null) return;
      try {
        sessionStorage.removeItem(PAIR_FAILED_MARKER);
      } catch {
      }
      const node = document.createElement("div");
      document.body.appendChild(node);
      const root = (0, import_client.createRoot)(node);
      root.render((0, import_react5.createElement)(
        "div",
        { className: "rl-overlay" },
        (0, import_react5.createElement)("div", { className: "rl-mask" }),
        (0, import_react5.createElement)(
          "div",
          { className: "rl-panel", role: "alertdialog" },
          (0, import_react5.createElement)("h2", { className: "rl-title" }, t("pairFailed.title")),
          (0, import_react5.createElement)("p", { className: "rl-hint" }, t("pairFailed.body")),
          (0, import_react5.createElement)(
            "div",
            { className: "rl-actions" },
            (0, import_react5.createElement)("button", { type: "button", className: "rl-action", onClick: () => {
              root.unmount();
              node.remove();
            } }, t("pairFailed.close"))
          )
        )
      ));
    }, 1500);
    return () => {
      window.clearTimeout(timer);
    };
  }, "dsh-remote-link: failed-pair notice");
}
/**
 * @license QR Code generator library (TypeScript)
 * Copyright (c) Project Nayuki.
 * SPDX-License-Identifier: MIT
 */
/**
 * @license qrcode.react
 * Copyright (c) Paul O'Shannessy
 * SPDX-License-Identifier: ISC
 */
return module.exports;}});
//# sourceMappingURL=client.js.map
