// sealedbox.js
// Implements libsodium's crypto_box_seal for use in Chrome extension service workers.
// Requires: nacl (tweetnacl) and blake2bInit/blake2bUpdate/blake2bFinal (blakejs)
// to be loaded before this script.
//
// crypto_box_seal(message, recipientPublicKey):
//   1. Generate ephemeral X25519 keypair
//   2. nonce = BLAKE2b(ephemeralPK || recipientPK, outputLen=24)
//   3. ciphertext = nacl.box(message, nonce, recipientPK, ephemeralSK)
//   4. return ephemeralPK || ciphertext

function sealedBoxSeal(message, recipientPublicKey) {
  // Generate ephemeral keypair
  const ephemeral = nacl.box.keyPair();

  // Derive nonce: BLAKE2b(ephemeralPK || recipientPK), output 24 bytes
  const ctx = blake2bInit(24);
  blake2bUpdate(ctx, ephemeral.publicKey);
  blake2bUpdate(ctx, recipientPublicKey);
  const nonce = blake2bFinal(ctx);

  // Encrypt using NaCl box (X25519-XSalsa20-Poly1305)
  const ciphertext = nacl.box(message, nonce, recipientPublicKey, ephemeral.secretKey);

  // Output: ephemeralPK (32 bytes) || ciphertext
  const result = new Uint8Array(ephemeral.publicKey.length + ciphertext.length);
  result.set(ephemeral.publicKey, 0);
  result.set(ciphertext, ephemeral.publicKey.length);
  return result;
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
