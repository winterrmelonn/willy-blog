## willy.work

A personal blog/website. Read about me, my blogs, and explore the UI I've curated. Send me a message, or request a contribution to the blog feed.

<img width="1512" height="947" alt="Screenshot 2026-10-31 at 4 43 38 AM" src="https://github.com/user-attachments/assets/cbd94d90-3ae0-4cd1-a936-e44c1eb28911" />
<img width="1511" height="950" alt="Screenshot 2026-10-31 at 4 43 03 AM" src="https://github.com/user-attachments/assets/e444c41e-d7a0-42f8-8e16-420dae1412a5" />
<img width="601" height="709" alt="Screenshot 2026-10-31 at 4 43 18 AM" src="https://github.com/user-attachments/assets/a10f594c-13eb-4b08-a295-4a819e4974b1" />
<img width="1512" height="949" alt="Screenshot 2026-10-31 at 4 44 05 AM" src="https://github.com/user-attachments/assets/79e10d68-bcc8-4090-856d-5a330b64f404" />
<img width="1512" height="960" alt="Screenshot 2026-10-31 at 4 44 15 AM" src="https://github.com/user-attachments/assets/d118da43-f86b-43ed-b21c-e4028e86e35b" />

Live deployment at: https://willy-blog-q6ko59o5a-willy-0e2c.vercel.app/
### Run it locally

You need [Node.js](https://nodejs.org) 20.9 or newer and a MongoDB database (a free
[MongoDB Atlas](https://www.mongodb.com/atlas) cluster works).

1. **Install the packages**

   ```bash
   git clone https://github.com/winterrmelonn/willy-blog.git
   cd willy-blog
   npm install
   ```

2. **Add the font.** The site uses [Lastik](https://www.thatthattype.com/fonts/lastik) by That That
   Type. Its license doesn't allow the font file on GitHub, so it isn't in this repo. Get the free
   download from that page, then copy `Fonts/Lastik Free Font/WOFF/LastikFreeFont-Free.woff2` from the
   zip to `app/fonts/Lastik.woff2`:

   ```bash
   mkdir -p app/fonts
   cp "path/to/Lastik Free Font/WOFF/LastikFreeFont-Free.woff2" app/fonts/Lastik.woff2
   ```

3. **Create a `.env` file** in the project folder:

   ```bash
   MONGO_URI="mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/DATABASE"
   BETTER_AUTH_URL="http://localhost:3000"
   BETTER_AUTH_SECRET="any long random string"   # e.g. from: openssl rand -base64 32
   TODOIST_API_TOKEN="your Todoist API token"     # optional: without it the calendar is just empty
   ```

   The Todoist token is under Settings → Integrations → Developer in Todoist.

4. **Start it**

   ```bash
   npm run dev
   ```

   Then open [http://localhost:3000](http://localhost:3000) in Chrome or Safari (VS Code's Simple
   Browser doesn't keep the sign-in cookie). Pages reload as you edit them.

To post blogs, edit the About page and projects, and review blog requests, sign up on the Profile page
with an email listed in `ADMIN_EMAILS` in `lib/auth.ts`.

**Deploying on Vercel:** set the same variables in the Vercel project (with `BETTER_AUTH_URL` set to the
live address), plus `LASTIK_WOFF2_BASE64`: the font file in base64 (`base64 -i app/fonts/Lastik.woff2 | pbcopy`
on a Mac). `scripts/font.mjs` writes the font from it before each build.

Author's note / further details:

willy.work is my personal blog/website. it started with, “i want to participate in stardance, but i don’t know what to make. i’ll follow the build your own blog guide because a personal website is a good thing to have.”

once i completed the tutorial, i had other ideas. my friend was using tailscale and a raspberry pi to vpn into his home network to use as an exit node, improving security and bypassing school wifi censorship. i wanted to do the same thing, but just as i installed and set up tailscale, the district patched the method. my mac also can’t sustain the amount of chrome tabs i have open (~50) but i have a nice, 64 gb ram desktop sitting at home.

the idea was to create my own “tailscale” using a free oracle cloud server and headscale, which would also allow me to rdp onto my desktop, in case i wanted to use a stronger cad tool or anything that would require a stronger computer.

i set up the oracle cloud server, i set up headscale, and then i realized my website was straight BUNS. so i poured hours and hours following tailwind css tutorials & reading docs to make my ui presentable & the features/pages functional and to make a cool visual home page, a field of lillies.

after my fair share of manual code and a drawn learning experience, i used claude to polish my website in the last devlog and to add some advanced features that would’ve taken me a while in this last devlog before shipping. super proud of the finished project; functional blog system, login/admin system, calendar synced with my todoist, and beautiful ui. i incorporated and improved on visuals i used in previous projects into my website, which i’m proud of.

to add:
i should add a “projects” page, similar to my blog page just with all of my projects across hackathons, school projects, hack club events, etc.
a socials page to link to my instagram, github, etc.

at work, i talked with a cloud engineer today and he was hyping the heck out of aws. i’m planning on moving all of willy.work onto aws. mongodb is already on aws; i would use aws’s cloud services instead of the oracle one i have set up already, and switch to aws hosting/dns instead of vercel. i also say willy.work, but in reality i haven’t bought that domain yet.

hopefully i’ll get some stardust to get dns funding from this, even though stardance is ending.
i’ll post some more blogs, hopefully ygs enjoy the glimpse into my life and the visuals i’ve created. :D

### Credits

- "Spider Lily (Lycoris Radiata)" by [OsianOHM](https://sketchfab.com/OsianOHM), CC BY 4.0
- "IkanKoi3D_032" by [nurulaini](https://sketchfab.com/nurulaini), CC BY 4.0
