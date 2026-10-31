willy.work devlog #3

Clicked on MY OWN SCHOOL’s newsletter website and ALMOST fell for a fake captcha malware attack. Stupidly ran a pasted command in my terminal (I trusted the website…) but once it closed down my Oracle Cloud connection and closed my terminal I knew it was up to something. When it started asking for my password I knew it was malware. Anyways, as it relates to this project I’ve just spent like 30 minutes outside of VS Code resetting my Mongo DB password and generating a new auth key. I had to refresh myself on where to put everything, had to update in both Vercel and my .env, and I took this opportunity to rename the database Vercel uses from “test” to “stardance-blog.” So at least one good thing came out of me almost getting hacked.

Had most of the devlog written but I restarted my Mac after running that malicious command (I rarely restart my Mac) so now I have to restart this devlog and see how much I remember doing.

Created a localStorage to save the true/false value for the light/dark mode toggle. However, on reload the light mode flashed for a second before toggling to the saved dark mode. I read and followed this guide to fix the white flash: https://nextjs.org/docs/app/guides/preventing-flash-before-hydration. Just added a small inline script in the <head> of layout.tsx so the .dark class is added before the page loads.

Did some vanity changes for the nav bar. I put the button styles in a class string and just spammed that for all of my buttons. One of the best looking changes was a simple addition: “flex gap-2 items-center px-6 py-4” in <nav>, which lined up all of the buttons to the right of the page.

Started work on the part I’m most excited about; a 3D home page. I really want spider lilies. I asked Claude how to get started on this; I could either code it all in react three fiber, which was the “hard” way or download a 3D model and display it all nice and fancy using react three fiber.

After downloading everything using the react three fiber installation tutorial, I used to build a procedural stem. This is the SpiderLily.tsx. Used <Canvas>, OrbitControls, CatmullRomCurve3 passing through a list of Vector3 points.

Realized that doing this for the entire flower with petals and shading and texture… would be way too difficult and doesn’t seem like the coding I’d want to do anyway… if anything I’d want to use blender and import that but, at least for now I just downloaded a Sketchfab model with a CC BY license. 

Started that in SpiderLilyModel.tsx. Successfully imported the file and added it to layout.tsx

Removed OrbitControls because the spider lilies is supposed to be just the home page.

Read over tailwind css docs and used fixed, inset, and -z to get the spider lily to take up the entire page from corner to corner and have it on a layer below all of the text.

Instead of having the useGLTF directly in the <Canvas> I had that be the stage and created a separate function where useGLTF lives and used that as an actor. 

Created a position prop for that actor function.

Switched from <primitive> to <Clone> so I could have multiple spider lilies. 

Now I have multiple rendered spider lilies with adjustable positions and a functional fallback! Super proud to say that I’m actually getting the hang of tailwind css and a teensy bit of react three fiber / react three and I can now make my own code by reading docs. (really crappy code, albeit)

So at first I had two lilies taking up the whole screen and the plan WAS to just have the user cursor like sway those two lilies or something… but idk I wanted like a whole field with cool fog and maybe some trees so I searched up a reference picture (attached here) and I’m gonna try to do something like this.