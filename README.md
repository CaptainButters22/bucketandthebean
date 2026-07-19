# Bucket and the Bean

A simple static coffee shop website built with HTML, CSS, and JavaScript.

## Preview locally

1. Open `index.html` directly in your browser.
2. Or run a local server from PowerShell:

```powershell
cd C:\Users\danie\coffee-shop
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Deploy options

### Option 1: GitHub Pages

1. Install Git: https://git-scm.com/downloads
2. Create a GitHub repository named `bucketandthebean` or any name you like.
3. In PowerShell:
   ```powershell
   cd C:\Users\danie\coffee-shop
git init
git add .
git commit -m "Initial coffee shop site"
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
   ```
4. In GitHub repository Settings > Pages, choose branch `main` and root `/`.
5. Create a `CNAME` file in this folder with your custom domain:
   ```text
   bucketandthebean.com
   ```
6. Update domain DNS at your registrar:
   - Add an A record for `@` pointing to GitHub Pages IPs:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - Add a CNAME record for `www` pointing to `<your-username>.github.io`.

### Option 2: Netlify

1. Sign up at https://app.netlify.com.
2. Use drag-and-drop deployment or connect your GitHub repo.
3. In Netlify site settings, add `bucketandthebean.com` as a custom domain.
4. Update DNS at your registrar:
   - Use Netlify nameservers, or
   - Create a CNAME record for `www` to your Netlify site (`<your-site>.netlify.app`) and
   - Add an ALIAS/ANAME for `@` if your registrar supports it.

## Notes about `bucketandthebean.com`

- The website content already uses the `bucketandthebean.com` domain in the footer and metadata.
- To make it live, the domain must be pointed to the host platform you choose.
- If you need help with DNS records, I can guide you through your registrar settings.
