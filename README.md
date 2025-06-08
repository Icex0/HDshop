# HDshop

## Includes the following vulnerabilities:

- ❌ **No HTTPS**
- 🔍 **Username Enumeration** in login and registration functions
- 💥 **Error-Based SQL Injection**  
  - Affects: `login` > `username` field
- 🍪 **Session Cookie Missing Flags**
  - Missing `HttpOnly` and `Secure` and `SameSite` attributes
- 📛 **Missing all Security Headers**
- 🐛 **Stored XSS**
  - Vector: `username` via create user or update user settings
- 🔓 **Broken Access Control**
  - Any user can access:
    - `/api/user/<ID>`
    - `/api/users`
    - `/api/user/<ID>/orders`
- 🔐 **Sensitive Data Exposure**
  - Passwords and API keys present in `config.json`
- 🧮 **Logic Bugs**
  - No server-side validation on product pricing
- ❌ Verbose errors in production
- 🔓 Change user settings without requiring current password
- 🔓 Passwords stored in plaintext
- 🔓 Default credentials > Postgres and webapp
- 🔓 Weak (client side only) upload restrictions > SVG upload with SXSS etc. 
- 🔓 Simple Identifiers (no UUIDv4)

---

## TODO:

- 📁 **No Upload Restrictions**
  - SVG XSS possible
- 🛂 **Access Control Bypass**
  - Create invite link and escalate `role`
- ⚠️ **Reflected XSS in some parameter**
- 🔒 **Weak TLS Support**
  - TLS 1.0/1.1 still enabled
- 📚 **Outdated Swagger UI**
  - Reflected XSS
  - API endpoint for profile image retrieval > **LFI**
- 🤔 **Add CSTI or XXE?**
---
