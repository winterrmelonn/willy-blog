Started by... actually testing the website. (I was too focused on the UI I never got around to actually posting a blog, until now.) The "sign up" and "sign in" is bare bones to say the least and I can't see my password to see if I've made any misclicks. Faced an issue when creating an account, with the email I whitelisted to have posting privledges in auth.ts, the post button doesn't redirect me to the post page. (Later realized this was because I'm using VS Code simple browser, used Chrome later and it was fine.)

Added a basic Calendar with just the dates and a highlight around today's date.
Gave the sign in page an actual UI and made it so the most recent character input of your password isn't censored. 
Gave the post page a UI as well. This stuff is easy to do manually, just read tailwind docs and add stuff in the className= within the divisions.

Claude'd a complete rework of the home page visual using a reference image which reduced the number of triangles, added depth, added trees and a leaf canopy, and make the scene more animate.
Tweaked with the branches, tree details, wind strength, leaf density, and tree density.

Changed the spooky green fog/background to a warmer, autumn daytime feel.
Added a loading page and then starting to make some UI changes. Dividing the top bar & buttons from the rest of the page and adding a 3-dot menu to let the user switch between different UI I've made over time. (I added one I used in my "comp." project.)

Made a couple of quick UI fixes, such as making the top bar more minimal by making the buttons more minimal and shrinking it.
Made the calendar take up the entire page and moved the dates into the top left. Used todoist API developer integration to sync my todoist with the website, and made my calendar public.

Added bullet points for each task, updated vercel with my todoist API key, made some bug fixes such as preventing both UI's from being toggled on at once, moved the "Theme" button to under the triple dot menu, shrunk the loading screen lily, added a next/previous button for the calendar, changed the Sign in page to a Profile page and added a sign out button. 

This is a backend thing but "add paragraph" in my post blog page didn't have a button to cancel that new paragraph.
Added transitions, adjusted the brightness on a few things (moonlight on the lily field), made dark mode work for the home page visuals, and added fireflies.

Tested posting a real blog post, recieved an auth error. Fixed that error, posted the blog, to find that the only the title/date was saved/displayed onto the blog page. Fixed the issue of the browser displayed a cached copy of the blog page instead of the database. Fixed the blog not showing my line breaks. Made each blog into a tweet-like bubble, and added a delete feature for the admin. 

Added a red glow behind only the flowers for lily ui dark mode. Deleted the black "my blogs" button from the tutorial, made a few formatting changes with the willy.work title text, and browsed freefaces and swithced to Lastik.

Expanded the profile page heavily. Added a "send a message" tab and a "contribute a blog" tab and redid the UI formatting to have the page/button selection on the left and then the page displayed on the right. 