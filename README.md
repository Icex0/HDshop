# HDshop

## Tech ##
- HDshop app exposed at port `0.0.0.0:3000`
  - Express.js (node.js) backend
  - AngularJS frontend
  - PostgreSQL at `172.20.0.30:5432`
  - Swagger UI accessible at `/api-doc`s (does not include the file upload API endpoints `GET and POST /api/user/<ID>/image` and `POST /api/user/<ID>/image/fetch-url`)
  - access.log can be found in docker volume `hdapp_app_logs` (or use the log monitor app)
- Log monitor application at port `172.20.0.20:80`. Used for SSRF and logging of activity in HDshop
  - Includes 2 API endpoints:
    - /api/logs
    - /api/health
- Docker-compose included to easily start and stop everything

## Includes the following vulnerabilities:

- 🚫 **No HTTPS**
- 🔎 **Username Enumeration** in login and registration functions
- 💣 **Error-Based SQL Injection**  
  - Affects: `login` > `username` field
- 🍪 **Session Cookie Missing Flags**
  - Missing `HttpOnly` and `Secure` and `SameSite` attributes
- 🛡️ **Missing all Security Headers**
  - No Content Security Policy
  - No HTTP Strict Transport Security (HSTS)
  - No Referrer header
  - No Permission Policy
  - No X-Frame-Options
  - No X-Content-Type-Options
  - X-Powered-By header discloses tech
- 🦠 **XSS - Stored Cross-Site Scripting**
  - Vector: `username` via create user or update user settings
  - Reflects twice on shop page and once in the admin panel
- 🦠 **XSS - Reflected Cross-Site Scripting**
   - Any mistyped path/file leads to `error.html` which reflects a user controlled `ErrorMessage` parameter > `/error.html?ErrorMessage=<img src=x>&ErrorCode=404`
- 🧱 **Broken Access Control**
  - Any user can:
    - `GET /api/user/<ID>` > Retrieve data from other users (IDOR)
    - `GET /api/users` > Get data from all users
    - `GET /api/user/<ID>/orders` > Get orders from other users (IDOR)
    - `POST /api/user/<ID>/image` > Add profile images to other users (containing XSS)
  - When updating a user profile, a POST request is made to `/api/profile/update` which contains a `role` parameter (not shown on the client-side).
    - `"role":"user"` can be changed to `"role":"admin"` which leads to vertical privilege escalation > this gives access to the admin panel
- 🔐 **Sensitive Data Exposure**
  - Passwords and API keys present in `config.json`
- 🧠 **Logic Bugs**
  - No server-side validation on product pricing and total price
- 🧯 **Verbose errors in production**
- 🛠️ **Change user settings without requiring current password**
- 📂 **Passwords stored in plaintext**
- 🧾 **Default credentials > Postgres and webapp**
- 📤 **Weak (client-side only) upload restrictions > SVG upload with XSS etc.**
- 🆔 **Simple Identifiers (no UUIDv4)**
- 🛡️ **Vulnerable CORS configuration on all (API) endpoints**
  - Access-Control-Allow-Crendentials (ACAC) on true > Access-Control-Allow-Credentials: true
  - Origin (Origin: attacker.com) dynamically set by user request > Access-Control-Allow-Origin: attacker.com
- ⚠️ **Outdated Swagger-UI (3.25.0) leads to XSS**
  - Example: http://localhost:3000/api-docs/?configUrl=https://xss.smarpo.com/test.json
  - Something can also be said about the documentation being public
- 🛠️ **CSRF (Cross-Site Request Forgery) on any request**
  - There are no anti-CSRF tokens and the session cookie has SameSite none
- 📂 **LFI - Local file inclusion**
  - Legacy API endpoint for profile image retrieval > `GET /api/user/<ID>/image?file=../../../etc/passwd`
  - `../../docker-compose.yml` contains credentials but you would have to fuzz for it
- ⚠️SSRF (Server-Side Request Forgery)
  - Fetch profile image from URL without validation > `POST /api/user/6/image/fetch-url`, which includes the parameter `imageUrl`
  - Use the burp collab URL and report the HTTP request made to it (minimal impact shown)
  - The internal docker subnet range (`172.20.0.0/16`) and the internal IP of the HDshop (`172.20.0.10`) can be retrieved from `/api/settings` (request is also made after login)
  - By fuzzing or guessing, a user can find the IP (`172.20.0.20`) of the Security log Monitor app on port 80 > SSRF: `"imageUrl":"http://172.20.0.20"`
  - The response includes the base64 encoded `index.html` of the Security Log Monitor app, which includes `const response = await fetch('/api/logs')` (can ofc also be found by fuzzing)
  - Max impact can be shown by making SSRF to `"imageUrl":"http://172.20.0.20/api/logs"` (these logs contain cleartext passwords!)
---

![logging app](./images/log-monitor.png)

![hdshop](./images/shop.png)

![profile](./images/profile.png)

## TODO:

- **CSTI**
- **Open redirect**
---
