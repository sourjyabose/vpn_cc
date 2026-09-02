/**
 * Pure JavaScript SHA-256 Implementation
 * Self-contained cryptographic hashing utility that works reliably in HTTP (insecure) contexts
 * without any dependency on window.crypto.subtle or HTTPS.
 * 
 * Generates identical hex output to Python's hashlib.sha256(data.encode('utf-8')).hexdigest()
 */

(function (global) {
    'use strict';

    /**
     * Converts a string to UTF-8 byte array.
     * @param {string} str 
     * @returns {Uint8Array}
     */
    function utf8Encode(str) {
        if (typeof TextEncoder !== 'undefined') {
            return new TextEncoder().encode(str);
        }
        const utf8 = [];
        for (let i = 0; i < str.length; i++) {
            let charcode = str.charCodeAt(i);
            if (charcode < 0x80) utf8.push(charcode);
            else if (charcode < 0x800) {
                utf8.push(0xc0 | (charcode >> 6),
                          0x80 | (charcode & 0x3f));
            }
            else if (charcode < 0xd800 || charcode >= 0xe000) {
                utf8.push(0xe0 | (charcode >> 12),
                          0x80 | ((charcode >> 6) & 0x3f),
                          0x80 | (charcode & 0x3f));
            }
            else {
                // surrogate pair
                i++;
                charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                utf8.push(0xf0 | (charcode >> 18),
                          0x80 | ((charcode >> 12) & 0x3f),
                          0x80 | ((charcode >> 6) & 0x3f),
                          0x80 | (charcode & 0x3f));
            }
        }
        return new Uint8Array(utf8);
    }

    /**
     * Performs standard SHA-256 calculation on input bytes.
     * @param {Uint8Array} bytes 
     * @returns {string} Hexadecimal digest string
     */
    function rawSha256(bytes) {
        const K = [
            0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
            0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
            0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
            0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
            0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
            0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
            0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
            0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
        ];

        let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
        let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

        const byteLen = bytes.length;
        const bitLen = byteLen * 8;

        // Pre-processing: padding
        const newLen = (((byteLen + 8) >> 6) + 1) << 6;
        const padded = new Uint8Array(newLen);
        padded.set(bytes);
        padded[byteLen] = 0x80;

        // Append 64-bit big-endian length
        const view = new DataView(padded.buffer);
        view.setUint32(newLen - 8, Math.floor(bitLen / 0x100000000), false);
        view.setUint32(newLen - 4, bitLen >>> 0, false);

        const W = new Uint32Array(64);

        for (let chunk = 0; chunk < newLen; chunk += 64) {
            for (let t = 0; t < 16; t++) {
                W[t] = view.getUint32(chunk + (t * 4), false);
            }
            for (let t = 16; t < 64; t++) {
                const s0 = (rightRotate(W[t - 15], 7) ^ rightRotate(W[t - 15], 18) ^ (W[t - 15] >>> 3)) >>> 0;
                const s1 = (rightRotate(W[t - 2], 17) ^ rightRotate(W[t - 2], 19) ^ (W[t - 2] >>> 10)) >>> 0;
                W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
            }

            let a = H0, b = H1, c = H2, d = H3, e = H4, f = H5, g = H6, h = H7;

            for (let t = 0; t < 64; t++) {
                const S1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) >>> 0;
                const ch = ((e & f) ^ ((~e) & g)) >>> 0;
                const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
                const S0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) >>> 0;
                const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
                const temp2 = (S0 + maj) >>> 0;

                h = g;
                g = f;
                f = e;
                e = (d + temp1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) >>> 0;
            }

            H0 = (H0 + a) >>> 0;
            H1 = (H1 + b) >>> 0;
            H2 = (H2 + c) >>> 0;
            H3 = (H3 + d) >>> 0;
            H4 = (H4 + e) >>> 0;
            H5 = (H5 + f) >>> 0;
            H6 = (H6 + g) >>> 0;
            H7 = (H7 + h) >>> 0;
        }

        return [H0, H1, H2, H3, H4, H5, H6, H7].map(function (val) {
            let hex = val.toString(16);
            while (hex.length < 8) hex = '0' + hex;
            return hex;
        }).join('');
    }

    function rightRotate(val, amount) {
        return ((val >>> amount) | (val << (32 - amount))) >>> 0;
    }

    /**
     * Primary SHA-256 function exposed globally
     * @param {string|Uint8Array} input 
     * @returns {string} Hexadecimal hash string
     */
    function sha256(input) {
        let bytes;
        if (typeof input === 'string') {
            bytes = utf8Encode(input);
        } else if (input instanceof Uint8Array) {
            bytes = input;
        } else {
            bytes = utf8Encode(String(input));
        }
        return rawSha256(bytes);
    }

    // Export to global scope / CommonJS exports
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = sha256;
    } else {
        global.sha256 = sha256;
    }
})(typeof window !== 'undefined' ? window : globalThis);
