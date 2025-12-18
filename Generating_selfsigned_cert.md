
# UConnect

## HTTPS Setup with Self-Signed SSL Certificate

To run the server with HTTPS locally, you need SSL certificate and private key files.

### Generating Self-Signed Certificates

A helper script is provided to generate self-signed SSL certificate and key files for development purposes:

```bash
node scripts/generate-self-signed-cert.js
```

This script will create a `certs` directory at the root of the project and generate:

- `certs/server.crt` (certificate)
- `certs/server.key` (private key)

### Usage

1. Run the script to generate the cert/key files.
2. Start the server normally (e.g., `node app.js`).
3. Access the app via `https://localhost:<PORT>`.

### Notes

  - `SSL_CERT_PATH`
  - `SSL_KEY_PATH`


# UConnect — Local HTTPS & Certificate Guide

This document explains how to generate and use certificates for running UConnect locally without browser warnings. It covers the recommended workflow using `mkcert` (easiest for local development), an OpenSSL fallback (self-signed), trusting certificates in macOS/Windows/Linux, and production considerations.

---

## Why TLS for local development?
- Many browser features require HTTPS (secure cookies, service workers, geolocation, etc.). Using HTTPS locally ensures behaviors match production.
- A trusted local certificate avoids browser warnings and allows secure-only features to work during development and testing.

---

## Recommended workflow: mkcert (local trusted CA)
`mkcert` is an easy way to create a local CA and issue browser-trusted certificates for development hosts such as `localhost` or `127.0.0.1`.

Advantages:
- Automatically adds a local CA to your OS trust store.
- Generates certificates with correct SANs for hostname/IP.
- Minimizes manual steps and trust issues during development.

### Install and generate (macOS example)
```bash
brew install mkcert
brew install nss # optional, if you use Firefox
mkcert -install
mkcert -cert-file certs/server.crt -key-file certs/server.key localhost 127.0.0.1 ::1
```

Now `certs/server.crt` and `certs/server.key` are trusted by your browsers.

### Use in development
1. Start the server (auto-generation is available in development):
   ```bash
   npm run dev # or node app.js
   ```
2. Visit https://localhost:4000 — the browser should trust the certificate.

---

## OpenSSL fallback (if mkcert not available)
The repository includes `scripts/generate-self-signed-cert.js` which prefers mkcert but falls back to OpenSSL and includes SAN for `localhost` and `127.0.0.1`:

OpenSSL command example:
```bash
openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout certs/server.key -out certs/server.crt \
  -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1"
```

Because this is a self-signed certificate (signed by the local key), the browser will NOT trust it by default. You can either:
- Import the cert into your OS or browser trust store (instructions below), or
- Use mkcert instead, which makes trust automatic.

---

## macOS — Trust a self-signed cert manually
GUI method:
1. Open **Keychain Access** (Applications → Utilities → Keychain Access).
2. File → Import Items → choose `certs/server.crt`.
3. Find the imported cert in Keychain Access, double click, expand **Trust**, and set **When using this certificate** to **Always Trust**.
4. Restart your browser.

CLI method (requires admin privileges):
```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/server.crt
```

---

## Windows — Add to Trusted Root Certification Authorities
1. Open **mmc.exe**.
2. File → Add/Remove Snap-in... → Certificates → Add → select **Computer account** → Next → Local computer.
3. Expand **Certificates** → **Trusted Root Certification Authorities** → right-click **Certificates** → Import.
4. Browse to `certs\server.crt` and import.
5. Restart your browser.

Alternatively, use `certutil`:
```powershell
certutil -addstore -f "ROOT" "certs\server.crt"
```

---

## Linux — Add to OS trust store
Debian/Ubuntu example:
```bash
sudo cp certs/server.crt /usr/local/share/ca-certificates/uconnect_local.crt
sudo update-ca-certificates
# You may need to restart your browser and/or log out and in
```

RedHat/CentOS example uses `update-ca-trust`:
```bash
sudo cp certs/server.crt /etc/pki/ca-trust/source/anchors/uconnect_local.crt
sudo update-ca-trust extract
```

