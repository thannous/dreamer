import { Buffer } from 'node:buffer';
import { createHash, verify as verifySignature, X509Certificate } from 'node:crypto';

import { APPLE_APP_ATTEST_ROOT_PEM, APPLE_APP_RECEIPT_ROOT_G3_PEM } from './appleAppAttestRoot.ts';

// Apple: https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server
// The Expo native module hashes the UTF-8 challenge before passing it to DeviceCheck.
// Keep the server's clientDataHash identical to that implementation.

export type AppAttestEnvironment = 'development' | 'production';
export type VerifiedAppAttestation = {
  publicKeyPem: string;
  receiptBase64: string;
  environment: AppAttestEnvironment;
  appId: string;
};

type CborValue = number | string | Uint8Array | CborValue[] | Map<CborValue, CborValue> | boolean | null;
type Reader = { bytes: Uint8Array; offset: number };

const encoder = new TextEncoder();
const APP_ATTEST_NONCE_OID = Uint8Array.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x08, 0x02]);
const ECDSA_SHA256_OID = Uint8Array.from([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02]);
const ECDSA_SHA384_OID = Uint8Array.from([0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x03]);
const CMS_SIGNED_DATA_OID = Uint8Array.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02]);
const CMS_DATA_OID = Uint8Array.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x01]);
const SHA256_OID = Uint8Array.from([0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01]);
const APP_ATTEST_RECEIPT_SIGNING_OID = Uint8Array.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x0c, 0x0f]);

// Supabase Edge Runtime can parse an X509Certificate while leaving its `raw`
// getter unimplemented. Retain the exact DER input for all cryptographic checks.
const CERTIFICATE_DER = new WeakMap<X509Certificate, Uint8Array>();

function certificateFromDer(raw: Uint8Array): X509Certificate {
  const der = new Uint8Array(raw);
  const certificate = new X509Certificate(Buffer.from(der));
  CERTIFICATE_DER.set(certificate, der);
  return certificate;
}

function certificateFromPem(pem: string): X509Certificate {
  const base64 = pem.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) invalid();
  return certificateFromDer(new Uint8Array(Buffer.from(base64, 'base64')));
}

function certificateDer(certificate: X509Certificate): Uint8Array {
  const der = CERTIFICATE_DER.get(certificate);
  if (!der) invalid();
  return der;
}

const ROOT_CERTIFICATE = certificateFromPem(APPLE_APP_ATTEST_ROOT_PEM);
const RECEIPT_ROOT_CERTIFICATE = certificateFromPem(APPLE_APP_RECEIPT_ROOT_G3_PEM);

/**
 * Thrown for every proof that fails verification. Callers use the class to
 * tell a rejected proof apart from an unexpected runtime error when they log
 * a reject reason. The message is fixed and never carries request data.
 */
export class AppAttestProofError extends Error {
  constructor() {
    super('Invalid Apple App Attest proof');
    this.name = 'AppAttestProofError';
  }
}

function invalid(): never {
  throw new AppAttestProofError();
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

function sha256(data: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(data).digest());
}

function concat(...parts: Uint8Array[]): Uint8Array {
  return new Uint8Array(Buffer.concat(parts.map((part) => Buffer.from(part))));
}

function decodeBase64(value: string, limit: number): Uint8Array {
  if (value.length === 0 || value.length > limit || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) invalid();
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const decoded = new Uint8Array(Buffer.from(normalized, 'base64'));
  if (decoded.length === 0) invalid();
  return decoded;
}

function readCborLength(reader: Reader, additional: number): number {
  if (additional < 24) return additional;
  const size = additional === 24 ? 1 : additional === 25 ? 2 : additional === 26 ? 4 : additional === 27 ? 8 : 0;
  if (!size || reader.offset + size > reader.bytes.length) invalid();
  let value = 0;
  for (let i = 0; i < size; i += 1) value = value * 256 + reader.bytes[reader.offset++];
  if (!Number.isSafeInteger(value)) invalid();
  return value;
}

