# Client list (CRM): setup guide

When someone clicks **Submit** on a quote request or a custom request, three things happen automatically, and the customer sees "Request sent" right on the page:

1. **You get an email with a PDF quote attached** and everything they entered. Every request gets a quote number like **MMS-0001**. Hit **Reply** and it goes straight to the customer.
2. **The customer gets their own email.** For a sign, it has their PDF quote: the sign details and price only, never anything they typed, so nobody can use your form to send other people messages. For a custom request, it confirms their request number.
3. **A new row appears in your Google Sheet** (the "Leads" tab), one row per request:
   - **When and who:** the date and time, the **quote number**, **Type** (Home, Property or **Custom**, color-coded), name, email, phone, property.
   - **The sign they designed:** sign number, unit numbers, doors, style, orientation, size, font, finish, the price they saw, and their **Notes** (anything else they want you to know, plus any extra signs they asked about).
   - **Custom requests** also fill **Their design** (what they're picturing) and **Their questions**.
   - **Yours to fill in:** **Sale made** and **Paid** are checkboxes that turn green when checked, plus a column for your own notes.

The website itself stores nothing. Each request goes straight to your Google account, the same place your email already is.

It takes about 10 minutes, once. Do it while signed in to **the Google account you use for the business** (browncountyforge@gmail.com).

---

## Step 1: Make the sheet

1. Go to **sheets.google.com** and click **Blank spreadsheet**.
2. Name it, for example **Marks Metal Signs Clients** (click "Untitled spreadsheet" at the top left).

## Step 2: Copy the script into your sheet

The script is what connects the website to your sheet. It lives inside **your** sheet, in your Google account, not on the website.

1. **Copy the script.** In the website files, open the **`crm`** folder, then **`Code.gs`**.
   - **On GitHub:** click `Code.gs`, then the **Copy raw file** button (two overlapping squares, top right of the code).
   - **From the folder on your computer:** open `crm/Code.gs` in any text editor (TextEdit, Notepad), press **Ctrl+A** (Mac: **Cmd+A**) to select everything, then **Ctrl+C** (Mac: **Cmd+C**).
2. **Open your sheet's script editor.** In the sheet from Step 1, click **Extensions → Apps Script**. A new tab opens with a code editor showing a few lines like `function myFunction() {}`.
3. **Replace what's there.** Click in the editor, select all of it (**Ctrl+A** / **Cmd+A**), and paste (**Ctrl+V** / **Cmd+V**). The editor should now start with `Marks Metal Signs: client list` and be about 150 lines long.
4. **Check the email address.** Near the top is the line `notifyEmail: 'browncountyforge@gmail.com'`. That's where quote emails go. To use a different address, change only the part between the quotes.
5. **Save:** click the **Save** icon (the floppy disk), or press **Ctrl+S** / **Cmd+S**.
6. Optional: click **Untitled project** at the top and rename it **Marks Metal Signs website**, so it's easy to find later.

## Step 3: Set up the columns

1. At the top of the editor there's a dropdown next to **Run**. Make sure it says **setup**.
2. Click **Run**.
3. Google asks for permission the first time. Click **Review permissions**, pick your account, then **Advanced** → **Go to Untitled project (unsafe)** → **Allow**.
   - The "unsafe" warning shows for every personal script. It's your own code, and it only touches this sheet and sends emails from your account.
4. Go back to the sheet's tab. You'll see a **Leads** tab with a black header row and checkboxes in Sale made and Paid.

## Step 4: Try it (optional)

1. Back in the editor, choose **testRequest** in the dropdown and click **Run**.
2. A "Test Person" row appears in the sheet, and you get an email. Delete that row afterward.

## Step 5: Turn it on for the website

1. In the editor, click the blue **Deploy** button (top right) → **New deployment**.
2. Click the gear icon next to "Select type" → **Web app**.
3. Fill in:
   - **Description:** Website
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click **Deploy** (allow permissions again if asked).
5. Copy the **Web app URL**. It's long and ends in **`/exec`**.

"Anyone" only lets the website *send* new requests in. Nobody can read your sheet through that link.

## Step 6: Put the link in the website

Do this after you've put the latest website files on WordPress.

1. Open **`site/settings.js`** in your website files. It's a short file.
2. Paste the link between the quotes on the `crmUrl` line, like this:

   ```js
   crmUrl: 'https://script.google.com/macros/s/AKfy...long...code/exec'
   ```

3. Save. On WordPress, that means saving or re-uploading `settings.js`.

**If you ever re-download the website files from the repo,** paste the link back in afterward. The repo's copy of `settings.js` is left blank on purpose, so a fresh download replaces your link with an empty one. Until it's back, quote requests show an "Email my request" button instead.

The link isn't a password: it can only send new requests in, never read your sheet.

## Step 7: Check it

1. Go to your website's **Design your sign** page and send yourself a quote with your own email.
2. You should get the email within a minute, and the row should appear in the sheet.

---

## Good to know

- **Change where quote emails go:** edit `notifyEmail` at the top of the script and click Save. Then **Deploy → Manage deployments** → the pencil icon → **Version: New version** → **Deploy**. The link stays the same. (Same steps to stop sending customers a copy: set `sendCustomerCopy: false`.)
- **If you change prices on the website** (`site/assets/js/pricing.js`), change the `PRICES` line near the top of the script to match, then deploy a new version the same way. The script works out each price itself, so the two need to agree.
- **Email limit:** Gmail sends about 100 emails a day, and each request sends two (yours and the customer's), so about 50 requests a day. Past that, rows are still saved and emails resume the next day.
- **Keep the sheet private.** It holds customers' names and emails, so don't share it with "Anyone with the link".
- **Moving the site or changing the domain** doesn't change anything on the Google side. Just make sure `settings.js` still has your link. If quotes ever stop arriving, check that first.