---

## Using the generator script in this repo
Script: `scripts/generate-self-signed-cert.js`

Flags / options supported by the generator:
- `--force` / `-f`: Overwrite existing certificate and key files
- `--mkcert`: Force usage of mkcert; fail if mkcert is not present
- `--install-mkcert`: Attempt to install mkcert via Homebrew (macOS)
- `--days=<n>`: Specify validity period in days (default 365)
- `--help` / `-h`: Show usage

Examples:
```bash
node scripts/generate-self-signed-cert.js               # mkcert preferred, fallback to openssl
node scripts/generate-self-signed-cert.js --force      # overwrite existing certs
node scripts/generate-self-signed-cert.js --mkcert     # require mkcert
node scripts/generate-self-signed-cert.js --days=730   # longer validity
```

NPM script shortcuts (defined in `package.json`):
```bash
npm run cert:generate            # generator default
npm run cert:generate:force      # generator with --force
npm run cert:mkcert              # mkcert -install && mkcert ...
npm run cert:mkcert:generate     # prefer mkcert, else fallback
npm run cert:mkcert:force        # force mkcert generation (overwrite)
```

---

## Production considerations — use a real CA (Let’s Encrypt)
Do not use self-signed or mkcert certs in production. For public domains, use a CA-signed certificate (Let’s Encrypt for free automation). Update environment variables for production:
- `SSL_CERT_PATH` — path to fullchain.pem or your certificate
- `SSL_KEY_PATH` — path to private key

Example for production with Let's Encrypt:
```bash
export SSL_CERT_PATH=/etc/letsencrypt/live/example.com/fullchain.pem
export SSL_KEY_PATH=/etc/letsencrypt/live/example.com/privkey.pem
NODE_ENV=production node app.js
```

---

## Automation tips
- Use a prestart hook in `package.json` for dev that checks whether `certs/` exists and generates certs if missing (don’t enable this in production):
  ```json
  "scripts": {
    "prestart": "[ -d certs ] || npm run cert:generate",
    "start": "node app.js"
  }
  ```
- Leverage CI or dev containers to ensure correct certs are created for local testing.

---

## Security & Best Practices
- Add `certs/` to `.gitignore` (this prevents committing private keys). This project already includes `certs/` in `.gitignore`.
- Never commit private keys or certificates to remote repos.
- Use a trusted authority for production environments (Let's Encrypt, commercial CA).
- Rotate keys and certificates periodically and automate renewals for production.

---

## Troubleshooting
- Browser still shows warnings: You probably used OpenSSL fallback and didn’t import the cert into your OS trust store. Either use mkcert or import your cert.
- SAN mismatch errors: Check the SAN entries in the generated cert. Re-generate with appropriate SANs (e.g., IP:127.0.0.1, DNS:localhost).
- mkcert fails to install: Ensure Homebrew is installed (macOS) or follow mkcert installation docs for your OS: https://github.com/FiloSottile/mkcert.
- Server errors reading certs: Verify the `SSL_CERT_PATH` and `SSL_KEY_PATH` environment variables or default `certs/server.crt` and `certs/server.key` exist and are readable by your user.

---

## FAQ
- Q: Do I have to use mkcert? A: No. mkcert is recommended for local dev but OpenSSL fallback works. The tradeoff is browser trust.
- Q: Why are certs ignored in the repo? A: Because they contain private keys and should not be versioned. Re-generate them locally per dev machine.
- Q: How to test that the cert is valid? A: Use OpenSSL and curl:
  ```bash
  openssl x509 -in certs/server.crt -noout -text | grep -E "Subject:|Issuer:|X509v3 Subject Alternative Name" -A3
  curl -v https://localhost:4000 --insecure   # bypass trust to check the server response
  curl -v https://localhost:4000 --cacert certs/server.crt  # validate against cert
  ```

---

If you’d like, I can add more examples: custom LAN hostnames (like `myapp.local`), Docker or containerized dev instructions, or Windows/macOS specifics for cert import automation. Tell me which you'd like and I’ll add it.

```