function readCbor(reader: Reader, depth = 0): CborValue {
  if (depth > 16 || reader.offset >= reader.bytes.length) invalid();
  const initial = reader.bytes[reader.offset++];
  const major = initial >> 5;
  const additional = initial & 31;
  if (major === 7 && additional >= 20 && additional <= 22) {
    return additional === 22 ? null : additional === 21;
  }
  const length = readCborLength(reader, additional);
  if (major === 0) return length;
  if (major === 1) return -1 - length;
  if (major === 2 || major === 3) {
    if (reader.offset + length > reader.bytes.length) invalid();
    const value = reader.bytes.slice(reader.offset, reader.offset + length);
    reader.offset += length;
    return major === 2 ? value : new TextDecoder('utf-8', { fatal: true }).decode(value);
  }
  if (major === 4) {
    if (length > 1000) invalid();
    return Array.from({ length }, () => readCbor(reader, depth + 1));
  }
  if (major === 5) {
    if (length > 1000) invalid();
    const map = new Map<CborValue, CborValue>();
    for (let i = 0; i < length; i += 1) {
      const key = readCbor(reader, depth + 1);
      if (map.has(key)) invalid();
      map.set(key, readCbor(reader, depth + 1));
    }
    return map;
  }
  invalid();
}

function decodeCbor(bytes: Uint8Array): CborValue {
  const reader = { bytes, offset: 0 };
  const value = readCbor(reader);
  if (reader.offset !== bytes.length) invalid();
  return value;
}

function asMap(value: CborValue | undefined): Map<CborValue, CborValue> {
  if (!(value instanceof Map)) invalid();
  return value;
}

function asBytes(value: CborValue | undefined): Uint8Array {
  if (!(value instanceof Uint8Array)) invalid();
  return value;
}

function asString(value: CborValue | undefined): string {
  if (typeof value !== 'string') invalid();
  return value;
}

type DerNode = { tag: number; start: number; valueStart: number; valueEnd: number; end: number };

function readDer(bytes: Uint8Array, offset: number): DerNode {
  const start = offset;
  if (offset + 2 > bytes.length) invalid();
  const tag = bytes[offset++];
  if ((tag & 31) === 31) invalid();
  let length = bytes[offset++];
  if (length & 0x80) {
    const size = length & 0x7f;
    if (size === 0 || size > 4 || offset + size > bytes.length) invalid();
    length = 0;
    for (let i = 0; i < size; i += 1) length = length * 256 + bytes[offset++];
  }
  if (offset + length > bytes.length) invalid();
  return { tag, start, valueStart: offset, valueEnd: offset + length, end: offset + length };
}

function derChildren(bytes: Uint8Array, parent: DerNode): DerNode[] {
  const result: DerNode[] = [];
  let offset = parent.valueStart;
  while (offset < parent.valueEnd) {
    const child = readDer(bytes, offset);
    if (child.end > parent.valueEnd) invalid();
    result.push(child);
    offset = child.end;
  }
  if (offset !== parent.valueEnd) invalid();
  return result;
}

function certificateNonceExtension(certificate: X509Certificate): Uint8Array {
  const bytes = certificateDer(certificate);
  const outer = readDer(bytes, 0);
  if (outer.tag !== 0x30 || outer.end !== bytes.length) invalid();
  const tbs = derChildren(bytes, outer)[0];
  if (tbs?.tag !== 0x30) invalid();
  const wrapper = derChildren(bytes, tbs).find((node) => node.tag === 0xa3);
  if (!wrapper) invalid();
  const extensions = derChildren(bytes, wrapper)[0];
  if (extensions?.tag !== 0x30) invalid();
  for (const extension of derChildren(bytes, extensions)) {
    if (extension.tag !== 0x30) invalid();
    const fields = derChildren(bytes, extension);
    if (fields[0]?.tag !== 0x06) invalid();
    const oid = bytes.slice(fields[0].valueStart, fields[0].valueEnd);
    if (!equalBytes(oid, APP_ATTEST_NONCE_OID)) continue;
    const value = fields.at(-1);
    if (value?.tag !== 0x04) invalid();
    const innerBytes = bytes.slice(value.valueStart, value.valueEnd);
    const sequence = readDer(innerBytes, 0);
    if (sequence.tag !== 0x30 || sequence.end !== innerBytes.length) invalid();
    const nonceFields = derChildren(innerBytes, sequence);
    if (nonceFields.length !== 1) invalid();
    const nonce = nonceFields[0].tag === 0xa1 ? derChildren(innerBytes, nonceFields[0]) : nonceFields;
    if (nonce.length !== 1 || nonce[0].tag !== 0x04 || nonce[0].valueEnd - nonce[0].valueStart !== 32) invalid();
    return innerBytes.slice(nonce[0].valueStart, nonce[0].valueEnd);
  }
  invalid();
}

