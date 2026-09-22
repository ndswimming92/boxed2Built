// Builds and signs an Apple Wallet pass (.pkpass).
//
// A .pkpass is a flat zip of pass.json, the artwork, a manifest.json of SHA-1
// digests, and a detached PKCS#7 signature over that manifest. Apple accepts or
// silently refuses the whole file — there is no partial success and no error
// message on the device — so every step here is deliberate.
//
// Deliberately NOT using passkit-generator: its Deno compatibility is unverified
// and both pieces it provides already exist in this project's toolchain. fflate
// already builds 3MF zips in src/lib/threemf/write.ts, and node-forge is the
// same PKCS#7 implementation passkit-generator itself wraps.
import { zipSync } from 'npm:fflate@0.8.3';
import forge from 'npm:node-forge@1.3.1';

export interface PassCertificates {
  /** Pass Type ID certificate, PEM. */
  signerCertPem: string;
  /** Its private key, PEM. Encrypted keys need signerKeyPassphrase. */
  signerKeyPem: string;
  signerKeyPassphrase?: string;
  /** Apple WWDR intermediate, PEM. Without it iOS rejects the chain. */
  wwdrCertPem: string;
}

/** Files that go in the zip, keyed by their name inside it. */
export type PassFiles = Record<string, Uint8Array>;

const MANIFEST = 'manifest.json';
const SIGNATURE = 'signature';

function toUint8Array(binaryString: string): Uint8Array {
  const out = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) out[i] = binaryString.charCodeAt(i) & 0xff;
  return out;
}

function toBinaryString(bytes: Uint8Array): string {
  let out = '';
  // Chunked: String.fromCharCode(...bytes) blows the argument limit on artwork.
  for (let i = 0; i < bytes.length; i += 0x8000) {
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return out;
}

/**
 * manifest.json maps every file in the pass to the SHA-1 of its bytes.
 *
 * SHA-1 is not a choice — Apple's format specifies it, and a stronger digest
 * here produces a pass the device refuses.
 */
export function buildManifest(files: PassFiles): string {
  const manifest: Record<string, string> = {};
  for (const [name, bytes] of Object.entries(files)) {
    if (name === MANIFEST || name === SIGNATURE) continue;
    const md = forge.md.sha1.create();
    md.update(toBinaryString(bytes));
    manifest[name] = md.digest().toHex();
  }
  // Stable key order keeps the output byte-identical between runs, which is
  // what makes the signature reproducible and the tests meaningful.
  return JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))));
}

/** Detached PKCS#7 signature over the manifest, DER-encoded. */
export function signManifest(manifestJson: string, certs: PassCertificates): Uint8Array {
  const signerCert = forge.pki.certificateFromPem(certs.signerCertPem);
  const wwdrCert = forge.pki.certificateFromPem(certs.wwdrCertPem);
  const privateKey = certs.signerKeyPassphrase
    ? forge.pki.decryptRsaPrivateKey(certs.signerKeyPem, certs.signerKeyPassphrase)
    : forge.pki.privateKeyFromPem(certs.signerKeyPem);

  if (!privateKey) {
    throw new Error('Could not read the pass signing key — wrong passphrase, or not an RSA key.');
  }

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifestJson, 'utf8');
  p7.addCertificate(signerCert);
  // The WWDR intermediate rides along so the device can build the chain to
  // Apple's root without fetching anything.
  p7.addCertificate(wwdrCert);
  p7.addSigner({
    key: privateKey,
    certificate: signerCert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      // Left valueless on purpose: forge computes the digest at sign time.
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });

  // Detached: the manifest travels as its own file in the zip, not inside the
  // signature. A non-detached signature produces a pass iOS will not open.
  p7.sign({ detached: true });

  return toUint8Array(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

/**
 * Assembles the signed .pkpass.
 *
 * `files` must already contain pass.json and the artwork; manifest.json and
 * signature are produced here and must not be passed in.
 */
export function buildPkpass(files: PassFiles, certs: PassCertificates): Uint8Array {
  if (!files['pass.json']) {
    throw new Error('A pass needs pass.json.');
  }
  // icon.png is what Wallet shows in notifications and the pass list. Without
  // it the pass is rejected, which is easy to miss because nothing says so.
  if (!files['icon.png']) {
    throw new Error('A pass needs icon.png.');
  }

  const manifestJson = buildManifest(files);
  const manifestBytes = new TextEncoder().encode(manifestJson);

  return zipSync(
    {
      ...files,
      [MANIFEST]: manifestBytes,
      [SIGNATURE]: signManifest(manifestJson, certs),
    },
    // Flat archive, no directory entries — Wallet expects the files at the root.
    { level: 9 },
  );
}

/**
 * Reads the certificate set from edge function secrets.
 *
 * Throws with the missing names rather than failing later inside forge with
 * something unreadable.
 */
export function certificatesFromEnv(): PassCertificates {
  const signerCertPem = Deno.env.get('APPLE_PASS_CERT_PEM') ?? '';
  const signerKeyPem = Deno.env.get('APPLE_PASS_KEY_PEM') ?? '';
  const wwdrCertPem = Deno.env.get('APPLE_WWDR_PEM') ?? '';

  const missing = [
    ['APPLE_PASS_CERT_PEM', signerCertPem],
    ['APPLE_PASS_KEY_PEM', signerKeyPem],
    ['APPLE_WWDR_PEM', wwdrCertPem],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Apple Wallet is not configured: missing ${missing.join(', ')}.`);
  }

  return {
    signerCertPem,
    signerKeyPem,
    signerKeyPassphrase: Deno.env.get('APPLE_PASS_KEY_PASSPHRASE') || undefined,
    wwdrCertPem,
  };
}