function certificateHasExtension(certificate: X509Certificate, expectedOid: Uint8Array): boolean {
  const bytes = certificateDer(certificate);
  const outer = readDer(bytes, 0);
  const tbs = derChildren(bytes, outer)[0];
  if (tbs?.tag !== 0x30) invalid();
  const wrapper = derChildren(bytes, tbs).find((node) => node.tag === 0xa3);
  if (!wrapper) return false;
  const extensions = derChildren(bytes, wrapper)[0];
  if (extensions?.tag !== 0x30) invalid();
  return derChildren(bytes, extensions).some((extension) => {
    if (extension.tag !== 0x30) invalid();
    const oid = derChildren(bytes, extension)[0];
    return oid?.tag === 0x06 && equalBytes(bytes.slice(oid.valueStart, oid.valueEnd), expectedOid);
  });
}

function verifyCertificateSignature(certificate: X509Certificate, issuer: X509Certificate): boolean {
  // Deno 2.7's X509Certificate.verify returns false for Apple's valid EC chain.
  // Verify the certificate's signed TBSCertificate bytes with node:crypto instead.
  const bytes = certificateDer(certificate);
  const outer = readDer(bytes, 0);
  if (outer.tag !== 0x30 || outer.end !== bytes.length) invalid();
  const fields = derChildren(bytes, outer);
  if (fields.length !== 3 || fields[0].tag !== 0x30 || fields[1].tag !== 0x30 || fields[2].tag !== 0x03) invalid();
  const algorithm = derChildren(bytes, fields[1]);
  if (algorithm.length !== 1 || algorithm[0].tag !== 0x06) invalid();
  const oid = bytes.slice(algorithm[0].valueStart, algorithm[0].valueEnd);
  const digest = equalBytes(oid, ECDSA_SHA256_OID) ? 'sha256'
    : equalBytes(oid, ECDSA_SHA384_OID) ? 'sha384' : null;
  if (!digest || bytes[fields[2].valueStart] !== 0) invalid();
  return verifySignature(
    digest,
    Buffer.from(bytes.slice(fields[0].start, fields[0].end)),
    issuer.publicKey,
    Buffer.from(bytes.slice(fields[2].valueStart + 1, fields[2].valueEnd)),
  );
}

// Edge Runtime's node:crypto compatibility can omit the X509 validity getters.
// Read the signed TBSCertificate Validity sequence from its original DER.
// RFC 5280 requires seconds and Zulu time for both supported encodings.
function certificateTime(bytes: Uint8Array, node: DerNode): number {
  const length = node.valueEnd - node.valueStart;
  if ((node.tag !== 0x17 || length !== 13) && (node.tag !== 0x18 || length !== 15)) invalid();
  const value = String.fromCharCode(...bytes.slice(node.valueStart, node.valueEnd));
  if (!/^\d+Z$/.test(value)) invalid();
  const isUtcTime = node.tag === 0x17;
  const shortYear = Number(value.slice(0, 2));
  const year = isUtcTime ? (shortYear >= 50 ? 1900 + shortYear : 2000 + shortYear)
    : Number(value.slice(0, 4));
  const offset = isUtcTime ? 2 : 4;
  const month = Number(value.slice(offset, offset + 2));
  const day = Number(value.slice(offset + 2, offset + 4));
  const hour = Number(value.slice(offset + 4, offset + 6));
  const minute = Number(value.slice(offset + 6, offset + 8));
  const second = Number(value.slice(offset + 8, offset + 10));
  if (year < 1) invalid();
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  const time = date.getTime();
  if (!Number.isFinite(time) || date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ||
      date.getUTCHours() !== hour || date.getUTCMinutes() !== minute ||
      date.getUTCSeconds() !== second) invalid();
  return time;
}

export function certificateValidityWindow(raw: Uint8Array): { from: number; to: number } {
  const bytes = new Uint8Array(raw);
  const outer = readDer(bytes, 0);
  if (outer.tag !== 0x30 || outer.end !== bytes.length) invalid();
  const tbs = derChildren(bytes, outer)[0];
  if (tbs?.tag !== 0x30) invalid();
  const fields = derChildren(bytes, tbs);
  const validity = fields[fields[0]?.tag === 0xa0 ? 4 : 3];
  if (validity?.tag !== 0x30) invalid();
  const bounds = derChildren(bytes, validity);
  if (bounds.length !== 2) invalid();
  const from = certificateTime(bytes, bounds[0]);
  const to = certificateTime(bytes, bounds[1]);
  if (from >= to) invalid();
  return { from, to };
}

function validateChain(rawCertificates: CborValue, now: Date): X509Certificate {
  if (!Array.isArray(rawCertificates) || rawCertificates.length < 2 || rawCertificates.length > 4) invalid();
  const certificates = rawCertificates.map((raw) => certificateFromDer(asBytes(raw)));
  const chain = [...certificates, ROOT_CERTIFICATE];
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) invalid();
  for (let i = 0; i < chain.length; i += 1) {
    const certificate = chain[i];
    const validity = certificateValidityWindow(certificateDer(certificate));
    if (nowMs < validity.from || nowMs > validity.to) invalid();
    if (i > 0 && !certificate.ca) invalid();
    if (i < chain.length - 1) {
      const issuer = chain[i + 1];
      if (!certificateIssuedBy(certificate, issuer) || !verifyCertificateSignature(certificate, issuer)) invalid();
    }
  }
  if (!verifyCertificateSignature(ROOT_CERTIFICATE, ROOT_CERTIFICATE)) invalid();
  return certificates[0];
}

// App Attest receipts use CMS/PKCS#7 BER, including indefinite-length
// constructed OCTET STRINGs. Bound the parser to the receipt size and depth.
function readBer(bytes: Uint8Array, offset: number, depth = 0): DerNode {
  if (depth > 20 || offset + 2 > bytes.length) invalid();
  const start = offset;
  const tag = bytes[offset++];
  if ((tag & 31) === 31 || tag === 0) invalid();
  let length = bytes[offset++];
  if (length === 0x80) {
    if ((tag & 0x20) === 0) invalid();
    const valueStart = offset;
    while (offset + 1 < bytes.length && (bytes[offset] !== 0 || bytes[offset + 1] !== 0)) {
      offset = readBer(bytes, offset, depth + 1).end;
    }
    if (offset + 1 >= bytes.length) invalid();
    return { tag, start, valueStart, valueEnd: offset, end: offset + 2 };
  }
  if (length & 0x80) {
    const size = length & 0x7f;
    if (size === 0 || size > 4 || offset + size > bytes.length) invalid();
    length = 0;
    for (let i = 0; i < size; i += 1) length = length * 256 + bytes[offset++];
  }
  if (offset + length > bytes.length) invalid();
  return { tag, start, valueStart: offset, valueEnd: offset + length, end: offset + length };
}

function berChildren(bytes: Uint8Array, parent: DerNode): DerNode[] {
  const children: DerNode[] = [];
  let offset = parent.valueStart;
  while (offset < parent.valueEnd) {
    const child = readBer(bytes, offset);
    if (child.end > parent.valueEnd || children.length > 100) invalid();
    children.push(child);
    offset = child.end;
  }
  if (offset !== parent.valueEnd) invalid();
  return children;
}

function berValue(bytes: Uint8Array, node: DerNode): Uint8Array {
  return bytes.slice(node.valueStart, node.valueEnd);
}

function berOidEquals(bytes: Uint8Array, node: DerNode, expected: Uint8Array): boolean {
  return node.tag === 0x06 && equalBytes(berValue(bytes, node), expected);
}

function berOctets(bytes: Uint8Array, node: DerNode): Uint8Array {
  if (node.tag === 0x04) return berValue(bytes, node);
  if (node.tag !== 0x24 && node.tag !== 0xa0) invalid();
  const children = berChildren(bytes, node);
  if (children.length === 0 || children.length > 32) invalid();
  return concat(...children.map((child) => berOctets(bytes, child)));
}

function berInteger(bytes: Uint8Array, node: DerNode): number {
  if (node.tag !== 0x02 || node.valueEnd - node.valueStart < 1 ||
      node.valueEnd - node.valueStart > 4 || (bytes[node.valueStart] & 0x80) !== 0) invalid();
  let result = 0;
  for (let i = node.valueStart; i < node.valueEnd; i += 1) result = result * 256 + bytes[i];
  return result;
}

function certificateNameDer(certificate: X509Certificate, name: 'issuer' | 'subject'): Uint8Array {
  const bytes = certificateDer(certificate);
  const outer = readDer(bytes, 0);
  if (outer.tag !== 0x30 || outer.end !== bytes.length) invalid();
  const tbs = derChildren(bytes, outer)[0];
  if (!tbs || tbs.tag !== 0x30) invalid();
  const fields = derChildren(bytes, tbs);
  const versionOffset = fields[0]?.tag === 0xa0 ? 1 : 0;
  const field = fields[(name === 'issuer' ? 2 : 4) + versionOffset];
  if (field?.tag !== 0x30) invalid();
  return bytes.slice(field.start, field.end);
}

function certificateIssuerDer(certificate: X509Certificate): Uint8Array {
  return certificateNameDer(certificate, 'issuer');
}

function certificateIssuedBy(certificate: X509Certificate, issuer: X509Certificate): boolean {
  // Edge Runtime's checkIssued can be unimplemented. Exact DER name matching,
  // followed by the certificate signature check, preserves issuer binding.
  return equalBytes(certificateIssuerDer(certificate), certificateNameDer(issuer, 'subject'));
}

function validateReceiptChain(signing: X509Certificate, certificates: X509Certificate[], now: Date): void {
  const root = RECEIPT_ROOT_CERTIFICATE;
  const remaining = certificates.filter((cert) => cert !== signing &&
    !equalBytes(certificateDer(cert), certificateDer(root)));
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) invalid();
  let current = signing;
  for (let depth = 0; depth < 5; depth += 1) {
    const validity = certificateValidityWindow(certificateDer(current));
    if (nowMs < validity.from || nowMs > validity.to) invalid();
    if (equalBytes(certificateDer(current), certificateDer(root))) {
      if (remaining.length !== 0 || !verifyCertificateSignature(root, root)) invalid();
      return;
    }
    const index = remaining.findIndex((candidate) => certificateIssuedBy(current, candidate));
    const issuer = index >= 0 ? remaining.splice(index, 1)[0] : root;
    if (!certificateIssuedBy(current, issuer) || !verifyCertificateSignature(current, issuer) || !issuer.ca) invalid();
    current = issuer;
  }
  invalid();
}

function verifyAppleReceipt(input: {
  receipt: Uint8Array;
  credentialCertificate: X509Certificate;
  clientDataHash: Uint8Array;
  appId: string;
  environment: AppAttestEnvironment;
  now: Date;
}): void {
  const bytes = input.receipt;
  const outer = readBer(bytes, 0);
  if (outer.tag !== 0x30 || outer.end !== bytes.length) invalid();
  const contentInfo = berChildren(bytes, outer);
  if (contentInfo.length !== 2 || !berOidEquals(bytes, contentInfo[0], CMS_SIGNED_DATA_OID) ||
      contentInfo[1].tag !== 0xa0) invalid();
  const signedDataWrapper = berChildren(bytes, contentInfo[1]);
  if (signedDataWrapper.length !== 1 || signedDataWrapper[0].tag !== 0x30) invalid();
  const signedData = berChildren(bytes, signedDataWrapper[0]);
  if (signedData.length !== 5 || berInteger(bytes, signedData[0]) !== 1 ||
      signedData[1].tag !== 0x31 || signedData[2].tag !== 0x30 ||
      signedData[3].tag !== 0xa0 || signedData[4].tag !== 0x31) invalid();
  const digests = berChildren(bytes, signedData[1]);
  if (digests.length !== 1 || !berOidEquals(bytes, berChildren(bytes, digests[0])[0], SHA256_OID)) invalid();
  const contentFields = berChildren(bytes, signedData[2]);
  if (contentFields.length !== 2 || !berOidEquals(bytes, contentFields[0], CMS_DATA_OID)) invalid();
  const content = berOctets(bytes, contentFields[1]);
  const certificateNodes = berChildren(bytes, signedData[3]);
  if (certificateNodes.length < 2 || certificateNodes.length > 5 ||
      certificateNodes.some((node) => node.tag !== 0x30)) invalid();
  const certificates = certificateNodes.map((node) =>
    certificateFromDer(bytes.slice(node.start, node.end)));
  const signers = berChildren(bytes, signedData[4]);
  if (signers.length !== 1 || signers[0].tag !== 0x30) invalid();
  const signerFields = berChildren(bytes, signers[0]);
  // Apple's App Attest receipts currently sign the encapsulated data directly.
  // Reject unsupported signed-attribute CMS variants rather than skipping them.
  if (signerFields.length !== 5 || berInteger(bytes, signerFields[0]) !== 1 ||
      signerFields[1].tag !== 0x30 || signerFields[2].tag !== 0x30 ||
      signerFields[3].tag !== 0x30 || signerFields[4].tag !== 0x04) invalid();
  const signerId = berChildren(bytes, signerFields[1]);
  if (signerId.length !== 2 || signerId[0].tag !== 0x30 || signerId[1].tag !== 0x02 ||
      !berOidEquals(bytes, berChildren(bytes, signerFields[2])[0], SHA256_OID) ||
      !berOidEquals(bytes, berChildren(bytes, signerFields[3])[0], ECDSA_SHA256_OID)) invalid();
  const serial = Buffer.from(berValue(bytes, signerId[1])).toString('hex').replace(/^0+/, '') || '0';
  const signing = certificates.find((cert) => cert.serialNumber.toLowerCase().replace(/^0+/, '') === serial &&
    equalBytes(certificateIssuerDer(cert), bytes.slice(signerId[0].start, signerId[0].end)));
  if (!signing || signing.ca) invalid();
  if (signing.subject !== 'CN=Application Attestation Fraud Receipt Signing\nO=Apple Inc.\nC=US' ||
      !signing.keyUsage?.includes('DigitalSignature') ||
      !certificateHasExtension(signing, APP_ATTEST_RECEIPT_SIGNING_OID)) invalid();
  validateReceiptChain(signing, certificates, input.now);
  if (!verifySignature('sha256', Buffer.from(content), signing.publicKey,
    Buffer.from(berValue(bytes, signerFields[4])))) invalid();

  const payload = readBer(content, 0);
  if (payload.tag !== 0x31 || payload.end !== content.length) invalid();
  const attributes = new Map<number, Uint8Array>();
  for (const attribute of berChildren(content, payload)) {
    if (attribute.tag !== 0x30) invalid();
    const fields = berChildren(content, attribute);
    if (fields.length !== 3 || fields[2].tag !== 0x04) invalid();
    const id = berInteger(content, fields[0]);
    if (attributes.has(id)) invalid();
    attributes.set(id, berValue(content, fields[2]));
  }
  const asText = (id: number) => {
    const value = attributes.get(id);
    if (!value) invalid();
    return new TextDecoder('utf-8', { fatal: true }).decode(value);
  };
  if (asText(2) !== input.appId ||
      !equalBytes(attributes.get(3) ?? new Uint8Array(), certificateDer(input.credentialCertificate)) ||
      !equalBytes(attributes.get(4) ?? new Uint8Array(), input.clientDataHash) ||
      asText(6) !== 'ATTEST') invalid();
  const receiptEnvironment = asText(7);
  if (input.environment === 'production' ? receiptEnvironment !== 'production'
    : receiptEnvironment !== 'sandbox' && receiptEnvironment !== 'development') invalid();
  const creation = Date.parse(asText(12));
  const expiry = Date.parse(asText(21));
  if (!Number.isFinite(creation) || !Number.isFinite(expiry) ||
      creation > input.now.getTime() + 60_000 ||
      input.now.getTime() - creation > 5 * 60_000 || expiry <= input.now.getTime()) invalid();
}

function appIdHash(appId: string): Uint8Array {
  if (!/^[A-Z0-9]{10}\.[A-Za-z0-9.-]+$/.test(appId)) invalid();
  return sha256(encoder.encode(appId));
}

type AppExtensions = { validationCategory: number; bundleVersion: string } | null;

function parseAppExtensions(reader: Reader): AppExtensions {
  if (reader.offset === reader.bytes.length) return null;
  const extensions = asMap(readCbor(reader));
  if (reader.offset !== reader.bytes.length) invalid();
  const rawCategory = asBytes(extensions.get('apple_validation_category_01'));
  const bundleVersion = asString(extensions.get('apple_bundle_version_01'));
  if (rawCategory.length !== 4 || !/^[A-Za-z0-9._-]{1,32}$/.test(bundleVersion)) invalid();
  return {
    validationCategory: new DataView(rawCategory.buffer, rawCategory.byteOffset, 4).getUint32(0, true),
    bundleVersion,
  };
}

function validateAppExtensions(
  extensions: AppExtensions,
  environment: AppAttestEnvironment,
  allowedBundleVersions: string[],
  allowedCategories?: number[],
): void {
  // Older OS versions omit these fields. When Apple supplies them, enforce the
  // signing category and an explicitly supported CFBundleVersion.
  if (!extensions) return;
  const categories = allowedCategories ?? (environment === 'production' ? [2, 4] : [3, 5]);
  if (!categories.includes(extensions.validationCategory) ||
      !allowedBundleVersions.includes(extensions.bundleVersion)) invalid();
}

function parseAttestationAuthData(bytes: Uint8Array) {
  if (bytes.length < 88 || (bytes[32] & 0x40) === 0) invalid();
  const counter = new DataView(bytes.buffer, bytes.byteOffset + 33, 4).getUint32(0, false);
  const credentialLength = new DataView(bytes.buffer, bytes.byteOffset + 53, 2).getUint16(0, false);
  const credentialEnd = 55 + credentialLength;
  if (credentialLength !== 32 || credentialEnd >= bytes.length) invalid();
  const coseReader = { bytes, offset: credentialEnd };
  const coseKey = asMap(readCbor(coseReader));
  if (coseKey.get(1) !== 2 || coseKey.get(3) !== -7 || coseKey.get(-1) !== 1) invalid();
  const x = asBytes(coseKey.get(-2));
  const y = asBytes(coseKey.get(-3));
  if (x.length !== 32 || y.length !== 32) invalid();
  // Apple's published iOS fixture includes authenticated extensions without
  // setting the ED bit, so parse the trailing CBOR map whenever it is present.
  const extensions = parseAppExtensions(coseReader);
  if ((bytes[32] & 0x80) !== 0 && !extensions) invalid();
  return {
    rpIdHash: bytes.slice(0, 32),
    counter,
    aaguid: bytes.slice(37, 53),
    credentialId: bytes.slice(55, credentialEnd),
    publicKeyBytes: concat(Uint8Array.of(0x04), x, y),
    extensions,
  };
}

type AttestationInput = {
  keyId: string;
  challenge: string;
  attestationObject: string;
  expectedAppId: string;
  expectedEnvironment: AppAttestEnvironment;
  allowedBundleVersions: string[];
  allowedCategories?: number[];
  now?: Date;
};

export function verifyAppleAppAttestation(input: AttestationInput): VerifiedAppAttestation {
  return verifyAppleAppAttestationWithClientDataHash(input, sha256(encoder.encode(input.challenge)));
}

export function isValidAppAttestAaguid(
  value: Uint8Array,
  environment: AppAttestEnvironment,
): boolean {
  if (environment === 'production') {
    return equalBytes(value, concat(encoder.encode('appattest'), new Uint8Array(7)));
  }
  // Apple's current preparation and validation guides document different
  // development constants. Both are restricted to a sandbox receipt.
  return equalBytes(value, encoder.encode('appattestdevelop'))
    || equalBytes(value, encoder.encode('appattestsandbox'));
}

/** For Apple's published validation vector, which passes raw challenge bytes to DeviceCheck. */
export function verifyAppleAppAttestationWithClientDataHash(
  input: AttestationInput,
  clientDataHash: Uint8Array,
): VerifiedAppAttestation {
  const keyIdBytes = decodeBase64(input.keyId, 256);
  if (keyIdBytes.length !== 32 || input.challenge.length < 20 || input.challenge.length > 256 ||
      clientDataHash.length === 0 || clientDataHash.length > 256 ||
      Buffer.from(keyIdBytes).toString('base64') !== input.keyId) invalid();
  const object = asMap(decodeCbor(decodeBase64(input.attestationObject, 40_000)));
  if (asString(object.get('fmt')) !== 'apple-appattest') invalid();
  const statement = asMap(object.get('attStmt'));
  const authData = asBytes(object.get('authData'));
  const receipt = asBytes(statement.get('receipt'));
  if (receipt.length < 16 || receipt.length > 20_000) invalid();
  const now = input.now ?? new Date();
  const certificate = validateChain(statement.get('x5c') as CborValue, now);
  const authenticator = parseAttestationAuthData(authData);
  if (!equalBytes(authenticator.rpIdHash, appIdHash(input.expectedAppId))) invalid();
  if (authenticator.counter !== 0 || !equalBytes(authenticator.credentialId, keyIdBytes)) invalid();
  if (!isValidAppAttestAaguid(authenticator.aaguid, input.expectedEnvironment)) invalid();
  validateAppExtensions(authenticator.extensions, input.expectedEnvironment,
    input.allowedBundleVersions, input.allowedCategories);

  const publicKey = certificate.publicKey;
  if (publicKey.asymmetricKeyType !== 'ec') invalid();
  const jwk = publicKey.export({ format: 'jwk' });
  // Edge Runtime may omit or alias asymmetricKeyDetails.namedCurve. The
  // exported JWK identifies the same key's curve without weakening the check.
  if (typeof jwk !== 'object' || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y) invalid();
  const x = decodeBase64(jwk.x, 100);
  const y = decodeBase64(jwk.y, 100);
  const publicKeyBytes = concat(Uint8Array.of(0x04), x, y);
  if (!equalBytes(publicKeyBytes, authenticator.publicKeyBytes)) invalid();
  if (!equalBytes(sha256(publicKeyBytes), keyIdBytes)) invalid();

  const nonce = sha256(concat(authData, clientDataHash));
  if (!equalBytes(certificateNonceExtension(certificate), nonce)) invalid();
  verifyAppleReceipt({
    receipt,
    credentialCertificate: certificate,
    clientDataHash,
    appId: input.expectedAppId,
    environment: input.expectedEnvironment,
    now,
  });

  return {
    publicKeyPem: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    receiptBase64: Buffer.from(receipt).toString('base64'),
    environment: input.expectedEnvironment,
    appId: input.expectedAppId,
  };
}

export function verifyAppleAppAssertion(input: {
  assertionObject: string;
  challenge: string;
  publicKeyPem: string;
  expectedAppId: string;
  expectedEnvironment: AppAttestEnvironment;
  allowedBundleVersions: string[];
  previousCounter: number;
}): number {
  if (input.challenge.length < 20 || input.challenge.length > 256) invalid();
  const object = asMap(decodeCbor(decodeBase64(input.assertionObject, 10_000)));
  const authData = asBytes(object.get('authenticatorData'));
  const signature = asBytes(object.get('signature'));
  if (authData.length < 37 || signature.length < 64 || signature.length > 80) invalid();
  if (!equalBytes(authData.slice(0, 32), appIdHash(input.expectedAppId))) invalid();
  const extensions = parseAppExtensions({ bytes: authData, offset: 37 });
  if ((authData[32] & 0x80) !== 0 && !extensions) invalid();
  validateAppExtensions(extensions, input.expectedEnvironment, input.allowedBundleVersions);
  const counter = new DataView(authData.buffer, authData.byteOffset + 33, 4).getUint32(0, false);
  if (counter <= input.previousCounter || counter === 0) invalid();
  const data = concat(authData, sha256(encoder.encode(input.challenge)));
  // App Attest signs the nonce as the ECDSA-SHA256 message, not the
  // authenticator data concatenation itself.
  const nonce = sha256(data);
  if (!verifySignature('sha256', Buffer.from(nonce), input.publicKeyPem, Buffer.from(signature))) invalid();
  return counter;
}
